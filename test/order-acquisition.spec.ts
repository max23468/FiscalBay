import { env } from "cloudflare:workers";

import { expect, it, vi } from "vitest";

import { acquireOrders } from "../app/domain/order-acquisition.server";

import { setSwitch } from "../app/domain/service-settings.server";

import { listVisibleOrders } from "../app/domain/orders.server";

import { listStores } from "../app/domain/stores.server";

import { access, order } from "./fixtures/ebay-client-fixtures";

import {
  grantedAt,
  image,
  ebay,
  calls,
  slices,
  acquire,
  syncState,
  count,
  series,
  setupScenarios,
} from "./fixtures/order-acquisition-scenarios";

setupScenarios();

it("legge il CF Fulfillment italiano con header e conserva lo storico quando manca", async () => {
  const tax = {
    taxpayerId: "SINTETICO",
    taxIdentifierType: "CODICE_FISCALE",
    issuingCountry: "IT",
  };
  const source = order();
  const fetcher = ebay({ orders: [order({ buyer: { ...source.buyer, taxIdentifier: tax } })] });
  expect(await acquire(fetcher)).toBe("complete");
  const single = fetcher.mock.calls.find(([input]) =>
    new URL(String(input)).pathname.includes("/order/"),
  )!;
  expect(new URL(String(single[0])).searchParams.get("fieldGroups")).toBe("TAX_BREAKDOWN");
  expect(new Headers(single[1]?.headers).get("X-EBAY-C-MARKETPLACE-ID")).toBe("EBAY_IT");
  expect(calls(fetcher, "GetOrders")).toBe(0);
  expect(
    await env.DB.prepare("SELECT identifier_type, source, value FROM tax_identifiers").all(),
  ).toMatchObject({
    results: [
      { identifier_type: "CODICE_FISCALE", source: "ebay_fulfillment", value: "SINTETICO" },
    ],
  });
  fetcher.orders[0] = order({
    lastModifiedDate: "2026-09-02T02:00:00.000Z",
    buyer: { ...source.buyer, taxIdentifier: { ...tax, taxpayerId: "ALTRO-SINTETICO" } },
  });
  await acquire(fetcher, "2026-09-02T03:00:00.000Z");
  expect(
    await count(
      "SELECT count(*) AS total FROM tax_identifiers WHERE source = 'ebay_fulfillment' AND removed_at IS NULL",
    ),
  ).toBe(1);
  // Una lettura parziale senza Paese non dichiara rimosso il dato italiano precedente.
  fetcher.orders[0] = order({
    lastModifiedDate: "2026-09-02T03:30:00.000Z",
    buyer: {
      ...source.buyer,
      taxIdentifier: { taxpayerId: "SENZA-PAESE", taxIdentifierType: "CODICE_FISCALE" },
    },
  });
  await acquire(fetcher, "2026-09-02T04:00:00.000Z");
  expect(
    await env.DB.prepare(
      "SELECT value, issuing_country FROM tax_identifiers WHERE source = 'ebay_fulfillment' AND removed_at IS NULL ORDER BY value",
    ).all(),
  ).toMatchObject({
    results: [
      { value: "ALTRO-SINTETICO", issuing_country: "IT" },
      { value: "SENZA-PAESE", issuing_country: null },
    ],
  });
  fetcher.orders[0] = order({ lastModifiedDate: "2026-09-02T04:00:00.000Z" });
  await acquire(fetcher, "2026-09-02T05:00:00.000Z");
  expect(calls(fetcher, "GetOrders")).toBe(1);
  expect(
    await count("SELECT count(*) AS total FROM tax_identifiers WHERE removed_at IS NULL"),
  ).toBe(3);
});

it.each([
  { tax: undefined },
  { tax: { taxpayerId: "SINTETICO", taxIdentifierType: "VATIN", issuingCountry: "IT" } },
  {
    tax: { taxpayerId: "SINTETICO", taxIdentifierType: "CODICE_FISCALE", issuingCountry: "ES" },
  },
  { tax: { taxpayerId: "", taxIdentifierType: "CODICE_FISCALE" } },
])("usa Trading per un dato fiscale assente o non qualificato: $tax", async ({ tax }) => {
  const source = order();
  const fetcher = ebay({ orders: [order({ buyer: { ...source.buyer, taxIdentifier: tax } })] });
  expect(await acquire(fetcher)).toBe("complete");
  expect(calls(fetcher, "GetOrders")).toBe(1);
  expect(await env.DB.prepare("SELECT source FROM tax_identifiers").all()).toMatchObject({
    results: [{ source: "ebay_trading_get_orders" }],
  });
});

