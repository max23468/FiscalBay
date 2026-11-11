import { describe, expect, it, vi } from "vitest";
import { escapeMarkup } from "../app/markup";
import {
  displayTaxValue,
  taxQuality,
  buyerTaxKey,
  shownTaxType,
  taxComparisonKey,
  taxIdentifierType,
} from "../app/tax-quality";

import {
  buildCreationDateFilter,
  buildLastModifiedFilter,
  fulfillmentObservation,
  fulfillmentTaxIdentifiers,
  readFulfillmentOrder,
  readFulfillmentOrders,
} from "../app/integrations/ebay/fulfillment.server";
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

describe("qualità formale degli identificativi", () => {
  const cf = (value: string, names: Array<string | null> = ["Mario Rossi"]) =>
    taxQuality({ type: "CODICE_FISCALE", issuingCountry: "IT", value }, names);
  it.each([
    ["RSSMRA80A01H501U", "valid"],
    [" rssmra 80a01h501u ", "valid"],
    ["RSSMRA80A01H501X", "checksum"],
    ["RSSMRA80A00H501U", "format"],
    ["RSSMRA80A32H501U", "format"],
    ["RSSMRA80A40H501U", "format"],
    ["RSSMRA80A72H501U", "format"],
    ["RSSMRA80A81H501U", "format"],
    ["RSSMRA80Z01H501U", "format"],
    ["SPSNNA85T55F83", "format"],
    ["1RSSMRA80A01H501U", "format"],
    ["1RSSMRA80M01H501U", "format"],
    ["RSSMRA80A01H501U1", "format"],
    ["RSSMRA80A01H50MM", "unverifiable"],
    ["RSSMRA80A01H50ML", "checksum"],
    ["12345678903", "valid"],
    ["RSSMRA80A31H501X", "valid"],
    ["RSSMRA80A41H501Y", "valid"],
    ["RSSMRA80A71H501B", "valid"],
    ["RSSMRA80B29H501Q", "valid"],
    ["RSSMRA81B29H501R", "format"],
    ["RSSMRA80D31H501D", "format"],
    ["RSSMRA80D30H501E", "valid"],
    ["RSSMRA81B28H501P", "valid"],
    ["RSSMRAU0A01H501R", "unverifiable"],
    ["RSSMRA8LA01H501F", "unverifiable"],
    ["RSSMRA80AL1H501F", "unverifiable"],
    ["RSSMRA80A0MH501M", "unverifiable"],
    ["RSSMRA80A01HR01P", "unverifiable"],
    ["RSSMRA80A01H5L1F", "unverifiable"],
  ])("classifica %s come %s senza correggerlo", (value, expected) => {
    expect(cf(value)).toBe(expected);
  });
  it("verifica la tabella ufficiale delle lettere in posizione dispari", () => {
    // Controlli del medesimo codice sintetico variando solo la prima lettera.
    const checks = "NMRTVZBDFHOQEGXPSUYACWILKJ";
    for (const [index, char] of Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ").entries()) {
      expect(cf(`${char}SSMRA80A01H501${checks[index]}`, [])).toBe("unverifiable");
    }
  });
  it.each([
    ["RSSCRS80A01H501C", "Christopher Rossi"],
    ["RSSGNN80A01H501N", "Giovanni Rossi"],
    ["AIXIOX80A01H501M", "Io Ai"],
    ["BOXLAX80A01H501K", "Al Bo"],
    ["DNGMRA80A01H501R", "Mario D’Angelo"],
    ["DLCMRA80A01H501F", "Mario De-Luca"],
  ])("verifica consonanti, vocali e completamento per %s", (value, name) => {
    expect(cf(value, [name])).toBe("valid");
  });
  it.each([
    [["Rossi Mario"], "valid"],
    [["Mario  Rossi"], "valid"],
    [["Mário Ròssi"], "valid"],
    [["Mario Rossi c/o Destinatario diverso"], "valid"],
    [["Mario Rossi C / O Destinatario"], "valid"],
    [["Luigi Bianchi", "Mario Rossi"], "valid"],
    [["Luigi Bianchi"], "name"],
    [["Mario Luigi Rossi"], "unverifiable"],
    [["Mario Luigi Rossi", "Luigi Bianchi"], "unverifiable"],
    [[null], "unverifiable"],
    [["Società 123"], "unverifiable"],
    [["123Mario Rossi"], "unverifiable"],
    [["Mario"], "unverifiable"],
  ] as const)("confronta i nomi %s", (names, expected) => {
    expect(cf("RSSMRA80A01H501U", [...names])).toBe(expected);
  });
  it("applica il controllo numerico solo ai tipi italiani riconosciuti", () => {
    for (const [value, expected] of [
      ["12345678903", "valid"],
      ["12345678900", "checksum"],
      ["123", "format"],
      ["00000000000", "format"],
      ["01234567897", "valid"],
      ["x12345678903", "format"],
      ["12345678903x", "format"],
      ["RSSMRA80A01H501U", "format"],
    ]) {
      expect(taxQuality({ type: "VAT_ID", issuingCountry: "IT", value: value! }, [])).toBe(
        expected,
      );
    }
    for (const [type, issuingCountry] of [
      ["VAT_ID", "ES"],
      ["NIF", "IT"],
      ["CODICE_FISCALE", "ES"],
    ]) {
      expect(
        taxQuality({ type: type!, issuingCountry: issuingCountry!, value: "non-verificato" }, []),
      ).toBe("unchecked");
    }
    expect(taxQuality({ type: "VATIN", issuingCountry: "IT", value: "12345678903" }, [])).toBe(
      "valid",
    );
    expect(taxQuality({ type: "PartitaIVA", issuingCountry: "IT", value: "12345678903" }, [])).toBe(
      "valid",
    );
    expect(
      taxComparisonKey({
        type: "CODICE_FISCALE",
        issuingCountry: null,
        value: " rssmra 80a01h501u ",
      }),
    ).toBe(
      taxComparisonKey({ type: "CodiceFiscale", issuingCountry: null, value: "RSSMRA80A01H501U" }),
    );
    expect(taxComparisonKey({ type: "NIF", issuingCountry: "ES", value: " abc " })).toBe(
      JSON.stringify(["NIF", "ES", "abc"]),
    );
    expect(
      taxComparisonKey({
        type: "CODICE_FISCALE",
        issuingCountry: null,
        value: " rssmra 80a01h501u ",
      }),
    ).toBe(JSON.stringify(["CF", null, "RSSMRA80A01H501U"]));
  });
  it("riconosce lo stesso dato del buyer con Paese assente o IT, non quello estero", () => {
    expect(
      buyerTaxKey({ type: "CODICE_FISCALE", issuingCountry: null, value: "rssmra80a01h501u" }),
    ).toBe(buyerTaxKey({ type: "CodiceFiscale", issuingCountry: "IT", value: "RSSMRA80A01H501U" }));
    expect(buyerTaxKey({ type: "PartitaIVA", issuingCountry: null, value: "12345678901" })).toBe(
      buyerTaxKey({ type: "VAT_ID", issuingCountry: "IT", value: "12345678901" }),
    );
    expect(buyerTaxKey({ type: "NIF", issuingCountry: "ES", value: "abc" })).toBe(
      JSON.stringify(["NIF", "ES", "abc"]),
    );
  });
  it.each([
    ["CODICE_FISCALE", "IT", "CF"],
    ["CodiceFiscale", null, "CF"],
    ["VAT_ID", "IT", "PIVA"],
    ["VATIN", "IT", "PIVA"],
    ["PartitaIVA", null, "PIVA"],
    ["VATIN", null, "OTHER"],
    ["VAT_ID", null, "OTHER"],
    ["NIF", "IT", "OTHER"],
    ["CODICE_FISCALE", "ES", "OTHER"],
  ])("mappa il tipo %s e Paese %s per la vista", (type, country, expected) => {
    expect(taxIdentifierType(type!, country!)).toBe(expected);
  });
  it.each([
    ["CODICE_FISCALE", "IT", "RSSMRA80A01H501U", "CF"],
    ["CODICE_FISCALE", "IT", "01234567897", "PIVA"],
    ["CodiceFiscale", null, " 0123 4567 897", "PIVA"],
    ["CODICE_FISCALE", "IT", "70123456789", "PIVA"],
    // Enti senza Partita IVA: codice numerico che inizia per 8 o 9.
    ["CODICE_FISCALE", "IT", "80012345678", "CF"],
    ["CODICE_FISCALE", "IT", "97012345678", "CF"],
    ["CODICE_FISCALE", "IT", "0123456789", "CF"],
    ["CODICE_FISCALE", "IT", "0123456789A", "CF"],
    ["CODICE_FISCALE", "IT", "012345678978", "CF"],
    ["CODICE_FISCALE", "IT", "A01234567897", "CF"],
    ["VAT_ID", "IT", "01234567897", "PIVA"],
    ["CODICE_FISCALE", "ES", "01234567897", "OTHER"],
  ])("mostra %s %s con valore %s come %s", (type, country, value, expected) => {
    expect(shownTaxType({ type: type!, issuingCountry: country!, value: value! })).toBe(expected);
    // Confronti e storico restano sul tipo della fonte.
    expect(taxIdentifierType(type!, country!)).toBe(
      expected === "PIVA" && type !== "VAT_ID" ? "CF" : expected,
    );
  });
});

