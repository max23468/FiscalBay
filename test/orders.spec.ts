import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildLastModifiedFilter,
  classifyEbayRetry,
  mergeFulfillmentOrders,
  parseFulfillmentPage,
} from "../app/integrations/ebay/fulfillment.server";
import {
  mapTradingTaxIdentifiers,
  parseTradingOrderTaxIdentifiers,
} from "../app/integrations/ebay/tax-identifiers.server";
import { grantFreeOrder, listVisibleOrders } from "../app/domain/orders.server";
import { createAuth } from "../app/auth.server";
import { handleAuthRequest } from "../app/auth-route.server";
import { loader as loadHome } from "../app/routes/home";
import { action as signIn } from "../app/routes/sign-in";
import { action as startStoreLink } from "../app/routes/store-link";

const now = "2026-09-13T20:00:00.000Z";

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM ebay_store_link_sessions"),
    env.DB.prepare("DELETE FROM lifetime_allocations"),
    env.DB.prepare("DELETE FROM order_grants"),
    env.DB.prepare("DELETE FROM free_cycles"),
    env.DB.prepare("DELETE FROM tax_identifiers"),
    env.DB.prepare("DELETE FROM order_items"),
    env.DB.prepare("DELETE FROM orders"),
    env.DB.prepare("DELETE FROM sync_state"),
    env.DB.prepare("DELETE FROM ebay_stores"),
    env.DB.prepare("DELETE FROM workspace_members"),
    env.DB.prepare("DELETE FROM workspaces"),
  ]);
});

async function seed(): Promise<void> {
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO workspaces (id, name, created_at) VALUES ('w-a', 'A', ?), ('w-b', 'B', ?)",
    ).bind(now, now),
    env.DB.prepare(
      "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ('w-a', 'u-a', 'owner'), ('w-b', 'u-b', 'owner')",
    ),
    env.DB.prepare(
      "INSERT INTO ebay_stores (id, workspace_id, ebay_user_id, linked_at) VALUES ('s-a', 'w-a', 'e-a', ?), ('s-b', 'w-b', 'e-b', ?)",
    ).bind(now, now),
    env.DB.prepare(
      `INSERT INTO orders
        (id, store_id, ebay_order_id, creation_time, last_modified_time, currency, total_minor)
       VALUES ('o-a', 's-a', 'ebay-a', ?, ?, 'EUR', 1299),
              ('o-b', 's-b', 'ebay-b', ?, ?, 'EUR', 2599)`,
    ).bind(now, now, now, now),
    env.DB.prepare(
      `INSERT INTO tax_identifiers
        (id, order_id, identifier_type, issuing_country, value, source, observed_at)
       VALUES ('t-a1', 'o-a', 'CODICE_FISCALE', NULL, 'RSSMRA80A01H501U', 'ebay_trading_get_orders', ?),
              ('t-a2', 'o-a', 'VAT_ID', 'IT', '01234567890', 'ebay_trading_get_orders', ?),
              ('t-b', 'o-b', 'CODICE_FISCALE', 'IT', 'BNCLGU80A01H501Z', 'synthetic_fixture', ?)`,
    ).bind(now, now, now),
    env.DB.prepare(
      `INSERT INTO order_items
        (id, order_id, line_item_id, sku, title, quantity, unit_minor)
       VALUES ('i-a1', 'o-a', 'line-a1', 'SKU-A', 'Articolo A', 1, 999),
              ('i-a2', 'o-a', 'line-a2', NULL, 'Articolo B', 2, 150),
              ('i-b', 'o-b', 'line-b', 'SKU-B', 'Articolo B', 1, 2599)`,
    ),
    env.DB.prepare(
      `INSERT INTO free_cycles
        (id, workspace_id, starts_at, ends_at, quota)
       VALUES ('c-a', 'w-a', '2026-09-01T00:00:00Z', '2026-10-01T00:00:00Z', 1)`,
    ),
  ]);
}