it.each(["EBAY_ES", null])(
  "mantiene Trading sul marketplace non qualificato %s",
  async (marketplace) => {
    const source = order();
    const fetcher = ebay({
      orders: [
        order({
          buyer: {
            ...source.buyer,
            taxIdentifier: { taxpayerId: "SINTETICO", taxIdentifierType: "CODICE_FISCALE" },
          },
          lineItems: source.lineItems.map((line) => ({
            ...line,
            listingMarketplaceId: marketplace,
          })),
        }),
      ],
    });
    expect(await acquire(fetcher)).toBe("complete");
    expect(calls(fetcher, "GetOrders")).toBe(1);
    const single = fetcher.mock.calls.find(([input]) =>
      new URL(String(input)).pathname.includes("/order/"),
    )!;
    expect(new URL(String(single[0])).searchParams.has("fieldGroups")).toBe(false);
    expect(new Headers(single[1]?.headers).has("X-EBAY-C-MARKETPLACE-ID")).toBe(false);
  },
);

it("mantiene Trading come fonte fiscale in Sandbox", async () => {
  const source = order();
  const fetcher = ebay({
    orders: [
      order({
        buyer: {
          ...source.buyer,
          taxIdentifier: {
            taxpayerId: "SINTETICO",
            taxIdentifierType: "CODICE_FISCALE",
            issuingCountry: "IT",
          },
        },
      }),
    ],
  });
  const seller = access(fetcher);
  await acquireOrders({
    db: env.DB,
    storeId: "s-a",
    grantedAt,
    access: {
      ...seller,
      configuration: {
        ...seller.configuration,
        apiOrigin: "https://api.sandbox.ebay.com",
        ordersUrl: "https://api.sandbox.ebay.com/sell/fulfillment/v1/order",
        tradingUrl: "https://api.sandbox.ebay.com/ws/api.dll",
      },
    },
    now: new Date("2026-09-02T00:00:00.000Z"),
    budget: { calls: 12, pages: 3 },
  });
  expect(calls(fetcher, "GetOrders")).toBe(1);
  expect(await env.DB.prepare("SELECT source FROM tax_identifiers").all()).toMatchObject({
    results: [{ source: "ebay_trading_get_orders" }],
  });
});

it.each([
  { orderId: "ALTRO-ORDINE" },
  {
    lineItems: order().lineItems.map((line) => ({ ...line, listingMarketplaceId: "EBAY_ES" })),
  },
])(
  "rifiuta un dettaglio con identità o marketplace discordante: $orderId $lineItems",
  async (detail) => {
    const fetcher = ebay({
      fail: (url) => (url.pathname.includes("/order/") ? Response.json(order(detail)) : undefined),
    });
    expect(await acquire(fetcher)).toBe("complete");
    expect(calls(fetcher, "GetOrders")).toBe(0);
    expect(await env.DB.prepare("SELECT detail_error FROM order_source_refs").all()).toMatchObject({
      results: [{ detail_error: "invalid_response" }],
    });
    expect(
      await count("SELECT count(*) AS total FROM orders WHERE ebay_order_id = 'ALTRO-ORDINE'"),
    ).toBe(0);
  },
);

it("conclude un dettaglio fiscale qualificato con una sola chiamata disponibile", async () => {
  const source = order();
  const fetcher = ebay({
    orders: [
      order({
        buyer: {
          ...source.buyer,
          taxIdentifier: {
            taxpayerId: "SINTETICO",
            taxIdentifierType: "CODICE_FISCALE",
          },
        },
      }),
    ],
  });
  await acquire(fetcher);
  await env.DB.prepare("UPDATE order_source_refs SET detail_for = NULL").run();
  expect(await acquire(fetcher, undefined, { calls: 2, pages: 1 })).toBe("complete");
  expect(calls(fetcher, "GetOrders")).toBe(0);
});

