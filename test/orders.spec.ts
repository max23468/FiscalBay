import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import features from "../app/components/orders/motion-features";
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
  startTrial,
  trialDays,
} from "../app/domain/grants.server";
import {
  listVisibleOrders,
  orderCriteria,
  orderView,
  visibleOrderFacets,
  type VisibleOrder,
} from "../app/domain/orders.server";
import { completeRegistration } from "../app/domain/registration.server";
import { indexOrderSearch } from "../app/domain/maintenance.server";
import { createAuth } from "../app/auth.server";
import { action as unlockAction, loader as loadHome } from "../app/routes/orders";
import { action as orderSearch } from "../app/routes/order-search";
import type { SearchResults } from "../app/components/shell-search";
import { loader as loadAccess } from "../app/routes/sign-in";
import { action as securityAction, loader as loadSettings } from "../app/routes/settings";
import { action as storesAction, loader as loadStores } from "../app/routes/stores";
import { action as startStoreLink } from "../app/routes/store-link";
import { listNotifications } from "../app/domain/notifications.server";
import { ebayOutage, listStores } from "../app/domain/stores.server";
import {
  insertStore,
  insertTaxIdentifiers,
  now,
  resetDatabase,
  seed,
} from "./fixtures/database-fixtures";
import { syntheticProfile, verifiedSession } from "./fixtures/account-fixtures";
import { displayTaxValue } from "../app/tax-quality";
import { fiscalSituation, itemPrice } from "../app/view-models";
import { addressRows, formatDate } from "../app/format";
import {
  addressCase,
  buyerNameView,
  contactsView,
  emailView,
  mailtoHref,
  phoneView,
} from "../app/contact";
import { billingCopyText, missingContact } from "../app/components/orders/labels";
import { appCopy } from "../app/app-copy";
import { settle } from "../app/settle.server";
import { requestOrderRead } from "../app/domain/order-sync.server";
import { exportHref, exportReturnHref, exportScope } from "../app/orders/export-scope";
import { loader as loadArea } from "../app/routes/account";

/** Shell dell'area reale, dal loader della layout route di Ordini, Negozi e Impostazioni. */
async function areaShell(cookie: string, path = "/app/impostazioni") {
  const loaded = await loadArea({
    params: {},
    request: new Request(`http://localhost:5173${path}`, { headers: { cookie } }),
  } as Parameters<typeof loadArea>[0]);
  return loaded.shell;
}

beforeEach(resetDatabase);
afterEach(() => vi.useRealTimers());

/** Ricerca della barra superiore come la invia il browser: query nel corpo, mai nell'URL. */
function searchRequest(
  cookie: string | null,
  query: string,
  options: { origin?: string; json?: boolean; environment?: string } = {},
) {
  return orderSearch({
    request: new Request(
      `http://localhost:5173/api/v1/orders/search${options.environment ? `?environment=${options.environment}` : ""}`,
      {
        method: "POST",
        headers: {
          ...(cookie ? { cookie } : {}),
          origin: options.origin ?? "http://localhost:5173",
          ...(options.json === false ? {} : { accept: "application/json" }),
        },
        body: new URLSearchParams({ q: query, language: "it" }),
      },
    ),
  } as Parameters<typeof orderSearch>[0]);
}