describe("testo dentro HTML e XML", () => {
  it("sostituisce soltanto i caratteri riservati indicati", () => {
    const text = `a&b<c>"d'e`;
    // Testo e attributo fra virgolette doppie: l'apostrofo resta.
    expect(escapeMarkup(text)).toBe("a&amp;b&lt;c&gt;&quot;d'e");
    // HTML di Telegram: soltanto `&`, `<` e `>`.
    expect(escapeMarkup(text, /[&<>]/gu)).toBe(`a&amp;b&lt;c&gt;"d'e`);
    // Richiesta XML: anche l'apostrofo.
    expect(escapeMarkup(text, /[&<>"']/gu)).toBe("a&amp;b&lt;c&gt;&quot;d&apos;e");
  });
});

describe("contratto Fulfillment senza persistenza", () => {
  it.each([
    { orderId: "1" },
    { orderId: "1", pricingSummary: {} },
    { orderId: "1", pricingSummary: { total: null } },
  ])("un ordine Fulfillment senza totale è una risposta non valida: %j", (payload) => {
    expect(() => fulfillmentObservation(payload, "2026-09-01T00:00:00.000Z")).toThrow(
      expect.objectContaining({ failure: "invalid_response" }),
    );
  });

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

  it("valida la pagina restituita dal provider prima di usarla", async () => {
    const page = (payload: unknown) =>
      readFulfillmentOrders(
        {
          configuration,
          accessToken: "token-sintetico",
          fetcher: async () => Response.json(payload),
        },
        { limit: 25, filter: "" },
      );
    expect(await page({ total: 0 })).toEqual({ total: 0, orders: [] });
    for (const invalid of [
      { total: -1 },
      { orders: [] },
      { total: 0, orders: [{ orderId: "" }] },
      { total: 0, next: {} },
    ])
      await expect(page(invalid)).rejects.toMatchObject({ failure: "invalid_response" });
  });

  it("costruisce filtri UTC e rifiuta intervalli invalidi", () => {
    const date = new Date(created);
    expect(buildCreationDateFilter("inizio", "fine")).toBe("creationdate:[inizio..fine]");
    expect(buildLastModifiedFilter(new Date(date.getTime() - 1000), date)).toBe(
      "lastmodifieddate:[2025-12-31T23:59:59.000Z..2026-01-01T00:00:00.000Z]",
    );
    expect(buildLastModifiedFilter(date, date)).toBe(`lastmodifieddate:[${created}..${created}]`);
    for (const [start, end] of [
      [new Date(NaN), date],
      [date, new Date(NaN)],
      [date, new Date(0)],
    ] as const)
      expect(() => buildLastModifiedFilter(start, end)).toThrow(
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

  it("legge per ID da uno a 50 ordini, senza filtro né limite", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ orders: [], total: 0 }));
    const access = { fetcher, configuration, accessToken: "token-sintetico" };
    const ids = Array.from({ length: 50 }, (_, index) => `O-${index}`);
    await readFulfillmentOrders(access, { orderIds: ["A", "B"] });
    await readFulfillmentOrders(access, { orderIds: ids });
    expect(fetcher.mock.calls.map(([url]) => String(url))).toEqual([
      "https://api.ebay.com/sell/fulfillment/v1/order?orderIds=A%2CB",
      `https://api.ebay.com/sell/fulfillment/v1/order?orderIds=${ids.join("%2C")}`,
    ]);
    expect(new Headers(fetcher.mock.calls[0]?.[1]?.headers).get("authorization")).toBe(
      "Bearer token-sintetico",
    );
    for (const orderIds of [[], [...ids, "O-50"]])
      await expect(readFulfillmentOrders(access, { orderIds })).rejects.toThrow(
        new RangeError("Ordini eBay da leggere per ID non validi"),
      );
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
});

describe("forma mostrata degli identificativi fiscali", () => {
  it("toglie ogni spazio e porta in maiuscolo soltanto CF e Partita IVA italiani", () => {
    expect(displayTaxValue({ type: "CF", value: " rss mra80a01h501u " })).toBe("RSSMRA80A01H501U");
    expect(displayTaxValue({ type: "CF", value: "rss\tmra\n80a01" })).toBe("RSSMRA80A01");
    expect(displayTaxValue({ type: "PIVA", value: "0123 4567 890" })).toBe("01234567890");
    expect(displayTaxValue({ type: "PIVA", value: "00000000000" })).toBe("00000000000");
    // Un valore errato resta errato: la forma derivata non lo corregge.
    expect(displayTaxValue({ type: "CF", value: "rss-mra" })).toBe("RSS-MRA");
    expect(displayTaxValue({ type: "OTHER", value: " es b123 456 " })).toBe(" es b123 456 ");
  });
});