it("rimanda il fallback quando resta budget soltanto per Fulfillment", async () => {
  const fetcher = ebay();
  await acquire(fetcher);
  await env.DB.prepare("UPDATE order_source_refs SET detail_for = NULL").run();
  fetcher.mockClear();
  const budget = { calls: 2, pages: 1 };
  expect(await acquire(fetcher, undefined, budget)).toBe("budget");
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(calls(fetcher, "GetOrders")).toBe(0);
  expect(budget.calls).toBe(0);
  expect(await env.DB.prepare("SELECT detail_for FROM order_source_refs").first()).toEqual({
    detail_for: null,
  });
  fetcher.mockClear();
  expect(await acquire(fetcher, undefined, { calls: 3, pages: 1 })).toBe("complete");
  expect(fetcher).toHaveBeenCalledTimes(3);
  expect(calls(fetcher, "GetOrders")).toBe(1);
});

it("legge dati fiscali e immagini una volta per versione, senza bloccare l'ordine", async () => {
  // Due righe della stessa inserzione (varianti) richiedono una sola lettura.
  const [line] = order().lineItems;
  const failing = ebay({
    orders: [order({ lineItems: [line, { ...line, lineItemId: "10000000002" }] })],
    getItem: () => new Response(null, { status: 503 }),
  });
  expect(await acquire(failing)).toBe("complete");
  expect(calls(failing, "GetItem")).toBe(1);
  expect(await env.DB.prepare("SELECT image_url FROM order_items").all()).toMatchObject({
    results: [{ image_url: null }, { image_url: null }],
  });
  expect(await env.DB.prepare("SELECT value FROM tax_identifiers").all()).toMatchObject({
    results: [{ value: "SINTETICO" }],
  });

  // La stessa versione non si rilegge.
  const same = ebay({ orders: failing.orders });
  await acquire(same, "2026-09-02T01:00:00.000Z");
  expect([calls(same, "GetItem"), calls(same, "GetOrders")]).toEqual([0, 0]);

  // Una nuova versione rilegge immagini e dati fiscali.
  failing.orders[0] = { ...failing.orders[0]!, lastModifiedDate: "2026-09-02T02:00:00.000Z" };
  const working = ebay({ orders: failing.orders });
  await acquire(working, "2026-09-02T03:00:00.000Z");
  expect([calls(working, "GetItem"), calls(working, "GetOrders")]).toEqual([1, 1]);
  expect(await env.DB.prepare("SELECT image_url FROM order_items").all()).toMatchObject({
    results: [{ image_url: image }, { image_url: image }],
  });

  // Con l'immagine già salvata non si richiama GetItem e la rilettura la conserva.
  failing.orders[0] = { ...failing.orders[0]!, lastModifiedDate: "2026-09-02T04:00:00.000Z" };
  const again = ebay({ orders: failing.orders });
  await acquire(again, "2026-09-02T05:00:00.000Z");
  expect([calls(again, "GetItem"), calls(again, "GetOrders")]).toEqual([0, 1]);
  expect(await env.DB.prepare("SELECT image_url FROM order_items").all()).toMatchObject({
    results: [{ image_url: image }, { image_url: image }],
  });
});

it("legge l'immagine di un'inserzione una sola volta anche in ordini diversi", async () => {
  const [line] = order().lineItems;
  const first = ebay({ orders: [order()] });
  await acquire(first);
  expect(calls(first, "GetItem")).toBe(1);

  // Un altro acquisto della stessa inserzione riusa l'immagine già salvata.
  const second = ebay({
    orders: [
      ...first.orders,
      order({
        orderId: "12-34567-89013",
        lastModifiedDate: "2026-09-02T00:30:00.000Z",
        lineItems: [{ ...line, lineItemId: "10000000003" }],
      }),
    ],
  });
  await acquire(second, "2026-09-02T01:00:00.000Z");
  expect(calls(second, "GetItem")).toBe(0);
  expect(
    await env.DB.prepare(
      "SELECT i.image_url FROM order_items i JOIN orders o ON o.id = i.order_id WHERE o.ebay_order_id = '12-34567-89013'",
    ).first(),
  ).toEqual({ image_url: image });
});

