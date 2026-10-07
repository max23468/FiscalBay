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
import { purgeExpiredRecords } from "../app/domain/maintenance.server";
import { grantFreeOrder, listVisibleOrders } from "../app/domain/orders.server";
import {
  deleteStoreData,
  disconnectStore,
  listStores,
  pauseStore,
  resumeStore,
} from "../app/domain/stores.server";
import { forwardToAuth } from "../app/auth-route.server";
import { completeRegistration, legalVersions } from "../app/domain/registration.server";
import { createAuth } from "../app/auth.server";
import { handleAuthRequest } from "../app/auth-route.server";
import { loader as loadHome } from "../app/routes/home";
import { action as signIn, loader as loadAccess } from "../app/routes/sign-in";
import { action as securityAction } from "../app/routes/security";
import { headers as siteHeaders, loader as loadSite } from "../app/routes/site";
import { loader as loadRobots } from "../app/routes/robots";
import { indexable } from "../app/app-links";
import { loader as loadLegal } from "../app/routes/legal";
import { action as startStoreLink, loader as loadStoreLink } from "../app/routes/store-link";
import { action as storesAction, loader as loadStores } from "../app/routes/stores";
import { action as profileAction, loader as loadProfile } from "../app/routes/profile";
import {
  openToken,
  refreshExpiringTokens,
  refreshStoreToken,
  sealToken,
} from "../app/integrations/ebay/seller-credentials.server";
import { UpstreamError, upstreamJson, upstreamText } from "../app/integrations/http.server";
import {
  startStoreLink as beginLink,
  claimStoreLinkSession,
} from "../app/integrations/ebay/store-link.server";
import { ebayConfiguration, sandboxAvailable } from "../app/integrations/ebay/environment.server";

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

    // Senza sessione gli Ordini rimandano all'accesso, che mostra i moduli.
    const anonymous = await loadHome({
      request: new Request("http://localhost:5173/app/ordini?accesso=errore"),
    } as Parameters<typeof loadHome>[0]).catch((response: Response) => response);
    expect((anonymous as Response).headers.get("location")).toBe("/accesso?accesso=errore");
    expect(
      await loadAccess({
        request: new Request("http://localhost:5173/accesso"),
      } as Parameters<typeof loadAccess>[0]),
    ).toEqual({
      authenticated: false,
      language: "it",
      notice: null,
      orders: [],
      resetToken: null,
      tab: "accedi",
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
      request: new Request("http://localhost:5173/app/ordini", { headers: { cookie: cookie! } }),
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
        observedAt: now,
      },
      {
        type: "VAT_ID",
        issuingCountry: "IT",
        value: "01234567890",
        source: "ebay_trading_get_orders",
        observedAt: now,
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
    request: new Request("http://localhost:5173/app/negozi/collega", {
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

/** Azione della pagina Sicurezza; chi non può vederla riceve il redirect lanciato. */
function securityForm(path: string, fields: Record<string, string>, cookie?: string) {
  return (
    securityAction({
      request: new Request(`http://localhost:5173${path}`, {
        method: "POST",
        headers: { origin: "http://localhost:5173", ...(cookie ? { cookie } : {}) },
        body: new URLSearchParams(fields),
      }),
    } as Parameters<typeof securityAction>[0]) as Promise<Response>
  ).catch((thrown: unknown) => {
    if (thrown instanceof Response) return thrown;
    throw thrown;
  });
}

function sessionCookie(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

async function homeFor(cookie: string) {
  return loadHome({
    request: new Request("http://localhost:5173/app/ordini", { headers: { cookie } }),
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

describe("radice pubblica e area riservata", () => {
  const root = (path: string, cookie?: string) =>
    loadSite({
      request: new Request(`http://localhost:5173${path}`, { headers: cookie ? { cookie } : {} }),
    } as Parameters<typeof loadSite>[0]).catch((thrown: Response) => thrown);

  it("porta agli Ordini ogni utente con la sessione e mostra il sito all'anonimo, senza cache", async () => {
    const first = await verifiedSession("radice-uno@example.invalid");
    const second = await verifiedSession("radice-due@example.invalid");
    // Stesso indirizzo, tre visitatori: la pagina dell'anonimo non contiene dati di account.
    expect(await root("/")).toEqual({
      language: "it",
      signedIn: false,
      origin: "http://localhost:5173",
    });
    expect(await root("/en")).toMatchObject({ language: "en", signedIn: false });
    for (const { cookie } of [first, second]) {
      for (const base of ["", "/en"]) {
        const response = (await root(base || "/", cookie)) as Response;
        expect(response.status).toBe(302);
        expect(response.headers.get("location")).toBe(`${base}/app/ordini`);
        expect(response.headers.get("cache-control")).toBe("no-store");
      }
    }
    expect(siteHeaders()).toEqual({ "cache-control": "no-store" });
  });

  it("visita il sito pubblico mantenendo la sessione e torna all'app senza ciclo", async () => {
    const user = await verifiedSession("radice-visita@example.invalid");
    const session = user.cookie.split(";")[0]!;
    const visit = (await root("/en?visita=1", session)) as Response;
    expect(visit.status).toBe(302);
    expect(visit.headers.get("location")).toBe("/en");
    expect(visit.headers.get("cache-control")).toBe("no-store");
    expect(visit.headers.getSetCookie()).toEqual([
      "fiscalbay_visita=1; Path=/; HttpOnly; SameSite=Lax",
    ]);
    const visiting = `${session}; fiscalbay_visita=1`;
    expect(await root("/en", visiting)).toMatchObject({ language: "en", signedIn: true });
    expect(await root("/", visiting)).toMatchObject({ language: "it", signedIn: true });
    // La scelta di visita senza sessione non apre nulla.
    expect(await root("/", "fiscalbay_visita=1")).toMatchObject({ signedIn: false });

    const back = (await root("/en?visita=0", visiting)) as Response;
    expect(back.headers.get("location")).toBe("/en/app/ordini");
    expect(back.headers.getSetCookie()).toEqual([
      "fiscalbay_visita=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax",
    ]);
    expect(((await root("/", session)) as Response).headers.get("location")).toBe("/app/ordini");

    // L'uscita riporta al sito pubblico e dimentica la scelta.
    const signOut = await accessForm("/accesso", { intent: "esci" }, visiting);
    expect(signOut.headers.get("location")).toBe("/");
    expect(signOut.headers.getSetCookie()).toContain("fiscalbay_visita=; Path=/; Max-Age=0");
  });

  it("indicizza solo le pagine pubbliche del dominio di produzione", async () => {
    for (const path of ["/", "/en", "/termini", "/en/privacy"]) {
      expect(indexable("https://fiscalbay.it", path)).toBe(true);
      expect(indexable("https://test.fiscalbay.it", path)).toBe(false);
    }
    for (const path of ["/app/ordini", "/en/app/negozi/x", "/accesso", "/admin", "/anteprima"]) {
      expect(indexable("https://fiscalbay.it", path)).toBe(false);
    }
    // Fuori dalla produzione robots.txt chiude tutto il dominio.
    expect(await loadRobots().text()).toBe("User-agent: *\nDisallow: /\n");
  });
});

describe("registrazione e verifica del contatto", () => {
  const password = "Una-password-registrazione-lunga";
  const person = { tipo: "privato", nome: "Mario", cognome: "Rossi" };

  it("registra senza consensi preselezionati, apre la sessione dal link e non rivela gli indirizzi già registrati", async () => {
    const email = "registrazione@example.invalid";
    const rejected = [
      [{ intent: "registrati", email, password, termini: "on" }, "dati"],
      [{ intent: "registrati", ...person, cognome: " ", email, password, termini: "on" }, "dati"],
      [{ intent: "registrati", ...person, email, password }, "termini"],
    ] as const;
    for (const [fields, outcome] of rejected) {
      const response = await accessForm("/accesso", fields);
      expect(response.headers.get("location")).toBe(`/accesso?accesso=${outcome}`);
      expect(response.headers.getSetCookie()).toEqual([]);
    }
    expect(
      await env.DB.prepare('SELECT id FROM "user" WHERE email = ?').bind(email).first(),
    ).toBeNull();

    const send = vi.spyOn(env.AUTH_EMAIL, "send").mockResolvedValue({ messageId: "synthetic" });
    const register = (path: string) =>
      accessForm(path, { intent: "registrati", ...person, email, password, termini: "on" });
    const created = await register("/en/accesso");
    expect(created.status).toBe(303);
    expect(created.headers.get("location")).toBe("/en/accesso?accesso=registrato");
    expect(created.headers.getSetCookie()).toEqual([]);
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
    await vi.waitFor(() => expect(send).toHaveBeenCalledOnce());
    const confirmation = send.mock.calls[0]![0] as { to: string; subject: string; text: string };
    expect(confirmation).toMatchObject({
      to: email,
      subject: "Confirm your FiscalBay email address",
    });

    // Lo stesso indirizzo riceve la stessa risposta, senza sessione né nuovo account; il
    // titolare ne riceve avviso.
    const duplicate = await register("/accesso");
    expect(duplicate.headers.get("location")).toBe("/accesso?accesso=registrato");
    expect(duplicate.headers.getSetCookie()).toEqual([]);
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(2));
    expect(send.mock.calls[1]![0]).toMatchObject({
      to: email,
      subject: "Hai già un account FiscalBay",
    });
    // Dalla pagina inglese l'avviso è in inglese e porta all'accesso inglese.
    await register("/en/accesso");
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(3));
    expect(send.mock.calls[2]![0]).toMatchObject({
      to: email,
      subject: "You already have a FiscalBay account",
      text: expect.stringContaining("/en/accesso"),
    });
    expect(
      await env.DB.prepare('SELECT COUNT(*) AS total FROM "user" WHERE email = ?')
        .bind(email)
        .first(),
    ).toEqual({ total: 1 });
    expect((await agreements(user!.id)).marketing).toHaveLength(1);

    // Chi entra con la password prima della conferma esplora, ma non collega negozi.
    const cookie = sessionCookie(await accessForm("/accesso", { email, password }));
    expect(cookie).toContain("session_token");
    expect(await homeFor(cookie)).toMatchObject({
      authenticated: true,
      email,
      emailVerified: false,
      needsProfile: false,
      needsAgreement: false,
      orders: [],
    });
    const link = (await startStoreLink({
      request: new Request("http://localhost:5173/app/negozi/collega", {
        method: "POST",
        headers: { cookie, origin: "http://localhost:5173" },
      }),
    } as Parameters<typeof startStoreLink>[0])) as Response;
    expect(link.headers.get("location")).toBe("/app/ordini?negozio=accesso");
    expect(await storeLinkSessions()).toBe(0);

    const resent = await accessForm("/accesso", { intent: "verifica" }, cookie);
    expect(resent.headers.get("location")).toBe("/app/ordini?accesso=verifica-inviata");

    // Il link di conferma apre la sessione verificata.
    const verified = await handleAuthRequest(
      new Request(confirmation.text.split("\n").at(-1)!),
      env,
    );
    expect(verified.headers.get("location")).toBe("/en/app/ordini");
    const verifiedCookie = sessionCookie(verified);
    expect(await homeFor(verifiedCookie)).toMatchObject({ emailVerified: true });
    send.mockRestore();
  });

  it("registra un'azienda solo con la ragione sociale, senza dati fiscali", async () => {
    const email = "azienda@example.invalid";
    const business = { intent: "registrati", tipo: "azienda", nome: "Anna", cognome: "Bianchi" };
    const missing = await accessForm("/accesso", { ...business, email, password, termini: "on" });
    expect(missing.headers.get("location")).toBe("/accesso?accesso=dati");

    const created = await accessForm("/accesso", {
      ...business,
      ragione_sociale: "  Bianchi Ricambi S.r.l. ",
      email,
      password,
      termini: "on",
    });
    expect(created.headers.get("location")).toBe("/accesso?accesso=registrato");
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
    expect(privateUser.headers.get("location")).toBe("/accesso?accesso=registrato");
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
      request: new Request("http://localhost:5173/app/negozi/collega", {
        method: "POST",
        headers: { cookie, origin: "http://localhost:5173" },
      }),
    } as Parameters<typeof startStoreLink>[0])) as Response;
    expect(blocked.headers.get("location")).toBe("/app/ordini");
    expect(await storeLinkSessions()).toBe(0);

    const complete = (fields: Record<string, string>) =>
      accessForm("/accesso", { intent: "completa", ...fields }, cookie).then((response) =>
        response.headers.get("location"),
      );
    expect(await complete({ termini: "on" })).toBe("/app/ordini?accesso=dati");
    expect(await complete({ ...person, marketing: "on" })).toBe("/app/ordini?accesso=termini");
    expect(await agreements(user!.id)).toEqual({ terms: [], marketing: [] });
    expect(await complete({ ...person, termini: "on", marketing: "on" })).toBe("/app/ordini");
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
    // Due IP, una rete IPv6 e l'indirizzo email, contato solo per i tentativi ammessi per IP.
    expect(counters!.total).toBe(4);

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
    const refused = await securityForm("/en/app/impostazioni/sicurezza", {
      intent: "collega-metodo",
      metodo: "ebay",
    });
    expect(refused.headers.get("location")).toBe("/en/accesso");
    const session = await verifiedSession("link-modulo@example.invalid");
    const allowed = await securityForm(
      "/app/impostazioni/sicurezza",
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
              "api.sandbox.ebay.com",
              "api.sandbox.ebay.com",
            ]
          : ["api.ebay.com", "apiz.ebay.com", "api.ebay.com", "api.ebay.com"],
      );
    }
    const { results: stores } = await env.DB.prepare(
      "SELECT id, ebay_environment, ebay_account_id FROM ebay_stores ORDER BY ebay_environment",
    ).all<{ id: string; ebay_environment: "production" | "sandbox"; ebay_account_id: string }>();
    expect(stores.map((s) => [s.ebay_environment, s.ebay_account_id])).toEqual([
      ["production", "ebay-user-sintetico"],
      ["sandbox", "ebay-user-sintetico"],
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

  it("legge l'osservazione fiscale Trading del solo ordine richiesto", () => {
    expect(parseTradingOrderTaxIdentifiers(syntheticTradingXml, syntheticOrderId)).toEqual([
      { id: "SYNTHETIC&ID", type: "CODICE_FISCALE", attributes: [] },
    ]);
    expect(() =>
      parseTradingOrderTaxIdentifiers("<GetOrdersResponse><Ack>Failure</Ack>", syntheticOrderId),
    ).toThrow("trading_get_orders_failed");
  });

  it("dà allo spazio creato al collegamento il nome nella lingua dell'utente", async () => {
    for (const [prefix, name] of [
      ["", "Spazio personale"],
      ["/en", "Personal space"],
    ] as const) {
      const { userId, cookie } = await verifiedSession(
        `spazio${prefix.replace("/", "-")}@example.invalid`,
      );
      const start = (await startStoreLink({
        request: new Request(`http://localhost:5173${prefix}/app/negozi/collega`, {
          method: "POST",
          headers: { cookie, origin: "http://localhost:5173" },
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
      request: new Request("http://localhost:5173/app/ordini?negozio=collegato", {
        headers: { cookie },
      }),
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
      });
    }
    // Da Negozi la schermata riporta lì con «Annulla».
    const reconnect = await loadStoreLink({
      request: new Request("http://localhost:5173/app/negozi/collega?ricollega&da=negozi", {
        headers: { cookie },
      }),
    } as Parameters<typeof loadStoreLink>[0]);
    expect(reconnect).toEqual({
      language: "it",
      reconnect: true,
      fromStores: true,
      sandbox: false,
      ebayEnvironment: "production",
    });
    const blockedSandbox = (await startStoreLink({
      request: new Request("http://localhost:5173/app/negozi/collega", {
        method: "POST",
        headers: { cookie, origin: "http://localhost:5173" },
        body: new URLSearchParams({ environment: "sandbox" }),
      }),
    } as Parameters<typeof startStoreLink>[0])) as Response;
    expect(blockedSandbox.status).toBe(403);
    expect((await homeFor(cookie)).storeLinked).toBe(false);
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
      request: new Request("http://localhost:5173/app/ordini?negozio=altro-spazio", {
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
      expect(callback.headers.get("location")).toBe(
        "http://localhost:5173/app/ordini?negozio=collegato",
      );
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
    // Senza ordini importati la pagina non chiede di collegare un negozio già collegato.
    await env.DB.prepare("DELETE FROM orders").run();
    const home = await homeFor(cookie);
    expect({ orders: home.orders, storeLinked: home.storeLinked }).toEqual({
      orders: [],
      storeLinked: true,
    });
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
    const { cookie } = await verifiedSession("ritorno-callback@example.invalid");
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
      expect(init?.method).toBe("POST");
      expect(new Headers(init?.headers).get("content-type")).toBe(
        "application/x-www-form-urlencoded",
      );
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

  it("rinnova oltre il primo blocco, prosegue dopo un errore e si ferma al limite", async () => {
    const first = await linkedStore("molti-negozi@example.invalid");
    const { workspace_id: workspaceId } = (await env.DB.prepare(
      "SELECT workspace_id FROM ebay_stores WHERE id = ?",
    )
      .bind(first)
      .first<{ workspace_id: string }>())!;
    // Il negozio collegato ha un UUID e precede questi nell'ordine dei rinnovi.
    for (let index = 1; index < 320; index++) {
      const id = `negozio-${String(index).padStart(3, "0")}`;
      await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO ebay_stores (id, workspace_id, ebay_user_id, linked_at, ebay_account_id)
           VALUES (?1, ?2, ?1, ?3, ?1)`,
        ).bind(id, workspaceId, issued.toISOString()),
        env.DB.prepare(
          `INSERT INTO ebay_store_credentials
             (store_id, access_token, access_expires_at, refresh_token, refresh_expires_at, granted_at)
           VALUES (?, 'scaduto', '2026-10-01T12:00:00.000Z', ?, '2028-04-01T10:00:00.000Z', ?)`,
        ).bind(
          id,
          await sealToken(env.BETTER_AUTH_SECRET, id, "refresh", id),
          issued.toISOString(),
        ),
      ]);
    }
    // Due negozi in mezzo al primo blocco restano non disponibili: non vanno riletti.
    const unavailable = new Set(["negozio-002", "negozio-003"]);
    const fetcher = vi.fn<typeof fetch>(async (_input, init) => {
      const token = new URLSearchParams(String(init?.body)).get("refresh_token")!;
      return unavailable.has(token)
        ? Response.json({ error: "temporarily_unavailable" }, { status: 503 })
        : Response.json({ access_token: "token-rinnovato", expires_in: 7200 });
    });
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const at = new Date("2026-10-01T11:30:00.000Z");
    try {
      expect(await refreshExpiringTokens(env, fetcher, at)).toEqual(Array(298).fill("refreshed"));
      expect(fetcher).toHaveBeenCalledTimes(300);
      expect(
        errors.mock.calls.filter(([line]) => String(line).includes('"operation":"token_refresh"')),
      ).toHaveLength(2);
      // L'esecuzione successiva riprova i due negozi e completa quelli oltre il limite.
      fetcher.mockClear();
      expect(await refreshExpiringTokens(env, fetcher, at)).toEqual(Array(20).fill("refreshed"));
      expect(fetcher).toHaveBeenCalledTimes(22);
    } finally {
      errors.mockRestore();
    }
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

  it("apre un token cifrato con la chiave derivata prevista, legato a negozio e tipo", async () => {
    // Cifratura indipendente con HKDF-SHA-256 e info fissa: cambiare la derivazione rende
    // illeggibili i token già salvati.
    const material = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(env.BETTER_AUTH_SECRET),
      "HKDF",
      false,
      ["deriveKey"],
    );
    const key = await crypto.subtle.deriveKey(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: new Uint8Array(),
        info: new TextEncoder().encode("fiscalbay/ebay-seller-token/v1"),
      },
      material,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt"],
    );
    const iv = new Uint8Array(12).fill(7);
    const sealed = new Uint8Array(
      await crypto.subtle.encrypt(
        { name: "AES-GCM", iv, additionalData: new TextEncoder().encode("negozio:access") },
        key,
        new TextEncoder().encode("token-noto"),
      ),
    );
    const value = `v1.${btoa(String.fromCharCode(...iv, ...sealed))
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replace(/=+$/u, "")}`;
    expect(await openToken(env.BETTER_AUTH_SECRET, "negozio", "access", value)).toBe("token-noto");
    await expect(openToken(env.BETTER_AUTH_SECRET, "negozio", "refresh", value)).rejects.toThrow();
    await expect(
      openToken(env.BETTER_AUTH_SECRET, "negozio", "access", value.slice(3)),
    ).rejects.toThrow("unsupported_token_format");
  });

  it("non rinnova senza credenziali né con una risposta senza token", async () => {
    expect(
      await refreshStoreToken({
        environment: env,
        storeId: "inesistente",
        fetcher: vi.fn<typeof fetch>(),
        now: issued,
      }),
    ).toBe("missing");
    await linkedStore("risposta-incompleta@example.invalid");
    const storeId = (await env.DB.prepare("SELECT id FROM ebay_stores").first<{ id: string }>())!
      .id;
    const before = await credentials();
    await expect(
      refreshStoreToken({
        environment: env,
        storeId,
        fetcher: tokenEndpoint(() => Response.json({ expires_in: 7200 })),
        now: issued,
      }),
    ).rejects.toBeInstanceOf(UpstreamError);
    expect(await credentials()).toEqual(before);
  });

  it("produce cifrati diversi per lo stesso token", async () => {
    const a = await sealToken(env.BETTER_AUTH_SECRET, "negozio", "access", "uguale");
    const b = await sealToken(env.BETTER_AUTH_SECRET, "negozio", "access", "uguale");
    expect(a).not.toBe(b);
  });
});

describe("pulizia dei dati tecnici scaduti", () => {
  it("elimina solo sessioni, verifiche, limiti e collegamenti scaduti", async () => {
    const { userId } = await verifiedSession("pulizia@example.invalid");
    const at = new Date();
    const past = new Date(at.getTime() - 60_000).toISOString();
    const future = new Date(at.getTime() + 60_000).toISOString();
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO "session" ("id", "expiresAt", "token", "createdAt", "updatedAt", "userId")
         VALUES ('sessione-scaduta', ?1, 'token-scaduto', ?1, ?1, ?2)`,
      ).bind(past, userId),
      env.DB.prepare(
        `INSERT INTO "verification" ("id", "identifier", "value", "expiresAt", "createdAt", "updatedAt")
         VALUES ('scaduta', 'pulizia', 'x', ?1, ?1, ?1), ('valida', 'pulizia', 'x', ?2, ?1, ?1)`,
      ).bind(past, future),
      env.DB.prepare(
        `INSERT INTO "rateLimit" ("id", "key", "count", "lastRequest")
         VALUES ('vecchio', 'vecchio', 1, ?1), ('recente', 'recente', 1, ?2)`,
      ).bind(at.getTime() - 3_600_001, at.getTime() - 3_599_000),
      env.DB.prepare(
        `INSERT INTO ebay_store_link_sessions (state, user_id, code_verifier, expires_at)
         VALUES ('scaduto', ?1, 'v', ?2), ('valido', ?1, 'v', ?3)`,
      ).bind(userId, past, future),
    ]);

    await purgeExpiredRecords(env.DB, at);

    const ids = async (sql: string) =>
      (await env.DB.prepare(sql).all<{ id: string }>()).results.map((row) => row.id);
    expect(await ids('SELECT "id" FROM "session" WHERE "userId" = \'' + userId + "'")).toHaveLength(
      1,
    );
    expect(await ids('SELECT "id" FROM "verification" WHERE "identifier" = \'pulizia\'')).toEqual([
      "valida",
    ]);
    expect(
      await ids('SELECT "id" FROM "rateLimit" WHERE "id" IN (\'vecchio\', \'recente\')'),
    ).toEqual(["recente"]);
    expect(
      await ids(
        "SELECT state AS id FROM ebay_store_link_sessions WHERE state IN ('scaduto', 'valido')",
      ),
    ).toEqual(["valido"]);

    // La sessione creata da Better Auth usa lo stesso formato: oltre la scadenza se ne va.
    await purgeExpiredRecords(env.DB, new Date(at.getTime() + 8 * 24 * 60 * 60 * 1000));
    expect(await ids(`SELECT "id" FROM "session" WHERE "userId" = '${userId}'`)).toEqual([]);
  });
});

describe("pausa, ricollegamento e scollegamento dei negozi", () => {
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
    const grantedAt = new Date().toISOString();
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
    await grantFreeOrder(env.DB, seller.userId, {
      id: "sblocco",
      workspaceId: seller.workspaceId,
      orderId: order!.id,
      cycleId: "ciclo",
      grantedAt,
    });
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
        importedOrders: 1,
        dataDeleted: false,
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
    expect(home.authenticated && home.reminders).toEqual([
      {
        id: seller.storeId,
        name: "venditore",
        ebayEnvironment: "production",
        kind: "expired",
        at: expect.any(String),
      },
    ]);
    // Ricollegare lo stesso account eBay toglie l'invito.
    await linkThroughEbay(seller.cookie);
    const after = await homeFor(seller.cookie);
    expect(after.authenticated && after.reminders).toEqual([]);
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
    await env.DB.prepare("DELETE FROM orders").run();
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
    const before = await env.DB.prepare("SELECT id FROM orders").first<{ id: string }>();

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

    // Ricollegare ritrova il negozio: l'ordine riletto da eBay è nuovo e il vecchio sblocco
    // non torna, mentre la quota consumata resta consumata.
    await linkThroughEbay(seller.cookie);
    expect(await count("ebay_stores")).toBe(1);
    const orders = await listVisibleOrders(env.DB, seller.userId);
    expect(orders).toMatchObject([{ fiscalState: "locked" }]);
    expect(orders[0]!.id).not.toBe(before!.id);
    expect(await quotaUsed()).toBe(1);

    // Gli ordini riletti non risultano eliminati: scollegando di nuovo si possono eliminare.
    expect((await listStores(env.DB, seller.userId))[0]).toMatchObject({ dataDeleted: false });
    await disconnectStore(env.DB, seller.userId, seller.storeId);
    expect((await listStores(env.DB, seller.userId))[0]).toMatchObject({
      connection: "disconnected",
      dataDeleted: false,
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
          // Senza sincronizzazione continua niente frequenza, storico né aggiornamenti inventati.
          targetMinutes: null,
          historyDays: null,
          recent: [],
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

    expect(
      await storeForm(seller.cookie, {
        intent: "store-delete",
        store: seller.storeId,
        conferma: "venditore",
      }),
    ).toMatchObject({ ok: true });
    // Il negozio resta nello spazio, scollegato e senza dati: ricollegarlo non crea doppioni.
    [store] = (await storesPage("/app/negozi", seller.cookie)).data.page.stores;
    expect(store).toMatchObject({
      connection: "disconnected",
      dataDeleted: true,
      importedOrders: 0,
    });

    const unknown = await storeForm(seller.cookie, { intent: "store-sync", store: seller.storeId });
    expect((unknown as { init: ResponseInit }).init.status).toBe(400);
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
