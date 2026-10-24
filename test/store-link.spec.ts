import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readTradingTaxObservation } from "../app/integrations/ebay/trading.server";
import { acquireOrders } from "../app/domain/order-acquisition.server";
import { storeProfileRefreshMilliseconds } from "../app/domain/store-profile.server";
import { listVisibleOrders, orderView } from "../app/domain/orders.server";
import { deleteStoreData, disconnectStore, listStores } from "../app/domain/stores.server";
import { handleAuthRequest } from "../app/auth-route.server";
import { loader as loadHome } from "../app/routes/orders";
import { action as signIn } from "../app/routes/sign-in";
import { action as startStoreLink, loader as loadStoreLink } from "../app/routes/store-link";
import { loader as loadStores } from "../app/routes/stores";
import { openToken, refreshStoreToken } from "../app/integrations/ebay/seller-credentials.server";
import { UpstreamError } from "../app/integrations/http.server";
import {
  startStoreLink as beginLink,
  claimStoreLinkSession,
  completeStoreLink,
} from "../app/integrations/ebay/store-link.server";
import { ebayConfiguration, sandboxAvailable } from "../app/integrations/ebay/environment.server";
import { now, resetDatabase } from "./fixtures/database-fixtures";
import {
  syntheticEbay,
  syntheticOrderId,
  syntheticStoreLogo,
  syntheticStoreUrl,
  syntheticStoreXml,
  syntheticUserXml,
  syntheticTradingXml,
} from "./fixtures/ebay-fixtures";
import { verifiedSession } from "./fixtures/account-fixtures";
import { homeFor } from "./fixtures/account-route-fixtures";
import { beginStoreLink, storeCallback, storeLinkSessions } from "./fixtures/store-link-fixtures";

beforeEach(resetDatabase);
afterEach(() => vi.useRealTimers());