it("importa lo storico a tratti e riprende dal primo tratto non applicato", async () => {
  let requests = 0;
  const failing = ebay({
    orders: series("12-storico", 60, "2026-09-02T00:00:00.000Z"),
    pageLimit: 25,
    fail: (url) => {
      if (!url.searchParams.get("filter")?.startsWith("creationdate:")) return undefined;
      requests += 1;
      return requests === 4 ? new Response(null, { status: 503 }) : undefined;
    },
  });
  await expect(acquire(failing)).rejects.toMatchObject({ failure: "unavailable" });
  const applied = "2026-08-31T19:00:00.000Z";
  expect(slices(failing, "creationdate")).toEqual([
    "2026-08-03T00:00:00.000Z..2026-09-02T00:00:00.000Z",
    "2026-09-01T15:00:00.000Z..2026-09-02T00:00:00.000Z",
    `${applied}..2026-09-01T15:00:00.000Z`,
    expect.stringMatching(new RegExp(`\\.\\.${applied}$`, "u")),
  ]);
  expect(await syncState()).toMatchObject({
    history_through: applied,
    history_done_at: null,
    locked_until: null,
  });
  // I due tratti applicati, estremi compresi: un ordine all'ora fra le 19 e la mezzanotte.
  expect(await count("SELECT COUNT(*) AS total FROM orders")).toBe(29);

  const resumed = ebay({ orders: failing.orders, pageLimit: 25 });
  expect(await acquire(resumed, "2026-09-02T00:30:00.000Z")).toBe("complete");
  // Nessun tratto già applicato si rilegge.
  expect(slices(resumed, "creationdate").every((range) => range.split("..")[1]! <= applied)).toBe(
    true,
  );
  expect(await count("SELECT COUNT(*) AS total FROM orders")).toBe(60);
  expect(
    await count(
      "SELECT COUNT(*) AS total FROM order_source_refs WHERE detail_for = last_modified_time",
    ),
  ).toBe(60);
  expect(await syncState()).toMatchObject({
    history_through: null,
    history_done_at: "2026-09-02T00:30:00.000Z",
  });
  // Storico completo: le esecuzioni successive non lo rileggono.
  const later = ebay({ orders: failing.orders });
  await acquire(later, "2026-09-02T01:00:00.000Z");
  expect(slices(later, "creationdate")).toEqual([]);
});

it("con le chiamate eBay spente durante la lettura si ferma prima del tratto successivo", async () => {
  const stopping = ebay({
    orders: series("12-spento", 60, "2026-09-02T00:00:00.000Z"),
    pageLimit: 25,
    before: async (url) => {
      if (url.searchParams.get("filter")?.startsWith("creationdate:"))
        await setSwitch(env.DB, "ebay_calls", false, new Date("2026-09-02T00:00:00.000Z"));
    },
  });
  expect(await acquire(stopping)).toBe("budget");
  expect(slices(stopping, "creationdate")).toEqual([
    "2026-08-03T00:00:00.000Z..2026-09-02T00:00:00.000Z",
  ]);
  // Nemmeno il dettaglio parte: lo storico resta da completare.
  expect(stopping.mock.calls.filter(([input]) => String(input).includes("/order/"))).toEqual([]);

  await setSwitch(env.DB, "ebay_calls", true, new Date("2026-09-02T00:20:00.000Z"));
  const resumed = ebay({ orders: stopping.orders, pageLimit: 25 });
  expect(await acquire(resumed, "2026-09-02T00:30:00.000Z")).toBe("complete");
  expect(slices(resumed, "creationdate")[0]).toBe(
    "2026-08-03T00:00:00.000Z..2026-09-02T00:00:00.000Z",
  );
  expect(await count("SELECT COUNT(*) AS total FROM orders")).toBe(60);

  // Spente durante i recenti: la lettura non conta come sincronizzazione e non prosegue.
  const recent = series("12-recente", 60, "2026-09-02T00:00:00.000Z").map((item, index) => ({
    ...item,
    lastModifiedDate: new Date(
      Date.parse("2026-09-02T00:40:00.000Z") + index * 1_000,
    ).toISOString(),
  }));
  let reads = 0;
  const paused = ebay({
    orders: recent,
    pageLimit: 25,
    before: async (url) => {
      if (!url.searchParams.get("filter")?.startsWith("lastmodifieddate:")) return;
      reads += 1;
      if (reads === 3)
        await setSwitch(env.DB, "ebay_calls", false, new Date("2026-09-02T01:00:00.000Z"));
    },
  });
  expect(await acquire(paused, "2026-09-02T01:00:00.000Z")).toBe("budget");
  // Il tratto vuoto prima degli ordini è applicato; quello denso si ferma con le chiamate.
  expect(slices(paused, "lastmodifieddate")).toEqual([
    "2026-09-02T00:15:00.000Z..2026-09-02T01:00:00.000Z",
    "2026-09-02T00:15:00.000Z..2026-09-02T00:37:30.000Z",
    "2026-09-02T00:37:30.000Z..2026-09-02T01:00:00.000Z",
  ]);
  expect(calls(paused, "GetStore")).toBe(0);
  expect(await syncState()).toMatchObject({
    cursor: "2026-09-02T00:37:30.000Z",
    recent_end: "2026-09-02T01:00:00.000Z",
    last_success_at: "2026-09-02T00:30:00.000Z",
  });

  await setSwitch(env.DB, "ebay_calls", true, new Date("2026-09-02T01:05:00.000Z"));
  const caught = ebay({ orders: recent, pageLimit: 25 });
  expect(await acquire(caught, "2026-09-02T01:10:00.000Z")).toBe("complete");
  // La passata riprende dal tratto non applicato, senza sovrapposizione.
  expect(slices(caught, "lastmodifieddate")[0]).toBe(
    "2026-09-02T00:37:30.000Z..2026-09-02T01:00:00.000Z",
  );
  expect(await syncState()).toMatchObject({
    cursor: "2026-09-02T01:00:00.000Z",
    last_success_at: "2026-09-02T01:10:00.000Z",
  });
  expect(await count("SELECT COUNT(*) AS total FROM orders")).toBe(120);
});

