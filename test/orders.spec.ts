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
import {
  listVisibleOrders,
  orderCriteria,
  orderView,
  visibleOrderFacets,
  type VisibleOrder,
} from "../app/domain/orders.server";
import { completeRegistration } from "../app/domain/registration.server";
import { createAuth } from "../app/auth.server";
import { action as unlockAction, loader as loadHome } from "../app/routes/orders";
import { loader as loadAccess } from "../app/routes/sign-in";
import { action as securityAction } from "../app/routes/security";
import { now, resetDatabase, seed } from "./database-fixtures";
import { syntheticProfile, verifiedSession } from "./account-fixtures";
import { displayTaxValue } from "../app/tax-quality";
import { itemPrice } from "../app/view-models";
import { settle } from "../app/settle.server";
import { requestOrderRead } from "../app/domain/order-sync.server";

beforeEach(resetDatabase);
afterEach(() => vi.useRealTimers());

describe("percorso ordini", () => {
  it("lega la pagina ordini alla sessione e al tenant senza consenso eBay", async () => {
    await seed();

    // Senza sessione gli Ordini rimandano all'accesso, che mostra i moduli.
    const anonymous = await loadHome({
      params: {},
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
      params: {},
      request: new Request("http://localhost:5173/app/ordini", { headers: { cookie: cookie! } }),
    } as Parameters<typeof loadHome>[0]);
    expect(authenticated.verified).toBe(true);
    expect(authenticated.page?.orders.map(({ ebayOrderId }) => ebayOrderId)).toEqual(["ebay-a"]);
    const guessed = await loadHome({
      params: {},
      request: new Request("http://localhost:5173/app/ordini?q=RSSMRA80A01H501U", {
        headers: { cookie: cookie! },
      }),
    } as Parameters<typeof loadHome>[0]);
    expect(JSON.stringify(guessed)).not.toContain("RSSMRA80A01H501U");
    // La ricerca considera solo i valori autorizzati: un codice da sbloccare non trova l'ordine.
    expect(guessed.page?.orders).toEqual([]);
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
      buyer: null,
      orderPaymentStatus: null,
      orderFulfillmentStatus: null,
      payment: null,
      shipping: null,
      lineItems: [
        {
          lineItemId: "line-a1",
          title: "Articolo A",
          quantity: 1,
          sku: "SKU-A",
          totalMinor: 999,
          currency: "EUR",
          imageUrl: null,
        },
        {
          lineItemId: "line-a2",
          title: "Articolo B",
          quantity: 2,
          sku: null,
          totalMinor: 300,
          currency: "EUR",
          imageUrl: null,
        },
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
    // Senza controllo fiscale né lettura in attesa la verifica non è riuscita: si riprova.
    expect((await listVisibleOrders(env.DB, "u-a"))[0]?.fiscalState).toBe("error");
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

  it("nasconde e non sblocca un acquisto non pagato finché non diventa definitivo", async () => {
    await seed();
    await env.DB.prepare("UPDATE orders SET is_provisional = 1 WHERE id = 'o-a'").run();
    const grant = () => unlockOrders(env.DB, "u-a", ["o-a"]);
    const visible = async () =>
      (await listVisibleOrders(env.DB, "u-a")).some((order) => order.id === "o-a");
    expect(await visible()).toBe(false);
    await expect(grant()).rejects.toThrow("order_not_available");
    expect(await env.DB.prepare("SELECT used FROM free_cycles WHERE id = 'c-a'").first()).toEqual({
      used: 0,
    });
    await env.DB.prepare("UPDATE orders SET is_provisional = 0 WHERE id = 'o-a'").run();
    expect(await visible()).toBe(true);
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

describe("pagina Ordini reale", () => {
  const origin = "http://localhost:5173";

  /** Proprietario dello spazio A, con la sessione aperta. */
  async function owner() {
    await seed();
    const session = await verifiedSession("pagina-ordini@example.invalid");
    await env.DB.prepare("UPDATE workspace_members SET user_id = ? WHERE workspace_id = 'w-a'")
      .bind(session.userId)
      .run();
    return session;
  }

  function ordersPage(cookie: string, path = "/app/ordini", params: { ordine?: string } = {}) {
    return loadHome({
      params,
      request: new Request(`${origin}${path}`, { headers: { cookie } }),
    } as Parameters<typeof loadHome>[0]);
  }

  function ordersAction(cookie: string, fields: Record<string, string>) {
    return unlockAction({
      request: new Request(`${origin}/app/ordini`, {
        method: "POST",
        headers: { cookie, origin },
        body: new URLSearchParams(fields),
      }),
    } as Parameters<typeof unlockAction>[0]);
  }

  async function withCredentials() {
    await env.DB.prepare(
      `INSERT INTO ebay_store_credentials (store_id, access_token, access_expires_at, refresh_token, refresh_expires_at, granted_at)
       VALUES ('s-a', 'a', '2026-09-14T00:00:00.000Z', 'r', '2027-09-13T00:00:00.000Z', ?)`,
    )
      .bind(now)
      .run();
  }

  it("rende gli ordini persistiti nella vista dell'anteprima, con stati, prezzi e contatti", async () => {
    const { cookie } = await owner();
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE orders SET marketplace_id = 'EBAY_IT', payment_status = 'PARTIALLY_REFUNDED',
                fulfillment_status = 'IN_PROGRESS', buyer_json = ? WHERE id = 'o-a'`,
      ).bind(
        JSON.stringify({
          username: "acquirente-sintetico",
          name: "Maria Rossi",
          email: "maria@example.invalid",
          phone: "+39 000 0000000",
          billingAddress: {
            addressLine1: "Via Roma 1",
            addressLine2: "Scala B",
            city: "Trento",
            postalCode: "38122",
            stateOrProvince: "TN",
            countryCode: "IT",
          },
          shipTo: {
            name: "Maria Rossi c/o Ufficio",
            phone: null,
            address: {
              addressLine1: "Via Verdi 2",
              addressLine2: null,
              city: "Rovereto",
              postalCode: "38068",
              stateOrProvince: "TN",
              countryCode: "IT",
            },
          },
        }),
      ),
      env.DB.prepare(
        "UPDATE order_items SET image_url = 'https://i.ebayimg.com/images/sintetica.jpg' WHERE id = 'i-a2'",
      ),
    ]);
    const result = await ordersPage(cookie);
    expect(result.notFound).toBe(false);
    const [order] = result.page!.orders;
    expect(order).toMatchObject({
      id: "o-a",
      ebayOrderId: "ebay-a",
      storeId: "s-a",
      marketplace: "EBAY_IT",
      buyerName: "Maria Rossi",
      buyerUsername: "acquirente-sintetico",
      shipTo: { name: "Maria Rossi c/o Ufficio", locality: "Rovereto (TN)", country: "IT" },
      payment: { status: "partially_refunded" },
      shipping: { status: "in_progress" },
      billingAddress: {
        line: "Via Roma 1, Scala B",
        postalCode: "38122",
        city: "Trento",
        province: "TN",
        countryCode: "IT",
      },
      phone: "+39 000 0000000",
      email: "maria@example.invalid",
      thumbnail: "https://i.ebayimg.com/images/sintetica.jpg",
      items: [
        { id: "line-a1", totalMinor: 999, quantity: 1, currency: "EUR" },
        { id: "line-a2", totalMinor: 300, quantity: 2, currency: "EUR" },
      ],
      // Nessuna lettura in attesa né controllo registrato: la lettura risulta da riprovare.
      fiscal: { state: "locked", shownAs: "CF" },
    });
    // Il valore da sbloccare non arriva mai al browser, neppure nella vista condivisa.
    expect(JSON.stringify(result)).not.toContain("RSSMRA80A01H501U");
    expect(result.page).toMatchObject({
      view: "list",
      exportable: false,
      // Negozio eBay reale: l'ordine si apre nel Seller Hub.
      openOnEbay: true,
      settings: false,
      account: { plan: "free", quota: { used: 0, limit: 1 } },
    });

    // Uno stato eBay non previsto compare con il suo codice; uno stato assente resta tale.
    await env.DB.prepare(
      "UPDATE orders SET payment_status = 'AWAITING_REVIEW', fulfillment_status = NULL WHERE id = 'o-a'",
    ).run();
    const unknown = (await ordersPage(cookie)).page!.orders[0]!;
    expect(unknown.payment).toEqual({ status: null, code: "AWAITING_REVIEW" });
    expect(unknown.shipping).toEqual({ status: null, code: null });
    // Uno stato non previsto resta fuori dai filtri.
    expect((await ordersPage(cookie, "/app/ordini?pagamento=paid")).page!.orders).toEqual([]);
  });

  it("mostra il prezzo unitario solo quando la divisione è esatta, altrimenti l'importo della riga", () => {
    const line = (totalMinor: number | null, quantity: number) => ({
      id: "riga",
      title: "Articolo",
      sku: null,
      quantity,
      totalMinor,
      currency: "EUR",
    });
    expect(itemPrice(line(999, 1))).toEqual({ minor: 999, unit: true });
    expect(itemPrice(line(300, 2))).toEqual({ minor: 150, unit: true });
    expect(itemPrice(line(1000, 3))).toEqual({ minor: 1000, unit: false });
    expect(itemPrice(line(0, 4))).toEqual({ minor: 0, unit: true });
    expect(itemPrice(line(null, 2))).toBeNull();
  });

  it("apre il dettaglio dall'indirizzo solo per un ordine consultabile dello spazio", async () => {
    const { cookie } = await owner();
    const opened = await ordersPage(cookie, "/app/ordini/o-a", { ordine: "o-a" });
    expect(opened.page?.detail).toMatchObject({ id: "o-a", ebayOrderId: "ebay-a" });
    // Un ordine di un altro spazio, inesistente o scaduto risponde allo stesso modo.
    for (const ordine of ["o-b", "inesistente", "x".repeat(65)]) {
      const missing = await ordersPage(cookie, `/app/ordini/${ordine}`, { ordine });
      expect(missing).toMatchObject({ data: { notFound: true }, init: { status: 404 } });
      expect(JSON.stringify(missing)).not.toContain("ebay-b");
    }
    await env.DB.prepare("UPDATE orders SET retention_until = ? WHERE id = 'o-a'").bind(now).run();
    expect(await ordersPage(cookie, "/app/ordini/o-a", { ordine: "o-a" })).toMatchObject({
      data: { notFound: true },
    });
  });

  it("filtra sul server con i soli valori autorizzati, anche nella forma normalizzata", async () => {
    const { cookie, userId } = await owner();
    await env.DB.prepare(
      "UPDATE tax_identifiers SET value = ' rss mra80a01h501u' WHERE id = 't-a1'",
    ).run();
    // Prima dello sblocco il codice non trova l'ordine e il filtro lo indica da sbloccare.
    expect((await ordersPage(cookie, "/app/ordini?q=RSSMRA80A01H501U")).page!.orders).toEqual([]);
    expect(
      (await ordersPage(cookie, "/app/ordini?fiscale=locked")).page!.orders.map(({ id }) => id),
    ).toEqual(["o-a"]);
    await unlockOrders(env.DB, userId, ["o-a"]);
    const found = await ordersPage(cookie, "/app/ordini?q=RSSMRA80A01H501U");
    expect(found.page!.orders.map(({ id }) => id)).toEqual(["o-a"]);
    // L'originale resta quello della fonte; la forma derivata è solo per mostrare e copiare.
    const [order] = found.page!.orders;
    expect(order!.fiscal).toMatchObject({
      state: "available",
      identifiers: expect.arrayContaining([
        expect.objectContaining({ type: "CF", value: " rss mra80a01h501u" }),
      ]),
    });
    expect((await ordersPage(cookie, "/app/ordini?fiscale=locked")).page!.orders).toEqual([]);
    // Filtro e ricerca valutano l'accesso all'istante della richiesta, come la vista.
    await env.DB.prepare("UPDATE order_grants SET expires_at = ? WHERE order_id = 'o-a'")
      .bind(new Date(Date.parse(now) + 60_000).toISOString())
      .run();
    expect(
      (await ordersPage(cookie, "/app/ordini?fiscale=available")).page!.orders.map(({ id }) => id),
    ).toEqual(["o-a"]);
    expect((await ordersPage(cookie, "/app/ordini?q=RSSMRA80A01H501U")).page!.total).toBe(1);
    // L'esito del collegamento nell'indirizzo non diventa un filtro per negozio.
    expect(
      (await ordersPage(cookie, "/app/ordini?negozio=collegato")).page!.orders.map(({ id }) => id),
    ).toEqual(["o-a"]);
    expect((await ordersPage(cookie, "/app/ordini?negozio=s-b")).page!.orders).toEqual([]);
  });

  it("filtri, ricerca, conteggio e «Carica altri» usano la query reale sullo spazio", async () => {
    const { cookie, userId } = await owner();
    const day = 86_400_000;
    // Ordini sintetici di A con stati diversi; o-b resta di un altro spazio.
    const extra = [
      ["x-paid", "PAID", "FULFILLED", null, "EBAY_IT", 1],
      ["x-unpaid", "PENDING", "NOT_STARTED", null, "EBAY_DE", 2],
      ["x-partial", "PARTIALLY_REFUNDED", "IN_PROGRESS", null, "EBAY_IT", 3],
      ["x-refunded", "FULLY_REFUNDED", "NOT_STARTED", "CANCELED", "EBAY_IT", 10],
      ["x-unknown", "AWAITING_REVIEW", "NOT_STARTED", null, null, 15],
      ["x-checking", "PAID", "NOT_STARTED", null, "EBAY_IT", 20],
      ["x-missing", "PAID", "NOT_STARTED", null, "EBAY_IT", 25],
    ] as const;
    await env.DB.batch([
      ...extra.map(([id, payment, fulfillment, cancel, marketplace, age]) =>
        env.DB.prepare(
          `INSERT INTO orders (id, store_id, ebay_order_id, creation_time, last_modified_time, currency,
             total_minor, payment_status, fulfillment_status, cancel_status, marketplace_id, buyer_json)
           VALUES (?1, 's-a', ?1, ?2, ?2, 'EUR', 100, ?3, ?4, ?5, ?6, ?7)`,
        ).bind(
          id,
          new Date(Date.parse(now) - age * day).toISOString(),
          payment,
          fulfillment,
          cancel,
          marketplace,
          JSON.stringify({
            username: `utente-${id}`,
            name: id === "x-paid" ? "Giulia Verdi" : null,
          }),
        ),
      ),
      env.DB.prepare(
        `INSERT INTO order_items (id, order_id, line_item_id, sku, title, quantity, total_minor, currency)
         VALUES ('i-x', 'x-paid', 'l-x', 'SKU-RICERCA', 'Lampada da tavolo', 1, 100, 'EUR')`,
      ),
      env.DB.prepare(
        `INSERT INTO order_source_refs (store_id, source, external_order_id, order_id, last_modified_time)
         VALUES ('s-a', 'fulfillment', 'x-checking', 'x-checking', ?1)`,
      ).bind(now),
      env.DB.prepare(
        `INSERT INTO order_tax_checks (order_id, source, observed_at, availability)
         VALUES ('x-missing', 'ebay_fulfillment', ?1, 'absent'), ('x-paid', 'ebay_fulfillment', ?1, 'absent')`,
      ).bind(now),
    ]);
    const ids = async (query: string) =>
      (await ordersPage(cookie, `/app/ordini?${query}`)).page!.orders.map(({ id }) => id);
    const all = (await ordersPage(cookie, "/app/ordini?mostra=2")).page!;
    expect(all.total).toBe(8);
    expect(all.marketplaces).toEqual(["EBAY_DE", "EBAY_IT"]);
    // Lo stato fiscale filtrato in SQL coincide con quello della vista per ogni ordine.
    for (const order of all.orders)
      expect(await ids(`fiscale=${order.fiscal.state}&mostra=2`)).toContain(order.id);
    expect(Object.fromEntries(all.orders.map((order) => [order.id, order.fiscal.state]))).toEqual({
      "o-a": "locked",
      "x-paid": "missing",
      "x-unpaid": "error",
      "x-partial": "error",
      "x-refunded": "error",
      "x-unknown": "error",
      "x-checking": "checking",
      "x-missing": "missing",
    });
    expect(await ids("pagamento=paid")).toEqual(["x-paid", "x-checking", "x-missing"]);
    expect(await ids("pagamento=unpaid")).toEqual(["x-unpaid"]);
    expect(await ids("pagamento=partially_refunded")).toEqual(["x-partial"]);
    expect(await ids("pagamento=refunded")).toEqual(["x-refunded"]);
    expect(await ids("spedizione=cancelled")).toEqual(["x-refunded"]);
    expect(await ids("spedizione=in_progress")).toEqual(["x-partial"]);
    expect(await ids("spedizione=shipped")).toEqual(["x-paid"]);
    expect(await ids("marketplace=EBAY_DE")).toEqual(["x-unpaid"]);
    expect(await ids("periodo=7")).toEqual(["o-a", "x-paid", "x-unpaid", "x-partial"]);
    // In Free il periodo di 90 giorni vale come «Tutti», come nell'interfaccia.
    expect((await ordersPage(cookie, "/app/ordini?periodo=90")).page!.total).toBe(8);
    expect(await ids("pagamento=sconosciuto&negozio=s-a&fiscale=missing")).toEqual([
      "x-paid",
      "x-missing",
    ]);
    // La ricerca combina le parole su numero, acquirente, articoli e SKU.
    expect(await ids("q=giulia%20sku-ricerca")).toEqual(["x-paid"]);
    expect(await ids("q=LAMPADA")).toEqual(["x-paid"]);
    expect(await ids("q=utente-x-unpaid")).toEqual(["x-unpaid"]);
    expect(await ids("q=ebay-b")).toEqual([]);
    // «Carica altri» amplia la pagina letta dal server finché restano ordini.
    const first = (await ordersPage(cookie)).page!;
    expect({ shown: first.orders.length, total: first.total }).toEqual({ shown: 6, total: 8 });
    expect(first.nextHref).toBe("/app/ordini?mostra=2");
    expect(all.nextHref).toBeNull();
    const filtered = (await ordersPage(cookie, "/app/ordini?pagamento=paid&negozio=collegato"))
      .page!;
    expect(filtered).toMatchObject({ total: 3, nextHref: null });
    void userId;
  });

  it("forma derivata di CF e Partita IVA italiani senza toccare i tipi esteri", () => {
    expect(displayTaxValue({ type: "CF", value: " rss mra80a01h501u " })).toBe("RSSMRA80A01H501U");
    expect(displayTaxValue({ type: "PIVA", value: "0123 4567 890" })).toBe("01234567890");
    expect(displayTaxValue({ type: "PIVA", value: "00000000000" })).toBe("00000000000");
    // Un valore errato resta errato: la forma derivata non lo corregge.
    expect(displayTaxValue({ type: "CF", value: "rss-mra" })).toBe("RSS-MRA");
    expect(displayTaxValue({ type: "OTHER", value: " es b123 456 " })).toBe(" es b123 456 ");
  });

  it("«Riprova» rilegge soltanto un ordine dello spazio con lettura non riuscita", async () => {
    const { cookie } = await owner();
    const send = vi.spyOn(env.WORK_QUEUE, "send").mockResolvedValue(undefined);
    // Con dati da sbloccare la lettura non è da riprovare.
    expect(await ordersAction(cookie, { intent: "retry", order: "o-a" })).toMatchObject({
      init: { status: 409 },
    });
    await env.DB.batch([
      env.DB.prepare("DELETE FROM tax_identifiers WHERE order_id = 'o-a'"),
      env.DB.prepare(
        `INSERT INTO order_source_refs (store_id, source, external_order_id, order_id, last_modified_time,
           detail_for, detail_error, detail_attempts)
         VALUES ('s-a', 'fulfillment', 'ebay-a', 'o-a', ?1, ?1, 'unavailable', 5)`,
      ).bind(now),
    ]);
    // Senza un consenso valido la lettura non si può richiedere e nulla cambia.
    expect(await ordersAction(cookie, { intent: "retry", order: "o-a" })).toMatchObject({
      init: { status: 409 },
    });
    await withCredentials();
    expect(await ordersAction(cookie, { intent: "retry", order: "o-a" })).toEqual({
      ok: true,
      notice: "Nuova lettura richiesta.",
    });
    expect(send).toHaveBeenCalledWith({ syncStore: "s-a" });
    expect(
      await env.DB.prepare(
        "SELECT detail_for, detail_error, detail_attempts FROM order_source_refs WHERE order_id = 'o-a'",
      ).first(),
    ).toEqual({ detail_for: null, detail_error: null, detail_attempts: 0 });
    // L'ordine torna in verifica finché la nuova lettura non si conclude.
    expect((await ordersPage(cookie)).page!.orders[0]!.fiscal).toEqual({ state: "checking" });
    // Un ordine di un altro spazio non si rilegge.
    expect(await ordersAction(cookie, { intent: "retry", order: "o-b" })).toMatchObject({
      init: { status: 409 },
    });
    send.mockRestore();
  });

  it("la nuova lettura di un ordine noto solo a Trading riparte dalla passata Trading", async () => {
    const { userId } = await owner();
    const send = vi.spyOn(env.WORK_QUEUE, "send").mockResolvedValue(undefined);
    await withCredentials();
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO order_source_refs (store_id, source, external_order_id, order_id, last_modified_time)
         VALUES ('s-a', 'trading', 'ebay-a', 'o-a', ?1)`,
      ).bind(now),
      env.DB.prepare(
        `INSERT INTO sync_state (store_id, updated_at, history_from, trading_cursor, trading_end, trading_page, trading_total)
         VALUES ('s-a', ?1, ?1, ?1, ?1, 2, 40), ('s-b', ?1, ?1, ?1, NULL, NULL, NULL)`,
      ).bind(now),
    ]);
    const tradingState = () =>
      env.DB.prepare(
        "SELECT store_id, trading_cursor, trading_end, trading_page, trading_total FROM sync_state ORDER BY store_id",
      ).all();
    // Il negozio di un altro spazio non si rilegge e il suo cursore resta.
    expect(await requestOrderRead(env, userId, { id: "o-b", storeId: "s-b" })).toBe("not_found");
    expect(await requestOrderRead(env, userId, { id: "o-a", storeId: "s-a" })).toBe("queued");
    expect((await tradingState()).results).toEqual([
      {
        store_id: "s-a",
        trading_cursor: null,
        trading_end: null,
        trading_page: null,
        trading_total: null,
      },
      {
        store_id: "s-b",
        trading_cursor: now,
        trading_end: null,
        trading_page: null,
        trading_total: null,
      },
    ]);
    // Con un riferimento Fulfillment rilegge il dettaglio, non l'intera passata Trading.
    await env.DB.batch([
      env.DB.prepare("UPDATE sync_state SET trading_cursor = ?1, requested_at = NULL").bind(now),
      env.DB.prepare(
        `INSERT INTO order_source_refs (store_id, source, external_order_id, order_id, last_modified_time, detail_for)
         VALUES ('s-a', 'fulfillment', 'ebay-a', 'o-a', ?1, ?1)`,
      ).bind(now),
    ]);
    expect(await requestOrderRead(env, userId, { id: "o-a", storeId: "s-a" })).toBe("queued");
    expect((await tradingState()).results[0]).toMatchObject({ trading_cursor: now });
    expect(
      await env.DB.prepare(
        "SELECT detail_for FROM order_source_refs WHERE source = 'fulfillment'",
      ).first(),
    ).toEqual({ detail_for: null });
    send.mockRestore();
  });

  it("mostra subito l'ultimo stato e conferma nella stessa risposta la verifica in corso", async () => {
    const { cookie } = await owner();
    await env.DB.prepare(
      `INSERT INTO order_source_refs (store_id, source, external_order_id, order_id, last_modified_time)
       VALUES ('s-a', 'fulfillment', 'ebay-a', 'o-a', ?)`,
    )
      .bind(now)
      .run();
    const result = await ordersPage(cookie);
    // Lo sblocco resta sospeso durante la verifica, senza attendere eBay.
    expect(result.page!.orders[0]!.fiscal).toEqual({
      state: "locked",
      shownAs: "CF",
      hold: "checking",
    });
    expect(result.confirmation).toBeInstanceOf(Promise);
    await env.DB.batch([
      env.DB.prepare("UPDATE order_source_refs SET detail_for = last_modified_time"),
      env.DB.prepare(
        `INSERT INTO order_tax_checks (order_id, source, last_modified_time, observed_at, availability)
         VALUES ('o-a', 'ebay_trading_get_orders', ?1, ?1, 'present')`,
      ).bind(now),
    ]);
    const confirmed = await result.confirmation!;
    expect(confirmed.map(({ id, fiscal }) => ({ id, fiscal }))).toEqual([
      { id: "o-a", fiscal: { state: "locked", shownAs: "CF" } },
    ]);
    expect(JSON.stringify(confirmed)).not.toContain("RSSMRA80A01H501U");
    // Senza verifiche in corso non resta nulla da confermare.
    expect((await ordersPage(cookie)).confirmation).toBeUndefined();
  });

  it("l'attesa della conferma si ferma alla scadenza con l'ultima lettura", async () => {
    let reads = 0;
    const read = async () => ++reads;
    expect(await settle(read, (value) => value === 2, { timeoutMs: 1_000, intervalMs: 10 })).toBe(
      2,
    );
    reads = 0;
    // Un'altra attesa supererebbe la scadenza: resta l'ultima lettura, non confermata.
    expect(await settle(read, () => false, { timeoutMs: 15, intervalMs: 20 })).toBe(1);
  });

  it("rilegge una volta gli ordini mai verificati", async () => {
    await seed();
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO orders (id, store_id, ebay_order_id, creation_time, last_modified_time, currency, total_minor, is_provisional)
         VALUES ('o-t', 's-a', 'trading-a', ?1, ?1, 'EUR', 100, 1)`,
      ).bind(now),
      env.DB.prepare(
        `INSERT INTO order_source_refs (store_id, source, external_order_id, order_id, last_modified_time, detail_for, detail_error)
         VALUES ('s-a', 'fulfillment', 'ebay-a', 'o-a', ?1, ?1, NULL),
                ('s-b', 'fulfillment', 'ebay-b', 'o-b', ?1, ?1, NULL),
                ('s-a', 'trading', 'trading-a', 'o-t', ?1, NULL, NULL)`,
      ).bind(now),
      env.DB.prepare(
        `INSERT INTO order_tax_checks (order_id, source, last_modified_time, observed_at, availability)
         VALUES ('o-b', 'ebay_trading_get_orders', ?1, ?1, 'present')`,
      ).bind(now),
      env.DB.prepare(
        `INSERT INTO sync_state (store_id, updated_at, history_from, trading_cursor)
         VALUES ('s-a', ?1, ?1, ?1), ('s-b', ?1, ?1, ?1)`,
      ).bind(now),
    ]);
    const migration = env.TEST_MIGRATIONS.find(
      ({ name }) => name === "0028_order_tax_recheck.sql",
    )!;
    await env.DB.batch(migration.queries.map((query) => env.DB.prepare(query)));
    expect(
      (
        await env.DB.prepare(
          "SELECT order_id, detail_for FROM order_source_refs WHERE source = 'fulfillment' ORDER BY order_id",
        ).all()
      ).results,
    ).toEqual([
      { order_id: "o-a", detail_for: null },
      { order_id: "o-b", detail_for: now },
    ]);
    expect(
      (
        await env.DB.prepare(
          "SELECT store_id, trading_cursor FROM sync_state ORDER BY store_id",
        ).all()
      ).results,
    ).toEqual([
      { store_id: "s-a", trading_cursor: null },
      { store_id: "s-b", trading_cursor: now },
    ]);
  });
});

describe("vista condivisa e criteri degli ordini", () => {
  const base: VisibleOrder = {
    id: "o",
    ebayOrderId: "12-00000-00000",
    creationTime: now,
    lastModifiedTime: now,
    currency: "EUR",
    totalMinor: 1000,
    storeId: "s",
    storeName: "Negozio",
    marketplaceId: null,
    summary: {
      buyer: null,
      orderPaymentStatus: null,
      orderFulfillmentStatus: null,
      payment: null,
      shipping: null,
      lineItems: [],
    },
    fiscalState: "locked",
    taxVerification: "completed",
    taxAvailability: "present",
    taxCheckedAt: null,
    firstTaxAvailableAt: null,
    lockedShownAs: "CF",
    reconciliationIssue: false,
    taxIdentifiers: [],
  };
  const view = (order: Partial<VisibleOrder>) => orderView({ ...base, ...order });
  const cf = {
    type: "CODICE_FISCALE",
    issuingCountry: null,
    value: "RSSMRA80A01H501U",
    source: "ebay_fulfillment",
    observedAt: now,
    quality: "valid" as const,
    updated: false,
  };

  it("riporta la condizione dell'ultima lettura accanto a un valore disponibile", () => {
    const available = (
      taxVerification: VisibleOrder["taxVerification"],
      taxAvailability: VisibleOrder["taxAvailability"],
    ) =>
      view({ fiscalState: "available", taxVerification, taxAvailability, taxIdentifiers: [cf] })
        .fiscal;
    const identifier = { type: "CF", value: "RSSMRA80A01H501U", quality: "valid", updated: false };
    expect(available("completed", "present")).toEqual({
      state: "available",
      identifiers: [identifier],
    });
    expect(available("error", "present")).toMatchObject({ notice: "lastKnown" });
    expect(available("checking", "masked")).toMatchObject({ notice: "checking" });
    expect(available("completed", "masked")).toMatchObject({ notice: "masked" });
    expect(available("completed", "absent")).toMatchObject({ notice: "notReturned" });
    expect(available("completed", "not_included")).toMatchObject({ notice: "notReturned" });
    expect(available("completed", "removed")).not.toHaveProperty("notice");
    // Un tipo estero conserva il nome originale; quelli italiani no.
    expect(
      view({
        fiscalState: "available",
        taxIdentifiers: [{ ...cf, type: "NIF", issuingCountry: "ES", quality: "unchecked" }],
      }).fiscal,
    ).toEqual({
      state: "available",
      identifiers: [
        {
          type: "OTHER",
          typeLabel: "NIF",
          value: "RSSMRA80A01H501U",
          quality: "unchecked",
          updated: false,
        },
      ],
    });
  });

  it("sospende lo sblocco durante una nuova verifica", () => {
    expect(view({}).fiscal).toEqual({ state: "locked", shownAs: "CF" });
    expect(view({ taxVerification: "checking" }).fiscal).toEqual({
      state: "locked",
      shownAs: "CF",
      hold: "checking",
    });
    expect(view({ fiscalState: "missing", taxAvailability: "masked" }).fiscal).toEqual({
      state: "missing",
      reason: "masked",
    });
    expect(view({ fiscalState: "missing", taxAvailability: "removed" }).fiscal).toEqual({
      state: "missing",
      reason: "removed",
    });
    expect(view({ fiscalState: "missing", taxAvailability: "absent" }).fiscal).toEqual({
      state: "missing",
    });
    // Senza dato, l'acquirente estero ha un motivo proprio.
    const billedIn = (countryCode: string) =>
      ({
        ...base.summary,
        buyer: { billingAddress: { countryCode } },
      }) as VisibleOrder["summary"];
    const missing = { fiscalState: "missing", taxAvailability: "not_included" } as const;
    expect(view({ ...missing, summary: billedIn("ES") }).fiscal).toEqual({
      state: "missing",
      reason: "foreign",
      country: "ES",
    });
    expect(view({ ...missing, summary: billedIn("IT") }).fiscal).toEqual({ state: "missing" });
    expect(
      view({ fiscalState: "missing", taxAvailability: "masked", summary: billedIn("ES") }).fiscal,
    ).toEqual({ state: "missing", reason: "masked" });
    expect(view({ fiscalState: "checking" }).fiscal).toEqual({ state: "checking" });
    expect(view({ fiscalState: "error" }).fiscal).toEqual({ state: "error" });
  });

  it("compone stati, contatti, indirizzi e righe senza inventare dati assenti", () => {
    const address = {
      addressLine1: "Via Roma 1",
      addressLine2: null,
      city: "Trento",
      postalCode: null,
      stateOrProvince: null,
      countryCode: "IT",
    };
    const summary = (changes: Partial<VisibleOrder["summary"]>) => ({
      ...base.summary,
      ...changes,
    });
    const buyer = (changes: object) =>
      ({
        username: null,
        name: null,
        email: null,
        phone: null,
        billingAddress: null,
        shipTo: null,
        ...changes,
      }) as VisibleOrder["summary"]["buyer"];
    const empty = view({});
    expect(empty).toMatchObject({
      buyerName: null,
      buyerUsername: null,
      shipTo: null,
      billingAddress: null,
      phone: null,
      email: null,
      payment: { status: null, code: null },
      shipping: { status: null, code: null },
      suggestions: [],
      lastSyncedAt: null,
    });
    expect(empty).not.toHaveProperty("suggestionStatus");
    expect(empty).not.toHaveProperty("reconciliationIssue");
    expect(empty).not.toHaveProperty("thumbnail");
    const order = view({
      reconciliationIssue: true,
      suggestions: [],
      suggestionStatus: "none",
      summary: summary({
        payment: "unknown",
        orderPaymentStatus: "AWAITING",
        shipping: "shipped",
        orderFulfillmentStatus: "FULFILLED",
        buyer: buyer({
          billingAddress: address,
          shipTo: { name: "Mario", phone: "+39 1", address: { ...address, city: "Rovereto" } },
        }),
        lineItems: [
          {
            lineItemId: "a",
            title: "A",
            quantity: 2,
            sku: null,
            totalMinor: 300,
            currency: "USD",
            imageUrl: null,
          },
          {
            lineItemId: "b",
            title: "B",
            quantity: 1,
            sku: "S",
            totalMinor: 200,
            currency: "EUR",
            imageUrl: "https://i.ebayimg.com/b.jpg",
          },
        ],
      }),
    });
    expect(order).toMatchObject({
      payment: { status: null, code: "AWAITING" },
      shipping: { status: "shipped" },
      shipTo: { name: "Mario", locality: "Rovereto", country: "IT" },
      // Senza seconda riga né CAP: nessun separatore o valore inventato.
      billingAddress: {
        line: "Via Roma 1",
        postalCode: "",
        city: "Trento",
        province: null,
        countryCode: "IT",
      },
      // Senza telefono dell'acquirente vale quello del destinatario.
      phone: "+39 1",
      reconciliationIssue: true,
      suggestionStatus: "none",
      thumbnail: "https://i.ebayimg.com/b.jpg",
      // Un importo in un'altra valuta non si mostra come se fosse in euro.
      items: [
        { id: "a", totalMinor: null, currency: "EUR" },
        { id: "b", totalMinor: 200, currency: "EUR" },
      ],
    });
    expect(order.shipping).toEqual({ status: "shipped" });
    // Indirizzo senza città o Paese, o senza righe: nessun indirizzo di fatturazione.
    for (const billing of [
      { ...address, city: null },
      { ...address, countryCode: null },
      { ...address, addressLine1: null },
    ])
      expect(
        view({ summary: summary({ buyer: buyer({ billingAddress: billing }) }) }).billingAddress,
      ).toBeNull();
    expect(
      view({
        summary: summary({
          buyer: buyer({
            billingAddress: { ...address, addressLine1: null, addressLine2: "Scala B" },
          }),
        }),
      }).billingAddress,
    ).toMatchObject({ line: "Scala B" });
    expect(
      view({
        summary: summary({ buyer: buyer({ shipTo: { name: null, phone: null, address: null } }) }),
      }).shipTo,
    ).toEqual({ name: null, locality: null, country: null });
    expect(
      view({
        summary: summary({
          buyer: buyer({
            shipTo: { name: null, phone: null, address: { ...address, city: null } },
          }),
        }),
      }).shipTo,
    ).toEqual({ name: null, locality: null, country: "IT" });
    expect(
      view({
        summary: summary({
          buyer: buyer({
            shipTo: { name: null, phone: null, address: { ...address, stateOrProvince: "TN" } },
          }),
        }),
      }).shipTo?.locality,
    ).toBe("Trento (TN)");
  });

  it("legge i criteri dell'indirizzo con i soli valori previsti", () => {
    const at = new Date(now);
    const criteria = (query: string, plan: "free" | "premium" = "free") =>
      orderCriteria(new URLSearchParams(query), at, plan);
    expect(criteria("")).toEqual({
      storeId: undefined,
      marketplace: undefined,
      since: undefined,
      payment: undefined,
      shipping: undefined,
      fiscal: undefined,
      tokens: undefined,
    });
    expect(
      criteria(
        "negozio=s-a&marketplace=EBAY_IT&periodo=7&pagamento=paid&spedizione=in_progress&fiscale=locked",
      ),
    ).toEqual({
      storeId: "s-a",
      marketplace: "EBAY_IT",
      since: new Date(at.getTime() - 7 * 86_400_000).toISOString(),
      payment: "paid",
      shipping: "in_progress",
      fiscal: "locked",
      tokens: undefined,
    });
    expect(criteria("periodo=30").since).toBe(
      new Date(at.getTime() - 30 * 86_400_000).toISOString(),
    );
    // Il periodo di 90 giorni è un'opzione Premium; un valore sconosciuto vale come «Tutti».
    expect(criteria("periodo=90").since).toBeUndefined();
    for (const days of [7, 30])
      expect(criteria(`periodo=${days}`, "premium").since).toBe(
        new Date(at.getTime() - days * 86_400_000).toISOString(),
      );
    expect(criteria("periodo=90", "premium").since).toBe(
      new Date(at.getTime() - 90 * 86_400_000).toISOString(),
    );
    expect(criteria("periodo=1&pagamento=delivered&spedizione=x&fiscale=x")).toMatchObject({
      since: undefined,
      payment: undefined,
      shipping: undefined,
      fiscal: undefined,
    });
    // Ricerca in minuscolo divisa sugli spazi, al massimo dieci parole.
    expect(criteria("q=%20Giulia%09%20SKU-A%20%20").tokens).toEqual(["giulia", "sku-a"]);
    expect(criteria("q=%20%20").tokens).toBeUndefined();
    expect(
      criteria(`q=${Array.from({ length: 12 }, (_, i) => `p${i}`).join("%20")}`).tokens,
    ).toHaveLength(10);
    // Identificativi oltre 64 caratteri non filtrano.
    expect(criteria(`negozio=${"x".repeat(64)}`).storeId).toBe("x".repeat(64));
    expect(criteria(`negozio=${"x".repeat(65)}&marketplace=`).storeId).toBeUndefined();
    expect(criteria("marketplace=").marketplace).toBeUndefined();
  });

  it("conta i dati dell'intero elenco, anche senza ordini", async () => {
    await seed();
    const at = new Date(now);
    expect(await visibleOrderFacets(env.DB, "u-a", "production", at)).toEqual({
      total: 1,
      marketplaces: [],
      locked: true,
    });
    await unlockOrders(env.DB, "u-a", ["o-a"]);
    expect(await visibleOrderFacets(env.DB, "u-a", "production", at)).toMatchObject({
      locked: false,
    });
    expect(await visibleOrderFacets(env.DB, "nessuno", "production", at)).toEqual({
      total: 0,
      marketplaces: [],
      locked: false,
    });
  });
});
