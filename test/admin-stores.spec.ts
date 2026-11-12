import { env } from "cloudflare:workers";
import { storeActions } from "../app/components/admin/store-actions";

import { describe, expect, it, vi } from "vitest";

it.each([
  [true, [], 0, { sync: true, retryDetails: false }],
  [true, [], 1, { sync: true, retryDetails: true }],
  [false, [], 1, { sync: false, retryDetails: false }],
  [true, ["admin"], 1, { sync: false, retryDetails: false }],
] as const)(
  "elenco e scheda usano le stesse azioni: attivo %s, pause %s, errori %s",
  (active, pauses, errors, expected) => {
    expect(storeActions(active, pauses, errors)).toEqual(expected);
  },
);

import {
  listAbuseSignals,
  normalizedName,
  reviewAbuseSignal,
} from "../app/domain/abuse-review.server";

import { consoleSummary, listAllStores } from "../app/domain/admin-directory.server";

import { grantHistoryExtension, revokeHistoryExtension } from "../app/domain/concessions.server";

import {
  applyWorkspacePlan,
  assistFreeStore,
  chooseFreeStore,
} from "../app/domain/free-store.server";

import { orderAllowance } from "../app/domain/grants.server";

import { purgeExpiredRecords } from "../app/domain/maintenance.server";

import { requestStoreSync } from "../app/domain/order-sync.server";

import { confirmStoreTransfer, prepareStoreTransfer } from "../app/domain/store-transfer.server";

import { listStores, resumeStore, setAdminPause } from "../app/domain/stores.server";

import { action as exportAction } from "../app/routes/order-export";

import { loader as ordersLoader } from "../app/routes/orders";

import { completeStoreLink } from "../app/domain/store-link.server";

import {
  claimStoreLinkSession,
  startStoreLink as beginLink,
} from "../app/integrations/ebay/store-link.server";

import { syntheticEbay } from "./fixtures/ebay-fixtures";

import { loader as loadStores } from "../app/routes/stores";

import { verifiedSession } from "./fixtures/account-fixtures";

import {
  insertCredentials,
  insertEntitlement,
  insertOrder,
  insertStore,
  insertWorkspace,
  now,
} from "./fixtures/database-fixtures";

import { fakeQueue, queued } from "./fixtures/queue-fixture";

import { callRoute, routeResponse } from "./fixtures/route-fixtures";

import { at, hour, later, admin, audit, act, setupScenarios } from "./fixtures/admin-scenarios";

setupScenarios();

describe("negozi con problemi", () => {
  it("la panoramica conta gli stessi negozi dell'elenco, anche con soli dettagli falliti", async () => {
    await env.DB.batch([
      ...insertWorkspace({ id: "w-a" }),
      insertStore({ id: "s-ok" }),
      insertCredentials({ storeId: "s-ok", accessExpiresAt: later(48 * hour) }),
      // Consenso valido e letture riuscite: l'unico problema è il dettaglio di un ordine.
      insertStore({ id: "s-dettagli" }),
      insertCredentials({ storeId: "s-dettagli", accessExpiresAt: later(48 * hour) }),
      ...insertOrder("o-dettagli", { storeId: "s-dettagli" }),
      env.DB.prepare(`INSERT INTO order_source_refs (store_id, source, external_order_id, order_id,
          last_modified_time, detail_error)
        VALUES ('s-dettagli', 'fulfillment', 'ebay-o-dettagli', 'o-dettagli', ?, 'unavailable')`).bind(
        now,
      ),
      insertStore({ id: "s-senza-consenso" }),
    ]);
    const { rows } = await listAllStores(env.DB, { problems: true }, at(now));
    expect(rows.map((row) => row.id).sort()).toEqual(["s-dettagli", "s-senza-consenso"]);
    expect((await consoleSummary(env.DB, at(now))).stores).toEqual({ active: 2, problems: 2 });
  });
});

