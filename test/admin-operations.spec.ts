import { env } from "cloudflare:workers";

import { describe, expect, it, vi } from "vitest";

import { listAudit } from "../app/domain/admin-audit.server";

import { consoleSummary } from "../app/domain/admin-directory.server";

import { listAnomalies, receiptStates, taskStates } from "../app/domain/admin-operations.server";

import { requeueTask } from "../app/domain/scheduled-work.server";

import { verifiedSession } from "./fixtures/account-fixtures";

import {
  insertCredentials,
  insertEntitlement,
  insertStore,
  insertTaxIdentifiers,
  insertWorkspace,
  now,
} from "./fixtures/database-fixtures";

import { fakeQueue, queued } from "./fixtures/queue-fixture";

import { at, hour, later, setupScenarios } from "./fixtures/admin-scenarios";

setupScenarios();

describe("anomalie e lavori", () => {
  async function storeWithRuns(id: string, environment: "production" | "sandbox", ok: number[]) {
    await env.DB.batch([
      insertStore({ id, ebayUserId: id, environment }),
      insertCredentials({ storeId: id, accessExpiresAt: later(48 * hour) }),
      ...ok.map((value, index) =>
        env.DB.prepare(
          "INSERT INTO sync_runs (store_id, started_at, ok, new_orders) VALUES (?, ?, ?, 0)",
        ).bind(id, later(index * 60_000), value),
      ),
    ]);
  }

  it("raggruppa le letture fallite per ambiente senza coinvolgere i negozi sani", async () => {
    await env.DB.batch(insertWorkspace({ id: "w-a" }));
    await storeWithRuns("s-ok", "production", [0, 1]);
    await storeWithRuns("s-ko1", "production", [0, 0]);
    await storeWithRuns("s-ko2", "production", [1, 0, 0]);
    const reads = (await listAnomalies(env.DB, at(later(hour)))).find(
      (a) => a.kind === "store_reads",
    );
    expect(reads).toMatchObject({ severity: "p2", count: 2 });
    expect(reads!.subjects.map((subject) => subject.id).sort()).toEqual(["s-ko1", "s-ko2"]);
    // Quando nessun negozio attivo dell'ambiente legge, il problema è eBay.
    await env.DB.prepare(
      `INSERT INTO sync_runs (store_id, started_at, ok, new_orders)
       VALUES ('s-ok', ?1, 0, 0), ('s-ok', ?2, 0, 0)`,
    )
      .bind(later(10 * 60_000), later(11 * 60_000))
      .run();
    const down = await listAnomalies(env.DB, at(later(hour)));
    expect(down.find((a) => a.kind === "ebay_down")).toMatchObject({ severity: "p1", count: 3 });
    expect(down.some((a) => a.kind === "store_reads")).toBe(false);
  });

  it("segnala i negozi in cui la maggior parte degli ordini italiani recenti non ha CF", async () => {
    await env.DB.batch(insertWorkspace({ id: "w-a" }));
    await storeWithRuns("s-gap", "production", [1]);
    await storeWithRuns("s-few", "production", [1]);
    const check = at(later(48 * hour));
    const order = (id: string, store: string, ageHours: number, extra = {}) => {
      const values = { marketplace: "EBAY_IT", country: "IT", ...extra };
      return env.DB.prepare(
        `INSERT INTO orders (id, store_id, ebay_order_id, creation_time, last_modified_time,
           currency, total_minor, marketplace_id, buyer_json, retention_until, purge_after)
         VALUES (?1, ?2, ?1, ?3, ?3, 'EUR', 1299, ?4, json_object('billingAddress',
           json_object('countryCode', ?5)), ?6, ?6)`,
      ).bind(
        id,
        store,
        new Date(check.getTime() - ageHours * hour).toISOString(),
        values.marketplace,
        values.country,
        later(400 * 24 * hour),
      );
    };
    const tax = (orderId: string) =>
      insertTaxIdentifiers({ id: `t-${orderId}`, orderId, type: "CODICE_FISCALE", value: "X" });
    await env.DB.batch([
      // Cinque senza CF su otto: oltre il 60%.
      ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => order(`gap-${n}`, "s-gap", 4 + n)),
      tax("gap-6"),
      tax("gap-7"),
      tax("gap-8"),
      // Esclusi: troppo recente, troppo vecchio, estero, altro marketplace.
      order("gap-new", "s-gap", 1),
      order("gap-old", "s-gap", 60),
      order("gap-foreign", "s-gap", 5, { country: "DE" }),
      order("gap-de", "s-gap", 5, { marketplace: "EBAY_DE" }),
      // Quattro senza CF su quattro: sotto la soglia di cinque ordini.
      ...[1, 2, 3, 4].map((n) => order(`few-${n}`, "s-few", 4 + n)),
    ]);
    const gap = (await listAnomalies(env.DB, check)).find((a) => a.kind === "tax_missing");
    expect(gap).toMatchObject({ severity: "p2", count: 5 });
    expect(gap!.subjects.map((subject) => subject.id)).toEqual(["s-gap"]);
    // Il CF arrivato su un ordine unito vale per l'ordine che lo contiene: quattro su otto.
    await env.DB.batch([
      order("gap-1-part", "s-gap", 60),
      env.DB.prepare("UPDATE orders SET merged_into = 'gap-1' WHERE id = 'gap-1-part'"),
      tax("gap-1-part"),
    ]);
    expect((await listAnomalies(env.DB, check)).some((a) => a.kind === "tax_missing")).toBe(false);
  });

  it("conta in ritardo le ricevute ancora aperte da più di un'ora", async () => {
    const receipt = (id: string, eventAt: string, completedAt: string | null = null) =>
      env.DB.prepare(
        `INSERT INTO webhook_receipts (id, provider, environment, provider_id, topic, object_id,
          event_at, expires_at, completed_at) VALUES (?1, 'stripe', 'test', ?1, 'evento', 'o', ?2, ?3, ?4)`,
      ).bind(id, eventAt, later(24 * hour), completedAt);
    await env.DB.batch([
      receipt("r-fresca", later(-hour + 60_000)),
      receipt("r-ferma", later(-hour - 60_000)),
      receipt("r-chiusa", later(-2 * hour), later(-hour)),
    ]);
    expect(await receiptStates(env.DB, at(now))).toEqual([
      { provider: "ebay", pending: 0, stalled: 0, oldest: null },
      { provider: "stripe", pending: 2, stalled: 1, oldest: later(-hour - 60_000) },
      { provider: "telegram", pending: 0, stalled: 0, oldest: null },
    ]);
  });

  it("riaccoda soltanto un lavoro fermo e non preso da un consumer", async () => {
    const stalled = (await taskStates(env.DB, at(now))).filter((task) => task.stalled);
    expect(stalled.map((task) => task.task)).toContain("billing");
    const send = vi.fn(async () => queued);
    const queueEnv = { ...env, WORK_QUEUE: fakeQueue({ send }) } as Env;
    expect(await requeueTask(queueEnv, "billing", at(now))).toBe("queued");
    expect(send).toHaveBeenCalledWith({ task: "billing", slot: "2026-09-13T20:00:00.000Z" });
    await env.DB.prepare("UPDATE scheduled_tasks SET locked_until = ? WHERE task = 'billing'")
      .bind(later(hour))
      .run();
    expect(await requeueTask(queueEnv, "billing", at(now))).toBe("busy");
    await env.DB.prepare(
      "UPDATE scheduled_tasks SET locked_until = NULL, done_at = ? WHERE task = 'billing'",
    )
      .bind(now)
      .run();
    expect(await requeueTask(queueEnv, "billing", at(now))).toBe("busy");
    expect(send).toHaveBeenCalledTimes(1);
    // Concluso in un periodo passato e senza nuovi turni dal cron: riparte il turno corrente.
    const stalledLater = at(later(3 * hour));
    expect(
      (await taskStates(env.DB, stalledLater)).find((t) => t.task === "billing"),
    ).toMatchObject({
      stalled: true,
    });
    expect(await requeueTask(queueEnv, "billing", stalledLater)).toBe("queued");
    expect(send).toHaveBeenLastCalledWith({ task: "billing", slot: "2026-09-13T23:00:00.000Z" });
  });
});

