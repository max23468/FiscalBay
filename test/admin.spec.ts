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
import { readTechnicalMetrics } from "../app/domain/technical-metrics.server";
import { cpuValues, metricQueries, metricSql, pageCpuQuery } from "../app/metrics-queries";
import {
  applyWorkspacePlan,
  assistFreeStore,
  chooseFreeStore,
} from "../app/domain/free-store.server";
import { freeQuotaSettings, orderAllowance } from "../app/domain/grants.server";
import { purgeExpiredRecords } from "../app/domain/maintenance.server";
import { subscriptionView } from "../app/domain/plan-view.server";
import { listNotifications } from "../app/domain/notifications.server";
import { requestStoreSync } from "../app/domain/order-sync.server";
import { requeueTask } from "../app/domain/scheduled-work.server";
import { saveServiceNotice, withdrawServiceNotice } from "../app/domain/service-notices.server";
import { confirmStoreTransfer, prepareStoreTransfer } from "../app/domain/store-transfer.server";
import { listStores, resumeStore, setAdminPause } from "../app/domain/stores.server";
import { admission } from "../app/domain/admission.server";
import { serviceSetting, switchboard } from "../app/domain/service-settings.server";
import { action as adminAction, loader as adminLoader } from "../app/routes/admin";
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
  insertStore,
  insertWorkspace,
  now,
  resetDatabase,
} from "./fixtures/database-fixtures";
import { fakeQueue, queued } from "./fixtures/queue-fixture";
import { stripeAccount } from "./fixtures/stripe-fixtures";
import { callRoute, routeData, routeResponse } from "./fixtures/route-fixtures";

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
    expect(
      await act(cookie, {
        intent: "grant-premium",
        spazio: "w-a",
        giorni: "x".repeat(129),
        motivo: "y",
      }),
    ).toMatchObject({ status: 400 });
    expect(await act(cookie, { intent: "requeue-task", lavoro: "inesistente" })).toMatchObject({
      status: 400,
    });
    expect(
      await act(cookie, { intent: "quota-attention", soglia: "99", motivo: "Prova" }),
    ).toMatchObject({ status: 400 });
    // Anche i rifiuti decisi dal modulo restano nel registro, con l'oggetto quando è indicato.
    expect(await audit()).toEqual([
      {
        operation: "grant-premium",
        target: "workspace:w-a",
        reason: "x",
        outcome: "foreign_origin",
      },
      {
        operation: "grant-premium",
        target: "workspace:w-a",
        reason: null,
        outcome: "reason_required",
      },
      { operation: "comando-libero", target: null, reason: null, outcome: "unknown_intent" },
      { operation: "grant-premium", target: "workspace:w-a", reason: "y", outcome: "too_long" },
      { operation: "requeue-task", target: "task:inesistente", reason: null, outcome: "invalid" },
      {
        operation: "quota-attention",
        target: "setting:quota_attention:99",
        reason: "Prova",
        outcome: "out_of_range",
      },
    ]);
    await env.DB.prepare("DELETE FROM admin_audit").run();

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

  it("la conferma con passkey vale dodici ore dall'apertura della sessione, anche per le operazioni", async () => {
    const { cookie, userId } = await admin();
    const row = await env.DB.prepare('SELECT "createdAt" FROM "session" WHERE "userId" = ?')
      .bind(userId)
      .first<{ createdAt: string | number }>();
    const opened = new Date(row!.createdAt).getTime();
    const requeue = { intent: "requeue-task", lavoro: "billing" };
    try {
      vi.setSystemTime(new Date(opened + 12 * hour - 60_000));
      const granted = await routeData(adminLoader, "/admin", { cookie });
      expect(granted).toMatchObject({
        access: "granted",
        passkeyUntil: new Date(opened + 12 * hour).toISOString(),
      });
      expect(await act(cookie, requeue)).toMatchObject({ ok: true });
      // Allo scadere delle dodici ore la sessione resta aperta, ma la console chiede la passkey.
      vi.setSystemTime(new Date(opened + 12 * hour));
      expect(await page(cookie)).toEqual({ access: "verify", section: null });
      await expect(
        callRoute(adminAction, "/admin", { cookie, fields: requeue }),
      ).rejects.toMatchObject({ init: { status: 404 } });
    } finally {
      vi.useRealTimers();
    }
    expect((await audit()).map((entry) => entry.operation)).toEqual(["requeue-task"]);
  });

  it("la riga del registro che non si scrive non cambia l'esito dell'operazione riuscita", async () => {
    const { cookie } = await admin();
    await env.DB.batch(insertWorkspace({ id: "w-a" }));
    const original = env.DB.prepare.bind(env.DB);
    let failures = 1;
    vi.spyOn(env.DB, "prepare").mockImplementation((query) =>
      query.includes("INSERT INTO admin_audit") && failures-- > 0
        ? ({
            bind: () => ({ run: () => Promise.reject(new Error("database_unavailable")) }),
          } as unknown as D1PreparedStatement)
        : original(query),
    );
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const grant = { intent: "grant-premium", spazio: "w-a", giorni: "3", motivo: "Disservizio" };
    // Il primo errore si riprova: la riga c'è e la risposta è quella dell'operazione.
    expect(await act(cookie, grant)).toMatchObject({ ok: true });
    expect(await audit()).toEqual([
      {
        operation: "grant-premium",
        target: "workspace:w-a",
        reason: "Disservizio",
        outcome: "done",
      },
    ]);
    expect(logged).not.toHaveBeenCalled();
    // Con il registro che non risponde l'esito resta quello reale e l'errore va nei log.
    failures = 2;
    expect(await act(cookie, grant)).toMatchObject({ ok: true });
    expect(await audit()).toHaveLength(1);
    expect(logged).toHaveBeenCalledOnce();
    // Entrambe le concessioni sono avvenute.
    expect(
      await env.DB.prepare(
        "SELECT count(*) AS n FROM workspace_entitlements WHERE workspace_id = 'w-a'",
      ).first(),
    ).toEqual({ n: 2 });
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
    const sections = [
      "account",
      "negozi",
      "lavori",
      "quote",
      "prestazioni",
      "commerciale",
      "antiabuso",
    ];
    for (const sezione of [...sections, "comunicazioni", "interruttori", "registro"])
      expect(await page(cookie, `/admin/${sezione}`, { sezione })).toEqual({
        access: "granted",
        section: sezione,
      });
    expect(await page(cookie, "/admin/spazi/w-a", { sezione: "spazi", voce: "w-a" })).toMatchObject(
      { section: "spazi" },
    );
    // La scheda dello spazio elenca i suoi negozi con lo stato visto dal venditore.
    const space = await routeData(adminLoader, "/admin/spazi/w-a", {
      cookie,
      params: { sezione: "spazi", voce: "w-a" },
    });
    expect(space.page).toMatchObject({
      workspace: { stores: [expect.objectContaining({ id: "s-a" })] },
    });
    const overview = await routeData(adminLoader, "/admin", { cookie, params: {} });
    expect(overview.page).toMatchObject({ tasks: { total: 10 } });
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

  it("con il lifetime concesso un abbonamento che Stripe non restituisce più resta indisponibile", async () => {
    await env.DB.batch([
      ...insertWorkspace({ id: "w-a" }),
      env.DB.prepare(`INSERT INTO stripe_subscriptions (id, workspace_id, environment,
          customer_id, offer, price_generation, status, current_period_start, current_period_end,
          cancel_at_period_end, synced_at, checked_at)
        VALUES ('sub_test', 'w-a', 'test', 'cus_test', 'monthly', '2026-09', 'active', ?1,
          '2026-10-13T20:00:00.000Z', 0, ?1, ?1)`).bind(now),
    ]);
    const stripe = stripeAccount();
    stripe.state.missing = true;
    vi.spyOn(globalThis, "fetch").mockImplementation(stripe.fetcher);
    expect(
      await grantLifetimeConcession(
        env,
        { workspaceId: "w-a", author: "admin", reason: "Omaggio" },
        at(now),
      ),
    ).toBe("done");
    expect(stripe.requests).toEqual(["GET /v1/subscriptions/sub_test"]);
    // Non può più addebitare: il cron non la rilegge come un abbonamento da chiudere.
    expect(
      await env.DB.prepare("SELECT status, unavailable_at FROM stripe_subscriptions").first(),
    ).toEqual({ status: "active", unavailable_at: now });
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

  it("apre l'anomalia alla soglia scelta nella console", async () => {
    const { cookie } = await admin();
    const usage = analytics([daily("GetOrders", 3250)]);
    const orders = async () =>
      (await readEbayQuotas(env, usage.fetcher, at(now)))[0]!.rows.find(
        (row) => row.resource === "GetOrders",
      );
    expect(await orders()).toMatchObject({ over: false });
    for (const soglia of ["49", "86", "sessanta"])
      expect(
        await act(cookie, { intent: "quota-attention", soglia, motivo: "Prova" }),
      ).toMatchObject({ status: 400 });
    // I valori fuori intervallo restano nel registro come rifiuti.
    expect(await audit()).toEqual(
      ["49", "86", "sessanta"].map((soglia) => ({
        operation: "quota-attention",
        target: `setting:quota_attention:${soglia}`,
        reason: "Prova",
        outcome: "out_of_range",
      })),
    );
    await env.DB.prepare("DELETE FROM admin_audit").run();
    expect(await act(cookie, { intent: "quota-attention", soglia: "60", motivo: "Prova" })).toEqual(
      {
        ok: true,
        notice: "Operazione registrata.",
      },
    );
    expect(await orders()).toMatchObject({ over: true });
    expect(await quotaAnomalies(env.DB, at(now))).toHaveLength(1);
    expect(
      await act(cookie, { intent: "quota-attention", soglia: "60", motivo: "Prova" }),
    ).toMatchObject({ ok: false });
    expect(await audit()).toEqual([
      {
        operation: "quota-attention",
        target: "setting:quota_attention:60",
        reason: "Prova",
        outcome: "done",
      },
      {
        operation: "quota-attention",
        target: "setting:quota_attention:60",
        reason: "Prova",
        outcome: "unchanged",
      },
    ]);
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
    // Prima le chiamate di FiscalBay nell'ordine di importanza, poi le altre.
    expect(production!.rows.map((row) => row.resource)).toEqual([
      "GetOrders",
      "GetItem",
      "sell.fulfillment.refund",
      "AddItem",
    ]);
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
    ).toEqual([{ subject: "production:Trading:GetOrders", severity: "p2" }]);
  });

  it("nella stessa finestra la quota resta la stessa anomalia se cambiano chiamate o azzeramento", async () => {
    const pooled = (name: string, count: number, reset: string, remaining = 1200) => ({
      name,
      rates: [{ count, limit: 5000, remaining, reset, timeWindow: 86_399 }],
    });
    const reset = "2026-09-14T07:00:00.000Z";
    // Prima lettura: la quota condivisa con una sola chiamata oltre soglia nell'elenco.
    await readEbayQuotas(env, analytics([pooled("GetOrders", 3800, reset)]).fetcher, at(now));
    // Poi eBay elenca altre chiamate della stessa quota e sposta l'azzeramento di qualche secondo.
    const shifted = "2026-09-14T06:59:57.000Z";
    await readEbayQuotas(
      env,
      analytics([
        pooled("GetOrders", 3000, shifted, 1100),
        pooled("GetItem", 900, shifted, 1100),
        pooled("AddItem", 0, shifted, 1100),
      ]).fetcher,
      at(later(hour)),
    );
    const anomalies = await env.DB.prepare(
      "SELECT key, subject, resolved_at FROM admin_anomalies WHERE kind = 'ebay_quota'",
    ).all();
    expect(anomalies.results).toEqual([
      {
        key: `ebay_quota:production:Trading:GetOrders:${reset}`,
        subject: "production:Trading:GetOrders",
        resolved_at: null,
      },
    ]);
  });
});

describe("prestazioni da Analytics Engine", () => {
  it("pesa ogni conteggio, somma, media e quantile con il campionamento", () => {
    for (const query of metricQueries) {
      const sql = metricSql(query, "fiscalbay_test_metrics", 24);
      expect(sql).toContain("FROM fiscalbay_test_metrics");
      expect(sql).toContain("timestamp > NOW() - INTERVAL '24' HOUR");
      // Nessun conteggio di righe: con il campionamento una riga vale `_sample_interval` eventi.
      expect(sql).not.toMatch(/count\(|avg\(/iu);
      for (const aggregate of sql.match(/(SUM|quantileExactWeighted\([\d.]+\))\([^\n]*/gu)!)
        expect(aggregate).toContain("_sample_interval");
    }
    expect(metricSql("pages", "fiscalbay_metrics", 2160)).toContain(
      "quantileExactWeighted(0.95)(double3, if(double3 >= 0, _sample_interval, 0)) AS lcp_p95_ms",
    );
    // Numero, media e quantili delle invocazioni hanno la stessa unità: l'invocazione.
    expect(metricSql("invocations", "fiscalbay_metrics", 24)).toContain(
      "quantileExactWeighted(0.5)(double2, _sample_interval) AS p50_ms",
    );
    // Dataset e finestra sono controllati: niente testo libero nella query.
    expect(() => metricSql("phases", "dati; DROP", 24)).toThrow("INVALID_DATASET");
    for (const hours of [0, 1.5, 2161])
      expect(() => metricSql("phases", "fiscalbay_metrics", hours)).toThrow("INVALID_WINDOW");
  });

  it("conta le invocazioni della coda per invocazione su un campione con pesi diversi", async () => {
    // Campione controllato: un gruppo di quattro messaggi da 400 ms con peso 1 e tre invocazioni
    // stimate da un messaggio e 100 ms ciascuna (peso 3). Le funzioni di Analytics Engine che D1
    // non conosce (finestra e quantili) restano fuori: i quantili usano le stesse colonne.
    const sql = metricSql("invocations", "metriche_campione", 24)
      .replace(/timestamp > NOW\(\) - INTERVAL '24' HOUR/u, "1 = 1")
      .replaceAll(/quantileExactWeighted\([\d.]+\)\(double2, _sample_interval\)/gu, "NULL")
      .replace("FORMAT JSON", "");
    await env.DB.prepare(
      `CREATE TABLE metriche_campione (timestamp TEXT, blob1 TEXT, blob2 TEXT, blob3 TEXT,
        blob4 TEXT, blob5 TEXT, double1 REAL, double2 REAL, _sample_interval REAL)`,
    ).run();
    try {
      await env.DB.prepare(
        `INSERT INTO metriche_campione VALUES
          (?1, 'invocation', 'queue', 'sync', '', 'ok', 4, 400, 1),
          (?1, 'invocation', 'queue', 'sync', '', 'ok', 1, 100, 3)`,
      )
        .bind(now)
        .run();
      const { results } = await env.DB.prepare(sql).all();
      expect(results).toEqual([
        expect.objectContaining({ invocation: "queue", count: 4, messages: 7, mean_ms: 175 }),
      ]);
    } finally {
      await env.DB.prepare("DROP TABLE metriche_campione").run();
    }
  });

  it("legge le tre query con il token di sola lettura e distingue i valori assenti dagli zeri", async () => {
    expect(await readTechnicalMetrics({ ...env, ANALYTICS_READ_TOKEN: undefined }, fetch)).toEqual({
      read: "unconfigured",
    });
    const requests: { url: string; authorization: string | null; body: string }[] = [];
    const rows = {
      invocations: [
        {
          invocation: "http",
          detail: "document",
          method: "GET",
          outcome: "2xx",
          count: "40",
          mean_ms: 85.5,
          p50_ms: 70,
          p95_ms: 190,
          p99_ms: 240,
        },
      ],
      phases: [
        {
          invocation: "queue",
          phase: "ebay",
          operation: "request",
          outcome: "ok",
          calls: "12",
          invocations: "4",
          mean_ms: 300,
          p50_ms: 280,
          p95_ms: 410,
          p99_ms: 500,
        },
      ],
      pages: [
        {
          page: "orders",
          reports: "8",
          ttfb_reports: "8",
          ttfb_p75_ms: 120,
          ttfb_p95_ms: 180,
          lcp_reports: "0",
          lcp_p75_ms: 0,
          lcp_p95_ms: 0,
        },
      ],
    };
    const telemetry = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/workers/observability/telemetry/query`;
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const body = String(init?.body);
      requests.push({
        url: String(input),
        authorization: new Headers(init?.headers).get("authorization"),
        body,
      });
      if (String(input) === telemetry) {
        // Soltanto Ordini documento ha invocazioni nella finestra.
        const measured =
          (JSON.parse(body) as { queryId: string }).queryId === "page-cpu-orders-document";
        const aggregate = (value: number) => [{ value, count: measured ? 30 : 0 }];
        return Response.json({
          success: true,
          result: {
            calculations: [
              { alias: "invocations", aggregates: aggregate(measured ? 30 : 0) },
              { alias: "cpu_p50_ms", aggregates: aggregate(measured ? 42 : 0) },
              { alias: "cpu_p95_ms", aggregates: aggregate(measured ? 170 : 0) },
              { alias: "wall_p50_ms", aggregates: aggregate(measured ? 760 : 0) },
            ],
          },
        });
      }
      const query = body.includes("'phase'")
        ? "phases"
        : body.includes("'page'")
          ? "pages"
          : "invocations";
      return Response.json({ meta: [], data: rows[query], rows: 1 });
    }) as unknown as typeof fetch;
    const metrics = await readTechnicalMetrics(
      { ...env, ANALYTICS_READ_TOKEN: "token-di-lettura" },
      fetcher,
    );
    expect(requests).toHaveLength(7);
    for (const request of requests) {
      expect(request.authorization).toBe("Bearer token-di-lettura");
      if (request.url === telemetry) expect(request.body).toContain(`"value":"${env.WORKER_NAME}"`);
      else {
        expect(request.url).toBe(
          `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/analytics_engine/sql`,
        );
        expect(request.body).toContain(`FROM ${env.METRICS_DATASET}`);
      }
    }
    expect(metrics).toMatchObject({
      read: "ok",
      windowHours: 24,
      invocations: [{ detail: "document", count: 40, p95Ms: 190 }],
      phases: [{ phase: "ebay", calls: 12, invocations: 4, p95Ms: 410 }],
      pages: [
        {
          page: "orders",
          reports: 8,
          // Nessun report con LCP o con la fase eBay: il valore manca, non è zero.
          measures: {
            ttfb: { p75: 120, p95: 180 },
            lcp: { p75: null, p95: null },
            server_ebay: { p75: null, p95: null },
          },
        },
      ],
      cpu: [
        {
          page: "orders",
          kind: "document",
          invocations: 30,
          cpuP50Ms: 42,
          cpuP95Ms: 170,
          wallP50Ms: 760,
        },
        // Nessuna invocazione nella finestra: i tempi mancano, non sono zero.
        {
          page: "orders",
          kind: "data",
          invocations: 0,
          cpuP50Ms: null,
          cpuP95Ms: null,
          wallP50Ms: null,
        },
        { page: "stores", kind: "document", invocations: 0, cpuP50Ms: null },
        { page: "stores", kind: "data", invocations: 0, cpuP50Ms: null },
      ],
    });
    expect(
      await readTechnicalMetrics(
        { ...env, ANALYTICS_READ_TOKEN: "token", WORKER_NAME: "" },
        fetcher,
      ),
    ).toEqual({ read: "unconfigured" });
    // Una risposta non riuscita resta una lettura non riuscita, mai zero.
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      for (const failing of [
        async () => new Response("{}", { status: 403 }),
        async () => Response.json({ errors: [] }),
        // Telemetry senza `result.calculations`, SQL corretta.
        async (input: RequestInfo | URL) =>
          String(input).endsWith("/telemetry/query")
            ? Response.json({ success: true, result: {} })
            : Response.json({ data: [] }),
        async () => {
          throw new DOMException("timeout", "TimeoutError");
        },
      ])
        expect(
          await readTechnicalMetrics(
            { ...env, ANALYTICS_READ_TOKEN: "token" },
            vi.fn(failing) as unknown as typeof fetch,
          ),
        ).toEqual({ read: "failed" });
    } finally {
      logged.mockRestore();
    }
  });
});

describe("tempo CPU delle pagine dai Workers Logs", () => {
  const filterOf = (page: "orders" | "stores", kind: "document" | "data") =>
    new RegExp(
      pageCpuQuery("fiscalbay-test", page, kind, 24, 0).parameters.filters.find(
        (filter) => filter.key === "$workers.event.request.url",
      )!.value,
      "u",
    );

  it("separa documento e dati della pagina, in entrambe le lingue e con il dettaglio", () => {
    const document = filterOf("orders", "document");
    const data = filterOf("orders", "data");
    for (const url of [
      "https://test.fiscalbay.it/app/ordini",
      "https://test.fiscalbay.it/en/app/ordini?negozio=collaudo",
      "https://test.fiscalbay.it/app/ordini/12-00000-00001",
    ]) {
      expect(url).toMatch(document);
      expect(url).not.toMatch(data);
    }
    for (const url of [
      "https://test.fiscalbay.it/app/ordini.data",
      "https://test.fiscalbay.it/app/ordini/12-00000-00001.data?_routes=routes%2Forders",
    ]) {
      expect(url).toMatch(data);
      expect(url).not.toMatch(document);
    }
    // Altre pagine e percorsi più profondi non entrano nel conteggio.
    for (const url of [
      "https://test.fiscalbay.it/app/negozi",
      "https://test.fiscalbay.it/app/ordini/esporta/file",
      "https://test.fiscalbay.it/anteprima/ordini",
    ])
      expect(url).not.toMatch(document);
    expect("https://test.fiscalbay.it/app/negozi/collaudo-attivo").toMatch(
      filterOf("stores", "document"),
    );
    // Il collegamento di un negozio è un'altra route, anche in inglese e come dati; i negozi con
    // un nome vicino restano di Negozi.
    for (const kind of ["document", "data"] as const) {
      const stores = filterOf("stores", kind);
      const suffix = kind === "data" ? ".data" : "";
      for (const path of ["/app/negozi/collega", "/en/app/negozi/collega"])
        expect(`https://test.fiscalbay.it${path}${suffix}?esito=ok`).not.toMatch(stores);
      for (const detail of ["", "/c", "/coll", "/collegamento", "/collegb", "/xcollega", "/s-1"])
        expect(`https://test.fiscalbay.it/app/negozi${detail}${suffix}`).toMatch(stores);
    }
    // Nessun segmento di Ordini è escluso: un ordine può chiamarsi come un percorso.
    expect("https://test.fiscalbay.it/app/ordini/collega").toMatch(filterOf("orders", "document"));
  });

  it("controlla Worker e finestra e legge i valori senza confondere assenze e zeri", () => {
    const query = pageCpuQuery("fiscalbay", "stores", "data", 168, 1_000_000_000);
    expect(query.timeframe).toEqual({ from: 1_000_000_000 - 168 * 3_600_000, to: 1_000_000_000 });
    expect(query.parameters.calculations.map((calculation) => calculation.alias)).toEqual([
      "invocations",
      "cpu_p50_ms",
      "cpu_p95_ms",
      "wall_p50_ms",
    ]);
    expect(() => pageCpuQuery('fiscalbay" OR 1', "orders", "document", 24)).toThrow(
      "INVALID_SERVICE",
    );
    for (const hours of [0, 2.5, 169])
      expect(() => pageCpuQuery("fiscalbay", "orders", "document", hours)).toThrow(
        "INVALID_WINDOW",
      );
    expect(cpuValues(undefined)).toBeNull();
    expect(cpuValues([{ alias: "invocations", aggregates: [{ value: 0 }] }])).toEqual({
      invocations: 0,
      cpuP50Ms: null,
      cpuP95Ms: null,
      wallP50Ms: null,
    });
    const complete = (invocations: unknown) => [
      { alias: "invocations", aggregates: [{ value: invocations }] },
      { alias: "cpu_p50_ms", aggregates: [{ value: 4 }] },
      { alias: "cpu_p95_ms", aggregates: [{ value: "9" }] },
      { alias: "wall_p50_ms", aggregates: [{ value: 30 }] },
    ];
    expect(cpuValues(complete(3))).toEqual({
      invocations: 3,
      cpuP50Ms: 4,
      cpuP95Ms: 9,
      wallP50Ms: 30,
    });
    // Una risposta di forma diversa è una lettura non riuscita, non zero.
    for (const calculations of [
      [],
      [{ alias: "invocations" }],
      [{ alias: "invocations", aggregates: [{ value: "molti" }] }],
      complete(null),
      complete(3).slice(0, 3),
      complete(3).map((entry) =>
        entry.alias === "cpu_p95_ms" ? { ...entry, aggregates: [{ value: {} }] } : entry,
      ),
    ])
      expect(cpuValues(calculations)).toBeNull();
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

describe("interruttori e ammissione", () => {
  it("vale il comportamento normale senza configurazione o con un valore non valido", async () => {
    expect(await switchboard(env.DB)).toMatchObject({
      waitlist: { value: false, since: null },
      purchases: { value: true, since: null },
      ebay: { value: true, since: null },
      telegram: { value: true, since: null },
      quotaAttention: { value: 70, since: null },
      waiting: [],
      waitingTotal: 0,
    });
    await env.DB.prepare(`INSERT INTO service_settings (name, value, updated_at)
        VALUES ('ebay_calls', '"no"', ?1), ('telegram_sends', '0', ?1), ('quota_attention', '99', ?1)`)
      .bind(now)
      .run();
    expect(await serviceSetting(env.DB, "ebay_calls")).toBe(true);
    expect(await serviceSetting(env.DB, "telegram_sends")).toBe(true);
    expect(await serviceSetting(env.DB, "quota_attention")).toBe(70);
    expect((await listAnomalies(env.DB, at(now))).some((a) => a.kind === "service_off")).toBe(
      false,
    );
  });

  it("spegne e riaccende i servizi con motivo, registro e anomalia in panoramica", async () => {
    const { cookie, userId } = await admin();
    const off = (interruttore: string, motivo = "Incidente") =>
      act(cookie, { intent: "set-switch", interruttore, stato: "off", motivo });
    const on = (interruttore: string) =>
      act(cookie, { intent: "set-switch", interruttore, stato: "on", motivo: "Rientro" });
    expect(
      await act(cookie, { intent: "set-switch", interruttore: "ebay_calls", stato: "off" }),
    ).toMatchObject({ status: 400 });
    expect(await off("sql")).toMatchObject({ status: 400 });
    expect(
      await act(cookie, {
        intent: "set-switch",
        interruttore: "ebay_calls",
        stato: "x",
        motivo: "x",
      }),
    ).toMatchObject({ status: 400 });

    expect(await off("ebay_calls")).toEqual({ ok: true, notice: "Operazione registrata." });
    expect(await off("ebay_calls")).toMatchObject({ ok: false });
    expect(await off("telegram_sends")).toMatchObject({ ok: true });
    expect(await off("purchases_open")).toMatchObject({ ok: true });
    expect(await serviceSetting(env.DB, "ebay_calls")).toBe(false);
    expect(await admission(env.DB, userId)).toMatchObject({ purchasesOpen: false });
    // La lista d'attesa resta com'era: l'interruttore degli acquisti non la tocca.
    expect(await switchboard(env.DB)).toMatchObject({
      waitlist: { value: false },
      purchases: { value: false },
      ebay: { value: false },
      telegram: { value: false },
    });

    const anomaly = (await listAnomalies(env.DB)).find((a) => a.kind === "service_off");
    expect(anomaly).toMatchObject({ severity: "p2", count: 3 });
    expect(anomaly!.subjects.map((subject) => subject.id).sort()).toEqual([
      "ebay_calls",
      "purchases_open",
      "telegram_sends",
    ]);
    const section = await routeData(adminLoader, "/admin/interruttori", {
      cookie,
      params: { sezione: "interruttori" },
    });
    expect(section.page).toMatchObject({ section: "interruttori", ebay: { value: false } });

    for (const name of ["ebay_calls", "telegram_sends", "purchases_open"])
      expect(await on(name)).toMatchObject({ ok: true });
    expect((await listAnomalies(env.DB)).some((a) => a.kind === "service_off")).toBe(false);
    expect(await admission(env.DB, userId)).toMatchObject({ purchasesOpen: true });
    expect(await audit()).toEqual([
      {
        operation: "set-switch",
        target: "switch:ebay_calls:off",
        reason: null,
        outcome: "reason_required",
      },
      {
        operation: "set-switch",
        target: "switch:sql:off",
        reason: "Incidente",
        outcome: "invalid",
      },
      { operation: "set-switch", target: "switch:ebay_calls:x", reason: "x", outcome: "invalid" },
      {
        operation: "set-switch",
        target: "switch:ebay_calls:off",
        reason: "Incidente",
        outcome: "done",
      },
      {
        operation: "set-switch",
        target: "switch:ebay_calls:off",
        reason: "Incidente",
        outcome: "unchanged",
      },
      {
        operation: "set-switch",
        target: "switch:telegram_sends:off",
        reason: "Incidente",
        outcome: "done",
      },
      {
        operation: "set-switch",
        target: "switch:purchases_open:off",
        reason: "Incidente",
        outcome: "done",
      },
      {
        operation: "set-switch",
        target: "switch:ebay_calls:on",
        reason: "Rientro",
        outcome: "done",
      },
      {
        operation: "set-switch",
        target: "switch:telegram_sends:on",
        reason: "Rientro",
        outcome: "done",
      },
      {
        operation: "set-switch",
        target: "switch:purchases_open:on",
        reason: "Rientro",
        outcome: "done",
      },
    ]);
  });

  it("ammette uno spazio in attesa e, spegnendo la lista, tutti gli altri", async () => {
    const { cookie } = await admin();
    const first = await verifiedSession("attesa.prima@example.invalid");
    const second = await verifiedSession("attesa.seconda@example.invalid");
    await env.DB.batch([
      ...insertWorkspace({ id: "w-prima", userId: first.userId }),
      ...insertWorkspace({ id: "w-seconda", userId: second.userId }),
      env.DB.prepare("UPDATE user_profiles SET waitlisted_at = ?1 WHERE user_id IN (?2, ?3)").bind(
        now,
        first.userId,
        second.userId,
      ),
    ]);
    expect(
      await act(cookie, {
        intent: "set-switch",
        interruttore: "free_waitlist",
        stato: "on",
        motivo: "Capacità",
      }),
    ).toMatchObject({ ok: true });
    expect(await switchboard(env.DB)).toMatchObject({
      waitlist: { value: true, since: now },
      purchases: { value: true },
      waitingTotal: 2,
      waiting: [
        { workspaceId: "w-prima", email: "attesa.prima@example.invalid" },
        { workspaceId: "w-seconda", email: "attesa.seconda@example.invalid" },
      ],
    });

    expect(await act(cookie, { intent: "admit-waitlisted", spazio: "w-prima" })).toMatchObject({
      status: 400,
    });
    expect(
      await act(cookie, {
        intent: "admit-waitlisted",
        spazio: "w-prima",
        motivo: "Venditore noto",
      }),
    ).toMatchObject({ ok: true });
    expect(await admission(env.DB, first.userId)).toMatchObject({ waiting: false });
    expect(await admission(env.DB, second.userId)).toMatchObject({ waiting: true });
    expect(
      await act(cookie, { intent: "admit-waitlisted", spazio: "w-prima", motivo: "Ancora" }),
    ).toMatchObject({ ok: false });

    expect(
      await act(cookie, {
        intent: "set-switch",
        interruttore: "free_waitlist",
        stato: "off",
        motivo: "Capacità",
      }),
    ).toMatchObject({ ok: true });
    expect(await admission(env.DB, second.userId)).toMatchObject({ waiting: false });
    expect((await audit()).filter((row) => row.operation === "admit-waitlisted")).toEqual([
      {
        operation: "admit-waitlisted",
        target: "workspace:w-prima",
        reason: null,
        outcome: "reason_required",
      },
      {
        operation: "admit-waitlisted",
        target: "workspace:w-prima",
        reason: "Venditore noto",
        outcome: "done",
      },
      {
        operation: "admit-waitlisted",
        target: "workspace:w-prima",
        reason: "Ancora",
        outcome: "not_found",
      },
    ]);
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

describe("accesso tecnico con token", () => {
  const token = "fbat_token-sintetico-del-collaudo-con-lunghezza-sufficiente";
  async function register(revokedAt: string | null = null) {
    const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
    const hash = [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
    await env.DB.prepare(`INSERT INTO admin_agent_tokens (token_hash, label, created_at, revoked_at)
      VALUES (?, 'agente-test', ?, ?)`)
      .bind(hash, now, revokedAt)
      .run();
    return hash;
  }
  const bearer = (value = token) => ({ authorization: `Bearer ${value}` });

  it("apre la console senza passkey con le stesse operazioni e lascia la traccia", async () => {
    const hash = await register();
    await env.DB.batch(insertWorkspace({ id: "w-a" }));
    const result = await routeData(adminLoader, "/admin/registro", {
      headers: bearer(),
      params: { sezione: "registro" },
    });
    expect(result).toMatchObject({ access: "agent", technical: true, passkeyUntil: null });
    expect(result.page).toMatchObject({ section: "registro" });
    // Le operazioni passano come per la sessione con passkey, con motivo e controllo d'origine.
    const granted = await callRoute(adminAction, "/admin", {
      headers: bearer(),
      fields: { intent: "grant-premium", spazio: "w-a", giorni: "3", motivo: "Disservizio" },
    });
    expect(granted).toMatchObject({ ok: true });
    await expect(
      callRoute(adminAction, "/admin", {
        headers: bearer(),
        fields: { intent: "grant-premium", spazio: "w-a", giorni: "3", motivo: "Disservizio" },
        origin: "https://altro.invalid",
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(await audit()).toEqual([
      { operation: "agent-read", target: "page:/admin/registro", reason: null, outcome: "done" },
      {
        operation: "grant-premium",
        target: "workspace:w-a",
        reason: "Disservizio",
        outcome: "done",
      },
      {
        operation: "grant-premium",
        target: "workspace:w-a",
        reason: "Disservizio",
        outcome: "foreign_origin",
      },
    ]);
    expect(
      await env.DB.prepare(
        "SELECT granted_by FROM workspace_entitlements WHERE workspace_id = 'w-a'",
      ).first(),
    ).toEqual({ granted_by: "agent:agente-test" });
    expect(
      await env.DB.prepare("SELECT used_at FROM admin_agent_tokens WHERE token_hash = ?")
        .bind(hash)
        .first(),
    ).toEqual({ used_at: now });
    // Le letture tecniche non affollano le ultime operazioni della panoramica.
    expect((await listAudit(env.DB, { changes: true })).map((entry) => entry.operation)).toEqual([
      "grant-premium",
      "grant-premium",
    ]);
  });

  it("rifiuta un token revocato, sconosciuto o senza il prefisso", async () => {
    await register(now);
    for (const headers of [bearer(), bearer("fbat_altro-token"), bearer(token.slice(5))]) {
      await expect(routeData(adminLoader, "/admin", { headers })).rejects.toMatchObject({
        init: { status: 404 },
      });
      await expect(
        callRoute(adminAction, "/admin", {
          headers,
          fields: { intent: "requeue-task", lavoro: "billing" },
        }),
      ).rejects.toMatchObject({ init: { status: 404 } });
    }
    expect(await audit()).toEqual([]);
  });
});
