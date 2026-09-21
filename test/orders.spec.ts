import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";

import {
  buildLastModifiedFilter,
  classifyEbayRetry,
  mergeFulfillmentOrders,
  parseFulfillmentPage,
} from "../app/domain/ebay-fulfillment.server";
import { mapTradingTaxIdentifiers } from "../app/domain/ebay-tax-identifiers.server";
import { grantFreeOrder, listVisibleOrders } from "../app/domain/orders.server";
import { createAuth } from "../app/auth.server";
import { loader as loadHome } from "../app/routes/home";

const now = "2026-09-13T20:00:00.000Z";

beforeEach(async () => {
  await env.DB.batch([
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
    expect(anonymous).toEqual({ authenticated: false, orders: [] });

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
    await grantFreeOrder(env.DB, {
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
    const outcomes = await Promise.allSettled([
      grantFreeOrder(env.DB, {
        id: "g-a",
        workspaceId: "w-a",
        orderId: "o-a",
        cycleId: "c-a",
        grantedAt: now,
      }),
      grantFreeOrder(env.DB, {
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
      grantFreeOrder(env.DB, {
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
});