it("con le chiamate eBay spente durante la lettura Trading la riprende dalla pagina successiva", async () => {
  const requested: string[] = [];
  const provider = ebay({
    orders: [],
    before: async (_, init) => {
      const body = String(init?.body);
      if (body.includes("<ModTimeFrom>") && body.includes("<PageNumber>1</PageNumber>"))
        await setSwitch(env.DB, "ebay_calls", false, new Date("2026-09-02T00:00:00.000Z"));
    },
    fail: (_, init) => {
      const body = String(init?.body);
      if (!body.includes("<ModTimeFrom>")) return;
      const page = /<PageNumber>(\d+)<\/PageNumber>/u.exec(body)![1]!;
      requested.push(page);
      return new Response(
        `<GetOrdersResponse><Ack>Success</Ack><PaginationResult><TotalNumberOfEntries>2</TotalNumberOfEntries></PaginationResult>` +
          `<HasMoreOrders>${page === "1"}</HasMoreOrders><OrderArray><Order><OrderID>P-${page}</OrderID><OrderStatus>Active</OrderStatus>` +
          `<CreatedTime>2026-09-01T10:00:00Z</CreatedTime><CheckoutStatus><LastModifiedTime>2026-09-01T11:00:00Z</LastModifiedTime></CheckoutStatus>` +
          `<Total currencyID="EUR">1.00</Total><TransactionArray><Transaction><Item><ItemID>123</ItemID><Title>Sintetico</Title></Item>` +
          `<TransactionID>${page}</TransactionID><QuantityPurchased>1</QuantityPurchased></Transaction></TransactionArray></Order></OrderArray></GetOrdersResponse>`,
      );
    },
  });
  expect(await acquire(provider)).toBe("budget");
  expect(requested).toEqual(["1"]);
  expect(
    await env.DB.prepare("SELECT trading_cursor, trading_page FROM sync_state").first(),
  ).toEqual({ trading_cursor: null, trading_page: 2 });

  await setSwitch(env.DB, "ebay_calls", true, new Date("2026-09-02T00:05:00.000Z"));
  expect(await acquire(provider, "2026-09-02T00:10:00.000Z")).toBe("complete");
  expect(requested).toEqual(["1", "2"]);
  expect(
    await env.DB.prepare("SELECT trading_cursor, trading_page FROM sync_state").first(),
  ).toEqual({ trading_cursor: "2026-09-02T00:00:00.000Z", trading_page: null });
});