describe("collegamento negozio eBay", () => {
  it("riusa lo spazio creato da un primo collegamento concorrente senza lasciare spazi vuoti", async () => {
    const owner = await verifiedSession("link-concorrente@example.invalid");
    const authorize = await Promise.all([
      beginLink(env, owner.userId),
      beginLink(env, owner.userId),
    ]);
    const states = authorize.map((url) => new URL(url).searchParams.get("state")!);
    const links = await Promise.all(states.map((state) => claimStoreLinkSession(env.DB, state)));
    let batches = 0;
    let release!: () => void;
    const bothStarted = new Promise<void>((resolve) => {
      release = resolve;
    });
    const db = new Proxy(env.DB, {
      get(target, property) {
        if (property === "batch")
          return async (statements: D1PreparedStatement[]) => {
            // Nessun callback scrive lo spazio prima che entrambi tentino di crearlo.
            if (++batches <= 2) {
              if (batches === 2) release();
              await bothStarted;
            }
            return target.batch(statements);
          };
        const value = Reflect.get(target, property, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    const outcomes = await Promise.all(
      links.map((link, index) => {
        if (link?.kind !== "new") throw new Error("missing_link");
        return completeStoreLink({
          environment: { ...env, DB: db },
          link,
          sessionUserId: owner.userId,
          search: new URLSearchParams({ state: states[index]!, code: "sintetico" }),
          fetcher: syntheticEbay({ orders: [] }),
        });
      }),
    );
    expect(outcomes).toEqual(["collegato", "collegato"]);
    expect(await env.DB.prepare("SELECT count(*) AS total FROM workspaces").first()).toEqual({
      total: 1,
    });
    expect(await env.DB.prepare("SELECT count(*) AS total FROM workspace_members").first()).toEqual(
      { total: 1 },
    );
    expect(await env.DB.prepare("SELECT count(*) AS total FROM ebay_stores").first()).toEqual({
      total: 1,
    });
  });
  it("collega l'identità stabile anche senza username e conserva il nome già noto al reconnect", async () => {
    const owner = await verifiedSession("link.senza-nome@example.invalid");
    const source = syntheticEbay();
    const fetcher = vi.fn<typeof fetch>(async (input, init) =>
      String(input).includes("/commerce/identity/v1/user/")
        ? Response.json({ userId: "ebay-user-sintetico" })
        : source(input, init),
    );
    const connect = async () => {
      const initial = await beginStoreLink(owner.cookie);
      return handleAuthRequest(
        storeCallback(`state=${initial.searchParams.get("state")}&code=sintetico`, owner.cookie),
        env,
        fetcher,
      );
    };
    expect((await connect()).headers.get("location")).toContain("negozio=collegato");
    const [store] = await listStores(env.DB, owner.userId);
    expect(store).toMatchObject({ name: "ebay-user-sintetico" });
    await env.DB.prepare("UPDATE ebay_stores SET display_name = 'Nome noto' WHERE id = ?")
      .bind(store!.id)
      .run();
    expect((await connect()).headers.get("location")).toContain("negozio=collegato");
    expect(await listStores(env.DB, owner.userId)).toMatchObject([
      { id: store!.id, name: "Nome noto" },
    ]);
  });

  it("ricollega solo il negozio scelto, senza salvare un consenso di un altro account", async () => {
    const owner = await verifiedSession("reconnect.esatto@example.invalid");
    const other = await verifiedSession("reconnect.estraneo@example.invalid");
    const initial = await beginStoreLink(owner.cookie);
    await handleAuthRequest(
      storeCallback(`state=${initial.searchParams.get("state")}&code=uno`, owner.cookie),
      env,
      syntheticEbay(),
    );
    const [store] = await listStores(env.DB, owner.userId);
    const original = await env.DB.prepare("SELECT * FROM ebay_store_credentials WHERE store_id = ?")
      .bind(store!.id)
      .first();
    const page = await loadStoreLink({
      request: new Request(
        `http://localhost:5173/app/negozi/collega?ricollega=${store!.id}&da=negozi`,
        { headers: { cookie: owner.cookie } },
      ),
    } as never);
    expect(page).toMatchObject({
      expectedStoreId: store!.id,
      expectedStoreName: "venditore",
      reconnect: true,
      fromStores: true,
    });
    const start = async (cookie: string) =>
      (await startStoreLink({
        request: new Request("http://localhost:5173/app/negozi/collega", {
          method: "POST",
          headers: { cookie, origin: "http://localhost:5173" },
          body: new URLSearchParams({ negozio: store!.id, da: "negozi" }),
        }),
      } as never)) as Response;
    expect((await start(other.cookie)).status).toBe(400);
    const state = new URL((await start(owner.cookie)).headers.get("location")!).searchParams.get(
      "state",
    );
    const wrong = syntheticEbay({ userId: "account-diverso" });
    const callback = await handleAuthRequest(
      storeCallback(`state=${state}&code=due`, owner.cookie),
      env,
      wrong,
    );
    // Partito da Negozi, il ricollegamento torna lì con l'esito.
    expect(callback.headers.get("location")).toBe(
      "http://localhost:5173/app/negozi?negozio=negozio-diverso",
    );
    expect(wrong).toHaveBeenCalledTimes(2);
    expect(
      await env.DB.prepare("SELECT * FROM ebay_store_credentials WHERE store_id = ?")
        .bind(store!.id)
        .first(),
    ).toEqual(original);
    expect(await listStores(env.DB, owner.userId)).toHaveLength(1);
    const replay = await handleAuthRequest(
      storeCallback(`state=${state}&code=due`, owner.cookie),
      env,
      wrong,
    );
    expect(replay.headers.get("location")).toBe(callback.headers.get("location"));
    expect(wrong).toHaveBeenCalledTimes(2);
    const correctState = new URL(
      (await start(owner.cookie)).headers.get("location")!,
    ).searchParams.get("state");
    const correct = await handleAuthRequest(
      storeCallback(`state=${correctState}&code=tre`, owner.cookie),
      env,
      syntheticEbay({ username: "nome-aggiornato" }),
    );
    expect(correct.headers.get("location")).toBe(
      "http://localhost:5173/app/negozi?negozio=collegato",
    );
    const stores = (await loadStores({
      request: new Request(correct.headers.get("location")!, {
        headers: { cookie: owner.cookie },
      }),
      params: {},
    } as Parameters<typeof loadStores>[0])) as unknown as { data: { notice: unknown } };
    expect(stores.data.notice).toEqual({ text: "Negozio eBay collegato.", tone: "success" });
    expect(await listStores(env.DB, owner.userId)).toMatchObject([
      { id: store!.id, name: "nome-aggiornato" },
    ]);
    // Dopo l'eliminazione il vecchio indirizzo di reconnect non è più disponibile.
    expect(await deleteStoreData(env.DB, owner.userId, store!.id, "nome-aggiornato")).toBe("done");
    const deleted = await loadStoreLink({
      request: new Request(
        `http://localhost:5173/app/negozi/collega?ricollega=${store!.id}&da=negozi`,
        { headers: { cookie: owner.cookie } },
      ),
    } as never).catch((response: Response) => response);
    expect((deleted as Response).status).toBe(400);
  });

  it("non accetta il reconnect se il negozio cambia proprietario durante OAuth", async () => {
    const owner = await verifiedSession("reconnect.trasferito@example.invalid");
    const initial = await beginStoreLink(owner.cookie);
    await handleAuthRequest(
      storeCallback(`state=${initial.searchParams.get("state")}&code=uno`, owner.cookie),
      env,
      syntheticEbay(),
    );
    const [store] = await listStores(env.DB, owner.userId);
    const url = new URL(
      await beginLink(env, owner.userId, new Date(), "it", "production", store!.id),
    );
    const direct = new URL(
      await beginLink(env, owner.userId, new Date(), "it", "production", store!.id),
    );
    const claim = await claimStoreLinkSession(env.DB, direct.searchParams.get("state")!);
    if (!claim || claim.kind !== "new") throw new Error("consenso iniziale atteso");
    await env.DB.prepare("DELETE FROM workspace_members WHERE user_id = ?")
      .bind(owner.userId)
      .run();
    await expect(
      completeStoreLink({
        environment: env,
        link: claim,
        sessionUserId: owner.userId,
        search: new URLSearchParams({ state: direct.searchParams.get("state")!, code: "diretto" }),
        fetcher: syntheticEbay(),
      }),
    ).resolves.toBe("errore");
    const response = await handleAuthRequest(
      storeCallback(`state=${url.searchParams.get("state")}&code=due`, owner.cookie),
      env,
      syntheticEbay(),
    );
    expect(response.headers.get("location")).toContain("negozio=errore");
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM ebay_stores").first()).toEqual({ n: 1 });
  });
  it("separa account e ordini con gli stessi ID nei due ambienti e rinnova con le chiavi corrette", async () => {
    const seller = await verifiedSession("ambienti@example.invalid");
    const sandbox = {
      ...env,
      EBAY_SANDBOX_ENABLED: "true",
      EBAY_SANDBOX_CLIENT_ID: "sandbox-client",
      EBAY_SANDBOX_CLIENT_SECRET: "sandbox-secret",
      EBAY_SANDBOX_RUNAME: "sandbox-runame",
    } as unknown as Env;
    const configuration = ebayConfiguration(sandbox, "sandbox");
    for (const ebayEnvironment of ["production", "sandbox"] as const) {
      const authorize = new URL(
        await beginLink(sandbox, seller.userId, new Date(), "it", ebayEnvironment),
      );
      expect(authorize.hostname).toBe(
        ebayEnvironment === "sandbox" ? "auth.sandbox.ebay.com" : "auth.ebay.com",
      );
      expect(authorize.searchParams.get("client_id")).toBe(
        ebayEnvironment === "sandbox" ? "sandbox-client" : env.EBAY_CLIENT_ID,
      );
      const provider = syntheticEbay();
      const callback = await handleAuthRequest(
        storeCallback(
          `state=${authorize.searchParams.get("state")}&code=codice-sintetico&environment=production`,
          seller.cookie,
        ),
        sandbox,
        provider,
      );
      expect(callback.headers.get("location")).toContain("negozio=collegato");
      expect(new URL(callback.headers.get("location")!).searchParams.get("environment")).toBe(
        ebayEnvironment === "sandbox" ? "sandbox" : null,
      );
      expect(provider.mock.calls.map(([url]) => new URL(String(url)).hostname)).toEqual(
        ebayEnvironment === "sandbox"
          ? [
              "api.sandbox.ebay.com",
              "apiz.sandbox.ebay.com",
              ...Array(7).fill("api.sandbox.ebay.com"),
            ]
          : ["api.ebay.com", "apiz.ebay.com", ...Array(7).fill("api.ebay.com")],
      );
    }
    const { results: stores } = await env.DB.prepare(
      `SELECT id, ebay_environment, ebay_account_id, ebay_user_id
         FROM ebay_stores ORDER BY ebay_environment`,
    ).all<{
      id: string;
      ebay_environment: "production" | "sandbox";
      ebay_account_id: string;
      ebay_user_id: string;
    }>();
    expect(stores.map((s) => [s.ebay_environment, s.ebay_account_id, s.ebay_user_id])).toEqual([
      ["production", "ebay-user-sintetico", "ebay-user-sintetico"],
      ["sandbox", "ebay-user-sintetico", '["sandbox","ebay-user-sintetico"]'],
    ]);
    expect((await env.DB.prepare("SELECT id FROM orders").all()).results).toHaveLength(2);
    const visible = await listVisibleOrders(env.DB, seller.userId);
    expect(visible.map((o) => o.storeName)).toEqual(["venditore"]);
    expect(
      (await listVisibleOrders(env.DB, seller.userId, 50, "sandbox")).map((o) => o.storeName),
    ).toEqual(["venditore (Sandbox)"]);
    const refresh = vi.fn<typeof fetch>(async () =>
      Response.json({ access_token: "rinnovato", expires_in: 7200 }),
    );
    for (const store of stores) {
      expect(
        await refreshStoreToken({ environment: sandbox, storeId: store.id, fetcher: refresh }),
      ).toBe("refreshed");
      const [url, init] = refresh.mock.calls.at(-1)!;
      expect(String(url)).toBe(
        store.ebay_environment === "sandbox"
          ? configuration.tokenUrl
          : "https://api.ebay.com/identity/v1/oauth2/token",
      );
      expect(new Headers(init?.headers).get("authorization")).toBe(
        `Basic ${btoa(store.ebay_environment === "sandbox" ? "sandbox-client:sandbox-secret" : `${env.EBAY_CLIENT_ID}:${env.EBAY_CLIENT_SECRET}`)}`,
      );
    }
  });

  it("rifiuta Sandbox senza credenziali e sul dominio Production prima di registrare uno state", async () => {
    expect(sandboxAvailable(env)).toBe(false);
    await expect(beginLink(env, "utente", new Date(), "it", "sandbox")).rejects.toThrow(
      "ebay_sandbox_unavailable",
    );
    const configured = {
      ...env,
      EBAY_SANDBOX_ENABLED: "true",
      EBAY_SANDBOX_CLIENT_ID: "client",
      EBAY_SANDBOX_CLIENT_SECRET: "secret",
      EBAY_SANDBOX_RUNAME: "runame",
      APP_ORIGIN: "https://fiscalbay.it",
    };
    expect(sandboxAvailable(configured)).toBe(false);
    expect(await storeLinkSessions()).toBe(0);
    const authorize = new URL(await beginLink(env, "utente"));
    const claim = await claimStoreLinkSession(env.DB, authorize.searchParams.get("state")!);
    expect(claim).toMatchObject({ kind: "new", ebayEnvironment: "production" });
  });
  it("registra e apre la sessione dal modulo di accesso solo dalla propria origine", async () => {
    await verifiedSession("accesso@example.invalid");
    const submit = (password: string, origin = "http://localhost:5173") =>
      signIn({
        request: new Request("http://localhost:5173/accesso", {
          method: "POST",
          headers: { origin },
          body: new URLSearchParams({ email: "accesso@example.invalid", password }),
        }),
      } as Parameters<typeof signIn>[0]) as Promise<Response>;

    const accepted = await submit("Una-password-negozio-molto-lunga");
    expect(accepted.status).toBe(303);
    expect(accepted.headers.get("location")).toBe("/app/ordini");
    expect(accepted.headers.getSetCookie().join(";")).toContain("session_token");

    const rejected = await submit("password-sbagliata-ma-lunga");
    expect(rejected.headers.get("location")).toBe("/accesso?accesso=errore");
    expect(rejected.headers.getSetCookie()).toEqual([]);

    expect(
      (await submit("Una-password-negozio-molto-lunga", "https://esempio.invalid")).status,
    ).toBe(403);
  });

  it("legge l'osservazione fiscale Trading del solo ordine richiesto", async () => {
    const read = (xml: string) =>
      readTradingTaxObservation(
        {
          fetcher: async () => new Response(xml),
          accessToken: "token-sintetico",
          configuration: ebayConfiguration(env, "production"),
        },
        syntheticOrderId,
      );
    expect(await read(syntheticTradingXml)).toEqual({
      orderFound: true,
      values: [
        {
          type: "CODICE_FISCALE",
          issuingCountry: null,
          value: "SYNTHETIC&ID",
          source: "ebay_trading_get_orders",
        },
      ],
    });
    await expect(read("<GetOrdersResponse><Ack>Failure</Ack>")).rejects.toThrow(UpstreamError);
  });

  it("dà allo spazio creato al collegamento il nome nella lingua dell'utente", async () => {
    for (const [prefix, name, fromStores] of [
      ["", "Spazio personale", false],
      ["/en", "Personal space", false],
      ["", "Spazio personale", true],
      ["/en", "Personal space", true],
    ] as const) {
      const { userId, cookie } = await verifiedSession(
        `spazio${prefix.replace("/", "-")}-${fromStores}@example.invalid`,
      );
      const start = (await startStoreLink({
        request: new Request(`http://localhost:5173${prefix}/app/negozi/collega`, {
          method: "POST",
          headers: { cookie, origin: "http://localhost:5173" },
          body: new URLSearchParams(fromStores ? { da: "negozi" } : {}),
        }),
      } as Parameters<typeof startStoreLink>[0])) as Response;
      const state = new URL(start.headers.get("location")!).searchParams.get("state");
      await handleAuthRequest(
        storeCallback(`state=${state}&code=codice`, cookie),
        env,
        syntheticEbay(),
      );
      expect(
        await env.DB.prepare(
          `SELECT w.name FROM workspaces w
             JOIN workspace_members wm ON wm.workspace_id = w.id WHERE wm.user_id = ?`,
        )
          .bind(userId)
          .first(),
      ).toEqual({ name });
    }
  });

  it("collega il negozio senza scope email e importa ordine e fonte fiscale", async () => {
    const { userId, cookie } = await verifiedSession("negozio@example.invalid");
    const authorize = await beginStoreLink(cookie);

    expect(authorize.origin).toBe("https://auth.ebay.com");
    expect(authorize.searchParams.get("scope")?.split(" ")).toEqual([
      "https://api.ebay.com/oauth/api_scope",
      "https://api.ebay.com/oauth/api_scope/commerce.identity.readonly",
      "https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly",
    ]);
    expect(authorize.searchParams.get("code_challenge_method")).toBe("S256");
    expect(authorize.searchParams.get("locale")).toBe("it-IT");
    const state = authorize.searchParams.get("state")!;

    const ebay = syntheticEbay();
    const callback = await handleAuthRequest(
      storeCallback(`state=${state}&code=codice-sintetico`, cookie),
      env,
      ebay,
    );
    expect(callback.status).toBe(303);
    expect(callback.headers.get("location")).toBe(
      "http://localhost:5173/app/ordini?negozio=collegato",
    );
    expect(callback.headers.get("cache-control")).toBe("no-store");
    expect(ebay).toHaveBeenCalledTimes(9);

    const stored = await env.DB.prepare(
      `SELECT wm.user_id, s.ebay_user_id, o.ebay_order_id, o.total_minor,
              ti.identifier_type, ti.issuing_country, ti.source
         FROM workspace_members wm
         JOIN ebay_stores s ON s.workspace_id = wm.workspace_id
         JOIN orders o ON o.store_id = s.id
         JOIN tax_identifiers ti ON ti.order_id = o.id`,
    ).all();
    expect(stored.results).toEqual([
      {
        user_id: userId,
        ebay_user_id: "ebay-user-sintetico",
        ebay_order_id: syntheticOrderId,
        total_minor: 1250,
        identifier_type: "CODICE_FISCALE",
        issuing_country: null,
        source: "ebay_trading_get_orders",
      },
    ]);

    const home = await loadHome({
      params: {},
      request: new Request("http://localhost:5173/app/ordini?negozio=collegato", {
        headers: { cookie },
      }),
    } as Parameters<typeof loadHome>[0]);
    expect(home.notice).toEqual({ text: "Negozio eBay collegato.", tone: "success" });
    // La pagina reale riceve la vista condivisa con l'anteprima, senza il valore da sbloccare.
    expect(home.page.orders).toMatchObject([
      {
        ebayOrderId: syntheticOrderId,
        storeName: "venditore",
        buyerUsername: "acquirente-sintetico",
        payment: { status: "paid" },
        shipping: { status: "to_ship" },
        fiscal: { state: "locked", shownAs: "CF" },
        items: [
          {
            id: "riga-sintetica",
            title: "Articolo sintetico",
            quantity: 2,
            sku: "SKU-SINTETICO",
          },
        ],
      },
    ]);
    expect(JSON.stringify(home)).not.toContain("NON-ESPORRE");

    // Il callback duplicato riceve lo stesso esito senza un secondo scambio del codice;
    // replicato da un altro utente non rivela nulla.
    const replay = await handleAuthRequest(
      storeCallback(`state=${state}&code=codice-sintetico`, cookie),
      env,
      ebay,
    );
    expect(replay.headers.get("location")).toBe(
      "http://localhost:5173/app/ordini?negozio=collegato",
    );
    const intruder = await verifiedSession("intruso@example.invalid");
    const stolenReplay = await handleAuthRequest(
      storeCallback(`state=${state}&code=codice-sintetico`, intruder.cookie),
      env,
      ebay,
    );
    expect(stolenReplay.headers.get("location")).toBe(
      "http://localhost:5173/app/ordini?negozio=errore",
    );
    expect(ebay).toHaveBeenCalledTimes(9);
  });

  it("mostra il profilo del negozio eBay e lo rilegge una volta a settimana", async () => {
    const owner = await verifiedSession("profilo-negozio@example.invalid");
    const state = (await beginStoreLink(owner.cookie)).searchParams.get("state");
    await handleAuthRequest(
      storeCallback(`state=${state}&code=codice-sintetico`, owner.cookie),
      env,
      syntheticEbay({
        store: () => new Response(syntheticStoreXml),
        user: () =>
          new Response(
            syntheticUserXml
              .replace("<FeedbackScore>42", "<FeedbackScore>1500")
              .replace("100.0", "99.8")
              .replace("<StoreOwner>false</StoreOwner>", "<TopRatedSeller>true</TopRatedSeller>"),
          ),
        orders: [
          {
            orderId: "12-profilo",
            creationDate: new Date(Date.now() - 3_600_000).toISOString(),
            lastModifiedDate: new Date(Date.now() - 3_600_000).toISOString(),
            pricingSummary: { total: { value: "5", currency: "EUR" } },
            orderPaymentStatus: "PAID",
            orderFulfillmentStatus: "NOT_STARTED",
            lineItems: [
              {
                lineItemId: "9001",
                legacyItemId: "110000000099",
                title: "Faro anteriore",
                quantity: 1,
                lineItemCost: { value: "5", currency: "EUR" },
                listingMarketplaceId: "EBAY_DE",
              },
            ],
          },
        ],
      }),
    );
    const [store] = await listStores(env.DB, owner.userId);
    // Nome e indirizzo delle categorie e del logo non prendono il posto di quelli del negozio.
    expect(store).toMatchObject({
      name: "Bottega & Ricambi",
      username: "venditore",
      logoUrl: syntheticStoreLogo,
      storeUrl: syntheticStoreUrl,
      feedback: { score: 1500, positivePercent: 99.8, topRated: true },
      marketplace: "EBAY_DE",
    });
    const [visible] = await listVisibleOrders(env.DB, owner.userId, 10);
    expect(visible?.storeName).toBe("Bottega & Ricambi");
    // L'inserzione dell'articolo viene dall'identità stabile della riga.
    expect(orderView(visible!).items[0]?.listingId).toBe("110000000099");

    // Entro la settimana la sincronizzazione non rilegge il profilo; dopo, logo e indirizzo fuori
    // dai domini eBay non si conservano e un feedback non letto resta quello precedente.
    const acquire = async (at: Date, fetcher: typeof fetch) =>
      acquireOrders({
        db: env.DB,
        storeId: store!.id,
        grantedAt: (await env.DB.prepare(
          "SELECT granted_at FROM ebay_store_credentials WHERE store_id = ?",
        )
          .bind(store!.id)
          .first<{ granted_at: string }>())!.granted_at,
        access: { fetcher, configuration: ebayConfiguration(env, "production"), accessToken: "t" },
        now: at,
        budget: { calls: 8, pages: 3 },
      });
    const renamed = () =>
      new Response(
        syntheticStoreXml
          .replace("Bottega &amp; Ricambi", "Nuovo nome")
          .replace(syntheticStoreLogo, "https://example.invalid/logo.png")
          .replace(syntheticStoreUrl, "https://ebay.example.invalid/str/x"),
      );
    const soon = syntheticEbay({ store: renamed });
    await acquire(new Date(Date.now() + 60_000), soon);
    expect(
      soon.mock.calls.some(
        ([, init]) => new Headers(init?.headers).get("x-ebay-api-call-name") === "GetStore",
      ),
    ).toBe(false);
    await acquire(
      new Date(Date.now() + storeProfileRefreshMilliseconds + 60_000),
      syntheticEbay({ store: renamed, user: () => new Response(null, { status: 503 }) }),
    );
    expect((await listStores(env.DB, owner.userId))[0]).toMatchObject({
      name: "Nuovo nome",
      logoUrl: null,
      storeUrl: null,
      feedback: { score: 1500, positivePercent: 99.8, topRated: true },
    });

    // Eliminati i dati, il profilo non resta.
    expect(await deleteStoreData(env.DB, owner.userId, store!.id, "Nuovo nome")).toBe("done");
    expect(
      await env.DB.prepare(
        `SELECT store_name, store_logo_url, store_url, feedback_score, feedback_positive_percent,
                top_rated_seller, store_profile_read_at FROM ebay_stores WHERE id = ?`,
      )
        .bind(store!.id)
        .first(),
    ).toEqual({
      store_name: null,
      store_logo_url: null,
      store_url: null,
      feedback_score: null,
      feedback_positive_percent: null,
      top_rated_seller: null,
      store_profile_read_at: null,
    });
  });

  it("invia a eBay soltanto le richieste previste, con sessione di collegamento a scadenza", async () => {
    const { userId, cookie } = await verifiedSession("richieste@example.invalid");
    const started = new Date();
    const at = (offset: number) => new Date(started.getTime() + offset).toISOString();
    await env.DB.prepare(
      `INSERT INTO ebay_store_link_sessions (state, user_id, code_verifier, expires_at)
       VALUES ('scaduta', ?1, 'v', ?2), ('al-limite', ?1, 'v', ?3), ('valida', ?1, 'v', ?4)`,
    )
      .bind(userId, at(-60 * 60 * 1000), at(0), at(1000))
      .run();
    const authorize = new URL(await beginLink(env, userId, started));
    const state = authorize.searchParams.get("state")!;
    expect(state).toMatch(/^it_/u);
    expect(authorize.searchParams.get("response_type")).toBe("code");
    const { results: sessions } = await env.DB.prepare(
      "SELECT state, expires_at FROM ebay_store_link_sessions ORDER BY expires_at",
    ).all<{ state: string; expires_at: string }>();
    expect(sessions).toEqual([
      { state: "valida", expires_at: at(1000) },
      { state, expires_at: at(10 * 60 * 1000) },
    ]);
    // Al limite esatto della scadenza la sessione non vale più.
    expect(await claimStoreLinkSession(env.DB, "valida", new Date(at(1000)))).toMatchObject({
      kind: "new",
      expired: true,
    });

    const ebay = syntheticEbay({ orderId: "12-<0>&1" });
    await handleAuthRequest(
      storeCallback(`state=${state}&code=codice-sintetico`, cookie),
      env,
      ebay,
    );
    const tradingList = ebay.mock.calls.filter(([, init]) =>
      String(init?.body).includes("<ModTimeFrom>"),
    );
    expect(tradingList).toHaveLength(1);
    expect(String(tradingList[0]![1]?.body)).toContain(
      "<OrderRole>Seller</OrderRole><OrderStatus>All</OrderStatus>",
    );
    const profileCall = (init?: RequestInit) =>
      ["GetStore", "GetUser"].includes(
        new Headers(init?.headers).get("x-ebay-api-call-name") ?? "",
      );
    const request = ([url, init]: Parameters<typeof fetch>) => ({
      url: String(url),
      method: init?.method ?? "GET",
      headers: init?.headers,
      body: init?.body === undefined ? undefined : String(init.body),
    });
    // Dopo i recenti, nome, logo e indirizzo del negozio con feedback e stato Top Rated, in
    // parallelo.
    expect(ebay.mock.calls.filter(([, init]) => profileCall(init)).map(request)).toEqual(
      expect.arrayContaining([
        {
          url: "https://api.ebay.com/ws/api.dll",
          method: "POST",
          headers: {
            "content-type": "text/xml;charset=UTF-8",
            "x-ebay-api-call-name": "GetStore",
            "x-ebay-api-siteid": "101",
            "x-ebay-api-compatibility-level": "1455",
            "x-ebay-api-iaf-token": "token-sintetico",
          },
          body:
            '<?xml version="1.0" encoding="utf-8"?>' +
            '<GetStoreRequest xmlns="urn:ebay:apis:eBLBaseComponents">' +
            "<Version>1455</Version><LevelLimit>1</LevelLimit></GetStoreRequest>",
        },
        {
          url: "https://api.ebay.com/ws/api.dll",
          method: "POST",
          headers: {
            "content-type": "text/xml;charset=UTF-8",
            "x-ebay-api-call-name": "GetUser",
            "x-ebay-api-siteid": "101",
            "x-ebay-api-compatibility-level": "1455",
            "x-ebay-api-iaf-token": "token-sintetico",
          },
          body:
            '<?xml version="1.0" encoding="utf-8"?>' +
            '<GetUserRequest xmlns="urn:ebay:apis:eBLBaseComponents">' +
            "<Version>1455</Version></GetUserRequest>",
        },
      ]),
    );
    const requests = ebay.mock.calls
      .filter(([, init]) => !String(init?.body).includes("<ModTimeFrom>") && !profileCall(init))
      .map(([url, init]) => ({
        url: String(url),
        method: init?.method ?? "GET",
        headers: init?.headers,
        body: init?.body === undefined ? undefined : String(init.body),
      }));
    const codeVerifier = new URLSearchParams(requests[0]!.body).get("code_verifier");
    const fulfillmentList = (field: string) => ({
      url: expect.stringContaining(
        `https://api.ebay.com/sell/fulfillment/v1/order?limit=25&filter=${field}%3A%5B`,
      ),
      method: "GET",
      headers: { authorization: "Bearer token-sintetico" },
      body: undefined,
    });
    expect(codeVerifier).toMatch(/^[\w-]{43}$/u);
    expect(requests).toEqual([
      {
        url: "https://api.ebay.com/identity/v1/oauth2/token",
        method: "POST",
        headers: {
          authorization: `Basic ${btoa(`${env.EBAY_CLIENT_ID}:${env.EBAY_CLIENT_SECRET}`)}`,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: "codice-sintetico",
          redirect_uri: env.EBAY_RUNAME,
          code_verifier: codeVerifier!,
        }).toString(),
      },
      {
        url: expect.stringContaining("/commerce/identity/v1/user/"),
        method: "GET",
        headers: { authorization: "Bearer token-sintetico" },
        body: undefined,
      },
      fulfillmentList("lastmodifieddate"),
      fulfillmentList("creationdate"),
      {
        url: "https://api.ebay.com/sell/fulfillment/v1/order/12-%3C0%3E%261",
        method: "GET",
        headers: { authorization: "Bearer token-sintetico" },
        body: undefined,
      },
      {
        url: "https://api.ebay.com/ws/api.dll",
        method: "POST",
        headers: {
          "content-type": "text/xml;charset=UTF-8",
          "x-ebay-api-call-name": "GetOrders",
          "x-ebay-api-siteid": "101",
          "x-ebay-api-compatibility-level": "1455",
          "x-ebay-api-iaf-token": "token-sintetico",
        },
        body:
          '<?xml version="1.0" encoding="utf-8"?>' +
          '<GetOrdersRequest xmlns="urn:ebay:apis:eBLBaseComponents">' +
          "<Version>1455</Version><DetailLevel>ReturnAll</DetailLevel>" +
          "<OrderRole>Seller</OrderRole><OrderStatus>All</OrderStatus>" +
          "<OrderIDArray><OrderID>12-&lt;0&gt;&amp;1</OrderID></OrderIDArray>" +
          "</GetOrdersRequest>",
      },
    ]);
    // I recenti partono dall'istante del collegamento, con la sovrapposizione; lo storico copre
    // i trenta giorni precedenti.
    const filters = [requests[2]!, requests[3]!].map(({ url }) =>
      new URL(url).searchParams.get("filter")!.match(/\[(.+)\.\.(.+)\]/u)!,
    );
    const span = ([, from, to]: RegExpMatchArray) => Date.parse(to!) - Date.parse(from!);
    expect(filters.map(span)).toEqual([15 * 60 * 1000, 30 * 24 * 60 * 60 * 1000]);
    expect(filters[0]![2]).toBe(filters[1]![2]);
  });

  it("registra la sincronizzazione anche senza ordini da importare", async () => {
    // Una pagina vuota o senza `orders` non ha ordini e non è un errore.
    for (const [index, provider] of [
      syntheticEbay({ orders: [] }),
      syntheticEbay({ ordersPayload: { total: 0 } }),
    ].entries()) {
      const { cookie } = await verifiedSession(`senza-ordini-${index}@example.invalid`);
      await env.DB.prepare("DELETE FROM ebay_stores").run();
      const state = (await beginStoreLink(cookie)).searchParams.get("state");
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        await handleAuthRequest(storeCallback(`state=${state}&code=codice`, cookie), env, provider);
        expect(log).not.toHaveBeenCalled();
      } finally {
        log.mockRestore();
      }
      expect(
        await env.DB.prepare(
          "SELECT COUNT(*) AS total FROM sync_state WHERE last_success_at IS NOT NULL",
        ).first(),
      ).toEqual({ total: 1 });
    }
  });

  it("al collegamento legge soltanto recenti, una pagina di storico e pochi dettagli", async () => {
    const { cookie } = await verifiedSession("primo-import@example.invalid");
    const state = (await beginStoreLink(cookie)).searchParams.get("state");
    const orders = Array.from({ length: 4 }, (_, index) => ({
      orderId: `12-00000-0000${index}`,
      creationDate: new Date(Date.now() - (index + 1) * 60 * 60 * 1000).toISOString(),
      lastModifiedDate: new Date(Date.now() - (index + 1) * 60 * 60 * 1000).toISOString(),
      pricingSummary: { total: { value: "1", currency: "EUR" } },
      lineItems: [],
    }));
    const ebay = syntheticEbay({ orders });
    await handleAuthRequest(storeCallback(`state=${state}&code=codice`, cookie), env, ebay);
    // Token e identità, tre pagine e due dettagli da due chiamate entro il budget di otto, più
    // il profilo del negozio, che non scala il budget.
    expect(ebay).toHaveBeenCalledTimes(11);
    expect(await env.DB.prepare("SELECT COUNT(*) AS total FROM orders").first()).toEqual({
      total: 4,
    });
    expect(
      await env.DB.prepare(
        "SELECT COUNT(*) AS total FROM order_source_refs WHERE detail_for IS NULL",
      ).first(),
    ).toEqual({ total: 2 });
  });

  it("non collega il negozio con token o identità eBay non validi", async () => {
    const incomplete = () => Response.json({ access_token: "token-sintetico", expires_in: 7200 });
    for (const [index, provider] of [
      syntheticEbay({ token: incomplete }),
      syntheticEbay({ userId: "x".repeat(257) }),
    ].entries()) {
      const { cookie } = await verifiedSession(`risposta-invalida-${index}@example.invalid`);
      const state = (await beginStoreLink(cookie)).searchParams.get("state");
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        const callback = await handleAuthRequest(
          storeCallback(`state=${state}&code=codice`, cookie),
          env,
          provider,
        );
        expect(callback.headers.get("location")).toBe(
          "http://localhost:5173/app/ordini?negozio=errore",
        );
      } finally {
        log.mockRestore();
      }
      expect(await env.DB.prepare("SELECT COUNT(*) AS total FROM ebay_stores").first()).toEqual({
        total: 0,
      });
    }
  });

  it("non considera rimosso l'identificativo assente da una nuova lettura Trading", async () => {
    const { cookie } = await verifiedSession("rilettura@example.invalid");
    const first = (await beginStoreLink(cookie)).searchParams.get("state");
    await handleAuthRequest(storeCallback(`state=${first}&code=uno`, cookie), env, syntheticEbay());
    const second = (await beginStoreLink(cookie)).searchParams.get("state");
    const modified = new Date(Date.now() - 60_000).toISOString();
    await handleAuthRequest(
      storeCallback(`state=${second}&code=due`, cookie),
      env,
      // Una nuova versione dell'ordine rilegge Trading, che non riporta più l'identificativo.
      syntheticEbay({
        lastModifiedDate: modified,
        trading: () =>
          new Response(
            '<GetOrdersResponse xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Success</Ack>' +
              "<OrderArray></OrderArray></GetOrdersResponse>",
          ),
      }),
    );
    expect(
      await env.DB.prepare("SELECT value, removed_at FROM tax_identifiers")
        .all()
        .then(({ results }) => results),
    ).toEqual([{ value: "SYNTHETIC&ID", removed_at: null }]);
    expect(await env.DB.prepare("SELECT detail_for FROM order_source_refs").first()).toEqual({
      detail_for: modified,
    });
  });

  it("rifiuta lo state avviato da un altro utente e registra il rifiuto su eBay", async () => {
    const owner = await verifiedSession("proprietario@example.invalid");
    const other = await verifiedSession("altro@example.invalid");
    const ebay = syntheticEbay();

    const stolen = (await beginStoreLink(owner.cookie)).searchParams.get("state");
    const crossUser = await handleAuthRequest(
      storeCallback(`state=${stolen}&code=codice-sintetico`, other.cookie),
      env,
      ebay,
    );
    expect(crossUser.headers.get("location")).toBe(
      "http://localhost:5173/app/ordini?negozio=errore",
    );

    const denied = (await beginStoreLink(owner.cookie)).searchParams.get("state");
    const deniedCallback = await handleAuthRequest(
      storeCallback(`state=${denied}&error=access_denied`, owner.cookie),
      env,
      ebay,
    );
    expect(deniedCallback.headers.get("location")).toBe(
      "http://localhost:5173/app/ordini?negozio=negato",
    );

    expect(ebay).not.toHaveBeenCalled();
    const stores = await env.DB.prepare("SELECT COUNT(*) AS count FROM ebay_stores").first();
    expect(stores).toEqual({ count: 0 });
  });

  it("mostra la schermata preparatoria solo a chi può collegare e parte per eBay dal suo invio", async () => {
    const { cookie } = await verifiedSession("preparatoria@example.invalid");
    for (const base of ["", "/en"]) {
      const page = await loadStoreLink({
        request: new Request(`http://localhost:5173${base}/app/negozi/collega`, {
          headers: { cookie },
        }),
      } as Parameters<typeof loadStoreLink>[0]);
      expect(page).toEqual({
        language: base ? "en" : "it",
        reconnect: false,
        fromStores: false,
        sandbox: false,
        ebayEnvironment: "production",
        expectedStoreId: null,
        expectedStoreName: null,
        shell: {
          display: { theme: "system", timeZone: "Europe/Rome" },
          notifications: null,
          now: expect.any(String),
        },
      });
    }
    // Da Negozi la schermata riporta lì con «Annulla».
    const reconnect = await loadStoreLink({
      request: new Request("http://localhost:5173/app/negozi/collega?ricollega&da=negozi", {
        headers: { cookie },
      }),
    } as Parameters<typeof loadStoreLink>[0]).catch((response: Response) => response);
    expect((reconnect as Response).status).toBe(400);
    const blockedSandbox = (await startStoreLink({
      request: new Request("http://localhost:5173/app/negozi/collega", {
        method: "POST",
        headers: { cookie, origin: "http://localhost:5173" },
        body: new URLSearchParams({ environment: "sandbox" }),
      }),
    } as Parameters<typeof startStoreLink>[0])) as Response;
    expect(blockedSandbox.status).toBe(403);
    expect((await homeFor(cookie)).page?.view).toBe("no-store");
    expect((await beginStoreLink(cookie)).hostname).toBe("auth.ebay.com");
  });

  it("cifra i token legandoli al negozio e calcola le scadenze del consenso", async () => {
    const { cookie } = await verifiedSession("token-cifrati@example.invalid");
    const state = (await beginStoreLink(cookie)).searchParams.get("state");
    await handleAuthRequest(
      storeCallback(`state=${state}&code=codice`, cookie),
      env,
      syntheticEbay(),
    );

    const row = await env.DB.prepare(
      `SELECT c.* FROM ebay_store_credentials c JOIN ebay_stores s ON s.id = c.store_id`,
    ).first<Record<string, string | null>>();
    expect(row!.access_token).toMatch(/^v1\./u);
    expect(JSON.stringify(row)).not.toMatch(/token-sintetico|refresh-sintetico/u);
    const storeId = row!.store_id!;
    const secret = env.BETTER_AUTH_SECRET;
    expect(await openToken(secret, storeId, "access", row!.access_token!)).toBe("token-sintetico");
    expect(await openToken(secret, storeId, "refresh", row!.refresh_token!)).toBe(
      "refresh-sintetico",
    );
    // Lo stesso valore non si apre come altro tipo, per un altro negozio o con un altro segreto.
    await expect(openToken(secret, storeId, "refresh", row!.access_token!)).rejects.toThrow();
    await expect(openToken(secret, "altro", "access", row!.access_token!)).rejects.toThrow();
    await expect(
      openToken(`${secret}-diverso`, storeId, "access", row!.access_token!),
    ).rejects.toThrow();

    const grantedAt = Date.parse(row!.granted_at!);
    expect(Date.parse(row!.access_expires_at!) - grantedAt).toBe(7200 * 1000);
    expect(Date.parse(row!.refresh_expires_at!) - grantedAt).toBe(47_304_000 * 1000);
    expect(row!.rejected_at).toBeNull();
  });

  it("riconosce lo stesso negozio dopo un cambio di nome eBay e rinnova il consenso", async () => {
    const { cookie } = await verifiedSession("cambio-nome@example.invalid");
    const first = (await beginStoreLink(cookie)).searchParams.get("state");
    await handleAuthRequest(storeCallback(`state=${first}&code=uno`, cookie), env, syntheticEbay());
    await env.DB.prepare("UPDATE ebay_store_credentials SET rejected_at = ?").bind(now).run();

    const second = (await beginStoreLink(cookie)).searchParams.get("state");
    const renamed = await handleAuthRequest(
      storeCallback(`state=${second}&code=due`, cookie),
      env,
      syntheticEbay({ username: "venditore-rinominato" }),
    );
    expect(renamed.headers.get("location")).toBe(
      "http://localhost:5173/app/ordini?negozio=collegato",
    );
    const stores = await env.DB.prepare(
      `SELECT s.display_name, c.rejected_at FROM ebay_stores s
         JOIN ebay_store_credentials c ON c.store_id = s.id`,
    ).all();
    expect(stores.results).toEqual([{ display_name: "venditore-rinominato", rejected_at: null }]);
  });

  it("non associa a un secondo spazio un negozio già collegato e non ne conserva i token", async () => {
    const owner = await verifiedSession("primo-spazio@example.invalid");
    const other = await verifiedSession("secondo-spazio@example.invalid");
    const ownerState = (await beginStoreLink(owner.cookie)).searchParams.get("state");
    await handleAuthRequest(
      storeCallback(`state=${ownerState}&code=uno`, owner.cookie),
      env,
      syntheticEbay(),
    );
    const before = (await env.DB.prepare("SELECT * FROM ebay_store_credentials").all()).results;

    const otherState = (await beginStoreLink(other.cookie)).searchParams.get("state");
    const attempt = await handleAuthRequest(
      storeCallback(`state=${otherState}&code=due`, other.cookie),
      env,
      syntheticEbay({ username: "nome-dal-secondo-tentativo" }),
    );
    expect(attempt.headers.get("location")).toBe(
      "http://localhost:5173/app/ordini?negozio=altro-spazio",
    );
    expect((await env.DB.prepare("SELECT * FROM ebay_store_credentials").all()).results).toEqual(
      before,
    );
    const stores = await env.DB.prepare(
      `SELECT wm.user_id, s.display_name FROM ebay_stores s
         JOIN workspace_members wm ON wm.workspace_id = s.workspace_id`,
    ).all();
    expect(stores.results).toEqual([{ user_id: owner.userId, display_name: "venditore" }]);
    // L'esito è un testo generico: nessun dato dell'altro account FiscalBay.
    const home = await loadHome({
      params: {},
      request: new Request("http://localhost:5173/app/ordini?negozio=altro-spazio", {
        headers: { cookie: other.cookie },
      }),
    } as Parameters<typeof loadHome>[0]);
    expect(home.notice?.text).toBe(
      "Questo negozio eBay è già collegato a un altro account FiscalBay.",
    );
  });

  it.each([
    { response: "HTTP 503", xml: "<Errore/>", status: 503, failure: "unavailable" },
    {
      response: "Ack Failure",
      xml: "<GetOrdersResponse><Ack>Failure</Ack></GetOrdersResponse>",
      status: 200,
      failure: "invalid_response",
    },
    { response: "XML inatteso", xml: "<Errore/>", status: 200, failure: "invalid_response" },
  ])(
    "conserva ordine e collegamento quando Trading risponde $response",
    async ({ xml, status, failure }) => {
      const { cookie, userId } = await verifiedSession("import-fallito@example.invalid");
      const state = (await beginStoreLink(cookie)).searchParams.get("state");
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        const callback = await handleAuthRequest(
          storeCallback(`state=${state}&code=codice`, cookie),
          env,
          syntheticEbay({ trading: () => new Response(xml, { status }) }),
        );
        expect(callback.headers.get("location")).toBe(
          "http://localhost:5173/app/ordini?negozio=collegato",
        );
        // eBay non disponibile ferma l'acquisizione e si registra; una risposta illeggibile
        // riguarda il solo ordine, che riprova più tardi.
        expect(log.mock.calls.map(([line]) => JSON.parse(line as string))).toEqual(
          failure === "unavailable"
            ? [
                expect.objectContaining({
                  code: "UPSTREAM_UNAVAILABLE",
                  operation: "store_link",
                  failure,
                }),
              ]
            : [],
        );
      } finally {
        log.mockRestore();
      }
      expect(
        await env.DB.prepare("SELECT COUNT(*) AS total FROM ebay_store_credentials").first(),
      ).toEqual({ total: 1 });
      expect(await env.DB.prepare("SELECT ebay_order_id FROM orders").all()).toMatchObject({
        results: [{ ebay_order_id: syntheticOrderId }],
      });
      expect(await env.DB.prepare("SELECT COUNT(*) AS total FROM tax_identifiers").first()).toEqual(
        {
          total: 0,
        },
      );
      expect(
        await env.DB.prepare(
          "SELECT detail_for, detail_error, detail_attempts FROM order_source_refs",
        ).first(),
      ).toEqual(
        failure === "unavailable"
          ? { detail_for: null, detail_error: "unavailable", detail_attempts: 0 }
          : { detail_for: null, detail_error: failure, detail_attempts: 1 },
      );
      // Gli ordini sono stati letti: la verifica fiscale è un passo separato.
      expect(
        await env.DB.prepare(
          "SELECT COUNT(*) AS total FROM sync_state WHERE last_success_at IS NOT NULL",
        ).first(),
      ).toEqual({ total: 1 });
      // Senza ordini importati la pagina non chiede di collegare un negozio già collegato.
      await env.DB.prepare("DELETE FROM orders").run();
      const home = await homeFor(cookie);
      expect({ orders: home.page?.orders, view: home.page?.view }).toEqual({
        orders: [],
        view: "empty",
      });
      // Dopo lo scollegamento dell'unico negozio i primi passi ripartono dal collegamento.
      const [store] = await listStores(env.DB, userId);
      expect(await disconnectStore(env.DB, userId, store!.id)).toBe("done");
      const disconnected = await homeFor(cookie);
      expect(disconnected.page?.view).toBe("no-store");
      expect(disconnected.page?.onboarding).toMatchObject([
        { label: "stepAccount", done: true },
        { label: "stepEmail", done: true },
        { label: "stepStore", done: false },
        { label: "stepSync", done: false },
      ]);
    },
  );

  it("non crea il negozio se eBay non scambia il codice", async () => {
    const { cookie } = await verifiedSession("scambio-fallito@example.invalid");
    const state = (await beginStoreLink(cookie)).searchParams.get("state");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const callback = await handleAuthRequest(
        storeCallback(`state=${state}&code=scaduto`, cookie),
        env,
        syntheticEbay({
          token: () => Response.json({ error: "invalid_grant" }, { status: 400 }),
        }),
      );
      expect(callback.headers.get("location")).toBe(
        "http://localhost:5173/app/ordini?negozio=errore",
      );
      expect(log.mock.calls.map(([line]) => JSON.parse(String(line)))).toEqual([
        expect.objectContaining({ event: "application_error", operation: "store_link" }),
      ]);
    } finally {
      log.mockRestore();
    }
    expect(await env.DB.prepare("SELECT COUNT(*) AS total FROM ebay_stores").first()).toEqual({
      total: 0,
    });
  });

  it("torna agli Ordini nella lingua del collegamento, anche senza sessione o con il primo callback in corso", async () => {
    const { cookie, userId } = await verifiedSession("ritorno-callback@example.invalid");
    // eBay parla italiano solo se richiesto; in inglese resta la sua lingua predefinita.
    const englishLink = new URL(await beginLink(env, userId, new Date(), "en"));
    expect(englishLink.searchParams.has("locale")).toBe(false);
    const begin = async (path: string) =>
      new URL(
        (
          (await startStoreLink({
            request: new Request(`http://localhost:5173${path}`, {
              method: "POST",
              headers: { cookie, origin: "http://localhost:5173" },
            }),
          } as Parameters<typeof startStoreLink>[0])) as Response
        ).headers.get("location")!,
      ).searchParams.get("state")!;
    const english = await begin("/en/app/negozi/collega");
    const linked = await handleAuthRequest(
      storeCallback(`state=${english}&code=codice-sintetico`, cookie),
      env,
      syntheticEbay(),
    );
    expect(linked.headers.get("location")).toBe(
      "http://localhost:5173/en/app/ordini?negozio=collegato",
    );
    // Senza sessione nessun collegamento, e nessun errore del server.
    const anonymous = await handleAuthRequest(
      storeCallback(`state=${await begin("/app/negozi/collega")}&code=codice-sintetico`, ""),
      env,
      syntheticEbay(),
    );
    expect(anonymous.headers.get("location")).toBe(
      "http://localhost:5173/app/ordini?negozio=errore",
    );
    // Mentre il primo callback è in corso il secondo torna agli Ordini senza esito.
    const pending = await begin("/app/negozi/collega");
    await claimStoreLinkSession(env.DB, pending);
    const duplicate = await handleAuthRequest(
      storeCallback(`state=${pending}&code=codice-sintetico`, cookie),
      env,
      syntheticEbay(),
    );
    expect(duplicate.headers.get("location")).toBe("http://localhost:5173/app/ordini");
  });
});