describe("percorso ordini", () => {
  it("lega la pagina ordini alla sessione e al tenant senza consenso eBay", async () => {
    await seed();

    const anonymous = await loadHome({
      request: new Request("http://localhost:5173/"),
    } as Parameters<typeof loadHome>[0]);
    expect(anonymous).toEqual({
      authenticated: false,
      language: "it",
      signInNotice: null,
      orders: [],
    });

    const auth = createAuth(env);
    await auth.handler(
      new Request("http://localhost:5173/api/auth/sign-up/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Utente ordini",
          email: "orders@example.invalid",
          password: "Una-password-orders-molto-lunga",
        }),
      }),
    );
    const user = await env.DB.prepare('SELECT id FROM "user" WHERE email = ?')
      .bind("orders@example.invalid")
      .first<{ id: string }>();
    expect(user).not.toBeNull();
    await env.DB.batch([
      env.DB.prepare('UPDATE "user" SET "emailVerified" = 1 WHERE id = ?').bind(user!.id),
      env.DB.prepare("UPDATE workspace_members SET user_id = ? WHERE workspace_id = 'w-a'").bind(
        user!.id,
      ),
    ]);

    const signIn = await auth.handler(
      new Request("http://localhost:5173/api/auth/sign-in/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "orders@example.invalid",
          password: "Una-password-orders-molto-lunga",
        }),
      }),
    );
    expect(signIn.status).toBe(200);
    const cookie = signIn.headers.get("set-cookie");
    expect(cookie).toBeTruthy();

    const authenticated = await loadHome({
      request: new Request("http://localhost:5173/", { headers: { cookie: cookie! } }),
    } as Parameters<typeof loadHome>[0]);
    expect(authenticated.authenticated).toBe(true);
    expect(authenticated.orders.map(({ ebayOrderId }) => ebayOrderId)).toEqual(["ebay-a"]);
  });

  it("conserva l'ultima osservazione anche per un ordine vecchio modificato nell'overlap", () => {
    const first = parseFulfillmentPage({
      orders: [
        { orderId: "order-a", orderFulfillmentStatus: "NOT_STARTED" },
        {
          orderId: "order-b",
          creationDate: "2026-06-01T08:00:00.000Z",
          lastModifiedDate: "2026-09-20T11:55:00.000Z",
          orderFulfillmentStatus: "NOT_STARTED",
        },
      ],
      total: 2,
    });
    const second = parseFulfillmentPage({
      orders: [
        {
          orderId: "order-b",
          creationDate: "2026-06-01T08:00:00.000Z",
          lastModifiedDate: "2026-09-20T12:05:00.000Z",
          orderFulfillmentStatus: "FULFILLED",
        },
      ],
      total: 1,
    });

    expect(mergeFulfillmentOrders([first, second])).toEqual([
      { orderId: "order-a", orderFulfillmentStatus: "NOT_STARTED" },
      {
        orderId: "order-b",
        creationDate: "2026-06-01T08:00:00.000Z",
        lastModifiedDate: "2026-09-20T12:05:00.000Z",
        orderFulfillmentStatus: "FULFILLED",
      },
    ]);
    expect(
      buildLastModifiedFilter(
        new Date("2026-09-20T12:00:00.000Z"),
        new Date("2026-09-20T12:30:00.000Z"),
        60 * 60 * 1000,
      ),
    ).toBe("lastmodifieddate:[2026-09-20T11:00:00.000Z..2026-09-20T12:30:00.000Z]");
    expect(() =>
      buildLastModifiedFilter(
        new Date("2026-09-20T12:00:00.000Z"),
        new Date("2026-09-20T12:30:00.000Z"),
        Number.NaN,
      ),
    ).toThrow("Intervallo incrementale eBay non valido");
  });

  it("classifica i retry eBay senza riprovare gli errori client definitivi", () => {
    expect(classifyEbayRetry(400, null, 1)).toEqual({ retryable: false });
    expect(classifyEbayRetry(429, "120", 1)).toEqual({
      retryable: true,
      delaySeconds: 120,
    });
    expect(classifyEbayRetry(503, null, 3)).toEqual({
      retryable: true,
      delaySeconds: 4,
    });
  });

  it("mostra i dati fiscali dell'ordine sbloccato solo al tenant proprietario", async () => {
    await seed();
    await grantFreeOrder(env.DB, "u-a", {
      id: "g-a",
      workspaceId: "w-a",
      orderId: "o-a",
      cycleId: "c-a",
      grantedAt: now,
    });

    const ownerOrders = await listVisibleOrders(env.DB, "u-a");
    const otherTenantOrders = await listVisibleOrders(env.DB, "u-b");

    expect(ownerOrders).toHaveLength(1);
    expect(ownerOrders[0]?.taxIdentifiers).toEqual([
      {
        type: "CODICE_FISCALE",
        issuingCountry: null,
        value: "RSSMRA80A01H501U",
        source: "ebay_trading_get_orders",
      },
      {
        type: "VAT_ID",
        issuingCountry: "IT",
        value: "01234567890",
        source: "ebay_trading_get_orders",
      },
    ]);
    expect(otherTenantOrders[0]?.taxIdentifiers).toEqual([]);
  });

  it("mappa la fonte fiscale Trading senza inventare il Paese emittente", () => {
    expect(
      mapTradingTaxIdentifiers([
        { id: "SYNTHETIC-ID", type: "CODICE_FISCALE" },
        {
          id: "SYNTHETIC-VAT",
          type: "VAT_ID",
          attributes: [{ name: "IssuingCountry", value: "IT" }],
        },
      ]),
    ).toEqual([
      {
        type: "CODICE_FISCALE",
        issuingCountry: null,
        value: "SYNTHETIC-ID",
        source: "ebay_trading_get_orders",
      },
      {
        type: "VAT_ID",
        issuingCountry: "IT",
        value: "SYNTHETIC-VAT",
        source: "ebay_trading_get_orders",
      },
    ]);
  });

  it("consuma la quota una sola volta con due sblocchi concorrenti", async () => {
    await seed();
    await env.DB.prepare(
      `INSERT INTO orders
        (id, store_id, ebay_order_id, creation_time, last_modified_time, currency, total_minor)
       VALUES ('o-a2', 's-a', 'ebay-a2', ?, ?, 'EUR', 3999)`,
    )
      .bind(now, now)
      .run();
    await env.DB.prepare(
      "INSERT INTO tax_identifiers (id, order_id, identifier_type, value, source, observed_at) VALUES ('t-a3', 'o-a2', 'VAT_ID', '01234567890', 'synthetic_fixture', ?)",
    )
      .bind(now)
      .run();
    const outcomes = await Promise.allSettled([
      grantFreeOrder(env.DB, "u-a", {
        id: "g-a",
        workspaceId: "w-a",
        orderId: "o-a",
        cycleId: "c-a",
        grantedAt: now,
      }),
      grantFreeOrder(env.DB, "u-a", {
        id: "g-a2",
        workspaceId: "w-a",
        orderId: "o-a2",
        cycleId: "c-a",
        grantedAt: now,
      }),
    ]);

    expect(outcomes.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter(({ status }) => status === "rejected")).toHaveLength(1);

    const cycle = await env.DB.prepare(
      "SELECT used, quota FROM free_cycles WHERE id = 'c-a'",
    ).first<{ used: number; quota: number }>();
    expect(cycle).toEqual({ used: 1, quota: 1 });
  });

  it("rifiuta un grant per un ordine di un altro workspace", async () => {
    await seed();

    await expect(
      grantFreeOrder(env.DB, "u-a", {
        id: "g-cross-tenant",
        workspaceId: "w-a",
        orderId: "o-b",
        cycleId: "c-a",
        grantedAt: now,
      }),
    ).rejects.toThrow();

    const cycle = await env.DB.prepare(
      "SELECT used, quota FROM free_cycles WHERE id = 'c-a'",
    ).first<{ used: number; quota: number }>();
    expect(cycle).toEqual({ used: 0, quota: 1 });
  });

  it("nega sblocco senza appartenenza, dato fiscale o ciclo valido", async () => {
    await seed();
    const input = { workspaceId: "w-a", orderId: "o-a", cycleId: "c-a", grantedAt: now };
    await expect(grantFreeOrder(env.DB, "u-b", { id: "g-other", ...input })).rejects.toThrow();
    await env.DB.prepare("DELETE FROM tax_identifiers WHERE order_id = 'o-a'").run();
    await expect(grantFreeOrder(env.DB, "u-a", { id: "g-empty", ...input })).rejects.toThrow();
    await expect(
      env.DB.prepare(
        "INSERT INTO order_grants (id, workspace_id, order_id, source, granted_at) VALUES ('g-premature', 'w-a', 'o-a', 'premium', ?)",
      )
        .bind(now)
        .run(),
    ).rejects.toThrow();
    await env.DB.prepare(
      "INSERT INTO tax_identifiers (id, order_id, identifier_type, value, source, observed_at) VALUES ('t-new', 'o-a', 'VAT_ID', '01234567890', 'synthetic_fixture', ?)",
    )
      .bind(now)
      .run();
    await expect(
      grantFreeOrder(env.DB, "u-a", {
        id: "g-expired",
        ...input,
        grantedAt: "2026-10-01T00:00:00.000Z",
      }),
    ).rejects.toThrow();
    expect(await env.DB.prepare("SELECT used FROM free_cycles WHERE id = 'c-a'").first()).toEqual({
      used: 0,
    });
  });

  it("annulla il duplicato senza consumare ancora quota o cambiare proprietario", async () => {
    await seed();
    const input = { workspaceId: "w-a", orderId: "o-a", cycleId: "c-a", grantedAt: now };
    await grantFreeOrder(env.DB, "u-a", { id: "g-first", ...input });
    await expect(grantFreeOrder(env.DB, "u-a", { id: "g-second", ...input })).rejects.toThrow();
    await expect(
      env.DB.prepare("UPDATE order_grants SET workspace_id = 'w-b' WHERE id = 'g-first'").run(),
    ).rejects.toThrow();
    expect(await env.DB.prepare("SELECT used FROM free_cycles WHERE id = 'c-a'").first()).toEqual({
      used: 1,
    });
    expect(
      await env.DB.prepare("SELECT workspace_id FROM order_grants WHERE id = 'g-first'").first(),
    ).toEqual({ workspace_id: "w-a" });
  });

  it("vincola a un solo spazio per utente e ai venti posti lifetime", async () => {
    await seed();
    await expect(
      env.DB.prepare(
        "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ('w-b', 'u-a', 'owner')",
      ).run(),
    ).rejects.toThrow();
    await expect(
      env.DB.prepare(
        "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ('w-a', 'u-c', 'owner')",
      ).run(),
    ).rejects.toThrow();
    await env.DB.prepare(
      "INSERT INTO lifetime_allocations (slot, workspace_id, status, created_at) VALUES (20, 'w-a', 'reserved', ?)",
    )
      .bind(now)
      .run();
    await expect(
      env.DB.prepare(
        "INSERT INTO lifetime_allocations (slot, workspace_id, status, created_at) VALUES (20, 'w-b', 'reserved', ?)",
      )
        .bind(now)
        .run(),
    ).rejects.toThrow();
    await expect(
      env.DB.prepare(
        "INSERT INTO lifetime_allocations (slot, workspace_id, status, created_at) VALUES (21, 'w-b', 'reserved', ?)",
      )
        .bind(now)
        .run(),
    ).rejects.toThrow();
    await expect(
      env.DB.prepare(
        "INSERT INTO lifetime_allocations (slot, workspace_id, status, created_at) VALUES (19, 'w-a', 'reserved', ?)",
      )
        .bind(now)
        .run(),
    ).rejects.toThrow();
    expect(
      await env.DB.prepare("SELECT COUNT(*) AS total FROM lifetime_allocations").first(),
    ).toEqual({ total: 1 });
  });

  it("assegna l'ultimo posto lifetime una volta sola sotto concorrenza", async () => {
    await seed();
    const outcomes = await Promise.allSettled([
      env.DB.prepare(
        "INSERT INTO lifetime_allocations (slot, workspace_id, status, created_at) VALUES (20, 'w-a', 'reserved', ?)",
      )
        .bind(now)
        .run(),
      env.DB.prepare(
        "INSERT INTO lifetime_allocations (slot, workspace_id, status, created_at) VALUES (20, 'w-b', 'reserved', ?)",
      )
        .bind(now)
        .run(),
    ]);
    expect(outcomes.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter(({ status }) => status === "rejected")).toHaveLength(1);
    expect(
      await env.DB.prepare("SELECT COUNT(*) AS total FROM lifetime_allocations").first(),
    ).toEqual({ total: 1 });
  });
});

