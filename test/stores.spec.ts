import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { unlockOrders } from "../app/domain/grants.server";
import { listVisibleOrders } from "../app/domain/orders.server";
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
import {
  action as profileAction,
  loader as loadProfile,
  clientAction as profileClientAction,
} from "../app/routes/profile";
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
    ["profilo", profileClientAction],
    ["negozi", storesClientAction],
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
        // Al collegamento l'unico ordine dello storico completa l'importazione.
        history: { days: 30, done: true },
        reminder: null,
        consentExpiring: false,
      },
    ]);
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
    const page = await loadProfile({
      request: new Request("http://localhost:5173/en/profilo", {
        headers: { cookie: seller.cookie },
      }),
    } as Parameters<typeof loadProfile>[0]);
    expect(page).toEqual({
      language: "en",
      userId: seller.userId,
      account: {
        name: "Utente Sintetico",
        email: "profilo@example.invalid",
        profile: syntheticProfile,
      },
    });

    const save = (fields: Record<string, string>, origin = "http://localhost:5173") =>
      profileAction({
        request: new Request("http://localhost:5173/profilo", {
          method: "POST",
          headers: { cookie: seller.cookie, origin },
          body: new URLSearchParams({ intent: "profile", ...fields }),
        }),
      } as Parameters<typeof profileAction>[0]);

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
});