it("una passata lasciata a metà dalla paginazione precedente riparte con la sovrapposizione", async () => {
  await acquire(ebay({ orders: [] }));
  await env.DB.prepare("UPDATE sync_state SET recent_end = ?1, recent_next = ?2, recent_total = 60")
    .bind("2026-09-02T00:30:00.000Z", "https://api.ebay.com/sell/fulfillment/v1/order?offset=25")
    .run();
  const fetcher = ebay({ orders: [] });
  expect(await acquire(fetcher, "2026-09-02T01:00:00.000Z")).toBe("complete");
  expect(slices(fetcher, "lastmodifieddate")).toEqual([
    "2026-09-01T23:45:00.000Z..2026-09-02T01:00:00.000Z",
  ]);
});

it("stringe un tratto denso dal campione della pagina, nell'ordine delle date", async () => {
  await acquire(ebay({ orders: [] }));
  // Creati e modificati in ordine: eBay restituisce per primi i più recenti, i più lontani
  // dall'inizio del tratto, e il confine si ricava dal campione ordinato per data.
  const orders = series("12-denso", 60, "2026-09-02T00:30:00.000Z").map((item, index) => ({
    ...item,
    lastModifiedDate: new Date(
      Date.parse("2026-09-02T00:06:00.000Z") - index * 20_000,
    ).toISOString(),
  }));
  const fetcher = ebay({ orders, pageLimit: 25 });
  expect(await acquire(fetcher, "2026-09-02T01:00:00.000Z")).toBe("complete");
  expect(slices(fetcher, "lastmodifieddate").slice(0, 2)).toEqual([
    "2026-09-01T23:45:00.000Z..2026-09-02T01:00:00.000Z",
    "2026-09-01T23:45:00.000Z..2026-09-02T00:00:40.000Z",
  ]);
  expect(await count("SELECT COUNT(*) AS total FROM orders")).toBe(60);
});

it("una data illeggibile nella pagina non ferma la lettura dei tratti", async () => {
  await acquire(ebay({ orders: [] }));
  const orders = series("12-leggibile", 30, "2026-09-02T00:30:00.000Z").map((item, index) => ({
    ...item,
    lastModifiedDate: new Date(
      Date.parse("2026-09-02T00:40:00.000Z") + index * 1_000,
    ).toISOString(),
  }));
  let first = true;
  const fetcher = ebay({
    orders,
    pageLimit: 25,
    fail: (url) => {
      if (!first || !url.searchParams.get("filter")?.startsWith("lastmodifieddate:")) return;
      first = false;
      return Response.json({
        orders: orders.slice(0, 25).map(({ lastModifiedDate: _, ...order }) => order),
        total: 30,
        next: `${url.href}&offset=25`,
      });
    },
  });
  expect(await acquire(fetcher, "2026-09-02T01:00:00.000Z")).toBe("complete");
  expect(await count("SELECT COUNT(*) AS total FROM orders")).toBe(30);
});

it("non salta ordini se l'elenco cambia durante la lettura dei tratti", async () => {
  await acquire(ebay({ orders: [] }));
  // Ordini ancora conservabili, modificati dopo l'ultimo limite dei recenti.
  const orders = series("12-recente", 60, "2026-09-01T00:00:00.000Z").map((item, index) => ({
    ...item,
    lastModifiedDate: new Date(Date.parse("2026-09-02T00:30:00.000Z") + index).toISOString(),
  }));
  let moved = false;
  const fetcher = ebay({
    orders,
    pageLimit: 25,
    // Appena applicato, un ordine esce dall'intervallo: con la paginazione per offset la
    // pagina seguente salterebbe il primo ordine non ancora letto.
    before: async (url) => {
      if (moved || !url.searchParams.get("filter")?.startsWith("lastmodifieddate:")) return;
      const read = await env.DB.prepare("SELECT 1 FROM orders WHERE ebay_order_id = ?")
        .bind(orders[0]!.orderId)
        .first();
      if (!read) return;
      moved = true;
      orders[0] = { ...orders[0]!, lastModifiedDate: "2026-09-03T00:00:00.000Z" };
    },
  });
  expect(await acquire(fetcher, "2026-09-02T01:00:00.000Z")).toBe("complete");
  expect(moved).toBe(true);
  expect(await count("SELECT COUNT(*) AS total FROM orders")).toBe(60);
  expect(await count("SELECT COUNT(*) AS total FROM order_source_refs")).toBe(60);
  expect(await syncState()).toMatchObject({
    cursor: "2026-09-02T01:00:00.000Z",
    recent_end: null,
    last_success_at: "2026-09-02T01:00:00.000Z",
  });

  // La passata successiva parte dal limite con la sovrapposizione e trova la modifica.
  const next = ebay({ orders });
  await acquire(next, "2026-09-03T01:00:00.000Z");
  const [filter] = next.mock.calls.map(([input]) =>
    new URL(String(input)).searchParams.get("filter"),
  );
  expect(filter).toBe("lastmodifieddate:[2026-09-02T00:45:00.000Z..2026-09-03T01:00:00.000Z]");
  expect(
    await env.DB.prepare(
      "SELECT last_modified_time FROM order_source_refs WHERE external_order_id = ?",
    )
      .bind(orders[0]!.orderId)
      .first(),
  ).toEqual({ last_modified_time: "2026-09-03T00:00:00.000Z" });
});