const syntheticOrderId = "12-00000-00001";
const syntheticTradingXml = `<?xml version="1.0" encoding="UTF-8"?>
<GetOrdersResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Ack>Success</Ack>
  <OrderArray>
    <Order>
      <OrderID>${syntheticOrderId}</OrderID>
      <BuyerTaxIdentifier><Type>CODICE_FISCALE</Type><ID>SYNTHETIC&amp;ID</ID></BuyerTaxIdentifier>
    </Order>
    <Order>
      <OrderID>12-00000-00002</OrderID>
      <BuyerTaxIdentifier><Type>VAT_ID</Type><ID>ALTRO-ORDINE</ID></BuyerTaxIdentifier>
    </Order>
  </OrderArray>
</GetOrdersResponse>`;

function syntheticEbay() {
  return vi.fn<typeof fetch>(async (input) => {
    const url = String(input);
    if (url.endsWith("/identity/v1/oauth2/token")) {
      return Response.json({ access_token: "token-sintetico" });
    }
    if (url.includes("/commerce/identity/v1/user/")) {
      return Response.json({ userId: "ebay-user-sintetico", username: "venditore" });
    }
    if (url.includes("/sell/fulfillment/v1/order")) {
      return Response.json({
        orders: [
          {
            orderId: syntheticOrderId,
            creationDate: "2026-09-20T10:00:00.000Z",
            lastModifiedDate: "2026-09-20T11:00:00.000Z",
            pricingSummary: { total: { value: "12.5", currency: "EUR" } },
          },
        ],
        total: 1,
      });
    }
    if (url.endsWith("/ws/api.dll")) return new Response(syntheticTradingXml);
    return new Response(null, { status: 404 });
  });
}