async function searchOrders(cookie: string, query: string): Promise<SearchResults> {
  return (await (await searchRequest(cookie, query)).json()) as SearchResults;
}

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

    const authenticated = await loadHome({
      params: {},
      request: new Request("http://localhost:5173/app/ordini", { headers: { cookie: cookie! } }),
    } as Parameters<typeof loadHome>[0]);
    expect(authenticated.verified).toBe(true);
    expect(authenticated.page?.orders.map(({ ebayOrderId }) => ebayOrderId)).toEqual(["ebay-a"]);
    // La ricerca considera solo i valori autorizzati: un codice da sbloccare non trova l'ordine,
    // né fra i suggerimenti né nell'elenco, e non compare nell'indirizzo.
    const guess = await searchOrders(cookie!, "RSSMRA80A01H501U");
    expect(guess).toMatchObject({ items: [], total: 0 });
    expect(guess.href).not.toContain("RSSMRA80A01H501U");
    const guessed = await loadHome({
      params: {},
      request: new Request(`http://localhost:5173${guess.href}`, {
        headers: { cookie: cookie! },
      }),
    } as Parameters<typeof loadHome>[0]);
    expect(guessed.page).toMatchObject({ search: "RSSMRA80A01H501U", orders: [], total: 0 });
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
    // Un guasto che non è un rifiuto dello sblocco resta un errore della pagina (500). I primi
    // batch della richiesta riallineano il piano e registrano l'attività, il terzo è lo sblocco.
    const batch = env.DB.batch.bind(env.DB);
    const outage = vi
      .spyOn(env.DB, "batch")
      .mockImplementationOnce(batch)
      .mockImplementationOnce(batch)
      .mockRejectedValueOnce(new Error("D1_ERROR: guasto"));
    await expect(unlockAction(unlockRequest("o-a"))).rejects.toThrow("D1_ERROR: guasto");
    outage.mockRestore();
    expect(await unlockConfirmation(env.DB, user!.id)).toBe(true);
    await expect(
      unlockAction(unlockRequest("o-a", "https://estraneo.invalid")),
    ).rejects.toMatchObject({ status: 403 });
    expect(await unlockAction(unlockRequest("o-a"))).toEqual({ unlocked: ["o-a"], remaining: 0 });
    expect(await unlockConfirmation(env.DB, user!.id)).toBe(false);
    // In Piano e pagamenti la conferma si riattiva e si disattiva dallo stesso interruttore.
    const toggle = (value: string) =>
      securityAction({
        request: new Request("http://localhost:5173/app/impostazioni/piano", {
          method: "POST",
          headers: { cookie: cookie!, origin: "http://localhost:5173" },
          body: new URLSearchParams({ intent: "save", name: "unlock-confirmation", value }),
        }),
      } as Parameters<typeof securityAction>[0]);
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
    await env.DB.batch([
      env.DB.prepare("INSERT INTO workspaces (id, name, created_at) VALUES ('w-c', 'C', ?)").bind(
        now,
      ),
      env.DB.prepare(
        "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ('w-c', 'u-c', 'owner')",
      ),
    ]);
    expect(await orderAllowance(env.DB, "u-c")).toMatchObject({ cycle: null, remaining: 0 });
    await env.DB.prepare("DELETE FROM free_cycles WHERE workspace_id = 'w-a'").run();
    expect(
      (await orderAllowance(env.DB, "u-a", new Date("2026-09-21T20:00:00.000Z")))?.cycle?.ends_at,
    ).toBe("2026-09-27T20:00:00.000Z");
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
    await env.DB.prepare(`INSERT INTO workspace_entitlements (id, workspace_id, source, starts_at, ends_at)
      VALUES ('trial', 'w-a', 'trial', ?1, ?2)`)
      .bind(now, end)
      .run();
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
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO lifetime_allocations (slot, workspace_id, status, activated_at, created_at)
        VALUES (1, 'w-a', 'active', ?1, ?1)`).bind(now),
      env.DB.prepare(`INSERT INTO workspace_entitlements (id, workspace_id, source, starts_at, ends_at,
          stripe_checkout_session_id) VALUES ('live', 'w-a', 'lifetime', ?, NULL, 'cs_live')`).bind(
        now,
      ),
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
      proof: [string | null, string | null, string | null] = [`cs_${id}`, null, null],
    ) =>
      env.DB.prepare(`INSERT INTO workspace_entitlements (id, workspace_id, source, starts_at,
          stripe_checkout_session_id, granted_by, grant_reason) VALUES (?, 'w-a', 'lifetime', ?, ?, ?, ?)`).bind(
        id,
        now,
        ...proof,
      );
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

describe("prova Premium", () => {
  const origin = "http://localhost:5173";
  const day = 24 * 60 * 60 * 1000;
  const at = (offset: number) => new Date(Date.parse(now) + offset);
  /** Prima lettura riuscita di un negozio dello spazio, anche senza ordini. */
  const synced = (store = "s-a") =>
    env.DB.prepare(
      "INSERT INTO sync_state (store_id, last_success_at, updated_at) VALUES (?1, ?2, ?2)",
    )
      .bind(store, now)
      .run();
  const entitlements = async (workspace = "w-a") =>
    (
      await env.DB.prepare(
        "SELECT source, starts_at, ends_at FROM workspace_entitlements WHERE workspace_id = ?",
      )
        .bind(workspace)
        .all()
    ).results;

  it("si attiva solo dopo la prima lettura riuscita, dura 14 giorni e non si ripete", async () => {
    await seed();
    expect(await orderAllowance(env.DB, "u-a")).toMatchObject({ trialAvailable: false });
    expect(await startTrial(env.DB, "u-a")).toBeNull();
    expect(await entitlements()).toEqual([]);
    await synced();
    // Il negozio letto non ha ancora ordini da mostrare: la prova è comunque disponibile.
    await env.DB.prepare("DELETE FROM orders WHERE store_id = 's-a'").run();
    expect(await orderAllowance(env.DB, "u-a")).toMatchObject({
      premium: false,
      coverage: null,
      trialAvailable: true,
    });
    const ends = at(trialDays * day).toISOString();
    expect(await startTrial(env.DB, "u-a")).toBe(ends);
    expect(await entitlements()).toEqual([{ source: "trial", starts_at: now, ends_at: ends }]);
    // Nessun abbonamento, pagamento o sblocco nasce dalla sola prova.
    expect(await env.DB.prepare("SELECT count(*) AS n FROM order_grants").first()).toEqual({
      n: 0,
    });
    expect(await orderAllowance(env.DB, "u-a")).toMatchObject({
      premium: true,
      coverage: { source: "trial", endsAt: ends },
      trialAvailable: false,
      remaining: null,
    });
    expect(await startTrial(env.DB, "u-a", at(day))).toBeNull();
    // Lo scollegamento non ferma né sposta la prova.
    await env.DB.prepare("DELETE FROM ebay_stores WHERE id = 's-a'").run();
    expect((await orderAllowance(env.DB, "u-a", at(trialDays * day - 1)))?.coverage).toEqual({
      source: "trial",
      endsAt: ends,
    });
    // Alla scadenza torna il Free, e la prova resta usata anche se revocata.
    expect(await orderAllowance(env.DB, "u-a", at(trialDays * day))).toMatchObject({
      premium: false,
      coverage: null,
      trialAvailable: false,
    });
    await env.DB.prepare("UPDATE workspace_entitlements SET revoked_at = ?").bind(now).run();
    await insertStore({ id: "s-c", ebayUserId: "e-c" }).run();
    await synced("s-c");
    expect(await startTrial(env.DB, "u-a", at(20 * day))).toBeNull();
    await expect(
      env.DB.prepare(`INSERT INTO workspace_entitlements (id, workspace_id, source, starts_at, ends_at)
        VALUES ('seconda', 'w-a', 'trial', ?1, ?2)`)
        .bind(at(20 * day).toISOString(), at(34 * day).toISOString())
        .run(),
    ).rejects.toThrow("UNIQUE");
  });

  it("richieste concorrenti attivano una sola prova per spazio", async () => {
    await seed();
    await synced();
    const started = await Promise.all(Array.from({ length: 6 }, () => startTrial(env.DB, "u-a")));
    expect(started.filter(Boolean)).toHaveLength(1);
    expect(await entitlements()).toHaveLength(1);
    // Lo spazio di un altro utente non riceve né consuma nulla.
    expect(await entitlements("w-b")).toEqual([]);
    expect(await startTrial(env.DB, "u-sconosciuto")).toBeNull();
  });

  it("non si offre con un'altra copertura in corso, e dopo la sua fine sì", async () => {
    await seed();
    await synced();
    await env.DB.prepare(`INSERT INTO workspace_entitlements (id, workspace_id, source, starts_at, ends_at)
      VALUES ('pagato', 'w-a', 'premium', ?1, ?2), ('omaggio', 'w-a', 'admin', ?1, ?3)`)
      .bind(now, at(3 * day).toISOString(), at(2 * day).toISOString())
      .run();
    // Fra più coperture conta quella diversa dalla prova che dura di più.
    expect((await orderAllowance(env.DB, "u-a"))?.coverage).toEqual({
      source: "premium",
      endsAt: at(3 * day).toISOString(),
    });
    expect((await orderAllowance(env.DB, "u-a"))?.trialAvailable).toBe(false);
    expect(await startTrial(env.DB, "u-a")).toBeNull();
    expect(await startTrial(env.DB, "u-a", at(3 * day))).toBe(
      at((3 + trialDays) * day).toISOString(),
    );
  });

  it("dopo la prova restano i dati arrivati durante la prova, anche mai aperti, non quelli tardivi", async () => {
    await seed();
    await synced();
    const ends = (await startTrial(env.DB, "u-a"))!;
    const during = at(day);
    // Un ordine arrivato durante la prova è subito leggibile, senza sblocco né quota.
    await env.DB.prepare(`INSERT INTO orders (id, store_id, ebay_order_id, creation_time, last_modified_time, currency, total_minor)
      VALUES ('durante', 's-a', 'durante', ?1, ?1, 'EUR', 100), ('tardivo', 's-a', 'tardivo', ?1, ?1, 'EUR', 100)`)
      .bind(during.toISOString())
      .run();
    await insertTaxIdentifiers({
      id: "durante-cf",
      orderId: "durante",
      type: "CODICE_FISCALE",
      value: "RSSMRA80A01H501U",
      observedAt: during.toISOString(),
    }).run();
    await insertTaxIdentifiers({
      id: "tardivo-cf",
      orderId: "tardivo",
      type: "CODICE_FISCALE",
      value: "BNCLGU80A01H501Z",
      observedAt: ends,
    }).run();
    const after = at(trialDays * day + 1);
    const visible = await listVisibleOrders(env.DB, "u-a", 50, "production", after);
    const state = (id: string) => visible.find((order) => order.id === id)?.fiscalState;
    expect([state("o-a"), state("durante"), state("tardivo")]).toEqual([
      "available",
      "available",
      "locked",
    ]);
    expect(await env.DB.prepare("SELECT used FROM free_cycles WHERE id = 'c-a'").first()).toEqual({
      used: 0,
    });
  });

  describe("nelle pagine reali", () => {
    async function owner() {
      await seed();
      const session = await verifiedSession("prova-premium@example.invalid");
      await env.DB.prepare("UPDATE workspace_members SET user_id = ? WHERE workspace_id = 'w-a'")
        .bind(session.userId)
        .run();
      return session;
    }
    const post = (path: string, cookie: string) =>
      new Request(`${origin}${path}`, {
        method: "POST",
        headers: { cookie, origin },
        body: new URLSearchParams({ intent: "start-trial" }),
      });
    const planPage = async (cookie: string) => {
      const loaded = await loadSettings({
        request: new Request(`${origin}/app/impostazioni/piano`, { headers: { cookie } }),
        params: { sezione: "piano" },
      } as never);
      if (!("page" in loaded)) throw new Error("pagina attesa");
      return loaded.page;
    };
    const ordersPage = async (cookie: string) =>
      (
        await loadHome({
          params: {},
          request: new Request(`${origin}/app/ordini`, { headers: { cookie } }),
        } as Parameters<typeof loadHome>[0])
      ).page!;

    it("Ordini e Piano propongono la prova dopo la prima lettura e poi ne mostrano la fine", async () => {
      const { cookie } = await owner();
      expect((await ordersPage(cookie)).account).toMatchObject({
        plan: "free",
        trialAvailable: false,
      });
      expect(
        await securityAction({ request: post("/app/impostazioni/piano", cookie) } as never),
      ).toMatchObject({ init: { status: 409 }, data: { ok: false } });
      await synced();
      expect((await ordersPage(cookie)).account).toMatchObject({ trialAvailable: true });
      expect((await planPage(cookie)).account).toMatchObject({
        plan: "free",
        trialAvailable: true,
      });
      // Una richiesta da un'altra origine non attiva nulla.
      await expect(
        unlockAction({
          request: new Request(`${origin}/app/ordini`, {
            method: "POST",
            headers: { cookie, origin: "https://estraneo.invalid" },
            body: new URLSearchParams({ intent: "start-trial" }),
          }),
        } as Parameters<typeof unlockAction>[0]),
      ).rejects.toMatchObject({ status: 403 });
      expect(
        await unlockAction({ request: post("/app/ordini", cookie) } as Parameters<
          typeof unlockAction
        >[0]),
      ).toEqual({ ok: true, notice: appCopy.it.settings.plan.trialStarted });
      const ends = at(trialDays * day).toISOString();
      const orders = await ordersPage(cookie);
      expect(orders.account).toEqual({
        plan: "premium",
        trialAvailable: false,
        trial: { endsAt: ends },
      });
      // Con la prova il Codice Fiscale è leggibile senza sblocco.
      expect(orders.orders[0]?.fiscal.state).toBe("available");
      expect((await planPage(cookie)).account).toMatchObject({
        plan: "premium",
        trialAvailable: false,
        trial: { endsAt: ends },
        quota: undefined,
      });
      // Dalla seconda scheda la prova già attiva non riparte.
      expect(
        await securityAction({ request: post("/app/impostazioni/piano", cookie) } as never),
      ).toMatchObject({
        init: { status: 409 },
        data: { ok: false, notice: appCopy.it.settings.plan.trialUnavailable },
      });
      expect(await entitlements()).toHaveLength(1);
    });
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

  /** Premium concesso allo spazio A: tutti i suoi negozi sono ammessi. */
  async function premiumCoverage() {
    await env.DB.prepare(
      `INSERT INTO workspace_entitlements (id, workspace_id, source, starts_at, ends_at)
       VALUES ('concessione', 'w-a', 'admin', '2026-01-01T00:00:00.000Z', '2027-12-31T00:00:00.000Z')`,
    ).run();
  }

  function ordersPage(cookie: string, path = "/app/ordini", params: { ordine?: string } = {}) {
    return loadHome({
      params,
      request: new Request(`${origin}${path}`, { headers: { cookie } }),
    } as Parameters<typeof loadHome>[0]);
  }

  /** Elenco con la ricerca indicata, dall'indirizzo che restituisce la barra superiore. */
  async function searchedPage(cookie: string, query: string, params = "") {
    const { href } = await searchOrders(cookie, query);
    return ordersPage(cookie, params ? `${href}&${params}` : href);
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
      // L'acquisto è configurato: gli sblocchi esauriti rimandano al piano.
      settings: true,
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
    expect((await searchedPage(cookie, "RSSMRA80A01H501U")).page!.orders).toEqual([]);
    expect(
      (await ordersPage(cookie, "/app/ordini?fiscale=locked")).page!.orders.map(({ id }) => id),
    ).toEqual(["o-a"]);
    await unlockOrders(env.DB, userId, ["o-a"]);
    const found = await searchedPage(cookie, "RSSMRA80A01H501U");
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
    expect((await searchedPage(cookie, "RSSMRA80A01H501U")).page!.total).toBe(1);
    // L'esito del collegamento nell'indirizzo non diventa un filtro per negozio.
    expect(
      (await ordersPage(cookie, "/app/ordini?negozio=collegato")).page!.orders.map(({ id }) => id),
    ).toEqual(["o-a"]);
    // Un negozio fuori dai filtrabili, anche di un altro spazio, vale come «Tutti».
    expect(
      (await ordersPage(cookie, "/app/ordini?negozio=s-b")).page!.orders.map(({ id }) => id),
    ).toEqual(["o-a"]);
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
    // Lo stato fiscale filtrato in SQL coincide con quello della vista per ogni ordine.
    for (const order of all.orders)
      expect(await ids(`fiscale=${fiscalSituation(order.fiscal)}&mostra=2`)).toContain(order.id);
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
    // Il marketplace non è un filtro: il parametro non restringe l'elenco.
    expect(await ids("marketplace=EBAY_DE&mostra=2")).toHaveLength(8);
    expect(await ids("periodo=7")).toEqual(["o-a", "x-paid", "x-unpaid", "x-partial"]);
    // In Free il periodo di 90 giorni vale come «Tutti», come nell'interfaccia.
    expect((await ordersPage(cookie, "/app/ordini?periodo=90")).page!.total).toBe(8);
    expect(await ids("pagamento=sconosciuto&negozio=s-a&fiscale=missing")).toEqual([
      "x-paid",
      "x-missing",
    ]);
    // La ricerca combina le parole su numero, acquirente, articoli e SKU.
    const searched = async (query: string, params = "") =>
      (await searchedPage(cookie, query, params)).page!.orders.map(({ id }) => id);
    expect(await searched("giulia sku-ricerca")).toEqual(["x-paid"]);
    expect(await searched("LAMPADA")).toEqual(["x-paid"]);
    expect(await searched("utente-x-unpaid")).toEqual(["x-unpaid"]);
    expect(await searched("ebay-b")).toEqual([]);
    // La ricerca si combina con i filtri e una query nell'indirizzo non filtra.
    expect(await searched("utente", "pagamento=paid")).toEqual([
      "x-paid",
      "x-checking",
      "x-missing",
    ]);
    expect((await ordersPage(cookie, "/app/ordini?q=lampada")).page!.total).toBe(8);
    // «Carica altri» amplia la pagina letta dal server finché restano ordini.
    const first = (await ordersPage(cookie)).page!;
    expect({ shown: first.orders.length, total: first.total }).toEqual({ shown: 6, total: 8 });
    expect(first.nextHref).toBe(`/app/ordini?mostra=2&vista=${first.snapshot}`);
    expect(all.nextHref).toBeNull();
    const filtered = (await ordersPage(cookie, "/app/ordini?pagamento=paid&negozio=collegato"))
      .page!;
    expect(filtered).toMatchObject({ total: 3, nextHref: null });
    void userId;
  });

  it("«Carica altri» resta sull'istantanea e i nuovi ordini entrano soltanto in cima", async () => {
    const { cookie } = await owner();
    const day = 86_400_000;
    const insert = (id: string, age: number, listedAt: string | null) =>
      env.DB.prepare(
        `INSERT INTO orders (id, store_id, ebay_order_id, creation_time, last_modified_time, currency,
           total_minor, payment_status, listed_at)
         VALUES (?1, 's-a', ?1, ?2, ?2, 'EUR', 100, 'PAID', ?3)`,
      ).bind(id, new Date(Date.parse(now) - age * day).toISOString(), listedAt);
    // Ordini letti prima che l'ingresso negli elenchi fosse registrato: valgono come presenti.
    await env.DB.batch([1, 2, 3, 4, 5, 6, 7].map((age) => insert(`x-${age}`, age + 0.5, null)));
    const listed = async (path: string) => (await ordersPage(cookie, path)).page!;
    const first = await listed("/app/ordini");
    expect(first).toMatchObject({ total: 8, incoming: 0, freshHref: null, limited: false });
    expect(first.snapshot).toMatch(/^[0-9a-z]+$/u);
    const opened = new Date(Number.parseInt(first.snapshot, 36));
    // Dopo l'apertura arrivano un ordine recente e uno vecchio, letti dallo storico.
    vi.setSystemTime(opened.getTime() + 60_000);
    const later = new Date(opened.getTime() + 1).toISOString();
    await env.DB.batch([insert("x-nuovo", 0, later), insert("x-storico", 3, later)]);
    // La pagina successiva continua dall'istantanea: nessun ordine si inserisce fra i già letti.
    const second = await listed(first.nextHref!);
    expect(second.orders.map(({ id }) => id)).toEqual([
      "o-a",
      "x-1",
      "x-2",
      "x-3",
      "x-4",
      "x-5",
      "x-6",
      "x-7",
    ]);
    expect(second).toMatchObject({
      total: 8,
      snapshot: first.snapshot,
      nextHref: null,
      incoming: 2,
      // La nuova istantanea conserva le pagine caricate.
      freshHref: "/app/ordini?mostra=2",
      // L'ordine dello storico finirebbe fra quelli già letti: resta all'indicatore.
      incomingAtTop: false,
    });
    // Anche i filtri contano i nuovi ordini con gli stessi criteri.
    expect(await listed(`/app/ordini?periodo=7&vista=${first.snapshot}`)).toMatchObject({
      total: 7,
      incoming: 2,
    });
    expect(await listed(`/app/ordini?pagamento=unpaid&vista=${first.snapshot}`)).toMatchObject({
      incoming: 0,
      freshHref: null,
    });
    // Il dettaglio di un ordine nuovo si apre anche sull'istantanea precedente.
    expect(
      (
        await ordersPage(cookie, `/app/ordini/x-nuovo?vista=${first.snapshot}`, {
          ordine: "x-nuovo",
        })
      ).page!.detail?.id,
    ).toBe("x-nuovo");
    const fresh = await listed(second.freshHref!);
    expect(fresh.orders.map(({ id }) => id).slice(0, 5)).toEqual([
      "x-nuovo",
      "o-a",
      "x-1",
      "x-2",
      "x-storico",
    ]);
    expect(fresh).toMatchObject({ total: 10, incoming: 0, incomingAtTop: false });
    expect(fresh.snapshot > first.snapshot).toBe(true);
    // Un ordine più recente del primo mostrato entra da solo in cima.
    const reopened = new Date(Number.parseInt(fresh.snapshot, 36));
    vi.setSystemTime(reopened.getTime() + 60_000);
    await env.DB.batch([insert("x-ultimo", 0, new Date(reopened.getTime() + 1).toISOString())]);
    expect(await listed(`/app/ordini?vista=${fresh.snapshot}`)).toMatchObject({
      incoming: 1,
      incomingAtTop: true,
    });
    // Un cursore alterato o futuro non va oltre l'istante della richiesta.
    expect(await listed("/app/ordini?vista=zzzzzzzzzz")).toMatchObject({ total: 11, incoming: 0 });
    expect(await listed("/app/ordini?vista=..")).toMatchObject({ total: 11, incoming: 0 });
  });

  it("un nuovo accesso riapre soltanto il negozio ricordato, se ancora fra i filtri", async () => {
    const { cookie } = await owner();
    const remembered = `${cookie}; fiscalbay-negozio=s-c`;
    const entry = (sessionCookie: string, path = "/app/ordini") =>
      ordersPage(sessionCookie, path).catch((response: Response) => response);
    // Con un solo negozio il filtro non compare: il negozio ricordato non si applica.
    expect(await entry(remembered)).toMatchObject({ page: expect.any(Object) });
    // Con Premium anche il secondo negozio è fra i filtri; nel Free resterebbe in pausa.
    await premiumCoverage();
    await insertStore({ id: "s-c", ebayUserId: "e-c" }).run();
    const redirected = (await entry(remembered)) as Response;
    expect(redirected.status).toBe(302);
    expect(redirected.headers.get("location")).toBe("/app/ordini?negozio=s-c");
    // Con un indirizzo già scelto, o un negozio di un altro spazio, l'elenco resta com'è.
    expect(await entry(remembered, "/app/ordini?periodo=7")).toMatchObject({
      page: expect.any(Object),
    });
    expect(await entry(`${cookie}; fiscalbay-negozio=s-b`)).toMatchObject({
      page: expect.any(Object),
    });
    expect(await entry(`${cookie}; fiscalbay-negozio=%E0%A4%A`)).toMatchObject({
      page: expect.any(Object),
    });
  });

  it("con Auth o database non disponibili risponde 503 senza dati", async () => {
    const { cookie } = await owner();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const prepare = vi.spyOn(env.DB, "prepare").mockImplementation(() => {
      throw new Error("D1_ERROR: unavailable");
    });
    try {
      expect(await ordersPage(cookie).catch((error: unknown) => error)).toMatchObject({
        data: null,
        init: { status: 503, headers: { "retry-after": "60" } },
      });
      expect(JSON.parse(String(log.mock.calls[0]![0]))).toMatchObject({
        code: "UPSTREAM_UNAVAILABLE",
        operation: "route",
      });
    } finally {
      prepare.mockRestore();
    }
    // Anche una lettura che non riesce dopo quella dell'account non mostra dati né l'errore
    // imprevisto: Negozi e ordini si leggono in lotto.
    const batch = vi.spyOn(env.DB, "batch").mockRejectedValue(new Error("D1_ERROR: unavailable"));
    try {
      expect(await ordersPage(cookie).catch((error: unknown) => error)).toMatchObject({
        data: null,
        init: { status: 503, headers: { "retry-after": "60" } },
      });
    } finally {
      batch.mockRestore();
      log.mockRestore();
    }
  });

  it("con le letture ferme segnala eBay o il solo negozio, con l'ultimo aggiornamento", async () => {
    const { cookie, userId } = await owner();
    await withCredentials();
    const synced = "2026-09-13T21:00:00.000Z";
    /** Letture dei recenti del negozio, dalla più recente, e ultima lettura riuscita. */
    const reads = async (store: string, outcomes: boolean[], success: string | null = synced) => {
      await env.DB.prepare("DELETE FROM sync_runs WHERE store_id = ?").bind(store).run();
      await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO sync_state (store_id, last_success_at, updated_at) VALUES (?1, ?2, ?3)
           ON CONFLICT(store_id) DO UPDATE SET last_success_at = excluded.last_success_at`,
        ).bind(store, success, now),
        ...outcomes.map((ok, index) =>
          env.DB.prepare(
            "INSERT INTO sync_runs (store_id, started_at, ok, new_orders) VALUES (?, ?, ?, 0)",
          ).bind(store, `2026-09-14T0${9 - index}:00:00.000Z`, ok ? 1 : 0),
        ),
      ]);
    };
    const notices = async (path = "/app/ordini") =>
      (await ordersPage(cookie, path)).page!.notices.filter(
        (notice) => notice.kind === "ebay-down" || notice.kind === "store-read-failed",
      );
    const bell = async () =>
      ((await areaShell(cookie, "/app/ordini")).notifications ?? []).map((item) => item.id);
    const storesDown = async () =>
      (
        await loadStores({
          request: new Request(`${origin}/app/negozi`, { headers: { cookie } }),
          params: {},
        } as Parameters<typeof loadStores>[0])
      ).data.page.ebayDown;

    // Un errore isolato non basta: la lettura successiva di solito riesce.
    await reads("s-a", [false, true]);
    expect(await notices()).toEqual([]);
    expect(await bell()).toEqual([]);
    expect(await storesDown()).toEqual([]);

    // Tutti i negozi attivi non riescono a leggere: eBay non risponde.
    await reads("s-a", [false, false, true]);
    expect(await notices()).toEqual([{ kind: "ebay-down", at: synced }]);
    expect(await storesDown()).toEqual(["production"]);
    // Un solo problema nella campanella, come nell'anteprima, e la nuova lettura resta sospesa.
    expect(await bell()).toEqual([`ebay-down:${synced}`]);
    await env.DB.batch([
      env.DB.prepare("DELETE FROM tax_identifiers WHERE order_id = 'o-a'"),
      env.DB.prepare(
        `INSERT INTO order_source_refs (store_id, source, external_order_id, order_id, last_modified_time,
           detail_for, detail_error, detail_attempts)
         VALUES ('s-a', 'fulfillment', 'ebay-a', 'o-a', ?1, ?1, 'unavailable', 5)`,
      ).bind(now),
    ]);
    const send = vi.spyOn(env.WORK_QUEUE, "send").mockResolvedValue(undefined);
    expect(await ordersAction(cookie, { intent: "retry", order: "o-a" })).toMatchObject({
      data: { ok: false, notice: appCopy.it.stores.ebayDown },
      init: { status: 409 },
    });
    // Anche Sincronizza, Reimporta e Ricollega restano sospese sul server.
    for (const intent of ["store-sync", "store-reimport"])
      expect(
        await storesAction({
          request: new Request(`${origin}/app/negozi`, {
            method: "POST",
            headers: { cookie, origin },
            body: new URLSearchParams({ intent, store: "s-a" }),
          }),
        } as Parameters<typeof storesAction>[0]),
      ).toMatchObject({
        data: { ok: false, notice: appCopy.it.stores.ebayDown },
        init: { status: 409 },
      });
    const reconnect = (await startStoreLink({
      request: new Request(`${origin}/app/negozi/collega`, {
        method: "POST",
        headers: { cookie, origin },
        body: new URLSearchParams({ negozio: "s-a", da: "negozi" }),
      }),
    } as Parameters<typeof startStoreLink>[0])) as Response;
    expect(reconnect.status).toBe(303);
    expect(reconnect.headers.get("location")).toBe("/app/negozi?negozio=ebay-non-risponde");
    expect(send).not.toHaveBeenCalled();
    send.mockRestore();
    // Un negozio Sandbox che legge non cambia l'indisponibilità di Production, e viceversa.
    await insertStore({ id: "s-sb", ebayUserId: "e-sb", environment: "sandbox" }).run();
    await env.DB.prepare(
      `INSERT INTO ebay_store_credentials (store_id, access_token, access_expires_at, refresh_token, refresh_expires_at, granted_at)
       VALUES ('s-sb', 'a', '2026-09-14T00:00:00.000Z', 'r', '2027-09-13T00:00:00.000Z', ?)`,
    )
      .bind(now)
      .run();
    await reads("s-sb", [true, true]);
    expect(await storesDown()).toEqual(["production"]);
    expect(await bell()).toEqual([`ebay-down:${synced}`]);
    await env.DB.prepare("DELETE FROM ebay_stores WHERE id = 's-sb'").run();

    // Con un altro negozio che legge, il problema resta del solo negozio, finché è nella vista.
    // Con Premium il secondo negozio è ammesso; nel Free resterebbe in pausa.
    await premiumCoverage();
    await insertStore({ id: "s-c", ebayUserId: "e-c" }).run();
    await env.DB.prepare(
      `INSERT INTO ebay_store_credentials (store_id, access_token, access_expires_at, refresh_token, refresh_expires_at, granted_at)
       VALUES ('s-c', 'a', '2026-09-14T00:00:00.000Z', 'r', '2027-09-13T00:00:00.000Z', ?)`,
    )
      .bind(now)
      .run();
    await reads("s-c", [true, true]);
    const failed = { kind: "store-read-failed", storeId: "s-a", storeName: "e-a", at: synced };
    expect(await notices()).toEqual([failed]);
    expect(await notices("/app/ordini?negozio=s-a")).toEqual([failed]);
    expect(await notices("/app/ordini?negozio=s-c")).toEqual([]);
    expect(await storesDown()).toEqual([]);
    expect(await bell()).toEqual([`store-read-failed:s-a:${synced}`]);

    // Un negozio in pausa non legge eBay: non conta per l'indisponibilità né per gli avvisi.
    await env.DB.prepare(
      "INSERT INTO ebay_store_pauses (store_id, reason, paused_at) VALUES ('s-c', 'manual', ?)",
    )
      .bind(now)
      .run();
    expect(await notices()).toEqual([{ kind: "ebay-down", at: synced }]);

    // La prima lettura riuscita chiude il problema, anche nella campanella. Le letture fallite
    // di un negozio poi messo in pausa non lo segnalano.
    await reads("s-a", [true, false, false]);
    await reads("s-c", [false, false]);
    expect(await notices()).toEqual([]);
    expect(await bell()).toEqual([]);

    // Con più negozi fermi vale l'aggiornamento riuscito più recente; senza nessuno, nessun orario.
    await env.DB.prepare("DELETE FROM ebay_store_pauses WHERE store_id = 's-c'").run();
    await reads("s-a", [false, false]);
    await reads("s-c", [false, false], "2026-09-13T20:30:00.000Z");
    expect(await notices()).toEqual([{ kind: "ebay-down", at: synced }]);
    await reads("s-a", [false, false], null);
    await reads("s-c", [false, false], null);
    expect(await notices()).toEqual([{ kind: "ebay-down", at: null }]);
    expect(await bell()).toEqual(["ebay-down:never"]);
    // Oltre i trenta giorni della campanella il problema resta soltanto negli avvisi.
    const later = new Date(Date.parse("2026-09-14T08:00:00.000Z") + 31 * 86_400_000);
    const statuses = await listStores(env.DB, userId, later);
    expect(await listNotifications(env.DB, userId, statuses, "it", "Europe/Rome", later)).toEqual(
      [],
    );
    expect(ebayOutage(statuses)).not.toBeNull();
  });

  it("la barra superiore cerca con la query nel corpo e l'elenco la riceve cifrata", async () => {
    const { cookie, userId } = await owner();
    await expect(
      searchRequest(cookie, "articolo", { origin: "https://estraneo.invalid" }),
    ).rejects.toMatchObject({ status: 403 });
    // Senza sessione la richiesta del browser riceve un errore, il modulo l'accesso.
    const anonymous = await searchRequest(null, "articolo");
    expect(anonymous.status).toBe(401);
    expect(await anonymous.json()).toMatchObject({ code: "AUTH_REQUIRED" });
    await expect(searchRequest(null, "articolo", { json: false })).rejects.toMatchObject({
      status: 302,
    });

    const found = await searchOrders(cookie, "  ARTICOLO a  ");
    expect(found.href).toMatch(/^\/app\/ordini\?ricerca=[\w-]+$/u);
    expect(found).toEqual({
      items: [
        {
          id: "o-a",
          ebayOrderId: "ebay-a",
          buyerName: "",
          detail: "Articolo A",
          href: `/app/ordini/o-a${found.href.slice("/app/ordini".length)}`,
        },
      ],
      total: 1,
      href: found.href,
    });
    // Un modulo inviato senza JavaScript apre l'elenco; la query non è mai nell'indirizzo.
    const submitted = await searchRequest(cookie, "ARTICOLO a", { json: false });
    expect(submitted.status).toBe(303);
    expect(submitted.headers.get("location")).toMatch(/^\/app\/ordini\?ricerca=[\w-]+$/u);
    expect(submitted.headers.get("location")?.toLowerCase()).not.toContain("articolo");
    expect(await searchOrders(cookie, "   ")).toEqual({ items: [], total: 0, href: "/app/ordini" });

    // La presentazione del nome non riscrive la fonte né cambia lo username di ripiego.
    for (const [buyer, display] of [
      [{ name: "  MARIO ROSSI  ", username: "BUYER_TEST" }, "Mario Rossi"],
      [{ name: null, username: "BUYER_TEST" }, "BUYER_TEST"],
    ] as const) {
      await env.DB.prepare("UPDATE orders SET buyer_json = ? WHERE id = 'o-a'")
        .bind(JSON.stringify(buyer))
        .run();
      expect((await searchOrders(cookie, "articolo a")).items[0]?.buyerName).toBe(display);
      expect(
        await env.DB.prepare("SELECT buyer_json FROM orders WHERE id = 'o-a'").first("buyer_json"),
      ).toBe(JSON.stringify(buyer));
    }

    // L'elenco decifra la ricerca della propria sessione e la conserva con filtri e pagine.
    const listed = (await ordersPage(cookie, `${found.href}&fiscale=locked`)).page!;
    expect(listed).toMatchObject({ search: "ARTICOLO a", total: 1 });
    // Alterata, oppure in un'altra sessione dello stesso utente, la ricerca si dimentica.
    expect((await ordersPage(cookie, `${found.href}x`)).page!.search).toBeNull();
    const signIn = await createAuth(env).handler(
      new Request("http://localhost:5173/api/auth/sign-in/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "pagina-ordini@example.invalid",
          password: "Una-password-negozio-molto-lunga",
        }),
      }),
    );
    const other = (await ordersPage(signIn.headers.get("set-cookie")!, found.href)).page!;
    expect(other).toMatchObject({ search: null, total: 1 });
    void userId;
  });

  it("confronta maiuscole e accenti di ogni alfabeto dopo l'indicizzazione", async () => {
    const { cookie } = await owner();
    await env.DB.prepare("UPDATE orders SET buyer_json = ? WHERE id = 'o-a'")
      .bind(JSON.stringify({ name: "ÖZTÜRK Lucía", username: "oz_lucia" }))
      .run();
    // Prima dell'indicizzazione valgono le sole minuscole ASCII di SQLite.
    expect((await searchOrders(cookie, "öztürk")).total).toBe(0);
    expect((await searchOrders(cookie, "oz_lucia")).total).toBe(1);
    expect(await indexOrderSearch(env.DB)).toBeGreaterThan(0);
    expect(await indexOrderSearch(env.DB)).toBe(0);
    const row = await env.DB.prepare("SELECT search_text FROM orders WHERE id = 'o-a'").first();
    expect(row).toEqual({
      search_text: "ebay-a ozturk lucia oz_lucia articolo a sku-a articolo b ",
    });
    for (const query of ["Öztürk", "ozturk LUCÍA", "lucia sku-a"])
      expect((await searchOrders(cookie, query)).total).toBe(1);
    expect((await searchedPage(cookie, "ÖZTÜRK")).page!.orders.map(({ id }) => id)).toEqual([
      "o-a",
    ]);
  });

  it("«Non pagato» mostra anche gli acquisti provvisori, senza sblocco né suggerimenti", async () => {
    const { cookie } = await owner();
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO orders (id, store_id, ebay_order_id, creation_time, last_modified_time, currency,
           total_minor, is_provisional, payment_status, buyer_json)
         VALUES ('x-prov', 's-a', 'x-prov', ?1, ?1, 'EUR', 100, 1, 'PENDING', '{"username":"carrello"}')`,
      ).bind(now),
      insertTaxIdentifiers({
        id: "t-prov",
        orderId: "x-prov",
        type: "CODICE_FISCALE",
        country: "IT",
        value: "VRDGLI80A41H501X",
        source: "ebay_trading_get_orders",
      }),
    ]);
    const ids = async (query: string) =>
      (await ordersPage(cookie, `/app/ordini?${query}`)).page!.orders.map(({ id }) => id);
    expect(await ids("")).toEqual(["o-a"]);
    expect((await ordersPage(cookie)).page!.total).toBe(1);
    expect(await ids("pagamento=unpaid")).toEqual(["x-prov"]);
    expect((await searchOrders(cookie, "carrello")).total).toBe(0);
    // Il dettaglio si apre dal filtro; lo sblocco attende il pagamento.
    const opened = await ordersPage(cookie, "/app/ordini/x-prov?pagamento=unpaid", {
      ordine: "x-prov",
    });
    expect(opened.page!.detail).toMatchObject({
      id: "x-prov",
      fiscal: { state: "locked", shownAs: "CF", hold: "unpaid" },
      suggestions: [],
    });
    expect(await ordersPage(cookie, "/app/ordini/x-prov", { ordine: "x-prov" })).toMatchObject({
      init: { status: 404 },
    });
    // Una lettura non riuscita dell'acquisto si può riprovare dal filtro che lo mostra.
    await env.DB.prepare("DELETE FROM tax_identifiers WHERE order_id = 'x-prov'").run();
    await withCredentials();
    const send = vi.spyOn(env.WORK_QUEUE, "send").mockResolvedValue(undefined);
    try {
      expect(await ordersAction(cookie, { intent: "retry", order: "x-prov" })).toEqual({
        ok: true,
        notice: "Nuova lettura richiesta.",
      });
    } finally {
      send.mockRestore();
    }
  });

  it("distingue l'acquirente estero dal dato non riportato da eBay", async () => {
    const { cookie } = await owner();
    const buyer = (country: string) =>
      JSON.stringify({
        name: "Lucía Martín",
        billingAddress: { addressLine1: "Calle Mayor 10", city: "Madrid", countryCode: country },
      });
    await env.DB.batch(
      [
        ["x-es", buyer("ES"), "absent"],
        ["x-es-masked", buyer("ES"), "masked"],
        ["x-it", buyer("IT"), "absent"],
        ["x-none", "{}", "not_included"],
      ].flatMap(([id, json, availability], index) => [
        env.DB.prepare(
          `INSERT INTO orders (id, store_id, ebay_order_id, creation_time, last_modified_time, currency,
             total_minor, payment_status, buyer_json)
           VALUES (?1, 's-a', ?1, ?2, ?2, 'EUR', 100, 'PAID', ?3)`,
        ).bind(id, new Date(Date.parse(now) - (index + 1) * 60_000).toISOString(), json),
        env.DB.prepare(
          `INSERT INTO order_tax_checks (order_id, source, observed_at, availability)
           VALUES (?1, 'ebay_fulfillment', ?2, ?3)`,
        ).bind(id, now, availability),
      ]),
    );
    const page = async (query: string) => (await ordersPage(cookie, `/app/ordini?${query}`)).page!;
    expect((await page("fiscale=foreign")).orders.map(({ id }) => id)).toEqual(["x-es"]);
    expect((await page("fiscale=missing")).orders.map(({ id }) => id)).toEqual([
      "x-es-masked",
      "x-it",
      "x-none",
    ]);
    const all = await page("mostra=2");
    expect(
      Object.fromEntries(all.orders.map((order) => [order.id, fiscalSituation(order.fiscal)])),
    ).toEqual({
      "o-a": "locked",
      "x-es": "foreign",
      "x-es-masked": "missing",
      "x-it": "missing",
      "x-none": "missing",
    });
    // Con Premium anche l'acquirente estero riceve la ricerca dei suggerimenti.
    await env.DB.prepare(`INSERT INTO workspace_entitlements (id, workspace_id, source, starts_at, ends_at)
      VALUES ('foreign-premium', 'w-a', 'premium', ?, '2099-01-01T00:00:00.000Z')`)
      .bind(now)
      .run();
    expect((await page("mostra=2")).orders.find(({ id }) => id === "x-es")).toMatchObject({
      fiscal: { state: "missing", reason: "foreign", country: "ES" },
      suggestionStatus: "identity_missing",
    });
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
    expect(
      await env.DB.prepare(
        "SELECT detail_for, detail_error, detail_attempts FROM order_source_refs WHERE order_id = 'o-a'",
      ).first(),
    ).toEqual({ detail_for: now, detail_error: "unavailable", detail_attempts: 5 });
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
    // Un ordine con dati da sbloccare non si rilegge, anche con un consenso valido.
    expect(await requestOrderRead(env, userId, "o-a", "production")).toBe("invalid");
    expect(send).not.toHaveBeenCalled();
    await env.DB.batch([
      // Senza dato e senza verifica la lettura risulta non riuscita.
      env.DB.prepare("DELETE FROM tax_identifiers WHERE order_id = 'o-a'"),
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
    expect(await requestOrderRead(env, userId, "o-b", "production")).toBe("not_found");
    // Neppure un ordine del proprio negozio fuori conservazione o in un altro ambiente.
    const expired = new Date("2026-11-01T00:00:00.000Z");
    expect(await requestOrderRead(env, userId, "o-a", "production", expired)).toBe("not_found");
    expect(await requestOrderRead(env, userId, "o-a", "sandbox")).toBe("not_found");
    expect((await tradingState()).results[0]).toMatchObject({ trading_cursor: now });
    expect(await requestOrderRead(env, userId, "o-a", "production")).toBe("queued");
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
    expect(await requestOrderRead(env, userId, "o-a", "production")).toBe("queued");
    expect((await tradingState()).results[0]).toMatchObject({ trading_cursor: now });
    expect(
      await env.DB.prepare(
        "SELECT detail_for FROM order_source_refs WHERE source = 'fulfillment'",
      ).first(),
    ).toEqual({ detail_for: null });
    send.mockRestore();
  });

  it("non riprende la lettura di un ordine il cui negozio esce dallo spazio durante la richiesta", async () => {
    const { userId } = await owner();
    const send = vi.spyOn(env.WORK_QUEUE, "send").mockResolvedValue(undefined);
    await withCredentials();
    await env.DB.batch([
      env.DB.prepare("DELETE FROM tax_identifiers WHERE order_id = 'o-a'"),
      env.DB.prepare(
        `INSERT INTO order_source_refs (store_id, source, external_order_id, order_id, last_modified_time,
           detail_for, detail_error, detail_attempts)
         VALUES ('s-a', 'fulfillment', 'ebay-a', 'o-a', ?1, ?1, 'unavailable', 5)`,
      ).bind(now),
    ]);
    // L'appartenenza cessa tra la verifica dell'ordine e la richiesta di lettura del negozio.
    const database = new Proxy(env.DB, {
      get(target, key) {
        const value = Reflect.get(target, key) as unknown;
        if (key !== "prepare") return typeof value === "function" ? value.bind(target) : value;
        return (query: string) =>
          query.includes("LEFT JOIN ebay_store_credentials c")
            ? {
                bind: (...values: unknown[]) => ({
                  first: async () => {
                    await target
                      .prepare("DELETE FROM workspace_members WHERE user_id = ?")
                      .bind(userId)
                      .run();
                    return target
                      .prepare(query)
                      .bind(...values)
                      .first();
                  },
                }),
              }
            : target.prepare(query);
      },
    });
    expect(
      await requestOrderRead({ ...env, DB: database } as Env, userId, "o-a", "production"),
    ).toBe("not_found");
    expect(send).not.toHaveBeenCalled();
    expect(
      await env.DB.prepare(
        "SELECT detail_for, detail_error, detail_attempts FROM order_source_refs WHERE order_id = 'o-a'",
      ).first(),
    ).toEqual({ detail_for: now, detail_error: "unavailable", detail_attempts: 5 });
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

  it("collega l'inserzione soltanto da un'identità di riga che inizia con il suo ID", () => {
    const listing = (stableKey: string | null) =>
      view({
        summary: {
          ...base.summary,
          lineItems: [
            {
              lineItemId: "riga",
              title: "Articolo",
              quantity: 1,
              sku: null,
              totalMinor: null,
              currency: null,
              imageUrl: null,
              stableKey,
            },
          ],
        },
      }).items[0]!.listingId;
    expect(listing("110000000099-9001")).toBe("110000000099");
    expect(listing("123456-1")).toBe("123456");
    expect(listing("1234567890123456789-1")).toBe("1234567890123456789");
    // Troppe o troppo poche cifre, un prefisso estraneo o il trattino mancante non sono un ID.
    expect(listing("12345-1")).toBeNull();
    expect(listing("12345678901234567890-1")).toBeNull();
    expect(listing("x110000000099-1")).toBeNull();
    expect(listing("110000000099")).toBeNull();
    expect(listing("11000a000099-1")).toBeNull();
    expect(listing(null)).toBeNull();
  });

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
    const foreign = { fiscalState: "foreign", taxAvailability: "not_included" } as const;
    expect(view({ ...foreign, summary: billedIn("ES") }).fiscal).toEqual({
      state: "missing",
      reason: "foreign",
      country: "ES",
    });
    expect(
      view({ fiscalState: "missing", taxAvailability: "not_included", summary: billedIn("IT") })
        .fiscal,
    ).toEqual({ state: "missing" });
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
      updatedAt: now,
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
    // Un indirizzo parziale conserva i campi disponibili senza dedurre quelli assenti.
    for (const billing of [
      { ...address, city: null },
      { ...address, countryCode: null },
      { ...address, addressLine1: null },
    ])
      expect(
        view({ summary: summary({ buyer: buyer({ billingAddress: billing }) }) }).billingAddress,
      ).not.toBeNull();
    expect(
      view({
        summary: summary({
          buyer: buyer({ billingAddress: { ...address, city: null, countryCode: null } }),
        }),
      }).billingAddress,
    ).toMatchObject({ line: "Via Roma 1", city: "", countryCode: "" });
    expect(
      view({
        summary: summary({
          buyer: buyer({
            billingAddress: { ...address, addressLine1: "  ", city: " ", countryCode: "  " },
          }),
        }),
      }).billingAddress,
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

  it("formatta telefono, email e indirizzo senza correggere il dato di eBay", () => {
    // Telefono: prefisso dal Paese quando manca, cellulari italiani raggruppati.
    expect(phoneView("3331234567", "IT")).toEqual({
      display: "+39 333 123 4567",
      international: "+393331234567",
    });
    expect(phoneView("0039 333.123.4567", null)?.international).toBe("+393331234567");
    expect(phoneView("+39 (0)2 1234 5678", null)).toEqual({
      display: "+39 02 1234 5678",
      international: "+390212345678",
    });
    // In Italia lo zero del fisso resta; altrove si toglie quello nazionale.
    expect(phoneView("02 1234567", "IT")?.international).toBe("+39021234567");
    expect(phoneView("030 1234567", "DE")).toEqual({
      display: "+49 301234567",
      international: "+49301234567",
    });
    expect(phoneView("+49 000 1000013", null)?.display).toBe("+49 000 1000013");
    // Un valore non riconosciuto non diventa un collegamento.
    for (const [raw, country] of [
      ["interno 14", "IT"],
      ["3331234567", null],
      ["3331234567", "JP"],
      ["+12345", null],
      ["+0123456789", null],
    ] as const)
      expect(phoneView(raw, country)).toBeNull();
    // Email: dominio in minuscolo, alias eBay riconosciuto.
    expect(emailView("  Mario.Rossi@Esempio.INVALID ")).toEqual({
      address: "Mario.Rossi@esempio.invalid",
      relay: false,
    });
    expect(emailView("c3f0a1b2@members.ebay.invalid")).toEqual({
      address: "c3f0a1b2@members.ebay.invalid",
      relay: true,
    });
    expect(emailView("acquisti@notebay.invalid")?.relay).toBe(false);
    for (const raw of ["mario rossi@esempio.invalid", "@esempio.invalid", "mario@", "mario"])
      expect(emailView(raw)).toBeNull();
    // Un `?` o un `&` della fonte restano nell'indirizzo e non aggiungono campi.
    const tricky = emailView("a?subject=Ciao&body=x@esempio.invalid")!;
    expect(mailtoHref(tricky.address)).toBe("mailto:a%3Fsubject%3DCiao%26body%3Dx@esempio.invalid");
    expect(
      mailtoHref("mario.rossi@esempio.invalid", { subject: "CF ordine", body: "Ciao & grazie" }),
    ).toBe("mailto:mario.rossi@esempio.invalid?subject=CF%20ordine&body=Ciao%20%26%20grazie");
    // Indirizzo: maiuscolo e minuscolo uniformi, grafia mista ed estera conservate.
    expect(addressCase("VIA DELL'ORTO 12B")).toBe("Via dell'Orto 12B");
    expect(addressCase("SANT'ANGELO LODIGIANO")).toBe("Sant'Angelo Lodigiano");
    expect(addressCase("VIA XX SETTEMBRE 14, C/O ROSSI SNC")).toBe(
      "Via XX Settembre 14, c/o Rossi SNC",
    );
    expect(addressCase("PIAZZA DI SPAGNA E DEI MILLE")).toBe("Piazza di Spagna e dei Mille");
    // Soltanto numeri romani ben formati restano maiuscoli.
    expect(addressCase("LOCALITÀ IL PRATO 3")).toBe("Località Il Prato 3");
    expect(addressCase("VIA LI MADOU, VIA MILL 2")).toBe("Via Li Madou, Via Mill 2");
    expect(addressCase("VIA PIO IX 4, VIA XXIV MAGGIO")).toBe("Via Pio IX 4, Via XXIV Maggio");
    expect(addressCase("DI FRONTE ALLA STAZIONE")).toBe("Di Fronte alla Stazione");
    expect(addressCase("Via del Corso 1")).toBe("Via del Corso 1");
    expect(addressCase("12345")).toBe("12345");
    expect(addressCase("  via   dell’orto 12B ")).toBe("Via dell’Orto 12B");
    expect(addressCase("via xx settembre 14, c/o rossi snc")).toBe(
      "Via XX Settembre 14, c/o Rossi SNC",
    );
    expect(addressCase("via alla stazione 12a")).toBe("Via alla Stazione 12a");
    expect(addressCase("Via McDonald 12B")).toBe("Via McDonald 12B");
    expect(addressCase("HAUPTSTRASSE 12", "DE")).toBe("HAUPTSTRASSE 12");
    expect(addressCase("ΑΘΗΝΑ", "GR")).toBe("ΑΘΗΝΑ");
    for (const name of [
      "ACME SRL",
      "ACME S.R.L.",
      "ACME SPA",
      "ACME SNC",
      "ACME SAS",
      "ACME SRLS",
      "eBay Italia",
      "McDonald",
      "Maria de la Cruz",
      "M*** R***",
      "M••• R•••",
      "M… R…",
      "ROSSI 123",
    ])
      expect(buyerNameView(`  ${name}  `)).toBe(name);
    for (const [raw, formatted] of [
      ["MARIO ROSSI", "Mario Rossi"],
      ["mario rossi", "Mario Rossi"],
      ["  MARIO\n  DI ROSA  ", "Mario Di Rosa"],
      ["MARIA DELL'ORTO", "Maria Dell'Orto"],
      ["anna d’angelo", "Anna D’Angelo"],
      ["JEAN-PIERRE DUPONT", "Jean-Pierre Dupont"],
      ["JOSÉ ÁLVAREZ", "José Álvarez"],
      ["li wei", "Li Wei"],
      ["LUCA DE LUCA", "Luca De Luca"],
    ])
      expect(buyerNameView(raw!)).toBe(formatted);
    expect(buyerNameView(" Mario\n Rossi ")).toBe("Mario Rossi");
    expect(buyerNameView("  ")).toBeNull();
    expect(buyerNameView(null)).toBeNull();
    for (const raw of ["333..1234567", "333***4567", "1234567", "+44 (0)20 1234 5678"])
      expect(phoneView(raw, "IT")).toBeNull();
    expect(emailView("mario@rossi@example.invalid")).toBeNull();
    expect(emailView("m***@example.invalid")).toBeNull();
    const original = {
      phone: "3331234567",
      email: null,
      shipTo: null,
      billingAddress: {
        line: "  via roma 12B  ",
        postalCode: " 00100 ",
        city: " roma ",
        province: " rm ",
        countryCode: " it ",
      },
    };
    const formatted = contactsView(original);
    expect(addressRows(formatted.billingAddress!, "it")).toEqual([
      "Via Roma 12B",
      "00100 Roma (RM)",
      "Italia",
    ]);
    expect(original.billingAddress.line).toBe("  via roma 12B  ");
    const foreign = contactsView({
      ...original,
      billingAddress: {
        ...original.billingAddress,
        line: "  Calle   Mayor 1 ",
        city: "Madrid",
        province: "Comunidad de Madrid",
        countryCode: "ES",
      },
    });
    expect(foreign.billingAddress?.province).toBe("Comunidad de Madrid");
    expect(
      addressRows(
        {
          ...formatted.billingAddress!,
          line: "",
          city: "",
          province: null,
          countryCode: "",
          postalCode: "00100",
        },
        "en",
      ),
    ).toEqual(["00100"]);
  });

  it("distingue campi mascherati e assenti e copia soltanto i dati fiscali accessibili", () => {
    const masked = view({
      summary: {
        ...base.summary,
        buyer: {
          username: null,
          name: null,
          phone: null,
          email: null,
          billingAddress: null,
          shipTo: null,
          masked: ["name", "phone", "email", "billingAddress.addressLine1", "shipTo.name"],
        },
      },
    });
    expect(masked.maskedContacts).toEqual([
      "name",
      "email",
      "phone",
      "billingAddress",
      "recipient",
    ]);
    expect(missingContact(masked, "email", appCopy.it)).toBe("Mascherato da eBay");
    expect(missingContact(view({}), "email", appCopy.en)).toBe("Not provided by eBay");
    expect(billingCopyText(masked, "it", appCopy.it)).toBe("");
    const onlyEmailMasked = view({
      summary: {
        ...base.summary,
        buyer: {
          ...base.summary.buyer!,
          name: null,
          phone: null,
          email: null,
          shipTo: null,
          masked: ["email"],
        },
      },
    });
    expect(onlyEmailMasked.maskedContacts).toEqual(["email"]);
    const recipientPhoneMasked = view({
      summary: {
        ...base.summary,
        buyer: {
          ...base.summary.buyer!,
          phone: null,
          shipTo: { name: "Mario", phone: null, address: null },
          masked: ["shipTo.phone"],
        },
      },
    });
    expect(recipientPhoneMasked.maskedContacts).toEqual(["phone"]);
    const historical = view({
      summary: {
        ...base.summary,
        buyer: {
          ...base.summary.buyer!,
          name: "Mario Rossi",
          phone: null,
          email: "buyer@example.invalid",
          masked: ["name", "email", "phone", "shipTo.name"],
          shipTo: { name: "Mario", phone: "3331234567", address: null },
        },
      },
    });
    expect(historical.maskedContacts).toEqual([]);
    const order = {
      ...historical,
      buyerName: "  MARIO   ROSSI  ",
      contacts: {
        ...historical.contacts,
        billingAddress: {
          line: "Via Roma 1",
          postalCode: "00100",
          city: "Roma",
          province: "RM",
          countryCode: "IT",
        },
      },
    };
    const prefix = "Mario Rossi\nVia Roma 1\n00100 Roma (RM)\nItalia";
    expect(billingCopyText(order, "it", appCopy.it)).toBe(prefix);
    for (const state of ["checking", "error", "missing"] as const)
      expect(billingCopyText({ ...order, fiscal: { state } }, "it", appCopy.it)).toBe(prefix);
    const available = {
      ...order,
      fiscal: {
        state: "available" as const,
        identifiers: [
          { type: "CF" as const, value: "rss mra80a01 h501u", quality: "valid" as const },
          { type: "PIVA" as const, value: " 12345 678901", quality: "unchecked" as const },
          {
            type: "OTHER" as const,
            typeLabel: "NIF",
            value: "123x",
            quality: "unchecked" as const,
          },
        ],
      },
    };
    expect(billingCopyText(available, "it", appCopy.it)).toBe(
      `${prefix}\nCodice Fiscale: RSSMRA80A01H501U\nPartita IVA: 12345678901\nNIF: 123x`,
    );
    expect(billingCopyText(available, "en", appCopy.en)).toContain(
      "Italy\nCodice Fiscale: RSSMRA80A01H501U",
    );
    expect(
      billingCopyText(
        { ...order, buyerName: null, contacts: { ...order.contacts, billingAddress: null } },
        "it",
        appCopy.it,
      ),
    ).toBe("");
  });

  it("legge i criteri dell'indirizzo con i soli valori previsti", () => {
    const at = new Date(now);
    const criteria = (query: string, plan: "free" | "premium" = "free", search?: string) =>
      orderCriteria(new URLSearchParams(query), at, plan, search);
    expect(criteria("")).toEqual({
      storeId: undefined,
      since: undefined,
      payment: undefined,
      shipping: undefined,
      fiscal: undefined,
      tokens: undefined,
    });
    expect(
      criteria("negozio=s-a&periodo=7&pagamento=paid&spedizione=in_progress&fiscale=locked"),
    ).toEqual({
      storeId: "s-a",
      since: new Date(at.getTime() - 7 * 86_400_000).toISOString(),
      payment: "paid",
      shipping: "in_progress",
      fiscal: "locked",
      tokens: undefined,
    });
    expect(criteria("periodo=30").since).toBe(
      new Date(at.getTime() - 30 * 86_400_000).toISOString(),
    );
    // Oltre i 30 giorni i periodi sono Premium; un valore sconosciuto vale come «Tutti».
    for (const period of ["90", "6m", "12m"])
      expect(criteria(`periodo=${period}`).since).toBeUndefined();
    for (const days of [7, 30])
      expect(criteria(`periodo=${days}`, "premium").since).toBe(
        new Date(at.getTime() - days * 86_400_000).toISOString(),
      );
    expect(criteria("periodo=90", "premium").since).toBe(
      new Date(at.getTime() - 90 * 86_400_000).toISOString(),
    );
    // I mesi sono di calendario, come l'anno dello storico Premium.
    expect(criteria("periodo=6m", "premium").since).toBe("2026-03-13T20:00:00.000Z");
    expect(criteria("periodo=12m", "premium").since).toBe("2025-09-13T20:00:00.000Z");
    expect(criteria("periodo=12", "premium").since).toBeUndefined();
    expect(criteria("periodo=1&pagamento=delivered&spedizione=x&fiscale=x")).toMatchObject({
      since: undefined,
      payment: undefined,
      shipping: undefined,
      fiscal: undefined,
    });
    // Ricerca già decifrata, divisa sugli spazi nella forma di confronto, al massimo dieci
    // parole; una query nell'indirizzo non conta.
    expect(criteria("", "free", " Giulia\t SKU-A  ").tokens).toEqual(["giulia", "sku-a"]);
    expect(criteria("", "free", "ÖZTÜRK Lucía").tokens).toEqual(["ozturk", "lucia"]);
    expect(criteria("q=giulia").tokens).toBeUndefined();
    expect(criteria("", "free", "   ").tokens).toBeUndefined();
    expect(
      criteria("", "free", Array.from({ length: 12 }, (_, i) => `p${i}`).join(" ")).tokens,
    ).toHaveLength(10);
    expect(criteria("fiscale=foreign").fiscal).toBe("foreign");
    // Identificativi oltre 64 caratteri non filtrano.
    expect(criteria(`negozio=${"x".repeat(64)}`).storeId).toBe("x".repeat(64));
    expect(criteria(`negozio=${"x".repeat(65)}`).storeId).toBeUndefined();
    expect(criteria("marketplace=EBAY_IT")).not.toHaveProperty("marketplace");
  });

  it("conta i dati dell'intero elenco, anche senza ordini", async () => {
    await seed();
    const at = new Date(now);
    expect(await visibleOrderFacets(env.DB, "u-a", "production", at)).toEqual({
      total: 1,
      locked: true,
    });
    await unlockOrders(env.DB, "u-a", ["o-a"]);
    expect(await visibleOrderFacets(env.DB, "u-a", "production", at)).toMatchObject({
      locked: false,
    });
    expect(await visibleOrderFacets(env.DB, "nessuno", "production", at)).toEqual({
      total: 0,
      locked: false,
    });
  });
});

describe("animazioni della lista ordini", () => {
  it("caricano dopo la pagina anche il riordino delle schede", () => {
    // `layout="position"` sulle schede richiede le funzioni di layout, assenti nel set minimo.
    expect(features).toHaveProperty("layout");
    expect(features).toHaveProperty("animation");
  });
});

describe("ambito dell'esportazione dagli Ordini", () => {
  it("porta la selezione o l'elenco filtrato e torna allo stesso elenco", () => {
    const list = new URLSearchParams("fiscale=locked&ricerca=cifrata&mostra=2&vista=abc");
    const selected = exportHref("/app/impostazioni/esportazione", list, ["o-1", "o-2"]);
    expect(selected).toBe(
      "/app/impostazioni/esportazione?fiscale=locked&ricerca=cifrata&mostra=2&vista=abc&ordini=o-1%2Co-2",
    );
    const query = new URL(selected, "https://esempio.invalid").searchParams;
    expect(exportScope(query)).toEqual({ kind: "orders", ids: ["o-1", "o-2"] });
    expect(exportReturnHref("/app/ordini", query)).toBe(
      "/app/ordini?fiscale=locked&ricerca=cifrata&mostra=2&vista=abc",
    );
    // Senza selezione valgono filtri, ricerca e istantanea; le pagine caricate non contano.
    const filtered = exportScope(new URLSearchParams(exportHref("/x", list).split("?")[1]));
    expect(filtered?.kind).toBe("filtered");
    expect(filtered?.kind === "filtered" && filtered.criteria.toString()).toBe(
      "fiscale=locked&ricerca=cifrata&vista=abc",
    );
    expect(exportHref("/x", new URLSearchParams("ordini=vecchi"))).toBe("/x");
    expect(exportScope(new URLSearchParams())).toBeNull();
    expect(exportScope(new URLSearchParams("mostra=3"))).toBeNull();
    expect(exportReturnHref("/app/ordini", new URLSearchParams("ordini=o-1"))).toBe("/app/ordini");
  });

  it("non trasforma una selezione vuota o fuori misura in tutti gli ordini", () => {
    expect(exportScope(new URLSearchParams("ordini=&fiscale=locked"))).toEqual({
      kind: "orders",
      ids: [],
    });
    const ids = [
      "o-1",
      "o-1",
      "x".repeat(129),
      "",
      ...Array.from({ length: 400 }, (_, i) => `n-${i}`),
    ];
    const scope = exportScope(new URLSearchParams({ ordini: ids.join(",") }));
    expect(scope?.kind === "orders" && scope.ids.length).toBe(300);
    expect(scope?.kind === "orders" && scope.ids.slice(0, 2)).toEqual(["o-1", "n-0"]);
  });
});
