import { env } from "cloudflare:workers";

import { describe, expect, it, vi } from "vitest";

import { listVisibleOrders } from "../app/domain/orders.server";

import { recordOrderObservation } from "../app/domain/order-import.server";

import { setSwitch } from "../app/domain/service-settings.server";

import { now } from "./fixtures/database-fixtures";

import { line, observation } from "./fixtures/order-import-scenarios";

import {
  grantedAt,
  ebay,
  acquire,
  syncState,
  tradingFailure,
  tradingPasses,
  setupScenarios,
} from "./fixtures/order-acquisition-scenarios";

setupScenarios();

it("riprende le pagine Trading senza avanzare il limite e consolida gli acquisti prima del checkout", async () => {
  const page = (id: string, key: string, more: boolean, status = "Active") =>
    `<GetOrdersResponse><Ack>Success</Ack><PaginationResult><TotalNumberOfEntries>2</TotalNumberOfEntries></PaginationResult>
        <HasMoreOrders>${more}</HasMoreOrders><OrderArray><Order><OrderID>${id}</OrderID><OrderStatus>${status}</OrderStatus>
        <CreatedTime>2026-09-01T10:00:00Z</CreatedTime><CheckoutStatus><LastModifiedTime>2026-09-01T11:00:00Z</LastModifiedTime></CheckoutStatus>
        <Total currencyID="EUR">1.00</Total><TransactionArray><Transaction><Item><ItemID>123</ItemID><Title>Sintetico</Title></Item>
        <TransactionID>${key}</TransactionID><OrderLineItemID>123-${key}</OrderLineItemID><QuantityPurchased>1</QuantityPurchased>
        </Transaction></TransactionArray></Order></OrderArray></GetOrdersResponse>`;
  const requested: string[] = [];
  let failPage = false;
  const provider = ebay({
    orders: [],
    fail: (_, init) => {
      const body = String(init?.body);
      if (!body.includes("<ModTimeFrom>")) return;
      requested.push(body);
      if (failPage) return new Response(null, { status: 503 });
      return new Response(
        body.includes("<PageNumber>1</PageNumber>")
          ? page("P-1", "1", true)
          : page("P-2", "2", false),
      );
    },
  });
  expect(await acquire(provider, undefined, { calls: 2, pages: 2 })).toBe("budget");
  expect(
    await env.DB.prepare("SELECT trading_cursor, trading_page FROM sync_state").first(),
  ).toEqual({ trading_cursor: null, trading_page: 2 });
  failPage = true;
  // Trading non disponibile: la passata resta da riprendere, il resto prosegue.
  expect(await acquire(provider, "2026-09-02T00:05:00.000Z")).toBe("budget");
  expect(
    await env.DB.prepare(
      "SELECT trading_cursor, trading_page, last_success_at, history_done_at IS NOT NULL AS history FROM sync_state",
    ).first(),
  ).toEqual({
    trading_cursor: null,
    trading_page: 2,
    last_success_at: "2026-09-02T00:05:00.000Z",
    history: 1,
  });
  failPage = false;
  expect(await acquire(provider, "2026-09-02T00:10:00.000Z")).toBe("complete");
  expect(requested).toHaveLength(3);
  expect(requested[1]).toContain("<PageNumber>2</PageNumber>");
  expect(requested[1]).toContain("<ModTimeTo>2026-09-02T00:00:00.000Z</ModTimeTo>");
  expect(
    await env.DB.prepare("SELECT trading_cursor, trading_page FROM sync_state").first(),
  ).toEqual({ trading_cursor: "2026-09-02T00:00:00.000Z", trading_page: null });
  // I due acquisti prima del checkout restano fuori dalle viste fino al definitivo.
  expect(
    (
      await env.DB.prepare(
        "SELECT payment_status, is_provisional FROM orders WHERE merged_into IS NULL",
      ).all()
    ).results,
  ).toEqual([
    { payment_status: "PENDING", is_provisional: 1 },
    { payment_status: "PENDING", is_provisional: 1 },
  ]);
  expect(await listVisibleOrders(env.DB, "u-a")).toEqual([]);
  await recordOrderObservation(
    env.DB,
    { storeId: "s-a", consentGrantedAt: grantedAt, observedAt: now },
    {
      source: "fulfillment",
      externalOrderId: "D-1",
      provisional: false,
      creationTime: "2026-09-01T10:00:00Z",
      lastModifiedTime: "2026-09-02T01:00:00Z",
      total: { currency: "EUR", minor: 200 },
      buyer: {},
      paymentStatus: "PAID",
      items: ["1", "2"].map((key) => ({
        lineItemId: `new-${key}`,
        stableKey: `123-${key}`,
        title: "Sintetico",
        quantity: 1,
        total: null,
      })),
    },
  );
  expect(await listVisibleOrders(env.DB, "u-a")).toMatchObject([
    { ebayOrderId: "D-1", summary: { payment: "paid" } },
  ]);
  expect(await listVisibleOrders(env.DB, "u-a")).toHaveLength(1);
});

