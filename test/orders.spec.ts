import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  buildLastModifiedFilter,
  classifyEbayRetry,
  mergeFulfillmentOrders,
  parseFulfillmentPage,
  orderSummarySchema,
} from "../app/integrations/ebay/fulfillment.server";
import {
  mapTradingTaxIdentifiers,
  parseTradingOrderTaxIdentifiers,
} from "../app/integrations/ebay/tax-identifiers.server";
import { grantFreeOrder, listVisibleOrders } from "../app/domain/orders.server";
import { forwardToAuth } from "../app/auth-route.server";
import { completeRegistration, legalVersions } from "../app/domain/registration.server";
import { createAuth } from "../app/auth.server";
import { handleAuthRequest } from "../app/auth-route.server";
import { loader as loadHome } from "../app/routes/home";
import { action as signIn } from "../app/routes/sign-in";
import { loader as loadLegal } from "../app/routes/legal";
import { action as startStoreLink, loader as loadStoreLink } from "../app/routes/store-link";
import {
  openToken,
  refreshExpiringTokens,
  refreshStoreToken,
  sealToken,
} from "../app/integrations/ebay/seller-credentials.server";
import { UpstreamError, upstreamJson, upstreamText } from "../app/integrations/http.server";

const now = "2026-09-13T20:00:00.000Z";
const syntheticProfile = {
  firstName: "Utente",
  lastName: "Sintetico",
  accountType: "private",
  companyName: null,
} as const;

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM ebay_store_link_sessions"),
    env.DB.prepare("DELETE FROM ebay_store_credentials"),
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
      notice: null,
      orders: [],
      resetToken: null,
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
    await completeRegistration(env.DB, {
      userId: user!.id,
      language: "it",
      now: new Date(now),
      profile: syntheticProfile,
      agreement: { marketing: false },
    });

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
    expect(ownerOrders[0]).toMatchObject({
      storeName: "e-a",
      fiscalState: "available",
      summary: null,
    });
    expect(otherTenantOrders[0]).toMatchObject({ storeName: "e-b", fiscalState: "locked" });
  });

  it("distingue dati bloccati e disponibilità non verificata senza esporre identificativi", async () => {
    await seed();
    const before = await listVisibleOrders(env.DB, "u-a");
    expect(before[0]?.fiscalState).toBe("locked");
    expect(JSON.stringify(before)).not.toContain("RSSMRA80A01H501U");
    await env.DB.prepare("DELETE FROM tax_identifiers WHERE order_id = 'o-a'").run();
    expect((await listVisibleOrders(env.DB, "u-a"))[0]?.fiscalState).toBe("unchecked");
  });

  it("il riepilogo conserva solo campi validati e scarta dati fiscali anche annidati", () => {
    const summary = orderSummarySchema.parse({
      buyer: { username: "acquirente-sintetico", taxIdentifier: { value: "NON-ESPORRE" } },
      orderPaymentStatus: "PAID",
      orderFulfillmentStatus: "FULFILLED",
      lineItems: [
        { lineItemId: "riga", title: "Articolo", quantity: 2, taxIdentifier: "NON-ESPORRE" },
      ],
      taxIdentifier: "NON-ESPORRE",
    });
    expect(summary.lineItems?.[0]?.quantity).toBe(2);
    expect(JSON.stringify(summary)).not.toContain("NON-ESPORRE");
    expect(() =>
      orderSummarySchema.parse({ lineItems: [{ lineItemId: "riga", title: {}, quantity: 0 }] }),
    ).toThrow();
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

function syntheticEbay(
  options: { username?: string; trading?: () => Response; token?: () => Response } = {},
) {
  return vi.fn<typeof fetch>(async (input) => {
    const url = String(input);
    if (url.endsWith("/identity/v1/oauth2/token")) {
      if (options.token) return options.token();
      return Response.json({
        access_token: "token-sintetico",
        expires_in: 7200,
        refresh_token: "refresh-sintetico",
        refresh_token_expires_in: 47_304_000,
      });
    }
    if (url.includes("/commerce/identity/v1/user/")) {
      return Response.json({
        userId: "ebay-user-sintetico",
        username: options.username ?? "venditore",
      });
    }
    if (url.includes("/sell/fulfillment/v1/order")) {
      return Response.json({
        orders: [
          {
            orderId: syntheticOrderId,
            creationDate: "2026-09-20T10:00:00.000Z",
            lastModifiedDate: "2026-09-20T11:00:00.000Z",
            pricingSummary: { total: { value: "12.5", currency: "EUR" } },
            buyer: { username: "acquirente-sintetico", taxIdentifier: { value: "NON-ESPORRE" } },
            orderPaymentStatus: "PAID",
            orderFulfillmentStatus: "NOT_STARTED",
            lineItems: [
              {
                lineItemId: "riga-sintetica",
                title: "Articolo sintetico",
                quantity: 2,
                sku: "SKU-SINTETICO",
              },
            ],
          },
        ],
        total: 1,
      });
    }
    if (url.endsWith("/ws/api.dll")) {
      return options.trading?.() ?? new Response(syntheticTradingXml);
    }
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
  await completeRegistration(env.DB, {
    userId: user!.id,
    language: "it",
    now: new Date(now),
    profile: syntheticProfile,
    agreement: { marketing: false },
  });
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

function accessForm(path: string, fields: Record<string, string>, cookie?: string) {
  return signIn({
    request: new Request(`http://localhost:5173${path}`, {
      method: "POST",
      headers: { origin: "http://localhost:5173", ...(cookie ? { cookie } : {}) },
      body: new URLSearchParams(fields),
    }),
  } as Parameters<typeof signIn>[0]) as Promise<Response>;
}

function sessionCookie(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

async function homeFor(cookie: string) {
  return loadHome({
    request: new Request("http://localhost:5173/", { headers: { cookie } }),
  } as Parameters<typeof loadHome>[0]);
}

async function agreements(userId: string) {
  const terms = await env.DB.prepare(
    "SELECT terms_version, privacy_version, language FROM terms_acceptances WHERE user_id = ?",
  )
    .bind(userId)
    .all();
  const marketing = await env.DB.prepare(
    "SELECT granted, text_version, language FROM marketing_consents WHERE user_id = ? ORDER BY recorded_at",
  )
    .bind(userId)
    .all();
  return { terms: terms.results, marketing: marketing.results };
}

async function storeLinkSessions(): Promise<number> {
  const row = await env.DB.prepare("SELECT COUNT(*) AS total FROM ebay_store_link_sessions").first<{
    total: number;
  }>();
  return row!.total;
}

async function profileOf(userId: string) {
  return env.DB.prepare(
    "SELECT first_name, last_name, account_type, company_name FROM user_profiles WHERE user_id = ?",
  )
    .bind(userId)
    .first();
}

describe("registrazione e verifica del contatto", () => {
  const password = "Una-password-registrazione-lunga";
  const person = { tipo: "privato", nome: "Mario", cognome: "Rossi" };

  it("registra senza consensi preselezionati e apre una sessione non verificata che esplora ma non collega negozi", async () => {
    const email = "registrazione@example.invalid";
    const rejected = [
      [{ intent: "registrati", email, password, termini: "on" }, "dati"],
      [{ intent: "registrati", ...person, cognome: " ", email, password, termini: "on" }, "dati"],
      [{ intent: "registrati", ...person, email, password }, "termini"],
    ] as const;
    for (const [fields, outcome] of rejected) {
      const response = await accessForm("/accesso", fields);
      expect(response.headers.get("location")).toBe(`/?accesso=${outcome}`);
      expect(response.headers.getSetCookie()).toEqual([]);
    }
    expect(
      await env.DB.prepare('SELECT id FROM "user" WHERE email = ?').bind(email).first(),
    ).toBeNull();

    const created = await accessForm("/en/accesso", {
      intent: "registrati",
      ...person,
      email,
      password,
      termini: "on",
    });
    expect(created.status).toBe(303);
    expect(created.headers.get("location")).toBe("/en?accesso=registrato");
    const cookie = sessionCookie(created);
    expect(cookie).toContain("session_token");
    const user = await env.DB.prepare(
      'SELECT id, name, "emailVerified" FROM "user" WHERE email = ?',
    )
      .bind(email)
      .first<{ id: string; name: string; emailVerified: number }>();
    expect(user).toMatchObject({ name: "Mario Rossi", emailVerified: 0 });
    expect(await profileOf(user!.id)).toEqual({
      first_name: "Mario",
      last_name: "Rossi",
      account_type: "private",
      company_name: null,
    });
    expect(await agreements(user!.id)).toEqual({
      terms: [
        {
          terms_version: legalVersions.terms,
          privacy_version: legalVersions.privacy,
          language: "en",
        },
      ],
      marketing: [{ granted: 0, text_version: legalVersions.marketing, language: "en" }],
    });

    expect(await homeFor(cookie)).toMatchObject({
      authenticated: true,
      email,
      emailVerified: false,
      needsProfile: false,
      needsAgreement: false,
      orders: [],
    });
    const link = (await startStoreLink({
      request: new Request("http://localhost:5173/negozi/collega", {
        method: "POST",
        headers: { cookie, origin: "http://localhost:5173" },
      }),
    } as Parameters<typeof startStoreLink>[0])) as Response;
    expect(link.headers.get("location")).toBe("/?negozio=accesso");
    expect(await storeLinkSessions()).toBe(0);

    const resent = await accessForm("/accesso", { intent: "verifica" }, cookie);
    expect(resent.headers.get("location")).toBe("/?accesso=verifica-inviata");

    const duplicate = await accessForm("/accesso", {
      intent: "registrati",
      ...person,
      email,
      password,
      termini: "on",
    });
    expect(duplicate.headers.get("location")).toBe("/?accesso=registrazione");
    expect(duplicate.headers.getSetCookie()).toEqual([]);
  });

  it("registra un'azienda solo con la ragione sociale, senza dati fiscali", async () => {
    const email = "azienda@example.invalid";
    const business = { intent: "registrati", tipo: "azienda", nome: "Anna", cognome: "Bianchi" };
    const missing = await accessForm("/accesso", { ...business, email, password, termini: "on" });
    expect(missing.headers.get("location")).toBe("/?accesso=dati");

    const created = await accessForm("/accesso", {
      ...business,
      ragione_sociale: "  Bianchi Ricambi S.r.l. ",
      email,
      password,
      termini: "on",
    });
    expect(created.headers.get("location")).toBe("/?accesso=registrato");
    const user = await env.DB.prepare('SELECT id FROM "user" WHERE email = ?')
      .bind(email)
      .first<{ id: string }>();
    expect(await profileOf(user!.id)).toEqual({
      first_name: "Anna",
      last_name: "Bianchi",
      account_type: "business",
      company_name: "Bianchi Ricambi S.r.l.",
    });

    // La ragione sociale di un privato non viene conservata.
    const privateUser = await accessForm("/accesso", {
      intent: "registrati",
      ...person,
      ragione_sociale: "Ignorata",
      email: "privato@example.invalid",
      password,
      termini: "on",
    });
    const privateId = await env.DB.prepare('SELECT id FROM "user" WHERE email = ?')
      .bind("privato@example.invalid")
      .first<{ id: string }>();
    expect(privateUser.headers.get("location")).toBe("/?accesso=registrato");
    expect(await profileOf(privateId!.id)).toMatchObject({ company_name: null });
  });

  it("chiede profilo e Termini a chi entra senza averli completati prima di mostrare ordini o collegare negozi", async () => {
    const auth = createAuth(env);
    const email = "senza-termini@example.invalid";
    await auth.handler(
      new Request("http://localhost:5173/api/auth/sign-up/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Luca De Santis", email, password }),
      }),
    );
    const user = await env.DB.prepare('SELECT id FROM "user" WHERE email = ?')
      .bind(email)
      .first<{ id: string }>();
    await env.DB.prepare('UPDATE "user" SET "emailVerified" = 1 WHERE id = ?').bind(user!.id).run();
    const cookie = sessionCookie(await accessForm("/accesso", { email, password }));

    expect(await homeFor(cookie)).toMatchObject({
      needsProfile: true,
      needsAgreement: true,
      suggestedName: { firstName: "Luca", lastName: "De Santis" },
      orders: [],
    });
    // Anche uno username eBay con spazi non prova nome e cognome della persona.
    await env.DB.prepare(
      'INSERT INTO "account" (id, "accountId", "providerId", "userId", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?)',
    )
      .bind("ebay-profilo", "ebay-profilo", "ebay", user!.id, now, now)
      .run();
    expect(await homeFor(cookie)).toMatchObject({
      needsProfile: true,
      suggestedName: { firstName: "", lastName: "" },
    });
    const blocked = (await startStoreLink({
      request: new Request("http://localhost:5173/negozi/collega", {
        method: "POST",
        headers: { cookie, origin: "http://localhost:5173" },
      }),
    } as Parameters<typeof startStoreLink>[0])) as Response;
    expect(blocked.headers.get("location")).toBe("/");
    expect(await storeLinkSessions()).toBe(0);

    const complete = (fields: Record<string, string>) =>
      accessForm("/accesso", { intent: "completa", ...fields }, cookie).then((response) =>
        response.headers.get("location"),
      );
    expect(await complete({ termini: "on" })).toBe("/?accesso=dati");
    expect(await complete({ ...person, marketing: "on" })).toBe("/?accesso=termini");
    expect(await agreements(user!.id)).toEqual({ terms: [], marketing: [] });
    expect(await complete({ ...person, termini: "on", marketing: "on" })).toBe("/");
    expect(await profileOf(user!.id)).toMatchObject({ first_name: "Mario", last_name: "Rossi" });
    expect(await agreements(user!.id)).toEqual({
      terms: [
        {
          terms_version: legalVersions.terms,
          privacy_version: legalVersions.privacy,
          language: "it",
        },
      ],
      marketing: [{ granted: 1, text_version: legalVersions.marketing, language: "it" }],
    });
    expect(await homeFor(cookie)).toMatchObject({
      needsProfile: false,
      needsAgreement: false,
      emailVerified: true,
    });
    expect((await beginStoreLink(cookie)).hostname).toBe("auth.ebay.com");

    // Le registrazioni precedenti usavano l'email come nome: non va proposta come nome.
    const legacyEmail = "nome-email@example.invalid";
    await auth.handler(
      new Request("http://localhost:5173/api/auth/sign-up/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: legacyEmail, email: legacyEmail, password }),
      }),
    );
    const legacy = sessionCookie(await accessForm("/accesso", { email: legacyEmail, password }));
    expect(await homeFor(legacy)).toMatchObject({
      needsProfile: true,
      canLinkStore: false,
      suggestedName: { firstName: "", lastName: "" },
    });
  });

  it("limita per IP i tentativi dei moduli su un ambiente distribuito, contando su D1", async () => {
    const deployed = { ...env, APP_ORIGIN: "https://test.fiscalbay.it" };
    const attempt = (ip: string) =>
      forwardToAuth(
        deployed,
        new Request("https://test.fiscalbay.it/accesso", {
          method: "POST",
          headers: { origin: "https://test.fiscalbay.it", "cf-connecting-ip": ip },
        }),
        "/sign-in/email",
        { email: "tentativi@example.invalid", password: "password-sbagliata-lunga" },
      ).then((response) => response.status);

    const statuses = [];
    for (let index = 0; index < 4; index += 1) statuses.push(await attempt("203.0.113.7"));
    expect(statuses).toEqual([401, 401, 401, 429]);
    expect(await attempt("203.0.113.8")).toBe(401);
    // La route diretta condivide il contatore; la lettura della sessione non ne scrive.
    const direct = await handleAuthRequest(
      new Request("https://test.fiscalbay.it/api/auth/sign-in/email", {
        method: "POST",
        headers: {
          origin: "https://test.fiscalbay.it",
          "content-type": "application/json",
          "cf-connecting-ip": "203.0.113.7",
        },
        body: JSON.stringify({ email: "tentativi@example.invalid", password: "altra-password" }),
      }),
      deployed,
    );
    expect(direct.status).toBe(429);
    expect(direct.headers.get("retry-after")).toMatch(/^\d+$/u);
    for (let index = 0; index < 3; index += 1) {
      const session = await handleAuthRequest(
        new Request("https://test.fiscalbay.it/api/auth/get-session", {
          headers: { "cf-connecting-ip": "203.0.113.7" },
        }),
        deployed,
      );
      expect(session.status).toBe(200);
    }
    // Gli indirizzi della stessa rete IPv6 /64 condividono il contatore.
    const ipv6 = [
      "2001:db8:1:2::1",
      "2001:db8:1:2:aa:bb:cc:dd",
      "2001:db8:1:2::9",
      "2001:db8:1:2::ff",
    ];
    const ipv6Statuses = [];
    for (const ip of ipv6) ipv6Statuses.push(await attempt(ip));
    expect(ipv6Statuses).toEqual([401, 401, 401, 429]);
    const counters = await env.DB.prepare('SELECT COUNT(*) AS total FROM "rateLimit"').first<{
      total: number;
    }>();
    expect(counters!.total).toBe(3);

    // Una finestra scaduta riparte da uno invece di restare bloccata.
    await env.DB.prepare('UPDATE "rateLimit" SET "lastRequest" = "lastRequest" - 60000').run();
    expect(await attempt("203.0.113.7")).toBe(401);
    const reset = await env.DB.prepare('SELECT "count" FROM "rateLimit" WHERE "key" LIKE ?')
      .bind("203.0.113.7%")
      .first<{ count: number }>();
    expect(reset!.count).toBe(1);
  });

  it("avvia l'accesso Google dal modulo con il callback dell'ambiente", async () => {
    const response = await accessForm("/accesso", { intent: "google" });
    expect(response.status).toBe(303);
    const location = new URL(response.headers.get("location")!);
    expect(location.hostname).toBe("accounts.google.com");
    expect(location.searchParams.get("redirect_uri")).toBe(
      "http://localhost:5173/api/auth/callback/google",
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("avvia eBay dal modulo e richiede una sessione verificata per collegarlo", async () => {
    const response = await accessForm("/en/accesso", { intent: "ebay" });
    expect(response.status).toBe(303);
    const location = new URL(response.headers.get("location")!);
    expect(location.hostname).toBe("auth.ebay.com");
    expect(location.searchParams.get("scope")!.split(" ")).toEqual([
      "https://api.ebay.com/oauth/api_scope",
      "https://api.ebay.com/oauth/api_scope/commerce.identity.readonly",
    ]);
    const refused = await accessForm("/en/accesso", { intent: "collega-metodo", metodo: "ebay" });
    expect(refused.headers.get("location")).toBe("/en?accesso=accesso-non-verificato");
    const session = await verifiedSession("link-modulo@example.invalid");
    const allowed = await accessForm(
      "/accesso",
      { intent: "collega-metodo", metodo: "ebay" },
      session.cookie,
    );
    expect(allowed.status).toBe(303);
    expect(new URL(allowed.headers.get("location")!).hostname).toBe("auth.ebay.com");
  });

  it("pubblica la versione dei Termini e dell'informativa accettate", async () => {
    expect(
      await loadLegal({
        request: new Request("http://localhost:5173/en/privacy"),
      } as Parameters<typeof loadLegal>[0]),
    ).toEqual({ language: "en", document: "privacy", version: legalVersions.privacy });
    expect(
      await loadLegal({
        request: new Request("http://localhost:5173/termini"),
      } as Parameters<typeof loadLegal>[0]),
    ).toEqual({ language: "it", document: "termini", version: legalVersions.terms });
  });

  it("conserva provider e lingua nel ritorno di un accesso OAuth rifiutato", async () => {
    for (const provider of ["google", "ebay"]) {
      const start = await accessForm("/en/accesso", { intent: provider });
      const state = new URL(start.headers.get("location")!).searchParams.get("state")!;
      const cookie = start.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ");
      const result = await handleAuthRequest(
        new Request(
          `http://localhost:5173/api/auth/callback/${provider}?error=access_denied&state=${encodeURIComponent(state)}`,
          { headers: { cookie } },
        ),
        env,
      );
      const destination = new URL(result.headers.get("location")!, "http://localhost:5173");
      expect(destination.pathname).toBe("/en/auth/error");
      expect(destination.searchParams.get("provider")).toBe(provider);
      expect(destination.searchParams.get("error")).toBe("access_denied");
    }
  });
});

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
    expect(home.notice).toEqual({ text: "Negozio eBay collegato.", tone: "success" });
    expect(home.orders[0]).toMatchObject({
      storeName: "venditore",
      fiscalState: "locked",
      summary: {
        buyer: { username: "acquirente-sintetico" },
        orderPaymentStatus: "PAID",
        lineItems: [{ title: "Articolo sintetico", quantity: 2 }],
      },
    });
    expect(JSON.stringify(home.orders)).not.toContain("NON-ESPORRE");
    expect(
      home.orders.map(({ ebayOrderId, taxIdentifiers }) => [ebayOrderId, taxIdentifiers]),
    ).toEqual([[syntheticOrderId, []]]);

    // Il callback duplicato riceve lo stesso esito senza un secondo scambio del codice;
    // replicato da un altro utente non rivela nulla.
    const replay = await handleAuthRequest(
      storeCallback(`state=${state}&code=codice-sintetico`, cookie),
      env,
      ebay,
    );
    expect(replay.headers.get("location")).toBe("http://localhost:5173/?negozio=collegato");
    const intruder = await verifiedSession("intruso@example.invalid");
    const stolenReplay = await handleAuthRequest(
      storeCallback(`state=${state}&code=codice-sintetico`, intruder.cookie),
      env,
      ebay,
    );
    expect(stolenReplay.headers.get("location")).toBe("http://localhost:5173/?negozio=errore");
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

  it("mostra la schermata preparatoria solo a chi può collegare e parte per eBay dal suo invio", async () => {
    const { cookie } = await verifiedSession("preparatoria@example.invalid");
    for (const base of ["", "/en"]) {
      const page = await loadStoreLink({
        request: new Request(`http://localhost:5173${base}/negozi/collega`, {
          headers: { cookie },
        }),
      } as Parameters<typeof loadStoreLink>[0]);
      expect(page).toEqual({ language: base ? "en" : "it" });
    }
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
    expect(renamed.headers.get("location")).toBe("http://localhost:5173/?negozio=collegato");
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
    expect(attempt.headers.get("location")).toBe("http://localhost:5173/?negozio=altro-spazio");
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
      request: new Request("http://localhost:5173/?negozio=altro-spazio", {
        headers: { cookie: other.cookie },
      }),
    } as Parameters<typeof loadHome>[0]);
    expect(home.notice?.text).toBe(
      "Questo negozio eBay è già collegato a un altro account FiscalBay.",
    );
  });

  it("conserva il collegamento riuscito se la lettura del primo ordine fallisce", async () => {
    const { cookie } = await verifiedSession("import-fallito@example.invalid");
    const state = (await beginStoreLink(cookie)).searchParams.get("state");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const callback = await handleAuthRequest(
        storeCallback(`state=${state}&code=codice`, cookie),
        env,
        syntheticEbay({ trading: () => new Response("<Errore/>", { status: 503 }) }),
      );
      expect(callback.headers.get("location")).toBe("http://localhost:5173/?negozio=collegato");
      const line = JSON.parse(log.mock.calls[0]![0] as string);
      expect(line).toMatchObject({
        code: "UPSTREAM_UNAVAILABLE",
        operation: "store_link",
        failure: "unavailable",
      });
    } finally {
      log.mockRestore();
    }
    expect(
      await env.DB.prepare("SELECT COUNT(*) AS total FROM ebay_store_credentials").first(),
    ).toEqual({ total: 1 });
  });

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
      expect(callback.headers.get("location")).toBe("http://localhost:5173/?negozio=errore");
    } finally {
      log.mockRestore();
    }
    expect(await env.DB.prepare("SELECT COUNT(*) AS total FROM ebay_stores").first()).toEqual({
      total: 0,
    });
  });
});