async function verifiedSession(email: string): Promise<{ userId: string; cookie: string }> {
  const auth = createAuth(env);
  const password = "Una-password-negozio-molto-lunga";
  await auth.handler(
    new Request("http://localhost:5173/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Venditore", email, password }),
    }),
  );
  const user = await env.DB.prepare('SELECT id FROM "user" WHERE email = ?')
    .bind(email)
    .first<{ id: string }>();
  await env.DB.prepare('UPDATE "user" SET "emailVerified" = 1 WHERE id = ?').bind(user!.id).run();
  const signIn = await auth.handler(
    new Request("http://localhost:5173/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),
  );
  return { userId: user!.id, cookie: signIn.headers.get("set-cookie")! };
}

async function beginStoreLink(cookie: string): Promise<URL> {
  const response = (await startStoreLink({
    request: new Request("http://localhost:5173/negozi/collega", {
      method: "POST",
      headers: { cookie, origin: "http://localhost:5173" },
    }),
  } as Parameters<typeof startStoreLink>[0])) as Response;
  expect(response.status).toBe(303);
  return new URL(response.headers.get("location")!);
}

function storeCallback(query: string, cookie: string): Request {
  return new Request(`http://localhost:5173/api/auth/callback/ebay?${query}`, {
    headers: { cookie },
  });
}