it("conclude i recenti con oltre 75 ordini modificati anche se eBay li cambia durante la lettura", async () => {
  await acquire(ebay({ orders: [] }));
  const orders = series("12-attivo", 80, "2026-09-01T00:00:00.000Z").map((item, index) => ({
    ...item,
    lastModifiedDate: new Date(Date.parse("2026-09-02T00:30:00.000Z") + index).toISOString(),
  }));
  const fetcher = ebay({
    orders,
    // Ogni lettura dell'elenco trova un ordine in più, indicizzato da eBay in ritardo.
    before: (url) => {
      if (!url.searchParams.get("filter")?.startsWith("lastmodifieddate:")) return;
      orders.push(
        order({
          orderId: `12-ritardo-${orders.length}`,
          creationDate: "2026-09-01T12:00:00.000Z",
          lastModifiedDate: "2026-09-02T00:40:00.000Z",
          lineItems: [],
        }),
      );
    },
  });
  expect(await acquire(fetcher, "2026-09-02T01:00:00.000Z")).toBe("complete");
  expect(await count("SELECT COUNT(*) AS total FROM orders")).toBeGreaterThan(80);
  expect(await syncState()).toMatchObject({
    cursor: "2026-09-02T01:00:00.000Z",
    last_success_at: "2026-09-02T01:00:00.000Z",
  });
});