it("ferma l'esecuzione per le credenziali rifiutate da Trading", async () => {
  await expect(acquire(tradingFailure("931"))).rejects.toMatchObject({
    failure: "credentials",
  });
});

it("con la quota GetOrders esaurita sospende soltanto Trading", async () => {
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});
  const limited = tradingFailure("518");
  expect(await acquire(limited)).toBe("budget");
  expect(await syncState()).toMatchObject({ last_success_at: "2026-09-02T00:00:00.000Z" });
  expect(
    await env.DB.prepare("SELECT api_origin, until FROM ebay_rate_limits").all(),
  ).toMatchObject({
    results: [{ api_origin: "https://api.ebay.com#GetOrders", until: "2026-09-02T00:15:00.000Z" }],
  });
  // Anche una richiesta manuale attende la quota Trading, mentre Fulfillment prosegue.
  await env.DB.prepare("UPDATE sync_state SET requested_at = '2026-09-02T00:09:00.000Z'").run();
  const next = ebay({ orders: [] });
  expect(await acquire(next, "2026-09-02T00:10:00.000Z")).toBe("budget");
  expect(tradingPasses(next)).toBe(0);
  expect(next).toHaveBeenCalled();
  expect(await syncState()).toMatchObject({ last_success_at: "2026-09-02T00:10:00.000Z" });
  logged.mockRestore();
});