describe("collegamento negozio eBay", () => {
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
    expect(accepted.headers.get("location")).toBe("/");
    expect(accepted.headers.getSetCookie().join(";")).toContain("session_token");

    const rejected = await submit("password-sbagliata-ma-lunga");
    expect(rejected.headers.get("location")).toBe("/?accesso=errore");
    expect(rejected.headers.getSetCookie()).toEqual([]);

    const signUp = (await signIn({
      request: new Request("http://localhost:5173/accesso", {
        method: "POST",
        headers: { origin: "http://localhost:5173" },
        body: new URLSearchParams({
          intent: "registrati",
          email: "nuovo@example.invalid",
          password: "Una-password-nuova-molto-lunga",
        }),
      }),
    } as Parameters<typeof signIn>[0])) as Response;
    expect(signUp.headers.get("location")).toBe("/?accesso=registrato");
    expect(signUp.headers.getSetCookie()).toEqual([]);
    const created = await env.DB.prepare('SELECT "emailVerified" FROM "user" WHERE email = ?')
      .bind("nuovo@example.invalid")
      .first();
    expect(created).toEqual({ emailVerified: 0 });

    expect(
      (await submit("Una-password-negozio-molto-lunga", "https://esempio.invalid")).status,
    ).toBe(403);
  });

  it("legge l'osservazione fiscale Trading del solo ordine richiesto", () => {
    expect(parseTradingOrderTaxIdentifiers(syntheticTradingXml, syntheticOrderId)).toEqual([
      { id: "SYNTHETIC&ID", type: "CODICE_FISCALE", attributes: [] },
    ]);
    expect(() =>
      parseTradingOrderTaxIdentifiers("<GetOrdersResponse><Ack>Failure</Ack>", syntheticOrderId),
    ).toThrow("trading_get_orders_failed");
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
    const state = authorize.searchParams.get("state")!;

    const ebay = syntheticEbay();
    const callback = await handleAuthRequest(
      storeCallback(`state=${state}&code=codice-sintetico`, cookie),
      env,
      ebay,
    );
    expect(callback.status).toBe(303);
    expect(callback.headers.get("location")).toBe("http://localhost:5173/?negozio=collegato");
    expect(callback.headers.get("cache-control")).toBe("no-store");
    expect(ebay).toHaveBeenCalledTimes(4);

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
      request: new Request("http://localhost:5173/?negozio=collegato", { headers: { cookie } }),
    } as Parameters<typeof loadHome>[0]);
    expect(home.storeNotice).toBe("Negozio eBay collegato.");
    expect(
      home.orders.map(({ ebayOrderId, taxIdentifiers }) => [ebayOrderId, taxIdentifiers]),
    ).toEqual([[syntheticOrderId, []]]);

    const replay = await handleAuthRequest(
      storeCallback(`state=${state}&code=codice-sintetico`, cookie),
      env,
      ebay,
    );
    expect(replay.headers.get("location")).not.toContain("negozio=collegato");
    expect(ebay).toHaveBeenCalledTimes(4);
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
    expect(crossUser.headers.get("location")).toBe("http://localhost:5173/?negozio=errore");

    const denied = (await beginStoreLink(owner.cookie)).searchParams.get("state");
    const deniedCallback = await handleAuthRequest(
      storeCallback(`state=${denied}&error=access_denied`, owner.cookie),
      env,
      ebay,
    );
    expect(deniedCallback.headers.get("location")).toBe("http://localhost:5173/?negozio=negato");

    expect(ebay).not.toHaveBeenCalled();
    const stores = await env.DB.prepare("SELECT COUNT(*) AS count FROM ebay_stores").first();
    expect(stores).toEqual({ count: 0 });
  });
});