it("acquisisce i nuovi ordini prima di completare lo storico e ne mostra l'avanzamento", async () => {
  // Le letture riuscite non scrivono log: restano soltanto gli aggregati e l'ultimo stato.
  const log = vi.spyOn(console, "log");
  const info = vi.spyOn(console, "info");
  const orders = series("12-storico", 60, "2026-09-02T00:00:00.000Z");
  const small = { calls: 4, pages: 4 };
  // Prima del primo avvio lo storico non ha ancora una finestra.
  expect((await listStores(env.DB, "u-a"))[0]).toMatchObject({ history: null, syncing: false });
  await acquire(ebay({ orders, pageLimit: 25 }), "2026-09-02T00:00:00.000Z", { ...small });
  // Un tratto troppo denso e poi le ultime nove ore, un ordine all'ora.
  expect(await count("SELECT COUNT(*) AS total FROM orders")).toBe(9);
  expect((await listStores(env.DB, "u-a", new Date("2026-09-02T00:10:00.000Z")))[0]).toMatchObject({
    id: "s-a",
    history: { days: 30, done: false },
    lastSyncAt: "2026-09-02T00:00:00.000Z",
  });

  orders.push(
    order({
      orderId: "12-nuovo",
      creationDate: "2026-09-02T00:20:00.000Z",
      lastModifiedDate: "2026-09-02T00:21:00.000Z",
      lineItems: [],
    }),
  );
  const fetcher = ebay({ orders, pageLimit: 25 });
  expect(await acquire(fetcher, "2026-09-02T00:30:00.000Z", { calls: 3, pages: 3 })).toBe("budget");
  // Prima i recenti, poi un tratto troppo denso e uno applicato dello storico: il nuovo ordine
  // non attende lo storico. Trading, letto da meno di due ore, non usa il budget.
  expect(
    fetcher.mock.calls.map(
      ([input]) => new URL(String(input)).searchParams.get("filter")?.split(":")[0],
    ),
  ).toEqual(["lastmodifieddate", "creationdate", "creationdate"]);
  expect(
    await env.DB.prepare("SELECT 1 AS found FROM orders WHERE ebay_order_id = '12-nuovo'").first(),
  ).toEqual({ found: 1 });
  expect(await syncState()).toMatchObject({
    history_through: "2026-09-01T06:00:00.000Z",
    history_done_at: null,
  });

  expect(await acquire(ebay({ orders }), "2026-09-02T01:00:00.000Z")).toBe("complete");
  expect(await count("SELECT COUNT(*) AS total FROM orders")).toBe(61);
  expect((await listStores(env.DB, "u-a", new Date("2026-09-02T01:00:00.000Z")))[0]).toMatchObject({
    history: { days: 30, done: true },
  });
  expect(log).not.toHaveBeenCalled();
  expect(info).not.toHaveBeenCalled();
  // Tre letture riuscite: un solo giorno aggregato e la prima lettura alla prima esecuzione.
  expect(
    await env.DB.prepare("SELECT day, attempts, failures FROM sync_daily").all(),
  ).toMatchObject({ results: [{ day: "2026-09-02", attempts: 3, failures: 0 }] });
  const { results: steps } = await env.DB.prepare(
    "SELECT step, occurred_at AS at FROM workspace_funnel_steps WHERE workspace_id = 'w-a'",
  ).all<{ step: string; at: string }>();
  expect(steps).toEqual(
    expect.arrayContaining([
      { step: "first_sync", at: "2026-09-02T00:00:00.000Z" },
      { step: "first_order", at: expect.any(String) },
    ]),
  );
});

it("una rilettura con dati mascherati non cancella quelli già acquisiti", async () => {
  await acquire(ebay());
  await env.DB.prepare("UPDATE orders SET retention_until = ?1, purge_after = ?1")
    .bind("2027-09-01T08:00:00.000Z")
    .run();
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
  await acquire(ebay({ orders: [masked] }), "2026-12-02T00:00:00.000Z");
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
  await env.DB.batch([
    env.DB.prepare("DELETE FROM orders"),
    env.DB.prepare("DELETE FROM deleted_order_keys"),
    env.DB.prepare("DELETE FROM sync_state"),
  ]);
  await acquire(
    ebay({
      orders: [
        order({
          buyer: {
            username: "acquirente-sintetico",
            buyerRegistrationAddress: { fullName: "Maria Verdi", email: "a@example.invalid" },
          },
          fulfillmentStartInstructions: [],
        }),
      ],
    }),
  );
  await env.DB.prepare("UPDATE orders SET retention_until = ?1, purge_after = ?1")
    .bind("2027-09-01T08:00:00.000Z")
    .run();
  await acquire(ebay({ orders: [masked] }), "2026-12-02T00:00:00.000Z");
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

  // Senza una lettura precedente il piano Free non importa l'ordine fuori finestra.
  await env.DB.batch([
    env.DB.prepare("DELETE FROM orders"),
    env.DB.prepare("DELETE FROM deleted_order_keys"),
    env.DB.prepare("DELETE FROM sync_state"),
  ]);
  // Un ordine creato prima dello storico arriva dai recenti, dopo il primo avvio.
  await acquire(ebay({ orders: [] }), "2026-12-01T00:00:00.000Z");
  await acquire(ebay({ orders: [masked] }), "2026-12-02T00:00:00.000Z");
  expect(await env.DB.prepare("SELECT buyer_json FROM orders").first()).toBeNull();
});

it("classifica gli ordini non pagati senza rappresentarli come incassati", async () => {
  await acquire(
    ebay({
      orders: [order({ orderPaymentStatus: "PENDING", orderFulfillmentStatus: undefined })],
    }),
  );
  const [visible] = await listVisibleOrders(env.DB, "u-a");
  expect(visible!.summary).toMatchObject({
    orderPaymentStatus: "PENDING",
    payment: "unpaid",
    shipping: null,
  });
});