describe("cadenza della passata Trading", () => {
  const emptyTrading = () =>
    ebay({
      orders: [],
      fail: (_, init) =>
        String(init?.body).includes("<ModTimeFrom>")
          ? new Response(
              `<GetOrdersResponse><Ack>Success</Ack><PaginationResult><TotalNumberOfEntries>0</TotalNumberOfEntries></PaginationResult>` +
                `<HasMoreOrders>false</HasMoreOrders><OrderArray></OrderArray></GetOrdersResponse>`,
            )
          : undefined,
    });
  // Passate Trading dopo la prima, alla mezz'ora e poi a ogni ora indicata.
  const passesAt = async (provider: ReturnType<typeof ebay>, hours: number[]) => {
    const passes: number[] = [];
    for (const hour of hours) {
      const at = new Date(Date.parse("2026-09-02T00:00:00.000Z") + hour * 3_600_000);
      expect(await acquire(provider, at.toISOString())).toBe("complete");
      passes.push(tradingPasses(provider));
    }
    return passes;
  };

  it("ogni sei ore senza fatture combinate, subito al collegamento e su richiesta manuale", async () => {
    const provider = emptyTrading();
    expect(await acquire(provider)).toBe("complete");
    expect(tradingPasses(provider)).toBe(1);
    expect(await acquire(provider, "2026-09-02T01:00:00.000Z")).toBe("complete");
    expect(tradingPasses(provider)).toBe(1);
    // A metà intervallo la richiesta manuale legge Trading subito e riparte da lì.
    await env.DB.prepare("UPDATE sync_state SET requested_at = '2026-09-02T01:20:00.000Z'").run();
    expect(await acquire(provider, "2026-09-02T01:30:00.000Z")).toBe("complete");
    expect(tradingPasses(provider)).toBe(2);
    expect(await acquire(provider, "2026-09-02T03:30:00.000Z")).toBe("complete");
    expect(tradingPasses(provider)).toBe(2);
    expect(await acquire(provider, "2026-09-02T07:29:59.999Z")).toBe("complete");
    expect(tradingPasses(provider)).toBe(2);
    expect(await acquire(provider, "2026-09-02T07:30:00.000Z")).toBe("complete");
    expect(tradingPasses(provider)).toBe(3);
  });

  it("ogni due ore con una fattura combinata senza checkout negli ultimi trenta giorni", async () => {
    await recordOrderObservation(
      env.DB,
      { storeId: "s-a", consentGrantedAt: grantedAt, observedAt: "2026-09-01T10:00:00.000Z" },
      observation({
        source: "trading",
        externalOrderId: "T-COMBINATA",
        creationTime: "2026-08-20T10:00:00Z",
        items: [line("k9", "t-9")],
      }),
    );
    const provider = emptyTrading();
    expect(await passesAt(provider, [0, 1.99, 2, 4])).toEqual([1, 1, 2, 3]);
    // Fino a trenta giorni dalla fattura la cadenza resta di due ore, poi torna di sei.
    const late = emptyTrading();
    await env.DB.prepare("UPDATE sync_state SET trading_cursor = '2026-09-19T05:00:00.000Z'").run();
    expect(await acquire(late, "2026-09-19T09:00:00.000Z")).toBe("complete");
    expect(tradingPasses(late)).toBe(1);
    await env.DB.prepare("UPDATE sync_state SET trading_cursor = '2026-09-19T08:00:00.000Z'").run();
    expect(await acquire(late, "2026-09-19T12:00:00.000Z")).toBe("complete");
    expect(tradingPasses(late)).toBe(1);
  });

  it("ogni dodici ore in uno spazio senza sessioni aperte né Telegram", async () => {
    await env.DB.prepare(`DELETE FROM "session"`).run();
    const provider = emptyTrading();
    expect(await passesAt(provider, [0, 6, 11.99, 12])).toEqual([1, 1, 1, 2]);
    // Con Telegram collegato lo spazio è seguito anche senza visite.
    await env.DB.prepare(
      `INSERT INTO telegram_links (workspace_id, id, chat_id, language, linked_at)
       VALUES ('w-a', 'link-a', '1', 'it', ?)`,
    )
      .bind(now)
      .run();
    expect(await passesAt(provider, [17.99, 18])).toEqual([2, 3]);
  });
});

