import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { localInstant } from "../app/admin-console.server";
import {
  listAbuseSignals,
  normalizedName,
  reviewAbuseSignal,
} from "../app/domain/abuse-review.server";
import { listAudit } from "../app/domain/admin-audit.server";
import { consoleSummary } from "../app/domain/admin-directory.server";
import { listAnomalies, taskStates } from "../app/domain/admin-operations.server";
import {
  endPromotion,
  lifetimeSeats,
  savePromotion,
  scheduleFreeQuota,
} from "../app/domain/admin-commerce.server";
import {
  grantHistoryExtension,
  grantLifetimeConcession,
  revokeHistoryExtension,
} from "../app/domain/concessions.server";
import { quotaAnomalies, readEbayQuotas } from "../app/domain/ebay-quotas.server";
import { assistFreeStore, chooseFreeStore } from "../app/domain/free-store.server";
import { freeQuotaSettings, orderAllowance } from "../app/domain/grants.server";
import { purgeExpiredRecords } from "../app/domain/maintenance.server";
import { subscriptionView } from "../app/domain/plan-view.server";
import { listNotifications } from "../app/domain/notifications.server";
import { requestStoreSync } from "../app/domain/order-sync.server";
import { requeueTask } from "../app/domain/scheduled-work.server";
import { saveServiceNotice, withdrawServiceNotice } from "../app/domain/service-notices.server";
import { confirmStoreTransfer, prepareStoreTransfer } from "../app/domain/store-transfer.server";
import { listStores, resumeStore, setAdminPause } from "../app/domain/stores.server";
import { action as adminAction, loader as adminLoader } from "../app/routes/admin";
import { loader as loadStores } from "../app/routes/stores";
import { verifiedSession } from "./fixtures/account-fixtures";
import {
  insertCredentials,
  insertEntitlement,
  insertStore,
  insertWorkspace,
  now,
  resetDatabase,
} from "./fixtures/database-fixtures";
import { fakeQueue, queued } from "./fixtures/queue-fixture";
import { callRoute, routeData } from "./fixtures/route-fixtures";

beforeEach(resetDatabase);
afterEach(() => vi.restoreAllMocks());

const at = (iso: string) => new Date(iso);
const hour = 3_600_000;
const later = (ms: number, from = now) => new Date(Date.parse(from) + ms).toISOString();

/** Admin con la sessione confermata da una passkey verificata. */
async function admin(email = "admin.console@example.invalid") {
  const session = await verifiedSession(email);
  await env.DB.batch([
    env.DB.prepare('UPDATE "user" SET "admin" = 1 WHERE id = ?').bind(session.userId),
    env.DB.prepare('UPDATE "session" SET "passkeyVerified" = 1 WHERE "userId" = ?').bind(
      session.userId,
    ),
  ]);
  return session;
}

async function audit() {
  return (
    await env.DB.prepare(
      "SELECT operation, target, reason, outcome FROM admin_audit ORDER BY at, rowid",
    ).all()
  ).results;
}

/** Stato della route admin: 404 per chi non ha accesso, altrimenti livello e sezione. */
async function page(cookie: string, path = "/admin", params: Record<string, string> = {}) {
  try {
    const result = await routeData(adminLoader, path, { cookie, params });
    return { access: result.access, section: result.page?.section ?? null };
  } catch (error) {
    return (error as { init?: { status?: number } }).init?.status;
  }
}

async function act(cookie: string, fields: Record<string, string>, origin?: string | null) {
  const result = await callRoute(adminAction, "/admin", { cookie, fields, origin });
  const wrapped = result as unknown as { data?: unknown; init?: { status?: number } };
  return "init" in wrapped && wrapped.init
    ? { status: wrapped.init.status, ...(wrapped.data as object) }
    : (result as object);
}

