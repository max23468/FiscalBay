import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { unlockOrders } from "../app/domain/grants.server";
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
import { appCopy } from "../app/app-copy";
import { purgeExpiredRecords } from "../app/domain/maintenance.server";
import {
  refreshExpiringTokens,
  refreshStoreToken,
} from "../app/integrations/ebay/seller-credentials.server";
import { now, resetDatabase, resetOrderFixtures } from "./fixtures/database-fixtures";
import { syntheticEbay } from "./fixtures/ebay-fixtures";
import { syntheticProfile, verifiedSession, profileOf } from "./fixtures/account-fixtures";
import { homeFor } from "./fixtures/account-route-fixtures";
import { beginStoreLink, storeCallback } from "./fixtures/store-link-fixtures";

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
    await env.DB.prepare(
      "INSERT INTO ebay_store_pauses (store_id, reason, paused_at) VALUES (?, 'plan', ?)",
    )
      .bind(seller.storeId, now)
      .run();
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
  });

  it("scollega senza toccare quota, diritti e piano e ritrova lo stesso negozio al ricollegamento", async () => {
    const seller = await linkedSeller("scollega@example.invalid");
    await grantImportedOrder(seller);
    await env.DB.prepare(
      "INSERT INTO lifetime_allocations (slot, workspace_id, status, created_at) VALUES (1, ?, 'active', ?)",
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
    expect(
      await refreshStoreToken({ environment: env, storeId: seller.storeId, fetcher: refreshed }),
    ).toBe("superseded");
    expect(await count("ebay_store_credentials")).toBe(0);

    // Un rifiuto arrivato dopo il ricollegamento non segna come scaduto il nuovo consenso.
    await linkThroughEbay(seller.cookie);
    const rejected = vi.fn<typeof fetch>(async () => {
      await linkThroughEbay(seller.cookie);
      return Response.json({ error: "invalid_grant" }, { status: 400 });
    });
    expect(
      await refreshStoreToken({ environment: env, storeId: seller.storeId, fetcher: rejected }),
    ).toBe("superseded");
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
    return loadStores({
      request: new Request(`http://localhost:5173${path}`, { headers: { cookie } }),
      params: { negozio: path.split("/negozi/")[1] },
    } as Parameters<typeof loadStores>[0]);
  }

  function storeForm(
    cookie: string,
    fields: Record<string, string>,
    origin = "http://localhost:5173",
  ) {
    return storesAction({
      request: new Request("http://localhost:5173/app/negozi", {
        method: "POST",
        headers: { cookie, origin },
        body: new URLSearchParams(fields),
      }),
    } as Parameters<typeof storesAction>[0]);
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
    const anonymous = await loadStores({
      request: new Request("http://localhost:5173/app/negozi"),
      params: {},
    } as Parameters<typeof loadStores>[0]).catch((response: Response) => response);
    expect((anonymous as Response).status).toBe(302);
    expect((anonymous as Response).headers.get("location")).toBe("/accesso");
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
    expect(after.data.notice).toEqual({ text: "Negozio eliminato da FiscalBay.", tone: "success" });
    const removedDetail = await storesPage(`/app/negozi/${seller.storeId}`, seller.cookie);
    expect(removedDetail.init.status).toBe(404);

    const unknown = await storeForm(seller.cookie, {
      intent: "store-refresh",
      store: seller.storeId,
    });
    expect((unknown as { init: ResponseInit }).init.status).toBe(400);
  });

  it("chiede letture e reimportazione dalla schermata con l'esito della richiesta", async () => {
    const seller = await linkedSeller("letture-schermata@example.invalid");
    const send = vi.spyOn(env.WORK_QUEUE, "send").mockResolvedValue(undefined);
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
      const moved = (await loadProfile({
        request: new Request(`http://localhost:5173${path}`),
      } as Parameters<typeof loadProfile>[0])) as Response;
      expect(moved.status).toBe(302);
      expect(moved.headers.get("location")).toBe(target);
    }
    const loaded = await loadSettings({
      request: new Request("http://localhost:5173/en/app/impostazioni/profilo", {
        headers: { cookie: seller.cookie },
      }),
      params: { sezione: "profilo" },
    } as never);
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

    const save = (fields: Record<string, string>, origin = "http://localhost:5173") =>
      settingsAction({
        request: new Request("http://localhost:5173/app/impostazioni/profilo", {
          method: "POST",
          headers: { cookie: seller.cookie, origin },
          body: new URLSearchParams({ intent: "profile", ...fields }),
        }),
      } as never);

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
  const post = (path: string, cookie: string, fields: Record<string, string>, from = origin) =>
    new Request(`${origin}${path}`, {
      method: "POST",
      headers: { cookie, origin: from },
      body: new URLSearchParams(fields),
    });
  const settings = (cookie: string, path = "/app/impostazioni", sezione?: string) =>
    loadSettings({
      request: new Request(`${origin}${path}`, { headers: { cookie } }),
      params: { sezione },
    } as never).catch((thrown: unknown) => {
      if (thrown instanceof Response) return thrown;
      throw thrown;
    });
  const settingsPage = async (cookie: string) => {
    const loaded = await settings(cookie);
    if (loaded instanceof Response || !("page" in loaded)) throw new Error("pagina attesa");
    return loaded;
  };
  const saveSetting = (cookie: string, fields: Record<string, string>, from = origin) =>
    settingsAction({ request: post("/app/impostazioni", cookie, fields, from) } as never).catch(
      (thrown: unknown) => thrown,
    );

  it("apre le Impostazioni reali con le sole categorie che hanno un servizio", async () => {
    const seller = await verifiedSession("impostazioni@example.invalid");
    const loaded = await settingsPage(seller.cookie);
    expect(loaded.page).toMatchObject({
      section: null,
      sections: [
        "notifiche",
        "messaggio",
        "profilo",
        "piano",
        "sicurezza",
        "privacy",
        "aspetto",
        "supporto",
      ],
      services: { billing: false, telegram: false, accountData: false, support: false },
      preview: false,
      account: { plan: "free", trialAvailable: false, quota: undefined },
      preferences: { theme: "system", timeZone: "auto", detectedTimeZone: null, marketing: false },
      diagnostics: null,
    });
    expect(loaded.page.preferences.templates.it).toContain("{ordine}");
    for (const sezione of ["esportazione", "inesistente"]) {
      const missing = await settings(seller.cookie, `/app/impostazioni/${sezione}`, sezione);
      expect(missing).toMatchObject({ init: { status: 404 }, data: { notFound: true } });
    }
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
      ["telegram", "true"],
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
    expect(loaded.shell.display).toEqual({ theme: "dark", timeZone: "America/New_York" });
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
      { granted: 0, text_version: "2026-09-28", language: "it" },
      { granted: 1, text_version: "2026-09-28", language: "it" },
      { granted: 0, text_version: "2026-09-28", language: "it" },
    ]);
    expect((await settingsPage(seller.cookie)).page.preferences.marketing).toBe(false);
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
      languageAction({
        request: post("/app/lingua", seller.cookie, { language, returnTo }, from),
      } as never).catch((thrown: unknown) => thrown as Response);
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
    expect(detected.shell.display.timeZone).toBe("Asia/Tokyo");
    // Un valore non riconosciuto vale Roma, senza rompere le date.
    for (const cookie of ["fiscalbay_fuso=Mars%2FOlympus", "fiscalbay_fuso=..%2Fx"]) {
      expect((await withZone(cookie)).shell.display.timeZone).toBe("Europe/Rome");
    }
    // Un fuso scelto vale più di quello del dispositivo; «auto» torna al rilevamento.
    const save = (value: string) =>
      saveSetting(seller.cookie, { intent: "save", name: "time-zone", value });
    expect(await save("Europe/London")).toEqual({ ok: true });
    expect((await withZone("fiscalbay_fuso=Asia%2FTokyo")).shell.display.timeZone).toBe(
      "Europe/London",
    );
    expect(await save("auto")).toEqual({ ok: true });
    expect(
      await env.DB.prepare("SELECT time_zone FROM user_preferences WHERE user_id = ?")
        .bind(seller.userId)
        .first(),
    ).toEqual({ time_zone: null });
    expect((await withZone("fiscalbay_fuso=Asia%2FTokyo")).shell.display.timeZone).toBe(
      "Asia/Tokyo",
    );
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
      settingsAction({
        request: post("/app/impostazioni/sicurezza", seller.cookie, {
          intent: "conferma-accesso",
          metodo: "passkey",
          precedente,
        }),
      } as never) as Promise<{ data: { ok: boolean } }>;
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
      settingsAction({
        request: post("/app/impostazioni/sicurezza", seller.cookie, {
          intent: "conferma-accesso",
          ...fields,
        }),
      } as never) as Promise<{ data: { ok: boolean; notice?: string }; init: ResponseInit }>;
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
    const bell = async () => (await settingsPage(seller.cookie)).shell.notifications!;
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
      notificationsAction({
        request: post("/api/v1/notifications", seller.cookie, { ids }, from),
      } as never).catch((thrown: unknown) => thrown as Response);
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
});