describe("rinnovo dei token del negozio", () => {
  const issued = new Date("2026-10-01T10:00:00.000Z");

  async function linkedStore(email: string): Promise<string> {
    const { cookie } = await verifiedSession(email);
    const state = (await beginStoreLink(cookie)).searchParams.get("state");
    await handleAuthRequest(
      storeCallback(`state=${state}&code=codice`, cookie),
      env,
      syntheticEbay(),
    );
    const store = await env.DB.prepare("SELECT id FROM ebay_stores").first<{ id: string }>();
    await env.DB.prepare(
      "UPDATE ebay_store_credentials SET granted_at = ?, access_expires_at = ?, refresh_expires_at = ?",
    )
      .bind(issued.toISOString(), "2026-10-01T12:00:00.000Z", "2028-04-01T10:00:00.000Z")
      .run();
    return store!.id;
  }

  function tokenEndpoint(response: () => Response) {
    return vi.fn<typeof fetch>(async (_input, init) => {
      const body = new URLSearchParams(String(init?.body));
      expect(body.get("grant_type")).toBe("refresh_token");
      expect(body.get("refresh_token")).toBe("refresh-sintetico");
      return response();
    });
  }

  async function credentials() {
    return env.DB.prepare(
      "SELECT store_id, access_token, access_expires_at, refreshed_at, rejected_at FROM ebay_store_credentials",
    ).first<Record<string, string | null>>();
  }

  it("rinnova in anticipo solo i token vicini alla scadenza", async () => {
    const storeId = await linkedStore("rinnovo@example.invalid");
    const fetcher = tokenEndpoint(() =>
      Response.json({ access_token: "token-rinnovato", expires_in: 7200 }),
    );

    expect(await refreshExpiringTokens(env, fetcher, new Date("2026-10-01T11:00:00.000Z"))).toEqual(
      [],
    );
    const at = new Date("2026-10-01T11:30:00.000Z");
    expect(await refreshExpiringTokens(env, fetcher, at)).toEqual(["refreshed"]);
    const row = await credentials();
    expect(await openToken(env.BETTER_AUTH_SECRET, storeId, "access", row!.access_token!)).toBe(
      "token-rinnovato",
    );
    expect(row).toMatchObject({
      access_expires_at: "2026-10-01T13:30:00.000Z",
      refreshed_at: at.toISOString(),
      rejected_at: null,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("registra il rifiuto del consenso solo per invalid_grant", async () => {
    const storeId = await linkedStore("consenso-revocato@example.invalid");
    const misconfigured = tokenEndpoint(() =>
      Response.json({ error: "invalid_client" }, { status: 401 }),
    );
    await expect(
      refreshStoreToken({ environment: env, storeId, fetcher: misconfigured, now: issued }),
    ).rejects.toMatchObject({ failure: "credentials" });
    expect((await credentials())!.rejected_at).toBeNull();

    const revoked = tokenEndpoint(() => Response.json({ error: "invalid_grant" }, { status: 400 }));
    expect(
      await refreshStoreToken({ environment: env, storeId, fetcher: revoked, now: issued }),
    ).toBe("rejected");
    expect((await credentials())!.rejected_at).toBe(issued.toISOString());
    // Un consenso rifiutato non viene più ritentato dal lavoro in background.
    expect(await refreshExpiringTokens(env, revoked, issued)).toEqual([]);
  });

  it("non sovrascrive un consenso più recente con un rinnovo partito prima", async () => {
    const storeId = await linkedStore("rinnovo-superato@example.invalid");
    const before = await credentials();
    const fetcher = tokenEndpoint(() =>
      Response.json({ access_token: "vecchio", expires_in: 7200 }),
    );
    fetcher.mockImplementationOnce(async () => {
      // Durante la risposta il merchant ricollega il negozio con un nuovo consenso.
      await env.DB.prepare("UPDATE ebay_store_credentials SET granted_at = ?")
        .bind("2026-10-01T10:05:00.000Z")
        .run();
      return Response.json({ access_token: "vecchio", expires_in: 7200 });
    });
    expect(await refreshStoreToken({ environment: env, storeId, fetcher, now: issued })).toBe(
      "superseded",
    );
    expect((await credentials())!.access_token).toBe(before!.access_token);
  });

  it("considera rifiutato un consenso già scaduto senza chiamare eBay", async () => {
    const storeId = await linkedStore("consenso-scaduto@example.invalid");
    const fetcher = vi.fn<typeof fetch>();
    expect(
      await refreshStoreToken({
        environment: env,
        storeId,
        fetcher,
        now: new Date("2028-04-01T10:00:00.000Z"),
      }),
    ).toBe("rejected");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("produce cifrati diversi per lo stesso token", async () => {
    const a = await sealToken(env.BETTER_AUTH_SECRET, "negozio", "access", "uguale");
    const b = await sealToken(env.BETTER_AUTH_SECRET, "negozio", "access", "uguale");
    expect(a).not.toBe(b);
  });
});

describe("confine HTTP dei provider", () => {
  const url = "https://api.ebay.invalid/risorsa";
  const failure = (promise: Promise<unknown>) =>
    promise.then(
      () => null,
      (error: unknown) =>
        error instanceof UpstreamError
          ? { failure: error.failure, code: error.code, ...error.details }
          : error,
    );

  it("classifica credenziali, rate limit, indisponibilità e rifiuti con Retry-After", async () => {
    const reply = (response: Response) => vi.fn<typeof fetch>(async () => response);
    expect(await failure(upstreamText(reply(new Response(null, { status: 401 })), url))).toEqual({
      failure: "credentials",
      code: "STORE_RECONNECT_REQUIRED",
      status: 401,
    });
    expect(
      await failure(
        upstreamText(
          reply(new Response(null, { status: 429, headers: { "retry-after": "120" } })),
          url,
        ),
      ),
    ).toEqual({
      failure: "rate_limited",
      code: "UPSTREAM_UNAVAILABLE",
      status: 429,
      retryAfter: 120,
    });
    expect(
      await failure(
        upstreamText(
          reply(
            new Response(null, {
              status: 503,
              headers: { "retry-after": "Thu, 01 Oct 2026 10:01:00 GMT" },
            }),
          ),
          url,
          {},
          { now: Date.parse("2026-10-01T10:00:00.000Z") },
        ),
      ),
    ).toEqual({
      failure: "unavailable",
      code: "UPSTREAM_UNAVAILABLE",
      status: 503,
      retryAfter: 60,
    });
    // Del body del provider resta solo un codice OAuth breve, mai il testo.
    expect(
      await failure(
        upstreamText(
          reply(Response.json({ error: "invalid_grant", detail: "NON-ESPORRE" }, { status: 400 })),
          url,
        ),
      ),
    ).toEqual({
      failure: "rejected",
      code: "INVALID_REQUEST",
      status: 400,
      providerCode: "invalid_grant",
    });
    expect(
      await failure(
        upstreamText(
          vi.fn<typeof fetch>(async () => {
            throw new TypeError("rete");
          }),
          url,
        ),
      ),
    ).toEqual({ failure: "unavailable", code: "UPSTREAM_UNAVAILABLE" });
  });

  it("limita i byte anche senza Content-Length e interrompe una lettura troppo lunga", async () => {
    const declared = new Response("x".repeat(10), { headers: { "content-length": "2000" } });
    expect(
      await failure(
        upstreamText(
          vi.fn<typeof fetch>(async () => declared),
          url,
          {},
          { maxBytes: 1000 },
        ),
      ),
    ).toMatchObject({ failure: "invalid_response" });

    const streamed = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array(400));
      },
    });
    expect(
      await failure(
        upstreamText(
          vi.fn<typeof fetch>(async () => new Response(streamed)),
          url,
          {},
          { maxBytes: 1000 },
        ),
      ),
    ).toMatchObject({ failure: "invalid_response" });

    // Il timeout copre anche il body: un flusso che si ferma a metà non resta appeso.
    const stalled = vi.fn<typeof fetch>(async (_input, init) => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("{"));
          init!.signal!.addEventListener("abort", () => controller.error(init!.signal!.reason));
        },
      });
      return new Response(body);
    });
    expect(await failure(upstreamText(stalled, url, {}, { timeoutMs: 20 }))).toEqual({
      failure: "unavailable",
      code: "UPSTREAM_UNAVAILABLE",
    });
  });

  it("distingue JSON illeggibile o diverso dallo schema", async () => {
    const schema = z.object({ ok: z.literal(true) });
    const reply = (body: string) => vi.fn<typeof fetch>(async () => new Response(body));
    expect(await failure(upstreamJson(reply("{"), url, schema))).toMatchObject({
      failure: "invalid_response",
    });
    expect(await failure(upstreamJson(reply('{"ok":false}'), url, schema))).toMatchObject({
      failure: "invalid_response",
    });
    expect(await upstreamJson(reply('{"ok":true,"extra":1}'), url, schema)).toEqual({ ok: true });
  });
});