describe("panoramica e registro", () => {
  it("conta account, spazi coperti e negozi con problemi", async () => {
    const owner = await verifiedSession("panoramica@example.invalid");
    await env.DB.batch([
      ...insertWorkspace({ id: "w-a", userId: owner.userId }),
      ...insertWorkspace({ id: "w-b" }),
      insertEntitlement({ workspaceId: "w-a", source: "premium", endsAt: later(240 * hour) }),
      insertEntitlement({
        workspaceId: "w-b",
        source: "admin",
        endsAt: later(240 * hour),
        grantedBy: "a",
        grantReason: "b",
      }),
      insertStore({ id: "s-ok" }),
      insertCredentials({ storeId: "s-ok", accessExpiresAt: later(48 * hour) }),
      insertStore({ id: "s-scaduto", workspaceId: "w-b" }),
    ]);
    expect(await consoleSummary(env.DB, at(now))).toMatchObject({
      waitlisted: 0,
      coverage: { premium: 1, admin: 1, lifetime: 0, trial: 0 },
      stores: { active: 1, problems: 1 },
    });
  });

  it("mostra nel registro il titolare dello spazio e il nome del negozio", async () => {
    const owner = await verifiedSession("registro@example.invalid");
    await env.DB.batch([
      ...insertWorkspace({ id: "w-a", userId: owner.userId }),
      insertStore({ id: "s-a" }),
      env.DB.prepare(`INSERT INTO admin_audit (id, actor, operation, target, outcome, at)
        VALUES ('a1', 'admin', 'store-pause', 'workspace:w-a:store:s-a', 'done', ?1),
               ('a2', 'admin', 'save-notice', 'notice:n-1', 'done', ?1)`).bind(now),
    ]);
    const [pause, notice] = await listAudit(env.DB, {});
    expect([pause, notice].map((entry) => entry!.id).sort()).toEqual(["a1", "a2"]);
    const entries = await listAudit(env.DB, {});
    expect(entries.find((entry) => entry.id === "a1")).toMatchObject({
      workspace: { id: "w-a", email: "registro@example.invalid" },
      store: { id: "s-a", label: "s-a" },
    });
    expect(entries.find((entry) => entry.id === "a2")).toMatchObject({
      workspace: null,
      store: null,
    });
    expect(await listAudit(env.DB, { target: "workspace:w-a" })).toHaveLength(1);
  });
});