describe("accesso alla console", () => {
  it("nasconde la console a chi non è admin e non legge sezioni senza passkey", async () => {
    const merchant = await verifiedSession("venditore.console@example.invalid");
    expect(await page(merchant.cookie)).toBe(404);
    expect(await page(merchant.cookie, "/admin/quote", { sezione: "quote" })).toBe(404);

    await env.DB.prepare('UPDATE "user" SET "admin" = 1 WHERE id = ?').bind(merchant.userId).run();
    expect(await page(merchant.cookie)).toEqual({ access: "verify", section: null });
    // Senza conferma nessuna operazione passa, neppure con un modulo valido.
    await expect(
      callRoute(adminAction, "/admin", {
        cookie: merchant.cookie,
        fields: { intent: "requeue-task", lavoro: "billing" },
      }),
    ).rejects.toMatchObject({ init: { status: 404 } });

    const granted = await admin();
    expect(await page(granted.cookie)).toEqual({ access: "granted", section: "panoramica" });
    expect(await page(granted.cookie, "/admin/registro", { sezione: "registro" })).toEqual({
      access: "granted",
      section: "registro",
    });
    // Sezioni sconosciute e elementi fuori dalla scheda di uno spazio non esistono.
    expect(await page(granted.cookie, "/admin/sql", { sezione: "sql" })).toBe(404);
    expect(await page(granted.cookie, "/admin/quote/x", { sezione: "quote", voce: "x" })).toBe(404);
    expect(await page(granted.cookie, "/admin/spazi", { sezione: "spazi" })).toBe(404);
    expect(
      await page(granted.cookie, "/admin/spazi/inesistente", {
        sezione: "spazi",
        voce: "inesistente",
      }),
    ).toBe(404);

    // La perdita del ruolo vale subito, anche a metà sessione.
    await env.DB.prepare('UPDATE "user" SET "admin" = 0 WHERE id = ?').bind(granted.userId).run();
    expect(await page(granted.cookie)).toBe(404);
  });

  it("rifiuta un'operazione da un'altra origine e chiede il motivo dove serve", async () => {
    const { cookie } = await admin();
    await env.DB.batch(insertWorkspace({ id: "w-a" }));
    await expect(
      callRoute(adminAction, "/admin", {
        cookie,
        fields: { intent: "grant-premium", spazio: "w-a", giorni: "3", motivo: "x" },
        origin: "https://altro.invalid",
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(
      await act(cookie, { intent: "grant-premium", spazio: "w-a", giorni: "3" }),
    ).toMatchObject({
      status: 400,
    });
    expect(await act(cookie, { intent: "comando-libero" })).toMatchObject({ status: 400 });
    expect(await audit()).toEqual([]);

    expect(
      await act(cookie, {
        intent: "grant-premium",
        spazio: "w-a",
        giorni: "3",
        motivo: "Disservizio",
      }),
    ).toMatchObject({ ok: true });
    expect(
      await act(cookie, { intent: "grant-lifetime", spazio: "w-inesistente", motivo: "Prova" }),
    ).toMatchObject({ ok: false });
    // Esiti riusciti e rifiutati restano nel registro con oggetto e motivo.
    expect(await audit()).toEqual([
      {
        operation: "grant-premium",
        target: "workspace:w-a",
        reason: "Disservizio",
        outcome: "done",
      },
      {
        operation: "grant-lifetime",
        target: "workspace:w-inesistente",
        reason: "Prova",
        outcome: "not_found",
      },
    ]);
    // Il registro non si riscrive.
    await expect(env.DB.prepare("UPDATE admin_audit SET outcome = 'x'").run()).rejects.toThrow(
      "immutable_audit",
    );
  });

  it("legge ogni sezione senza chiamare eBay o Stripe per conto dei negozi", async () => {
    const { cookie, userId } = await admin();
    await env.DB.batch([...insertWorkspace({ id: "w-a", userId }), insertStore({ id: "s-a" })]);
    const requests: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = new URL(String(input instanceof Request ? input.url : input));
      requests.push(url.host + url.pathname);
      return new Response("", { status: 503 });
    });
    const sections = ["account", "negozi", "lavori", "quote", "commerciale", "antiabuso"];
    for (const sezione of [...sections, "comunicazioni", "registro"])
      expect(await page(cookie, `/admin/${sezione}`, { sezione })).toEqual({
        access: "granted",
        section: sezione,
      });
    expect(await page(cookie, "/admin/spazi/w-a", { sezione: "spazi", voce: "w-a" })).toMatchObject(
      { section: "spazi" },
    );
    const quotas = await routeData(adminLoader, "/admin/quote", {
      cookie,
      params: { sezione: "quote" },
    });
    // eBay non risponde: la quota resta non letta, non piena né vuota.
    expect(quotas.page).toMatchObject({ quotas: [{ read: "failed", rows: [] }] });
    expect(
      requests.every(
        (request) =>
          request.endsWith("/oauth2/token") || request.startsWith("api.stripe.com/v1/prices"),
      ),
    ).toBe(true);
  });

  it("mostra al venditore la pausa dell'assistenza senza il pulsante per toglierla", async () => {
    const seller = await verifiedSession("venditore.pausa@example.invalid");
    await env.DB.batch([
      ...insertWorkspace({ id: "w-a", userId: seller.userId }),
      insertStore({ id: "s-a" }),
      insertCredentials({ accessExpiresAt: later(48 * hour) }),
    ]);
    await setAdminPause(env.DB, "s-a", true, at(now));
    const result = (await callRoute(loadStores, "/app/negozi", {
      cookie: seller.cookie,
      params: {},
    })) as unknown as { data: { page: { stores: { pauseReason?: string }[] } } };
    expect(result.data.page.stores[0]).toMatchObject({ pauseReason: "admin" });
  });

  it("conserva il registro un anno dall'operazione", async () => {
    const entry = (id: string, time: string) =>
      env.DB.prepare(`INSERT INTO admin_audit (id, actor, operation, outcome, at)
        VALUES (?, 'admin', 'grant-premium', 'done', ?)`).bind(id, time);
    await env.DB.batch([
      entry("vecchia", later(-366 * 24 * hour)),
      entry("recente", later(-364 * 24 * hour)),
    ]);
    await purgeExpiredRecords(env.DB, at(now));
    expect((await env.DB.prepare("SELECT id FROM admin_audit").all()).results).toEqual([
      { id: "recente" },
    ]);
  });

  it("converte l'ora del modulo dal fuso della console", () => {
    expect(localInstant("2026-10-27T10:00")).toBe("2026-10-27T09:00:00.000Z");
    expect(localInstant("2026-07-01T10:00")).toBe("2026-07-01T08:00:00.000Z");
    expect(localInstant("27/10/2026")).toBeNull();
  });
});

describe("configurazioni commerciali", () => {
  const cycleStart = "2026-09-13T20:00:00.000Z";

  async function freeWorkspace(userId: string) {
    await env.DB.batch([
      ...insertWorkspace({ id: "w-free", userId }),
      env.DB.prepare("UPDATE workspaces SET free_cycle_anchor_at = ? WHERE id = 'w-free'").bind(
        cycleStart,
      ),
    ]);
  }

  it("applica la nuova quota base soltanto ai cicli che iniziano dopo", async () => {
    const { userId } = await verifiedSession("quota.base@example.invalid");
    await freeWorkspace(userId);
    const input = { actor: "admin", reason: "Lancio" };
    expect(
      await scheduleFreeQuota(env.DB, { ...input, quota: 8, effectiveAt: later(-hour) }, at(now)),
    ).toBe("invalid");
    expect(
      await scheduleFreeQuota(env.DB, { ...input, quota: 8, effectiveAt: later(hour) }, at(now)),
    ).toBe("done");
    expect(await freeQuotaSettings(env.DB, at(now))).toEqual({
      quota: 5,
      next: { quota: 8, effectiveAt: later(hour) },
    });
    // Il ciclo in corso, anche creato dopo la modifica, conserva la quota del suo inizio.
    const current = await orderAllowance(env.DB, userId, at(later(2 * hour)));
    expect(current?.cycle).toMatchObject({ quota: 5, next_quota: 8 });
    const next = await orderAllowance(env.DB, userId, at(later(7 * 24 * hour + hour)));
    expect(next?.cycle).toMatchObject({ quota: 8 });
    // Una modifica non si cancella né si riscrive: ne serve una nuova.
    await expect(env.DB.prepare("UPDATE free_quota_changes SET quota = 9").run()).rejects.toThrow(
      "immutable_quota_change",
    );
  });

  it("gestisce le promozioni senza toccare i cicli iniziati", async () => {
    const promotion = (startsAt: string, endsAt: string, quota = 10) => ({
      startsAt,
      endsAt,
      quota,
    });
    expect(
      await savePromotion(env.DB, { promotion: promotion(later(-hour), later(hour)) }, at(now)),
    ).toBe("invalid");
    expect(
      await savePromotion(env.DB, { promotion: promotion(later(hour), later(48 * hour)) }, at(now)),
    ).toBe("done");
    expect(
      await savePromotion(
        env.DB,
        { promotion: promotion(later(24 * hour), later(72 * hour)) },
        at(now),
      ),
    ).toBe("overlap");
    const { id } = (await env.DB.prepare("SELECT id FROM free_promotions").first<{
      id: string;
    }>())!;
    // Iniziata: si cambiano quota e fine, non l'inizio.
    const running = at(later(2 * hour));
    expect(
      await savePromotion(
        env.DB,
        { id, promotion: promotion(later(90 * 60_000), later(48 * hour), 12) },
        running,
      ),
    ).toBe("started");
    expect(
      await savePromotion(
        env.DB,
        { id, promotion: promotion(later(hour), later(24 * hour), 12) },
        running,
      ),
    ).toBe("done");
    expect(
      await env.DB.prepare(
        "SELECT previous_quota, previous_ends_at FROM free_promotion_changes",
      ).all(),
    ).toMatchObject({ results: [{ previous_quota: 10, previous_ends_at: later(48 * hour) }] });
    // La fine anticipata chiude adesso quella in corso; una futura si annulla.
    const ending = at(later(3 * hour));
    expect(await endPromotion(env.DB, id, ending)).toBe("done");
    expect(
      await env.DB.prepare("SELECT ends_at FROM free_promotions WHERE id = ?").bind(id).first(),
    ).toEqual({ ends_at: ending.toISOString() });
    expect(
      await savePromotion(
        env.DB,
        { promotion: promotion(later(96 * hour), later(120 * hour)) },
        running,
      ),
    ).toBe("done");
    const future = await env.DB.prepare("SELECT id FROM free_promotions WHERE id <> ?")
      .bind(id)
      .first<{ id: string }>();
    expect(await endPromotion(env.DB, future!.id, ending)).toBe("done");
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM free_promotions").first()).toEqual({
      n: 1,
    });
    expect(await endPromotion(env.DB, id, ending)).toBe("not_found");
  });

  it("conta i posti lifetime e riconcede il lifetime rimborsato sullo stesso posto", async () => {
    await env.DB.batch([
      ...insertWorkspace({ id: "w-a" }),
      ...insertWorkspace({ id: "w-b" }),
      env.DB.prepare(`INSERT INTO lifetime_allocations (slot, workspace_id, status, kind,
          provider_reference, activated_at, created_at)
        VALUES (1, 'w-a', 'active', 'sale', 'cs_paid', ?1, ?1)`).bind(now),
      env.DB.prepare(`INSERT INTO workspace_entitlements (id, workspace_id, source, starts_at,
          stripe_checkout_session_id, amount_paid, currency, paid_at, revoked_at, revocation,
          amount_refunded)
        VALUES ('paid', 'w-a', 'lifetime', ?1, 'cs_paid', 14900, 'eur', ?1, ?1, 'refund', 14900)`).bind(
        now,
      ),
    ]);
    expect(await lifetimeSeats(env.DB)).toMatchObject({
      sold: 1,
      refunded: 1,
      regranted: 0,
      available: 19,
    });
    const grant = (workspaceId: string) =>
      grantLifetimeConcession(
        env,
        { workspaceId, author: "admin", reason: "Riconcessione" },
        at(now),
      );
    expect(await grant("w-a")).toBe("done");
    expect(await grant("w-a")).toBe("owned");
    expect(await grant("w-b")).toBe("done");
    expect(await lifetimeSeats(env.DB)).toEqual({
      total: 20,
      sold: 1,
      gifted: 1,
      reserved: 0,
      refunded: 1,
      regranted: 1,
      available: 18,
    });
    expect(
      (
        await env.DB.prepare(`SELECT granted_by, grant_reason, revoked_at FROM workspace_entitlements
          WHERE workspace_id = 'w-a' AND id <> 'paid'`).all()
      ).results,
    ).toEqual([{ granted_by: "admin", grant_reason: "Riconcessione", revoked_at: null }]);
    // Il piano lo mostra concesso, non acquistato, anche sul posto della vendita.
    expect(
      await subscriptionView(env.DB, env, "w-a", { source: "lifetime", endsAt: null }, at(now)),
    ).toEqual({ premium: { period: "lifetime", renewsAt: null, granted: true } });
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
    expect(await setAdminPause(env.DB, "s-a", true, at(now))).toBe("invalid");
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
    expect(
      await confirmStoreTransfer(env.DB, { id: prepared.id, actor: "altro" }, at(now)),
    ).toEqual({
      result: "expired",
    });
    expect(
      await confirmStoreTransfer(env.DB, { id: prepared.id, actor: "admin" }, at(now)),
    ).toEqual({
      result: "done",
      transfer: { storeId: "s-a", from: "w-a", to: "w-b" },
    });
    // Ripetuta, la conferma non esegue nulla di nuovo.
    expect(
      await confirmStoreTransfer(env.DB, { id: prepared.id, actor: "admin" }, at(later(1000))),
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

  it("esegue una sola fra conferme concorrenti e rifiuta uno stato cambiato o scaduto", async () => {
    await stores();
    const first = await prepare();
    const second = await prepare();
    if (first.result !== "prepared" || second.result !== "prepared") throw new Error();
    const results = await Promise.all([
      confirmStoreTransfer(env.DB, { id: first.id, actor: "admin" }, at(now)),
      confirmStoreTransfer(env.DB, { id: second.id, actor: "admin" }, at(later(1))),
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
      await confirmStoreTransfer(env.DB, { id: stale.id, actor: "admin" }, at(later(31 * 60_000))),
    ).toEqual({ result: "expired" });
    // La preparazione scaduta esce con la pulizia; quella eseguita resta un anno.
    await purgeExpiredRecords(env.DB, at(later(hour)));
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM store_transfers").first()).toEqual({
      n: 1,
    });
  });
});

describe("comunicazioni di servizio", () => {
  const notice = (startsAt: string, endsAt: string) => ({
    tone: "warning" as const,
    titleIt: "Manutenzione",
    bodyIt: "Le letture si fermano per un'ora.",
    titleEn: "Maintenance",
    bodyEn: "Reads pause for one hour.",
    startsAt,
    endsAt,
  });

  it("compare nella campanella nella lingua dell'utente durante la validità", async () => {
    const { userId } = await verifiedSession("campanella@example.invalid");
    expect(
      await saveServiceNotice(
        env.DB,
        { notice: notice(later(-2 * hour), later(-hour)), actor: "admin" },
        at(now),
      ),
    ).toEqual({ result: "invalid" });
    const saved = await saveServiceNotice(
      env.DB,
      { notice: notice(later(hour), later(3 * hour)), actor: "admin" },
      at(now),
    );
    if (saved.result !== "done") throw new Error();
    const bell = (language: "it" | "en", time: string) =>
      listNotifications(env.DB, userId, [], language, "Europe/Rome", at(time));
    expect(await bell("it", now)).toEqual([]);
    const [item] = await bell("it", later(2 * hour));
    expect(item).toMatchObject({ tone: "warning", title: "Manutenzione", read: false });
    expect((await bell("en", later(2 * hour)))[0]).toMatchObject({ title: "Maintenance" });
    expect(await bell("it", later(3 * hour))).toEqual([]);

    // Un testo modificato torna da leggere; ritirata esce subito.
    const edited = await saveServiceNotice(
      env.DB,
      {
        id: saved.id,
        notice: { ...notice(later(hour), later(3 * hour)), bodyIt: "Due ore." },
        actor: "admin",
      },
      at(later(90 * 60_000)),
    );
    expect(edited).toEqual({ result: "done", id: saved.id });
    const [updated] = await bell("it", later(2 * hour));
    expect(updated!.id).not.toBe(item!.id);
    expect(await withdrawServiceNotice(env.DB, saved.id, at(later(2 * hour)))).toBe("done");
    expect(await bell("it", later(2 * hour))).toEqual([]);
    expect(await withdrawServiceNotice(env.DB, saved.id)).toBe("not_found");
  });
});

describe("quote delle API eBay", () => {
  const daily = (name: string, used: number, reset = "2026-09-14T07:00:00.000Z", limit = 5000) => ({
    name,
    rates: [
      {
        count: used,
        limit,
        remaining: limit - used,
        reset,
        timeWindow: 86_400,
      },
      { count: 1, limit: 300, remaining: 299, reset: now, timeWindow: 300 },
    ],
  });

  /** eBay sintetico: token dell'applicazione e quote di Trading e Fulfillment. */
  function analytics(
    trading: ReturnType<typeof daily>[],
    fulfillment = [daily("sell.fulfillment", 10)],
  ) {
    const calls: string[] = [];
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input instanceof Request ? input.url : input));
      calls.push(url.pathname + url.search);
      if (url.pathname.endsWith("/oauth2/token"))
        return Response.json({ access_token: "app-token" });
      const context = url.searchParams.get("api_context");
      return Response.json({
        rateLimits:
          context === "tradingapi"
            ? [{ apiContext: "tradingapi", apiName: "TradingAPI", resources: trading }]
            : [{ apiContext: "sell", apiName: "fulfillment", resources: fulfillment }],
      });
    }) as unknown as typeof fetch;
    return { fetcher, calls };
  }

  it("apre un'anomalia al giorno oltre il 70% e la chiude al rientro", async () => {
    await env.DB.prepare(
      "INSERT INTO ebay_rate_limits (api_origin, until) VALUES ('https://api.ebay.com#GetItem', ?)",
    )
      .bind(later(3 * hour))
      .run();
    const over = analytics([
      daily("GetOrders", 3600),
      daily("GetItem", 4600),
      daily("GetUser", 10),
    ]);
    const [production] = await readEbayQuotas(env, over.fetcher, at(now));
    expect(production).toMatchObject({
      environment: "production",
      read: "ok",
      suspended: [{ call: "GetItem", until: later(3 * hour) }],
    });
    expect(production!.rows.find((row) => row.resource === "GetOrders")).toMatchObject({
      api: "Trading",
      daily: true,
      over: true,
      used: true,
      rate: { limit: 5000, used: 3600, remaining: 1400, resetAt: "2026-09-14T07:00:00.000Z" },
    });
    expect(production!.rows.find((row) => row.resource === "GetUser")).toMatchObject({
      over: false,
    });
    // Nessuna chiamata per conto dei negozi: soltanto token dell'applicazione e Analytics.
    expect(
      over.calls.every((path) => path.includes("oauth2/token") || path.includes("rate_limit")),
    ).toBe(true);
    const open = await quotaAnomalies(env.DB, at(now));
    expect(open.map(({ subject, severity }) => ({ subject, severity }))).toEqual([
      { subject: "production:Trading:GetItem", severity: "p1" },
      { subject: "production:Trading:GetOrders", severity: "p2" },
    ]);
    // Rilette nello stesso giorno restano le stesse anomalie.
    await readEbayQuotas(env, over.fetcher, at(later(hour)));
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM admin_anomalies").first()).toEqual({
      n: 2,
    });
    expect(
      (await listAnomalies(env.DB, at(later(hour)))).filter((a) => a.kind === "ebay_quota"),
    ).toHaveLength(2);

    // Una lettura non riuscita non è una quota piena né vuota e non chiude nulla.
    const failing = vi.fn(async () => new Response("", { status: 503 })) as unknown as typeof fetch;
    expect(await readEbayQuotas(env, failing, at(later(2 * hour)))).toEqual([
      {
        environment: "production",
        read: "failed",
        rows: [],
        suspended: [{ call: "GetItem", until: later(3 * hour) }],
      },
    ]);
    expect((await quotaAnomalies(env.DB, at(later(2 * hour)))).every((a) => !a.resolvedAt)).toBe(
      true,
    );

    // Dopo l'azzeramento il consumo rientra e le anomalie si chiudono.
    const reset = analytics([daily("GetOrders", 100), daily("GetItem", 100)]);
    await readEbayQuotas(env, reset.fetcher, at("2026-09-14T08:00:00.000Z"));
    const closed = await quotaAnomalies(env.DB, at("2026-09-14T08:00:00.000Z"));
    expect(closed.every((a) => a.resolvedAt === "2026-09-14T08:00:00.000Z")).toBe(true);
    // Nella finestra successiva un nuovo superamento apre una nuova anomalia, e quella della
    // finestra precedente non resta aperta accanto: per chiamata ne resta aperta una.
    const next = "2026-09-15T07:00:00.000Z";
    await readEbayQuotas(env, over.fetcher, at("2026-09-14T09:00:00.000Z"));
    const reopened = analytics([daily("GetOrders", 3600, next), daily("GetItem", 4600, next)]);
    await readEbayQuotas(env, reopened.fetcher, at("2026-09-14T09:00:00.000Z"));
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM admin_anomalies").first()).toEqual({
      n: 4,
    });
    expect(
      (await quotaAnomalies(env.DB, at("2026-09-14T09:00:00.000Z"))).filter((a) => !a.resolvedAt),
    ).toHaveLength(2);
  });

  it("tratta la quota Trading condivisa come una sola, sulle chiamate di FiscalBay", async () => {
    // eBay riporta lo stesso residuo per ogni chiamata Trading: la quota è unica.
    const pooled = (name: string, count: number) => ({
      name,
      rates: [
        {
          count,
          limit: 5000,
          remaining: 1200,
          reset: "2026-09-14T07:00:00.000Z",
          timeWindow: 86_399,
        },
      ],
    });
    const shared = analytics(
      [pooled("GetOrders", 3000), pooled("GetItem", 800), pooled("AddItem", 0)],
      [daily("sell.fulfillment.refund", 99_000, "2026-09-14T07:00:00.000Z", 100_000)],
    );
    const [production] = await readEbayQuotas(env, shared.fetcher, at(now));
    const getOrders = production!.rows.find((row) => row.resource === "GetOrders")!;
    // Il consumo è della quota condivisa, non delle sole chiamate della voce.
    expect(getOrders).toMatchObject({ share: 0.76, over: true, daily: true, used: true });
    expect(getOrders.rate).toMatchObject({ used: 3000, consumed: 3800 });
    expect(production!.rows.find((row) => row.resource === "AddItem")).toMatchObject({
      used: false,
    });
    // Fulfillment oltre soglia su una risorsa che FiscalBay non usa: nessuna anomalia.
    expect(
      production!.rows.find((row) => row.resource === "sell.fulfillment.refund"),
    ).toMatchObject({ over: true, used: false });
    expect(
      (await quotaAnomalies(env.DB, at(now))).map(({ subject, severity }) => ({
        subject,
        severity,
      })),
    ).toEqual([{ subject: "production:Trading", severity: "p2" }]);
  });
});

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