it("legge Trading nella finestra dello storico, salta l'ordine illeggibile e ricomincia se il totale cambia", async () => {
  const tradingOrder = (id: string, created: string, keys: string[]) =>
    `<Order><OrderID>${id}</OrderID><OrderStatus>Active</OrderStatus><CreatedTime>${created}</CreatedTime>` +
    `<CheckoutStatus><LastModifiedTime>2026-09-01T11:00:00Z</LastModifiedTime></CheckoutStatus>` +
    `<Total currencyID="EUR">1.00</Total><TransactionArray>` +
    keys
      .map(
        (key) =>
          `<Transaction><Item><ItemID>123</ItemID><Title>Sintetico</Title></Item>` +
          `<TransactionID>${key}</TransactionID><QuantityPurchased>1</QuantityPurchased></Transaction>`,
      )
      .join("") +
    `</TransactionArray></Order>`;
  const tradingPage = (total: number, more: boolean, orders: string[]) =>
    new Response(
      `<GetOrdersResponse><Ack>Success</Ack><PaginationResult><TotalNumberOfEntries>${total}</TotalNumberOfEntries></PaginationResult>` +
        `<HasMoreOrders>${more}</HasMoreOrders><OrderArray>${orders.join("")}</OrderArray></GetOrdersResponse>`,
    );
  let responses: Array<() => Response> = [];
  const requested: string[] = [];
  const provider = ebay({
    orders: [],
    fail: (_, init) => {
      const body = String(init?.body);
      if (!body.includes("<ModTimeFrom>")) return;
      requested.push(body);
      return responses.shift()!();
    },
  });
  const field = (body: string, tag: string) =>
    new RegExp(`<${tag}>([^<]*)</${tag}>`, "u").exec(body)![1];
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});
  const failures = () =>
    logged.mock.calls.map(([line]) => JSON.parse(String(line)) as Record<string, string>);

  // Alla scadenza esatta l'ordine è già fuori retention.
  responses = [
    () =>
      tradingPage(4, true, [
        tradingOrder("VECCHIO", "2026-08-02T23:59:59.999Z", ["1"]),
        tradingOrder("SCADUTO", "2026-08-03T00:00:00.000Z", ["4"]),
        tradingOrder("LIMITE", "2026-08-03T00:00:00.001Z", ["2"]),
      ]),
    () =>
      tradingPage(4, false, [
        tradingOrder("DOPPIO", "2026-09-01T10:00:00Z", ["9", "9"]),
        tradingOrder("VALIDO", "2026-09-01T10:00:00Z", ["3"]),
      ]),
  ];
  expect(await acquire(provider)).toBe("complete");
  expect(requested.map((body) => field(body, "ModTimeFrom"))).toEqual([
    "2026-08-03T00:00:00.000Z",
    "2026-08-03T00:00:00.000Z",
  ]);
  expect(
    await env.DB.prepare("SELECT ebay_order_id FROM orders ORDER BY ebay_order_id")
      .all()
      .then(({ results }) => results),
  ).toEqual([{ ebay_order_id: "LIMITE" }, { ebay_order_id: "VALIDO" }]);
  expect(failures()).toEqual([
    expect.objectContaining({ operation: "order_acquisition", failure: "invalid_response" }),
  ]);

  // Stesso istante: la passata è già conclusa e Trading non viene chiamato.
  expect(await acquire(provider)).toBe("complete");
  expect(requested).toHaveLength(2);

  // Totale cambiato a metà: la passata ricomincia dalla prima pagina.
  responses = [
    () => tradingPage(2, true, [tradingOrder("VALIDO", "2026-09-01T10:00:00Z", ["3"])]),
    () => tradingPage(3, true, [tradingOrder("LIMITE", "2026-08-03T00:00:00.001Z", ["2"])]),
    () => tradingPage(3, false, [tradingOrder("VALIDO", "2026-09-01T10:00:00Z", ["3"])]),
  ];
  expect(await acquire(provider, "2026-09-02T06:00:00.000Z")).toBe("complete");
  expect(requested.slice(2).map((body) => field(body, "PageNumber"))).toEqual(["1", "2", "1"]);
  expect(field(requested[2]!, "ModTimeFrom")).toBe("2026-09-01T23:45:00.000Z");

  // Budget finito durante Trading: l'esecuzione non si dichiara completa.
  responses = [() => tradingPage(2, true, [tradingOrder("VALIDO", "2026-09-01T10:00:00Z", ["3"])])];
  expect(await acquire(provider, "2026-09-02T12:00:00.000Z", { calls: 2, pages: 2 })).toBe(
    "budget",
  );

  // Trading non disponibile: errore registrato, il resto dell'esecuzione prosegue.
  // Con l'orologio indietro la passata interrotta riprende comunque.
  responses = [() => new Response(null, { status: 503 })];
  expect(await acquire(provider, "2026-09-02T00:30:00.000Z")).toBe("budget");
  expect(requested).toHaveLength(7);
  expect(failures().at(-1)).toMatchObject({
    operation: "order_acquisition",
    failure: "unavailable",
  });
  // Un ordine con scadenza esplicita resta aggiornabile oltre la finestra Free.
  await env.DB.prepare("UPDATE orders SET retention_until = ?1, purge_after = ?1")
    .bind("2027-09-01T00:00:00.000Z")
    .run();
  await env.DB.prepare(
    "UPDATE sync_state SET trading_end = NULL, trading_page = NULL, trading_total = NULL",
  ).run();
  responses = [
    () =>
      tradingPage(1, false, [
        tradingOrder("VALIDO", "2026-09-01T10:00:00Z", ["3"]).replace(
          "2026-09-01T11:00:00Z",
          "2026-10-03T00:00:00Z",
        ),
      ]),
    // Un mese dopo il limite: la seconda finestra arriva fino all'istante corrente.
    () => tradingPage(0, false, []),
  ];
  expect(await acquire(provider, "2026-10-03T00:00:00.000Z")).toBe("complete");
  expect(requested.slice(-2).map((body) => field(body, "ModTimeTo"))).toEqual([
    "2026-10-02T05:45:00.000Z",
    "2026-10-03T00:00:00.000Z",
  ]);
  expect(
    await env.DB.prepare(
      "SELECT last_modified_time FROM order_source_refs WHERE external_order_id = 'VALIDO'",
    ).first(),
  ).toEqual({ last_modified_time: "2026-10-03T00:00:00.000Z" });
  logged.mockRestore();
});

