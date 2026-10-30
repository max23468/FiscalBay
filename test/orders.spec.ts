import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildLastModifiedFilter,
  fulfillmentObservation,
} from "../app/integrations/ebay/fulfillment.server";
import { mapTradingTaxIdentifiers } from "../app/integrations/ebay/trading.server";
import {
  currentFreePromotion,
  orderAllowance,
  UnlockError,
  unlockOrders,
  unlockConfirmation,
  restoreUnlockConfirmation,
} from "../app/domain/grants.server";
import { listVisibleOrders } from "../app/domain/orders.server";
import { completeRegistration } from "../app/domain/registration.server";
import { createAuth } from "../app/auth.server";
import { action as unlockAction, loader as loadHome } from "../app/routes/orders";
import { loader as loadAccess } from "../app/routes/sign-in";
import { action as securityAction } from "../app/routes/settings";
import {
  insertEntitlement,
  insertStore,
  insertWorkspace,
  insertTaxIdentifiers,
  now,
  resetDatabase,
  seed,
} from "./fixtures/database-fixtures";
import { syntheticProfile } from "./fixtures/account-fixtures";
import { formatDate } from "../app/format";
import {
  callRoute,
  routeData,
  routePage,
  routeResponse,
  testOrigin,
} from "./fixtures/route-fixtures";

import { searchOrders } from "./fixtures/order-search-fixtures";

beforeEach(resetDatabase);
afterEach(() => vi.useRealTimers());

