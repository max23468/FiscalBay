import { describe, expect, it, vi } from "vitest";
import { taxQuality, taxComparisonKey, taxIdentifierType } from "../app/tax-quality";

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
import {
  readTradingTaxObservation,
  parseTradingOrders,
  readTradingOrders,
  tradingAck,
  parseTradingOrderTaxIdentifiers,
} from "../app/integrations/ebay/trading.server";
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
});

describe("acquisti Trading", () => {
  const xml = `<GetOrdersResponse><Ack>Success</Ack><PaginationResult><TotalNumberOfEntries>1</TotalNumberOfEntries></PaginationResult>
    <HasMoreOrders>false</HasMoreOrders><OrderArray><Order><OrderID>provvisorio</OrderID><OrderStatus>Active</OrderStatus>
    <CreatedTime>2026-09-01T10:00:00Z</CreatedTime><CheckoutStatus><LastModifiedTime>2026-09-01T11:00:00Z</LastModifiedTime></CheckoutStatus>
    <Total currencyID="EUR">12.50</Total><BuyerUserID>buyer</BuyerUserID>
    <ShippingAddress><Name>Destinatario</Name><Street1>Via Sintetica</Street1><Country>IT</Country></ShippingAddress>
    <TransactionArray><Transaction><Item><ItemID>123</ItemID><Title>Articolo &amp; altro</Title></Item>
    <TransactionID>456</TransactionID><OrderLineItemID>123-456</OrderLineItemID><QuantityPurchased>2</QuantityPurchased><TransactionPrice currencyID="EUR">6.25</TransactionPrice></Transaction></TransactionArray>
    </Order></OrderArray></GetOrdersResponse>`;
  it("conserva identità, mancato pagamento e campi strutturati", async () => {
    const result = parseTradingOrders(xml);
    expect(
      parseTradingOrders(
        xml.replace("<BuyerUserID>", "<EIASToken>stable-buyer</EIASToken><BuyerUserID>"),
      ).orders[0],
    ).toMatchObject({ buyerEiasToken: "stable-buyer" });
    expect(result).toMatchObject({
      total: 1,
      more: false,
      orders: [
        {
          provisional: true,
          externalOrderId: "provvisorio",
          paymentStatus: "PENDING",
          total: { minor: 1250, currency: "EUR" },
          buyer: { name: null, username: "buyer", shipTo: { name: "Destinatario" } },
          items: [
            { lineItemId: "123-456", stableKey: "123-456", title: "Articolo & altro", quantity: 2 },
          ],
        },
      ],
    });
    expect(parseTradingOrders(xml.replace("Active", "Completed")).orders[0]).toMatchObject({
      provisional: false,
      paymentStatus: "PAID",
    });
    expect(parseTradingOrders(xml.replace("Active", "Cancelled")).orders[0]).toMatchObject({
      provisional: true,
      cancelStatus: "CANCELED",
    });
    expect(parseTradingOrders(xml).orders[0]!.items[0]!.total).toEqual({
      minor: 1250,
      currency: "EUR",
    });
    expect(parseTradingOrders(xml.replace("Active", "FutureStatus")).orders[0]!.paymentStatus).toBe(
      "FutureStatus",
    );
    const fetcher = vi.fn<typeof fetch>(async () => new Response(xml));
    await readTradingOrders(
      { configuration, fetcher, accessToken: "synthetic" },
      {
        from: "2026-09-01T00:00:00Z",
        until: "2026-09-02T00:00:00Z",
        page: 2,
      },
    );
    expect(String(fetcher.mock.calls[0]![1]?.body)).toContain("<PageNumber>2</PageNumber>");
    expect(String(fetcher.mock.calls[0]![1]?.body)).toContain(
      "<ModTimeFrom>2026-09-01T00:00:00.000Z</ModTimeFrom>",
    );
  });
  it.each([
    xml.replace("<HasMoreOrders>false</HasMoreOrders>", ""),
    xml.replace("<TotalNumberOfEntries>1<", "<TotalNumberOfEntries>9007199254740992<"),
    xml.replace("<TotalNumberOfEntries>1<", "<TotalNumberOfEntries>NaN<"),
    xml
      .replace(/<Order>[\s\S]*<\/Order>/u, "")
      .replace("<HasMoreOrders>false<", "<HasMoreOrders>true<"),
    xml.replace(
      "<TotalNumberOfEntries>1</TotalNumberOfEntries>",
      "<TotalNumberOfEntries>0</TotalNumberOfEntries>",
    ),
    xml.replace("</OrderArray>", xml.match(/<Order>[\s\S]*<\/Order>/u)![0] + "</OrderArray>"),
  ])("rifiuta la pagina incompleta o contraddittoria", (body) => {
    expect(() => parseTradingOrders(body)).toThrow();
  });
  it.each([
    xml.replace("<QuantityPurchased>2</QuantityPurchased>", ""),
    xml.replace("<OrderStatus>Active</OrderStatus>", ""),
    xml.replace(/<CheckoutStatus>[\s\S]*?<\/CheckoutStatus>/u, ""),
    xml.replace('<Total currencyID="EUR">12.50</Total>', ""),
    xml.replace("123-456</OrderLineItemID>", "123-789</OrderLineItemID>"),
    xml.replace("<TransactionArray>", "<Broken>"),
    xml.replace("<CreatedTime>2026-09-01T10:00:00Z</CreatedTime>", ""),
    xml.replace("6.25</TransactionPrice>", "6.251</TransactionPrice>"),
  ])("salta l'ordine incompleto senza scartare la pagina", (body) => {
    const page = body
      .replace("<TotalNumberOfEntries>1<", "<TotalNumberOfEntries>2<")
      .replace(
        "</OrderArray>",
        xml.match(/<Order>[\s\S]*<\/Order>/u)![0].replace(">provvisorio<", ">valido<") +
          "</OrderArray>",
      );
    expect(parseTradingOrders(page)).toMatchObject({
      skipped: 1,
      orders: [{ externalOrderId: "valido" }],
    });
  });
  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    "rifiuta la pagina richiesta non valida %s prima di chiamare eBay",
    async (page) => {
      const fetcher = vi.fn<typeof fetch>();
      await expect(
        readTradingOrders(
          { configuration, fetcher, accessToken: "synthetic" },
          {
            from: "2026-09-01T00:00:00Z",
            until: "2026-09-02T00:00:00Z",
            page,
          },
        ),
      ).rejects.toMatchObject({ failure: "invalid_response" });
      expect(fetcher).not.toHaveBeenCalled();
    },
  );
  it("rifiuta un intervallo invertito prima di chiamare eBay", async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(
      readTradingOrders(
        { configuration, fetcher, accessToken: "synthetic" },
        {
          from: "2026-09-02T00:00:00Z",
          until: "2026-09-01T00:00:00Z",
          page: 1,
        },
      ),
    ).rejects.toMatchObject({ failure: "invalid_response" });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("accetta un intervallo con estremi uguali senza perderne gli ordini", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response(xml));
    const at = "2026-09-01T00:00:00Z";
    expect(
      await readTradingOrders(
        { configuration, fetcher, accessToken: "synthetic" },
        {
          from: at,
          until: at,
          page: 1,
        },
      ),
    ).toMatchObject({
      total: 1,
      more: false,
      skipped: 0,
      orders: [{ externalOrderId: "provvisorio" }],
    });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(String(fetcher.mock.calls[0]![1]?.body)).toContain(
      "<ModTimeFrom>2026-09-01T00:00:00.000Z</ModTimeFrom><ModTimeTo>2026-09-01T00:00:00.000Z</ModTimeTo>",
    );
  });
  it.each([
    ["&#65;&#x1F600;&#1114111;", "A😀\u{10ffff}"],
    ["&#0;&#x0;&#1114112;&#x110000;", "&#0;&#x0;&#1114112;&#x110000;"],
  ])(
    "decodifica i riferimenti numerici validi senza alterare quelli fuori intervallo: %s",
    (encoded, decoded) => {
      const result = parseTradingOrders(xml.replace("Articolo &amp; altro", encoded));
      expect(result.skipped).toBe(0);
      expect(result.orders[0]!.items[0]!.title).toBe(decoded);
    },
  );
  it.each([
    ["<Item><ItemID>123</ItemID><Title>Articolo &amp; altro</Title></Item>", "", null],
    [
      "<ItemID>123</ItemID><Title>Articolo &amp; altro</Title>",
      "<Title>Articolo &amp; altro</Title>",
      null,
    ],
    ["<TransactionID>456</TransactionID>", "", "123"],
    ["<OrderLineItemID>123-456</OrderLineItemID>", "", "123"],
  ])(
    "conserva l'identità di riga disponibile quando manca %s",
    (field, replacement, legacyItemId) => {
      const result = parseTradingOrders(xml.replace(field!, replacement!));
      expect(result.skipped).toBe(0);
      expect(result.orders[0]!.items[0]).toMatchObject({
        lineItemId: "123-456",
        stableKey: "123-456",
        legacyItemId,
      });
    },
  );
  it("conserva le assenze facoltative senza inventare titolo, prezzo o indirizzo", () => {
    const result = parseTradingOrders(
      xml
        .replace(/<ShippingAddress>[\s\S]*?<\/ShippingAddress>/u, "")
        .replace(/<Title>[\s\S]*?<\/Title>/u, "")
        .replace(/<TransactionPrice[^>]*>[\s\S]*?<\/TransactionPrice>/u, "")
        .replace("</Order>", "<ShippedTime>2026-09-02T00:00:00Z</ShippedTime></Order>"),
    );
    expect(result.skipped).toBe(0);
    expect(result.orders[0]).toMatchObject({
      fulfillmentStatus: "FULFILLED",
      buyer: { shipTo: null },
      items: [{ title: "", total: null }],
    });
  });
  it("non recupera un'identità di riga assente da un altro campo dell'ordine", () => {
    const result = parseTradingOrders(
      xml
        .replace(/<ItemID>[^<]*<\/ItemID>/u, "")
        .replace(/<OrderLineItemID>[^<]*<\/OrderLineItemID>/u, ""),
    );
    expect(result).toMatchObject({ orders: [], skipped: 1 });
  });
  it("classifica come rifiuto l'errore Trading senza codice senza esporne il messaggio", () => {
    expect(() =>
      tradingAck("<Ack>Failure</Ack><Errors><ShortMessage>NON-ESPORRE</ShortMessage></Errors>"),
    ).toThrow(
      expect.objectContaining({ failure: "rejected", details: { providerCode: undefined } }),
    );
  });
  it("ignora identificativi fiscali incompleti nel parser senza attribuirli ad altri ordini", () => {
    expect(
      parseTradingOrderTaxIdentifiers(
        "<Ack>Success</Ack><Order><OrderID>richiesto</OrderID>" +
          "<BuyerTaxIdentifier><Type>CODICE_FISCALE</Type></BuyerTaxIdentifier></Order>" +
          "<Order><OrderID>altro</OrderID><BuyerTaxIdentifier><ID>SINTETICO</ID><Type>VAT_ID</Type></BuyerTaxIdentifier></Order>",
        "richiesto",
      ),
    ).toEqual([]);
  });
  it("un identificativo malformato lascia importabile l'ordine", () => {
    const result = parseTradingOrders(
      xml.replace(
        "</Order>",
        "<BuyerTaxIdentifier>\n<Type>CODICE_FISCALE</Type>\n</BuyerTaxIdentifier></Order>",
      ),
    );
    expect(result.skipped).toBe(0);
    expect(result.orders).toHaveLength(1);
    expect(result.orders[0]!.taxIdentifiers).toMatchObject({
      verification: "error",
      complete: false,
      values: [],
    });
    expect(parseTradingOrders(xml).orders[0]!.taxIdentifiers).toMatchObject({
      complete: false,
      availability: "not_included",
      verification: "completed",
      values: [],
    });
    expect(
      parseTradingOrders(
        xml.replace(
          "</Order>",
          "<BuyerTaxIdentifier>\n<Type>CODICE_FISCALE</Type>\n<ID>SINTETICO</ID>\n</BuyerTaxIdentifier></Order>",
        ),
      ).orders[0]!.taxIdentifiers,
    ).toMatchObject({
      complete: false,
      verification: "completed",
      values: [{ type: "CODICE_FISCALE", value: "SINTETICO" }],
    });
  });
});

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
    expect(
      await read(
        "<Order><OrderID>ordine</OrderID><EIASToken>buyer-stabile</EIASToken><TransactionArray><Transaction><EIASToken>estraneo</EIASToken></Transaction></TransactionArray></Order>",
      ),
    ).toMatchObject({ buyerEiasToken: "buyer-stabile" });
    expect(
      await read(
        "<Order><OrderID>ordine</OrderID><CheckoutStatus>\n<LastModifiedTime>2026-09-10T12:00:00Z</LastModifiedTime>\n</CheckoutStatus></Order>",
      ),
    ).toMatchObject({ lastModifiedTime: "2026-09-10T12:00:00.000Z" });
    for (const date of ["12", "non-data", "2026-09-10T12:00:00"]) {
      await expect(
        read(
          `<Order><OrderID>ordine</OrderID><CheckoutStatus><LastModifiedTime>${date}</LastModifiedTime></CheckoutStatus></Order>`,
        ),
      ).rejects.toMatchObject({ failure: "invalid_response" });
    }
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