it("non salta l'ordine Trading se cambia il consenso durante la passata", async () => {
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});
  const provider = ebay({
    orders: [],
    before: async (_, init) => {
      if (String(init?.body).includes("<ModTimeFrom>"))
        await env.DB.prepare(
          "UPDATE ebay_store_credentials SET granted_at = '2026-09-03T00:00:00.000Z'",
        ).run();
    },
    fail: (_, init) =>
      String(init?.body).includes("<ModTimeFrom>")
        ? new Response(
            `<GetOrdersResponse><Ack>Success</Ack><PaginationResult><TotalNumberOfEntries>1</TotalNumberOfEntries></PaginationResult>` +
              `<HasMoreOrders>false</HasMoreOrders><OrderArray><Order><OrderID>P-1</OrderID><OrderStatus>Active</OrderStatus>` +
              `<CreatedTime>2026-09-01T10:00:00Z</CreatedTime><CheckoutStatus><LastModifiedTime>2026-09-01T11:00:00Z</LastModifiedTime></CheckoutStatus>` +
              `<Total currencyID="EUR">1.00</Total><TransactionArray><Transaction><Item><ItemID>123</ItemID><Title>Sintetico</Title></Item>` +
              `<TransactionID>1</TransactionID><QuantityPurchased>1</QuantityPurchased></Transaction></TransactionArray></Order></OrderArray></GetOrdersResponse>`,
          )
        : undefined,
  });
  expect(await acquire(provider)).toBe("not_writable");
  expect(logged).not.toHaveBeenCalled();
  logged.mockRestore();
});

it("dopo una pausa di 45 giorni legge Trading per finestre di 30 giorni senza buchi", async () => {
  const windows: Array<[string, string]> = [];
  const provider = ebay({
    orders: [],
    fail: (_, init) => {
      const body = String(init?.body);
      if (!body.includes("<ModTimeFrom>")) return;
      windows.push([
        /<ModTimeFrom>([^<]+)</u.exec(body)![1]!,
        /<ModTimeTo>([^<]+)</u.exec(body)![1]!,
      ]);
      return undefined;
    },
  });
  expect(await acquire(provider)).toBe("complete");
  expect(await env.DB.prepare("SELECT trading_cursor FROM sync_state").first()).toEqual({
    trading_cursor: "2026-09-02T00:00:00.000Z",
  });

  windows.length = 0;
  expect(await acquire(provider, "2026-10-17T00:00:00.000Z")).toBe("complete");
  expect(windows).toEqual([
    ["2026-09-01T23:45:00.000Z", "2026-10-01T23:45:00.000Z"],
    ["2026-10-01T23:45:00.000Z", "2026-10-17T00:00:00.000Z"],
  ]);
  expect(
    await env.DB.prepare("SELECT trading_cursor, trading_end FROM sync_state").first(),
  ).toEqual({ trading_cursor: "2026-10-17T00:00:00.000Z", trading_end: null });

  // Oltre i 90 giorni Trading non risponde: la lettura parte dal limite di eBay.
  windows.length = 0;
  expect(await acquire(provider, "2027-02-01T00:00:00.000Z")).toBe("complete");
  expect(windows[0]![0]).toBe("2026-11-03T00:00:00.000Z");
  expect(windows).toHaveLength(3);
  expect(windows.at(-1)![1]).toBe("2027-02-01T00:00:00.000Z");
});