describe("percorso ordini", () => {
  it("lega la pagina ordini alla sessione e al tenant senza consenso eBay", async () => {
    await seed();

    // Senza sessione gli Ordini rimandano all'accesso, che mostra i moduli.
    const anonymous = await routeResponse(loadHome, "/app/ordini?accesso=errore");
    expect(anonymous.headers.get("location")).toBe("/accesso?accesso=errore");
    expect(await routeData(loadAccess, "/accesso")).toEqual({
      authenticated: false,
      registrationRestricted: false,
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

    const authenticated = await routePage(loadHome, "/app/ordini", { cookie: cookie! });
    expect(authenticated.verified).toBe(true);
    expect(authenticated.page?.orders.map(({ ebayOrderId }) => ebayOrderId)).toEqual(["ebay-a"]);
    // La ricerca considera solo i valori autorizzati: un codice da sbloccare non trova l'ordine,
    // né fra i suggerimenti né nell'elenco, e non compare nell'indirizzo.
    const guess = await searchOrders(cookie!, "RSSMRA80A01H501U");
    expect(guess).toMatchObject({ items: [], total: 0 });
    expect(guess.href).not.toContain("RSSMRA80A01H501U");
    const guessed = await routePage(loadHome, guess.href, { cookie: cookie! });
    expect(guessed.page).toMatchObject({ search: "RSSMRA80A01H501U", orders: [], total: 0 });
    const unlock = (ids: string, origin = testOrigin) =>
      callRoute(unlockAction, "/app/ordini", {
        cookie,
        origin,
        fields: { intent: "unlock", ids, skipConfirmation: "true" },
      });
    const denied = await unlock("o-b");
    expect(denied).toMatchObject({ init: { status: 409 }, data: { error: true, unlocked: [] } });
    // Un guasto che non è un rifiuto dello sblocco resta un errore della pagina (500). I primi
    // batch della richiesta riallineano il piano e registrano l'attività, il terzo è lo sblocco.
    const batch = env.DB.batch.bind(env.DB);
    const outage = vi
      .spyOn(env.DB, "batch")
      .mockImplementationOnce(batch)
      .mockImplementationOnce(batch)
      .mockRejectedValueOnce(new Error("D1_ERROR: guasto"));
    await expect(unlock("o-a")).rejects.toThrow("D1_ERROR: guasto");
    outage.mockRestore();
    expect(await unlockConfirmation(env.DB, user!.id)).toBe(true);
    await expect(unlock("o-a", "https://estraneo.invalid")).rejects.toMatchObject({ status: 403 });
    expect(await unlock("o-a")).toEqual({ unlocked: ["o-a"], remaining: 0 });
    expect(await unlockConfirmation(env.DB, user!.id)).toBe(false);
    // In Piano e pagamenti la conferma si riattiva e si disattiva dallo stesso interruttore.
    const toggle = (value: string) =>
      callRoute(securityAction, "/app/impostazioni/piano", {
        cookie,
        fields: { intent: "save", name: "unlock-confirmation", value },
      });
    expect(await toggle("true")).toEqual({ ok: true });
    expect(await unlockConfirmation(env.DB, user!.id)).toBe(true);
    expect(await toggle("false")).toEqual({ ok: true });
    expect(await unlockConfirmation(env.DB, user!.id)).toBe(false);
    expect(await toggle("forse")).toMatchObject({ init: { status: 400 } });
    expect(await unlockConfirmation(env.DB, user!.id)).toBe(false);
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

  it("non confronta gli identificativi senza chiave e ne lascia intatte le modifiche", async () => {
    await seed();
    await unlockOrders(env.DB, "u-a", ["o-a"]);
    await env.DB.prepare("DELETE FROM tax_identifiers WHERE order_id = 'o-a'").run();
    const earlier = "2026-09-01T00:00:00.000Z";
    // Il CF sintetico sostituisce un valore rimosso; quello di Fulfillment con un altro nome di
    // tipo non si confronta con nessuno e resta senza modifica.
    await insertTaxIdentifiers(
      {
        id: "s-old",
        orderId: "o-a",
        type: "CODICE_FISCALE",
        country: "IT",
        value: "VECCHIO",
        observedAt: earlier,
        removedAt: earlier,
      },
      { id: "s-new", orderId: "o-a", type: "CODICE_FISCALE", country: "IT", value: "SINTETICO" },
      {
        id: "f",
        orderId: "o-a",
        type: "CodiceFiscale",
        country: "IT",
        value: "SINTETICO",
        source: "ebay_fulfillment",
      },
    ).run();
    const identifiers = (await listVisibleOrders(env.DB, "u-a"))[0]!.taxIdentifiers;
    expect(identifiers.map(({ source, updated }) => [source, updated])).toEqual([
      ["synthetic_fixture", true],
      ["ebay_fulfillment", false],
    ]);
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
    // La stessa Partita IVA, o lo stesso identificativo estero, dalle due fonti eBay.
    ["VATIN", "IT", "PartitaIVA", null, 1],
    ["VATIN", "IT", "PartitaIVA", "IT", 1],
    ["VAT_ID", "IT", "VATIN", "IT", 1],
    ["VATIN", "DE", "VATIN", "DE", 1],
    ["VATIN", null, "PartitaIVA", null, 2],
    ["VATIN", "DE", "VATIN", "FR", 2],
    ["VATIN", "IT", "PartitaIVA", null, 2, "ebay_fulfillment", "synthetic_fixture"],
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
      await insertTaxIdentifiers(
        {
          id: "f",
          orderId: "o-a",
          type: fType,
          country: fCountry,
          value: "SINTETICO",
          source: fSource,
        },
        {
          id: "t",
          orderId: "o-a",
          type: tType,
          country: tCountry,
          value: "SINTETICO",
          source: tSource,
        },
      ).run();
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
    const cf = "RSSMRA80A01H501U";
    const trading = "ebay_trading_get_orders";
    await insertTaxIdentifiers(
      {
        id: "fiscal-f-before",
        orderId: "o-a",
        type: "CODICE_FISCALE",
        value: cf,
        source: "ebay_fulfillment",
      },
      {
        id: "fiscal-f",
        orderId: "o-a",
        type: "CODICE_FISCALE",
        country: "IT",
        value: cf,
        source: "ebay_fulfillment",
      },
      { id: "fiscal-t", orderId: "o-a", type: "CodiceFiscale", value: cf, source: trading },
      {
        id: "fiscal-other",
        orderId: "o-a",
        type: "CodiceFiscale",
        value: "ALTRO-SINTETICO",
        source: trading,
      },
      {
        id: "fiscal-country",
        orderId: "o-a",
        type: "CodiceFiscale",
        country: "ES",
        value: cf,
        source: trading,
      },
      { id: "fiscal-unknown", orderId: "o-a", type: "codice_fiscale", value: cf, source: trading },
    ).run();
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
          stableKey: null,
        },
        {
          lineItemId: "line-a2",
          title: "Articolo B",
          quantity: 2,
          sku: null,
          totalMinor: 300,
          currency: "EUR",
          imageUrl: null,
          stableKey: null,
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
    await insertTaxIdentifiers({
      id: "secondo",
      orderId: "o-a2",
      type: "VAT_ID",
      value: "SINTETICO",
    }).run();
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
    // Nel ciclo seguente il lotto riuscito non salva la preferenza del singolo sblocco.
    const following = new Date("2026-10-01T00:00:00.000Z");
    await unlockOrders(env.DB, "u-a", ["o-a", "o-a2"], true, "production", following);
    expect(await unlockConfirmation(env.DB, "u-a")).toBe(true);
    expect((await orderAllowance(env.DB, "u-a", following))?.remaining).toBe(4);
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
      "INSERT INTO ebay_store_pauses (store_id, reason, paused_at) VALUES ('s-a', 'plan', '2026-09-13T20:00:00.000Z')",
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

  it("con il Free sospeso dall'antiabuso nessuno sblocco del Free, salvo con una copertura", async () => {
    await seed();
    await env.DB.batch([
      env.DB.prepare("DELETE FROM free_cycles"),
      env.DB.prepare(`INSERT INTO free_cycles (id, workspace_id, starts_at, ends_at, quota)
        VALUES ('c-a', 'w-a', '2026-09-01T00:00:00Z', '2026-10-01T00:00:00Z', 5)`),
      env.DB.prepare(`INSERT INTO orders (id, store_id, ebay_order_id, creation_time,
          last_modified_time, currency, total_minor) VALUES ('o-a2', 's-a', 'ebay-a2', ?1, ?1, 'EUR', 100)`).bind(
        now,
      ),
      insertTaxIdentifiers({
        id: "t-a3",
        orderId: "o-a2",
        type: "CODICE_FISCALE",
        value: "VRDLGI80A01H501X",
      }),
    ]);
    expect(await unlockOrders(env.DB, "u-a", ["o-a"], true)).toMatchObject({ remaining: 4 });
    await env.DB.prepare(`INSERT INTO abuse_reviews (signal, outcome, workspace_id, actor, reason,
        reviewed_at) VALUES ('company:sintetico', 'suspended', 'w-a', 'admin', 'Stessa attività', ?)`)
      .bind(now)
      .run();
    expect(await orderAllowance(env.DB, "u-a")).toMatchObject({ suspended: true, remaining: 0 });
    // Anche sugli ordini già importati lo sblocco è rifiutato e non consuma nulla.
    await expect(unlockOrders(env.DB, "u-a", ["o-a2"], true)).rejects.toThrow("free_suspended");
    expect(await env.DB.prepare("SELECT used FROM free_cycles WHERE id = 'c-a'").first()).toEqual({
      used: 1,
    });
    // Lo sblocco già fatto resta visibile.
    const visible = await listVisibleOrders(env.DB, "u-a");
    expect(JSON.stringify(visible.find((order) => order.id === "o-a"))).toContain("RSSMRA");
    expect(JSON.stringify(visible.find((order) => order.id === "o-a2"))).not.toContain("VRDLGI");
    // Con una copertura concessa tutto funziona.
    await insertEntitlement({
      source: "admin",
      startsAt: now,
      endsAt: "2026-09-20T00:00:00.000Z",
      grantedBy: "admin",
      grantReason: "Verifica",
    }).run();
    expect(await orderAllowance(env.DB, "u-a")).toMatchObject({
      suspended: false,
      remaining: null,
    });
    expect(
      JSON.stringify((await listVisibleOrders(env.DB, "u-a")).find((order) => order.id === "o-a2")),
    ).toContain("VRDLGI");
  });

  it("accetta i limiti della selezione senza trasformare i duplicati in nuovi consumi o consenso singolo", async () => {
    await seed();
    const id = "x".repeat(128);
    await env.DB.prepare(`INSERT INTO orders (id, store_id, ebay_order_id, creation_time, last_modified_time, currency, total_minor)
      VALUES (?1, 's-a', ?1, ?2, ?2, 'EUR', 100)`)
      .bind(id, now)
      .run();
    await insertTaxIdentifiers({
      id: "boundary",
      orderId: id,
      type: "VAT_ID",
      value: "SINTETICO",
    }).run();
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
    await insertStore({ id: "replacement", linkedAt: "2026-09-21T00:00:00.000Z" }).run();
    expect(
      (await orderAllowance(env.DB, "u-a", new Date("2026-09-21T00:00:00.000Z")))?.cycle?.id,
    ).toBe(next?.cycle?.id);
    expect(await orderAllowance(env.DB, "u-a", new Date("2026-09-12T00:00:00.000Z"))).toMatchObject(
      { cycle: null, remaining: 0 },
    );
    // Uno spazio senza negozi collegati non ha ancora un ciclo.
    await env.DB.batch(insertWorkspace({ id: "w-c", userId: "u-c", name: "C" }));
    expect(await orderAllowance(env.DB, "u-c")).toMatchObject({ cycle: null, remaining: 0 });
    await env.DB.prepare("DELETE FROM free_cycles WHERE workspace_id = 'w-a'").run();
    expect(
      (await orderAllowance(env.DB, "u-a", new Date("2026-09-21T20:00:00.000Z")))?.cycle?.ends_at,
    ).toBe("2026-09-27T20:00:00.000Z");
  });

  it("gli ordini dallo storico e quelli nuovi consumano lo stesso contatore del ciclo", async () => {
    await seed();
    // Storico: creato prima del collegamento e dell'inizio del ciclo, ma nella finestra Free.
    const orders = [
      ["o-storico", "2026-08-20T10:00:00.000Z"],
      ["o-nuovo", now],
      ["o-oltre", now],
    ] as const;
    await env.DB.batch([
      env.DB.prepare("DELETE FROM free_cycles"),
      env.DB.prepare(`INSERT INTO free_cycles (id, workspace_id, starts_at, ends_at, quota)
        VALUES ('c-a', 'w-a', '2026-09-01T00:00:00Z', '2026-10-01T00:00:00Z', 2)`),
      ...orders.flatMap(([id, creationTime]) => [
        env.DB.prepare(`INSERT INTO orders (id, store_id, ebay_order_id, creation_time,
            last_modified_time, currency, total_minor) VALUES (?1, 's-a', ?1, ?2, ?2, 'EUR', 100)`).bind(
          id,
          creationTime,
        ),
        insertTaxIdentifiers({ id: `t-${id}`, orderId: id, type: "VAT_ID", value: "SINTETICO" }),
      ]),
    ]);
    const used = () =>
      env.DB.prepare("SELECT used FROM free_cycles WHERE id = 'c-a'")
        .first<{ used: number }>()
        .then((row) => row!.used);
    expect((await orderAllowance(env.DB, "u-a"))?.remaining).toBe(2);
    expect(await unlockOrders(env.DB, "u-a", ["o-storico"], true)).toEqual({
      unlocked: ["o-storico"],
      remaining: 1,
    });
    expect(await unlockOrders(env.DB, "u-a", ["o-nuovo"], true)).toEqual({
      unlocked: ["o-nuovo"],
      remaining: 0,
    });
    expect(await used()).toBe(2);
    expect(
      await env.DB.prepare("SELECT order_id, source, cycle_id FROM order_grants ORDER BY order_id")
        .all()
        .then(({ results }) => results),
    ).toEqual([
      { order_id: "o-nuovo", source: "free_cycle", cycle_id: "c-a" },
      { order_id: "o-storico", source: "free_cycle", cycle_id: "c-a" },
    ]);
    // Al limite il successivo è rifiutato senza consumo, qualunque sia la sua data.
    await expect(unlockOrders(env.DB, "u-a", ["o-oltre"], true)).rejects.toThrow(
      "free_quota_exhausted",
    );
    expect(await used()).toBe(2);
    expect(await env.DB.prepare("SELECT count(*) AS n FROM order_grants").first()).toEqual({
      n: 2,
    });
    expect((await orderAllowance(env.DB, "u-a"))?.remaining).toBe(0);
  });

  describe("cicli e promozione del Free", () => {
    const week = 7 * 24 * 60 * 60 * 1000;
    const promotion = (id: string, startsAt: string, endsAt: string, quota = 10) =>
      env.DB.prepare(
        "INSERT INTO free_promotions (id, starts_at, ends_at, quota, created_at) VALUES (?, ?, ?, ?, ?)",
      ).bind(id, startsAt, endsAt, quota, now);

    it("misura 7×24 ore sull'istante UTC anche quando cambia l'ora legale", async () => {
      await seed();
      await env.DB.prepare("DELETE FROM free_cycles").run();
      // Ancoraggio alle 22:00 di Roma: l'autunno toglie un'ora locale, la primavera la aggiunge.
      for (const [at, startsAt] of [
        ["2026-10-26T12:00:00.000Z", "2026-10-25T20:00:00.000Z"],
        ["2027-03-30T12:00:00.000Z", "2027-03-28T20:00:00.000Z"],
      ] as const) {
        const cycle = (await orderAllowance(env.DB, "u-a", new Date(at)))!.cycle!;
        expect(Date.parse(cycle.ends_at) - Date.parse(startsAt)).toBe(week);
        expect(cycle.ends_at).toBe(new Date(Date.parse(startsAt) + week).toISOString());
      }
      // Lo stesso istante di fine si legge in ore locali diverse prima e dopo il cambio.
      expect(formatDate("2026-11-01T20:00:00.000Z", "it", "time")).toBe("21:00");
      expect(formatDate("2026-10-25T20:00:00.000Z", "it", "time")).toBe("21:00");
      expect(formatDate("2026-10-18T20:00:00.000Z", "it", "time")).toBe("22:00");
    });

    it.each([
      ["Asia/Tokyo", "21 set 2026, 05:30"],
      ["America/Los_Angeles", "20 set 2026, 13:30"],
    ])(
      "assegna al ciclo nuovo lo sblocco della sua prima notte anche con il fuso %s",
      async (zone, local) => {
        await seed();
        await env.DB.prepare("DELETE FROM free_cycles").run();
        // Il secondo ciclo inizia alle 20:00 UTC del 20 settembre: in Giappone è già il 21.
        const before = new Date("2026-09-20T19:59:59.999Z");
        const night = new Date("2026-09-20T20:30:00.000Z");
        expect(formatDate(night.toISOString(), "it", "dateTime", zone)).toBe(local);
        const first = (await orderAllowance(env.DB, "u-a", before))!.cycle!;
        await unlockOrders(env.DB, "u-a", ["o-a"], false, "production", night);
        const second = (await orderAllowance(env.DB, "u-a", night))!.cycle!;
        expect(second.id).not.toBe(first.id);
        expect(second.used).toBe(1);
        expect((await orderAllowance(env.DB, "u-a", before))!.cycle).toMatchObject({
          id: first.id,
          used: 0,
        });
        expect(
          await env.DB.prepare("SELECT cycle_id FROM order_grants WHERE order_id = 'o-a'").first(),
        ).toEqual({ cycle_id: second.id });
      },
    );

    it("fissa la quota all'inizio del ciclo e annuncia quella del ciclo seguente", async () => {
      await seed();
      await env.DB.prepare("DELETE FROM free_cycles").run();
      // Cicli dalle 20:00 UTC di ogni domenica dal 13 settembre; promozione dal 15 al 29.
      await promotion("lancio", "2026-09-15T00:00:00.000Z", "2026-09-29T00:00:00.000Z").run();
      const allowance = (at: string) => orderAllowance(env.DB, "u-a", new Date(at));
      expect(await allowance("2026-09-16T00:00:00.000Z")).toMatchObject({
        remaining: 5,
        cycle: { quota: 5, next_quota: 10, ends_at: "2026-09-20T20:00:00.000Z" },
      });
      expect(await allowance("2026-09-21T00:00:00.000Z")).toMatchObject({
        remaining: 10,
        cycle: { quota: 10, next_quota: 10 },
      });
      // Il ciclo iniziato il 27 attraversa la fine della promozione e conserva la sua quota.
      expect(await allowance("2026-09-29T12:00:00.000Z")).toMatchObject({
        remaining: 10,
        cycle: { quota: 10, next_quota: 5, ends_at: "2026-10-04T20:00:00.000Z" },
      });
      expect(await allowance("2026-10-05T00:00:00.000Z")).toMatchObject({
        cycle: { quota: 5, next_quota: 5 },
      });
      // Una promozione accorciata non cambia la quota dei cicli già iniziati.
      await env.DB.prepare(
        `UPDATE free_promotions SET ends_at = '2026-09-27T00:00:00.000Z',
          updated_at = '2026-09-28T00:00:00.000Z' WHERE id = 'lancio'`,
      ).run();
      expect(await allowance("2026-09-29T12:00:00.000Z")).toMatchObject({
        cycle: { quota: 10, next_quota: 5 },
      });
      expect(await currentFreePromotion(env.DB, new Date("2026-09-14T23:59:59.999Z"))).toBeNull();
      expect(await currentFreePromotion(env.DB, new Date("2026-09-15T00:00:00.000Z"))).toEqual({
        quota: 10,
        endsAt: "2026-09-27T00:00:00.000Z",
      });
      expect(await currentFreePromotion(env.DB, new Date("2026-09-27T00:00:00.000Z"))).toBeNull();
    });

    it("dà la quota della promozione come era al suo inizio a un ciclo creato dopo la modifica", async () => {
      await seed();
      await env.DB.prepare("DELETE FROM free_cycles").run();
      await promotion("lancio", "2026-09-15T00:00:00.000Z", "2026-09-29T00:00:00.000Z").run();
      // Accorciata il 28, dopo l'inizio del ciclo del 27, prima che la sua riga esista.
      await env.DB.prepare(
        `UPDATE free_promotions SET ends_at = '2026-09-27T00:00:00.000Z',
          updated_at = '2026-09-28T00:00:00.000Z' WHERE id = 'lancio'`,
      ).run();
      const allowance = (at: string) => orderAllowance(env.DB, "u-a", new Date(at));
      expect(await allowance("2026-09-28T12:00:00.000Z")).toMatchObject({
        remaining: 10,
        cycle: { quota: 10, next_quota: 5 },
      });
      expect(await allowance("2026-10-05T00:00:00.000Z")).toMatchObject({ cycle: { quota: 5 } });
      // Una modifica senza istante successivo all'ultima non si registra.
      await expect(
        env.DB.prepare(
          "UPDATE free_promotions SET quota = 20, updated_at = '2026-09-27T00:00:00.000Z' WHERE id = 'lancio'",
        ).run(),
      ).rejects.toThrow("undated_promotion_change");
      await expect(
        env.DB.prepare("UPDATE free_promotions SET quota = 20 WHERE id = 'lancio'").run(),
      ).rejects.toThrow("undated_promotion_change");
    });

    it("crea un solo ciclo con richieste concorrenti e non lo azzera né lo sposta", async () => {
      await seed();
      await env.DB.prepare("DELETE FROM free_cycles").run();
      const at = new Date("2026-09-16T00:00:00.000Z");
      const results = await Promise.all(
        Array.from({ length: 6 }, () => orderAllowance(env.DB, "u-a", at)),
      );
      expect(new Set(results.map((result) => result!.cycle!.id)).size).toBe(1);
      expect(
        await env.DB.prepare(
          "SELECT count(*) AS n FROM free_cycles WHERE workspace_id = 'w-a'",
        ).first(),
      ).toEqual({ n: 1 });
      await unlockOrders(env.DB, "u-a", ["o-a"], false, "production", at);
      const id = results[0]!.cycle!.id;
      for (const change of [
        "used = 0",
        "quota = 10",
        "starts_at = '2026-09-15T00:00:00.000Z'",
        "ends_at = '2026-09-30T00:00:00.000Z'",
        "workspace_id = 'w-b'",
      ])
        await expect(
          env.DB.prepare(`UPDATE free_cycles SET ${change} WHERE id = ?`).bind(id).run(),
        ).rejects.toThrow("immutable_cycle");
      for (const anchor of [null, "2026-09-16T00:00:00.000Z"])
        await expect(
          env.DB.prepare("UPDATE workspaces SET free_cycle_anchor_at = ? WHERE id = 'w-a'")
            .bind(anchor)
            .run(),
        ).rejects.toThrow("immutable_cycle_anchor");
      // Una promozione nuova non tocca il ciclo già creato.
      await promotion("tardiva", "2026-09-14T00:00:00.000Z", "2026-09-30T00:00:00.000Z").run();
      expect((await orderAllowance(env.DB, "u-a", at))!.cycle).toMatchObject({
        id,
        quota: 5,
        used: 1,
      });
    });

    it("rifiuta promozioni sovrapposte o con intervalli invalidi", async () => {
      await promotion("prima", "2026-09-15T00:00:00.000Z", "2026-09-29T00:00:00.000Z").run();
      await promotion("seguente", "2026-09-29T00:00:00.000Z", "2026-10-06T00:00:00.000Z").run();
      await expect(
        promotion("doppia", "2026-09-28T00:00:00.000Z", "2026-10-01T00:00:00.000Z").run(),
      ).rejects.toThrow("overlapping_promotion");
      await expect(
        env.DB.prepare(
          `UPDATE free_promotions SET ends_at = '2026-09-30T00:00:00.000Z',
            updated_at = '2026-09-20T00:00:00.000Z' WHERE id = 'prima'`,
        ).run(),
      ).rejects.toThrow("overlapping_promotion");
      for (const [startsAt, endsAt, quota] of [
        ["2026-11-02T00:00:00.000Z", "2026-11-01T00:00:00.000Z", 10],
        ["non una data", "2026-11-01T00:00:00.000Z", 10],
        ["2026-11-01T00:00:00.000Z", "2026-11-02T00:00:00.000Z", 0],
      ] as const)
        await expect(promotion("invalida", startsAt, endsAt, quota).run()).rejects.toThrow(
          "CHECK constraint failed",
        );
    });
  });

  it("mantiene senza apertura i dati acquisiti in Premium, esclude quelli tardivi e rispetta le revoche indipendenti", async () => {
    await seed();
    const end = "2026-09-14T00:00:00.000Z";
    await env.DB.batch([
      insertEntitlement({ id: "paid", source: "premium", endsAt: end }),
      insertEntitlement({ id: "gift", source: "admin", endsAt: end }),
    ]);
    expect((await orderAllowance(env.DB, "u-a"))?.remaining).toBeNull();
    const later = new Date("2026-09-14T00:01:00.000Z");
    expect((await listVisibleOrders(env.DB, "u-a", 50, "production", later))[0]?.fiscalState).toBe(
      "available",
    );
    expect((await orderAllowance(env.DB, "u-a", later))?.remaining).toBe(1);
    await insertTaxIdentifiers({
      id: "later-identifier",
      orderId: "o-a",
      type: "VATIN",
      value: "AGGIORNATO",
      observedAt: later.toISOString(),
    }).run();
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
    await insertEntitlement({ id: "trial", source: "trial", endsAt: end }).run();
    await insertTaxIdentifiers({
      id: "late-tax",
      orderId: "late",
      type: "VAT_ID",
      value: "TARDIVO",
      observedAt: end,
    }).run();
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
    await insertEntitlement({
      id: "future",
      source: "premium",
      startsAt: "2026-09-14T00:00:00.000Z",
      endsAt: "2026-09-15T00:00:00.000Z",
    }).run();
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
    await insertEntitlement({
      id: "later",
      source: "premium",
      startsAt: "2026-09-14T00:00:00.000Z",
      endsAt: "2026-09-15T00:00:00.000Z",
    }).run();
    await unlockOrders(env.DB, "u-a", ["o-a"], false, "production", new Date(now));
    expect(await env.DB.prepare("SELECT used FROM free_cycles WHERE id = 'c-a'").first()).toEqual({
      used: 1,
    });
  });

  it("usa la disponibilità storica effettiva anche per coperture future, senza diritti retroattivi", async () => {
    await seed();
    const starts = "2026-09-14T00:00:00.000Z";
    const ends = "2026-09-15T00:00:00.000Z";
    await insertEntitlement({
      id: "scheduled",
      source: "premium",
      startsAt: starts,
      endsAt: ends,
    }).run();
    expect((await listVisibleOrders(env.DB, "u-a"))[0]?.fiscalState).toBe("locked");
    await env.DB.prepare("UPDATE tax_identifiers SET removed_at = ? WHERE order_id = 'o-a'")
      .bind(now)
      .run();
    await insertTaxIdentifiers({
      id: "after-scheduled",
      orderId: "o-a",
      type: "VAT_ID",
      value: "DOPO",
      observedAt: ends,
    }).run();
    const later = new Date("2026-09-16T00:00:00.000Z");
    expect((await listVisibleOrders(env.DB, "u-a", 50, "production", later))[0]?.fiscalState).toBe(
      "locked",
    );
    await insertTaxIdentifiers({
      id: "historical",
      orderId: "o-a",
      type: "VAT_ID",
      value: "DURANTE",
      observedAt: "2026-09-14T01:00:00.000Z",
      removedAt: "2026-09-14T02:00:00.000Z",
    }).run();
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
    await insertEntitlement({
      id: "refunded",
      source: "premium",
      endsAt: "2026-09-14T00:00:00.000Z",
    }).run();
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
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO lifetime_allocations (slot, workspace_id, status, activated_at, created_at)
        VALUES (1, 'w-a', 'active', ?1, ?1)`).bind(now),
      insertEntitlement({ id: "live", source: "lifetime", stripeCheckoutSessionId: "cs_live" }),
    ]);
    await insertTaxIdentifiers({
      id: "during",
      orderId: "o-a",
      type: "VAT_ID",
      value: "DURANTE",
    }).run();
    expect((await listVisibleOrders(env.DB, "u-a"))[0]?.fiscalState).toBe("available");
    await env.DB.prepare(`INSERT INTO orders (id, store_id, ebay_order_id, creation_time, last_modified_time, currency, total_minor)
      VALUES ('final', 's-a', 'final', ?1, ?1, 'EUR', 100)`)
      .bind(now)
      .run();
    await env.DB.prepare("UPDATE orders SET merged_into = 'final' WHERE id = 'o-a'").run();
    await insertTaxIdentifiers({
      id: "final-tax",
      orderId: "final",
      type: "VAT_ID",
      value: "DURANTE",
    }).run();
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
    await insertTaxIdentifiers({
      id: "t-a3",
      orderId: "o-a2",
      type: "VAT_ID",
      value: "01234567890",
    }).run();
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

    // Il rifiuto del database arriva tradotto, senza testo SQL.
    const refused = unlockOrders(env.DB, "u-a", ["o-b"]);
    await expect(refused).rejects.toBeInstanceOf(UnlockError);
    await expect(refused).rejects.toMatchObject({
      name: "UnlockError",
      code: "order_not_available",
      message: "order_not_available",
    });

    const cycle = await env.DB.prepare(
      "SELECT used, quota FROM free_cycles WHERE id = 'c-a'",
    ).first<{ used: number; quota: number }>();
    expect(cycle).toEqual({ used: 0, quota: 1 });
  });

  it("traduce ogni rifiuto del database nel suo codice e lascia invariati gli altri errori", async () => {
    await seed();
    let failure: unknown;
    const db = new Proxy(env.DB, {
      get(target, key) {
        if (key === "batch") return () => Promise.reject(failure);
        const value: unknown = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    const refusal = (error: unknown) => {
      failure = error;
      return unlockOrders(db, "u-a", ["o-a"]);
    };
    for (const code of [
      "order_not_available",
      "order_not_in_workspace",
      "free_quota_exhausted",
      "tax_data_unavailable",
      "invalid_grant_cycle",
      "order_already_granted_or_merged",
    ])
      await expect(
        refusal(
          new Error(`D1_ERROR: ${code}: SQLITE_CONSTRAINT (extended: SQLITE_CONSTRAINT_TRIGGER)`),
        ),
      ).rejects.toMatchObject({ code });
    // Senza trigger restano i vincoli della tabella, anche come causa dell'errore ricevuto.
    await expect(
      refusal(
        new Error("D1_ERROR", {
          cause: new Error("NOT NULL constraint failed: order_grants.order_id: SQLITE_CONSTRAINT"),
        }),
      ),
    ).rejects.toMatchObject({ code: "order_not_in_workspace" });
    await expect(
      refusal(
        new Error(
          "D1_ERROR: UNIQUE constraint failed: order_grants.workspace_id, order_grants.order_id",
        ),
      ),
    ).rejects.toMatchObject({ code: "order_already_granted" });
    const other = new Error("D1_ERROR: database unavailable");
    await expect(refusal(other)).rejects.toBe(other);
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
    await insertTaxIdentifiers({
      id: "t-new",
      orderId: "o-a",
      type: "VAT_ID",
      value: "01234567890",
    }).run();
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
      "INSERT INTO lifetime_allocations (slot, workspace_id, status, expires_at, created_at) VALUES (20, 'w-a', 'reserved', ?1, ?1)",
    )
      .bind(now)
      .run();
    await expect(
      env.DB.prepare(
        "INSERT INTO lifetime_allocations (slot, workspace_id, status, expires_at, created_at) VALUES (20, 'w-b', 'reserved', ?1, ?1)",
      )
        .bind(now)
        .run(),
    ).rejects.toThrow();
    await expect(
      env.DB.prepare(
        "INSERT INTO lifetime_allocations (slot, workspace_id, status, expires_at, created_at) VALUES (21, 'w-b', 'reserved', ?1, ?1)",
      )
        .bind(now)
        .run(),
    ).rejects.toThrow();
    await expect(
      env.DB.prepare(
        "INSERT INTO lifetime_allocations (slot, workspace_id, status, expires_at, created_at) VALUES (19, 'w-a', 'reserved', ?1, ?1)",
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
        "INSERT INTO lifetime_allocations (slot, workspace_id, status, expires_at, created_at) VALUES (20, 'w-a', 'reserved', ?1, ?1)",
      )
        .bind(now)
        .run(),
      env.DB.prepare(
        "INSERT INTO lifetime_allocations (slot, workspace_id, status, expires_at, created_at) VALUES (20, 'w-b', 'reserved', ?1, ?1)",
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

  it("non libera un posto lifetime attivo e lega il diritto a un posto dello spazio", async () => {
    await seed();
    const allocation = (status: string, expires: string | null, activated: string | null) =>
      env.DB.prepare(`INSERT INTO lifetime_allocations
        (slot, workspace_id, status, expires_at, activated_at, created_at)
        VALUES (1, 'w-a', ?, ?, ?, ?)`).bind(status, expires, activated, now);
    const lifetime = (
      id: string,
      [stripeCheckoutSessionId, grantedBy, grantReason]: Array<string | null> = [
        `cs_${id}`,
        null,
        null,
      ],
    ) =>
      insertEntitlement({
        id,
        source: "lifetime",
        stripeCheckoutSessionId,
        grantedBy,
        grantReason,
      });
    // Una prenotazione scade con la sua sessione; un posto attivo ha l'istante di attivazione.
    await expect(allocation("reserved", null, null).run()).rejects.toThrow(
      "invalid_lifetime_allocation",
    );
    await expect(allocation("active", null, null).run()).rejects.toThrow(
      "invalid_lifetime_allocation",
    );
    await expect(lifetime("senza-posto").run()).rejects.toThrow("lifetime_not_allocated");
    await allocation("reserved", now, null).run();
    await expect(lifetime("prenotato").run()).rejects.toThrow("lifetime_not_allocated");
    await env.DB.prepare(
      "UPDATE lifetime_allocations SET status = 'active', activated_at = ?, expires_at = NULL",
    )
      .bind(now)
      .run();
    // Senza sessione pagata, oppure autore e motivo dell'omaggio, il diritto non nasce.
    for (const proof of [
      [null, null, null],
      [null, "owner", null],
      [null, " ", "Omaggio"],
    ] as const)
      await expect(lifetime("senza-prova", [...proof]).run()).rejects.toThrow(
        "lifetime_without_proof",
      );
    await lifetime("attivo").run();
    await expect(lifetime("secondo").run()).rejects.toThrow();
    // Un posto attivo non si libera né cambia, anche dopo un rimborso.
    for (const change of [
      "DELETE FROM lifetime_allocations",
      "UPDATE lifetime_allocations SET status = 'reserved'",
      "UPDATE lifetime_allocations SET workspace_id = 'w-b'",
      "UPDATE lifetime_allocations SET slot = 2",
    ])
      await expect(env.DB.prepare(change).run()).rejects.toThrow("immutable_lifetime_allocation");
    // La cancellazione dello spazio lascia il posto occupato, senza spazio.
    await env.DB.prepare("DELETE FROM workspaces WHERE id = 'w-a'").run();
    expect(
      await env.DB.prepare("SELECT slot, workspace_id, status FROM lifetime_allocations").first(),
    ).toEqual({ slot: 1, workspace_id: null, status: "active" });
  });
});
