import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { orderAllowance, startTrial, trialDays } from "../app/domain/grants.server";
import { listVisibleOrders } from "../app/domain/orders.server";
import { action as unlockAction, loader as loadHome } from "../app/routes/orders";
import { action as securityAction, loader as loadSettings } from "../app/routes/settings";
import {
  insertEntitlement,
  insertStore,
  insertTaxIdentifiers,
  now,
  resetDatabase,
  seed,
} from "./fixtures/database-fixtures";
import { verifiedSession } from "./fixtures/account-fixtures";
import { appCopy } from "../app/app-copy";
import { callRoute, routePage } from "./fixtures/route-fixtures";

beforeEach(resetDatabase);
afterEach(() => vi.useRealTimers());

describe("prova Premium", () => {
  const day = 24 * 60 * 60 * 1000;
  const at = (offset: number) => new Date(Date.parse(now) + offset);
  /** Prima lettura riuscita di un negozio dello spazio, anche senza ordini. */
  const synced = (store = "s-a") =>
    env.DB.prepare(
      "INSERT INTO sync_state (store_id, last_success_at, updated_at) VALUES (?1, ?2, ?2)",
    )
      .bind(store, now)
      .run();
  const entitlements = async (workspace = "w-a") =>
    (
      await env.DB.prepare(
        "SELECT source, starts_at, ends_at FROM workspace_entitlements WHERE workspace_id = ?",
      )
        .bind(workspace)
        .all()
    ).results;

  it("si attiva solo dopo la prima lettura riuscita, dura 14 giorni e non si ripete", async () => {
    await seed();
    expect(await orderAllowance(env.DB, "u-a")).toMatchObject({ trialAvailable: false });
    expect(await startTrial(env.DB, "u-a")).toBeNull();
    expect(await entitlements()).toEqual([]);
    await synced();
    // Il negozio letto non ha ancora ordini da mostrare: la prova è comunque disponibile.
    await env.DB.prepare("DELETE FROM orders WHERE store_id = 's-a'").run();
    expect(await orderAllowance(env.DB, "u-a")).toMatchObject({
      premium: false,
      coverage: null,
      trialAvailable: true,
    });
    const ends = at(trialDays * day).toISOString();
    expect(await startTrial(env.DB, "u-a")).toBe(ends);
    expect(await entitlements()).toEqual([{ source: "trial", starts_at: now, ends_at: ends }]);
    // Nessun abbonamento, pagamento o sblocco nasce dalla sola prova.
    expect(await env.DB.prepare("SELECT count(*) AS n FROM order_grants").first()).toEqual({
      n: 0,
    });
    expect(await orderAllowance(env.DB, "u-a")).toMatchObject({
      premium: true,
      coverage: { source: "trial", endsAt: ends },
      trialAvailable: false,
      remaining: null,
    });
    expect(await startTrial(env.DB, "u-a", at(day))).toBeNull();
    // Lo scollegamento non ferma né sposta la prova.
    await env.DB.prepare("DELETE FROM ebay_stores WHERE id = 's-a'").run();
    expect((await orderAllowance(env.DB, "u-a", at(trialDays * day - 1)))?.coverage).toEqual({
      source: "trial",
      endsAt: ends,
    });
    // Alla scadenza torna il Free, e la prova resta usata anche se revocata.
    expect(await orderAllowance(env.DB, "u-a", at(trialDays * day))).toMatchObject({
      premium: false,
      coverage: null,
      trialAvailable: false,
    });
    await env.DB.prepare("UPDATE workspace_entitlements SET revoked_at = ?").bind(now).run();
    await insertStore({ id: "s-c", ebayUserId: "e-c" }).run();
    await synced("s-c");
    expect(await startTrial(env.DB, "u-a", at(20 * day))).toBeNull();
    await expect(
      env.DB.prepare(`INSERT INTO workspace_entitlements (id, workspace_id, source, starts_at, ends_at)
        VALUES ('seconda', 'w-a', 'trial', ?1, ?2)`)
        .bind(at(20 * day).toISOString(), at(34 * day).toISOString())
        .run(),
    ).rejects.toThrow("UNIQUE");
  });

  it("richieste concorrenti attivano una sola prova per spazio", async () => {
    await seed();
    await synced();
    const started = await Promise.all(Array.from({ length: 6 }, () => startTrial(env.DB, "u-a")));
    expect(started.filter(Boolean)).toHaveLength(1);
    expect(await entitlements()).toHaveLength(1);
    // Lo spazio di un altro utente non riceve né consuma nulla.
    expect(await entitlements("w-b")).toEqual([]);
    expect(await startTrial(env.DB, "u-sconosciuto")).toBeNull();
  });

  it("non si offre con un'altra copertura in corso, e dopo la sua fine sì", async () => {
    await seed();
    await synced();
    await env.DB.batch([
      insertEntitlement({ id: "pagato", source: "premium", endsAt: at(3 * day).toISOString() }),
      insertEntitlement({ id: "omaggio", source: "admin", endsAt: at(2 * day).toISOString() }),
    ]);
    // Fra più coperture conta quella diversa dalla prova che dura di più.
    expect((await orderAllowance(env.DB, "u-a"))?.coverage).toEqual({
      source: "premium",
      endsAt: at(3 * day).toISOString(),
    });
    expect((await orderAllowance(env.DB, "u-a"))?.trialAvailable).toBe(false);
    expect(await startTrial(env.DB, "u-a")).toBeNull();
    expect(await startTrial(env.DB, "u-a", at(3 * day))).toBe(
      at((3 + trialDays) * day).toISOString(),
    );
  });

  it("dopo la prova restano i dati arrivati durante la prova, anche mai aperti, non quelli tardivi", async () => {
    await seed();
    await synced();
    const ends = (await startTrial(env.DB, "u-a"))!;
    const during = at(day);
    // Un ordine arrivato durante la prova è subito leggibile, senza sblocco né quota.
    await env.DB.prepare(`INSERT INTO orders (id, store_id, ebay_order_id, creation_time, last_modified_time, currency, total_minor)
      VALUES ('durante', 's-a', 'durante', ?1, ?1, 'EUR', 100), ('tardivo', 's-a', 'tardivo', ?1, ?1, 'EUR', 100)`)
      .bind(during.toISOString())
      .run();
    await insertTaxIdentifiers({
      id: "durante-cf",
      orderId: "durante",
      type: "CODICE_FISCALE",
      value: "RSSMRA80A01H501U",
      observedAt: during.toISOString(),
    }).run();
    await insertTaxIdentifiers({
      id: "tardivo-cf",
      orderId: "tardivo",
      type: "CODICE_FISCALE",
      value: "BNCLGU80A01H501Z",
      observedAt: ends,
    }).run();
    const after = at(trialDays * day + 1);
    const visible = await listVisibleOrders(env.DB, "u-a", 50, "production", after);
    const state = (id: string) => visible.find((order) => order.id === id)?.fiscalState;
    expect([state("o-a"), state("durante"), state("tardivo")]).toEqual([
      "available",
      "available",
      "locked",
    ]);
    expect(await env.DB.prepare("SELECT used FROM free_cycles WHERE id = 'c-a'").first()).toEqual({
      used: 0,
    });
  });

  describe("nelle pagine reali", () => {
    async function owner() {
      await seed();
      const session = await verifiedSession("prova-premium@example.invalid");
      await env.DB.prepare("UPDATE workspace_members SET user_id = ? WHERE workspace_id = 'w-a'")
        .bind(session.userId)
        .run();
      return session;
    }
    const startTrial = <A extends { request: Request }, R>(
      handler: (args: A) => R,
      path: string,
      cookie: string,
      origin?: string,
    ) => callRoute(handler, path, { cookie, origin, fields: { intent: "start-trial" } });
    const planPage = async (cookie: string) =>
      (
        await routePage(loadSettings, "/app/impostazioni/piano", {
          cookie,
          params: { sezione: "piano" },
        })
      ).page;
    const ordersPage = async (cookie: string) =>
      (await routePage(loadHome, "/app/ordini", { cookie })).page;

    it("Ordini e Piano propongono la prova dopo la prima lettura e poi ne mostrano la fine", async () => {
      const { cookie } = await owner();
      expect((await ordersPage(cookie)).account).toMatchObject({
        plan: "free",
        trialAvailable: false,
      });
      expect(await startTrial(securityAction, "/app/impostazioni/piano", cookie)).toMatchObject({
        init: { status: 409 },
        data: { ok: false },
      });
      await synced();
      expect((await ordersPage(cookie)).account).toMatchObject({ trialAvailable: true });
      expect((await planPage(cookie)).account).toMatchObject({
        plan: "free",
        trialAvailable: true,
      });
      // Una richiesta da un'altra origine non attiva nulla.
      await expect(
        startTrial(unlockAction, "/app/ordini", cookie, "https://estraneo.invalid"),
      ).rejects.toMatchObject({ status: 403 });
      expect(await startTrial(unlockAction, "/app/ordini", cookie)).toEqual({
        ok: true,
        notice: appCopy.it.settings.plan.trialStarted,
      });
      const ends = at(trialDays * day).toISOString();
      const orders = await ordersPage(cookie);
      expect(orders.account).toEqual({
        plan: "premium",
        trialAvailable: false,
        trial: { endsAt: ends },
      });
      // Con la prova il Codice Fiscale è leggibile senza sblocco.
      expect(orders.orders[0]?.fiscal.state).toBe("available");
      expect((await planPage(cookie)).account).toMatchObject({
        plan: "premium",
        trialAvailable: false,
        trial: { endsAt: ends },
        quota: undefined,
      });
      // Dalla seconda scheda la prova già attiva non riparte.
      expect(await startTrial(securityAction, "/app/impostazioni/piano", cookie)).toMatchObject({
        init: { status: 409 },
        data: { ok: false, notice: appCopy.it.settings.plan.trialUnavailable },
      });
      expect(await entitlements()).toHaveLength(1);
    });
  });
});