it("fra due finestre Trading si ferma con le chiamate spente e continua fino al confine delle due ore", async () => {
  const windows: string[] = [];
  let stop = false;
  const provider = ebay({
    orders: [],
    fail: (_, init) => {
      const body = String(init?.body);
      if (!body.includes("<ModTimeFrom>")) return;
      windows.push(/<ModTimeTo>([^<]+)</u.exec(body)![1]!);
      return undefined;
    },
    before: async (_, init) => {
      if (stop && String(init?.body).includes("<ModTimeFrom>"))
        await setSwitch(env.DB, "ebay_calls", false, new Date("2026-10-17T00:00:00.000Z"));
    },
  });
  await acquire(provider);
  windows.length = 0;
  // Spente durante la prima finestra: la seconda resta al turno successivo.
  stop = true;
  expect(await acquire(provider, "2026-10-17T00:00:00.000Z")).toBe("budget");
  expect(windows).toEqual(["2026-10-01T23:45:00.000Z"]);
  expect(
    await env.DB.prepare("SELECT trading_cursor, trading_end FROM sync_state").first(),
  ).toEqual({ trading_cursor: "2026-10-01T23:45:00.000Z", trading_end: null });

  // Una finestra che finisce esattamente due ore prima dell'istante corrente continua.
  stop = false;
  await setSwitch(env.DB, "ebay_calls", true, new Date("2026-10-17T00:01:00.000Z"));
  await env.DB.prepare("UPDATE sync_state SET trading_cursor = ?")
    .bind("2026-09-01T00:15:00.000Z")
    .run();
  windows.length = 0;
  expect(await acquire(provider, "2026-10-01T02:00:00.000Z")).toBe("complete");
  expect(windows).toEqual(["2026-10-01T00:00:00.000Z", "2026-10-01T02:00:00.000Z"]);
});

it("una finestra Trading interrotta e ormai oltre i novanta giorni ricomincia dal limite", async () => {
  const requests: Array<[string, string]> = [];
  const provider = ebay({
    orders: [],
    fail: (_, init) => {
      const body = String(init?.body);
      if (!body.includes("<ModTimeFrom>")) return;
      requests.push([
        /<ModTimeFrom>([^<]+)</u.exec(body)![1]!,
        /<PageNumber>([^<]+)</u.exec(body)![1]!,
      ]);
      return undefined;
    },
  });
  await acquire(provider);
  const at = "2027-02-01T00:00:00.000Z";
  const reach = "2026-11-03T00:00:00.000Z";
  // Anche una fine esattamente sul limite è ormai fuori portata.
  for (const end of ["2026-10-01T00:00:00.000Z", reach]) {
    await env.DB.prepare(
      "UPDATE sync_state SET trading_cursor = '2026-09-01T00:00:00.000Z', trading_end = ?, trading_page = 3, trading_total = 250",
    )
      .bind(end)
      .run();
    requests.length = 0;
    expect(await acquire(provider, at)).toBe("complete");
    expect(requests[0]).toEqual([reach, "1"]);
  }
});
