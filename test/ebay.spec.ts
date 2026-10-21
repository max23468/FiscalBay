import "./ebay-adapters.unit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  fulfillmentObservation,
  readFulfillmentOrders,
} from "../app/integrations/ebay/fulfillment.server";
import {
  parseItemImage,
  qualifiedImageUrl,
  readItemImage,
  readTradingTaxObservation,
  tradingAck,
} from "../app/integrations/ebay/trading.server";
import { paymentState, shippingState } from "../app/domain/orders.server";
import { UpstreamError } from "../app/integrations/http.server";
import { resetDatabase } from "./fixtures/database-fixtures";
import {
  access,
  failure,
  trading,
  withUser,
  ack,
  tradingError,
  order,
} from "./fixtures/ebay-client-fixtures";

beforeEach(resetDatabase);
afterEach(() => vi.useRealTimers());

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
      expect(await failure(readTradingTaxObservation(access(trading(body)), "1"))).toEqual({
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
        readTradingTaxObservation(
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
    expect(await readItemImage(access(getItem), "110<1>")).toBe(valid);
    const [, init] = getItem.mock.calls[0]!;
    expect((init!.headers as Record<string, string>)["x-ebay-api-call-name"]).toBe("GetItem");
    expect(String(init!.body)).toContain("<ItemID>110&lt;1&gt;</ItemID>");
  });
});
