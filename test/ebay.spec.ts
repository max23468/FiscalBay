import { describe, expect, it, vi } from "vitest";

import { ebayApiUrl, sandboxAvailable } from "../app/integrations/ebay/environment.server";
import {
  fulfillmentObservation,
  readFulfillmentOrders,
} from "../app/integrations/ebay/fulfillment.server";
import {
  parseItemImage,
  parseTradingOrders,
  qualifiedImageUrl,
  mapTradingTaxIdentifiers,
  readItemImage,
  readTradingOrders,
  readTradingTaxObservations,
  tradingTaxBatch,
  tradingAck,
} from "../app/integrations/ebay/trading.server";
import {
  orderEventsDestination,
  orderEventsEndpoint,
  subscribeOrderEvents,
  unsubscribeOrderEvents,
} from "../app/integrations/ebay/order-events.server";
import { UpstreamError } from "../app/integrations/http.server";
import {
  access,
  configuration,
  failure,
  trading,
  withUser,
  ack,
  tradingError,
  order,
} from "./fixtures/ebay-client-fixtures";

describe("client eBay e normalizzazione", () => {
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
      expect(await failure(readTradingTaxObservations(access(trading(body)), ["1"]))).toEqual({
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
        readTradingTaxObservations(
          access(vi.fn<typeof fetch>(async () => new Response(oversized))),
          ["1"],
        ),
      ),
    ).toEqual({ failure: "invalid_response", status: 200 });
    expect(() => tradingAck(ack("<Ack>Success</Ack>") + " ".repeat(2_097_153))).toThrow(
      UpstreamError,
    );
  });

  it("legge i dati fiscali di più ordini con una sola chiamata, con l'errore del singolo ordine", async () => {
    const fetcher = trading(
      ack(
        "<Ack>Success</Ack><HasMoreOrders>false</HasMoreOrders><OrderArray>" +
          "<Order><OrderID>A</OrderID><BuyerTaxIdentifier><Type>CODICE_FISCALE</Type><ID>SINTETICO</ID></BuyerTaxIdentifier></Order>" +
          "<Order><OrderID>D</OrderID></Order><Order><OrderID>D</OrderID></Order>" +
          "</OrderArray>",
      ),
    );
    const results = await readTradingTaxObservations(access(fetcher), ["A", "B", "D"]);
    expect(fetcher).toHaveBeenCalledOnce();
    const body = String(fetcher.mock.calls[0]![1]?.body);
    expect(body).toContain(
      "<OrderIDArray><OrderID>A</OrderID><OrderID>B</OrderID><OrderID>D</OrderID></OrderIDArray>",
    );
    expect(body).toContain(`<EntriesPerPage>${tradingTaxBatch}</EntriesPerPage>`);
    expect(results.get("A")).toMatchObject({
      orderFound: true,
      values: [{ type: "CODICE_FISCALE", value: "SINTETICO" }],
    });
    expect(results.get("B")).toEqual({
      orderFound: false,
      lastModifiedTime: undefined,
      values: [],
    });
    expect(results.get("D")).toBeInstanceOf(UpstreamError);
    // Una risposta su più pagine o un lotto vuoto o troppo grande non sono attesi.
    expect(
      await failure(
        readTradingTaxObservations(
          access(trading(ack("<Ack>Success</Ack><HasMoreOrders>true</HasMoreOrders>"))),
          ["A"],
        ),
      ),
    ).toEqual({ failure: "invalid_response" });
    for (const ids of [[], Array.from({ length: tradingTaxBatch + 1 }, (_, index) => `${index}`)])
      expect(await failure(readTradingTaxObservations(access(trading("")), ids))).toEqual({
        failure: "invalid_response",
      });
  });

  it("tipizza gli errori Trading con il solo codice eBay", async () => {
    for (const [body, expected] of [
      [tradingError("931"), { failure: "credentials", providerCode: "931" }],
      [tradingError("21916984"), { failure: "credentials", providerCode: "21916984" }],
      [tradingError("518"), { failure: "rate_limited", providerCode: "518", limit: "GetItem" }],
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
    expect(await readItemImage(access(getItem), `110<1>&"'`)).toBe(valid);
    const [, init] = getItem.mock.calls[0]!;
    expect((init!.headers as Record<string, string>)["x-ebay-api-call-name"]).toBe("GetItem");
    expect(String(init!.body)).toContain("<ItemID>110&lt;1&gt;&amp;&quot;&apos;</ItemID>");
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
  it("toglie dal totale la protezione acquisti pagata a eBay", () => {
    // Un pagamento al venditore e uno a eBay, come nella risposta documentata.
    const payments = (payee: string, currency = "EUR") =>
      xml.replace(
        '<Total currencyID="EUR">12.50</Total>',
        `<Total currencyID="EUR">13.70</Total><MonetaryDetails><Payments>
        <Payment><Payee type="eBayUser">venditore</Payee><PaymentAmount currencyID="EUR">12.50</PaymentAmount></Payment>
        <Payment>${payee}<PaymentAmount currencyID="${currency}">1.20</PaymentAmount></Payment>
        </Payments></MonetaryDetails>`,
      );
    const total = (body: string) => parseTradingOrders(body).orders[0]!.total;
    expect(total(payments('<Payee type="eBayUser">eBay</Payee>'))).toEqual({
      minor: 1250,
      currency: "EUR",
    });
    expect(total(payments('<Payee type="eBayPartner">partner</Payee>')).minor).toBe(1250);
    expect(total(payments('<Payee type="eBayUser">altro</Payee>')).minor).toBe(1370);
    expect(total(payments('<Payee type="eBayUser">eBay</Payee>', "GBP")).minor).toBe(1370);
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
    xml.replace(
      "</Total>",
      '</Total><MonetaryDetails><Payments><Payment><Payee>eBay</Payee><PaymentAmount currencyID="EUR">20.00</PaymentAmount></Payment></Payments></MonetaryDetails>',
    ),
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
    // Dentro una transazione vale lo stesso: il malformato è un errore senza valori, il completo
    // risulta presente.
    const inTransaction = (identifier: string) =>
      parseTradingOrders(
        xml.replace(
          "</Transaction>",
          `<BuyerTaxIdentifier>${identifier}</BuyerTaxIdentifier></Transaction>`,
        ),
      ).orders[0]!.taxIdentifiers;
    expect(inTransaction("<Type>CODICE_FISCALE</Type>")).toMatchObject({
      verification: "error",
      availability: "not_included",
      values: [],
    });
    expect(inTransaction("<Type>CODICE_FISCALE</Type><ID>SINTETICO</ID>")).toMatchObject({
      verification: "completed",
      availability: "present",
      values: [{ type: "CODICE_FISCALE", value: "SINTETICO" }],
    });
  });

  it("distingue ordine Trading assente, assenza del campo e risposta fiscale malformata", async () => {
    const read = async (block: string) => {
      const results = await readTradingTaxObservations(
        access(
          async () =>
            new Response(
              `<GetOrdersResponse><Ack>Success</Ack><OrderArray>${block}</OrderArray></GetOrdersResponse>`,
            ),
        ),
        ["ordine"],
      );
      expect([...results.keys()]).toEqual(["ordine"]);
      return results.get("ordine");
    };
    // L'errore di un ordine arriva come esito di quell'ordine, senza far fallire il lotto.
    const invalid = async (block: string) => {
      const result = await read(block);
      expect(result).toBeInstanceOf(UpstreamError);
      expect(result).toMatchObject({ failure: "invalid_response" });
    };
    expect(await read("")).toEqual({ orderFound: false, values: [] });
    expect(await read("<Order><OrderID>ordine</OrderID></Order>")).toEqual({
      orderFound: true,
      values: [],
    });
    // L'identificativo di un altro ordine della risposta non passa a quello richiesto.
    expect(
      await read(
        "<Order><OrderID>ordine</OrderID></Order>" +
          "<Order><OrderID>altro</OrderID><BuyerTaxIdentifier><ID>SINTETICO</ID><Type>VAT_ID</Type></BuyerTaxIdentifier></Order>",
      ),
    ).toEqual({ orderFound: true, values: [] });
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
      await invalid(
        `<Order><OrderID>ordine</OrderID><CheckoutStatus><LastModifiedTime>${date}</LastModifiedTime></CheckoutStatus></Order>`,
      );
    }
    await invalid(
      "<Order><OrderID>ordine</OrderID><BuyerTaxIdentifier><ID>SINTETICO</ID></BuyerTaxIdentifier></Order>",
    );
    await invalid("<Order><OrderID>ordine</OrderID></Order>".repeat(2));
    // Il valore si decodifica una volta sola e il Paese emittente assente resta nullo.
    expect(
      await read(
        "<Order><OrderID>ordine</OrderID><BuyerTaxIdentifier><Type>CODICE_FISCALE</Type><ID>SYNTHETIC&amp;amp;ID</ID></BuyerTaxIdentifier></Order>",
      ),
    ).toEqual({
      orderFound: true,
      values: [
        {
          type: "CODICE_FISCALE",
          issuingCountry: null,
          value: "SYNTHETIC&amp;ID",
          source: "ebay_trading_get_orders",
        },
      ],
    });
    await expect(
      readTradingTaxObservations(access(trading(ack("<Ack>Failure</Ack>"))), ["ordine"]),
    ).rejects.toThrow(UpstreamError);
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
});

describe("ambiente eBay", () => {
  const sandbox = {
    APP_ORIGIN: "https://test.fiscalbay.it",
    EBAY_CLIENT_ID: "sintetico",
    EBAY_CLIENT_SECRET: "sintetico",
    EBAY_RUNAME: "sintetico",
    EBAY_SANDBOX_ENABLED: "true",
    EBAY_SANDBOX_CLIENT_ID: "client",
    EBAY_SANDBOX_CLIENT_SECRET: "secret",
    EBAY_SANDBOX_RUNAME: "runame",
  };

  it.each([
    "https://test.fiscalbay.it",
    "http://localhost:5173",
    "http://127.0.0.1:8787",
    "http://[::1]:8787",
  ])("abilita Sandbox sull'origine di test o locale %s", (origin) => {
    expect(sandboxAvailable({ ...sandbox, APP_ORIGIN: origin })).toBe(true);
  });

  it.each([
    ["interruttore spento", { EBAY_SANDBOX_ENABLED: "false" }],
    ["interruttore assente", { EBAY_SANDBOX_ENABLED: undefined }],
    ["client id assente", { EBAY_SANDBOX_CLIENT_ID: undefined }],
    ["segreto assente", { EBAY_SANDBOX_CLIENT_SECRET: undefined }],
    ["RuName assente", { EBAY_SANDBOX_RUNAME: undefined }],
    ["dominio Production", { APP_ORIGIN: "https://fiscalbay.it" }],
  ])("tiene spento Sandbox con %s", (_, override) => {
    expect(sandboxAvailable({ ...sandbox, ...override })).toBe(false);
  });

  it("accetta un link relativo o assoluto sotto il percorso atteso", () => {
    const path = "/sell/fulfillment/v1/order";
    expect(ebayApiUrl(configuration, `${path}?offset=50`, path).href).toBe(
      `https://api.ebay.com${path}?offset=50`,
    );
    expect(ebayApiUrl(configuration, `https://api.ebay.com${path}/1-2`, path).pathname).toBe(
      `${path}/1-2`,
    );
  });

  /** Link dell'API con credenziali nell'URL. */
  const withCredentials = (credentials: Partial<Pick<URL, "username" | "password">>) =>
    Object.assign(new URL("https://api.ebay.com/sell/fulfillment/v1/order"), credentials).href;

  it.each([
    "http://[",
    "http://api.ebay.com/sell/fulfillment/v1/order",
    "https://api.sandbox.ebay.com/sell/fulfillment/v1/order",
    withCredentials({ username: "utente", password: "segreto" }),
    withCredentials({ password: "segreto" }),
    "/sell/fulfillment/v1/orders",
  ])("rifiuta il link %s prima di inviare il token", (value) => {
    expect(() => ebayApiUrl(configuration, value, "/sell/fulfillment/v1/order")).toThrow(
      expect.objectContaining({ failure: "invalid_response" }),
    );
  });
});

describe("sottoscrizione ORDER_CONFIRMATION del venditore", () => {
  const test = { APP_ORIGIN: "https://test.fiscalbay.it" };
  const live = { APP_ORIGIN: "https://fiscalbay.it" };
  type Existing = {
    subscriptionId: string;
    topicId: string;
    status: string;
    destinationId: string;
  };
  /** Notification API sintetica: registra metodo, percorso, token e corpo di ogni chiamata. */
  const notifications = (state: { create?: number; existing?: Existing[] } = {}) => {
    const calls: { method: string; path: string; token: string | null; body?: unknown }[] = [];
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      const url = new URL(String(input));
      const method = init?.method ?? "GET";
      const token = new Headers(init?.headers).get("authorization");
      calls.push({
        method,
        path: `${url.pathname.replace("/commerce/notification/v1/", "")}${url.search}`,
        token,
        ...(init?.body && typeof init.body === "string" ? { body: JSON.parse(init.body) } : {}),
      });
      if (url.pathname === "/identity/v1/oauth2/token")
        return Response.json({ access_token: "token-applicazione" });
      if (url.pathname.endsWith("/destination"))
        return Response.json({
          destinations: [
            {
              destinationId: "spenta",
              status: "DISABLED",
              deliveryConfig: { endpoint: "https://test.fiscalbay.it/webhooks/ebay" },
            },
            {
              destinationId: "test",
              status: "ENABLED",
              deliveryConfig: { endpoint: "https://test.fiscalbay.it/webhooks/ebay" },
            },
            {
              destinationId: "live",
              status: "ENABLED",
              deliveryConfig: { endpoint: "https://fiscalbay.it/webhooks/ebay" },
            },
            {
              destinationId: "sandbox",
              status: "ENABLED",
              deliveryConfig: { endpoint: "https://test.fiscalbay.it/webhooks/ebay/sandbox" },
            },
          ],
        });
      if (method === "POST" && url.pathname.endsWith("/subscription")) {
        const status = state.create ?? 201;
        return status === 201
          ? new Response(null, { status })
          : Response.json(
              { errors: [{ errorId: status === 409 ? 195012 : 195011 }] },
              { status, headers: { "retry-after": "120" } },
            );
      }
      if (method === "GET" && url.pathname.endsWith("/subscription"))
        return Response.json({ subscriptions: state.existing ?? [] });
      return new Response(null, { status: method === "DELETE" ? 204 : 200 });
    });
    return { calls, access: access(fetcher), fetcher };
  };
  const ours = {
    subscriptionId: "sub/1",
    topicId: "ORDER_CONFIRMATION",
    status: "ENABLED",
    destinationId: "test",
  };
  const other = { ...ours, destinationId: "live" };
  const writes = (calls: { method: string; path: string; body?: unknown }[]) =>
    calls
      .filter(({ method }) => method !== "GET")
      .map(({ method, path, body }) => ({ method, path, ...(body ? { body } : {}) }));

  it("trova la destinazione abilitata dell'ambiente con il token dell'applicazione", async () => {
    const api = notifications();
    expect(
      await orderEventsDestination(test, "production", api.access.configuration, api.fetcher),
    ).toBe("test");
    expect(
      await orderEventsDestination(live, "production", api.access.configuration, api.fetcher),
    ).toBe("live");
    expect(
      await orderEventsDestination(test, "sandbox", api.access.configuration, api.fetcher),
    ).toBe("sandbox");
    expect(
      await orderEventsDestination(
        { APP_ORIGIN: "http://localhost:5173" },
        "production",
        api.access.configuration,
        api.fetcher,
      ),
    ).toBeNull();
    expect(
      api.calls
        .filter(({ path }) => path.startsWith("destination"))
        .every(({ token }) => token === "Bearer token-applicazione"),
    ).toBe(true);
    expect(orderEventsEndpoint({ APP_ORIGIN: "https://test.fiscalbay.it/" }, "sandbox")).toBe(
      "https://test.fiscalbay.it/webhooks/ebay/sandbox",
    );
  });

  it("crea la sottoscrizione del venditore con il suo token, la versione 1.0 e lo stato abilitato", async () => {
    const api = notifications();
    expect(await subscribeOrderEvents(test, api.access, "test")).toBe("subscribed");
    expect(api.calls).toEqual([
      {
        method: "POST",
        path: "subscription",
        token: "Bearer token-sintetico",
        body: {
          topicId: "ORDER_CONFIRMATION",
          destinationId: "test",
          payload: { format: "JSON", schemaVersion: "1.0", deliveryProtocol: "HTTPS" },
          status: "ENABLED",
        },
      },
    ]);
  });

  it("un consenso senza lo scope delle notifiche non sottoscrive", async () => {
    const api = notifications({ create: 403 });
    expect(await subscribeOrderEvents(test, api.access, "test")).toBe("unauthorized");
    expect(api.calls).toHaveLength(1);
  });

  it("una sottoscrizione esistente si riaccende sull'ambiente e si sposta soltanto in Production", async () => {
    const enabled = notifications({ create: 409, existing: [ours] });
    expect(await subscribeOrderEvents(test, enabled.access, "test")).toBe("subscribed");
    expect(writes(enabled.calls)).toHaveLength(1);

    const disabled = notifications({ create: 409, existing: [{ ...ours, status: "DISABLED" }] });
    expect(await subscribeOrderEvents(test, disabled.access, "test")).toBe("subscribed");
    expect(writes(disabled.calls).at(-1)).toEqual({
      method: "POST",
      path: "subscription/sub%2F1/enable",
    });

    const elsewhere = notifications({ create: 409, existing: [other] });
    expect(await subscribeOrderEvents(test, elsewhere.access, "test")).toBe("elsewhere");
    expect(writes(elsewhere.calls)).toHaveLength(1);

    const takeover = notifications({ create: 409, existing: [{ ...ours, destinationId: "test" }] });
    expect(await subscribeOrderEvents(live, takeover.access, "live")).toBe("subscribed");
    expect(writes(takeover.calls).at(-1)).toEqual({
      method: "PUT",
      path: "subscription/sub%2F1",
      body: {
        destinationId: "live",
        payload: { format: "JSON", schemaVersion: "1.0", deliveryProtocol: "HTTPS" },
        status: "ENABLED",
      },
    });

    const missing = notifications({ create: 409, existing: [] });
    expect(await failure(subscribeOrderEvents(test, missing.access, "test"))).toEqual({
      failure: "invalid_response",
    });
  });

  it("limiti ed errori di eBay restano errori del provider", async () => {
    expect(
      await failure(subscribeOrderEvents(test, notifications({ create: 429 }).access, "test")),
    ).toEqual({ failure: "rate_limited", status: 429, retryAfter: 120 });
    expect(
      await failure(subscribeOrderEvents(test, notifications({ create: 500 }).access, "test")),
    ).toEqual({ failure: "unavailable", status: 500, retryAfter: 120 });
    expect(
      await failure(subscribeOrderEvents(test, notifications({ create: 401 }).access, "test")),
    ).toEqual({ failure: "credentials", status: 401 });
    expect(
      await failure(subscribeOrderEvents(test, notifications({ create: 400 }).access, "test")),
    ).toEqual({ failure: "rejected", status: 400 });
  });

  it("toglie soltanto la sottoscrizione che punta all'ambiente", async () => {
    const api = notifications({ existing: [ours] });
    expect(await unsubscribeOrderEvents(api.access, "test")).toBe(true);
    expect(writes(api.calls)).toEqual([{ method: "DELETE", path: "subscription/sub%2F1" }]);
    const moved = notifications({ existing: [other] });
    expect(await unsubscribeOrderEvents(moved.access, "test")).toBe(false);
    expect(writes(moved.calls)).toEqual([]);
    expect(await unsubscribeOrderEvents(notifications().access, "test")).toBe(false);
  });
});
