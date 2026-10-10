import { describe, expect, it, vi } from "vitest";
import {
  buildCreationDateFilter,
  buildLastModifiedFilter,
  fulfillmentObservation,
  fulfillmentTaxIdentifiers,
  mergeFulfillmentOrders,
  parseFulfillmentPage,
  readFulfillmentOrder,
  readFulfillmentOrders,
} from "../app/integrations/ebay/fulfillment.server";
import { readTradingTaxObservation } from "../app/integrations/ebay/trading.server";
import { ebayConfiguration } from "../app/integrations/ebay/environment.server";

const configuration = ebayConfiguration(
  {
    APP_ORIGIN: "http://localhost",
    EBAY_CLIENT_ID: "sintetico",
    EBAY_CLIENT_SECRET: "sintetico",
    EBAY_RUNAME: "sintetico",
  },
  "production",
);

describe("contratto Fulfillment senza persistenza", () => {
  const created = "2026-01-01T00:00:00.000Z";
  const order = (overrides: Record<string, unknown> = {}) => ({
    orderId: "ordine",
    creationDate: created,
    lastModifiedDate: created,
    pricingSummary: { total: { value: "12.34", currency: "EUR" } },
    ...overrides,
  });
  const observe = (payload: unknown, days = 1) =>
    fulfillmentObservation(
      payload,
      new Date(Date.parse(created) + days * 86_400_000).toISOString(),
    );
  const item = (listingMarketplaceId?: string) => ({
    lineItemId: "riga",
    title: "Titolo",
    quantity: 1,
    listingMarketplaceId,
  });

  it("mappa importi esatti, buyer, destinatario e articoli, escludendo campi fiscali non richiesti", () => {
    const address = { addressLine1: "Via Sintetica", countryCode: "IT" };
    const payload = order({
      orderPaymentStatus: "PAID",
      orderFulfillmentStatus: "FULFILLED",
      cancelStatus: { cancelState: "NONE_REQUESTED" },
      buyer: {
        username: "buyer",
        taxIdentifier: { taxpayerId: "ESCLUSO" },
        buyerRegistrationAddress: {
          fullName: "Nome Buyer",
          email: "buyer@example.invalid",
          primaryPhone: { phoneNumber: "000" },
          contactAddress: address,
        },
      },
      fulfillmentStartInstructions: [
        {
          shippingStep: {
            shipTo: {
              fullName: "Nome Destinatario",
              primaryPhone: { phoneNumber: "111" },
              contactAddress: address,
            },
          },
        },
      ],
      lineItems: [
        {
          ...item("EBAY_IT"),
          legacyItemId: "legacy",
          sku: "SKU",
          lineItemCost: { value: "12.34", currency: "EUR" },
        },
      ],
    });
    const result = observe(payload, 91);
    expect(result).toEqual({
      source: "fulfillment",
      externalOrderId: "ordine",
      provisional: false,
      creationTime: created,
      lastModifiedTime: created,
      marketplaceId: "EBAY_IT",
      total: { minor: 1234, currency: "EUR" },
      paymentStatus: "PAID",
      fulfillmentStatus: "FULFILLED",
      cancelStatus: "NONE_REQUESTED",
      buyer: {
        username: "buyer",
        name: "Nome Buyer",
        email: "buyer@example.invalid",
        phone: "000",
        billingAddress: {
          addressLine1: "Via Sintetica",
          addressLine2: null,
          city: null,
          postalCode: null,
          stateOrProvince: null,
          countryCode: "IT",
        },
        shipTo: {
          name: "Nome Destinatario",
          phone: "111",
          address: {
            addressLine1: "Via Sintetica",
            addressLine2: null,
            city: null,
            postalCode: null,
            stateOrProvince: null,
            countryCode: "IT",
          },
        },
        masked: undefined,
      },
      items: [
        {
          lineItemId: "riga",
          legacyItemId: "legacy",
          stableKey: "legacy-riga",
          title: "Titolo",
          sku: "SKU",
          quantity: 1,
          total: { minor: 1234, currency: "EUR" },
        },
      ],
    });
    const empty = observe(order());
    expect(empty).toMatchObject({
      marketplaceId: null,
      paymentStatus: null,
      fulfillmentStatus: null,
      cancelStatus: null,
      items: [],
      buyer: {
        username: null,
        name: null,
        email: null,
        phone: null,
        billingAddress: null,
        shipTo: null,
      },
    });
    expect(observe(order({ lineItems: [item()] })).items[0]).toEqual({
      lineItemId: "riga",
      legacyItemId: null,
      stableKey: null,
      title: "Titolo",
      sku: null,
      quantity: 1,
      total: null,
    });
    expect(
      observe(order({ lineItems: [item("EBAY_IT"), item("EBAY_ES")] })).marketplaceId,
    ).toBeNull();
  });

  it("maschera solo campi assenti oltre le soglie, senza inventare contenitori di indirizzo", () => {
    const payload = order({
      buyer: { buyerRegistrationAddress: { contactAddress: {} } },
      fulfillmentStartInstructions: [{ shippingStep: { shipTo: { contactAddress: {} } } }],
    });
    expect(observe(payload, 14).buyer.masked).toBeUndefined();
    expect(observe(payload, 15).buyer.masked).toEqual(["email"]);
    expect(observe(payload, 90).buyer.masked).toEqual(["email"]);
    expect(observe(payload, 91).buyer.masked).toEqual([
      "email",
      "name",
      "phone",
      "billingAddress.addressLine1",
      "shipTo.name",
      "shipTo.phone",
      "shipTo.address.addressLine1",
    ]);
    expect(observe(order(), 91).buyer.masked).toEqual(["email", "name", "phone"]);
    expect(
      observe(
        order({ buyer: { buyerRegistrationAddress: {} }, fulfillmentStartInstructions: [] }),
        91,
      ).buyer.masked,
    ).toEqual(["email", "name", "phone"]);
    expect(observe(order({ fulfillmentStartInstructions: [{}] }), 91).buyer.shipTo).toBeNull();
    expect(
      observe(order({ fulfillmentStartInstructions: [{ shippingStep: { shipTo: {} } }] }), 91).buyer
        .masked,
    ).toEqual(["email", "name", "phone", "shipTo.name", "shipTo.phone"]);
  });

  it("valida le pagine e deduplica gli ordini conservando l'ultima lettura", () => {
    expect(parseFulfillmentPage({ total: 0 })).toEqual({ total: 0, orders: [] });
    for (const invalid of [
      { total: -1 },
      { total: 0, orders: [{ orderId: "" }] },
      { total: 0, next: {} },
    ])
      expect(() => parseFulfillmentPage(invalid)).toThrow();
    expect(mergeFulfillmentOrders([])).toEqual([]);
    expect(
      mergeFulfillmentOrders([
        parseFulfillmentPage({
          total: 2,
          orders: [{ orderId: "uno", marker: "prima" }, { orderId: "due" }],
        }),
        parseFulfillmentPage({ total: 1, orders: [{ orderId: "uno", marker: "ultima" }] }),
      ]),
    ).toEqual([{ orderId: "uno", marker: "ultima" }, { orderId: "due" }]);
  });

  it("costruisce filtri UTC con overlap e rifiuta intervalli invalidi", () => {
    const date = new Date(created);
    expect(buildCreationDateFilter("inizio", "fine")).toBe("creationdate:[inizio..fine]");
    expect(buildLastModifiedFilter(date, date, 1000)).toBe(
      "lastmodifieddate:[2025-12-31T23:59:59.000Z..2026-01-01T00:00:00.000Z]",
    );
    expect(buildLastModifiedFilter(date, date, 0)).toBe(
      `lastmodifieddate:[${created}..${created}]`,
    );
    for (const [start, end, overlap] of [
      [new Date(NaN), date, 0],
      [date, new Date(NaN), 0],
      [date, date, NaN],
      [date, date, -1],
      [date, new Date(0), 0],
    ] as const)
      expect(() => buildLastModifiedFilter(start, end, overlap)).toThrow(
        "Intervallo incrementale eBay non valido",
      );
  });

  it("legge filtro, limite e next solo sull'origine eBay con il token", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ total: 0 }));
    const access = { fetcher, configuration, accessToken: "token-sintetico" };
    await readFulfillmentOrders(access, { limit: 20, filter: "filtro" });
    await readFulfillmentOrders(access, { next: "/sell/fulfillment/v1/order?offset=20" });
    expect(fetcher.mock.calls.map(([url]) => String(url))).toEqual([
      "https://api.ebay.com/sell/fulfillment/v1/order?limit=20&filter=filtro",
      "https://api.ebay.com/sell/fulfillment/v1/order?offset=20",
    ]);
    expect(new Headers(fetcher.mock.calls[0]?.[1]?.headers).get("authorization")).toBe(
      "Bearer token-sintetico",
    );
    await expect(
      readFulfillmentOrders(access, { next: "https://altro.invalid/sell/fulfillment/v1/order" }),
    ).rejects.toMatchObject({ failure: "invalid_response" });
    await expect(readFulfillmentOrders(access, { next: "/ws/api.dll" })).rejects.toMatchObject({
      failure: "invalid_response",
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe("seconda osservazione fiscale Fulfillment", () => {
  const access = (fetcher: typeof fetch) => ({
    fetcher,
    accessToken: "token-sintetico",
    configuration: configuration,
  });

  it("invia TAX_BREAKDOWN e l'header solo nella lettura richiesta", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ orderId: "ordine" }));
    await readFulfillmentOrder(access(fetcher), "ordine");
    await readFulfillmentOrder(access(fetcher), "ordine", {});
    await readFulfillmentOrder(access(fetcher), "ordine", { marketplaceId: "EBAY_IT" });
    expect(
      fetcher.mock.calls.map(([url, init]) => [
        new URL(String(url)).search,
        new Headers(init?.headers).get("X-EBAY-C-MARKETPLACE-ID"),
      ]),
    ).toEqual([
      ["", null],
      ["?fieldGroups=TAX_BREAKDOWN", null],
      ["?fieldGroups=TAX_BREAKDOWN", "EBAY_IT"],
    ]);
    expect(
      fetcher.mock.calls.map(([url, init]) => [
        new URL(String(url)).pathname,
        new Headers(init?.headers).get("authorization"),
      ]),
    ).toEqual(
      Array.from({ length: 3 }, () => [
        "/sell/fulfillment/v1/order/ordine",
        "Bearer token-sintetico",
      ]),
    );
    await expect(
      readFulfillmentOrder(access(fetcher), "ordine", { marketplaceId: "EBAY_IT\r\nsecret" }),
    ).rejects.toThrow();
    await expect(
      readFulfillmentOrder(access(fetcher), "ordine", { marketplaceId: "xEBAY_IT" }),
    ).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("legge solo buyer.taxIdentifier con provenienza, senza rimozione autorevole", () => {
    expect(
      fulfillmentTaxIdentifiers({
        buyer: {
          taxIdentifier: {
            taxpayerId: " SINTETICO ",
            taxIdentifierType: " CODICE_FISCALE ",
            issuingCountry: "IT",
          },
        },
        taxIdentifier: { taxpayerId: "VENDITORE" },
      }),
    ).toEqual([
      {
        value: "SINTETICO",
        type: "CODICE_FISCALE",
        issuingCountry: "IT",
        source: "ebay_fulfillment",
      },
    ]);
    expect(fulfillmentTaxIdentifiers({ buyer: {} })).toEqual([]);
    expect(fulfillmentTaxIdentifiers({})).toEqual([]);
    expect(fulfillmentTaxIdentifiers({ buyer: { taxIdentifier: null } })).toEqual([]);
    expect(
      fulfillmentTaxIdentifiers({
        buyer: { taxIdentifier: { taxpayerId: "SINTETICO", taxIdentifierType: "ESTERO" } },
      })[0]?.issuingCountry,
    ).toBeNull();
    for (const taxIdentifier of [
      { value: "inatteso" },
      { taxpayerId: {}, taxIdentifierType: "VAT_ID" },
      { taxpayerId: " ", taxIdentifierType: "VAT_ID" },
      { taxpayerId: "SINTETICO", taxIdentifierType: " " },
      ...["xxIT", "ITxx", "I", "ITA", "it", "1T"].map((issuingCountry) => ({
        taxpayerId: "SINTETICO",
        taxIdentifierType: "VAT_ID",
        issuingCountry,
      })),
    ]) {
      expect(() => fulfillmentTaxIdentifiers({ buyer: { taxIdentifier } })).toThrow();
    }
  });

  it("distingue ordine Trading assente, assenza del campo e risposta fiscale malformata", async () => {
    const read = (block: string) =>
      readTradingTaxObservation(
        access(
          async () =>
            new Response(
              `<GetOrdersResponse><Ack>Success</Ack><OrderArray>${block}</OrderArray></GetOrdersResponse>`,
            ),
        ),
        "ordine",
      );
    expect(await read("")).toEqual({ orderFound: false, values: [] });
    expect(await read("<Order><OrderID>ordine</OrderID></Order>")).toEqual({
      orderFound: true,
      values: [],
    });
    await expect(
      read(
        "<Order><OrderID>ordine</OrderID><BuyerTaxIdentifier><ID>SINTETICO</ID></BuyerTaxIdentifier></Order>",
      ),
    ).rejects.toMatchObject({ failure: "invalid_response" });
    await expect(read("<Order><OrderID>ordine</OrderID></Order>".repeat(2))).rejects.toMatchObject({
      failure: "invalid_response",
    });
  });
});
