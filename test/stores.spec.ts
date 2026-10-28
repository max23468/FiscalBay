import { env } from "cloudflare:workers";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";
import { orderAllowance, startTrial, unlockOrders } from "../app/domain/grants.server";
import { admission, applyInactivity, recordActivity } from "../app/domain/admission.server";
import { setSwitch } from "../app/domain/service-settings.server";
import { marketingTextVersions } from "../app/domain/registration.server";
import { purchaseState } from "../app/domain/checkout.server";
import { lifetimeContext } from "../app/domain/lifetime.server";
import { dispatchStoreSyncs, requestStoreSync } from "../app/domain/order-sync.server";
import { consumeOrderConfirmation } from "../app/domain/order-acquisition.server";
import { action as storeLinkAction } from "../app/routes/store-link";
import { listVisibleOrders } from "../app/domain/orders.server";
import { revokeSession } from "../app/domain/sessions.server";
import {
  deleteStoreData,
  disconnectStore,
  listStores,
  pauseStore,
  resumeStore,
} from "../app/domain/stores.server";
import { handleAuthRequest } from "../app/auth-route.server";
import {
  action as storesAction,
  loader as loadStores,
  clientAction as storesClientAction,
} from "../app/routes/stores";
import { loader as loadProfile } from "../app/routes/profile";
import {
  action as settingsAction,
  loader as loadSettings,
  clientAction as settingsClientAction,
} from "../app/routes/settings";
import { action as languageAction } from "../app/routes/language";
import { action as notificationsAction } from "../app/routes/notifications";
import { appCopy, supportEmail } from "../app/app-copy";
import {
  applyFreePlan,
  applyFreePlans,
  chooseFreeStore,
  freeStoreState,
} from "../app/domain/free-store.server";
import type { ActionResult } from "../app/view-models";
import { purgeExpiredRecords } from "../app/domain/maintenance.server";
import { supportRequestLimit } from "../app/domain/support-requests.server";
import { maxSupportMessage, supportFields } from "../app/support";
import { refreshStoreToken } from "../app/integrations/ebay/seller-credentials.server";
import { refreshExpiringTokens } from "../app/domain/token-refresh.server";
import {
  insertEntitlement,
  insertStore,
  insertWorkspace,
  insertStorePause,
  now,
  resetDatabase,
  resetOrderFixtures,
  type EntitlementSource,
} from "./fixtures/database-fixtures";
import { syntheticEbay, syntheticOrderId } from "./fixtures/ebay-fixtures";
import { syntheticProfile, verifiedSession, profileOf } from "./fixtures/account-fixtures";
import { homeFor } from "./fixtures/account-route-fixtures";
import { beginStoreLink, storeCallback } from "./fixtures/store-link-fixtures";
import { queued } from "./fixtures/queue-fixture";
import {
  areaShell,
  callRoute,
  routeData,
  routeResponse,
  testOrigin,
} from "./fixtures/route-fixtures";

beforeEach(resetDatabase);
afterEach(() => vi.useRealTimers());

