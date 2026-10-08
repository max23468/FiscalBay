import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  buildLastModifiedFilter,
  mergeFulfillmentOrders,
  parseFulfillmentPage,
  fulfillmentObservation,
  readFulfillmentOrders,
} from "../app/integrations/ebay/fulfillment.server";
import {
  mapTradingTaxIdentifiers,
  parseItemImage,
  parseTradingOrderTaxIdentifiers,
  qualifiedImageUrl,
  readItemImage,
  readTradingTaxIdentifiers,
  tradingAck,
} from "../app/integrations/ebay/trading.server";
import { importLatestOrder } from "../app/domain/order-acquisition.server";
import { purgeExpiredRecords } from "../app/domain/maintenance.server";
import {
  grantFreeOrder,
  listVisibleOrders,
  paymentState,
  shippingState,
} from "../app/domain/orders.server";
import { recordOrderObservation, type OrderObservation } from "../app/domain/order-import.server";
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
  openToken,
  refreshExpiringTokens,
  refreshStoreToken,
  sealToken,
} from "../app/integrations/ebay/seller-credentials.server";
import { UpstreamError, upstreamJson, upstreamText } from "../app/integrations/http.server";
import {
  startStoreLink as beginLink,
  claimStoreLinkSession,
  completeStoreLink,
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
        (id, order_id, line_item_id, sku, title, quantity, total_minor, currency)
       VALUES ('i-a1', 'o-a', 'line-a1', 'SKU-A', 'Articolo A', 1, 999, 'EUR'),
              ('i-a2', 'o-a', 'line-a2', NULL, 'Articolo B', 2, 300, 'EUR'),
              ('i-b', 'o-b', 'line-b', 'SKU-B', 'Articolo B', 1, 2599, 'EUR')`,
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
    const edge = new Date("2026-09-20T12:00:00.000Z");
    expect(buildLastModifiedFilter(edge, edge, 0)).toBe(
      "lastmodifieddate:[2026-09-20T12:00:00.000Z..2026-09-20T12:00:00.000Z]",
    );
    for (const [checkpoint, end, overlap] of [
      [new Date(Number.NaN), edge, 0],
      [edge, new Date(Number.NaN), 0],
      [edge, edge, -1],
      [new Date(edge.getTime() + 1), edge, 0],
    ] as const) {
      expect(() => buildLastModifiedFilter(checkpoint, end, overlap)).toThrow(
        "Intervallo incrementale eBay non valido",
      );
    }
    // La pagina richiede il totale e ID non vuoti; senza `orders` non ci sono ordini.
    expect(parseFulfillmentPage({ total: 0 }).orders).toEqual([]);
    expect(() => parseFulfillmentPage({ orders: [] })).toThrow();
    expect(() => parseFulfillmentPage({ orders: [{ orderId: "" }], total: 1 })).toThrow();
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
    expect(ownerOrders[0]).toMatchObject({ storeName: "e-a", fiscalState: "available" });
    expect(ownerOrders[0]?.summary).toEqual({
      buyer: { username: null },
      orderPaymentStatus: null,
      orderFulfillmentStatus: null,
      payment: null,
      shipping: null,
      lineItems: [
        { lineItemId: "line-a1", title: "Articolo A", quantity: 1, sku: "SKU-A" },
        { lineItemId: "line-a2", title: "Articolo B", quantity: 2, sku: null },
      ],
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

  it("la lettura Fulfillment conserva solo i campi del modello, con importi esatti", () => {
    const readAt = "2026-09-21T00:00:00.000Z";
    const address = {
      addressLine1: "Via Roma 1",
      addressLine2: "Scala B",
      city: "Trento",
      postalCode: "38122",
      stateOrProvince: "TN",
      countryCode: "IT",
      county: "NON-ESPORRE",
    };
    const { county: _, ...savedAddress } = address;
    const line = (lineItemId: string, legacyItemId: string | undefined, marketplace: string) => ({
      lineItemId,
      legacyItemId,
      title: `Articolo ${lineItemId}`,
      quantity: 2,
      sku: "SKU-1",
      lineItemCost: { value: "1000", currency: "JPY" },
      listingMarketplaceId: marketplace,
      taxIdentifier: "NON-ESPORRE",
    });
    const complete = fulfillmentObservation(
      {
        orderId: "ordine",
        creationDate: "2026-09-20T10:00:00Z",
        lastModifiedDate: "2026-09-20T11:00:00.000Z",
        orderPaymentStatus: "PAID",
        orderFulfillmentStatus: "NOT_STARTED",
        cancelStatus: { cancelState: "NONE_REQUESTED" },
        pricingSummary: { total: { value: "2000", currency: "JPY" } },
        buyer: {
          username: "acquirente-sintetico",
          taxIdentifier: { value: "NON-ESPORRE" },
          buyerRegistrationAddress: {
            fullName: "Mario Rossi",
            email: "acquirente@example.invalid",
            primaryPhone: { phoneNumber: "+39 000 0000000" },
            contactAddress: address,
          },
        },
        fulfillmentStartInstructions: [
          {
            shippingStep: {
              shipTo: {
                fullName: "Anna Bianchi",
                primaryPhone: { phoneNumber: "+39 000 1111111" },
                contactAddress: address,
              },
            },
          },
        ],
        lineItems: [line("riga-1", "110", "EBAY_IT"), line("riga-2", undefined, "EBAY_IT")],
        taxIdentifier: "NON-ESPORRE",
      },
      readAt,
    );
    const item = (lineItemId: string, stableKey: string | null) => ({
      lineItemId,
      legacyItemId: stableKey?.split("-")[0] ?? null,
      stableKey,
      title: `Articolo ${lineItemId}`,
      sku: "SKU-1",
      quantity: 2,
      total: { minor: 1000, currency: "JPY" },
    });
    expect(complete).toEqual({
      source: "fulfillment",
      externalOrderId: "ordine",
      provisional: false,
      creationTime: "2026-09-20T10:00:00.000Z",
      lastModifiedTime: "2026-09-20T11:00:00.000Z",
      marketplaceId: "EBAY_IT",
      total: { minor: 2000, currency: "JPY" },
      paymentStatus: "PAID",
      fulfillmentStatus: "NOT_STARTED",
      cancelStatus: "NONE_REQUESTED",
      buyer: {
        username: "acquirente-sintetico",
        name: "Mario Rossi",
        email: "acquirente@example.invalid",
        phone: "+39 000 0000000",
        billingAddress: savedAddress,
        shipTo: { name: "Anna Bianchi", phone: "+39 000 1111111", address: savedAddress },
      },
      items: [item("riga-1", "110-riga-1"), item("riga-2", null)],
    });
    expect(JSON.stringify(complete)).not.toContain("NON-ESPORRE");

    // Campi facoltativi assenti: nulli, senza errori; marketplace diversi non ne scelgono uno.
    const minimal = {
      orderId: "minimo",
      creationDate: "2026-09-20T10:00:00Z",
      lastModifiedDate: "2026-09-20T10:00:00Z",
      pricingSummary: { total: { value: "12.5", currency: "EUR" } },
    };
    expect(fulfillmentObservation(minimal, readAt)).toMatchObject({
      marketplaceId: null,
      paymentStatus: null,
      cancelStatus: null,
      buyer: {
        username: null,
        name: null,
        email: null,
        phone: null,
        billingAddress: null,
        shipTo: null,
      },
      items: [],
      total: { minor: 1250, currency: "EUR" },
    });
    expect(
      fulfillmentObservation(
        {
          ...minimal,
          buyer: { buyerRegistrationAddress: {} },
          fulfillmentStartInstructions: [{ shippingStep: { shipTo: {} } }],
          lineItems: [
            line("a", "1", "EBAY_IT"),
            { ...line("b", "2", "EBAY_DE"), lineItemCost: undefined },
          ],
        },
        readAt,
      ),
    ).toMatchObject({
      marketplaceId: null,
      buyer: { phone: null, shipTo: { name: null, phone: null, address: null } },
      items: [{ total: { minor: 1000 } }, { total: null }],
    });
    expect(
      fulfillmentObservation({ ...minimal, fulfillmentStartInstructions: [{}] }, readAt).buyer
        .shipTo,
    ).toBeNull();
    expect(
      fulfillmentObservation({ ...minimal, fulfillmentStartInstructions: [] }, readAt).buyer.shipTo,
    ).toBeNull();
    expect(() =>
      fulfillmentObservation(
        {
          ...minimal,
          pricingSummary: { total: { value: "12.345", currency: "EUR" } },
        },
        readAt,
      ),
    ).toThrow("inexact_amount");
    expect(() => fulfillmentObservation({ ...minimal, orderId: "" }, readAt)).toThrow();
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

describe("modello ordini", () => {
  const grantedAt = "2026-09-01T00:00:00.000Z";
  const target = (storeId = "s-a", observedAt = now) => ({
    storeId,
    consentGrantedAt: grantedAt,
    observedAt,
  });
  const line = (stableKey: string | null, lineItemId = `riga-${stableKey}`) => ({
    lineItemId,
    stableKey,
    title: `Articolo ${stableKey}`,
    quantity: 1,
    total: { minor: 1250, currency: "EUR" },
  });
  const observation = (overrides: Partial<OrderObservation> = {}): OrderObservation => ({
    source: "fulfillment",
    externalOrderId: "D-1",
    provisional: false,
    creationTime: "2026-09-10T10:00:00Z",
    lastModifiedTime: "2026-09-10T11:00:00Z",
    total: { minor: 2500, currency: "EUR" },
    paymentStatus: "PAID",
    buyer: { username: "acquirente", name: "Mario Rossi" },
    items: [line("k1"), line("k2")],
    ...overrides,
  });
  const provisional = (overrides: Partial<OrderObservation> = {}) =>
    observation({
      source: "trading",
      externalOrderId: "P-1",
      provisional: true,
      lastModifiedTime: "2026-09-10T10:30:00Z",
      paymentStatus: "PENDING",
      items: [line("k1", "t-1"), line("k2", "t-2")],
      ...overrides,
    });
  const orders = (storeId = "s-a") =>
    env.DB.prepare(
      `SELECT id, ebay_order_id, is_provisional, payment_status, buyer_json
         FROM orders WHERE store_id = ? ORDER BY ebay_order_id`,
    )
      .bind(storeId)
      .all()
      .then(({ results }) => results);

  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM ebay_store_pauses").run();
    await seed();
    await env.DB.prepare("DELETE FROM orders").run();
    await env.DB.prepare(
      `INSERT INTO ebay_store_credentials
         (store_id, access_token, access_expires_at, refresh_token, refresh_expires_at, granted_at)
       VALUES ('s-a', 'a', ?1, 'r', ?1, ?2), ('s-b', 'a', ?1, 'r', ?1, ?2)`,
    )
      .bind(now, grantedAt)
      .run();
  });

  it("importa ordini multi-articolo in modo idempotente, senza versioni per la sola data", async () => {
    const created = await recordOrderObservation(env.DB, target(), observation());
    expect(created).toMatchObject({ outcome: "created", taxChanges: 0, issue: null });
    const items = () =>
      env.DB.prepare(
        "SELECT id, line_item_id, total_minor, currency FROM order_items ORDER BY line_item_id",
      )
        .all()
        .then(({ results }) => results);
    const firstItems = await items();
    expect(firstItems).toHaveLength(2);

    expect(await recordOrderObservation(env.DB, target(), observation())).toEqual({
      outcome: "unchanged",
      orderId: (created as { orderId: string }).orderId,
      taxChanges: 0,
      issue: null,
    });
    const touched = observation({ lastModifiedTime: "2026-09-10T12:00:00Z" });
    expect((await recordOrderObservation(env.DB, target(), touched)).outcome).toBe("unchanged");
    expect(await items()).toEqual(firstItems);

    // Una sola riga modificata, poi il solo ordine, poi un cambiamento con la stessa data.
    const quantity = [{ ...line("k1"), quantity: 2 }, line("k2")];
    for (const [lastModifiedTime, paymentStatus] of [
      ["2026-09-10T12:30:00Z", "PAID"],
      ["2026-09-10T12:45:00Z", "PENDING"],
      ["2026-09-10T12:45:00Z", "PAID"],
    ] as const) {
      expect(
        await recordOrderObservation(
          env.DB,
          target(),
          observation({ lastModifiedTime, paymentStatus, items: quantity }),
        ),
      ).toMatchObject({ outcome: "updated" });
    }
    expect(
      await env.DB.prepare("SELECT id, quantity FROM order_items ORDER BY line_item_id")
        .all()
        .then(({ results }) => results),
    ).toEqual([
      { id: firstItems[0]!.id, quantity: 2 },
      { id: firstItems[1]!.id, quantity: 1 },
    ]);

    const changed = observation({
      lastModifiedTime: "2026-09-10T13:00:00Z",
      paymentStatus: "PAID",
      items: [line("k1")],
    });
    expect((await recordOrderObservation(env.DB, target(), changed)).outcome).toBe("updated");
    expect(await items()).toEqual([firstItems[0]]);
    expect(await orders()).toMatchObject([{ ebay_order_id: "D-1", payment_status: "PAID" }]);
  });

  it("scarta la lettura tardiva della stessa fonte prima di scrivere", async () => {
    await recordOrderObservation(env.DB, target(), observation());
    const late = observation({
      lastModifiedTime: "2026-09-10T10:59:59Z",
      paymentStatus: "PENDING",
    });
    expect(await recordOrderObservation(env.DB, target(), late)).toEqual({ outcome: "stale" });
    expect(await orders()).toMatchObject([{ payment_status: "PAID" }]);
  });

  it("conserva lo snapshot dell'acquirente di ogni ordine", async () => {
    await recordOrderObservation(env.DB, target(), observation());
    await recordOrderObservation(
      env.DB,
      target(),
      observation({
        externalOrderId: "D-2",
        buyer: { username: "acquirente", name: "Mario Rossi Bianchi" },
        items: [line("k9")],
      }),
    );
    const [first, second] = await orders();
    expect(JSON.parse(first!.buyer_json as string)).toMatchObject({ name: "Mario Rossi" });
    expect(JSON.parse(second!.buyer_json as string)).toMatchObject({ name: "Mario Rossi Bianchi" });
  });

  it("il definitivo eredita UUID e sblocco del provvisorio con le stesse righe", async () => {
    // La data Trading del provvisorio può essere successiva a quella Fulfillment del definitivo.
    const draft = await recordOrderObservation(
      env.DB,
      target(),
      provisional({
        lastModifiedTime: "2026-09-10T11:30:00Z",
        taxIdentifiers: {
          source: "ebay_trading_get_orders",
          complete: false,
          values: [{ type: "CODICE_FISCALE", issuingCountry: null, value: "RSSMRA80A01H501U" }],
        },
      }),
    );
    expect(draft).toMatchObject({ outcome: "created", taxChanges: 1 });
    const orderId = (draft as { orderId: string }).orderId;
    const itemRows = () =>
      env.DB.prepare("SELECT id, line_item_id, stable_key FROM order_items ORDER BY stable_key")
        .all<{ id: string }>()
        .then(({ results }) => results);
    const draftItems = await itemRows();
    await env.DB.prepare(
      `INSERT INTO order_grants (id, workspace_id, order_id, source, granted_at)
       VALUES ('g-1', 'w-a', ?, 'admin', ?)`,
    )
      .bind(orderId, now)
      .run();

    expect(await recordOrderObservation(env.DB, target(), observation())).toMatchObject({
      outcome: "updated",
      orderId,
    });
    expect(await orders()).toMatchObject([
      { id: orderId, ebay_order_id: "D-1", is_provisional: 0, payment_status: "PAID" },
    ]);
    // Le righe restano le stesse, con gli ID riga del definitivo.
    expect(await itemRows()).toEqual([
      { id: draftItems[0]!.id, line_item_id: "riga-k1", stable_key: "k1" },
      { id: draftItems[1]!.id, line_item_id: "riga-k2", stable_key: "k2" },
    ]);
    expect(
      await env.DB.prepare("SELECT order_id FROM order_grants")
        .all()
        .then(({ results }) => results),
    ).toEqual([{ order_id: orderId }]);
    const visible = await listVisibleOrders(env.DB, "u-a");
    expect(visible.map(({ id, fiscalState }) => [id, fiscalState])).toEqual([
      [orderId, "available"],
    ]);
  });

  it("aggancia al definitivo il provvisorio arrivato dopo, senza sovrascriverlo", async () => {
    const definitive = await recordOrderObservation(env.DB, target(), observation());
    const orderId = (definitive as { orderId: string }).orderId;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      expect(await recordOrderObservation(env.DB, target(), provisional())).toMatchObject({
        outcome: "unchanged",
        orderId,
      });
    }
    // Trading non sovrascrive un ordine letto da Fulfillment, anche con una data successiva.
    const tradingCopy = observation({
      source: "trading",
      lastModifiedTime: "2026-09-10T12:00:00Z",
      paymentStatus: "PENDING",
      items: [line("k1", "t-1"), line("k2", "t-2")],
    });
    expect(await recordOrderObservation(env.DB, target(), tradingCopy)).toMatchObject({
      outcome: "unchanged",
      orderId,
    });
    // Anche un ID riemesso con una lettura più vecchia aggancia soltanto il riferimento.
    const reissued = observation({
      externalOrderId: "D-0",
      lastModifiedTime: "2026-09-10T10:45:00Z",
      paymentStatus: "PENDING",
      items: [line("k1", "vecchia-1"), line("k2", "vecchia-2")],
    });
    expect(await recordOrderObservation(env.DB, target(), reissued)).toMatchObject({
      outcome: "unchanged",
      orderId,
    });
    expect(await orders()).toMatchObject([
      { id: orderId, ebay_order_id: "D-1", is_provisional: 0, payment_status: "PAID" },
    ]);
    expect(
      await env.DB.prepare(
        "SELECT source, external_order_id FROM order_source_refs ORDER BY source, external_order_id",
      )
        .all()
        .then(({ results }) => results),
    ).toEqual([
      { source: "fulfillment", external_order_id: "D-0" },
      { source: "fulfillment", external_order_id: "D-1" },
      { source: "trading", external_order_id: "D-1" },
      { source: "trading", external_order_id: "P-1" },
    ]);
  });

  it("non riconcilia righe di negozi diversi", async () => {
    await recordOrderObservation(env.DB, target(), observation());
    const other = await recordOrderObservation(env.DB, target("s-b"), provisional());
    expect(other).toMatchObject({ outcome: "created", issue: null });
    expect(await orders("s-a")).toHaveLength(1);
    expect(await orders("s-b")).toMatchObject([{ ebay_order_id: "P-1", is_provisional: 1 }]);
    await expect(
      env.DB.prepare(
        `INSERT INTO order_reconciliation_issues (order_id, related_order_id, kind, detected_at)
         SELECT a.id, b.id, 'partial_overlap', ?
           FROM orders a, orders b WHERE a.store_id = 's-a' AND b.store_id = 's-b'`,
      )
        .bind(now)
        .run(),
    ).rejects.toThrow("reconciliation_across_stores");
  });

  it("rende esplicite sovrapposizioni parziali, identità mancanti e più candidati", async () => {
    await recordOrderObservation(env.DB, target(), observation());
    const cases = [
      ["X-1", [line("k2"), line("k3")], "partial_overlap"],
      ["Y-1", [line("k4"), line(null, "senza-identita")], null],
      ["Y-2", [line("k4"), line("k5")], "missing_line_identity"],
      ["Z-1", [line("k1"), line("k3")], "multiple_candidates"],
    ] as const;
    for (const [externalOrderId, items, issue] of cases) {
      expect(
        await recordOrderObservation(
          env.DB,
          target(),
          observation({ externalOrderId, items: [...items] }),
        ),
      ).toMatchObject({ outcome: "created", issue });
    }
    expect(await orders()).toHaveLength(5);
    expect(
      await env.DB.prepare(
        `SELECT o.ebay_order_id AS orderId, r.ebay_order_id AS relatedId, i.kind
           FROM order_reconciliation_issues i
           JOIN orders o ON o.id = i.order_id JOIN orders r ON r.id = i.related_order_id
          ORDER BY orderId, relatedId`,
      )
        .all()
        .then(({ results }) => results),
    ).toEqual([
      { orderId: "X-1", relatedId: "D-1", kind: "partial_overlap" },
      { orderId: "Y-2", relatedId: "Y-1", kind: "missing_line_identity" },
      { orderId: "Z-1", relatedId: "D-1", kind: "multiple_candidates" },
      { orderId: "Z-1", relatedId: "X-1", kind: "multiple_candidates" },
    ]);
    // Un candidato identico insieme a un altro che condivide una riga resta ambiguo.
    expect(
      await recordOrderObservation(env.DB, target(), observation({ externalOrderId: "V-1" })),
    ).toMatchObject({ outcome: "created", issue: "multiple_candidates" });
    for (const [items, issue] of [
      [[line("k1")], "partial_overlap"],
      [[line("k1"), line(null, "senza")], "missing_line_identity"],
    ] as const) {
      await env.DB.prepare("DELETE FROM orders").run();
      await recordOrderObservation(env.DB, target(), observation());
      expect(
        await recordOrderObservation(
          env.DB,
          target(),
          observation({ externalOrderId: "W-1", items: [...items] }),
        ),
      ).toMatchObject({ outcome: "created", issue });
    }
    await env.DB.prepare("DELETE FROM orders").run();
    await recordOrderObservation(env.DB, target(), observation());
    await recordOrderObservation(
      env.DB,
      target(),
      observation({ externalOrderId: "X-1", items: [line("k2"), line("k3")] }),
    );
    // La stessa lettura ripetuta riconosce l'ordine già creato e non duplica l'anomalia.
    expect(
      await recordOrderObservation(
        env.DB,
        target(),
        observation({ externalOrderId: "X-1", items: [line("k2"), line("k3")] }),
      ),
    ).toMatchObject({ outcome: "unchanged", issue: null });
  });

  it("conserva ogni variazione fiscale effettiva e mostra solo il dato corrente", async () => {
    const tax = (complete: boolean, ...values: string[]) =>
      observation({
        taxIdentifiers: {
          source: "ebay_trading_get_orders",
          complete,
          values: values.map((value) => ({
            type: "CODICE_FISCALE",
            issuingCountry: "IT",
            value,
          })),
        },
      });
    const changes = async (input: OrderObservation, observedAt: string) =>
      (
        (await recordOrderObservation(env.DB, target("s-a", observedAt), input)) as {
          taxChanges: number;
        }
      ).taxChanges;
    expect(
      await changes(tax(true, "RSSMRA80A01H501U", "RSSMRA80A01H501U"), "2026-09-11T00:00:00.000Z"),
    ).toBe(1);
    expect(await changes(tax(true, "RSSMRA80A01H501U"), "2026-09-12T00:00:00.000Z")).toBe(0);
    expect(await changes(tax(true, "BNCLGU80A01H501Z"), "2026-09-13T00:00:00.000Z")).toBe(2);
    // Una lettura che non prova l'assenza non chiude il valore corrente.
    expect(await changes(tax(false), "2026-09-14T00:00:00.000Z")).toBe(0);
    expect(await changes(tax(true, "RSSMRA80A01H501U"), "2026-09-15T00:00:00.000Z")).toBe(2);
    expect(
      await env.DB.prepare(
        "SELECT value, observed_at, removed_at FROM tax_identifiers ORDER BY observed_at",
      )
        .all()
        .then(({ results }) => results),
    ).toEqual([
      {
        value: "RSSMRA80A01H501U",
        observed_at: "2026-09-11T00:00:00.000Z",
        removed_at: "2026-09-13T00:00:00.000Z",
      },
      {
        value: "BNCLGU80A01H501Z",
        observed_at: "2026-09-13T00:00:00.000Z",
        removed_at: "2026-09-15T00:00:00.000Z",
      },
      { value: "RSSMRA80A01H501U", observed_at: "2026-09-15T00:00:00.000Z", removed_at: null },
    ]);
    const [order] = await orders();
    await env.DB.prepare(
      `INSERT INTO order_grants (id, workspace_id, order_id, source, granted_at)
       VALUES ('g-1', 'w-a', ?, 'admin', ?)`,
    )
      .bind(order!.id, now)
      .run();
    expect((await listVisibleOrders(env.DB, "u-a"))[0]?.taxIdentifiers).toMatchObject([
      { value: "RSSMRA80A01H501U", observedAt: "2026-09-15T00:00:00.000Z" },
    ]);
  });

  it("non scrive con un consenso diverso o con il negozio in pausa", async () => {
    expect(
      await recordOrderObservation(
        env.DB,
        { ...target(), consentGrantedAt: "2026-08-01T00:00:00.000Z" },
        observation(),
      ),
    ).toEqual({ outcome: "not_writable" });
    await env.DB.prepare(
      "INSERT INTO ebay_store_pauses (store_id, reason, paused_at) VALUES ('s-a', 'manual', ?)",
    )
      .bind(now)
      .run();
    expect(await recordOrderObservation(env.DB, target(), observation())).toEqual({
      outcome: "not_writable",
    });
    expect(await orders()).toEqual([]);
    // Anche un ordine già salvato non cambia dopo la pausa.
    await env.DB.prepare("DELETE FROM ebay_store_pauses").run();
    await recordOrderObservation(env.DB, target(), observation());
    await env.DB.prepare(
      "INSERT INTO ebay_store_pauses (store_id, reason, paused_at) VALUES ('s-a', 'manual', ?)",
    )
      .bind(now)
      .run();
    const later = observation({
      lastModifiedTime: "2026-09-10T12:00:00Z",
      paymentStatus: "PENDING",
    });
    expect(await recordOrderObservation(env.DB, target(), later)).toEqual({
      outcome: "not_writable",
    });
    expect(await orders()).toMatchObject([{ payment_status: "PAID" }]);
  });

  it("attribuisce i campi alla fonte proprietaria dell'ordine", async () => {
    const trading = (overrides: Partial<OrderObservation>) =>
      observation({ source: "trading", externalOrderId: "T-1", ...overrides });
    const steps = [
      // Un ordine letto solo da Trading segue le letture Trading più recenti.
      [trading({ paymentStatus: "PENDING" }), "created", "T-1", "PENDING"],
      [trading({ lastModifiedTime: "2026-09-10T12:00:00Z" }), "updated", "T-1", "PAID"],
      // Un provvisorio non sostituisce il definitivo, neppure se più recente.
      [
        provisional({ externalOrderId: "P-9", lastModifiedTime: "2026-09-10T13:00:00Z" }),
        "unchanged",
        "T-1",
        "PAID",
      ],
      // Un altro ID Trading più vecchio aggancia soltanto il riferimento.
      [
        trading({
          externalOrderId: "T-0",
          lastModifiedTime: "2026-09-10T10:00:00Z",
          paymentStatus: "PENDING",
          items: [line("k1", "vecchia-1"), line("k2", "vecchia-2")],
        }),
        "unchanged",
        "T-1",
        "PAID",
      ],
      // Fulfillment subentra anche con una data precedente.
      [
        observation({ lastModifiedTime: "2026-09-10T09:00:00Z", paymentStatus: "PENDING" }),
        "updated",
        "D-1",
        "PENDING",
      ],
    ] as const;
    for (const [input, outcome, ebayOrderId, paymentStatus] of steps) {
      expect(await recordOrderObservation(env.DB, target(), input)).toMatchObject({ outcome });
      expect(await orders()).toMatchObject([
        { ebay_order_id: ebayOrderId, payment_status: paymentStatus },
      ]);
    }
  });

  it("riconosce le righe salvate senza identità e non abbina due righe alla stessa", async () => {
    const created = await recordOrderObservation(
      env.DB,
      target(),
      observation({ items: [line(null, "r1")] }),
    );
    const [saved] = await env.DB.prepare("SELECT id FROM order_items")
      .all<{ id: string }>()
      .then(({ results }) => results);
    expect(
      await recordOrderObservation(
        env.DB,
        target(),
        observation({ lastModifiedTime: "2026-09-10T12:00:00Z", items: [line("k1", "r1")] }),
      ),
    ).toMatchObject({ outcome: "updated", orderId: (created as { orderId: string }).orderId });
    expect(
      await recordOrderObservation(
        env.DB,
        target(),
        observation({
          lastModifiedTime: "2026-09-10T13:00:00Z",
          items: [line("k1", "r2"), line(null, "r1")],
        }),
      ),
    ).toMatchObject({ outcome: "updated" });
    const { results: rows } = await env.DB.prepare(
      "SELECT id, line_item_id, stable_key FROM order_items ORDER BY line_item_id",
    ).all<{ id: string; line_item_id: string; stable_key: string | null }>();
    expect(rows.map(({ line_item_id, stable_key }) => [line_item_id, stable_key])).toEqual([
      ["r1", null],
      ["r2", "k1"],
    ]);
    expect(rows[1]!.id).toBe(saved!.id);
    expect(rows[0]!.id).not.toBe(saved!.id);

    // Rilette in ordine inverso, con e senza identità, le righe restano le stesse.
    const reversed = observation({
      lastModifiedTime: "2026-09-10T14:00:00Z",
      items: [line(null, "r1"), line("k1", "r2")],
    });
    expect(await recordOrderObservation(env.DB, target(), reversed)).toMatchObject({
      outcome: "unchanged",
    });
    await recordOrderObservation(
      env.DB,
      target(),
      observation({
        lastModifiedTime: "2026-09-10T15:00:00Z",
        items: [line("k1", "r2"), line("k2", "r3"), line(null, "r1"), line(null, "r4")],
      }),
    );
    const before = await env.DB.prepare("SELECT id, line_item_id FROM order_items ORDER BY id")
      .all()
      .then(({ results }) => results);
    expect(
      await recordOrderObservation(
        env.DB,
        target(),
        observation({
          lastModifiedTime: "2026-09-10T16:00:00Z",
          items: [line(null, "r4"), line("k2", "r3"), line(null, "r1"), line("k1", "r2")],
        }),
      ),
    ).toMatchObject({ outcome: "unchanged" });
    expect(
      await env.DB.prepare("SELECT id, line_item_id FROM order_items ORDER BY id")
        .all()
        .then(({ results }) => results),
    ).toEqual(before);
  });

  it("valida l'osservazione e salva lo snapshot con tutti i campi", async () => {
    for (const invalid of [
      observation({ total: { minor: 1, currency: "EURO" } }),
      observation({ items: [line("k1", "stessa"), line("k2", "stessa")] }),
      observation({ items: [line("k1", "a"), line("k1", "b")] }),
    ]) {
      await expect(recordOrderObservation(env.DB, target(), invalid)).rejects.toThrow();
    }
    const address = {
      addressLine1: "Via Roma 1",
      addressLine2: null,
      city: "Trento",
      postalCode: "38122",
      stateOrProvince: "TN",
      countryCode: "IT",
    };
    await recordOrderObservation(
      env.DB,
      target(),
      observation({
        buyer: {
          username: "acquirente",
          name: "Mario Rossi",
          email: "a@example.invalid",
          phone: "+39 1",
          billingAddress: { ...address, extra: "NON-ESPORRE" } as typeof address,
          shipTo: { name: "Anna", address },
        },
        // Righe senza identità possono essere più d'una.
        items: [line(null, "a"), line(null, "b")],
        taxIdentifiers: {
          source: "ebay_fulfillment",
          complete: true,
          values: [{ type: "VAT_ID", issuingCountry: null, value: "01234567890" }],
        },
      }),
    );
    expect((await orders())[0]!.buyer_json).toBe(
      JSON.stringify({
        username: "acquirente",
        name: "Mario Rossi",
        email: "a@example.invalid",
        phone: "+39 1",
        billingAddress: address,
        shipTo: { name: "Anna", phone: null, address },
      }),
    );
    // La stessa lettura completa con Paese nullo non chiude il valore.
    expect(
      await recordOrderObservation(
        env.DB,
        target(),
        observation({
          buyer: { username: "acquirente" },
          items: [line(null, "a"), line(null, "b")],
          taxIdentifiers: {
            source: "ebay_fulfillment",
            complete: true,
            values: [{ type: "VAT_ID", issuingCountry: null, value: "01234567890" }],
          },
        }),
      ),
    ).toMatchObject({ outcome: "updated", taxChanges: 0 });
    expect(
      await env.DB.prepare("SELECT source, removed_at FROM tax_identifiers")
        .all()
        .then(({ results }) => results),
    ).toEqual([{ source: "ebay_fulfillment", removed_at: null }]);
    expect((await orders())[0]!.buyer_json).toBe(
      JSON.stringify({
        username: "acquirente",
        name: null,
        email: null,
        phone: null,
        billingAddress: null,
        shipTo: null,
      }),
    );
  });

  it("limita la pagina degli ordini visibili", async () => {
    await recordOrderObservation(env.DB, target(), observation());
    await recordOrderObservation(
      env.DB,
      target(),
      observation({ externalOrderId: "D-2", items: [line("k9")] }),
    );
    expect(await listVisibleOrders(env.DB, "u-a")).toHaveLength(2);
    expect(await listVisibleOrders(env.DB, "u-a", 1)).toHaveLength(1);
    expect(await listVisibleOrders(env.DB, "u-a", 0)).toHaveLength(1);
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
  options: {
    username?: string;
    trading?: () => Response;
    token?: () => Response;
    orderId?: string;
    orders?: unknown[];
    ordersPayload?: unknown;
    userId?: string;
  } = {},
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
        userId: options.userId ?? "ebay-user-sintetico",
        username: options.username ?? "venditore",
      });
    }
    if (url.includes("/sell/fulfillment/v1/order")) {
      if (options.ordersPayload) return Response.json(options.ordersPayload);
      if (options.orders) return Response.json({ orders: options.orders, total: 0 });
      return Response.json({
        orders: [
          {
            orderId: options.orderId ?? syntheticOrderId,
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
      dataDeleted: false,
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
    // Dopo l'eliminazione la schermata non promette più di conservare gli ordini.
    expect(await deleteStoreData(env.DB, owner.userId, store!.id, "nome-aggiornato")).toBe("done");
    const deleted = await loadStoreLink({
      request: new Request(
        `http://localhost:5173/app/negozi/collega?ricollega=${store!.id}&da=negozi`,
        { headers: { cookie: owner.cookie } },
      ),
    } as never);
    expect(deleted).toMatchObject({ dataDeleted: true });
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
              "api.sandbox.ebay.com",
              "api.sandbox.ebay.com",
            ]
          : ["api.ebay.com", "apiz.ebay.com", "api.ebay.com", "api.ebay.com"],
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

  it("legge l'osservazione fiscale Trading del solo ordine richiesto", () => {
    expect(parseTradingOrderTaxIdentifiers(syntheticTradingXml, syntheticOrderId)).toEqual([
      { id: "SYNTHETIC&ID", type: "CODICE_FISCALE", attributes: [] },
    ]);
    expect(() =>
      parseTradingOrderTaxIdentifiers("<GetOrdersResponse><Ack>Failure</Ack>", syntheticOrderId),
    ).toThrow(UpstreamError);
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
    expect(home.orders[0]).toMatchObject({ storeName: "venditore", fiscalState: "locked" });
    expect(home.orders[0]?.summary).toEqual({
      buyer: { username: "acquirente-sintetico" },
      orderPaymentStatus: "PAID",
      orderFulfillmentStatus: "NOT_STARTED",
      payment: "paid",
      shipping: "to_ship",
      lineItems: [
        {
          lineItemId: "riga-sintetica",
          title: "Articolo sintetico",
          quantity: 2,
          sku: "SKU-SINTETICO",
        },
      ],
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
    const requests = ebay.mock.calls.map(([url, init]) => ({
      url: String(url),
      method: init?.method ?? "GET",
      headers: init?.headers,
      body: init?.body === undefined ? undefined : String(init.body),
    }));
    const codeVerifier = new URLSearchParams(requests[0]!.body).get("code_verifier");
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
      {
        url: "https://api.ebay.com/sell/fulfillment/v1/order?limit=1",
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
    await handleAuthRequest(
      storeCallback(`state=${second}&code=due`, cookie),
      env,
      syntheticEbay({
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
        dataDeleted: false,
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
      const { cookie } = await verifiedSession("import-fallito@example.invalid");
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
        const line = JSON.parse(log.mock.calls[0]![0] as string);
        expect(line).toMatchObject({
          code: "UPSTREAM_UNAVAILABLE",
          operation: "store_link",
          failure,
        });
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
      // La verifica fiscale fallita non dichiara riuscita la sincronizzazione.
      expect(await env.DB.prepare("SELECT COUNT(*) AS total FROM sync_state").first()).toEqual({
        total: 0,
      });
      // Senza ordini importati la pagina non chiede di collegare un negozio già collegato.
      await env.DB.prepare("DELETE FROM orders").run();
      const home = await homeFor(cookie);
      expect({ orders: home.orders, storeLinked: home.storeLinked }).toEqual({
        orders: [],
        storeLinked: true,
      });
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

describe("client eBay e normalizzazione", () => {
  const configuration = ebayConfiguration(env, "production");
  const access = (fetcher: typeof fetch) => ({
    fetcher,
    configuration,
    accessToken: "token-sintetico",
  });
  const failure = (promise: Promise<unknown>) =>
    promise.then(
      () => null,
      (error: unknown) =>
        error instanceof UpstreamError ? { failure: error.failure, ...error.details } : error,
    );
  const trading = (body: string) => vi.fn<typeof fetch>(async () => new Response(body));
  const withUser = (url: string) => Object.assign(new URL(url), { username: "utente" }).href;
  const ack = (inner: string) =>
    `<?xml version="1.0" encoding="UTF-8"?><GetItemResponse xmlns="urn:ebay:apis:eBLBaseComponents">${inner}</GetItemResponse>`;
  const tradingError = (code: string, classification = "RequestError", severity = "Error") =>
    ack(
      `<Ack>Failure</Ack><Errors><ShortMessage>NON-ESPORRE</ShortMessage><ErrorCode>${code}</ErrorCode>` +
        `<SeverityCode>${severity}</SeverityCode><ErrorClassification>${classification}</ErrorClassification></Errors>`,
    );

  // Ordine sintetico: acquirente registrato, destinatario diverso con `c/o`, telefono
  // strutturato, campi inattesi e marketplace dell'inserzione.
  const order = (overrides: Record<string, unknown> = {}) => ({
    orderId: "12-34567-89012",
    creationDate: "2026-09-01T08:00:00.000Z",
    lastModifiedDate: "2026-09-01T09:00:00.000Z",
    orderPaymentStatus: "PAID",
    orderFulfillmentStatus: "NOT_STARTED",
    cancelStatus: { cancelState: "NONE_REQUESTED", cancelRequests: [] },
    pricingSummary: { total: { value: "49.90", currency: "EUR" } },
    salesRecordReference: "NON-ESPORRE",
    buyer: {
      username: "acquirente-sintetico",
      buyerRegistrationAddress: {
        fullName: "Maria Verdi",
        email: "acquirente@example.invalid",
        primaryPhone: { phoneNumber: "+39 0461 000000", countryCode: "IT" },
        contactAddress: {
          addressLine1: "Via Fiscale 1",
          city: "Trento",
          postalCode: "38122",
          countryCode: "IT",
        },
      },
    },
    fulfillmentStartInstructions: [
      {
        shippingStep: {
          shipTo: {
            fullName: "Luca Neri c/o Hotel Sintetico",
            companyName: "NON-ESPORRE",
            primaryPhone: { phoneNumber: "+39 0461 111111" },
            contactAddress: {
              addressLine1: "Piazza Spedizione 2",
              addressLine2: "c/o Reception",
              city: "Bolzano",
              postalCode: "39100",
              countryCode: "IT",
            },
          },
        },
      },
    ],
    lineItems: [
      {
        lineItemId: "10000000001",
        legacyItemId: "110000000001",
        title: "Articolo sintetico",
        quantity: 1,
        lineItemCost: { value: "49.90", currency: "EUR" },
        listingMarketplaceId: "EBAY_IT",
        purchaseMarketplaceId: "EBAY_DE",
        nuovoCampoEbay: { valore: "NON-ESPORRE" },
      },
    ],
    ...overrides,
  });

  it("conserva acquirente, destinatario con c/o e telefono così come li fornisce eBay", () => {
    const observation = fulfillmentObservation(order(), "2026-09-02T00:00:00.000Z");
    expect(observation.buyer).toEqual({
      username: "acquirente-sintetico",
      name: "Maria Verdi",
      email: "acquirente@example.invalid",
      phone: "+39 0461 000000",
      billingAddress: {
        addressLine1: "Via Fiscale 1",
        addressLine2: null,
        city: "Trento",
        postalCode: "38122",
        stateOrProvince: null,
        countryCode: "IT",
      },
      shipTo: {
        name: "Luca Neri c/o Hotel Sintetico",
        phone: "+39 0461 111111",
        address: {
          addressLine1: "Piazza Spedizione 2",
          addressLine2: "c/o Reception",
          city: "Bolzano",
          postalCode: "39100",
          stateOrProvince: null,
          countryCode: "IT",
        },
      },
    });
    // Il marketplace è quello dell'inserzione, non quello d'acquisto.
    expect(observation.marketplaceId).toBe("EBAY_IT");
    expect(JSON.stringify(observation)).not.toContain("NON-ESPORRE");
  });

  it("distingue i campi mascherati per età da quelli assenti", () => {
    const old = order({
      creationDate: "2026-05-01T08:00:00.000Z",
      buyer: {
        username: "acquirente-sintetico",
        buyerRegistrationAddress: {
          contactAddress: { city: "Trento", postalCode: "38122", countryCode: "IT" },
        },
      },
      fulfillmentStartInstructions: [
        { shippingStep: { shipTo: { contactAddress: { city: "Bolzano", countryCode: "IT" } } } },
      ],
    });
    expect(fulfillmentObservation(old, "2026-09-01T00:00:00.000Z").buyer.masked).toEqual([
      "email",
      "name",
      "phone",
      "billingAddress.addressLine1",
      "shipTo.name",
      "shipTo.phone",
      "shipTo.address.addressLine1",
    ]);
    // Entro 14 giorni un campo assente è soltanto assente; dopo, l'email è mascherata.
    const recent = order({
      buyer: { username: "acquirente-sintetico", buyerRegistrationAddress: { fullName: "X" } },
      fulfillmentStartInstructions: [],
    });
    expect(fulfillmentObservation(recent, "2026-09-10T00:00:00.000Z").buyer.masked).toBeUndefined();
    // Al quattordicesimo giorno esatto eBay fornisce ancora l'email.
    expect(fulfillmentObservation(recent, "2026-09-15T08:00:00.000Z").buyer.masked).toBeUndefined();
    expect(fulfillmentObservation(recent, "2026-09-20T00:00:00.000Z").buyer.masked).toEqual([
      "email",
    ]);
    // Un campo ancora fornito oltre il limite resta un dato, non un mascheramento.
    expect(
      fulfillmentObservation(order(), "2026-12-31T00:00:00.000Z").buyer.masked,
    ).toBeUndefined();
  });

  it("normalizza pagamento ed evasione senza inventare stati sconosciuti", () => {
    expect(
      ["PAID", "PENDING", "FAILED", "PARTIALLY_REFUNDED", "FULLY_REFUNDED", "NUOVO", null].map(
        paymentState,
      ),
    ).toEqual(["paid", "unpaid", "unpaid", "partially_refunded", "refunded", "unknown", null]);
    expect(
      [
        ["NOT_STARTED", "NONE_REQUESTED"],
        ["IN_PROGRESS", "IN_PROGRESS"],
        ["FULFILLED", null],
        ["NOT_STARTED", "CANCELED"],
        ["NUOVO", "NONE_REQUESTED"],
        [null, null],
      ].map(([fulfillment, cancel]) => shippingState(fulfillment!, cancel!)),
    ).toEqual(["to_ship", "in_progress", "shipped", "cancelled", "unknown", null]);
  });

  it("segue `next` solo sulla stessa origine API HTTPS, senza inviare il token altrove", async () => {
    const pages = vi.fn<typeof fetch>(async () =>
      Response.json({
        orders: [{ orderId: "A" }],
        total: 2,
        next: "https://api.ebay.com/sell/fulfillment/v1/order?limit=1&offset=1",
      }),
    );
    const first = await readFulfillmentOrders(access(pages), {
      limit: 1,
      filter: "lastmodifieddate:[2026-09-01T00:00:00.000Z..]",
    });
    await readFulfillmentOrders(access(pages), { next: first.next! });
    await readFulfillmentOrders(access(pages), { next: "/sell/fulfillment/v1/order?offset=2" });
    expect(pages.mock.calls.map(([url, init]) => [String(url), init?.headers])).toEqual([
      [
        "https://api.ebay.com/sell/fulfillment/v1/order?limit=1&filter=lastmodifieddate%3A%5B2026-09-01T00%3A00%3A00.000Z..%5D",
        { authorization: "Bearer token-sintetico" },
      ],
      [
        "https://api.ebay.com/sell/fulfillment/v1/order?limit=1&offset=1",
        { authorization: "Bearer token-sintetico" },
      ],
      [
        "https://api.ebay.com/sell/fulfillment/v1/order?offset=2",
        { authorization: "Bearer token-sintetico" },
      ],
    ]);

    const guarded = vi.fn<typeof fetch>(async () => Response.json({ total: 0 }));
    for (const next of [
      "http://api.ebay.com/sell/fulfillment/v1/order?offset=1",
      "https://api.ebay.com.esempio.invalid/sell/fulfillment/v1/order",
      "https://api.sandbox.ebay.com/sell/fulfillment/v1/order",
      "https://api.ebay.com:8443/sell/fulfillment/v1/order",
      withUser("https://api.ebay.com/sell/fulfillment/v1/order"),
      "https://api.ebay.com/sell/fulfillment/v1/orderx",
      "https://api.ebay.com/identity/v1/oauth2/token",
      "//esempio.invalid/sell/fulfillment/v1/order",
      "javascript:alert(1)",
    ]) {
      expect(await failure(readFulfillmentOrders(access(guarded), { next }))).toEqual({
        failure: "invalid_response",
      });
    }
    expect(guarded).not.toHaveBeenCalled();
  });

  it("rifiuta prima del parsing l'XML Trading troppo grande, con NUL o con DOCTYPE/ENTITY", async () => {
    for (const body of [
      `<?xml version="1.0"?><!DOCTYPE x [<!ENTITY a "b">]>${ack("<Ack>Success</Ack>")}`,
      `<?xml version="1.0"?><!entity a "b">${ack("<Ack>Success</Ack>")}`,
      ack("<Ack>Success</Ack>\0"),
    ]) {
      expect(await failure(readTradingTaxIdentifiers(access(trading(body)), "1"))).toEqual({
        failure: "invalid_response",
      });
    }
    // Oltre il limite, anche senza Content-Length, la lettura si interrompe.
    const oversized = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array(65_536).fill(32));
      },
    });
    expect(
      await failure(
        readTradingTaxIdentifiers(
          access(vi.fn<typeof fetch>(async () => new Response(oversized))),
          "1",
        ),
      ),
    ).toEqual({ failure: "invalid_response", status: 200 });
    expect(() => tradingAck(ack("<Ack>Success</Ack>") + " ".repeat(2_097_153))).toThrow(
      UpstreamError,
    );
  });

  it("tipizza gli errori Trading con il solo codice eBay", async () => {
    for (const [body, expected] of [
      [tradingError("931"), { failure: "credentials", providerCode: "931" }],
      [tradingError("21916984"), { failure: "credentials", providerCode: "21916984" }],
      [tradingError("518"), { failure: "rate_limited", providerCode: "518" }],
      [tradingError("10007", "SystemError"), { failure: "unavailable", providerCode: "10007" }],
      [tradingError("37"), { failure: "rejected", providerCode: "37" }],
      [ack("<Ack>Sconosciuto</Ack>"), { failure: "invalid_response" }],
      [ack(""), { failure: "invalid_response" }],
    ] as const) {
      const result = await failure(readItemImage(access(trading(body)), "1"));
      expect(result).toEqual(expected);
      expect(JSON.stringify(result)).not.toContain("NON-ESPORRE");
    }
    // Un avviso non è un errore.
    expect(
      await readItemImage(
        access(
          trading(ack("<Ack>Warning</Ack><Errors><SeverityCode>Warning</SeverityCode></Errors>")),
        ),
        "1",
      ),
    ).toBeNull();
  });

  it("accetta solo immagini eBay HTTPS in formato raster", async () => {
    const valid = "https://i.ebayimg.com/images/g/abc/s-l1600.jpg";
    for (const url of [
      valid,
      "https://i.ebayimg.com/00/s/MTYwMA==/z/abc/$_57.JPG?set_id=1",
      "https://i.ebayimg.sandbox.ebay.com/images/g/abc/s-l500.webp",
    ]) {
      expect(qualifiedImageUrl(url)).toBe(new URL(url).href);
    }
    for (const url of [
      "http://i.ebayimg.com/images/g/abc/s-l1600.jpg",
      "https://i.ebayimg.com.esempio.invalid/a.jpg",
      "https://esempio.invalid/i.ebayimg.com/a.jpg",
      "https://i.ebayimg.com/images/a.svg",
      "https://i.ebayimg.com/images/a.jpg.html",
      "https://i.ebayimg.com:444/images/a.jpg",
      withUser("https://i.ebayimg.com/images/a.jpg"),
      "data:image/png;base64,AAAA",
      "non un url",
    ]) {
      expect(qualifiedImageUrl(url)).toBeNull();
    }
    expect(
      parseItemImage(
        ack(
          "<Ack>Success</Ack><Item><PictureDetails><GalleryURL>https://esempio.invalid/a.jpg</GalleryURL>" +
            `<PictureURL>${valid}</PictureURL></PictureDetails></Item>`,
        ),
      ),
    ).toBe(valid);
    expect(parseItemImage(ack("<Ack>Success</Ack><Item></Item>"))).toBeNull();

    const getItem = trading(
      ack(
        `<Ack>Success</Ack><Item><PictureDetails><PictureURL>${valid}</PictureURL></PictureDetails></Item>`,
      ),
    );
    expect(await readItemImage(access(getItem), "110<1>")).toBe(valid);
    const [, init] = getItem.mock.calls[0]!;
    expect((init!.headers as Record<string, string>)["x-ebay-api-call-name"]).toBe("GetItem");
    expect(String(init!.body)).toContain("<ItemID>110&lt;1&gt;</ItemID>");
  });

  describe("acquisizione con il client", () => {
    const grantedAt = "2026-09-01T00:00:00.000Z";
    const image = "https://i.ebayimg.com/images/g/abc/s-l1600.jpg";
    const provider = (options: { getItem?: () => Response; order?: unknown } = {}) =>
      vi.fn<typeof fetch>(async (input, init) => {
        const url = String(input);
        if (url.includes("/sell/fulfillment/v1/order")) {
          return Response.json({ orders: [options.order ?? order()], total: 1 });
        }
        const call = new Headers(init?.headers).get("x-ebay-api-call-name");
        if (call === "GetItem") {
          return (
            options.getItem?.() ??
            new Response(
              ack(
                `<Ack>Success</Ack><Item><PictureDetails><PictureURL>${image}</PictureURL></PictureDetails></Item>`,
              ),
            )
          );
        }
        return new Response(
          `<GetOrdersResponse><Ack>Success</Ack><OrderArray><Order><OrderID>12-34567-89012</OrderID>` +
            `<BuyerTaxIdentifier><Type>CODICE_FISCALE</Type><ID>SINTETICO</ID></BuyerTaxIdentifier>` +
            `</Order></OrderArray></GetOrdersResponse>`,
        );
      });
    const calls = (fetcher: ReturnType<typeof provider>, name: string) =>
      fetcher.mock.calls.filter(
        ([, init]) => new Headers(init?.headers).get("x-ebay-api-call-name") === name,
      ).length;
    const importWith = (fetcher: typeof fetch, readAt = "2026-09-02T00:00:00.000Z") =>
      importLatestOrder({
        db: env.DB,
        storeId: "s-a",
        grantedAt,
        access: access(fetcher),
        now: readAt,
      });

    beforeEach(async () => {
      await env.DB.prepare("DELETE FROM ebay_store_pauses").run();
      await seed();
      await env.DB.prepare("DELETE FROM orders").run();
      await env.DB.prepare(
        `INSERT INTO ebay_store_credentials
           (store_id, access_token, access_expires_at, refresh_token, refresh_expires_at, granted_at)
         VALUES ('s-a', 'a', ?1, 'r', ?1, ?2)`,
      )
        .bind(now, grantedAt)
        .run();
    });

    it("legge l'immagine una volta per articolo e non blocca l'ordine se GetItem fallisce", async () => {
      // Due righe della stessa inserzione (varianti) richiedono una sola lettura.
      const [line] = order().lineItems;
      const variants = order({ lineItems: [line, { ...line, lineItemId: "10000000002" }] });
      const failing = provider({
        order: variants,
        getItem: () => new Response(null, { status: 503 }),
      });
      await importWith(failing);
      expect(calls(failing, "GetItem")).toBe(1);
      expect(await env.DB.prepare("SELECT image_url FROM order_items").all()).toMatchObject({
        results: [{ image_url: null }, { image_url: null }],
      });
      await env.DB.prepare("DELETE FROM orders").run();
      await importWith(provider({ getItem: () => new Response(null, { status: 503 }) }));
      expect(await env.DB.prepare("SELECT value FROM tax_identifiers").all()).toMatchObject({
        results: [{ value: "SINTETICO" }],
      });

      const working = provider();
      await importWith(working);
      expect(await env.DB.prepare("SELECT image_url FROM order_items").all()).toMatchObject({
        results: [{ image_url: image }],
      });
      // Con l'immagine già salvata non si richiama GetItem e la rilettura la conserva.
      const again = provider();
      await importWith(again);
      expect(calls(again, "GetItem")).toBe(0);
      expect(await env.DB.prepare("SELECT image_url FROM order_items").all()).toMatchObject({
        results: [{ image_url: image }],
      });
    });

    it("una rilettura con dati mascherati non cancella quelli già acquisiti", async () => {
      await importWith(provider());
      const masked = order({
        lastModifiedDate: "2026-12-01T09:00:00.000Z",
        orderPaymentStatus: "FULLY_REFUNDED",
        buyer: {
          username: "acquirente-sintetico",
          buyerRegistrationAddress: {
            contactAddress: { city: "Trento", postalCode: "38122", countryCode: "IT" },
          },
        },
        fulfillmentStartInstructions: [
          {
            shippingStep: {
              shipTo: {
                contactAddress: { city: "Bolzano", postalCode: "39100", countryCode: "IT" },
              },
            },
          },
        ],
      });
      await importWith(provider({ order: masked }), "2026-12-02T00:00:00.000Z");
      const row = await env.DB.prepare("SELECT buyer_json, payment_status FROM orders").first<{
        buyer_json: string;
        payment_status: string;
      }>();
      expect(row!.payment_status).toBe("FULLY_REFUNDED");
      expect(JSON.parse(row!.buyer_json)).toEqual({
        username: "acquirente-sintetico",
        name: "Maria Verdi",
        email: "acquirente@example.invalid",
        phone: "+39 0461 000000",
        billingAddress: {
          addressLine1: "Via Fiscale 1",
          addressLine2: null,
          city: "Trento",
          postalCode: "38122",
          stateOrProvince: null,
          countryCode: "IT",
        },
        shipTo: {
          name: "Luca Neri c/o Hotel Sintetico",
          phone: "+39 0461 111111",
          address: {
            addressLine1: "Piazza Spedizione 2",
            // La seconda riga non è mascherata da eBay: la sua assenza è un dato.
            addressLine2: null,
            city: "Bolzano",
            postalCode: "39100",
            stateOrProvince: null,
            countryCode: "IT",
          },
        },
      });
      const [visible] = await listVisibleOrders(env.DB, "u-a");
      expect(visible!.summary).toMatchObject({ payment: "refunded", shipping: "to_ship" });

      // Un campo assente anche nella lettura precedente resta mascherato, senza valore.
      await env.DB.prepare("DELETE FROM orders").run();
      await importWith(
        provider({
          order: order({
            buyer: {
              username: "acquirente-sintetico",
              buyerRegistrationAddress: { fullName: "Maria Verdi", email: "a@example.invalid" },
            },
            fulfillmentStartInstructions: [],
          }),
        }),
      );
      await importWith(provider({ order: masked }), "2026-12-02T00:00:00.000Z");
      expect(
        JSON.parse(
          (await env.DB.prepare("SELECT buyer_json FROM orders").first<{ buyer_json: string }>())!
            .buyer_json,
        ),
      ).toMatchObject({
        name: "Maria Verdi",
        email: "a@example.invalid",
        phone: null,
        shipTo: { name: null, phone: null },
        masked: [
          "phone",
          "billingAddress.addressLine1",
          "shipTo.name",
          "shipTo.phone",
          "shipTo.address.addressLine1",
        ],
      });

      // Senza una lettura precedente il campo resta mascherato, non inventato.
      await env.DB.prepare("DELETE FROM orders").run();
      await importWith(provider({ order: masked }), "2026-12-02T00:00:00.000Z");
      expect(
        JSON.parse(
          (await env.DB.prepare("SELECT buyer_json FROM orders").first<{ buyer_json: string }>())!
            .buyer_json,
        ),
      ).toMatchObject({
        name: null,
        email: null,
        masked: [
          "email",
          "name",
          "phone",
          "billingAddress.addressLine1",
          "shipTo.name",
          "shipTo.phone",
          "shipTo.address.addressLine1",
        ],
      });
    });

    it("classifica gli ordini non pagati senza rappresentarli come incassati", async () => {
      await importWith(
        provider({
          order: order({ orderPaymentStatus: "PENDING", orderFulfillmentStatus: undefined }),
        }),
      );
      const [visible] = await listVisibleOrders(env.DB, "u-a");
      expect(visible!.summary).toMatchObject({
        orderPaymentStatus: "PENDING",
        payment: "unpaid",
        shipping: null,
      });
    });
  });
});
