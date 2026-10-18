import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildLastModifiedFilter,
  fulfillmentObservation,
} from "../app/integrations/ebay/fulfillment.server";
import { mapTradingTaxIdentifiers } from "../app/integrations/ebay/trading.server";
import {
  orderAllowance,
  unlockOrders,
  unlockConfirmation,
  restoreUnlockConfirmation,
} from "../app/domain/grants.server";
import { listVisibleOrders } from "../app/domain/orders.server";
import { completeRegistration } from "../app/domain/registration.server";
import { createAuth } from "../app/auth.server";
import { action as unlockAction, loader as loadHome } from "../app/routes/home";
import { loader as loadAccess } from "../app/routes/sign-in";
import { action as securityAction } from "../app/routes/security";
import { now, resetDatabase, seed } from "./database-fixtures";
import { syntheticProfile } from "./account-fixtures";

beforeEach(resetDatabase);
afterEach(() => vi.useRealTimers());

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
    const guessed = await loadHome({
      request: new Request("http://localhost:5173/app/ordini?q=RSSMRA80A01H501U", {
        headers: { cookie: cookie! },
      }),
    } as Parameters<typeof loadHome>[0]);
    expect(JSON.stringify(guessed)).not.toContain("RSSMRA80A01H501U");
    expect(guessed.orders.map((order) => order.ebayOrderId)).toEqual(["ebay-a"]);
    const unlockRequest = (ids: string, origin = "http://localhost:5173") =>
      ({
        request: new Request("http://localhost:5173/app/ordini", {
          method: "POST",
          headers: { cookie: cookie!, origin },
          body: new URLSearchParams({ intent: "unlock", ids, skipConfirmation: "true" }),
        }),
      }) as Parameters<typeof unlockAction>[0];
    const denied = await unlockAction(unlockRequest("o-b"));
    expect(denied).toMatchObject({ init: { status: 409 }, data: { error: true, unlocked: [] } });
    expect(await unlockConfirmation(env.DB, user!.id)).toBe(true);
    await expect(
      unlockAction(unlockRequest("o-a", "https://estraneo.invalid")),
    ).rejects.toMatchObject({ status: 403 });
    expect(await unlockAction(unlockRequest("o-a"))).toEqual({ unlocked: ["o-a"], remaining: 0 });
    expect(await unlockConfirmation(env.DB, user!.id)).toBe(false);
    const restored = await securityAction({
      request: new Request("http://localhost:5173/app/impostazioni/sicurezza", {
        method: "POST",
        headers: { cookie: cookie!, origin: "http://localhost:5173" },
        body: new URLSearchParams({ intent: "unlock-confirmation" }),
      }),
    } as Parameters<typeof securityAction>[0]);
    expect(restored).toMatchObject({ data: { ok: true } });
    expect(await unlockConfirmation(env.DB, user!.id)).toBe(true);
  });

  it("costruisce il filtro incrementale e rifiuta intervalli invalidi", () => {
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
  });

  it.each([
    ["CODICE_FISCALE", null, "CodiceFiscale", null, 1],
    ["CODICE_FISCALE", "IT", "CodiceFiscale", "IT", 1],
    ["CODICE_FISCALE", "IT", "CODICE_FISCALE", "IT", 1],
    ["CODICE_FISCALE", null, "CodiceFiscale", "IT", 1],
    ["CODICE_FISCALE", "IT", "CodiceFiscale", null, 1],
    ["CODICE_FISCALE", "ES", "CodiceFiscale", null, 2],
    ["CODICE_FISCALE", "ES", "CodiceFiscale", "IT", 2],
    ["CODICE_FISCALE", "IT", "CodiceFiscale", "ES", 2],
    ["CODICE_FISCALE", null, "CodiceFiscale", "ES", 2],
    ["VATIN", "IT", "CodiceFiscale", "IT", 2],
    ["CodiceFiscale", "IT", "CodiceFiscale", "IT", 2],
    ["CODICE_FISCALE", "IT", "codice_fiscale", "IT", 2],
    ["CODICE_FISCALE", "IT", "CodiceFiscale", "IT", 2, "synthetic_fixture"],
    ["CODICE_FISCALE", "IT", "CODICE_FISCALE", "IT", 2, "ebay_fulfillment", "synthetic_fixture"],
  ])(
    "conserva tipi e Paesi non qualificati nella consultazione: %s %s / %s %s",
    async (
      fType,
      fCountry,
      tType,
      tCountry,
      total,
      fSource = "ebay_fulfillment",
      tSource = "ebay_trading_get_orders",
    ) => {
      await seed();
      await unlockOrders(env.DB, "u-a", ["o-a"]);
      await env.DB.prepare("DELETE FROM tax_identifiers WHERE order_id = 'o-a'").run();
      await env.DB.prepare(
        `INSERT INTO tax_identifiers (id, order_id, identifier_type, issuing_country, value, source, observed_at)
         VALUES ('f', 'o-a', ?1, ?2, 'SINTETICO', ?6, ?5),
                ('t', 'o-a', ?3, ?4, 'SINTETICO', ?7, ?5)`,
      )
        .bind(fType, fCountry, tType, tCountry, now, fSource, tSource)
        .run();
      const identifiers = (await listVisibleOrders(env.DB, "u-a"))[0]!.taxIdentifiers;
      expect(identifiers).toHaveLength(total as number);
      if (total === 1) expect(identifiers[0]!.source).toBe("ebay_fulfillment");
      expect(
        await env.DB.prepare(
          "SELECT count(*) AS total FROM tax_identifiers WHERE order_id = 'o-a'",
        ).first(),
      ).toEqual({ total: 2 });
    },
  );

  it("mostra i dati fiscali dell'ordine sbloccato solo al tenant proprietario", async () => {
    await seed();
    await unlockOrders(env.DB, "u-a", ["o-a"]);

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
        quality: "unverifiable",
        updated: false,
      },
      {
        type: "VAT_ID",
        issuingCountry: "IT",
        value: "01234567890",
        source: "ebay_trading_get_orders",
        observedAt: now,
        quality: "checksum",
        updated: false,
      },
    ]);
    expect(otherTenantOrders[0]?.taxIdentifiers).toEqual([]);
    expect(ownerOrders[0]).toMatchObject({
      storeName: "e-a",
      fiscalState: "available",
      taxAvailability: "present",
      taxCheckedAt: null,
      firstTaxAvailableAt: now,
    });
    await env.DB.prepare(
      `INSERT INTO tax_identifiers (id, order_id, identifier_type, issuing_country, value, source, observed_at)
       VALUES ('fiscal-f-before', 'o-a', 'CODICE_FISCALE', NULL, 'RSSMRA80A01H501U', 'ebay_fulfillment', ?1),
              ('fiscal-f', 'o-a', 'CODICE_FISCALE', 'IT', 'RSSMRA80A01H501U', 'ebay_fulfillment', ?1),
              ('fiscal-t', 'o-a', 'CodiceFiscale', NULL, 'RSSMRA80A01H501U', 'ebay_trading_get_orders', ?1),
              ('fiscal-other', 'o-a', 'CodiceFiscale', NULL, 'ALTRO-SINTETICO', 'ebay_trading_get_orders', ?1),
              ('fiscal-country', 'o-a', 'CodiceFiscale', 'ES', 'RSSMRA80A01H501U', 'ebay_trading_get_orders', ?1),
              ('fiscal-unknown', 'o-a', 'codice_fiscale', NULL, 'RSSMRA80A01H501U', 'ebay_trading_get_orders', ?1)`,
    )
      .bind(now)
      .run();
    const identifiers = (await listVisibleOrders(env.DB, "u-a"))[0]!.taxIdentifiers;
    expect(identifiers).toHaveLength(5);
    expect(identifiers).toContainEqual(
      expect.objectContaining({
        type: "CODICE_FISCALE",
        issuingCountry: "IT",
        value: "RSSMRA80A01H501U",
        source: "ebay_fulfillment",
        observedAt: now,
      }),
    );
    expect(
      identifiers.filter((tax) => tax.type === "CodiceFiscale").map((tax) => tax.value),
    ).toEqual(expect.arrayContaining(["ALTRO-SINTETICO", "RSSMRA80A01H501U"]));
    expect((await listVisibleOrders(env.DB, "u-b"))[0]?.taxIdentifiers).toEqual([]);
    expect(
      await env.DB.prepare(
        "SELECT count(*) AS total FROM tax_identifiers WHERE order_id = 'o-a'",
      ).first(),
    ).toEqual({ total: 8 });
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

  it("sblocca il lotto atomicamente, conserva il consenso solo al successo e non ripete il consumo", async () => {
    await seed();
    await env.DB.prepare(`INSERT INTO orders (id, store_id, ebay_order_id, creation_time, last_modified_time, currency, total_minor)
      VALUES ('o-a2', 's-a', 'secondo', ?1, ?1, 'EUR', 100)`)
      .bind(now)
      .run();
    await env.DB.prepare(`INSERT INTO tax_identifiers (id, order_id, identifier_type, value, source, observed_at)
      VALUES ('secondo', 'o-a2', 'VAT_ID', 'SINTETICO', 'synthetic_fixture', ?)`)
      .bind(now)
      .run();
    expect(await unlockConfirmation(env.DB, "u-a")).toBe(true);
    await expect(unlockOrders(env.DB, "u-a", ["o-a", "o-a2"], true)).rejects.toThrow(
      "free_quota_exhausted",
    );
    expect(await env.DB.prepare("SELECT count(*) AS n FROM order_grants").first()).toEqual({
      n: 0,
    });
    expect((await orderAllowance(env.DB, "u-a"))?.remaining).toBe(1);
    expect(await unlockConfirmation(env.DB, "u-a")).toBe(true);
    expect(await unlockOrders(env.DB, "u-a", ["o-a"], true)).toEqual({
      unlocked: ["o-a"],
      remaining: 0,
    });
    expect(await unlockConfirmation(env.DB, "u-a")).toBe(false);
    expect(await unlockConfirmation(env.DB, "u-b")).toBe(true);
    await unlockOrders(env.DB, "u-a", ["o-a"]);
    expect((await orderAllowance(env.DB, "u-a"))?.remaining).toBe(0);
    await restoreUnlockConfirmation(env.DB, "u-a");
    expect(await unlockConfirmation(env.DB, "u-a")).toBe(true);
    await env.DB.prepare("UPDATE free_cycles SET quota = 2 WHERE id = 'c-a'").run();
    await unlockOrders(env.DB, "u-a", ["o-a", "o-a2"], true);
    expect(await unlockConfirmation(env.DB, "u-a")).toBe(true);
    expect((await orderAllowance(env.DB, "u-a"))?.remaining).toBe(0);
  });

  it("rifiuta lotti estranei, ambiente errato, ordini non disponibili e preferenze forzate", async () => {
    await seed();
    for (const ids of [
      [],
      [""],
      ["x".repeat(129)],
      ["o-a", ""],
      ["o-a", "x".repeat(129)],
      Array(101).fill("o-a"),
    ])
      await expect(unlockOrders(env.DB, "u-a", ids, true)).rejects.toThrow(
        "invalid_order_selection",
      );
    await expect(unlockOrders(env.DB, "nessuno", ["o-a"])).rejects.toThrow("order_not_available");
    for (const ids of [
      ["o-a", "o-b"],
      ["o-a", "inesistente"],
    ])
      await expect(unlockOrders(env.DB, "u-a", ids, true)).rejects.toThrow();
    await expect(unlockOrders(env.DB, "u-a", ["o-a"], true, "sandbox")).rejects.toThrow();
    for (const change of [
      "UPDATE orders SET is_provisional = 1 WHERE id = 'o-a'",
      "UPDATE orders SET retention_until = '2026-09-12T00:00:00.000Z' WHERE id = 'o-a'",
      "INSERT INTO ebay_store_pauses VALUES ('s-a', 'plan', '2026-09-13T20:00:00.000Z')",
    ]) {
      await env.DB.prepare(change).run();
      await expect(unlockOrders(env.DB, "u-a", ["o-a"], true)).rejects.toThrow();
      await env.DB.batch([
        env.DB.prepare(
          "UPDATE orders SET is_provisional = 0, retention_until = '2026-10-12T00:00:00.000Z' WHERE id = 'o-a'",
        ),
        env.DB.prepare("DELETE FROM ebay_store_pauses"),
      ]);
    }
    await env.DB.prepare("UPDATE tax_identifiers SET removed_at = ? WHERE order_id = 'o-a'")
      .bind(now)
      .run();
    await expect(unlockOrders(env.DB, "u-a", ["o-a"], true)).rejects.toThrow("order_not_available");
    expect((await orderAllowance(env.DB, "u-a"))?.remaining).toBe(1);
    expect(await unlockConfirmation(env.DB, "u-a")).toBe(true);
    expect(JSON.stringify(await listVisibleOrders(env.DB, "u-b"))).not.toContain("RSSMRA");
  });

  it("accetta i limiti della selezione senza trasformare i duplicati in nuovi consumi o consenso singolo", async () => {
    await seed();
    const id = "x".repeat(128);
    await env.DB.prepare(`INSERT INTO orders (id, store_id, ebay_order_id, creation_time, last_modified_time, currency, total_minor)
      VALUES (?1, 's-a', ?1, ?2, ?2, 'EUR', 100)`)
      .bind(id, now)
      .run();
    await env.DB.prepare(`INSERT INTO tax_identifiers (id, order_id, identifier_type, value, source, observed_at)
      VALUES ('boundary', ?, 'VAT_ID', 'SINTETICO', 'synthetic_fixture', ?)`)
      .bind(id, now)
      .run();
    expect(await unlockOrders(env.DB, "u-a", Array(100).fill(id), true)).toEqual({
      unlocked: [id],
      remaining: 0,
    });
    expect(await unlockConfirmation(env.DB, "u-a")).toBe(true);
  });

  it("materializza solo il ciclo necessario e conserva l'ancoraggio dopo la sostituzione dei negozi", async () => {
    await seed();
    await env.DB.prepare("DELETE FROM free_cycles").run();
    const first = await orderAllowance(env.DB, "u-a");
    expect(first).toMatchObject({
      workspaceId: "w-a",
      premium: false,
      remaining: 5,
      cycle: { used: 0, quota: 5, ends_at: "2026-09-20T20:00:00.000Z" },
    });
    expect((await orderAllowance(env.DB, "u-a"))?.cycle?.id).toBe(first?.cycle?.id);
    const next = await orderAllowance(env.DB, "u-a", new Date("2026-09-20T20:00:00.000Z"));
    expect(next?.cycle?.ends_at).toBe("2026-09-27T20:00:00.000Z");
    expect(next?.cycle?.id).not.toBe(first?.cycle?.id);
    await env.DB.prepare("DELETE FROM ebay_stores WHERE id = 's-a'").run();
    await env.DB.prepare(`INSERT INTO ebay_stores (id, workspace_id, ebay_user_id, linked_at)
      VALUES ('replacement', 'w-a', 'replacement', '2026-09-21T00:00:00.000Z')`).run();
    expect(
      (await orderAllowance(env.DB, "u-a", new Date("2026-09-21T00:00:00.000Z")))?.cycle?.id,
    ).toBe(next?.cycle?.id);
    expect(await orderAllowance(env.DB, "u-a", new Date("2026-09-12T00:00:00.000Z"))).toMatchObject(
      { cycle: null, remaining: 0 },
    );
    await env.DB.prepare(
      "UPDATE workspaces SET free_cycle_anchor_at = NULL WHERE id = 'w-b'",
    ).run();
    await env.DB.prepare("DELETE FROM free_cycles WHERE workspace_id = 'w-b'").run();
    expect(await orderAllowance(env.DB, "u-b")).toMatchObject({ cycle: null, remaining: 0 });
    await env.DB.prepare("DELETE FROM free_cycles WHERE workspace_id = 'w-a'").run();
    expect(
      (await orderAllowance(env.DB, "u-a", new Date("2026-09-21T20:00:00.000Z")))?.cycle?.ends_at,
    ).toBe("2026-09-27T20:00:00.000Z");
  });

  it("mantiene senza apertura i dati acquisiti in Premium, esclude quelli tardivi e rispetta le revoche indipendenti", async () => {
    await seed();
    const end = "2026-09-14T00:00:00.000Z";
    await env.DB.prepare(`INSERT INTO workspace_entitlements (id, workspace_id, source, starts_at, ends_at)
      VALUES ('paid', 'w-a', 'premium', ?1, ?2), ('gift', 'w-a', 'admin', ?1, ?2)`)
      .bind(now, end)
      .run();
    expect((await orderAllowance(env.DB, "u-a"))?.remaining).toBeNull();
    const later = new Date("2026-09-14T00:01:00.000Z");
    expect((await listVisibleOrders(env.DB, "u-a", 50, "production", later))[0]?.fiscalState).toBe(
      "available",
    );
    expect((await orderAllowance(env.DB, "u-a", later))?.remaining).toBe(1);
    await env.DB.prepare(`INSERT INTO tax_identifiers (id, order_id, identifier_type, value, source, observed_at)
      VALUES ('later-identifier', 'o-a', 'VATIN', 'AGGIORNATO', 'synthetic_fixture', ?)`)
      .bind(later.toISOString())
      .run();
    expect(
      (await listVisibleOrders(env.DB, "u-a", 50, "production", later))[0]?.taxIdentifiers,
    ).toHaveLength(3);
    expect(
      await env.DB.prepare("SELECT count(*) AS n FROM workspace_entitlements").first(),
    ).toEqual({ n: 2 });
    await unlockOrders(env.DB, "u-a", ["o-a"], false, "production", later);
    expect(await env.DB.prepare("SELECT count(*) AS n FROM order_grants").first()).toEqual({
      n: 0,
    });
    await env.DB.prepare("UPDATE workspace_entitlements SET revoked_at = ? WHERE id = 'paid'")
      .bind(end)
      .run();
    await expect(
      env.DB.prepare(
        "UPDATE workspace_entitlements SET workspace_id = 'w-b' WHERE id = 'gift'",
      ).run(),
    ).rejects.toThrow("immutable_entitlement");
    expect((await listVisibleOrders(env.DB, "u-a", 50, "production", later))[0]?.fiscalState).toBe(
      "available",
    );
    await env.DB.prepare("UPDATE workspace_entitlements SET revoked_at = ? WHERE id = 'gift'")
      .bind(end)
      .run();
    expect(
      (await listVisibleOrders(env.DB, "u-a", 50, "production", later))[0]?.taxIdentifiers,
    ).toEqual([]);
    await env.DB.prepare(`INSERT INTO orders (id, store_id, ebay_order_id, creation_time, last_modified_time, currency, total_minor)
      VALUES ('late', 's-a', 'late', ?1, ?1, 'EUR', 100)`)
      .bind(now)
      .run();
    await env.DB.prepare(`INSERT INTO workspace_entitlements (id, workspace_id, source, starts_at, ends_at)
      VALUES ('trial', 'w-a', 'trial', ?1, ?2)`)
      .bind(now, end)
      .run();
    await env.DB.prepare(`INSERT INTO tax_identifiers (id, order_id, identifier_type, value, source, observed_at)
      VALUES ('late-tax', 'late', 'VAT_ID', 'TARDIVO', 'synthetic_fixture', ?)`)
      .bind(end)
      .run();
    expect(
      (await listVisibleOrders(env.DB, "u-a", 50, "production", later)).find(
        (o) => o.id === "late",
      ),
    ).toMatchObject({ fiscalState: "locked", taxIdentifiers: [] });
    await unlockOrders(env.DB, "u-a", ["o-a"], false, "production", later);
    expect((await orderAllowance(env.DB, "u-a", later))?.remaining).toBe(1);
  });

  it("non anticipa una copertura futura durante lo sblocco e consuma il credito Free corrente", async () => {
    await seed();
    await env.DB.prepare(`INSERT INTO workspace_entitlements (id, workspace_id, source, starts_at, ends_at)
      VALUES ('future', 'w-a', 'premium', '2026-09-14T00:00:00.000Z', '2026-09-15T00:00:00.000Z')`).run();
    expect(await unlockOrders(env.DB, "u-a", ["o-a"], false, "production", new Date(now))).toEqual({
      unlocked: ["o-a"],
      remaining: 0,
    });
    expect(
      await env.DB.prepare(
        "SELECT source, cycle_id FROM order_grants WHERE order_id = 'o-a'",
      ).first(),
    ).toEqual({ source: "free_cycle", cycle_id: "c-a" });
  });

  it("valuta le coperture all'istante del grant Free, non all'ora corrente", async () => {
    await seed();
    // La copertura inizia dopo l'istante del grant ma prima dell'ora reale della prova.
    await env.DB.prepare(`INSERT INTO workspace_entitlements (id, workspace_id, source, starts_at, ends_at)
      VALUES ('later', 'w-a', 'premium', '2026-09-14T00:00:00.000Z', '2026-09-15T00:00:00.000Z')`).run();
    await unlockOrders(env.DB, "u-a", ["o-a"], false, "production", new Date(now));
    expect(await env.DB.prepare("SELECT used FROM free_cycles WHERE id = 'c-a'").first()).toEqual({
      used: 1,
    });
  });

  it("usa la disponibilità storica effettiva anche per coperture future, senza diritti retroattivi", async () => {
    await seed();
    const starts = "2026-09-14T00:00:00.000Z";
    const ends = "2026-09-15T00:00:00.000Z";
    await env.DB.prepare(`INSERT INTO workspace_entitlements (id, workspace_id, source, starts_at, ends_at)
      VALUES ('scheduled', 'w-a', 'premium', ?, ?)`)
      .bind(starts, ends)
      .run();
    expect((await listVisibleOrders(env.DB, "u-a"))[0]?.fiscalState).toBe("locked");
    await env.DB.prepare("UPDATE tax_identifiers SET removed_at = ? WHERE order_id = 'o-a'")
      .bind(now)
      .run();
    await env.DB.prepare(`INSERT INTO tax_identifiers (id, order_id, identifier_type, value, source, observed_at)
      VALUES ('after-scheduled', 'o-a', 'VAT_ID', 'DOPO', 'synthetic_fixture', ?)`)
      .bind(ends)
      .run();
    const later = new Date("2026-09-16T00:00:00.000Z");
    expect((await listVisibleOrders(env.DB, "u-a", 50, "production", later))[0]?.fiscalState).toBe(
      "locked",
    );
    await env.DB.prepare(`INSERT INTO tax_identifiers (id, order_id, identifier_type, value, source, observed_at, removed_at)
      VALUES ('historical', 'o-a', 'VAT_ID', 'DURANTE', 'synthetic_fixture', '2026-09-14T01:00:00.000Z', '2026-09-14T02:00:00.000Z')`).run();
    expect((await listVisibleOrders(env.DB, "u-a", 50, "production", later))[0]).toMatchObject({
      fiscalState: "available",
      taxIdentifiers: [expect.objectContaining({ value: "DOPO" })],
    });
    expect((await listVisibleOrders(env.DB, "u-b", 50, "production", later))[0]?.fiscalState).toBe(
      "locked",
    );
    await unlockOrders(env.DB, "u-a", ["o-a"], false, "production", later);
    expect((await orderAllowance(env.DB, "u-a", later))?.cycle?.used).toBe(0);
  });

  it("richiede coperture temporanee con una scadenza valida e lifetime senza scadenza", async () => {
    await seed();
    for (const [source, starts, ends] of [
      ["premium", now, null],
      ["trial", now, null],
      ["admin", now, null],
      ["lifetime", now, "2026-09-14T00:00:00.000Z"],
      ["premium", "non-data", "2026-09-14T00:00:00.000Z"],
      ["premium", now, "non-data"],
      ["premium", now, now],
    ])
      await expect(
        env.DB.prepare(`INSERT INTO workspace_entitlements (id, workspace_id, source, starts_at, ends_at)
      VALUES ('invalid', 'w-a', ?, ?, ?)`)
          .bind(source, starts, ends)
          .run(),
      ).rejects.toThrow();
  });

  it("la revoca di una copertura non elimina uno sblocco Free indipendente", async () => {
    await seed();
    await unlockOrders(env.DB, "u-a", ["o-a"]);
    await env.DB.prepare(`INSERT INTO workspace_entitlements (id, workspace_id, source, starts_at, ends_at)
      VALUES ('refunded', 'w-a', 'premium', ?, '2026-09-14T00:00:00.000Z')`)
      .bind(now)
      .run();
    await env.DB.prepare("UPDATE workspace_entitlements SET revoked_at = ? WHERE id = 'refunded'")
      .bind(now)
      .run();
    expect((await listVisibleOrders(env.DB, "u-a"))[0]?.fiscalState).toBe("available");
    await expect(
      env.DB.prepare(
        "UPDATE workspace_entitlements SET revoked_at = NULL WHERE id = 'refunded'",
      ).run(),
    ).rejects.toThrow("immutable_entitlement");
    expect((await orderAllowance(env.DB, "u-a"))?.remaining).toBe(0);
  });

  it("acquisisce durante la copertura tutti gli identificativi e conserva il diritto nel consolidamento", async () => {
    await seed();
    await env.DB.prepare("DELETE FROM tax_identifiers WHERE order_id = 'o-a'").run();
    await env.DB.prepare(`INSERT INTO workspace_entitlements (id, workspace_id, source, starts_at, ends_at)
      VALUES ('live', 'w-a', 'lifetime', ?, NULL)`)
      .bind(now)
      .run();
    await env.DB.prepare(`INSERT INTO tax_identifiers (id, order_id, identifier_type, value, source, observed_at)
      VALUES ('during', 'o-a', 'VAT_ID', 'DURANTE', 'synthetic_fixture', ?)`)
      .bind(now)
      .run();
    expect((await listVisibleOrders(env.DB, "u-a"))[0]?.fiscalState).toBe("available");
    await env.DB.prepare(`INSERT INTO orders (id, store_id, ebay_order_id, creation_time, last_modified_time, currency, total_minor)
      VALUES ('final', 's-a', 'final', ?1, ?1, 'EUR', 100)`)
      .bind(now)
      .run();
    await env.DB.prepare("UPDATE orders SET merged_into = 'final' WHERE id = 'o-a'").run();
    await env.DB.prepare(`INSERT INTO tax_identifiers (id, order_id, identifier_type, value, source, observed_at)
      VALUES ('final-tax', 'final', 'VAT_ID', 'DURANTE', 'synthetic_fixture', ?)`)
      .bind(now)
      .run();
    await unlockOrders(env.DB, "u-a", ["final"]);
    expect(await unlockConfirmation(env.DB, "u-a")).toBe(true);
    expect((await listVisibleOrders(env.DB, "u-a"))[0]).toMatchObject({
      id: "final",
      fiscalState: "available",
    });
    expect((await orderAllowance(env.DB, "u-a"))?.cycle?.used).toBe(0);
    expect(await env.DB.prepare("SELECT count(*) AS n FROM order_grants").first()).toEqual({
      n: 0,
    });
    expect(
      await env.DB.prepare("SELECT count(*) AS n FROM workspace_entitlements").first(),
    ).toEqual({ n: 1 });
    await unlockOrders(env.DB, "u-a", ["final", "final"]);
    expect(
      await env.DB.prepare("SELECT count(*) AS n FROM workspace_entitlements").first(),
    ).toEqual({ n: 1 });
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
      unlockOrders(env.DB, "u-a", ["o-a"]),
      unlockOrders(env.DB, "u-a", ["o-a2"]),
    ]);

    expect(outcomes.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter(({ status }) => status === "rejected")).toHaveLength(1);

    const cycle = await env.DB.prepare(
      "SELECT used, quota FROM free_cycles WHERE id = 'c-a'",
    ).first<{ used: number; quota: number }>();
    expect(cycle).toEqual({ used: 1, quota: 1 });
  });

  it("non sblocca un acquisto non pagato finché non diventa definitivo", async () => {
    await seed();
    await env.DB.prepare("UPDATE orders SET is_provisional = 1 WHERE id = 'o-a'").run();
    const grant = () => unlockOrders(env.DB, "u-a", ["o-a"]);
    const canUnlock = async () =>
      (await listVisibleOrders(env.DB, "u-a")).find((order) => order.id === "o-a")?.canUnlock;
    expect(await canUnlock()).toBe(false);
    await expect(grant()).rejects.toThrow("order_not_available");
    expect(await env.DB.prepare("SELECT used FROM free_cycles WHERE id = 'c-a'").first()).toEqual({
      used: 0,
    });
    await env.DB.prepare("UPDATE orders SET is_provisional = 0 WHERE id = 'o-a'").run();
    expect(await canUnlock()).toBe(true);
    await grant();
    expect(await env.DB.prepare("SELECT used FROM free_cycles WHERE id = 'c-a'").first()).toEqual({
      used: 1,
    });
  });

  it("rifiuta un grant per un ordine di un altro workspace", async () => {
    await seed();

    await expect(unlockOrders(env.DB, "u-a", ["o-b"])).rejects.toThrow();

    const cycle = await env.DB.prepare(
      "SELECT used, quota FROM free_cycles WHERE id = 'c-a'",
    ).first<{ used: number; quota: number }>();
    expect(cycle).toEqual({ used: 0, quota: 1 });
  });

  it("nega sblocco senza appartenenza, dato fiscale o ciclo valido", async () => {
    await seed();
    await expect(unlockOrders(env.DB, "u-b", ["o-a"])).rejects.toThrow();
    await env.DB.prepare("DELETE FROM tax_identifiers WHERE order_id = 'o-a'").run();
    await expect(unlockOrders(env.DB, "u-a", ["o-a"])).rejects.toThrow();
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
      env.DB.prepare(`INSERT INTO order_grants
        (id, workspace_id, order_id, cycle_id, source, granted_at)
        VALUES ('expired', 'w-a', 'o-a', 'c-a', 'free_cycle', '2026-10-01T00:00:00.000Z')`).run(),
    ).rejects.toThrow("invalid_grant_cycle");
    expect(await env.DB.prepare("SELECT used FROM free_cycles WHERE id = 'c-a'").first()).toEqual({
      used: 0,
    });
  });

  it("annulla il duplicato senza consumare ancora quota o cambiare proprietario", async () => {
    await seed();
    await unlockOrders(env.DB, "u-a", ["o-a"]);
    await expect(unlockOrders(env.DB, "u-a", ["o-a"])).resolves.toMatchObject({
      unlocked: ["o-a"],
      remaining: 0,
    });
    await expect(
      env.DB.prepare("UPDATE order_grants SET workspace_id = 'w-b' WHERE order_id = 'o-a'").run(),
    ).rejects.toThrow();
    expect(await env.DB.prepare("SELECT used FROM free_cycles WHERE id = 'c-a'").first()).toEqual({
      used: 1,
    });
    expect(
      await env.DB.prepare("SELECT workspace_id FROM order_grants WHERE order_id = 'o-a'").first(),
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