describe("assistenza sui negozi e sugli spazi", () => {
  it("fa eccezione ai 90 giorni del negozio Free con autore e motivo", async () => {
    const { userId } = await verifiedSession("free.assistito@example.invalid");
    await env.DB.batch([
      ...insertWorkspace({ id: "w-a", userId }),
      insertStore({ id: "s-1" }),
      insertStore({ id: "s-2", linkedAt: later(1000) }),
    ]);
    expect(await chooseFreeStore(env.DB, userId, "s-2", at(now))).toEqual({ result: "done" });
    expect(await chooseFreeStore(env.DB, userId, "s-1", at(later(hour)))).toMatchObject({
      result: "locked",
    });
    const input = { storeId: "s-1", actor: "admin", reason: "Negozio sbagliato" };
    expect(await assistFreeStore(env.DB, input, at(later(hour)))).toBe("done");
    expect(await assistFreeStore(env.DB, input, at(later(hour)))).toBe("unchanged");
    expect(await assistFreeStore(env.DB, { ...input, storeId: "s-x" })).toBe("not_found");
    expect(
      (
        await env.DB.prepare(
          "SELECT store_id, reason FROM ebay_store_pauses WHERE reason = 'plan'",
        ).all()
      ).results,
    ).toEqual([{ store_id: "s-2", reason: "plan" }]);
    expect(
      await env.DB.prepare(
        "SELECT kind, actor, reason FROM free_store_changes ORDER BY rowid DESC",
      ).first(),
    ).toEqual({ kind: "assisted", actor: "admin", reason: "Negozio sbagliato" });
    await env.DB.batch([
      insertEntitlement({
        workspaceId: "w-a",
        source: "admin",
        endsAt: later(48 * hour),
        grantedBy: "a",
        grantReason: "b",
      }),
    ]);
    expect(await assistFreeStore(env.DB, { ...input, storeId: "s-2" }, at(later(2 * hour)))).toBe(
      "covered",
    );
  });

  it("estende e revoca lo storico con autore e motivo", async () => {
    await env.DB.batch(insertWorkspace({ id: "w-a" }));
    const input = { workspaceId: "w-a", author: "admin", reason: "Consenso e costo concordati" };
    expect(await grantHistoryExtension(env.DB, { ...input, months: 12 })).toBe("invalid");
    expect(await grantHistoryExtension(env.DB, { ...input, months: 18 })).toBe("done");
    expect(await grantHistoryExtension(env.DB, { ...input, workspaceId: "w-x", months: 18 })).toBe(
      "not_found",
    );
    const { id } = (await env.DB.prepare("SELECT id FROM history_extensions").first<{
      id: string;
    }>())!;
    expect(await revokeHistoryExtension(env.DB, { workspaceId: "w-b", extensionId: id })).toBe(
      "not_found",
    );
    expect(await revokeHistoryExtension(env.DB, { workspaceId: "w-a", extensionId: id })).toBe(
      "done",
    );
    expect(await revokeHistoryExtension(env.DB, { workspaceId: "w-a", extensionId: id })).toBe(
      "not_found",
    );
  });

  it("mette in pausa un negozio dall'assistenza: il venditore la vede e non la toglie", async () => {
    const { userId } = await verifiedSession("pausa.admin@example.invalid");
    await env.DB.batch([
      ...insertWorkspace({ id: "w-a", userId }),
      insertStore({ id: "s-a" }),
      insertCredentials({ accessExpiresAt: later(48 * hour) }),
      insertEntitlement({
        source: "admin",
        endsAt: later(240 * hour),
        grantedBy: "a",
        grantReason: "b",
      }),
    ]);
    expect(await setAdminPause(env.DB, "s-a", true, at(now))).toBe("done");
    expect(await setAdminPause(env.DB, "s-a", true, at(now))).toBe("done");
    expect(await setAdminPause(env.DB, "s-x", true, at(now))).toBe("not_found");
    expect(await resumeStore(env.DB, userId, "s-a")).toBe("done");
    expect((await listStores(env.DB, userId))[0]).toMatchObject({
      connection: "paused",
      pauseReasons: ["admin"],
    });
    expect(await requestStoreSync(env, userId, "s-a", {}, at(now))).toBe("invalid");
    expect(await setAdminPause(env.DB, "s-a", false, at(now))).toBe("done");
    expect((await listStores(env.DB, userId))[0]).toMatchObject({ connection: "active" });
    // Dalla console la lettura si chiede per qualsiasi spazio.
    const send = vi.fn(async () => queued);
    const sync = await requestStoreSync(
      { ...env, WORK_QUEUE: fakeQueue({ send }) } as Env,
      null,
      "s-a",
      {},
      at(now),
    );
    expect(sync).toBe("queued");
    expect(send).toHaveBeenCalledWith({ syncStore: "s-a" });
  });
});