describe("pausa, ricollegamento e scollegamento dei negozi", () => {
  beforeEach(() => vi.useRealTimers());
  it.each([
    ["negozi", storesClientAction],
    ["impostazioni", settingsClientAction],
  ] as const)(
    "%s conserva gli errori di rete senza assorbire autorizzazioni e richieste annullate",
    async (path, clientAction) => {
      const request = new Request(`http://localhost:5173/en/app/${path}`);
      const ok = { ok: true, notice: "ok" };
      expect(await clientAction({ request, serverAction: async () => ok } as never)).toEqual(ok);
      const network = new TypeError("synthetic network failure");
      const failure = await clientAction({
        request,
        serverAction: async () => {
          throw network;
        },
      } as never);
      expect(failure).toEqual({
        ok: false,
        notice:
          "The outcome could not be confirmed. Reload the page to check its state before trying again.",
      });
      for (const error of [
        new Response(null, { status: 303, headers: { location: "/accesso" } }),
        { status: 403, statusText: "Forbidden", data: "denied", internal: true },
      ]) {
        await expect(
          clientAction({
            request,
            serverAction: async () => {
              throw error;
            },
          } as never),
        ).rejects.toBe(error);
      }
      const controller = new AbortController();
      controller.abort();
      await expect(
        clientAction({
          request: new Request(request, { signal: controller.signal }),
          serverAction: async () => {
            throw network;
          },
        } as never),
      ).rejects.toBe(network);
    },
  );
  const day = 24 * 60 * 60 * 1000;
  const hour = 60 * 60 * 1000;

  async function linkThroughEbay(cookie: string, ebay = syntheticEbay()) {
    const state = (await beginStoreLink(cookie)).searchParams.get("state");
    return handleAuthRequest(storeCallback(`state=${state}&code=codice`, cookie), env, ebay);
  }

  async function linkedSeller(email: string) {
    const session = await verifiedSession(email);
    await linkThroughEbay(session.cookie);
    const store = await env.DB.prepare("SELECT id, workspace_id FROM ebay_stores").first<{
      id: string;
      workspace_id: string;
    }>();
    return { ...session, storeId: store!.id, workspaceId: store!.workspace_id };
  }

  async function count(table: string): Promise<number> {
    const row = await env.DB.prepare(`SELECT COUNT(*) AS total FROM ${table}`).first<{
      total: number;
    }>();
    return row!.total;
  }

  /** Sblocca l'ordine importato consumando un posto del ciclo Free. */
  async function grantImportedOrder(seller: { userId: string; workspaceId: string }) {
    await env.DB.prepare(
      `INSERT INTO free_cycles (id, workspace_id, starts_at, ends_at, quota)
       VALUES ('ciclo', ?, ?, ?, 5)`,
    )
      .bind(
        seller.workspaceId,
        new Date(Date.now() - day).toISOString(),
        new Date(Date.now() + day).toISOString(),
      )
      .run();
    const order = await env.DB.prepare("SELECT id FROM orders").first<{ id: string }>();
    await unlockOrders(env.DB, seller.userId, [order!.id]);
  }

  async function quotaUsed(): Promise<number> {
    const row = await env.DB.prepare("SELECT used FROM free_cycles").first<{ used: number }>();
    return row!.used;
  }

  it("avvisa prima della scadenza del consenso e, dopo, per al massimo trenta giorni", async () => {
    const seller = await linkedSeller("avvisi@example.invalid");
    const at = new Date("2027-01-01T00:00:00.000Z");
    const setExpiry = (value: Date) =>
      env.DB.prepare("UPDATE ebay_store_credentials SET refresh_expires_at = ?")
        .bind(value.toISOString())
        .run();

    await setExpiry(new Date(at.getTime() + 31 * day));
    expect(await listStores(env.DB, seller.userId, at)).toEqual([
      {
        id: seller.storeId,
        name: "venditore",
        username: "venditore",
        logoUrl: null,
        storeUrl: null,
        feedback: { score: 42, positivePercent: 100, topRated: false },
        ebayEnvironment: "production",
        connection: "active",
        pauseReasons: [],
        inactiveSince: null,
        consentGrantedAt: expect.any(String),
        consentExpiresAt: "2027-02-01T00:00:00.000Z",
        lastSyncAt: expect.any(String),
        syncing: false,
        targetMinutes: 30,
        // La lettura del collegamento è la prima fra gli ultimi aggiornamenti.
        recent: [{ at: expect.any(String), ok: true, newOrders: 1 }],
        importedOrders: 0,
        marketplace: null,
        // Al collegamento l'unico ordine dello storico completa l'importazione.
        history: { days: 30, done: true },
        reminder: null,
        consentExpiring: false,
      },
    ]);
    // Prima della lettura di `GetUser` il feedback non c'è.
    await env.DB.prepare("UPDATE ebay_stores SET feedback_score = NULL").run();
    expect((await listStores(env.DB, seller.userId, at))[0]?.feedback).toBeNull();
    await setExpiry(new Date(at.getTime() + 30 * day));
    expect((await listStores(env.DB, seller.userId, at))[0]).toMatchObject({
      connection: "active",
      reminder: { kind: "expiring", at: "2027-01-31T00:00:00.000Z" },
      consentExpiring: true,
    });
    // In pausa il banner degli Ordini tace, il pannello del negozio segnala ancora la scadenza.
    await pauseStore(env.DB, seller.userId, seller.storeId, at);
    expect((await listStores(env.DB, seller.userId, at))[0]).toMatchObject({
      connection: "paused",
      reminder: null,
      consentExpiring: true,
    });
    await resumeStore(env.DB, seller.userId, seller.storeId);

    // Dopo la scadenza il negozio chiede il ricollegamento: avviso per trenta giorni, poi basta,
    // senza scollegamento automatico.
    await setExpiry(at);
    // Alla scadenza esatta il consenso non vale più.
    expect((await listStores(env.DB, seller.userId, at))[0]).toMatchObject({
      connection: "reconnect_required",
      reminder: { kind: "expired", at: at.toISOString() },
      consentExpiring: false,
    });
    expect(
      (await listStores(env.DB, seller.userId, new Date(at.getTime() + 29 * day)))[0],
    ).toMatchObject({
      connection: "reconnect_required",
      reminder: { kind: "expired", at: at.toISOString() },
      consentExpiring: false,
    });
    expect(
      (await listStores(env.DB, seller.userId, new Date(at.getTime() + 30 * day)))[0],
    ).toMatchObject({
      connection: "reconnect_required",
      reminder: null,
    });

    // Il rifiuto di eBay fa partire i trenta giorni dal rifiuto, anche prima della scadenza.
    await setExpiry(new Date(at.getTime() + 300 * day));
    await env.DB.prepare("UPDATE ebay_store_credentials SET rejected_at = ?")
      .bind(at.toISOString())
      .run();
    expect((await listStores(env.DB, seller.userId, at))[0]).toMatchObject({
      connection: "reconnect_required",
      reminder: { kind: "expired", at: at.toISOString() },
    });
    // Un negozio in pausa non legge eBay: nessun invito a ricollegarlo.
    await pauseStore(env.DB, seller.userId, seller.storeId, at);
    expect((await listStores(env.DB, seller.userId, at))[0]).toMatchObject({
      connection: "reconnect_required",
      pauseReasons: ["manual"],
      reminder: null,
    });
  });

  it("mostra in Ordini l'invito a ricollegare con il percorso del collegamento", async () => {
    const seller = await linkedSeller("invito@example.invalid");
    await env.DB.prepare("UPDATE ebay_store_credentials SET rejected_at = ?")
      .bind(new Date().toISOString())
      .run();
    const home = await homeFor(seller.cookie);
    expect(!home.notFound && home.page.notices).toEqual([
      { kind: "store-issue", storeId: seller.storeId, storeName: "venditore" },
    ]);
    // Ricollegare lo stesso account eBay toglie l'invito.
    await linkThroughEbay(seller.cookie);
    const after = await homeFor(seller.cookie);
    expect(!after.notFound && after.page.notices).toEqual([]);
  });

  it("la pausa manuale ferma letture e rinnovi, lascia i dati e si distingue da quella del piano", async () => {
    const seller = await linkedSeller("pausa@example.invalid");
    await env.DB.prepare("UPDATE ebay_store_credentials SET access_expires_at = ?")
      .bind(new Date().toISOString())
      .run();
    expect(await pauseStore(env.DB, seller.userId, seller.storeId)).toBe("done");
    expect(await pauseStore(env.DB, seller.userId, seller.storeId)).toBe("done");
    expect((await listStores(env.DB, seller.userId))[0]).toMatchObject({
      connection: "paused",
      pauseReasons: ["manual"],
    });
    expect(await listVisibleOrders(env.DB, seller.userId)).toHaveLength(1);
    const refresh = vi.fn<typeof fetch>();
    expect(await refreshExpiringTokens(env, refresh)).toEqual([]);

    // Ricollegare un negozio in pausa rinnova il consenso senza leggere ordini.
    await resetOrderFixtures();
    const ebay = syntheticEbay();
    await linkThroughEbay(seller.cookie, ebay);
    expect(ebay.mock.calls.map(([input]) => new URL(String(input)).pathname)).toEqual([
      "/identity/v1/oauth2/token",
      "/commerce/identity/v1/user/",
    ]);
    expect(await count("orders")).toBe(0);
    await linkThroughEbay(seller.cookie, syntheticEbay());
    expect(await count("orders")).toBe(0);

    // La pausa del piano toglie la consultazione e lo sblocco; riprendere toglie solo la manuale.
    await resumeStore(env.DB, seller.userId, seller.storeId);
    await linkThroughEbay(seller.cookie);
    await insertStorePause({ storeId: seller.storeId, reason: "plan" }).run();
    await pauseStore(env.DB, seller.userId, seller.storeId);
    expect(await listVisibleOrders(env.DB, seller.userId)).toEqual([]);
    await expect(grantImportedOrder(seller)).rejects.toThrow("order_not_available");
    expect(await resumeStore(env.DB, seller.userId, seller.storeId)).toBe("done");
    expect((await listStores(env.DB, seller.userId))[0]).toMatchObject({
      connection: "paused",
      pauseReasons: ["plan"],
    });
    expect(await refreshExpiringTokens(env, refresh)).toEqual([]);
    expect(refresh).not.toHaveBeenCalled();
    // Escluso dal piano resta in pausa anche con il consenso scaduto: ricollegarlo non lo
    // farebbe leggere.
    await env.DB.prepare("UPDATE ebay_store_credentials SET refresh_expires_at = ?")
      .bind(new Date(Date.parse(now) - 1000).toISOString())
      .run();
    expect((await listStores(env.DB, seller.userId))[0]).toMatchObject({ connection: "paused" });
  });

  it("scollega senza toccare quota, diritti e piano e ritrova lo stesso negozio al ricollegamento", async () => {
    const seller = await linkedSeller("scollega@example.invalid");
    await grantImportedOrder(seller);
    await env.DB.prepare(
      "INSERT INTO lifetime_allocations (slot, workspace_id, status, activated_at, created_at) VALUES (1, ?1, 'active', ?2, ?2)",
    )
      .bind(seller.workspaceId, now)
      .run();
    await pauseStore(env.DB, seller.userId, seller.storeId);

    expect(await disconnectStore(env.DB, seller.userId, seller.storeId)).toBe("done");
    expect((await listStores(env.DB, seller.userId))[0]).toMatchObject({
      connection: "disconnected",
      pauseReasons: [],
      consentExpiresAt: null,
      reminder: null,
    });
    expect(await count("ebay_store_credentials")).toBe(0);
    expect(await quotaUsed()).toBe(1);
    expect(await count("order_grants")).toBe(1);
    expect(await count("lifetime_allocations")).toBe(1);
    expect((await listVisibleOrders(env.DB, seller.userId))[0]).toMatchObject({
      fiscalState: "available",
    });
    // Un negozio scollegato non si mette in pausa.
    expect(await pauseStore(env.DB, seller.userId, seller.storeId)).toBe("invalid");

    await linkThroughEbay(seller.cookie);
    expect(await listStores(env.DB, seller.userId)).toMatchObject([
      { id: seller.storeId, connection: "active", pauseReasons: [] },
    ]);
    expect(await count("ebay_stores")).toBe(1);
    expect(await quotaUsed()).toBe(1);
    expect((await listVisibleOrders(env.DB, seller.userId))[0]).toMatchObject({
      fiscalState: "available",
    });
  });

  it("elimina i dati solo con il nome del negozio, senza restituire quota né resuscitarli", async () => {
    const seller = await linkedSeller("elimina@example.invalid");
    await grantImportedOrder(seller);
    // Il collegamento ha già registrato la lettura riuscita; si aggiunge un cursore.
    await env.DB.prepare(
      "UPDATE sync_state SET cursor = 'cursore', updated_at = ? WHERE store_id = ?",
    )
      .bind(now, seller.storeId)
      .run();
    expect(await count("sync_state")).toBe(1);
    expect(await count("sync_runs")).toBe(1);

    expect(await deleteStoreData(env.DB, seller.userId, seller.storeId, "altro nome")).toBe(
      "invalid",
    );
    expect(await count("orders")).toBe(1);
    expect(await count("ebay_store_credentials")).toBe(1);

    expect(await deleteStoreData(env.DB, seller.userId, seller.storeId, " venditore ")).toBe(
      "done",
    );
    for (const table of [
      "orders",
      "order_items",
      "tax_identifiers",
      "order_grants",
      "sync_state",
      "sync_runs",
      "ebay_store_credentials",
    ]) {
      expect(await count(table), table).toBe(0);
    }
    expect(await quotaUsed()).toBe(1);
    expect(
      await env.DB.prepare(
        "SELECT disconnected_at IS NOT NULL AS disconnected, data_deleted_at IS NOT NULL AS deleted FROM ebay_stores",
      ).first(),
    ).toEqual({ disconnected: 1, deleted: 1 });
    expect(await listStores(env.DB, seller.userId)).toEqual([]);

    // Ricollegare ritrova il negozio senza ripristinare l'ordine eliminato o la quota.
    await linkThroughEbay(seller.cookie);
    expect(await count("ebay_stores")).toBe(1);
    const orders = await listVisibleOrders(env.DB, seller.userId);
    expect(orders).toEqual([]);
    expect(await quotaUsed()).toBe(1);

    // Il negozio ricollegato resta utilizzabile per i nuovi ordini.
    expect((await listStores(env.DB, seller.userId))[0]).toMatchObject({
      id: seller.storeId,
      connection: "active",
    });
    await disconnectStore(env.DB, seller.userId, seller.storeId);
    expect((await listStores(env.DB, seller.userId))[0]).toMatchObject({
      connection: "disconnected",
    });
  });

  it("agisce solo sui negozi del proprio spazio", async () => {
    const seller = await linkedSeller("proprio@example.invalid");
    const other = await verifiedSession("estraneo@example.invalid");
    expect(await pauseStore(env.DB, other.userId, seller.storeId)).toBe("not_found");
    expect(await resumeStore(env.DB, other.userId, seller.storeId)).toBe("not_found");
    expect(await disconnectStore(env.DB, other.userId, seller.storeId)).toBe("not_found");
    expect(await deleteStoreData(env.DB, other.userId, seller.storeId, "venditore")).toBe(
      "not_found",
    );
    expect(await listStores(env.DB, other.userId)).toEqual([]);
    expect((await listStores(env.DB, seller.userId))[0]!.connection).toBe("active");
    expect(await count("orders")).toBe(1);
  });

  it("un rinnovo o un import partiti prima dello scollegamento non ripristinano token né dati", async () => {
    const seller = await linkedSeller("concorrenza@example.invalid");
    const refreshed = vi.fn<typeof fetch>(async () => {
      await disconnectStore(env.DB, seller.userId, seller.storeId);
      return Response.json({ access_token: "tardivo", expires_in: 7200 });
    });
    expect(await refreshStoreToken({ env, storeId: seller.storeId, fetcher: refreshed })).toBe(
      "superseded",
    );
    expect(await count("ebay_store_credentials")).toBe(0);

    // Un rifiuto arrivato dopo il ricollegamento non segna come scaduto il nuovo consenso.
    await linkThroughEbay(seller.cookie);
    const rejected = vi.fn<typeof fetch>(async () => {
      await linkThroughEbay(seller.cookie);
      return Response.json({ error: "invalid_grant" }, { status: 400 });
    });
    expect(await refreshStoreToken({ env, storeId: seller.storeId, fetcher: rejected })).toBe(
      "superseded",
    );
    expect((await listStores(env.DB, seller.userId))[0]!.connection).toBe("active");

    // L'eliminazione dei dati durante la lettura del primo ordine vince sull'import.
    await env.DB.prepare("DELETE FROM orders").run();
    const ebay = syntheticEbay();
    const read = ebay.getMockImplementation()!;
    ebay.mockImplementation(async (input, init) => {
      if (String(input).includes("/sell/fulfillment/v1/order")) {
        await deleteStoreData(env.DB, seller.userId, seller.storeId, "venditore");
      }
      return read(input, init);
    });
    await linkThroughEbay(seller.cookie, ebay);
    expect(await count("orders")).toBe(0);
    expect(await count("tax_identifiers")).toBe(0);
    expect(await count("sync_state")).toBe(0);
  });

  function storesPage(path: string, cookie: string) {
    return callRoute(loadStores, path, { cookie, params: { negozio: path.split("/negozi/")[1] } });
  }

  function storeForm(cookie: string, fields: Record<string, string>, origin = testOrigin) {
    return callRoute(storesAction, "/app/negozi", { cookie, origin, fields });
  }

  it("mostra elenco e pannello del negozio con i soli dati posseduti e il piano dello spazio", async () => {
    const seller = await linkedSeller("schermata@example.invalid");
    const list = await storesPage("/app/negozi", seller.cookie);
    expect(list.init?.status).toBe(200);
    expect(list.data.page).toMatchObject({
      detail: null,
      account: { plan: "free" },
      connectHref: "/app/negozi/collega",
      stores: [
        {
          id: seller.storeId,
          name: "venditore",
          connection: "active",
          importedOrders: 1,
          // Storico reale dal primo avvio, cadenza del piano Free e letture effettive.
          targetMinutes: 30,
          historyDays: 30,
          importing: false,
          recent: [{ ok: true, newOrders: 1 }],
          notifications: null,
        },
      ],
    });
    expect(list.data.page.stores[0]!.lastSyncAt).not.toBeNull();
    // Il marketplace pertinente viene dagli ordini del negozio; senza, la riga non lo indica.
    await env.DB.prepare("UPDATE orders SET marketplace_id = 'EBAY_DE'").run();
    expect((await storesPage("/app/negozi", seller.cookie)).data.page.stores[0]).toMatchObject({
      marketplace: "EBAY_DE",
    });
    await env.DB.prepare("UPDATE orders SET marketplace_id = NULL").run();
    expect(
      (await storesPage("/app/negozi", seller.cookie)).data.page.stores[0]!.marketplace,
    ).toBeNull();

    // Link diretto e refresh del pannello, anche in inglese.
    const detail = await storesPage(`/en/app/negozi/${seller.storeId}`, seller.cookie);
    expect(detail.data).toMatchObject({
      language: "en",
      notFound: false,
      page: { detail: { id: seller.storeId }, connectHref: "/en/app/negozi/collega" },
    });

    // Un negozio di un altro spazio risponde come uno inesistente, dentro la shell.
    const other = await verifiedSession("altro-spazio-schermata@example.invalid");
    const foreign = await storesPage(`/app/negozi/${seller.storeId}`, other.cookie);
    expect(foreign.init?.status).toBe(404);
    expect(foreign.data).toMatchObject({ notFound: true, page: { stores: [], detail: null } });

    // Senza sessione si torna all'accesso.
    const anonymous = await routeResponse(loadStores, "/app/negozi");
    expect(anonymous.status).toBe(302);
    expect(anonymous.headers.get("location")).toBe("/accesso");
  });

  it("esegue pausa, ripresa, scollegamento ed eliminazione dalla schermata con origine e sessione", async () => {
    const seller = await linkedSeller("azioni-schermata@example.invalid");
    const foreignOrigin = await storeForm(
      seller.cookie,
      { intent: "store-pause", store: seller.storeId },
      "https://esempio.invalid",
    ).catch((response: Response) => response);
    expect((foreignOrigin as Response).status).toBe(403);
    expect(await count("ebay_store_pauses")).toBe(0);

    expect(
      await storeForm(seller.cookie, { intent: "store-pause", store: seller.storeId }),
    ).toEqual({ ok: true, notice: "Negozio in pausa." });
    let [store] = (await storesPage("/app/negozi", seller.cookie)).data.page.stores;
    expect(store).toMatchObject({ connection: "paused", pauseReason: "manual" });

    await storeForm(seller.cookie, { intent: "store-resume", store: seller.storeId });
    await storeForm(seller.cookie, { intent: "store-disconnect", store: seller.storeId });
    [store] = (await storesPage("/app/negozi", seller.cookie)).data.page.stores;
    expect(store).toMatchObject({
      connection: "disconnected",
      connectedAt: null,
      consentExpiresAt: null,
      importedOrders: 1,
    });

    const other = await verifiedSession("estraneo-schermata@example.invalid");
    const foreign = await storeForm(other.cookie, {
      intent: "store-delete",
      store: seller.storeId,
      conferma: "venditore",
    });
    expect((foreign as { init: ResponseInit }).init.status).toBe(404);

    const mismatch = await storeForm(seller.cookie, {
      intent: "store-delete",
      store: seller.storeId,
      conferma: "altro",
    });
    expect((mismatch as { init: ResponseInit }).init.status).toBe(409);
    expect(await count("orders")).toBe(1);

    const removed = await storeForm(seller.cookie, {
      intent: "store-delete",
      store: seller.storeId,
      conferma: "venditore",
    });
    expect((removed as Response).status).toBe(303);
    expect((removed as Response).headers.get("location")).toBe("/app/negozi?negozio=eliminato");
    const after = await storesPage("/app/negozi?negozio=eliminato", seller.cookie);
    expect(after.data.page.stores).toEqual([]);
    expect(after.data.notice).toMatchObject({
      text: "Negozio eliminato da FiscalBay.",
      tone: "success",
    });
    const removedDetail = await storesPage(`/app/negozi/${seller.storeId}`, seller.cookie);
    expect(removedDetail.init?.status).toBe(404);

    const unknown = await storeForm(seller.cookie, {
      intent: "store-refresh",
      store: seller.storeId,
    });
    expect((unknown as { init: ResponseInit }).init.status).toBe(400);
  });

  it("chiede letture e reimportazione dalla schermata con l'esito della richiesta", async () => {
    const seller = await linkedSeller("letture-schermata@example.invalid");
    const send = vi.spyOn(env.WORK_QUEUE, "send").mockResolvedValue(queued);
    try {
      expect(
        await storeForm(seller.cookie, { intent: "store-sync", store: seller.storeId }),
      ).toEqual({
        ok: true,
        notice: "Sincronizzazione richiesta: i nuovi ordini compaiono appena eBay risponde.",
      });
      expect(
        await storeForm(seller.cookie, { intent: "store-sync", store: seller.storeId }),
      ).toEqual({ ok: true, notice: "Sincronizzazione già richiesta: parte appena possibile." });
      expect(send).toHaveBeenCalledExactlyOnceWith({ syncStore: seller.storeId });
      const [store] = (await storesPage("/app/negozi", seller.cookie)).data.page.stores;
      expect(store).toMatchObject({ syncing: false, targetMinutes: 30 });

      // Lo storico importato al collegamento si può reimportare; mentre riparte, no.
      expect(
        await storeForm(seller.cookie, { intent: "store-reimport", store: seller.storeId }),
      ).toEqual({ ok: true, notice: "Reimportazione dello storico richiesta." });
      expect(
        await storeForm(seller.cookie, { intent: "store-reimport", store: seller.storeId }),
      ).toEqual({ ok: true, notice: "L’importazione dello storico è già in corso." });

      const other = await verifiedSession("estraneo-letture@example.invalid");
      const foreign = await storeForm(other.cookie, {
        intent: "store-sync",
        store: seller.storeId,
      });
      expect((foreign as { init: ResponseInit }).init.status).toBe(404);
      await storeForm(seller.cookie, { intent: "store-pause", store: seller.storeId });
      const paused = await storeForm(seller.cookie, {
        intent: "store-sync",
        store: seller.storeId,
      });
      expect((paused as { init: ResponseInit }).init.status).toBe(409);
      expect(send).toHaveBeenCalledOnce();
    } finally {
      send.mockRestore();
    }
  });

  it("aggiorna il profilo minimo senza cambiare il tipo di account", async () => {
    const seller = await verifiedSession("profilo@example.invalid");
    // Il vecchio indirizzo del profilo porta alla sua categoria delle Impostazioni.
    for (const [path, target] of [
      ["/app/profilo", "/app/impostazioni/profilo"],
      ["/en/app/profilo", "/en/app/impostazioni/profilo"],
    ]) {
      const moved = await routeResponse(loadProfile, path);
      expect(moved.status).toBe(302);
      expect(moved.headers.get("location")).toBe(target);
    }
    const loaded = await routeData(loadSettings, "/en/app/impostazioni/profilo", {
      cookie: seller.cookie,
      params: { sezione: "profilo" },
    });
    expect(loaded).toMatchObject({
      language: "en",
      page: {
        section: "profilo",
        account: {
          name: "Utente Sintetico",
          email: "profilo@example.invalid",
          profile: syntheticProfile,
        },
      },
    });

    const save = (fields: Record<string, string>, origin = testOrigin) =>
      callRoute(settingsAction, "/app/impostazioni/profilo", {
        cookie: seller.cookie,
        origin,
        fields: { intent: "profile", ...fields },
      });

    const foreign = await save({ nome: "Altro", cognome: "Nome" }, "https://esempio.invalid").catch(
      (response: Response) => response,
    );
    expect((foreign as Response).status).toBe(403);
    const invalid = await save({ nome: " ", cognome: "Nome" });
    expect((invalid as { init: ResponseInit }).init.status).toBe(400);

    expect(
      await save({ nome: "Nuovo", cognome: "Nome", tipo: "azienda", ragione_sociale: "Ditta" }),
    ).toEqual({ ok: true, notice: "Profilo aggiornato." });
    expect(await profileOf(seller.userId)).toEqual({
      first_name: "Nuovo",
      last_name: "Nome",
      account_type: "private",
      company_name: null,
    });
    const user = await env.DB.prepare('SELECT name FROM "user" WHERE id = ?')
      .bind(seller.userId)
      .first();
    expect(user).toEqual({ name: "Nuovo Nome" });
  });

  const origin = "http://localhost:5173";
  const settings = (cookie: string, path = "/app/impostazioni", sezione?: string) =>
    callRoute(loadSettings, path, { cookie, params: { sezione } }).catch((thrown: unknown) => {
      if (thrown instanceof Response) return thrown;
      throw thrown;
    });
  const settingsPage = async (cookie: string) => {
    const loaded = await settings(cookie);
    if (loaded instanceof Response || !("page" in loaded)) throw new Error("pagina attesa");
    return loaded;
  };
  const saveSetting = (cookie: string, fields: Record<string, string>, from = origin) =>
    callRoute(settingsAction, "/app/impostazioni", { cookie, origin: from, fields }).catch(
      (thrown: unknown) => thrown,
    );

  it("apre le Impostazioni reali con le sole categorie che hanno un servizio", async () => {
    const seller = await verifiedSession("impostazioni@example.invalid");
    const loaded = await settingsPage(seller.cookie);
    expect(loaded.page).toMatchObject({
      section: null,
      sections: [
        "notifiche",
        "esportazione",
        "messaggio",
        "profilo",
        "piano",
        "sicurezza",
        "privacy",
        "aspetto",
        "supporto",
      ],
      // Con chiave e prezzi Stripe configurati il piano offre acquisto e portale clienti; con il
      // bot dell'ambiente compaiono le notifiche Telegram.
      services: {
        billing: true,
        billingPortal: true,
        telegram: true,
        accountExport: true,
        accountDeletion: true,
        support: true,
      },
      account: { plan: "free", trialAvailable: false, quota: undefined },
      preferences: { theme: "system", timeZone: "auto", detectedTimeZone: null, marketing: false },
      // Senza negozi il riepilogo lo dice; la versione viene dal deploy.
      diagnostics: {
        version: expect.any(String),
        storeRef: null,
        syncPhase: "Nessun negozio collegato",
        errorCode: null,
        rights: "Free",
        correlationId: expect.stringMatching(/^[0-9a-f-]{36}$/u),
      },
      // L'elenco delle Novità versionato è vuoto: Supporto non collega la pagina.
      whatsNew: false,
    });
    expect(loaded.page.preferences.templates.it).toContain("{ordine}");
    const missing = await settings(seller.cookie, "/app/impostazioni/inesistente", "inesistente");
    expect(missing).toMatchObject({ init: { status: 404 }, data: { notFound: true } });
    // Senza email confermata l'area rimanda agli Ordini, che spiegano come proseguire.
    await env.DB.prepare('UPDATE "user" SET "emailVerified" = 0 WHERE id = ?')
      .bind(seller.userId)
      .run();
    expect(((await settings(seller.cookie)) as Response).headers.get("location")).toBe(
      "/app/ordini",
    );
  });

  it("la quota personale mostra il proprio ciclo e la quota diversa del ciclo seguente", async () => {
    // Primo collegamento il 13 settembre alle 20:00 UTC; la promozione finisce il 15.
    vi.setSystemTime(new Date(now));
    await env.DB.prepare(
      `INSERT INTO free_promotions (id, starts_at, ends_at, quota, created_at)
       VALUES ('lancio', '2026-09-01T00:00:00.000Z', '2026-09-15T00:00:00.000Z', 10, ?1)`,
    )
      .bind(now)
      .run();
    const seller = await linkedSeller("promozione@example.invalid");
    expect((await settingsPage(seller.cookie)).page.account.quota).toEqual({
      used: 0,
      limit: 10,
      cycleEndsAt: "2026-09-20T20:00:00.000Z",
      nextLimit: 5,
    });
    // Il ciclo seguente inizia dopo la promozione e torna alla quota base.
    vi.setSystemTime(new Date("2026-09-20T20:00:00.000Z"));
    expect((await settingsPage(seller.cookie)).page.account.quota).toEqual({
      used: 0,
      limit: 5,
      cycleEndsAt: "2026-09-27T20:00:00.000Z",
    });
    expect(appCopy.it.settings.plan.nextCycleLimit(5)).toBe("Il prossimo ciclo avrà 5 sblocchi.");
  });

  it("salva tema, fuso e consenso a ogni scelta e rifiuta valori non ammessi", async () => {
    const seller = await verifiedSession("scelte@example.invalid");
    const save = (name: string, value: string) =>
      saveSetting(seller.cookie, { intent: "save", name, value });
    expect(await save("theme", "dark")).toEqual({ ok: true });
    expect(await save("time-zone", "America/New_York")).toEqual({ ok: true });
    expect(await save("marketing", "true")).toEqual({ ok: true });
    for (const [name, value] of [
      ["theme", "sepia"],
      ["time-zone", "Mars/Olympus"],
      ["marketing", "forse"],
      ["language", "en"],
      ["telegram", "forse"],
    ]) {
      expect(await save(name, value)).toMatchObject({ init: { status: 400 }, data: { ok: false } });
    }
    const foreign = await saveSetting(
      seller.cookie,
      { intent: "save", name: "theme", value: "light" },
      "https://estraneo.invalid",
    );
    expect((foreign as Response).status).toBe(403);
    const loaded = await settingsPage(seller.cookie);
    expect(loaded.page.preferences).toMatchObject({
      theme: "dark",
      timeZone: "America/New_York",
      marketing: true,
    });
    // Tema e fuso valgono in tutta l'area, con le date nel fuso scelto.
    expect((await areaShell(seller.cookie)).display).toEqual({
      theme: "dark",
      timeZone: "America/New_York",
    });
    expect(await save("theme", "system")).toEqual({ ok: true });
    expect(await save("marketing", "false")).toEqual({ ok: true });
    expect(
      await env.DB.prepare("SELECT theme, time_zone FROM user_preferences WHERE user_id = ?")
        .bind(seller.userId)
        .first(),
    ).toEqual({ theme: null, time_zone: "America/New_York" });
    // Ogni scelta del consenso resta come prova; vale l'ultima.
    const { results } = await env.DB.prepare(
      "SELECT granted, text_version, language FROM marketing_consents WHERE user_id = ? ORDER BY rowid",
    )
      .bind(seller.userId)
      .all();
    expect(results).toEqual([
      { granted: 0, text_version: marketingTextVersions.registration, language: "it" },
      { granted: 1, text_version: marketingTextVersions.settings, language: "it" },
      { granted: 0, text_version: marketingTextVersions.settings, language: "it" },
    ]);
    expect((await settingsPage(seller.cookie)).page.preferences.marketing).toBe(false);
  });

  describe("modulo di assistenza", () => {
    const request = (cookie: string, fields: Record<string, string> = {}) =>
      saveSetting(cookie, {
        intent: "support",
        topic: "stores",
        message: "Il negozio non si aggiorna.",
        diagnostics: "true",
        ...fields,
      });
    // Un solo sostituto per il gruppo: ogni prova riparte da un elenco di invii vuoto.
    let send: MockInstance<SendEmail["send"]>;
    beforeAll(() => {
      send = vi.spyOn(env.AUTH_EMAIL, "send");
    });
    beforeEach(() => {
      send.mockReset();
      send.mockResolvedValue({ messageId: "synthetic" });
    });
    afterAll(() => send.mockRestore());
    // Anche la conferma dell'email della registrazione passa dallo stesso invio.
    const toSupport = () =>
      send.mock.calls
        .map(([message]) => message as Sent)
        .filter((message) => message.to === supportEmail);
    type Sent = { from: unknown; to: string; replyTo: string; subject: string; text: string };

    it("invia a supporto@ il messaggio con il riepilogo del solo spazio dell'utente", async () => {
      const seller = await linkedSeller("assistenza@example.invalid");
      await env.DB.batch(
        insertWorkspace({ id: "w-altro", name: "Altro", createdAt: new Date().toISOString() }),
      );
      await insertStore({ id: "negozio-altrui", workspaceId: "w-altro" }).run();
      // Senza lo storico delle ultime letture vale l'ultima riuscita, mai «in attesa».
      await env.DB.prepare("DELETE FROM sync_runs").run();
      const shown = (await settingsPage(seller.cookie)).page.diagnostics;
      expect(shown).toEqual({
        version: expect.any(String),
        storeRef: seller.storeId,
        syncPhase: expect.stringMatching(/^Aggiornamento riuscito, /u),
        errorCode: null,
        rights: expect.stringMatching(/^Free/u),
        correlationId: expect.stringMatching(/^[0-9a-f-]{36}$/u),
      });
      // Il modulo invia il riferimento che mostra: l'assistenza riceve lo stesso.
      expect(
        await request(seller.cookie, {
          message: " Riga\u0007 uno\r\nRiga due ",
          reference: shown!.correlationId,
        }),
      ).toEqual({ ok: true });
      const [sent] = toSupport();
      expect(sent!).toMatchObject({
        from: { email: expect.stringMatching(/^noreply@/u), name: "FiscalBay" },
        to: supportEmail,
        replyTo: "assistenza@example.invalid",
        subject: "Assistenza FiscalBay (localhost:5173): Collegamento negozi",
      });
      const [head, summary] = sent!.text.split("\n--\n");
      expect(head).toBe(
        [
          "Argomento: Collegamento negozi",
          `Account: ${seller.userId}`,
          "Email: assistenza@example.invalid",
          "Lingua: it",
          "",
          "Riga uno\nRiga due",
          "",
        ].join("\n"),
      );
      // Soltanto i campi allowlistati, riletti sul server: niente nomi eBay, ordini o altri spazi.
      expect(summary!.split("\n").map((line) => line.split(": ")[0])).toEqual([
        "Versione",
        "Negozio",
        "Sincronizzazione",
        "Codice errore",
        "Piano",
        "Riferimento",
      ]);
      expect(summary).toContain(`Negozio: ${seller.storeId}`);
      expect(summary).toContain(`Riferimento: ${shown!.correlationId}`);
      expect(sent!.text).not.toMatch(/negozio-altrui|venditore/u);
      expect(await count("support_requests")).toBe(1);
      // Un riferimento senza la forma di un correlation ID non entra nell'email: vale quello
      // dell'invio.
      expect(await request(seller.cookie, { reference: "riferimento<inventato>" })).toEqual({
        ok: true,
      });
      expect(toSupport()[1]!.text).toMatch(/\nRiferimento: [\da-f]{8}-[\da-f-]{27}$/u);
      expect(toSupport()[1]!.text).not.toContain("inventato");
    });

    it("il modulo allega il riepilogo dalla casella spuntata, con il riferimento mostrato", () => {
      // La casella spuntata vale «on», come la invia il browser.
      const form = (checked: boolean) => {
        const data = new FormData();
        if (checked) data.set("diagnostics", "on");
        return data;
      };
      const reference = "c0a8f3e1-5b2d-4e7a-9c11-7d2f0b6e4a90";
      const input = { topic: "orders", message: "Testo", reference };
      expect(supportFields(form(true), input)).toEqual({
        topic: "orders",
        message: "Testo",
        diagnostics: "true",
        reference,
      });
      expect(supportFields(form(false), input)).toEqual({
        topic: "orders",
        message: "Testo",
        diagnostics: "false",
      });
      // Senza riepilogo mostrato non c'è nulla da allegare.
      expect(supportFields(form(true), { ...input, reference: null })).toMatchObject({
        diagnostics: "false",
      });
    });

    it("con il riepilogo non leggibile la richiesta parte lo stesso", async () => {
      const seller = await linkedSeller("senza-riepilogo@example.invalid");
      const prepare = env.DB.prepare.bind(env.DB);
      const statement = vi.spyOn(env.DB, "prepare").mockImplementation((query: string) => {
        // La lettura dei negozi, riconosciuta da una colonna che soltanto lei calcola.
        if (query.includes("AS inactive_since")) throw new Error("synthetic");
        return prepare(query);
      });
      const errors = vi.spyOn(console, "error").mockImplementation(() => {});
      expect((await settingsPage(seller.cookie)).page.diagnostics).toBeNull();
      expect(await request(seller.cookie)).toEqual({ ok: true });
      expect(toSupport()[0]!.text).toContain(
        "Riepilogo diagnostico non disponibile al momento dell'invio.",
      );
      expect(errors).toHaveBeenCalled();
      for (const spy of [errors, statement]) spy.mockRestore();
    });

    it("rifiuta richieste non valide, limita gli invii e non conta quelli non riusciti", async () => {
      const seller = await verifiedSession("limite@example.invalid");
      const t = appCopy.it.settings.support;
      expect(await request(seller.cookie, { diagnostics: "false" })).toEqual({ ok: true });
      expect(toSupport()[0]!.text).toContain("Riepilogo diagnostico non allegato.");
      // Il messaggio al limite esatto parte intero; un carattere in più no.
      const longest = "x".repeat(maxSupportMessage);
      expect(await request(seller.cookie, { message: longest })).toEqual({ ok: true });
      expect(toSupport()[1]!.text).toContain(`\n${longest}\n`);
      const invalid: Record<string, string>[] = [
        { topic: "spam" },
        { message: " \n " },
        { message: "x".repeat(4001) },
      ];
      for (const fields of invalid)
        expect(await request(seller.cookie, fields)).toMatchObject({
          init: { status: 400 },
          data: { ok: false, notice: t.invalid },
        });
      // Un rifiuto del provider resta nei log con il suo codice e non consuma il limite.
      let refused = false;
      send.mockImplementation(async (message) => {
        if (refused || (message as Sent).to !== supportEmail) return { messageId: "synthetic" };
        refused = true;
        throw Object.assign(new Error("synthetic"), { code: "E_RATE_LIMIT_EXCEEDED" });
      });
      const errors = vi.spyOn(console, "error").mockImplementation(() => {});
      expect(await request(seller.cookie)).toMatchObject({
        init: { status: 503 },
        data: { ok: false, notice: t.sendFailed },
      });
      expect(errors.mock.calls.join("\n")).toContain('"failure":"E_RATE_LIMIT_EXCEEDED"');
      for (let sent = 2; sent < supportRequestLimit; sent++)
        expect(await request(seller.cookie)).toEqual({ ok: true });
      expect(await request(seller.cookie)).toMatchObject({
        init: { status: 429 },
        data: { ok: false, notice: t.limited },
      });
      expect(toSupport()).toHaveLength(supportRequestLimit + 1);
      // La manutenzione elimina gli istanti oltre le 24 ore.
      await purgeExpiredRecords(env.DB, new Date(Date.now() + day + 1000));
      expect(await count("support_requests")).toBe(0);
      errors.mockRestore();
    });
  });

  it("salva il modello di messaggio con Salva e lo usa negli Ordini per lingua", async () => {
    const seller = await verifiedSession("modello@example.invalid");
    const { templates } = (await settingsPage(seller.cookie)).page.preferences;
    const save = (it: string, en: string) =>
      saveSetting(seller.cookie, { intent: "template", it, en });
    expect(await save(" Ciao, mi serve il CF per {ordine}. ", templates.en)).toEqual({ ok: true });
    const home = await homeFor(seller.cookie);
    expect(!home.notFound && home.page.messageTemplates).toEqual({
      it: "Ciao, mi serve il CF per {ordine}.",
      en: templates.en,
    });
    // Il testo predefinito non si conserva: segue le sue revisioni.
    expect(
      await env.DB.prepare(
        "SELECT template_it, template_en FROM user_preferences WHERE user_id = ?",
      )
        .bind(seller.userId)
        .first(),
    ).toEqual({ template_it: "Ciao, mi serve il CF per {ordine}.", template_en: null });
    for (const [it, en] of [
      ["  ", templates.en],
      ["x".repeat(2001), templates.en],
      [templates.it, ""],
    ]) {
      expect(await save(it!, en!)).toMatchObject({
        init: { status: 400 },
        data: { ok: false, notice: expect.stringContaining("2.000") },
      });
    }
    expect((await settingsPage(seller.cookie)).page.preferences.templates.it).toBe(
      "Ciao, mi serve il CF per {ordine}.",
    );
  });

  it("ricorda la lingua scelta e riapre l'area in quella lingua anche al nuovo accesso", async () => {
    const seller = await verifiedSession("lingua@example.invalid");
    const choose = (language: string, returnTo: string, from = origin) =>
      routeResponse(languageAction, "/app/lingua", {
        cookie: seller.cookie,
        origin: from,
        fields: { language, returnTo },
      });
    const moved = await choose("en", "/app/impostazioni/aspetto?x=1");
    expect(moved.status).toBe(303);
    expect(moved.headers.get("location")).toBe("/en/app/impostazioni/aspetto?x=1");
    // Le pagine dell'area aperte in italiano, anche da un nuovo accesso, seguono la scelta.
    const home = await homeFor(seller.cookie).catch((thrown: Response) => thrown);
    expect((home as Response).headers.get("location")).toBe("/en/app/ordini");
    expect(await settings(seller.cookie, "/en/app/impostazioni")).toMatchObject({
      language: "en",
    });
    // Si torna soltanto a una pagina dell'area; altrimenti agli Ordini.
    for (const target of [
      "https://estraneo.invalid/app/ordini",
      "/accesso",
      "//estraneo.invalid",
    ]) {
      expect((await choose("it", target)).headers.get("location")).toBe("/app/ordini");
    }
    expect((await choose("de", "/app/ordini")).status).toBe(400);
    expect((await choose("en", "/app/ordini", "https://estraneo.invalid")).status).toBe(403);
  });

  it("segue il fuso del dispositivo finché non se ne sceglie uno", async () => {
    const seller = await verifiedSession("fuso@example.invalid");
    const withZone = (cookie: string) =>
      settings(`${seller.cookie}; ${cookie}`).then((loaded) => {
        if (loaded instanceof Response || !("page" in loaded)) throw new Error("pagina attesa");
        return loaded;
      });
    const detected = await withZone("fiscalbay_fuso=Asia%2FTokyo");
    expect(detected.page.preferences).toMatchObject({
      timeZone: "auto",
      detectedTimeZone: "Asia/Tokyo",
    });
    expect(
      (await areaShell(`${seller.cookie}; fiscalbay_fuso=Asia%2FTokyo`)).display.timeZone,
    ).toBe("Asia/Tokyo");
    // Un valore non riconosciuto vale Roma, senza rompere le date.
    for (const cookie of ["fiscalbay_fuso=Mars%2FOlympus", "fiscalbay_fuso=..%2Fx"]) {
      expect((await areaShell(`${seller.cookie}; ${cookie}`)).display.timeZone).toBe("Europe/Rome");
    }
    // Un fuso scelto vale più di quello del dispositivo; «auto» torna al rilevamento.
    const save = (value: string) =>
      saveSetting(seller.cookie, { intent: "save", name: "time-zone", value });
    expect(await save("Europe/London")).toEqual({ ok: true });
    expect(
      (await areaShell(`${seller.cookie}; fiscalbay_fuso=Asia%2FTokyo`)).display.timeZone,
    ).toBe("Europe/London");
    expect(await save("auto")).toEqual({ ok: true });
    expect(
      await env.DB.prepare("SELECT time_zone FROM user_preferences WHERE user_id = ?")
        .bind(seller.userId)
        .first(),
    ).toEqual({ time_zone: null });
    expect(
      (await areaShell(`${seller.cookie}; fiscalbay_fuso=Asia%2FTokyo`)).display.timeZone,
    ).toBe("Asia/Tokyo");
  });

  it("chiude dopo una passkey soltanto la sessione precedente dello stesso utente", async () => {
    const seller = await verifiedSession("precedente@example.invalid");
    const other = await verifiedSession("estraneo.precedente@example.invalid");
    const ids = async (userId: string) =>
      (
        await env.DB.prepare('SELECT id FROM "session" WHERE "userId" = ? ORDER BY "createdAt"')
          .bind(userId)
          .all<{ id: string }>()
      ).results.map((row) => row.id);
    const [foreign] = await ids(other.userId);
    expect(await revokeSession(env.DB, seller.userId, foreign!)).toBe(false);
    expect(await revokeSession(env.DB, seller.userId, "inesistente")).toBe(false);
    expect(await ids(other.userId)).toEqual([foreign]);
    const confirm = (precedente: string) =>
      callRoute(settingsAction, "/app/impostazioni/sicurezza", {
        cookie: seller.cookie,
        fields: { intent: "conferma-accesso", metodo: "passkey", precedente },
      }) as Promise<{ data: { ok: boolean } }>;
    // La sessione di un altro utente non conferma nulla e resta aperta.
    expect((await confirm(foreign!)).data.ok).toBe(false);
    expect(await ids(other.userId)).toEqual([foreign]);
    // La propria sessione si chiude.
    const [previous] = await ids(seller.userId);
    expect(await revokeSession(env.DB, seller.userId, previous!)).toBe(true);
    expect(await ids(seller.userId)).not.toContain(previous);
  });

  it("conferma l'identità sul posto con la password senza uscire", async () => {
    const seller = await verifiedSession("conferma@example.invalid");
    const before = await env.DB.prepare('SELECT id FROM "session" WHERE "userId" = ?')
      .bind(seller.userId)
      .all<{ id: string }>();
    const confirm = (fields: Record<string, string>) =>
      callRoute(settingsAction, "/app/impostazioni/sicurezza", {
        cookie: seller.cookie,
        fields: { intent: "conferma-accesso", ...fields },
      }) as Promise<{ data: { ok: boolean; notice?: string }; init: ResponseInit }>;
    const wrong = await confirm({ metodo: "password", password: "non-questa" });
    expect(wrong.data).toEqual({
      ok: false,
      notice: "Conferma non riuscita. Controlla la password e riprova.",
    });
    expect((wrong.init.headers as Headers).getSetCookie()).toEqual([]);
    expect((await confirm({ metodo: "altro" })).data.ok).toBe(false);
    const right = await confirm({
      metodo: "password",
      password: "Una-password-negozio-molto-lunga",
    });
    expect(right.data).toEqual({ ok: true });
    // La sessione nuova sostituisce quella in uso, che si chiude.
    expect((right.init.headers as Headers).getSetCookie().join(";")).toContain("session_token");
    const after = await env.DB.prepare('SELECT id FROM "session" WHERE "userId" = ?')
      .bind(seller.userId)
      .all<{ id: string }>();
    expect(after.results).toHaveLength(before.results.length);
    expect(after.results.map((row) => row.id)).not.toEqual(before.results.map((row) => row.id));
  });

  it("mostra nella campanella i collegamenti da ricollegare e ricorda le letture", async () => {
    const seller = await linkedSeller("campanella@example.invalid");
    const expired = new Date(Date.now() - 2 * day).toISOString();
    await env.DB.prepare("UPDATE ebay_store_credentials SET rejected_at = ?").bind(expired).run();
    const bell = async () => (await areaShell(seller.cookie)).notifications!;
    const [notification] = await bell();
    expect(await bell()).toEqual([
      {
        id: `store-expired:${seller.storeId}:${expired}`,
        tone: "warning",
        title: "Collegamento scaduto",
        body: "venditore: la sincronizzazione è sospesa. Ricollega il negozio.",
        at: expired,
        read: false,
        href: `negozi/${seller.storeId}`,
      },
    ]);
    const read = (ids: string, from = origin) =>
      routeResponse(notificationsAction, "/api/v1/notifications", {
        cookie: seller.cookie,
        origin: from,
        fields: { ids },
      });
    expect((await read(notification!.id)).status).toBe(200);
    expect((await read(notification!.id)).status).toBe(200);
    expect(await bell()).toEqual([{ ...notification, read: true }]);
    for (const ids of ["", "nessun-prefisso", Array(51).fill("store-x:1").join(",")]) {
      expect((await read(ids)).status).toBe(400);
    }
    expect((await read(notification!.id, "https://estraneo.invalid")).status).toBe(403);
    // Un consenso in scadenza compare con la data nel fuso scelto.
    await env.DB.prepare(
      "UPDATE ebay_store_credentials SET rejected_at = NULL, refresh_expires_at = ?",
    )
      .bind(new Date(Date.now() + 10 * day).toISOString().slice(0, 10) + "T03:00:00.000Z")
      .run();
    await saveSetting(seller.cookie, {
      intent: "save",
      name: "time-zone",
      value: "America/New_York",
    });
    const [expiring] = await bell();
    expect(expiring).toMatchObject({
      tone: "warning",
      title: "Autorizzazione in scadenza",
      read: false,
    });
    const expiry = new Date(Date.now() + 10 * day);
    const previousDay = new Date(expiry.getTime() - day);
    expect(expiring!.body).toContain(
      new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeZone: "UTC" })
        .format(previousDay)
        .replace("Sept", "Sep"),
    );
    // Una lettura, anche di una notifica non più attuale, resta finché la notifica può comparire, cioè trenta giorni.
    await purgeExpiredRecords(env.DB, new Date(Date.now() + 29 * day));
    expect(await count("notification_reads")).toBe(1);
    await purgeExpiredRecords(env.DB, new Date(Date.now() + 31 * day));
    expect(await count("notification_reads")).toBe(0);
  });

  describe("negozio attivo del Free e downgrade", () => {
    const iso = (at: number) => new Date(at).toISOString();

    /** Venditore con il negozio collegato da eBay e un secondo negozio collegato dopo. */
    async function twoStores(email: string) {
      const seller = await linkedSeller(email);
      await insertStore({
        id: "secondo",
        workspaceId: seller.workspaceId,
        linkedAt: iso(Date.now() + 60_000),
      }).run();
      return seller;
    }

    async function addOrder(id: string, storeId: string, created: number, retained?: number) {
      await env.DB.prepare(
        `INSERT INTO orders (id, store_id, ebay_order_id, creation_time, last_modified_time,
           currency, total_minor, retention_until, purge_after)
         VALUES (?1, ?2, ?1, ?3, ?3, 'EUR', 100, ?4, ?4)`,
      )
        .bind(id, storeId, iso(created), retained === undefined ? null : iso(retained))
        .run();
    }

    async function coverage(
      workspaceId: string,
      source: EntitlementSource,
      from: number,
      until: number,
    ) {
      await insertEntitlement({
        workspaceId,
        source,
        startsAt: iso(from),
        endsAt: iso(until),
      }).run();
    }

    const pauses = async (userId: string, at?: Date) =>
      Object.fromEntries(
        (await listStores(env.DB, userId, at)).map((store) => [store.id, store.pauseReasons]),
      );
    const visible = async (userId: string, at: number) =>
      (await listVisibleOrders(env.DB, userId, 50, "production", new Date(at)))
        .map((order) => order.id)
        .sort();
    const changes = async () =>
      (
        await env.DB.prepare(
          "SELECT store_id, kind FROM free_store_changes ORDER BY changed_at, rowid",
        ).all<{ store_id: string; kind: string }>()
      ).results;

    it("resta attivo il primo negozio collegato, anche scollegandolo, e gli altri sono in pausa", async () => {
      const seller = await twoStores("attivo@example.invalid");
      await addOrder("ordine-secondo", "secondo", Date.now() - day);
      await applyFreePlan(env.DB, seller.userId);
      expect(await pauses(seller.userId)).toEqual({ [seller.storeId]: [], secondo: ["plan"] });
      expect(await changes()).toEqual([{ store_id: seller.storeId, kind: "default" }]);
      const [first] = await listVisibleOrders(env.DB, seller.userId);
      expect(await visible(seller.userId, Date.now())).toEqual([first!.id]);
      expect(await refreshExpiringTokens(env, vi.fn<typeof fetch>())).toEqual([]);

      // Scollegare e ricollegare il negozio attivo non porta un altro negozio al suo posto.
      await disconnectStore(env.DB, seller.userId, seller.storeId);
      await applyFreePlan(env.DB, seller.userId);
      expect(await pauses(seller.userId)).toEqual({ [seller.storeId]: [], secondo: ["plan"] });
      await linkThroughEbay(seller.cookie);
      expect(await pauses(seller.userId)).toEqual({ [seller.storeId]: [], secondo: ["plan"] });
      expect(await changes()).toEqual([{ store_id: seller.storeId, kind: "default" }]);
      expect(await visible(seller.userId, Date.now())).not.toContain("ordine-secondo");
    });

    it("un negozio collegato nel Free oltre a quello attivo va in pausa prima della prima lettura", async () => {
      const seller = await linkedSeller("collega@example.invalid");
      const ebay = syntheticEbay({ userId: "altro-venditore", orderId: "ordine-altro" });
      await linkThroughEbay(seller.cookie, ebay);
      const stores = await listStores(env.DB, seller.userId);
      expect(stores.map((store) => [store.id === seller.storeId, store.pauseReasons])).toEqual([
        [true, []],
        [false, ["plan"]],
      ]);
      expect(stores[1]).toMatchObject({ connection: "paused", importedOrders: 0 });
      expect(ebay.mock.calls.map(([input]) => new URL(String(input)).pathname)).toEqual([
        "/identity/v1/oauth2/token",
        "/commerce/identity/v1/user/",
      ]);
    });

    it("con una copertura tutti i negozi sono ammessi e al downgrade vale il primo ancora collegato", async () => {
      const seller = await twoStores("copertura@example.invalid");
      await applyFreePlan(env.DB, seller.userId);
      const start = Date.now();
      await coverage(seller.workspaceId, "trial", start - day, start + day);
      await applyFreePlan(env.DB, seller.userId);
      expect(await pauses(seller.userId)).toEqual({ [seller.storeId]: [], secondo: [] });
      expect((await listStores(env.DB, seller.userId)).map((store) => store.targetMinutes)).toEqual(
        [10, 10],
      );
      // In Premium nessun negozio predefinito: non anticipa la scelta del downgrade (D155).
      expect(await changes()).toEqual([]);
      expect(await freeStoreState(env.DB, seller.userId)).toBeNull();
      await disconnectStore(env.DB, seller.userId, seller.storeId);

      const after = new Date(start + 2 * day);
      await applyFreePlans(env.DB, after);
      expect(await pauses(seller.userId, after)).toEqual({
        [seller.storeId]: ["plan"],
        secondo: [],
      });
      expect(
        (await listStores(env.DB, seller.userId, after)).map((store) => store.targetMinutes),
      ).toEqual([30, 30]);
      expect(await changes()).toEqual([{ store_id: "secondo", kind: "default" }]);
    });

    it("la sostituzione dell'utente vale una volta ogni 90 giorni, soltanto nel Free", async () => {
      const seller = await twoStores("sostituzione@example.invalid");
      await insertStore({
        id: "terzo",
        workspaceId: seller.workspaceId,
        linkedAt: iso(Date.now() + 120_000),
      }).run();
      await applyFreePlan(env.DB, seller.userId);
      const chosenAt = Date.now();
      // La prima scelta è sempre ammessa; due richieste concorrenti ne registrano una sola.
      const [first, second] = await Promise.all([
        chooseFreeStore(env.DB, seller.userId, "secondo", new Date(chosenAt)),
        chooseFreeStore(env.DB, seller.userId, "terzo", new Date(chosenAt)),
      ]);
      expect(first).toEqual({ result: "done" });
      const changeFrom = iso(chosenAt + 90 * day);
      expect(second).toEqual({ result: "locked", changeFrom });
      expect(await pauses(seller.userId)).toEqual({
        [seller.storeId]: ["plan"],
        secondo: [],
        terzo: ["plan"],
      });
      expect(await freeStoreState(env.DB, seller.userId, new Date(chosenAt))).toEqual({
        stores: [
          { id: seller.storeId, name: "venditore" },
          { id: "secondo", name: "secondo" },
          { id: "terzo", name: "terzo" },
        ],
        activeId: "secondo",
        changeFrom,
      });
      // Scollegare e ricollegare non sposta il vincolo; il negozio già attivo non conta.
      await disconnectStore(env.DB, seller.userId, "secondo");
      expect(
        await chooseFreeStore(env.DB, seller.userId, seller.storeId, new Date(chosenAt + day)),
      ).toEqual({ result: "locked", changeFrom });
      expect(
        await chooseFreeStore(env.DB, seller.userId, "secondo", new Date(chosenAt + day)),
      ).toEqual({ result: "done" });
      expect(
        await chooseFreeStore(env.DB, seller.userId, "estraneo", new Date(chosenAt + day)),
      ).toEqual({ result: "not_found" });
      const later = new Date(chosenAt + 90 * day);
      expect(await chooseFreeStore(env.DB, seller.userId, seller.storeId, later)).toEqual({
        result: "done",
      });
      expect(await pauses(seller.userId, later)).toEqual({
        [seller.storeId]: [],
        secondo: ["plan"],
        terzo: ["plan"],
      });
      // In Premium la scelta non compare e non si registra.
      await coverage(seller.workspaceId, "premium", later.getTime(), later.getTime() + 30 * day);
      const covered = new Date(later.getTime() + 100 * day);
      await coverage(seller.workspaceId, "admin", covered.getTime() - day, covered.getTime() + day);
      expect(await chooseFreeStore(env.DB, seller.userId, "terzo", covered)).toEqual({
        result: "invalid",
      });
      expect((await changes()).filter((change) => change.kind === "choice")).toHaveLength(2);
    });

    it("l'eccezione assistita richiede motivo e autore e non tocca quota, prova o ciclo", async () => {
      const seller = await twoStores("assistenza@example.invalid");
      await grantImportedOrder(seller);
      await applyFreePlan(env.DB, seller.userId);
      await chooseFreeStore(env.DB, seller.userId, "secondo");
      const assisted = (reason: string | null, actor: string | null) =>
        env.DB.prepare(
          `INSERT INTO free_store_changes (id, workspace_id, store_id, kind, changed_at, reason, actor)
           VALUES (?, ?, ?, 'assisted', ?, ?, ?)`,
        )
          .bind(
            crypto.randomUUID(),
            seller.workspaceId,
            seller.storeId,
            iso(Date.now() + 1000),
            reason,
            actor,
          )
          .run();
      await expect(assisted(null, "assistenza@example.invalid")).rejects.toThrow("CHECK");
      await expect(assisted("Account eBay chiuso", null)).rejects.toThrow("CHECK");
      await expect(assisted(" ", "assistenza@example.invalid")).rejects.toThrow("CHECK");
      await assisted("Account eBay chiuso, nuovo negozio", "assistenza@example.invalid");
      await expect(
        env.DB.prepare(
          "UPDATE free_store_changes SET reason = 'altro' WHERE kind = 'assisted'",
        ).run(),
      ).rejects.toThrow("immutable_free_store_change");
      const after = new Date(Date.now() + 2000);
      await applyFreePlan(env.DB, seller.userId, after);
      expect(await pauses(seller.userId, after)).toEqual({
        [seller.storeId]: [],
        secondo: ["plan"],
      });
      expect(await quotaUsed()).toBe(1);
      expect(await count("free_cycles")).toBe(1);
      expect(await count("workspace_entitlements")).toBe(0);
      // Anche l'eccezione è una sostituzione: la prossima scelta attende 90 giorni.
      expect(await chooseFreeStore(env.DB, seller.userId, "secondo", after)).toMatchObject({
        result: "locked",
      });
    });

    /** Spazio con due negozi e ordini acquisiti con un anno di storico, poi tornato al Free. */
    async function downgraded(email: string) {
      const seller = await twoStores(email);
      await resetOrderFixtures();
      const end = Date.parse("2026-10-01T12:00:00.000Z");
      // Termini di un anno, come per gli ordini acquisiti con Premium.
      await addOrder("attivo-vecchio", seller.storeId, end - 60 * day, yearAfter(end - 60 * day));
      await addOrder("attivo-recente", seller.storeId, end - 5 * day, yearAfter(end - 5 * day));
      await addOrder("eccedente", "secondo", end - 5 * day, yearAfter(end - 5 * day));
      await coverage(seller.workspaceId, "trial", end - 14 * day, end);
      return { seller, end, applied: end + 60_000 };
    }
    const yearAfter = (at: number) => {
      const date = new Date(at);
      date.setUTCFullYear(date.getUTCFullYear() + 1);
      return date.getTime();
    };
    const terms = async () =>
      (
        await env.DB.prepare(
          "SELECT id, retention_until, purge_after FROM orders ORDER BY id",
        ).all<{ id: string; retention_until: string; purge_after: string }>()
      ).results;

    it("al downgrade l'eccedenza non è più consultabile, resta 30 giorni e poi non torna con Premium", async () => {
      const { seller, end, applied } = await downgraded("downgrade@example.invalid");
      await applyFreePlans(env.DB, new Date(end - 60_000));
      expect(await visible(seller.userId, end - 60_000)).toEqual([
        "attivo-recente",
        "attivo-vecchio",
        "eccedente",
      ]);

      // Il cron applica il downgrade; anche prima del suo passaggio la visita lo applica.
      await applyFreePlan(env.DB, seller.userId, new Date(applied));
      expect(await visible(seller.userId, applied)).toEqual(["attivo-recente"]);
      const downgradeTerms = await terms();
      expect(downgradeTerms).toEqual([
        {
          id: "attivo-recente",
          retention_until: iso(end + 25 * day),
          purge_after: iso(applied + 30 * day),
        },
        {
          id: "attivo-vecchio",
          retention_until: iso(end - 30 * day),
          purge_after: iso(applied + 30 * day),
        },
        {
          id: "eccedente",
          retention_until: iso(end + 25 * day),
          purge_after: iso(applied + 30 * day),
        },
      ]);
      // Ripetere il riallineamento non allunga né accorcia i termini.
      await applyFreePlans(env.DB, new Date(applied + day));
      await applyFreePlan(env.DB, seller.userId, new Date(applied + day));
      expect(await terms()).toEqual(downgradeTerms);

      // Con la pulizia sospesa nessun accesso; prima del termine fisico i dati restano.
      await purgeExpiredRecords(env.DB, new Date(applied + 29 * day));
      expect(await count("orders")).toBe(3);
      expect(await visible(seller.userId, applied + 29 * day)).toEqual([]);

      // Dopo la pulizia il ritorno a Premium non ripristina i dati eliminati.
      await purgeExpiredRecords(env.DB, new Date(applied + 30 * day));
      expect(await count("orders")).toBe(0);
      expect(await count("deleted_order_keys")).toBe(3);
      const again = applied + 31 * day;
      await coverage(seller.workspaceId, "admin", again, again + day);
      await applyFreePlan(env.DB, seller.userId, new Date(again));
      expect(await visible(seller.userId, again)).toEqual([]);
    });

    it("il ritorno a Premium prima della pulizia riporta l'anno di storico agli ordini conservati", async () => {
      const { seller, end, applied } = await downgraded("ritorno@example.invalid");
      await applyFreePlan(env.DB, seller.userId, new Date(applied));
      const back = applied + 10 * day;
      await coverage(seller.workspaceId, "premium", back, back + 30 * day);
      await applyFreePlan(env.DB, seller.userId, new Date(back));
      expect(await visible(seller.userId, back)).toEqual([
        "attivo-recente",
        "attivo-vecchio",
        "eccedente",
      ]);
      expect(await terms()).toEqual(
        [
          ["attivo-recente", end - 5 * day],
          ["attivo-vecchio", end - 60 * day],
          ["eccedente", end - 5 * day],
        ].map(([id, created]) => ({
          id,
          retention_until: iso(yearAfter(created as number)),
          purge_after: iso(yearAfter(created as number)),
        })),
      );
      // Alla nuova fine della copertura torna la finestra del Free con altri trenta giorni.
      await applyFreePlans(env.DB, new Date(back + 30 * day));
      expect(await visible(seller.userId, back + 30 * day)).toEqual([]);
      expect(await terms()).toMatchObject([
        { id: "attivo-recente", purge_after: iso(back + 60 * day) },
        { id: "attivo-vecchio", purge_after: iso(back + 60 * day) },
        { id: "eccedente", purge_after: iso(back + 60 * day) },
      ]);
    });

    it("il cron rivede i termini soltanto dopo un downgrade recente, la visita sempre", async () => {
      const seller = await linkedSeller("termini@example.invalid");
      await resetOrderFixtures();
      const end = Date.parse("2026-10-01T12:00:00.000Z");
      await addOrder("lungo", seller.storeId, end - 60 * day, end + 300 * day);
      await coverage(seller.workspaceId, "trial", end - 14 * day, end);
      const term = async () =>
        (await env.DB.prepare("SELECT retention_until FROM orders").first<{
          retention_until: string;
        }>())!.retention_until;
      await applyFreePlans(env.DB, new Date(end + 8 * day));
      expect(await term()).toBe(iso(end + 300 * day));
      await applyFreePlan(env.DB, seller.userId, new Date(end + 8 * day));
      expect(await term()).toBe(iso(end - 30 * day));
    });

    it("il cron porta l'anno agli ordini di una copertura senza visite prima che scadano", async () => {
      const covered = await linkedSeller("concessa@example.invalid");
      await env.DB.batch(
        insertWorkspace({ id: "w-libero", name: "Libero", createdAt: new Date().toISOString() }),
      );
      await insertStore({ id: "negozio-libero", workspaceId: "w-libero" }).run();
      const free = { storeId: "negozio-libero" };
      await resetOrderFixtures();
      const at = Date.parse("2026-10-01T12:00:00.000Z");
      // Termini del Free, assegnati all'import prima della copertura.
      await addOrder("coperto", covered.storeId, at - 29.5 * day);
      await addOrder("libero", free.storeId, at - 29.5 * day);
      await coverage(covered.workspaceId, "admin", at - 20 * day, at + 30 * day);
      const term = async (id: string) =>
        (await env.DB.prepare("SELECT retention_until FROM orders WHERE id = ?")
          .bind(id)
          .first<{ retention_until: string }>())!.retention_until;
      // Il cron non rivede ogni giorno tutti gli ordini: soltanto quelli che scadono entro un giorno.
      await applyFreePlans(env.DB, new Date(at - 2 * day));
      expect(await term("coperto")).toBe(iso(at + 0.5 * day));
      await applyFreePlans(env.DB, new Date(at));
      expect(await term("coperto")).toBe("2027-09-02T00:00:00.000Z");
      expect(await term("libero")).toBe(iso(at + 0.5 * day));
    });

    it("il piano mostra e registra la scelta del negozio attivo soltanto nel Free", async () => {
      const seller = await twoStores("piano-negozio@example.invalid");
      expect((await settingsPage(seller.cookie)).page.freeStore).toEqual({
        stores: [
          { id: seller.storeId, name: "venditore" },
          { id: "secondo", name: "secondo" },
        ],
        activeId: seller.storeId,
        changeFrom: null,
      });
      expect(await saveSetting(seller.cookie, { intent: "free-store", store: "secondo" })).toEqual({
        ok: true,
        notice: "Negozio attivo aggiornato.",
      });
      const locked = (await saveSetting(seller.cookie, {
        intent: "free-store",
        store: seller.storeId,
      })) as { data: ActionResult; init: ResponseInit };
      expect(locked.init.status).toBe(409);
      expect(locked.data.notice).toMatch(/^Potrai sostituire il negozio attivo dal /u);
      const missing = (await saveSetting(seller.cookie, {
        intent: "free-store",
        store: "estraneo",
      })) as { init: ResponseInit };
      expect(missing.init.status).toBe(404);
      const foreign = (await saveSetting(
        seller.cookie,
        { intent: "free-store", store: seller.storeId },
        "https://estraneo.invalid",
      )) as Response;
      expect(foreign.status).toBe(403);
      expect((await settingsPage(seller.cookie)).page.freeStore).toMatchObject({
        activeId: "secondo",
        changeFrom: expect.any(String),
      });
      await coverage(seller.workspaceId, "trial", Date.now() - day, Date.now() + day);
      expect((await settingsPage(seller.cookie)).page.freeStore).toBeNull();
      expect(await pauses(seller.userId)).toEqual({ [seller.storeId]: [], secondo: [] });
    });
  });
  describe("inattività del Free e ammissione", () => {
    let base = 0;
    beforeEach(() => {
      base = Date.now();
    });
    const at = (days: number) => new Date(base + days * day);
    /** Invio delle email finto, nell'ambiente passato al compito. */
    const mailer = () => {
      const send = vi.fn<Env["AUTH_EMAIL"]["send"]>().mockResolvedValue({ messageId: "synthetic" });
      return { send, mail: { ...env, AUTH_EMAIL: { send } } as unknown as Env };
    };
    const workspace = (id: string) =>
      env.DB.prepare("SELECT active_at, inactivity_notice_at FROM workspaces WHERE id = ?")
        .bind(id)
        .first<{ active_at: string; inactivity_notice_at: string | null }>();
    const pauses = async (userId: string) =>
      (await listStores(env.DB, userId)).map((store) => store.pauseReasons);
    const admissionSettings = (waitlist: 0 | 1, open: 0 | 1) =>
      env.DB.prepare(
        `INSERT INTO admission_settings (id, free_waitlist, purchases_open, updated_at)
         VALUES (1, ?1, ?2, ?3) ON CONFLICT(id) DO UPDATE SET free_waitlist = ?1,
           purchases_open = ?2, updated_at = ?3`,
      )
        .bind(waitlist, open, new Date().toISOString())
        .run();
    const cron = {
      ...env,
      WORK_QUEUE: { send: vi.fn(), sendBatch: vi.fn().mockResolvedValue(queued) },
    } as unknown as Env;

    it("dopo 30 giorni senza accessi avvisa una volta e dopo altri 7 mette in pausa le letture", async () => {
      const seller = await linkedSeller("inattivo@example.invalid");
      const { send: email, mail } = mailer();
      const cycle = await env.DB.prepare("SELECT * FROM free_cycles").all();
      await applyInactivity(mail, at(29));
      expect(email).not.toHaveBeenCalled();

      await applyInactivity(mail, at(30.1));
      expect(email).toHaveBeenCalledOnce();
      expect(email.mock.calls[0]![0]).toMatchObject({
        to: "inattivo@example.invalid",
        subject: "I tuoi negozi su FiscalBay smetteranno di aggiornarsi",
      });
      expect((await workspace(seller.workspaceId))!.inactivity_notice_at).toBe(
        at(30.1).toISOString(),
      );
      // Un preavviso per periodo, e nessuna pausa prima dei 7 giorni.
      await applyInactivity(mail, at(36.9));
      expect(email).toHaveBeenCalledOnce();
      expect(await pauses(seller.userId)).toEqual([[]]);

      await applyInactivity(mail, at(37.2));
      const [store] = await listStores(env.DB, seller.userId);
      expect(store).toMatchObject({
        connection: "paused",
        pauseReasons: ["inactivity"],
        inactiveSince: at(37.2).toISOString(),
      });
      // Le letture si fermano, i dati restano consultabili.
      expect(await dispatchStoreSyncs(cron, at(37.3))).toEqual([]);
      expect(await listVisibleOrders(env.DB, seller.userId)).toHaveLength(1);

      // La pagina aperta registra l'attività ma non riprende le letture senza conferma.
      const page = await storesPage("/app/negozi", seller.cookie);
      expect(page.data.page.stores[0]).toMatchObject({ pauseReason: "inactivity" });
      expect((await areaShell(seller.cookie, "/app/negozi")).notifications).toContainEqual(
        expect.objectContaining({ id: `inactivity:${at(37.2).toISOString()}`, href: "negozi" }),
      );
      expect(await pauses(seller.userId)).toEqual([["inactivity"]]);

      const resumed = await storeForm(seller.cookie, {
        intent: "store-resume",
        store: seller.storeId,
      });
      expect(resumed).toMatchObject({ ok: true });
      expect(await pauses(seller.userId)).toEqual([[]]);
      expect(
        await env.DB.prepare("SELECT requested_at FROM sync_state").first("requested_at"),
      ).not.toBeNull();
      // Quota, ciclo e prova restano come prima della pausa.
      expect((await env.DB.prepare("SELECT * FROM free_cycles").all()).results).toEqual(
        cycle.results,
      );
      expect(await count("workspace_entitlements")).toBe(0);
      expect((await settingsPage(seller.cookie)).page.account.trialAvailable).toBe(true);
    });

    it("un accesso durante il preavviso lo annulla e un invio non riuscito si riprova", async () => {
      const seller = await linkedSeller("preavviso@example.invalid");
      const { send: email, mail } = mailer();
      email.mockRejectedValueOnce(new Error("synthetic"));
      const errors = vi.spyOn(console, "error").mockImplementation(() => {});
      await applyInactivity(mail, at(31));
      expect((await workspace(seller.workspaceId))!.inactivity_notice_at).toBeNull();
      await applyInactivity(mail, at(31.1));
      expect(email).toHaveBeenCalledTimes(2);
      expect((await workspace(seller.workspaceId))!.inactivity_notice_at).toBe(
        at(31.1).toISOString(),
      );
      await recordActivity(env.DB, seller.userId, at(33));
      await applyInactivity(mail, at(40));
      expect(await pauses(seller.userId)).toEqual([[]]);
      expect(email).toHaveBeenCalledTimes(2);
      // Un nuovo periodo di inattività riceve un nuovo preavviso.
      await applyInactivity(mail, at(63.1));
      expect(email).toHaveBeenCalledTimes(3);
      errors.mockRestore();
    });

    it("un indirizzo soppresso vale come preavviso tentato e la pausa segue i suoi tempi", async () => {
      const seller = await linkedSeller("soppresso@example.invalid");
      const { send: email, mail } = mailer();
      email.mockRejectedValue(
        Object.assign(new Error("synthetic"), { code: "E_RECIPIENT_SUPPRESSED" }),
      );
      const errors = vi.spyOn(console, "error").mockImplementation(() => {});
      await applyInactivity(mail, at(31));
      expect((await workspace(seller.workspaceId))!.inactivity_notice_at).toBe(
        at(31).toISOString(),
      );
      // Il log riporta il codice del provider, mai il messaggio o l'indirizzo.
      const logged = errors.mock.calls.map(([line]) => String(line)).join("\n");
      expect(logged).toContain('"failure":"E_RECIPIENT_SUPPRESSED"');
      expect(logged).not.toContain("soppresso@example.invalid");
      await applyInactivity(mail, at(38.1));
      expect(email).toHaveBeenCalledOnce();
      expect(await pauses(seller.userId)).toEqual([["inactivity"]]);
      errors.mockRestore();
    });

    it("indirizzi che rifiutano sempre l'email non fermano il preavviso degli altri", async () => {
      const seller = await linkedSeller("ultimo@example.invalid");
      const { send: email, mail } = mailer();
      // Cinquanta spazi inattivi da prima, con un indirizzo che rifiuta ogni email.
      const earlier = at(-1).toISOString();
      await env.DB.batch(
        Array.from({ length: 50 }, (_, index) => `rifiuta-${index}`).flatMap((id) => [
          env.DB.prepare(`INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
            VALUES (?1, ?1, ?2, 1, ?3, ?3)`).bind(id, `${id}@example.invalid`, earlier),
          env.DB.prepare(
            "INSERT INTO workspaces (id, name, created_at, active_at) VALUES (?1, ?1, ?2, ?2)",
          ).bind(id, earlier),
          env.DB.prepare("INSERT INTO workspace_members VALUES (?1, ?1, 'owner')").bind(id),
          insertStore({ id: `s-${id}`, workspaceId: id }),
        ]),
      );
      email.mockImplementation(async (message) => {
        if (String((message as { to: string }).to).startsWith("rifiuta-"))
          throw new Error("synthetic");
        return { messageId: "synthetic" };
      });
      const errors = vi.spyOn(console, "error").mockImplementation(() => {});
      await applyInactivity(mail, at(31));
      expect((await workspace(seller.workspaceId))!.inactivity_notice_at).toBeNull();
      await applyInactivity(mail, at(31.1));
      expect((await workspace(seller.workspaceId))!.inactivity_notice_at).toBe(
        at(31.1).toISOString(),
      );
      errors.mockRestore();
    });

    it("una copertura non va mai in pausa per inattività e toglie pausa e preavviso", async () => {
      const seller = await linkedSeller("coperto@example.invalid");
      const { send: email, mail } = mailer();
      await applyInactivity(mail, at(31));
      await applyInactivity(mail, at(38));
      expect(await pauses(seller.userId)).toEqual([["inactivity"]]);
      await insertEntitlement({
        id: "concessione",
        workspaceId: seller.workspaceId,
        source: "admin",
        startsAt: at(38).toISOString(),
        endsAt: at(120).toISOString(),
      }).run();
      await applyFreePlans(env.DB, at(38.1));
      expect(await pauses(seller.userId)).toEqual([[]]);
      expect((await workspace(seller.workspaceId))!.inactivity_notice_at).toBeNull();
      await applyInactivity(mail, at(100));
      expect(email).toHaveBeenCalledOnce();
      expect(await pauses(seller.userId)).toEqual([[]]);
      // Alla fine della copertura il Free riceve un nuovo preavviso prima di una nuova pausa.
      await applyInactivity(mail, at(120.1));
      expect(email).toHaveBeenCalledTimes(2);
      expect(await pauses(seller.userId)).toEqual([[]]);
    });

    it("riprendere a mano un negozio non riprende quelli in pausa per inattività", async () => {
      const seller = await linkedSeller("ripresa-manuale@example.invalid");
      // Il negozio in pausa manuale non leggeva: la pausa per inattività ha fermato l'altro.
      await env.DB.batch([
        insertStore({ id: "secondo", workspaceId: seller.workspaceId }),
        env.DB.prepare(`INSERT INTO ebay_store_pauses (store_id, reason, paused_at)
          VALUES (?1, 'manual', ?3), (?2, 'inactivity', ?3)`).bind(seller.storeId, "secondo", now),
      ]);
      expect(await resumeStore(env.DB, seller.userId, seller.storeId)).toBe("done");
      expect(
        (await env.DB.prepare("SELECT store_id, reason FROM ebay_store_pauses").all()).results,
      ).toEqual([{ store_id: "secondo", reason: "inactivity" }]);
    });

    it("uno spazio senza attività registrata inizia il conteggio dal compito", async () => {
      const seller = await linkedSeller("senza-attivita@example.invalid");
      await env.DB.prepare("UPDATE workspaces SET active_at = NULL").run();
      const { send: email, mail } = mailer();
      await applyInactivity(mail, at(100));
      expect((await workspace(seller.workspaceId))!.active_at).toBe(at(100).toISOString());
      expect(email).not.toHaveBeenCalled();
    });

    it("un nuovo account non ripete prova e Free ricollegando lo stesso negozio", async () => {
      const seller = await linkedSeller("primo-account@example.invalid");
      await disconnectStore(env.DB, seller.userId, seller.storeId);
      expect(await deleteStoreData(env.DB, seller.userId, seller.storeId, "venditore")).toBe(
        "done",
      );
      const other = await verifiedSession("nuovo-account@example.invalid");
      const state = (await beginStoreLink(other.cookie)).searchParams.get("state");
      const attempt = await handleAuthRequest(
        storeCallback(`state=${state}&code=codice`, other.cookie),
        env,
        syntheticEbay(),
      );
      expect(attempt.headers.get("location")).toContain("negozio=altro-spazio");
      expect(await startTrial(env.DB, other.userId)).toBeNull();
      // Il tentativo crea lo spazio vuoto, senza ciclo del Free né sblocchi.
      expect(await orderAllowance(env.DB, other.userId)).toMatchObject({
        cycle: null,
        remaining: 0,
        trialAvailable: false,
      });
    });

    it("la lista d'attesa vale per i nuovi Free: prima lettura e prova se gli acquisti sono aperti", async () => {
      const existing = await verifiedSession("esistente@example.invalid");
      await admissionSettings(1, 1);
      const seller = await linkedSeller("attesa@example.invalid");
      expect(await admission(env.DB, existing.userId)).toEqual({
        waiting: false,
        purchasesOpen: true,
      });
      expect(await admission(env.DB, seller.userId)).toEqual({
        waiting: true,
        purchasesOpen: true,
      });
      // Collegamento e prima lettura, poi nessuna lettura del Free e nessuno sblocco.
      expect((await listStores(env.DB, seller.userId))[0]).toMatchObject({ importedOrders: 1 });
      expect(await dispatchStoreSyncs(cron, new Date())).toEqual([]);
      expect(await requestStoreSync(cron, seller.userId, seller.storeId)).toBe("invalid");
      expect(await orderAllowance(env.DB, seller.userId)).toMatchObject({
        waiting: true,
        remaining: 0,
        purchasesOpen: true,
      });
      // Ordini propone prova e Premium soltanto con gli acquisti aperti.
      await admissionSettings(1, 0);
      expect((await orderAllowance(env.DB, seller.userId))!.purchasesOpen).toBe(false);
      await admissionSettings(1, 1);
      const [order] = await listVisibleOrders(env.DB, seller.userId);
      await expect(unlockOrders(env.DB, seller.userId, [order!.id])).rejects.toMatchObject({
        code: "free_quota_exhausted",
      });
      const page = (await settingsPage(seller.cookie)).page;
      expect(page.account).toMatchObject({ waitlisted: true, trialAvailable: true });
      expect(page.purchase.state).toBe("available");
      // La prova non scorre in attesa: parte soltanto se scelta, e con essa le letture.
      expect(await startTrial(env.DB, seller.userId)).toEqual(expect.any(String));
      expect(await dispatchStoreSyncs(cron, at(0.01))).toEqual([seller.storeId]);
      expect((await settingsPage(seller.cookie)).page.account.waitlisted).toBeUndefined();
    });

    it("in lista d'attesa la prima lettura non si ripete con eventi, rinnovi o ricollegamenti", async () => {
      await admissionSettings(1, 1);
      // Una prima lettura non riuscita non conta: il ricollegamento la ritenta.
      const unavailable = syntheticEbay();
      const failing = vi.fn<typeof fetch>((input, init) =>
        String(input).includes("/sell/fulfillment/")
          ? Promise.resolve(new Response(null, { status: 503 }))
          : unavailable(input, init),
      );
      const errors = vi.spyOn(console, "error").mockImplementation(() => {});
      const session = await verifiedSession("attesa-letture@example.invalid");
      await linkThroughEbay(session.cookie, failing);
      errors.mockRestore();
      expect(await count("orders")).toBe(0);
      await linkThroughEbay(session.cookie);
      const { id: storeId } = (await env.DB.prepare("SELECT id FROM ebay_stores").first<{
        id: string;
      }>())!;
      expect((await listStores(env.DB, session.userId))[0]).toMatchObject({ importedOrders: 1 });
      const paths = (ebay: ReturnType<typeof syntheticEbay>) =>
        ebay.mock.calls.map(([input]) => new URL(String(input)).pathname);

      // Un evento di eBay si chiude senza chiamate.
      const { granted_at: grantedAt } = (await env.DB.prepare(
        "SELECT granted_at FROM ebay_store_credentials",
      ).first<{ granted_at: string }>())!;
      const event = syntheticEbay({ lastModifiedDate: new Date().toISOString() });
      await consumeOrderConfirmation(
        env,
        {
          storeId,
          grantedAt,
          environment: "production",
          orderId: syntheticOrderId,
          eventAt: new Date().toISOString(),
        },
        event,
        new Date(),
      );
      expect(event).not.toHaveBeenCalled();

      // Ricollegare dopo lo scollegamento, o dopo l'eliminazione dei dati, rinnova soltanto il
      // consenso.
      for (const remove of [
        () => disconnectStore(env.DB, session.userId, storeId),
        () => deleteStoreData(env.DB, session.userId, storeId, "venditore"),
      ]) {
        await remove();
        const relinked = syntheticEbay();
        await linkThroughEbay(session.cookie, relinked);
        expect(paths(relinked)).toEqual([
          "/identity/v1/oauth2/token",
          "/commerce/identity/v1/user/",
        ]);
      }
      expect(await count("orders")).toBe(0);

      // Nessun rinnovo del token in attesa; con una copertura riprende anche se è scaduto.
      await env.DB.prepare("UPDATE ebay_store_credentials SET access_expires_at = ?")
        .bind(new Date(Date.now() - day).toISOString())
        .run();
      const refresh = syntheticEbay();
      expect(await refreshExpiringTokens(env, refresh)).toEqual([]);
      expect(refresh).not.toHaveBeenCalled();
      // Una copertura che inizia fra un'ora vale soltanto da allora. Il database dei test usa lo
      // stesso orologio simulato: le letture si provano a un istante successivo, passato come
      // parametro, così conta l'istante dato e non quello del database.
      await env.DB.prepare(
        `INSERT INTO workspace_entitlements (id, workspace_id, source, starts_at, ends_at)
         SELECT 'concessione', workspace_id, 'admin', ?1, ?2 FROM ebay_stores`,
      )
        .bind(new Date(Date.now() + hour).toISOString(), new Date(Date.now() + day).toISOString())
        .run();
      expect(await refreshExpiringTokens(env, refresh)).toEqual([]);
      const ahead = new Date(Date.now() + 2 * hour);
      expect(await refreshExpiringTokens(env, refresh, ahead)).toEqual(["refreshed"]);
      const covered = syntheticEbay({ lastModifiedDate: ahead.toISOString() });
      const relinked = (await env.DB.prepare(
        "SELECT granted_at FROM ebay_store_credentials",
      ).first<{ granted_at: string }>())!.granted_at;
      await consumeOrderConfirmation(
        env,
        {
          storeId,
          grantedAt: relinked,
          environment: "production",
          // L'ordine già letto è stato eliminato con i dati del negozio: un ordine nuovo,
          // arrivato dopo l'eliminazione.
          orderId: "27-99999-99999",
          eventAt: ahead.toISOString(),
        },
        covered,
        ahead,
      ).catch(() => {
        // eBay simulato non conosce l'ordine: conta soltanto che la lettura parta.
      });
      expect(covered).toHaveBeenCalled();
      expect(await requestStoreSync(cron, session.userId, storeId, {}, ahead)).not.toBe("invalid");
      expect(await dispatchStoreSyncs(cron, ahead)).toEqual([storeId]);
    });

    it("senza capacità per nuovi Premium ferma acquisti, prova e collegamenti in attesa", async () => {
      const admitted = await linkedSeller("ammesso@example.invalid");
      await admissionSettings(1, 0);
      expect(await purchaseState(env.DB, admitted.userId)).toMatchObject({ state: "closed" });
      expect((await lifetimeContext(env.DB, env, admitted.userId))!.offer).toMatchObject({
        state: "closed",
      });
      expect(await startTrial(env.DB, admitted.userId)).toBeNull();
      const page = (await settingsPage(admitted.cookie)).page;
      expect(page.account.trialAvailable).toBe(false);
      expect(page.account.waitlisted).toBeUndefined();
      // Un utente esistente continua a leggere i suoi negozi.
      expect(await dispatchStoreSyncs(cron, at(0.03))).toEqual([admitted.storeId]);

      const waiting = await verifiedSession("bloccato@example.invalid");
      const refused = await routeResponse(storeLinkAction, "/app/negozi/collega", {
        cookie: waiting.cookie,
        fields: {},
      });
      expect(refused.headers.get("location")).toBe("/app/ordini?negozio=lista-attesa");
      // Con le chiamate eBay spente dalla console il collegamento non parte per nessuno.
      await setSwitch(env.DB, "ebay_calls", false);
      const suspended = await routeResponse(storeLinkAction, "/app/negozi/collega", {
        cookie: admitted.cookie,
        fields: { da: "negozi" },
      });
      expect(suspended.headers.get("location")).toBe("/app/negozi?negozio=sospeso");
      await setSwitch(env.DB, "ebay_calls", true);
      expect((await settingsPage(waiting.cookie)).page).toMatchObject({
        account: { waitlisted: true },
        purchase: { state: "closed" },
      });

      // Spenta la lista d'attesa, chi era in attesa viene ammesso e resta ammesso.
      await admissionSettings(0, 1);
      await applyInactivity(env, new Date());
      await admissionSettings(1, 1);
      expect(await admission(env.DB, waiting.userId)).toEqual({
        waiting: false,
        purchasesOpen: true,
      });
    });
  });
});