describe("trasferimento assistito di un negozio", () => {
  async function stores() {
    const owner = await verifiedSession("cedente@example.invalid");
    const buyer = await verifiedSession("acquirente@example.invalid");
    await env.DB.batch([
      ...insertWorkspace({ id: "w-a", userId: owner.userId }),
      ...insertWorkspace({ id: "w-b", userId: buyer.userId }),
      insertStore({ id: "s-a" }),
      insertStore({ id: "s-a2", ebayUserId: "e-a2", linkedAt: later(1000) }),
      insertCredentials({ accessExpiresAt: later(48 * hour) }),
      env.DB.prepare(`INSERT INTO orders (id, store_id, ebay_order_id, creation_time,
          last_modified_time, currency, total_minor) VALUES ('o-a', 's-a', 'ebay-a', ?1, ?1, 'EUR', 100)`).bind(
        now,
      ),
      env.DB.prepare(`INSERT INTO sync_state (store_id, last_success_at, updated_at)
        VALUES ('s-a', ?1, ?1)`).bind(now),
      env.DB.prepare(`INSERT INTO telegram_store_preferences (store_id, enabled, updated_at)
        VALUES ('s-a', 1, ?)`).bind(now),
    ]);
    return { owner, buyer };
  }
  const prepare = (
    input: Partial<{ storeId: string; toWorkspaceId: string; actor: string }> = {},
  ) =>
    prepareStoreTransfer(
      env.DB,
      {
        storeId: "s-a",
        toWorkspaceId: "w-b",
        actor: "admin",
        reason: "Cessione verificata",
        ...input,
      },
      at(now),
    );

  it("sposta soltanto l'identità del negozio e nega l'accesso al vecchio spazio", async () => {
    const { owner, buyer } = await stores();
    expect(await prepare({ toWorkspaceId: "w-a" })).toEqual({ result: "same_workspace" });
    expect(await prepare({ toWorkspaceId: "w-x" })).toEqual({ result: "workspace_not_found" });
    expect(await prepare({ storeId: "s-x" })).toEqual({ result: "not_found" });
    const prepared = await prepare();
    expect(prepared).toMatchObject({
      result: "prepared",
      preview: { orders: 1, toWorkspaceId: "w-b" },
    });
    if (prepared.result !== "prepared") return;
    // Soltanto l'admin che l'ha preparato lo conferma.
    expect(await confirmStoreTransfer(env, { id: prepared.id, actor: "altro" }, at(now))).toEqual({
      result: "expired",
    });
    expect(await confirmStoreTransfer(env, { id: prepared.id, actor: "admin" }, at(now))).toEqual({
      result: "done",
      transfer: { storeId: "s-a", from: "w-a", to: "w-b" },
    });
    // Ripetuta, la conferma non esegue nulla di nuovo.
    expect(
      await confirmStoreTransfer(env, { id: prepared.id, actor: "admin" }, at(later(1000))),
    ).toEqual({
      result: "already",
    });

    expect((await listStores(env.DB, owner.userId)).map((store) => store.id)).toEqual(["s-a2"]);
    // Il nuovo spazio non vede ancora il negozio: lo ricollega con il proprio consenso.
    expect(await listStores(env.DB, buyer.userId)).toEqual([]);
    const counts = await env.DB.prepare(`SELECT
        (SELECT COUNT(*) FROM orders WHERE store_id = 's-a') AS orders,
        (SELECT COUNT(*) FROM ebay_store_credentials WHERE store_id = 's-a') AS credentials,
        (SELECT COUNT(*) FROM sync_state WHERE store_id = 's-a') AS sync,
        (SELECT COUNT(*) FROM telegram_store_preferences WHERE store_id = 's-a') AS telegram,
        (SELECT COUNT(*) FROM deleted_order_keys WHERE store_id = 's-a') AS deleted,
        (SELECT workspace_id FROM ebay_stores WHERE id = 's-a') AS workspace`).first();
    expect(counts).toEqual({
      orders: 0,
      credentials: 0,
      sync: 0,
      telegram: 0,
      deleted: 0,
      workspace: "w-b",
    });
    // Il vecchio spazio sceglie il negozio attivo fra quelli rimasti.
    expect(
      await env.DB.prepare(
        "SELECT store_id FROM free_store_changes WHERE workspace_id = 'w-a' ORDER BY rowid DESC",
      ).first(),
    ).toEqual({ store_id: "s-a2" });
    expect(await requestStoreSync(env, owner.userId, "s-a")).toBe("not_found");
  });

  it("elimina a lotti gli ordini del negozio trasferito e riprende dopo il tetto", async () => {
    await stores();
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO orders (id, store_id, ebay_order_id, creation_time,
          last_modified_time, currency, total_minor) VALUES ('o-a2', 's-a2', 'ebay-a2', ?1, ?1, 'EUR', 100)`).bind(
        now,
      ),
      ...Array.from({ length: 201 }, (_, index) =>
        env.DB.prepare(`INSERT INTO orders (id, store_id, ebay_order_id, creation_time,
            last_modified_time, currency, total_minor) VALUES (?1, 's-a', ?1, ?2, ?2, 'EUR', 100)`).bind(
          `o-lotto-${index}`,
          now,
        ),
      ),
    ]);
    const prepared = await prepare();
    if (prepared.result !== "prepared") throw new Error();
    const confirm = (budget?: { batch: number; batches: number }) =>
      confirmStoreTransfer(env, { id: prepared.id, actor: "admin" }, at(now), budget);
    const state = () =>
      env.DB.prepare(`SELECT
          (SELECT COUNT(*) FROM orders WHERE store_id = 's-a') AS orders,
          (SELECT COUNT(*) FROM orders WHERE store_id = 's-a2') AS others,
          (SELECT workspace_id FROM ebay_stores WHERE id = 's-a') AS workspace,
          (SELECT executed_at FROM store_transfers WHERE id = ?) AS executed`)
        .bind(prepared.id)
        .first();
    // Oltre il tetto il negozio resta dov'è e la preparazione resta confermabile.
    expect(await confirm({ batch: 200, batches: 1 })).toEqual({ result: "more" });
    expect(await state()).toEqual({ orders: 2, others: 1, workspace: "w-a", executed: null });
    expect(await confirm()).toMatchObject({ result: "done" });
    expect(await state()).toEqual({ orders: 0, others: 1, workspace: "w-b", executed: now });
    // Una conferma non più valida non elimina ordini.
    const stale = await prepare({ storeId: "s-a2" });
    if (stale.result !== "prepared") throw new Error();
    expect(await confirmStoreTransfer(env, { id: stale.id, actor: "altro" }, at(now))).toEqual({
      result: "expired",
    });
    expect(await state()).toMatchObject({ others: 1 });
  });

  it("esegue una sola fra conferme concorrenti e rifiuta uno stato cambiato o scaduto", async () => {
    await stores();
    const first = await prepare();
    const second = await prepare();
    if (first.result !== "prepared" || second.result !== "prepared") throw new Error();
    const results = await Promise.all([
      confirmStoreTransfer(env, { id: first.id, actor: "admin" }, at(now)),
      confirmStoreTransfer(env, { id: second.id, actor: "admin" }, at(later(1))),
    ]);
    expect(results.map(({ result }) => result).sort()).toEqual(["conflict", "done"]);
    expect(
      await env.DB.prepare(
        "SELECT COUNT(*) AS n FROM store_transfers WHERE executed_at IS NOT NULL",
      ).first(),
    ).toEqual({ n: 1 });

    const stale = await prepare({ storeId: "s-a2" });
    if (stale.result !== "prepared") throw new Error();
    expect(
      await confirmStoreTransfer(env, { id: stale.id, actor: "admin" }, at(later(31 * 60_000))),
    ).toEqual({ result: "expired" });
    // La preparazione scaduta esce con la pulizia; quella eseguita resta un anno.
    await purgeExpiredRecords(env.DB, at(later(hour)));
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM store_transfers").first()).toEqual({
      n: 1,
    });
  });
  it("due conferme concorrenti dello stesso trasferimento ne eseguono una", async () => {
    await stores();
    const prepared = await prepare();
    if (prepared.result !== "prepared") throw new Error();
    const results = await Promise.all([
      confirmStoreTransfer(env, { id: prepared.id, actor: "admin" }, at(now)),
      confirmStoreTransfer(env, { id: prepared.id, actor: "admin" }, at(later(1))),
    ]);
    expect(results.map(({ result }) => result).sort()).toEqual(["already", "done"]);
    expect(
      await env.DB.prepare("SELECT workspace_id FROM ebay_stores WHERE id = 's-a'").first(),
    ).toEqual({ workspace_id: "w-b" });
  });

  it("due conferme nello stesso istante: la seconda non ha alcun effetto", async () => {
    await stores();
    // Chi riceve ha usato la prova, chi cede no: un segno scritto dopo il passaggio la porterebbe.
    await env.DB.prepare("UPDATE workspaces SET trial_used_at = ? WHERE id = 'w-b'")
      .bind(now)
      .run();
    const prepared = await prepare();
    if (prepared.result !== "prepared") throw new Error();
    const results = await Promise.all([
      confirmStoreTransfer(env, { id: prepared.id, actor: "admin" }, at(now)),
      confirmStoreTransfer(env, { id: prepared.id, actor: "admin" }, at(now)),
    ]);
    expect(results.map(({ result }) => result).sort()).toEqual(["already", "done"]);
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM store_identity_marks").first()).toEqual({
      n: 0,
    });
    // Il negozio resta come l'ha lasciato la prima conferma, senza nuove scritture.
    expect(
      await env.DB.prepare(
        "SELECT workspace_id, disconnected_at FROM ebay_stores WHERE id = 's-a'",
      ).first(),
    ).toEqual({ workspace_id: "w-b", disconnected_at: now });
    expect(
      await env.DB.prepare(
        "SELECT executed_at, execution_id IS NOT NULL AS claimed FROM store_transfers",
      ).first(),
    ).toEqual({ executed_at: now, claimed: 1 });
  });

  it("rifiuta il trasferimento con una cancellazione dell'account in corso", async () => {
    const { owner, buyer } = await stores();
    const deletion = (userId: string) =>
      env.DB.prepare(`INSERT INTO account_deletions (id, user_id, workspace_id, requested_at)
        VALUES (?1, ?2, NULL, ?3)`).bind(crypto.randomUUID(), userId, now);
    // Preparato prima che l'acquirente chieda la cancellazione: la conferma si ferma.
    const prepared = await prepare();
    if (prepared.result !== "prepared") throw new Error();
    await deletion(buyer.userId).run();
    expect(await prepare()).toEqual({ result: "account_deletion" });
    expect(await confirmStoreTransfer(env, { id: prepared.id, actor: "admin" }, at(now))).toEqual({
      result: "account_deletion",
    });
    // Anche dal lato di chi cede il negozio.
    await env.DB.prepare("DELETE FROM account_deletions").run();
    await deletion(owner.userId).run();
    expect(await prepare()).toEqual({ result: "account_deletion" });
    expect(
      await env.DB.prepare("SELECT workspace_id FROM ebay_stores WHERE id = 's-a'").first(),
    ).toEqual({ workspace_id: "w-a" });
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM store_identity_marks").first()).toEqual({
      n: 0,
    });
  });

  it("il negozio porta i suoi limiti: prova e sblocchi dello spazio di partenza", async () => {
    const { owner, buyer } = await stores();
    const { cookie } = await admin();
    // Chi cede ha usato la prova e due sblocchi nel ciclo in corso; chi riceve ha un proprio
    // negozio, una prova in corso e uno sblocco nel suo ciclo.
    await env.DB.batch([
      insertEntitlement({
        source: "trial",
        startsAt: later(-20 * 24 * hour),
        endsAt: later(-6 * 24 * hour),
      }),
      env.DB.prepare(`INSERT INTO free_cycles (id, workspace_id, starts_at, ends_at, quota, used)
        VALUES ('c-a', 'w-a', ?1, ?2, 5, 2)`).bind(now, later(7 * 24 * hour)),
      insertStore({ id: "s-b", workspaceId: "w-b", ebayUserId: "e-b", linkedAt: later(hour) }),
      env.DB.prepare(`INSERT INTO sync_state (store_id, last_success_at, updated_at)
        VALUES ('s-b', ?1, ?1)`).bind(later(hour)),
      insertEntitlement({
        workspaceId: "w-b",
        source: "trial",
        startsAt: later(hour),
        endsAt: later(15 * 24 * hour),
      }),
      env.DB.prepare(`INSERT INTO free_cycles (id, workspace_id, starts_at, ends_at, quota, used)
        VALUES ('c-b', 'w-b', ?1, ?2, 5, 1)`).bind(later(hour), later(8 * 24 * hour)),
    ]);
    // Dalla console: preparazione e conferma.
    const prepared = (await act(cookie, {
      intent: "transfer-prepare",
      negozio: "s-a",
      destinazione: "w-b",
      motivo: "Cessione verificata",
    })) as { ok: boolean; transfer: { id: string } };
    expect(prepared).toMatchObject({ ok: true, transfer: { id: expect.any(String) } });
    expect(
      await act(cookie, { intent: "transfer-confirm", trasferimento: prepared.transfer.id }),
    ).toMatchObject({ ok: true });
    expect(
      await env.DB.prepare(
        "SELECT trial_used, cycle_used, cycle_quota FROM store_identity_marks",
      ).all(),
    ).toMatchObject({ results: [{ trial_used: 1, cycle_used: 2, cycle_quota: 5 }] });
    expect(await audit()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ operation: "transfer-received", outcome: "done" }),
      ]),
    );

    // L'acquirente ricollega il negozio con il proprio consenso: la prova in corso termina e i
    // due sblocchi del ciclo di partenza si aggiungono al suo.
    const linkedAt = at(later(2 * hour));
    const authorize = await beginLink(env, buyer.userId, linkedAt);
    const state = new URL(authorize).searchParams.get("state")!;
    const claimed = await claimStoreLinkSession(env.DB, state, linkedAt);
    if (claimed?.kind !== "new") throw new Error("missing_link");
    expect(
      await completeStoreLink({
        env,
        link: claimed,
        sessionUserId: buyer.userId,
        search: new URLSearchParams({ state, code: "sintetico" }),
        fetcher: syntheticEbay({ orders: [], userId: "s-a" }),
        now: linkedAt,
      }),
    ).toBe("collegato");
    const allowance = (await orderAllowance(env.DB, buyer.userId, linkedAt))!;
    expect(allowance).toMatchObject({
      premium: false,
      coverage: null,
      trialAvailable: false,
      cycle: { id: "c-b", used: 3 },
      remaining: 2,
    });
    expect((await listStores(env.DB, buyer.userId)).map((store) => store.id).sort()).toEqual([
      "s-a",
      "s-b",
    ]);

    // Il vecchio spazio non raggiunge più negozio e ordini dalle route Ordini ed export.
    expect(
      (
        await routeResponse(ordersLoader, "/app/ordini/o-a", {
          cookie: owner.cookie,
          params: { ordine: "o-a" },
        })
      ).status,
    ).toBe(404);
    const exported = await routeResponse(exportAction, "/api/v1/orders/export?ordini=o-a", {
      cookie: owner.cookie,
      headers: { accept: "text/csv, application/json" },
      fields: { language: "it" },
    });
    expect(exported.status).toBe(409);
    expect(await exported.json()).toMatchObject({ ok: false });
  });
});

describe("revisione antiabuso", () => {
  it("segnala la stessa attività su spazi diversi e registra l'esito", async () => {
    expect(normalizedName("Rossi S.r.l.")).toBe(normalizedName("ROSSI srl"));
    const users = await Promise.all(
      ["abuso.a@example.invalid", "abuso.b@example.invalid", "abuso.c@example.invalid"].map(
        verifiedSession,
      ),
    );
    await env.DB.batch([
      ...users.flatMap(({ userId }, index) => insertWorkspace({ id: `w-${index}`, userId })),
      env.DB.prepare(`UPDATE user_profiles SET account_type = 'business', company_name = ?
        WHERE user_id = ?`).bind("Rossi S.r.l.", users[0]!.userId),
      env.DB.prepare(`UPDATE user_profiles SET account_type = 'business', company_name = ?
        WHERE user_id = ?`).bind("ROSSI srl", users[1]!.userId),
      insertStore({ id: "s-1", workspaceId: "w-1" }),
    ]);
    const [signal] = await listAbuseSignals(env.DB, at(now));
    expect(signal).toMatchObject({
      kind: "company",
      review: null,
      workspaces: [{ id: "w-0" }, { id: "w-1" }],
    });
    // La chiave non contiene il valore condiviso.
    expect(signal!.key).not.toMatch(/rossi/iu);
    const review = (input: Partial<Parameters<typeof reviewAbuseSignal>[1]>) =>
      reviewAbuseSignal(
        env.DB,
        {
          key: signal!.key,
          outcome: "suspended",
          actor: "admin",
          reason: "Stessa attività",
          ...input,
        },
        at(now),
      );
    expect(await review({ workspaceId: "w-2" })).toBe("invalid");
    expect(await review({ key: "company:altro" })).toBe("not_found");
    // Uno spazio con una copertura pagata o concessa non perde nulla: il beneficio è del Free.
    await insertEntitlement({
      workspaceId: "w-0",
      source: "admin",
      endsAt: later(48 * hour),
      grantedBy: "a",
      grantReason: "b",
    }).run();
    expect(await review({ workspaceId: "w-0" })).toBe("covered");
    expect(await review({ workspaceId: "w-1" })).toBe("done");
    expect(
      await env.DB.prepare("SELECT reason FROM ebay_store_pauses WHERE store_id = 's-1'").first(),
    ).toEqual({ reason: "admin" });
    expect((await listAbuseSignals(env.DB, at(now)))[0]!.review).toMatchObject({
      outcome: "suspended",
      workspaceId: "w-1",
    });
    // Un nuovo spazio nello stesso gruppo è una nuova segnalazione da rivedere.
    await env.DB.prepare(`UPDATE user_profiles SET account_type = 'business', company_name = ?
      WHERE user_id = ?`)
      .bind("Rossi Srl", users[2]!.userId)
      .run();
    const [renewed] = await listAbuseSignals(env.DB, at(now));
    expect(renewed).toMatchObject({ review: null });
    expect(renewed!.key).not.toBe(signal!.key);
    // La revisione non impedisce di eliminare lo spazio sospeso.
    await env.DB.prepare("DELETE FROM workspaces WHERE id = 'w-1'").run();
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM abuse_reviews").first()).toEqual({
      n: 0,
    });
  });
  it("la sospensione vale per lo spazio finché resta l'esito e colpisce soltanto il Free", async () => {
    const users = await Promise.all(
      ["sosp.a@example.invalid", "sosp.b@example.invalid", "sosp.c@example.invalid"].map(
        verifiedSession,
      ),
    );
    const seller = users[1]!;
    await env.DB.batch([
      ...users.flatMap(({ userId }, index) => insertWorkspace({ id: `w-${index}`, userId })),
      ...[0, 1].map((index) =>
        env.DB.prepare(`UPDATE user_profiles SET account_type = 'business', company_name = ?
          WHERE user_id = ?`).bind("Bianchi S.r.l.", users[index]!.userId),
      ),
      insertStore({ id: "s-1", workspaceId: "w-1" }),
      env.DB.prepare(`INSERT INTO sync_state (store_id, last_success_at, updated_at)
        VALUES ('s-1', ?1, ?1)`).bind(now),
    ]);
    const [signal] = await listAbuseSignals(env.DB, at(now));
    const review = (outcome: "clear" | "suspended", key = signal!.key) =>
      reviewAbuseSignal(
        env.DB,
        { key, outcome, workspaceId: "w-1", actor: "admin", reason: "Stessa attività" },
        at(now),
      );
    const pauses = async () =>
      (
        await env.DB.prepare(
          `SELECT store_id, reason, abuse_review FROM ebay_store_pauses
            WHERE reason = 'admin' ORDER BY store_id`,
        ).all()
      ).results;
    const sellerView = async () =>
      (
        (await callRoute(loadStores, "/app/negozi", {
          cookie: seller.cookie,
          params: {},
        })) as unknown as { data: { page: { stores: { id: string; pauseReason?: string }[] } } }
      ).data.page.stores;
    expect((await orderAllowance(env.DB, seller.userId, at(now)))!.trialAvailable).toBe(true);
    expect(await review("suspended")).toBe("done");
    expect(await pauses()).toEqual([{ store_id: "s-1", reason: "admin", abuse_review: 1 }]);
    // Il venditore la vede come oggi, la pausa dell'assistenza, e non riceve la prova.
    expect(await sellerView()).toEqual([expect.objectContaining({ pauseReason: "admin" })]);
    expect((await orderAllowance(env.DB, seller.userId, at(now)))!.trialAvailable).toBe(false);
    expect(await requestStoreSync(env, seller.userId, "s-1", {}, at(now))).toBe("invalid");

    // Eliminati i dati del negozio in pausa, un nuovo negozio collegato o scelto come attivo
    // resta sospeso.
    await env.DB.batch([
      env.DB.prepare("UPDATE ebay_stores SET data_deleted_at = ? WHERE id = 's-1'").bind(now),
      insertStore({ id: "s-2", workspaceId: "w-1", ebayUserId: "e-2", linkedAt: later(hour) }),
    ]);
    await applyWorkspacePlan(env.DB, "w-1", at(later(hour)));
    expect(await pauses()).toEqual([{ store_id: "s-2", reason: "admin", abuse_review: 1 }]);
    expect(await chooseFreeStore(env.DB, seller.userId, "s-2", at(later(hour)))).toMatchObject({
      result: "done",
    });
    expect(await pauses()).toEqual([{ store_id: "s-2", reason: "admin", abuse_review: 1 }]);
    // La pausa manuale della console resta distinta: toglierla non tocca la sospensione,
    // metterla la rende manuale.
    expect(await setAdminPause(env.DB, "s-2", false, at(now))).toBe("invalid");
    expect(await pauses()).toEqual([{ store_id: "s-2", reason: "admin", abuse_review: 1 }]);

    // Con il Premium pagato le letture riprendono; finito, la sospensione torna.
    await insertEntitlement({
      workspaceId: "w-1",
      source: "premium",
      startsAt: later(hour),
      endsAt: later(10 * 24 * hour),
    }).run();
    await applyWorkspacePlan(env.DB, "w-1", at(later(2 * hour)));
    expect(await pauses()).toEqual([]);
    vi.setSystemTime(at(later(2 * hour)));
    expect(await sellerView()).toEqual([
      expect.objectContaining({ id: "s-2", pauseReason: undefined }),
    ]);
    vi.setSystemTime(at(now));
    await applyWorkspacePlan(env.DB, "w-1", at(later(11 * 24 * hour)));
    expect(await pauses()).toEqual([{ store_id: "s-2", reason: "admin", abuse_review: 1 }]);

    // Un nuovo spazio nel gruppo rende vecchia la segnalazione: la sospensione resta elencata.
    await env.DB.prepare(`UPDATE user_profiles SET account_type = 'business', company_name = ?
      WHERE user_id = ?`)
      .bind("Bianchi Srl", users[2]!.userId)
      .run();
    const listed = await listAbuseSignals(env.DB, at(now));
    expect(listed.find((item) => item.key === signal!.key)).toMatchObject({
      current: false,
      review: { outcome: "suspended", workspaceId: "w-1" },
      workspaces: [{ id: "w-1" }],
    });
    // La console mette la propria pausa: resta anche dopo l'esito «nessun abuso».
    expect(await setAdminPause(env.DB, "s-2", true, at(now))).toBe("done");
    expect(await review("clear")).toBe("done");
    expect(await pauses()).toEqual([{ store_id: "s-2", reason: "admin", abuse_review: 0 }]);
    expect((await listStores(env.DB, seller.userId))[0]!.pauseReasons).toEqual(["admin"]);
    expect(await setAdminPause(env.DB, "s-2", false, at(now))).toBe("done");
    expect(await pauses()).toEqual([]);
    await applyWorkspacePlan(env.DB, "w-1", at(later(12 * 24 * hour)));
    expect(await pauses()).toEqual([]);
    // Tolta la sospensione, la vecchia segnalazione non resta più elencata.
    expect((await listAbuseSignals(env.DB, at(now))).map((item) => item.key)).not.toContain(
      signal!.key,
    );
  });
});
