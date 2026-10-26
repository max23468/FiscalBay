import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { acquireOrders } from "../app/domain/order-acquisition.server";
import {
  consumeStoreSync,
  dispatchStoreSyncs,
  requestStoreSync,
  syncOrder,
} from "../app/domain/order-sync.server";
import {
  consumeTask,
  dispatchScheduledWork,
  dispatchTasks,
} from "../app/domain/scheduled-work.server";
import {
  listVisibleOrders,
  searchVisibleOrders,
  visibleOrderState,
} from "../app/domain/orders.server";
import { searchTokens } from "../app/orders/order-search";
import { recordOrderObservation } from "../app/domain/order-import.server";
import { listStores } from "../app/domain/stores.server";
import { applyFreePlans } from "../app/domain/free-store.server";
import { purgeExpiredRecords } from "../app/domain/maintenance.server";
import { sealToken } from "../app/integrations/ebay/seller-credentials.server";
import { now, resetDatabase, seed } from "./fixtures/database-fixtures";
import { fakeQueue, queueMessage, queued } from "./fixtures/queue-fixture";
import { emptyTradingOrders, withSandbox } from "./fixtures/ebay-fixtures";
import { access, ack, order } from "./fixtures/ebay-client-fixtures";

beforeEach(resetDatabase);
afterEach(() => vi.useRealTimers());

describe("acquisizione con il client", () => {
  const grantedAt = "2026-09-01T00:00:00.000Z";
  const image = "https://i.ebayimg.com/images/g/abc/s-l1600.jpg";
  const storeResponse = ack(
    `<Ack>Success</Ack><Store><Name>Negozio Sintetico</Name><Logo><URL>${image}</URL></Logo></Store>`,
  );
  type FakeOrder = ReturnType<typeof order>;
  /**
   * eBay sintetico con paginazione reale: filtra per data, ordina dal più recente e restituisce
   * `next` con l'offset. `before` interviene prima di ogni richiesta.
   */
  const ebay = (
    options: {
      orders?: FakeOrder[];
      getItem?: () => Response;
      trading?: () => Response;
      fail?: (url: URL, init?: RequestInit) => Response | undefined;
      before?: (url: URL, init?: RequestInit) => unknown;
    } = {},
  ) => {
    const orders = options.orders ?? [order()];
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      const url = new URL(String(input));
      await options.before?.(url, init);
      const failed = options.fail?.(url, init);
      if (failed) return failed;
      const call = new Headers(init?.headers).get("x-ebay-api-call-name");
      if (call === "GetStore") return new Response(storeResponse);
      if (call === "GetUser")
        return new Response(ack("<Ack>Success</Ack><User><FeedbackScore>7</FeedbackScore></User>"));
      if (call === "GetItem") {
        return (
          options.getItem?.() ??
          new Response(
            ack(
              `<Ack>Success</Ack><Item><PictureDetails><PictureURL>${image}</PictureURL></PictureDetails></Item>`,
            ),
          )
        );
      }
      if (call === "GetOrders") {
        if (String(init?.body).includes("<ModTimeFrom>")) return new Response(emptyTradingOrders);
        const id = /<OrderID>([^<]*)<\/OrderID>/u.exec(String(init?.body))![1];
        return (
          options.trading?.() ??
          new Response(
            `<GetOrdersResponse><Ack>Success</Ack><OrderArray><Order><OrderID>${id}</OrderID>` +
              `<BuyerTaxIdentifier><Type>CODICE_FISCALE</Type><ID>SINTETICO</ID></BuyerTaxIdentifier>` +
              `</Order></OrderArray></GetOrdersResponse>`,
          )
        );
      }
      const single = url.pathname.split("/sell/fulfillment/v1/order/")[1];
      if (single !== undefined) {
        const found = orders.find(({ orderId }) => orderId === decodeURIComponent(single));
        return found ? Response.json(found) : new Response(null, { status: 404 });
      }
      const [, field, from, to] = /^(\w+):\[(.+)\.\.(.+)\]$/u.exec(
        url.searchParams.get("filter")!,
      )!;
      const key = field === "creationdate" ? "creationDate" : "lastModifiedDate";
      const matching = orders
        .filter((item) => item[key] >= from! && item[key] <= to!)
        .sort((a, b) => b.creationDate.localeCompare(a.creationDate));
      const limit = Number(url.searchParams.get("limit"));
      const offset = Number(url.searchParams.get("offset") ?? 0);
      const next = new URL(url);
      next.searchParams.set("offset", String(offset + limit));
      const response = Response.json({
        orders: matching.slice(offset, offset + limit),
        total: matching.length,
        ...(offset + limit < matching.length ? { next: next.href } : {}),
      });
      return response;
    });
    return Object.assign(fetcher, { orders });
  };
  // Le asserzioni fiscali contano i dettagli; l'elenco Trading è provato separatamente.
  const calls = (fetcher: ReturnType<typeof ebay>, name: string) =>
    fetcher.mock.calls.filter(
      ([, init]) =>
        new Headers(init?.headers).get("x-ebay-api-call-name") === name &&
        !String(init?.body).includes("<ModTimeFrom>"),
    ).length;
  const pages = (fetcher: ReturnType<typeof ebay>, field: string) =>
    fetcher.mock.calls
      .map(([input]) => new URL(String(input)))
      .filter((url) => url.searchParams.get("filter")?.startsWith(`${field}:`))
      .map((url) => Number(url.searchParams.get("offset") ?? 0));
  const acquire = (
    fetcher: typeof fetch,
    at = "2026-09-02T00:00:00.000Z",
    budget = { calls: 1_000, pages: 100 },
  ) => {
    vi.setSystemTime(new Date(at));
    return acquireOrders({
      db: env.DB,
      storeId: "s-a",
      grantedAt,
      access: access(fetcher),
      now: new Date(at),
      budget,
    });
  };
  const syncState = () =>
    env.DB.prepare(
      `SELECT cursor, recent_next, history_from, history_until, history_next, history_done_at,
              locked_until, last_success_at FROM sync_state WHERE store_id = 's-a'`,
    ).first<Record<string, string | null>>();
  const count = async (sql: string) =>
    (await env.DB.prepare(sql).first<{ total: number }>())!.total;
  /** Un turno del cron e poi il consumer della coda nello stesso istante, un messaggio alla volta. */
  const cronTurn = async (environment: Env, fetcher: typeof fetch, at: Date) => {
    const sendBatch = vi.fn<Queue["sendBatch"]>(async () => queued);
    const stores = await dispatchStoreSyncs(
      { ...environment, WORK_QUEUE: fakeQueue({ sendBatch }) },
      at,
    );
    for (const storeId of stores)
      await consumeStoreSync(queueMessage({ syncStore: storeId }), environment, fetcher, at);
    return stores;
  };
  // Ordini creati a un'ora di distanza prima di `until`, modificati un minuto dopo.
  const series = (prefix: string, total: number, until: string) =>
    Array.from({ length: total }, (_, index) => {
      const created = Date.parse(until) - (index + 1) * 60 * 60 * 1000;
      return order({
        orderId: `${prefix}-${String(index).padStart(5, "0")}`,
        creationDate: new Date(created).toISOString(),
        lastModifiedDate: new Date(created + 60_000).toISOString(),
        lineItems: [],
      });
    });

  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM ebay_store_pauses").run();
    await env.DB.prepare("DELETE FROM ebay_rate_limits").run();
    await seed();
    await env.DB.prepare("DELETE FROM orders").run();
    await env.DB.prepare(
      `INSERT INTO ebay_store_credentials
         (store_id, access_token, access_expires_at, refresh_token, refresh_expires_at, granted_at)
       VALUES ('s-a', 'a', ?1, 'r', ?1, ?2)`,
    )
      .bind(now, grantedAt)
      .run();
  });

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

  const tradingFailure = (code: string) =>
    ebay({
      orders: [],
      fail: (_, init) =>
        String(init?.body).includes("<ModTimeFrom>")
          ? new Response(
              `<GetOrdersResponse><Ack>Failure</Ack><Errors><ErrorCode>${code}</ErrorCode><SeverityCode>Error</SeverityCode></Errors></GetOrdersResponse>`,
            )
          : undefined,
    });
  const tradingPasses = (fetcher: ReturnType<typeof ebay>) =>
    fetcher.mock.calls.filter(([, init]) => String(init?.body).includes("<ModTimeFrom>")).length;

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
      results: [
        { api_origin: "https://api.ebay.com#GetOrders", until: "2026-09-02T00:15:00.000Z" },
      ],
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

  it("legge Trading ogni due ore, subito al collegamento e su richiesta manuale", async () => {
    const page = () =>
      new Response(
        `<GetOrdersResponse><Ack>Success</Ack><PaginationResult><TotalNumberOfEntries>0</TotalNumberOfEntries></PaginationResult>` +
          `<HasMoreOrders>false</HasMoreOrders><OrderArray></OrderArray></GetOrdersResponse>`,
      );
    const provider = ebay({
      orders: [],
      fail: (_, init) => (String(init?.body).includes("<ModTimeFrom>") ? page() : undefined),
    });
    expect(await acquire(provider)).toBe("complete");
    expect(tradingPasses(provider)).toBe(1);
    expect(await acquire(provider, "2026-09-02T01:00:00.000Z")).toBe("complete");
    expect(tradingPasses(provider)).toBe(1);
    // A metà intervallo la richiesta manuale legge Trading subito e riparte da lì.
    await env.DB.prepare("UPDATE sync_state SET requested_at = '2026-09-02T01:20:00.000Z'").run();
    expect(await acquire(provider, "2026-09-02T01:30:00.000Z")).toBe("complete");
    expect(tradingPasses(provider)).toBe(2);
    expect(await acquire(provider, "2026-09-02T03:29:59.999Z")).toBe("complete");
    expect(tradingPasses(provider)).toBe(2);
    expect(await acquire(provider, "2026-09-02T03:30:00.000Z")).toBe("complete");
    expect(tradingPasses(provider)).toBe(3);
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
    expect(await acquire(provider, "2026-09-02T02:00:00.000Z")).toBe("complete");
    expect(requested.slice(2).map((body) => field(body, "PageNumber"))).toEqual(["1", "2", "1"]);
    expect(field(requested[2]!, "ModTimeFrom")).toBe("2026-09-01T23:45:00.000Z");

    // Budget finito durante Trading: l'esecuzione non si dichiara completa.
    responses = [
      () => tradingPage(2, true, [tradingOrder("VALIDO", "2026-09-01T10:00:00Z", ["3"])]),
    ];
    expect(await acquire(provider, "2026-09-02T04:00:00.000Z", { calls: 2, pages: 2 })).toBe(
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
    ];
    expect(await acquire(provider, "2026-10-03T00:00:00.000Z")).toBe("complete");
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
        fail: (url) =>
          url.pathname.includes("/order/") ? Response.json(order(detail)) : undefined,
      });
      expect(await acquire(fetcher)).toBe("complete");
      expect(calls(fetcher, "GetOrders")).toBe(0);
      expect(
        await env.DB.prepare("SELECT detail_error FROM order_source_refs").all(),
      ).toMatchObject({
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

  it("importa lo storico a pagine e riprende dall'ultima pagina applicata", async () => {
    let interrupted = false;
    const failing = ebay({
      orders: series("12-storico", 60, "2026-09-02T00:00:00.000Z"),
      fail: (url) => {
        if (url.searchParams.get("offset") !== "50" || interrupted) return undefined;
        interrupted = true;
        return new Response(null, { status: 503 });
      },
    });
    await expect(acquire(failing)).rejects.toMatchObject({ failure: "unavailable" });
    expect(pages(failing, "creationdate")).toEqual([0, 25, 50]);
    expect(await syncState()).toMatchObject({
      cursor: "2026-09-02T00:00:00.000Z",
      history_from: "2026-08-03T00:00:00.000Z",
      history_until: "2026-09-02T00:00:00.000Z",
      history_next: expect.stringContaining("offset=50"),
      history_done_at: null,
      locked_until: null,
    });
    expect(await count("SELECT COUNT(*) AS total FROM orders")).toBe(50);

    const resumed = ebay({ orders: failing.orders });
    expect(await acquire(resumed, "2026-09-02T00:30:00.000Z")).toBe("complete");
    expect(pages(resumed, "creationdate")).toEqual([50]);
    expect(await count("SELECT COUNT(*) AS total FROM orders")).toBe(60);
    expect(
      await count(
        "SELECT COUNT(*) AS total FROM order_source_refs WHERE detail_for = last_modified_time",
      ),
    ).toBe(60);
    expect(await syncState()).toMatchObject({
      history_next: null,
      history_done_at: "2026-09-02T00:30:00.000Z",
    });
    // Storico completo: le esecuzioni successive non lo rileggono.
    const later = ebay({ orders: failing.orders });
    await acquire(later, "2026-09-02T01:00:00.000Z");
    expect(pages(later, "creationdate")).toEqual([]);
  });

  it("ricomincia la passata se l'elenco cambia sotto la paginazione, senza saltare ordini", async () => {
    await acquire(ebay({ orders: [] }));
    // Ordini ancora conservabili, modificati dopo l'ultimo limite dei recenti.
    const orders = series("12-recente", 60, "2026-09-01T00:00:00.000Z").map((item, index) => ({
      ...item,
      lastModifiedDate: new Date(Date.parse("2026-09-02T00:30:00.000Z") + index).toISOString(),
    }));
    let moved = false;
    const fetcher = ebay({
      orders,
      // Dopo la prima pagina un ordine già letto esce dall'intervallo: senza ripartire,
      // l'offset della seconda pagina salterebbe il primo ordine non ancora letto.
      before: (url) => {
        if (moved || url.searchParams.get("offset") !== "25") return;
        moved = true;
        orders[0] = { ...orders[0]!, lastModifiedDate: "2026-09-03T00:00:00.000Z" };
      },
    });
    expect(await acquire(fetcher, "2026-09-02T01:00:00.000Z")).toBe("complete");
    expect(pages(fetcher, "lastmodifieddate")).toEqual([0, 25, 0, 25, 50]);
    expect(await count("SELECT COUNT(*) AS total FROM orders")).toBe(60);
    expect(await count("SELECT COUNT(*) AS total FROM order_source_refs")).toBe(60);
    expect(await syncState()).toMatchObject({
      cursor: "2026-09-02T01:00:00.000Z",
      recent_next: null,
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

  it("acquisisce i nuovi ordini prima di completare lo storico e ne mostra l'avanzamento", async () => {
    const orders = series("12-storico", 60, "2026-09-02T00:00:00.000Z");
    const small = { calls: 3, pages: 3 };
    // Prima del primo avvio lo storico non ha ancora una finestra.
    expect((await listStores(env.DB, "u-a"))[0]).toMatchObject({ history: null, syncing: false });
    await acquire(ebay({ orders }), "2026-09-02T00:00:00.000Z", { ...small });
    expect(await count("SELECT COUNT(*) AS total FROM orders")).toBe(25);
    expect(
      (await listStores(env.DB, "u-a", new Date("2026-09-02T00:10:00.000Z")))[0],
    ).toMatchObject({
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
    const fetcher = ebay({ orders });
    expect(await acquire(fetcher, "2026-09-02T00:30:00.000Z", { calls: 2, pages: 2 })).toBe(
      "budget",
    );
    // Prima i recenti, poi una sola pagina dello storico: il nuovo ordine non attende lo
    // storico. Trading, letto da meno di due ore, non usa il budget.
    expect(
      fetcher.mock.calls.map(
        ([input]) => new URL(String(input)).searchParams.get("filter")?.split(":")[0],
      ),
    ).toEqual(["lastmodifieddate", "creationdate"]);
    expect(
      await env.DB.prepare(
        "SELECT 1 AS found FROM orders WHERE ebay_order_id = '12-nuovo'",
      ).first(),
    ).toEqual({ found: 1 });
    expect(await syncState()).toMatchObject({
      history_next: expect.stringContaining("offset=50"),
      history_done_at: null,
    });

    expect(await acquire(ebay({ orders }), "2026-09-02T01:00:00.000Z")).toBe("complete");
    expect(await count("SELECT COUNT(*) AS total FROM orders")).toBe(61);
    expect(
      (await listStores(env.DB, "u-a", new Date("2026-09-02T01:00:00.000Z")))[0],
    ).toMatchObject({ history: { days: 30, done: true } });
  });

  describe("finestra dello storico secondo la copertura", () => {
    const day = 86_400_000;
    const linked = Date.parse("2026-09-02T00:00:00.000Z");
    const iso = (at: number) => new Date(at).toISOString();
    /** Stesso istante dodici mesi di calendario prima o dopo. */
    const months = (at: number, value: number) => {
      const date = new Date(at);
      date.setUTCMonth(date.getUTCMonth() + value);
      return date.getTime();
    };
    const dated = (orderId: string, created: number) =>
      order({
        orderId,
        creationDate: iso(created),
        lastModifiedDate: iso(created + 60_000),
        lineItems: [],
      });
    const coverage = (from: number, until: number, source = "trial") =>
      env.DB.prepare(
        `INSERT INTO workspace_entitlements (id, workspace_id, source, starts_at, ends_at)
         VALUES (?, 'w-a', ?, ?, ?)`,
      )
        .bind(crypto.randomUUID(), source, iso(from), iso(until))
        .run();
    const terms = async () =>
      Object.fromEntries(
        (
          await env.DB.prepare(
            "SELECT ebay_order_id, retention_until FROM orders WHERE store_id = 's-a'",
          ).all<{ ebay_order_id: string; retention_until: string }>()
        ).results.map((row) => [row.ebay_order_id, row.retention_until]),
      );
    const historyFilters = (fetcher: ReturnType<typeof ebay>) =>
      fetcher.mock.calls
        .map(([input]) => new URL(String(input)).searchParams)
        .filter((params) => params.get("filter")?.startsWith("creationdate:"))
        .map((params) => `${params.get("filter")}@${params.get("offset") ?? 0}`);
    const history = () =>
      env.DB.prepare(
        `SELECT history_from, history_until, history_through, history_next, history_done_at
           FROM sync_state WHERE store_id = 's-a'`,
      ).first<Record<string, string | null>>();

    beforeEach(() => env.DB.prepare("DELETE FROM orders").run());

    it("all'attivazione importa il resto dell'anno, interrotto e ripreso, senza rileggere il Free", async () => {
      const older = series("12-esteso", 60, iso(linked - 30 * day));
      const orders = [
        dated("12-recente", linked - 10 * day),
        ...older,
        dated("12-oltre-anno", months(linked, -13)),
      ];
      await acquire(ebay({ orders }), iso(linked));
      expect(await terms()).toEqual({ "12-recente": iso(linked - 10 * day + 30 * day) });

      // Prova attiva: l'esecuzione successiva legge soltanto il periodo più vecchio.
      const active = linked + 60 * 60_000;
      await coverage(active, active + 14 * day);
      let interrupted = false;
      const failing = ebay({
        orders,
        fail: (url) => {
          if (url.searchParams.get("offset") !== "25" || interrupted) return undefined;
          interrupted = true;
          return new Response(null, { status: 503 });
        },
      });
      await expect(acquire(failing, iso(active))).rejects.toMatchObject({
        failure: "unavailable",
      });
      const range = `creationdate:[${iso(months(active, -12))}..${iso(linked - 30 * day)}]`;
      expect(historyFilters(failing)).toEqual([`${range}@0`, `${range}@25`]);
      expect(await history()).toMatchObject({
        history_from: iso(months(active, -12)),
        history_until: iso(linked),
        history_through: iso(linked - 30 * day),
        history_next: expect.stringContaining("offset=25"),
        history_done_at: null,
      });
      expect((await listStores(env.DB, "u-a", new Date(active)))[0]).toMatchObject({
        history: { days: 365, done: false },
      });

      const resumed = ebay({ orders });
      expect(await acquire(resumed, iso(active + 30 * 60_000))).toBe("complete");
      expect(historyFilters(resumed)).toEqual([`${range}@25`, `${range}@50`]);
      const acquired = await terms();
      expect(Object.keys(acquired)).toHaveLength(61);
      expect(acquired["12-oltre-anno"]).toBeUndefined();
      // Gli ordini arrivati con la copertura hanno il termine di un anno dalla loro data.
      expect(acquired["12-esteso-00000"]).toBe(iso(months(Date.parse(older[0]!.creationDate), 12)));
      expect(await history()).toMatchObject({
        history_from: iso(months(active, -12)),
        history_through: null,
        history_done_at: iso(active + 30 * 60_000),
      });
      expect((await listStores(env.DB, "u-a", new Date(active + day)))[0]).toMatchObject({
        history: { days: 365, done: true },
      });

      // La finestra che avanza non riapre lo storico.
      const later = ebay({ orders });
      await acquire(later, iso(active + day));
      expect(historyFilters(later)).toEqual([]);
    });

    it("elenco, dettaglio, ricerca e pulizia rispettano lo stesso termine di un anno", async () => {
      await coverage(linked - day, linked + 400 * day, "admin");
      const created = months(linked, -11);
      await acquire(ebay({ orders: [dated("12-confine", created)] }), iso(linked));
      const end = months(created, 12);
      expect(await terms()).toEqual({ "12-confine": iso(end) });
      const id = (await env.DB.prepare("SELECT id FROM orders").first<{ id: string }>())!.id;
      const seen = async (at: number) => ({
        list: (await listVisibleOrders(env.DB, "u-a", 50, "production", new Date(at))).length,
        detail: (await visibleOrderState(env.DB, "u-a", "production", id, new Date(at))) !== null,
        search: (
          await searchVisibleOrders(
            env.DB,
            "u-a",
            "production",
            new Date(at),
            searchTokens("12-confine"),
          )
        ).total,
      });
      expect(await seen(end - 1)).toEqual({ list: 1, detail: true, search: 1 });
      // Con la pulizia sospesa l'ordine c'è ancora ma non si consulta.
      await purgeExpiredRecords(env.DB, new Date(end - 1));
      expect(await seen(end)).toEqual({ list: 0, detail: false, search: 0 });
      await purgeExpiredRecords(env.DB, new Date(end));
      expect(await terms()).toEqual({});
    });

    it("il ritorno al Free chiude l'estensione dove era arrivata e una nuova copertura la riprende", async () => {
      const orders = series("12-esteso", 60, iso(linked - 30 * day));
      await acquire(ebay({ orders }), iso(linked));
      const active = linked + 60 * 60_000;
      await coverage(active, active + day);
      expect(await acquire(ebay({ orders }), iso(active), { calls: 30, pages: 2 })).toBe("budget");
      expect(await history()).toMatchObject({
        history_through: iso(linked - 30 * day),
        history_next: expect.stringContaining("offset=25"),
      });
      expect(Object.keys(await terms())).toHaveLength(25);

      // Senza copertura il periodo rimasto è fuori dalla finestra: nessuna pagina dello storico.
      const free = active + 2 * day;
      const stopped = ebay({ orders });
      expect(await acquire(stopped, iso(free))).toBe("complete");
      expect(historyFilters(stopped)).toEqual([]);
      expect(await history()).toEqual({
        history_from: iso(linked - 30 * day),
        history_until: iso(linked),
        history_through: null,
        history_next: null,
        history_done_at: iso(free),
      });
      expect((await listStores(env.DB, "u-a", new Date(free)))[0]).toMatchObject({
        history: { days: 30, done: true },
      });

      const again = free + day;
      await coverage(again, again + 30 * day, "premium");
      const resumed = ebay({ orders });
      expect(await acquire(resumed, iso(again))).toBe("complete");
      const range = `creationdate:[${iso(months(again, -12))}..${iso(linked - 30 * day)}]`;
      expect(historyFilters(resumed)).toEqual([`${range}@0`, `${range}@25`, `${range}@50`]);
      expect(Object.keys(await terms())).toHaveLength(60);
    });

    it("un ordine eliminato alla scadenza del Free non torna con la copertura", async () => {
      const kept = dated("12-eliminato", linked - 20 * day);
      await acquire(ebay({ orders: [kept] }), iso(linked));
      expect(Object.keys(await terms())).toEqual(["12-eliminato"]);
      const expired = linked + 11 * day;
      await purgeExpiredRecords(env.DB, new Date(expired));
      expect(await terms()).toEqual({});

      // Con la prova eBay lo restituisce fra i modificati: il marker ne impedisce il reimport.
      await coverage(expired, expired + 14 * day);
      const replay = ebay({
        orders: [{ ...kept, lastModifiedDate: iso(expired + 60_000) }],
      });
      expect(await acquire(replay, iso(expired + 30 * 60_000))).toBe("complete");
      expect(await terms()).toEqual({});
    });

    it("l'estensione concessa vale con la copertura, fino a due anni, e la revoca riporta l'anno", async () => {
      await env.DB.prepare(
        `INSERT INTO history_extensions (id, workspace_id, months, reason, actor, granted_at)
         VALUES ('x-a', 'w-a', 24, 'Periodo recuperabile verificato', 'assistenza', ?)`,
      )
        .bind(iso(linked - day))
        .run();
      const orders = [
        dated("12-diciotto-mesi", months(linked, -18)),
        dated("12-dieci-mesi", months(linked, -10)),
      ];
      // Senza copertura l'estensione non vale: trenta giorni.
      const free = ebay({ orders });
      await acquire(free, iso(linked));
      expect(historyFilters(free)).toEqual([
        `creationdate:[${iso(linked - 30 * day)}..${iso(linked)}]@0`,
      ]);

      const active = linked + 60 * 60_000;
      await coverage(active, active + 30 * day);
      await acquire(ebay({ orders }), iso(active));
      const created = Date.parse(orders[0]!.creationDate);
      expect(await terms()).toEqual({
        "12-diciotto-mesi": iso(months(created, 24)),
        "12-dieci-mesi": iso(months(Date.parse(orders[1]!.creationDate), 24)),
      });
      expect(await history()).toMatchObject({ history_from: iso(months(active, -24)) });

      // La revoca riporta la finestra a un anno: l'ordine più vecchio non è più consultabile e
      // resta trenta giorni, come dopo un downgrade; il cron lo rivede senza visite.
      // Durata, motivo e autore non cambiano: un'estensione diversa è una nuova riga.
      for (const change of ["months = 13", "reason = 'altro'", "actor = 'altri'"])
        await expect(
          env.DB.prepare(`UPDATE history_extensions SET ${change} WHERE id = 'x-a'`).run(),
        ).rejects.toThrow("immutable_history_extension");
      const revoked = active + day;
      await env.DB.prepare("UPDATE history_extensions SET revoked_at = ? WHERE id = 'x-a'")
        .bind(iso(revoked))
        .run();
      // La revoca si registra una volta.
      await expect(
        env.DB.prepare("UPDATE history_extensions SET revoked_at = NULL WHERE id = 'x-a'").run(),
      ).rejects.toThrow("immutable_history_extension");
      await applyFreePlans(env.DB, new Date(revoked + 60_000));
      expect(
        await env.DB.prepare(
          "SELECT retention_until, purge_after FROM orders WHERE ebay_order_id = '12-diciotto-mesi'",
        ).first(),
      ).toEqual({
        retention_until: iso(months(created, 12)),
        purge_after: iso(revoked + 60_000 + 30 * day),
      });
      expect(
        (await listVisibleOrders(env.DB, "u-a", 50, "production", new Date(revoked + 60_000))).map(
          (row) => row.ebayOrderId,
        ),
      ).toEqual(["12-dieci-mesi"]);
    });

    it("Negozi mostra i giorni della finestra anche con la copertura attivata mesi dopo", async () => {
      const orders = [dated("12-recente", linked - 10 * day)];
      await acquire(ebay({ orders }), iso(linked));
      const store = async (at: number) =>
        (await listStores(env.DB, "u-a", new Date(at)))[0]!.history;
      expect(await store(linked + 59 * day)).toEqual({ days: 30, done: true });

      // Prova attivata due mesi dopo: l'anno è da importare finché la lettura non lo legge.
      const active = linked + 60 * day;
      await coverage(active, active + 14 * day);
      expect(await store(active)).toEqual({ days: 365, done: false });
      expect(await acquire(ebay({ orders }), iso(active))).toBe("complete");
      expect(await history()).toMatchObject({
        history_from: iso(months(active, -12)),
        history_until: iso(linked),
      });
      expect(await store(active + day)).toEqual({ days: 365, done: true });

      // Un'estensione di due anni allarga la finestra: i giorni in più restano da importare.
      await env.DB.prepare(
        `INSERT INTO history_extensions (id, workspace_id, months, reason, actor, granted_at)
         VALUES ('x-b', 'w-a', 24, 'Periodo recuperabile verificato', 'assistenza', ?)`,
      )
        .bind(iso(active + day))
        .run();
      const extended = active + 2 * day;
      expect(await store(extended)).toEqual({ days: 730, done: false });
      expect(await acquire(ebay({ orders }), iso(extended))).toBe("complete");
      expect(await store(extended)).toEqual({ days: 730, done: true });

      // Alla fine della prova si consultano i trenta giorni del Free.
      expect(await store(active + 15 * day)).toEqual({ days: 30, done: true });
    });
  });

  it("rimanda il dettaglio dopo un errore dell'ordine e lo chiude dopo l'ultimo tentativo", async () => {
    const rejected = () =>
      new Response(
        `<GetOrdersResponse><Ack>Failure</Ack><Errors><ErrorCode>10007</ErrorCode>` +
          `<SeverityCode>Error</SeverityCode><ErrorClassification>RequestError</ErrorClassification>` +
          `</Errors></GetOrdersResponse>`,
      );
    const orders = [order({ lineItems: [] })];
    const detail = () =>
      env.DB.prepare(
        `SELECT detail_for, detail_error, detail_attempts, detail_retry_at
           FROM order_source_refs WHERE external_order_id = '12-34567-89012'`,
      ).first();

    // eBay non disponibile: l'ordine si salva, il dettaglio resta da leggere e l'esecuzione si ferma.
    await expect(
      acquire(ebay({ orders, trading: () => new Response(null, { status: 503 }) })),
    ).rejects.toMatchObject({ failure: "unavailable" });
    expect(await count("SELECT COUNT(*) AS total FROM orders")).toBe(1);
    expect(await detail()).toEqual({
      detail_for: null,
      detail_error: "unavailable",
      detail_attempts: 0,
      detail_retry_at: null,
    });

    // Un rifiuto riguarda il solo ordine: nuovi tentativi a 15 minuti, 1, 4 e 16 ore.
    let at = Date.parse("2026-09-02T00:00:00.000Z");
    for (const [attempt, minutes] of [15, 60, 240, 960].entries()) {
      const fetcher = ebay({ orders, trading: rejected });
      expect(await acquire(fetcher, new Date(at).toISOString())).toBe("complete");
      expect(calls(fetcher, "GetOrders")).toBe(1);
      const retryAt = new Date(at + minutes * 60_000).toISOString();
      expect(await detail()).toEqual({
        detail_for: null,
        detail_error: "rejected",
        detail_attempts: attempt + 1,
        detail_retry_at: retryAt,
      });
      // Prima della scadenza nessuna nuova lettura.
      const early = ebay({ orders, trading: rejected });
      await acquire(early, new Date(at + minutes * 60_000 - 1).toISOString());
      expect(calls(early, "GetOrders")).toBe(0);
      at += minutes * 60_000;
    }
    await acquire(ebay({ orders, trading: rejected }), new Date(at).toISOString());
    expect(await detail()).toEqual({
      detail_for: "2026-09-01T09:00:00.000Z",
      detail_error: "rejected",
      detail_attempts: 0,
      detail_retry_at: null,
    });
    const closed = ebay({ orders });
    await acquire(closed, new Date(at + 1).toISOString());
    expect(calls(closed, "GetOrders")).toBe(0);
    expect(await count("SELECT COUNT(*) AS total FROM tax_identifiers")).toBe(0);

    // Una nuova versione con gli stessi campi dell'ordine riapre il dettaglio: il dato fiscale
    // aggiunto dall'acquirente non dipende da un cambiamento visibile dell'ordine.
    orders[0] = { ...orders[0]!, lastModifiedDate: new Date(at + 2).toISOString() };
    await acquire(ebay({ orders }), new Date(at + 3).toISOString());
    expect(await detail()).toEqual({
      detail_for: new Date(at + 2).toISOString(),
      detail_error: null,
      detail_attempts: 0,
      detail_retry_at: null,
    });
    expect(await count("SELECT COUNT(*) AS total FROM tax_identifiers")).toBe(1);
  });

  it.each([false, true])(
    "ferma l'acquisizione con consenso rifiutato, risposta già in corso: %s",
    async (inFlight) => {
      const rejectedAt = "2026-09-02T00:00:00.000Z";
      const reject = () =>
        env.DB.prepare("UPDATE ebay_store_credentials SET rejected_at = ? WHERE store_id = 's-a'")
          .bind(rejectedAt)
          .run();
      if (!inFlight) await reject();
      const fetcher = ebay({
        orders: [order({ lastModifiedDate: rejectedAt })],
        before: async () => {
          if (inFlight) await reject();
        },
      });

      expect(await acquire(fetcher)).toBe("not_writable");
      expect(fetcher).toHaveBeenCalledTimes(inFlight ? 1 : 0);
      for (const table of [
        "orders",
        "order_items",
        "tax_identifiers",
        "order_source_refs",
        "sync_runs",
      ])
        expect(await count(`SELECT COUNT(*) AS total FROM ${table}`)).toBe(0);
      if (inFlight)
        expect(await syncState()).toMatchObject({
          cursor: rejectedAt,
          recent_next: null,
          history_next: null,
          history_done_at: null,
          last_success_at: null,
          locked_until: null,
        });
      else expect(await syncState()).toBeNull();
    },
  );

  it("non sovrappone due esecuzioni e non scrive senza il consenso con cui è partita", async () => {
    const fetcher = ebay();
    await env.DB.prepare(
      "INSERT INTO sync_state (store_id, locked_until, updated_at) VALUES ('s-a', ?, ?)",
    )
      .bind("2026-09-02T00:10:00.000Z", now)
      .run();
    expect(await acquire(fetcher)).toBe("busy");
    expect(fetcher).not.toHaveBeenCalled();
    // La schermata Negozi vede la sincronizzazione in corso fino alla scadenza del blocco.
    const syncing = async (at: string) =>
      (await listStores(env.DB, "u-a", new Date(at)))[0]!.syncing;
    expect(await syncing("2026-09-02T00:09:59.999Z")).toBe(true);
    expect(await syncing("2026-09-02T00:10:00.000Z")).toBe(false);
    // Un blocco scaduto non trattiene il negozio.
    expect(await acquire(fetcher, "2026-09-02T00:10:00.000Z")).toBe("complete");
    expect((await syncState())!.locked_until).toBeNull();

    await env.DB.prepare(
      "INSERT INTO ebay_store_pauses (store_id, reason, paused_at) VALUES ('s-a', 'manual', ?)",
    )
      .bind(now)
      .run();
    const paused = ebay();
    expect(await acquire(paused, "2026-09-03T00:00:00.000Z")).toBe("not_writable");
    expect(paused).not.toHaveBeenCalled();
    await env.DB.prepare("DELETE FROM ebay_store_pauses").run();

    // Un nuovo consenso durante la lettura: la pagina non scrive e il checkpoint resta.
    await env.DB.prepare("DELETE FROM orders").run();
    const before = await syncState();
    const reconnected = ebay({
      orders: series("12-consenso", 30, "2026-09-03T00:00:00.000Z").map((item) => ({
        ...item,
        lastModifiedDate: "2026-09-02T12:00:00.000Z",
      })),
      before: async () => {
        await env.DB.prepare(
          "UPDATE ebay_store_credentials SET granted_at = '2026-09-03T00:00:00.000Z'",
        ).run();
      },
    });
    expect(await acquire(reconnected, "2026-09-03T00:00:00.000Z")).toBe("not_writable");
    expect(await count("SELECT COUNT(*) AS total FROM orders")).toBe(0);
    expect(await syncState()).toEqual({ ...before, locked_until: null });
  });

  it("rispetta separatamente chiamate e pagine e lascia il dettaglio alle chiamate rimaste", async () => {
    const reset = () => env.DB.prepare("DELETE FROM sync_state").run();
    const orders = series("12-budget", 60, "2026-09-02T00:00:00.000Z");
    // Senza chiamate lo storico non parte, anche con pagine disponibili.
    const noCalls = ebay({ orders });
    expect(await acquire(noCalls, undefined, { calls: 1, pages: 10 })).toBe("budget");
    // I recenti e la prima lettura del profilo del negozio, che non scala il budget.
    expect(noCalls).toHaveBeenCalledTimes(3);
    await reset();
    // Senza pagine lo storico non parte, anche con chiamate disponibili.
    const noPages = ebay({ orders });
    expect(await acquire(noPages, undefined, { calls: 10, pages: 1 })).toBe("budget");
    expect(noPages).toHaveBeenCalledTimes(1);

    // Recenti incompleti: nessuna ultima sincronizzazione e lo storico aspetta.
    await reset();
    await acquire(ebay({ orders: [] }));
    const recent = series("12-recenti", 30, "2026-09-01T00:00:00.000Z").map((item) => ({
      ...item,
      lastModifiedDate: "2026-09-02T00:30:00.000Z",
    }));
    const partial = ebay({ orders: recent });
    // Anche con il profilo del negozio da rileggere, recenti incompleti non lo leggono.
    await env.DB.prepare("UPDATE ebay_stores SET store_profile_read_at = NULL").run();
    expect(await acquire(partial, "2026-09-02T01:00:00.000Z", { calls: 1, pages: 1 })).toBe(
      "budget",
    );
    expect(partial).toHaveBeenCalledTimes(1);
    expect(await syncState()).toMatchObject({
      last_success_at: "2026-09-02T00:00:00.000Z",
      recent_next: expect.stringContaining("offset=25"),
    });

    // Finite le pagine, le chiamate rimaste leggono il dettaglio fino al budget.
    const details = ebay({ orders: recent });
    expect(await acquire(details, "2026-09-02T01:10:00.000Z", { calls: 10, pages: 1 })).toBe(
      "budget",
    );
    const singles = details.mock.calls.filter(([input]) =>
      new URL(String(input)).pathname.includes("/order/"),
    );
    expect([singles.length, calls(details, "GetOrders")]).toEqual([4, 4]);
    expect(await syncState()).toMatchObject({
      cursor: "2026-09-02T01:00:00.000Z",
      recent_next: null,
      last_success_at: "2026-09-02T01:10:00.000Z",
    });

    // Con chiamate per un solo dettaglio di due, l'esecuzione non si dichiara completa.
    await acquire(ebay({ orders: recent }), "2026-09-02T01:20:00.000Z");
    await env.DB.prepare(
      `UPDATE order_source_refs SET detail_for = NULL
        WHERE external_order_id IN (SELECT external_order_id FROM order_source_refs LIMIT 2)`,
    ).run();
    const last = ebay({ orders: recent });
    expect(await acquire(last, "2026-09-02T01:30:00.000Z", { calls: 3, pages: 1 })).toBe("budget");
    expect(calls(last, "GetOrders")).toBe(1);
    expect(await acquire(ebay({ orders: recent }), "2026-09-02T01:40:00.000Z")).toBe("complete");
  });

  it("limita le immagini per versione e rimanda il dettaglio senza chiamate sufficienti", async () => {
    const [line] = order().lineItems;
    const listings = Array.from({ length: 10 }, (_, index) => ({
      ...line,
      lineItemId: `2000000000${index}`,
      legacyItemId: `21000000000${index}`,
    }));
    const many = ebay({ orders: [order({ lineItems: listings })] });
    await acquire(many);
    expect(calls(many, "GetItem")).toBe(8);

    await env.DB.batch([
      env.DB.prepare("DELETE FROM orders"),
      env.DB.prepare("DELETE FROM deleted_order_keys"),
      env.DB.prepare("DELETE FROM sync_state"),
    ]);
    // Due pagine, il dettaglio e tre delle otto immagini necessarie: l'ordine si legge una
    // volta sola e resta in attesa.
    const short = ebay({ orders: [order({ lineItems: listings.slice(0, 8) })] });
    expect(await acquire(short, undefined, { calls: 8, pages: 3 })).toBe("budget");
    expect([calls(short, "GetItem"), calls(short, "GetOrders")]).toEqual([0, 0]);
    expect(
      short.mock.calls.filter(([input]) => new URL(String(input)).pathname.includes("/order/")),
    ).toHaveLength(1);
    expect(
      await env.DB.prepare("SELECT detail_for, detail_attempts FROM order_source_refs").first(),
    ).toEqual({ detail_for: null, detail_attempts: 0 });
  });

  it("ferma l'acquisizione quando GetItem rifiuta le credenziali", async () => {
    const provider = ebay({ getItem: () => new Response(null, { status: 401 }) });
    await expect(acquire(provider)).rejects.toMatchObject({ failure: "credentials" });
    expect(calls(provider, "GetOrders")).toBe(0);
  });

  it("con la quota GetOrders già in attesa rimanda la lettura fiscale senza chiamare Trading", async () => {
    const detail = () =>
      env.DB.prepare(
        "SELECT detail_for, detail_error, detail_attempts FROM order_source_refs",
      ).first();
    await env.DB.prepare(
      "INSERT INTO ebay_rate_limits (api_origin, until) VALUES ('https://api.ebay.com#GetOrders', ?)",
    )
      .bind("2026-09-02T00:15:00.000Z")
      .run();
    const limited = ebay();
    expect(await acquire(limited)).toBe("budget");
    expect(limited.mock.calls.some(([, init]) => String(init?.body).includes("GetOrders"))).toBe(
      false,
    );
    expect(await detail()).toEqual({
      detail_for: null,
      detail_error: "rate_limited",
      detail_attempts: 0,
    });
    // Alla scadenza dell'attesa la lettura fiscale riparte e chiude la versione.
    const resumed = ebay();
    expect(await acquire(resumed, "2026-09-02T00:15:00.000Z")).toBe("complete");
    expect(calls(resumed, "GetOrders")).toBe(1);
    expect(await detail()).toMatchObject({ detail_error: null, detail_attempts: 0 });
    expect((await detail())!.detail_for).not.toBeNull();
  });

  it("con la quota GetItem esaurita lascia le righe senza immagine e prosegue", async () => {
    const provider = ebay({
      getItem: () => new Response(null, { status: 429, headers: { "Retry-After": "3600" } }),
    });
    expect(await acquire(provider)).toBe("complete");
    expect(
      await env.DB.prepare("SELECT api_origin, until FROM ebay_rate_limits").all(),
    ).toMatchObject({
      results: [{ api_origin: "https://api.ebay.com#GetItem", until: "2026-09-02T01:00:00.000Z" }],
    });
    expect(await count("SELECT COUNT(*) AS total FROM order_items WHERE image_url IS NULL")).toBe(
      await count("SELECT COUNT(*) AS total FROM order_items"),
    );
    // Durante l'attesa una nuova versione dell'ordine non richiama GetItem.
    const next = ebay({ orders: [order({ lastModifiedDate: "2026-09-02T00:05:00.000Z" })] });
    expect(await acquire(next, "2026-09-02T00:10:00.000Z")).toBe("complete");
    expect(next).toHaveBeenCalled();
    expect(calls(next, "GetItem")).toBe(0);
  });

  it("distingue gli errori del dettaglio che fermano l'esecuzione da quelli dell'ordine", async () => {
    const detail = () =>
      env.DB.prepare(
        "SELECT detail_for, detail_error, detail_attempts FROM order_source_refs",
      ).first();
    const pending = { detail_for: null, detail_error: null, detail_attempts: 0 };
    for (const [status, failure] of [
      [503, "unavailable"],
      [401, "credentials"],
    ] as const) {
      await expect(
        acquire(ebay({ trading: () => new Response(null, { status }) })),
      ).rejects.toMatchObject({ failure });
      expect(await detail()).toEqual({ ...pending, detail_error: failure });
      expect((await listVisibleOrders(env.DB, "u-a"))[0]?.taxVerification).toBe("error");
    }
    // La quota GetOrders esaurita lascia il dettaglio in attesa senza consumare tentativi né
    // fermare la lettura; senza Retry-After si attende il valore prudente.
    expect(await acquire(ebay({ trading: () => new Response(null, { status: 429 }) }))).toBe(
      "complete",
    );
    expect(await detail()).toEqual({ ...pending, detail_error: "rate_limited" });
    expect(
      await env.DB.prepare("SELECT api_origin, until FROM ebay_rate_limits").all(),
    ).toMatchObject({
      results: [
        { api_origin: "https://api.ebay.com#GetOrders", until: "2026-09-02T00:15:00.000Z" },
      ],
    });
    await env.DB.prepare("DELETE FROM ebay_rate_limits").run();

    const single = (response: () => Response) => (url: URL) =>
      url.pathname.includes("/order/") ? response() : undefined;
    // Ordine non più leggibile, risposta che non è un ordine e versione più vecchia di
    // quella già registrata: errori del solo ordine, con un nuovo tentativo.
    let at = Date.parse("2026-09-02T00:00:00.000Z");
    for (const [fail, error] of [
      [single(() => new Response(null, { status: 404 })), "rejected"],
      [single(() => Response.json({ orderId: "12-34567-89012" })), "invalid_response"],
      [
        single(() => Response.json(order({ lastModifiedDate: "2026-09-01T08:30:00.000Z" }))),
        "invalid_response",
      ],
    ] as const) {
      await env.DB.prepare(
        "UPDATE order_source_refs SET detail_attempts = 0, detail_retry_at = NULL",
      ).run();
      at += 60_000;
      expect(await acquire(ebay({ fail }), new Date(at).toISOString())).toBe("complete");
      expect(await detail()).toEqual({
        detail_for: null,
        detail_error: error,
        detail_attempts: 1,
      });
    }
  });

  it("non scrive se il consenso cambia dopo una pagina vuota o durante il dettaglio", async () => {
    const reconnect = () =>
      env.DB.prepare(
        "UPDATE ebay_store_credentials SET granted_at = '2026-09-03T00:00:00.000Z'",
      ).run();
    const empty = ebay({ orders: [], before: reconnect });
    expect(await acquire(empty)).toBe("not_writable");
    expect(await syncState()).toMatchObject({
      cursor: "2026-09-02T00:00:00.000Z",
      last_success_at: null,
    });

    for (const fail of [undefined, () => new Response(null, { status: 404 })]) {
      await env.DB.batch([
        env.DB.prepare("DELETE FROM orders"),
        env.DB.prepare("DELETE FROM deleted_order_keys"),
        env.DB.prepare("DELETE FROM sync_state"),
        env.DB.prepare("UPDATE ebay_store_credentials SET granted_at = ?").bind(grantedAt),
      ]);
      const during = ebay({
        before: async (url) => {
          if (url.pathname.includes("/order/")) await reconnect();
        },
        fail: (url) => (url.pathname.includes("/order/") ? fail?.() : undefined),
      });
      expect(await acquire(during)).toBe("not_writable");
      expect(
        await env.DB.prepare(
          "SELECT detail_for, detail_error, detail_attempts FROM order_source_refs",
        ).first(),
      ).toEqual({ detail_for: null, detail_error: null, detail_attempts: 0 });
    }
  });

  it("tiene il negozio per l'esecuzione e regge un orologio indietro rispetto al limite", async () => {
    let nested: string | null = null;
    const fetcher = ebay({
      before: async () => {
        nested ??= await acquire(ebay(), "2026-09-02T00:05:00.000Z");
      },
    });
    expect(await acquire(fetcher)).toBe("complete");
    expect(nested).toBe("busy");

    const earlier = ebay();
    expect(await acquire(earlier, "2026-09-01T23:00:00.000Z")).toBe("complete");
    expect(new URL(String(earlier.mock.calls[0]![0])).searchParams.get("filter")).toBe(
      "lastmodifieddate:[2026-09-01T22:45:00.000Z..2026-09-01T23:00:00.000Z]",
    );
    expect((await syncState())!.cursor).toBe("2026-09-02T00:00:00.000Z");
  });

  it("il lavoro periodico accoda ogni negozio dovuto, con un budget ciascuno, isolando gli errori", async () => {
    const seal = (storeId: string) =>
      sealToken(env.BETTER_AUTH_SECRET, storeId, "access", `token-${storeId}`);
    const expires = "2026-09-02T03:00:00.000Z";
    await env.DB.prepare(
      `INSERT INTO ebay_stores (id, workspace_id, ebay_user_id, linked_at)
       VALUES ('s-c', 'w-a', 'e-c', ?1), ('s-d', 'w-a', 'e-d', ?1)`,
    )
      .bind(now)
      .run();
    await env.DB.prepare("DELETE FROM ebay_store_credentials").run();
    for (const storeId of ["s-a", "s-b", "s-c", "s-d"]) {
      await env.DB.prepare(
        `INSERT INTO ebay_store_credentials
           (store_id, access_token, access_expires_at, refresh_token, refresh_expires_at, granted_at)
         VALUES (?1, ?2, ?3, 'r', ?3, ?4)`,
      )
        // Il token di B non si apre, come dopo una rotazione del segreto.
        .bind(
          storeId,
          storeId === "s-b" ? "v1.illeggibile" : await seal(storeId),
          expires,
          grantedAt,
        )
        .run();
    }
    const tokenOf = (init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      return (
        headers.get("authorization")?.slice("Bearer ".length) ?? headers.get("x-ebay-api-iaf-token")
      );
    };
    const perStore = (fetcher: ReturnType<typeof ebay>) =>
      Object.fromEntries(
        Object.entries(Object.groupBy(fetcher.mock.calls, ([, init]) => tokenOf(init) ?? "")).map(
          ([token, list]) => [token, list!.length],
        ),
      );
    const attempted = async () =>
      Object.fromEntries(
        (
          await env.DB.prepare("SELECT store_id, polled_at FROM sync_state ORDER BY store_id").all<{
            store_id: string;
            polled_at: string | null;
          }>()
        ).results.map(({ store_id, polled_at }) => [store_id, polled_at]),
      );
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const logged = () =>
      errors.mock.calls.filter(([line]) => String(line).includes('"operation":"order_acquisition"'))
        .length;
    try {
      // A e D hanno più lavoro del proprio budget; B non apre il token; C risponde 401.
      const fetcher = ebay({
        orders: series("12-turno", 10, "2026-09-02T00:00:00.000Z"),
        fail: (_, init) =>
          tokenOf(init) === "token-s-c" ? new Response(null, { status: 401 }) : undefined,
      });
      await cronTurn(env, fetcher, new Date("2026-09-02T00:00:00.000Z"));
      // Il budget di A e D più la prima lettura del profilo del negozio, fuori budget.
      expect(perStore(fetcher)).toEqual({ "token-s-a": 13, "token-s-c": 1, "token-s-d": 13 });
      expect(logged()).toBe(2);
      expect(errors.mock.calls.map(([line]) => JSON.parse(String(line)).failure).sort()).toEqual([
        "credentials",
        "credentials",
      ]);
      // C passa il turno; B chiude il consenso prima di acquisire e non scrive il checkpoint.
      expect(await attempted()).toEqual({
        "s-a": "2026-09-02T00:00:00.000Z",
        "s-b": null,
        "s-c": "2026-09-02T00:00:00.000Z",
        "s-d": "2026-09-02T00:00:00.000Z",
      });
      // Il token che non si apre chiude il consenso: B va ricollegato e non si ritenta.
      expect(
        await env.DB.prepare(
          "SELECT store_id, rejected_at FROM ebay_store_credentials WHERE rejected_at IS NOT NULL",
        ).all(),
      ).toMatchObject({
        results: [{ store_id: "s-b", rejected_at: "2026-09-02T00:00:00.000Z" }],
      });

      // Al turno successivo; in pausa o con il token in scadenza un negozio non si legge.
      await env.DB.prepare(
        "INSERT INTO ebay_store_pauses (store_id, reason, paused_at) VALUES ('s-c', 'manual', ?)",
      )
        .bind(now)
        .run();
      const later = ebay({ orders: [] });
      await cronTurn(env, later, new Date("2026-09-02T01:00:00.000Z"));
      expect(Object.keys(perStore(later)).sort()).toEqual(["token-s-a", "token-s-d"]);
      expect(await attempted()).toMatchObject({
        "s-b": null,
        "s-d": "2026-09-02T01:00:00.000Z",
      });
      expect(logged()).toBe(2);
      const expiring = ebay();
      expect(await cronTurn(env, expiring, new Date("2026-09-02T02:56:00.000Z"))).toEqual([]);
      expect(expiring).not.toHaveBeenCalled();
    } finally {
      errors.mockRestore();
    }
  });

  describe("lettura periodica e richieste manuali", () => {
    const start = Date.parse("2026-09-02T00:00:00.000Z");
    const minutes = (value: number) => new Date(start + value * 60_000);
    const send = vi.fn<Queue["send"]>();
    const queueEnv = { ...env, WORK_QUEUE: fakeQueue({ send }) };
    const message = () => {
      const ack = vi.fn();
      const retry = vi.fn();
      return { body: { syncStore: "s-a" }, ack, retry } as unknown as Message<unknown> & {
        ack: typeof ack;
        retry: typeof retry;
      };
    };
    const state = () =>
      env.DB.prepare(
        `SELECT polled_at, requested_at, dispatched_at, history_from, history_until,
                history_done_at FROM sync_state WHERE store_id = 's-a'`,
      ).first<Record<string, string | null>>();
    const runs = async () =>
      (
        await env.DB.prepare(
          "SELECT started_at, ok, new_orders FROM sync_runs WHERE store_id = 's-a' ORDER BY id",
        ).all()
      ).results;
    const request = (at: Date, options: { reimport?: boolean } = {}, userId = "u-a") =>
      requestStoreSync(queueEnv, userId, "s-a", options, at);

    beforeEach(async () => {
      send.mockReset();
      send.mockResolvedValue(queued);
      await env.DB.prepare(
        "UPDATE ebay_store_credentials SET access_token = ? WHERE store_id = 's-a'",
      )
        .bind(await sealToken(env.BETTER_AUTH_SECRET, "s-a", "access", "token-s-a"))
        .run();
    });

    it("ordina per piano, richiesta, arretrato e turno, escludendo chi non è dovuto", () => {
      const at = minutes(60);
      const candidate = (
        id: string,
        plan: "free" | "premium",
        polledMinute: number | null,
        extra: { requested?: boolean; backlog?: boolean } = {},
      ) => ({
        id,
        plan,
        polledAt: polledMinute === null ? null : minutes(polledMinute).toISOString(),
        requestedAt: extra.requested ? minutes(55).toISOString() : null,
        backlog: extra.backlog ?? false,
      });
      const order = syncOrder(
        [
          candidate("free-arretrato", "free", 50, { backlog: true }),
          candidate("free-recente", "free", 40),
          candidate("free-dovuto", "free", 31),
          candidate("premium-arretrato", "premium", 55, { backlog: true }),
          candidate("free-mai", "free", null),
          candidate("premium-dovuto", "premium", 51),
          candidate("premium-recente", "premium", 52),
          candidate("free-richiesto", "free", 58, { requested: true }),
          candidate("free-vecchio", "free", 10),
        ],
        at,
      ).map(({ id }) => id);
      expect(order).toEqual([
        "premium-dovuto",
        "free-richiesto",
        "free-mai",
        "free-vecchio",
        "free-dovuto",
        "premium-arretrato",
        "free-arretrato",
      ]);
    });

    it("il cron legge con la cadenza Free e l'evento non attende il turno", async () => {
      const fetcher = ebay();
      await cronTurn(env, fetcher, minutes(0));
      expect(await state()).toMatchObject({ polled_at: minutes(0).toISOString() });
      expect(await runs()).toEqual([
        { started_at: minutes(0).toISOString(), ok: 1, new_orders: 1 },
      ]);

      // Dieci e venti minuti dopo il negozio Free non è dovuto e non ha arretrati.
      fetcher.mockClear();
      await cronTurn(env, fetcher, minutes(10));
      await cronTurn(env, fetcher, minutes(20));
      expect(fetcher).not.toHaveBeenCalled();

      // Un evento è letto subito e non sposta il turno della lettura periodica.
      fetcher.orders[0] = order({ lastModifiedDate: minutes(21).toISOString() });
      expect(
        await acquireOrders({
          db: env.DB,
          storeId: "s-a",
          grantedAt,
          access: access(fetcher),
          now: minutes(22),
          budget: { calls: 12, pages: 0 },
          confirmedOrderId: "12-34567-89012",
        }),
      ).toBe("complete");
      expect(fetcher).toHaveBeenCalled();
      expect(await state()).toMatchObject({ polled_at: minutes(0).toISOString() });
      expect(await runs()).toHaveLength(1);

      fetcher.mockClear();
      await cronTurn(env, fetcher, minutes(30));
      expect(pages(fetcher, "lastmodifieddate")).toEqual([0]);
      expect(await state()).toMatchObject({ polled_at: minutes(30).toISOString() });

      // Una richiesta rende il negozio dovuto anche se il cron l'aveva letto da poco: così si
      // riprende quella che la coda non ha consegnato.
      await env.DB.prepare("UPDATE sync_state SET requested_at = ?")
        .bind(minutes(35).toISOString())
        .run();
      fetcher.mockClear();
      await cronTurn(env, fetcher, minutes(40));
      expect(pages(fetcher, "lastmodifieddate")).toEqual([0]);
      expect(await state()).toMatchObject({ requested_at: null });

      // Lo storico ancora da importare è lavoro arretrato: si legge a ogni esecuzione utile.
      await env.DB.prepare("UPDATE sync_state SET history_done_at = NULL").run();
      fetcher.mockClear();
      await cronTurn(env, fetcher, minutes(50));
      expect(pages(fetcher, "creationdate")).toEqual([0]);
      fetcher.mockClear();
      await cronTurn(env, fetcher, minutes(60));
      expect(fetcher).not.toHaveBeenCalled();
      expect((await runs()).map(({ ok, new_orders }) => [ok, new_orders])).toEqual([
        [1, 0],
        [1, 0],
        [1, 0],
      ]);
    });

    it("unisce le richieste ripetute e le serve una volta, anche con consegne ripetute", async () => {
      expect(await request(minutes(0))).toBe("queued");
      expect(await request(minutes(1))).toBe("merged");
      expect(send).toHaveBeenCalledOnce();
      expect(send).toHaveBeenCalledWith({ syncStore: "s-a" });
      expect(await state()).toMatchObject({ requested_at: minutes(0).toISOString() });

      const fetcher = ebay();
      const first = message();
      await consumeStoreSync(first, queueEnv, fetcher, minutes(2));
      expect(first.ack).toHaveBeenCalledOnce();
      expect(await state()).toMatchObject({
        requested_at: null,
        polled_at: minutes(2).toISOString(),
      });
      expect(await runs()).toEqual([
        { started_at: minutes(2).toISOString(), ok: 1, new_orders: 1 },
      ]);

      // La stessa consegna ripetuta trova la richiesta servita e non chiama eBay.
      fetcher.mockClear();
      const repeated = message();
      const errors = vi.spyOn(console, "error");
      await consumeStoreSync(repeated, queueEnv, fetcher, minutes(3));
      expect(errors).not.toHaveBeenCalled();
      errors.mockRestore();
      expect(fetcher).not.toHaveBeenCalled();
      expect(repeated.ack).toHaveBeenCalledOnce();
      expect(await runs()).toHaveLength(1);

      // Dopo la lettura una nuova richiesta riparte; solo lo spazio proprietario la chiede, e
      // un negozio in pausa non legge.
      expect(await request(minutes(4))).toBe("queued");
      expect(await request(minutes(4), {}, "u-b")).toBe("not_found");
      await env.DB.prepare(
        "INSERT INTO ebay_store_pauses (store_id, reason, paused_at) VALUES ('s-a', 'manual', ?)",
      )
        .bind(minutes(5).toISOString())
        .run();
      expect(await request(minutes(5))).toBe("invalid");
      const paused = message();
      await consumeStoreSync(paused, queueEnv, fetcher, minutes(5));
      expect(fetcher).not.toHaveBeenCalled();
      expect(paused.ack).toHaveBeenCalledOnce();
      expect(await state()).toMatchObject({ requested_at: minutes(4).toISOString() });
    });

    it("riprende una richiesta dopo una coda non disponibile o un'esecuzione interrotta", async () => {
      const errors = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        // La coda rifiuta l'invio: la richiesta resta in D1 e il cron la serve.
        send.mockRejectedValueOnce(new Error("queue unavailable"));
        expect(await request(minutes(0))).toBe("queued");
        expect(String(errors.mock.calls.at(-1)?.[0])).toContain('"operation":"order_acquisition"');
        expect(await state()).toMatchObject({ requested_at: minutes(0).toISOString() });
        const fetcher = ebay();
        await cronTurn(env, fetcher, minutes(0.5));
        expect(fetcher).toHaveBeenCalled();
        expect(await state()).toMatchObject({ requested_at: null });

        // Un'esecuzione interrotta lascia il negozio tenuto: la consegna riprova più tardi
        // senza chiamare eBay, poi alla scadenza del blocco la richiesta si completa.
        expect(await request(minutes(1))).toBe("queued");
        await env.DB.prepare("UPDATE sync_state SET locked_until = ?")
          .bind(minutes(16).toISOString())
          .run();
        fetcher.mockClear();
        const held = message();
        await consumeStoreSync(held, queueEnv, fetcher, minutes(2));
        expect(fetcher).not.toHaveBeenCalled();
        expect(held.retry).toHaveBeenCalledWith({ delaySeconds: 60 });
        expect(held.ack).not.toHaveBeenCalled();
        const resumed = message();
        await consumeStoreSync(resumed, queueEnv, fetcher, minutes(16));
        expect(resumed.ack).toHaveBeenCalledOnce();
        expect(await state()).toMatchObject({ requested_at: null });
        // La rilettura non duplica l'ordine già acquisito.
        expect(await count("SELECT count(*) AS total FROM orders WHERE store_id = 's-a'")).toBe(1);
      } finally {
        errors.mockRestore();
      }
    });

    it("rispetta l'attesa chiesta da eBay per tutto il keyset", async () => {
      const errors = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        expect(await request(minutes(0))).toBe("queued");
        const limited = ebay({
          fail: () => new Response(null, { status: 429, headers: { "retry-after": "600" } }),
        });
        const first = message();
        await consumeStoreSync(first, queueEnv, limited, minutes(1));
        expect(first.retry).toHaveBeenCalledWith({ delaySeconds: 600 });
        expect(String(errors.mock.calls.at(-1)?.[0])).toContain('"operation":"order_acquisition"');
        // La richiesta resta per la ripresa; la lettura non riuscita compare fra le ultime.
        expect(await state()).toMatchObject({ requested_at: minutes(0).toISOString() });
        expect(await runs()).toEqual([
          { started_at: minutes(1).toISOString(), ok: 0, new_orders: 0 },
        ]);

        // Durante l'attesa né la coda né il cron chiamano eBay e l'utente lo sa.
        expect(await request(minutes(2))).toBe("limited");
        const fetcher = ebay();
        const early = message();
        await consumeStoreSync(early, queueEnv, fetcher, minutes(6));
        expect(early.retry).toHaveBeenCalledWith({ delaySeconds: 300 });
        // Il cron esclude il keyset in attesa senza tentare né registrare errori.
        errors.mockClear();
        await cronTurn(env, fetcher, minutes(10));
        expect(fetcher).not.toHaveBeenCalled();
        expect(errors).not.toHaveBeenCalled();

        await cronTurn(env, fetcher, minutes(11));
        expect(fetcher).toHaveBeenCalled();
        expect(await state()).toMatchObject({ requested_at: null });
      } finally {
        errors.mockRestore();
      }
    });

    it("dopo un limite il cron non tenta gli altri negozi dello stesso keyset", async () => {
      await env.DB.prepare(
        `INSERT INTO ebay_store_credentials
           (store_id, access_token, access_expires_at, refresh_token, refresh_expires_at, granted_at)
         VALUES ('s-b', ?1, ?2, 'r', ?2, ?3)`,
      )
        .bind(await sealToken(env.BETTER_AUTH_SECRET, "s-b", "access", "token-s-b"), now, grantedAt)
        .run();
      const errors = vi.spyOn(console, "error").mockImplementation(() => {});
      const failing = (status: number) =>
        ebay({
          fail: (_, init) =>
            new Headers(init?.headers).get("authorization") === "Bearer token-s-a"
              ? new Response(null, { status })
              : undefined,
        });
      const polledB = () =>
        env.DB.prepare("SELECT polled_at FROM sync_state WHERE store_id = 's-b'").first();
      try {
        // Un errore del solo negozio non ferma gli altri.
        const rejected = failing(401);
        await cronTurn(env, rejected, minutes(0));
        expect(await polledB()).toEqual({ polled_at: minutes(0).toISOString() });
        expect(errors).toHaveBeenCalledOnce();

        // Un limite sì: il negozio non tentato resta il primo del prossimo turno utile.
        errors.mockClear();
        const limited = failing(429);
        await cronTurn(env, limited, minutes(30));
        expect(limited).toHaveBeenCalledOnce();
        expect(errors).toHaveBeenCalledOnce();
        expect(await polledB()).toEqual({ polled_at: minutes(0).toISOString() });
      } finally {
        errors.mockRestore();
      }
    });

    it("i negozi di un keyset in attesa non tolgono il turno a quelli dell'altro ambiente", async () => {
      const sandbox = withSandbox(env);
      await env.DB.prepare(
        `INSERT INTO ebay_stores (id, workspace_id, ebay_user_id, linked_at, ebay_environment)
         VALUES ('s-c', 'w-a', 'e-c', ?1, 'production'), ('s-d', 'w-a', 'e-d', ?1, 'production'),
                ('s-e', 'w-a', 'e-e', ?1, 'sandbox')`,
      )
        .bind(now)
        .run();
      for (const storeId of ["s-c", "s-d", "s-e"])
        await env.DB.prepare(
          `INSERT INTO ebay_store_credentials
             (store_id, access_token, access_expires_at, refresh_token, refresh_expires_at, granted_at)
           VALUES (?1, ?2, ?3, 'r', ?3, ?4)`,
        )
          .bind(
            storeId,
            await sealToken(env.BETTER_AUTH_SECRET, storeId, "access", `token-${storeId}`),
            now,
            grantedAt,
          )
          .run();
      // La quota esaurita di una sola chiamata Trading non ferma le letture dell'origine.
      await env.DB.prepare(
        `INSERT INTO ebay_rate_limits (api_origin, until)
         VALUES ('https://api.ebay.com', ?1), ('https://api.sandbox.ebay.com#GetOrders', ?1)`,
      )
        .bind(minutes(15).toISOString())
        .run();
      const fetcher = ebay();
      await cronTurn(sandbox, fetcher, minutes(0));
      expect(fetcher.mock.calls.map(([input]) => new URL(String(input)).origin)).toContain(
        "https://api.sandbox.ebay.com",
      );
      expect(
        fetcher.mock.calls.every(
          ([input]) => new URL(String(input)).origin === "https://api.sandbox.ebay.com",
        ),
      ).toBe(true);
    });

    it("mostra nella schermata le letture non riuscite e nessuna per un negozio mai letto", async () => {
      await env.DB.prepare(
        "INSERT INTO ebay_stores (id, workspace_id, ebay_user_id, linked_at) VALUES ('s-c', 'w-a', 'e-c', ?)",
      )
        .bind(now)
        .run();
      await env.DB.prepare(
        "INSERT INTO sync_runs (store_id, started_at, ok, new_orders) VALUES ('s-a', ?, 0, 0)",
      )
        .bind(minutes(0).toISOString())
        .run();
      const stores = await listStores(env.DB, "u-a", minutes(1));
      expect(Object.fromEntries(stores.map((store) => [store.id, store.recent]))).toEqual({
        "s-a": [{ at: minutes(0).toISOString(), ok: false, newOrders: 0 }],
        "s-c": [],
      });
    });

    it("un evento non riuscito non compare fra le letture e non serve la richiesta", async () => {
      expect(await request(minutes(0))).toBe("queued");
      await expect(
        acquireOrders({
          db: env.DB,
          storeId: "s-a",
          grantedAt,
          access: access(ebay({ fail: () => new Response(null, { status: 503 }) })),
          now: minutes(1),
          budget: { calls: 12, pages: 0 },
          confirmedOrderId: "12-34567-89012",
        }),
      ).rejects.toMatchObject({ failure: "unavailable" });
      expect(await runs()).toEqual([]);
      expect(await state()).toMatchObject({ requested_at: minutes(0).toISOString() });
    });

    it("una lettura fallita serve la richiesta e un'attesa nota ferma l'acquisizione", async () => {
      expect(await request(minutes(0))).toBe("queued");
      const rejected = ebay({ fail: () => new Response(null, { status: 401 }) });
      const read = (fetcher: typeof fetch, at: Date) =>
        acquireOrders({
          db: env.DB,
          storeId: "s-a",
          grantedAt,
          access: access(fetcher),
          now: at,
          budget: { calls: 12, pages: 3 },
        });
      await expect(read(rejected, minutes(1))).rejects.toMatchObject({ failure: "credentials" });
      expect(await state()).toMatchObject({ requested_at: null });
      expect(await runs()).toEqual([
        { started_at: minutes(1).toISOString(), ok: 0, new_orders: 0 },
      ]);

      await env.DB.prepare(
        "INSERT INTO ebay_rate_limits (api_origin, until) VALUES ('https://api.ebay.com', ?)",
      )
        .bind(minutes(7).toISOString())
        .run();
      const fetcher = ebay();
      await expect(read(fetcher, minutes(2))).rejects.toMatchObject({
        failure: "rate_limited",
        details: { retryAfter: 300 },
      });
      expect(fetcher).not.toHaveBeenCalled();
    });

    it("dopo una lettura non riuscita l'arretrato attende la cadenza del piano", async () => {
      const errors = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        // Storico mai importato e lettura rifiutata: nessun nuovo tentativo ogni dieci minuti.
        await cronTurn(env, ebay({ fail: () => new Response(null, { status: 401 }) }), minutes(0));
        const fetcher = ebay();
        await cronTurn(env, fetcher, minutes(10));
        await cronTurn(env, fetcher, minutes(20));
        expect(fetcher).not.toHaveBeenCalled();
        await cronTurn(env, fetcher, minutes(30));
        expect(pages(fetcher, "creationdate")).toEqual([0]);

        // Dopo una lettura riuscita l'arretrato riprende al turno successivo.
        await env.DB.prepare("UPDATE sync_state SET history_done_at = NULL").run();
        fetcher.mockClear();
        await cronTurn(env, fetcher, minutes(40));
        expect(pages(fetcher, "creationdate")).toEqual([0]);
      } finally {
        errors.mockRestore();
      }
    });

    it("non anticipa l'arretrato di un negozio letto da meno di nove minuti", async () => {
      await cronTurn(env, ebay(), minutes(0));
      await env.DB.prepare("UPDATE sync_state SET history_done_at = NULL").run();
      const fetcher = ebay();
      await cronTurn(env, fetcher, minutes(8));
      expect(fetcher).not.toHaveBeenCalled();
      await cronTurn(env, fetcher, minutes(9));
      expect(pages(fetcher, "creationdate")).toEqual([0]);
    });

    it("con il token in rinnovo lascia la richiesta al cron e chiude gli altri errori", async () => {
      const errors = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        expect(await request(minutes(0))).toBe("queued");
        await env.DB.prepare("UPDATE ebay_store_credentials SET access_expires_at = ?")
          .bind(minutes(4).toISOString())
          .run();
        const fetcher = ebay();
        const renewing = message();
        await consumeStoreSync(renewing, queueEnv, fetcher, minutes(0));
        expect(fetcher).not.toHaveBeenCalled();
        expect(renewing.ack).toHaveBeenCalledOnce();
        expect(await state()).toMatchObject({ requested_at: minutes(0).toISOString() });

        // Un errore diverso dal limite chiude la consegna: l'esito resta fra le ultime letture.
        await env.DB.prepare("UPDATE ebay_store_credentials SET access_expires_at = ?")
          .bind(now)
          .run();
        const rejected = message();
        await consumeStoreSync(
          rejected,
          queueEnv,
          ebay({ fail: () => new Response(null, { status: 401 }) }),
          minutes(1),
        );
        expect(rejected.ack).toHaveBeenCalledOnce();
        expect(rejected.retry).not.toHaveBeenCalled();
        expect(await state()).toMatchObject({ requested_at: null });
        expect(await runs()).toEqual([
          { started_at: minutes(1).toISOString(), ok: 0, new_orders: 0 },
        ]);
      } finally {
        errors.mockRestore();
      }
    });

    it("non registra richieste per un negozio in pausa o scollegato, neanche in importazione", async () => {
      await cronTurn(env, ebay(), minutes(0));
      await env.DB.prepare("UPDATE sync_state SET history_done_at = NULL").run();
      await env.DB.prepare(
        "INSERT INTO ebay_store_pauses (store_id, reason, paused_at) VALUES ('s-a', 'manual', ?)",
      )
        .bind(minutes(1).toISOString())
        .run();
      expect(await request(minutes(1), { reimport: true })).toBe("invalid");
      await env.DB.prepare("DELETE FROM ebay_store_pauses").run();
      await env.DB.prepare("DELETE FROM ebay_store_credentials").run();
      expect(await request(minutes(2), { reimport: true })).toBe("invalid");
      expect(await state()).toMatchObject({ requested_at: null });
      expect(send).not.toHaveBeenCalled();
    });

    it("reimporta lo storico solo a importazione conclusa", async () => {
      // Prima del primo avvio la richiesta avvia l'importazione.
      expect(await request(minutes(0), { reimport: true })).toBe("queued");
      await consumeStoreSync(message(), queueEnv, ebay(), minutes(1));
      expect(await state()).toMatchObject({
        history_from: "2026-08-03T00:01:00.000Z",
        history_done_at: minutes(1).toISOString(),
      });

      expect(await request(minutes(60 * 24), { reimport: true })).toBe("queued");
      expect(await state()).toMatchObject({
        history_from: "2026-08-04T00:00:00.000Z",
        history_until: minutes(60 * 24).toISOString(),
        history_done_at: null,
      });
      // Una seconda richiesta durante l'importazione non la fa ripartire.
      expect(await request(minutes(60 * 24 + 1), { reimport: true })).toBe("importing");
      expect(await state()).toMatchObject({ history_until: minutes(60 * 24).toISOString() });
      expect(send).toHaveBeenCalledTimes(2);

      const fetcher = ebay();
      await consumeStoreSync(message(), queueEnv, fetcher, minutes(60 * 24 + 2));
      expect(pages(fetcher, "creationdate")).toEqual([0]);
      expect(await state()).toMatchObject({
        history_done_at: minutes(60 * 24 + 2).toISOString(),
      });
    });

    it("con una copertura la reimportazione riparte da un anno di storico", async () => {
      expect(await request(minutes(0), { reimport: true })).toBe("queued");
      await consumeStoreSync(message(), queueEnv, ebay(), minutes(1));
      await env.DB.prepare(
        `INSERT INTO workspace_entitlements (id, workspace_id, source, starts_at, ends_at)
         VALUES ('e-reimport', 'w-a', 'premium', ?, ?)`,
      )
        .bind(minutes(2).toISOString(), minutes(60 * 24 * 30).toISOString())
        .run();
      expect(await request(minutes(60), { reimport: true })).toBe("queued");
      expect(await state()).toMatchObject({
        history_from: "2025-09-02T01:00:00.000Z",
        history_until: minutes(60).toISOString(),
        history_done_at: null,
      });
    });

    it("conserva le ultime tre letture con gli ordini nuovi di ciascuna", async () => {
      const fetcher = ebay({ orders: [] });
      for (let index = 0; index < 6; index += 1) {
        if (index === 3)
          fetcher.orders.push(
            order({
              orderId: "12-nuovo",
              creationDate: minutes(80).toISOString(),
              lastModifiedDate: minutes(80).toISOString(),
            }),
          );
        await cronTurn(env, fetcher, minutes(index * 30));
      }
      expect((await runs()).map(({ started_at, new_orders }) => [started_at, new_orders])).toEqual([
        [minutes(90).toISOString(), 1],
        [minutes(120).toISOString(), 0],
        [minutes(150).toISOString(), 0],
      ]);
    });

    it("rinnovo del token e ricollegamento durante una lettura non ripristinano stati superati", async () => {
      // Il rinnovo cambia soltanto il token: la lettura partita prima scrive con lo stesso consenso.
      expect(await request(minutes(0))).toBe("queued");
      const refreshed = ebay({
        before: async () => {
          await env.DB.prepare(
            "UPDATE ebay_store_credentials SET access_token = 'rinnovato', refreshed_at = ?",
          )
            .bind(minutes(1).toISOString())
            .run();
        },
      });
      const first = message();
      await consumeStoreSync(first, queueEnv, refreshed, minutes(1));
      expect(first.ack).toHaveBeenCalledOnce();
      expect(await count("SELECT count(*) AS total FROM orders WHERE store_id = 's-a'")).toBe(1);

      // Un ricollegamento a metà lettura cambia il consenso: nessuna scrittura né lettura
      // registrata, e la richiesta resta per il nuovo consenso.
      await env.DB.prepare("UPDATE ebay_store_credentials SET access_token = ?")
        .bind(await sealToken(env.BETTER_AUTH_SECRET, "s-a", "access", "token-s-a"))
        .run();
      expect(await request(minutes(2))).toBe("queued");
      const reconnected = ebay({
        orders: [order({ orderId: "12-dopo", lastModifiedDate: minutes(2).toISOString() })],
        before: async () => {
          await env.DB.prepare("UPDATE ebay_store_credentials SET granted_at = ?")
            .bind(minutes(2).toISOString())
            .run();
        },
      });
      const second = message();
      await consumeStoreSync(second, queueEnv, reconnected, minutes(3));
      expect(second.ack).toHaveBeenCalledOnce();
      expect(
        await count("SELECT count(*) AS total FROM orders WHERE ebay_order_id = '12-dopo'"),
      ).toBe(0);
      expect(await runs()).toHaveLength(1);
      expect(await state()).toMatchObject({ requested_at: minutes(2).toISOString() });
    });

    describe("smistamento del cron", () => {
      const sendBatch = vi.fn<Queue["sendBatch"]>();
      const cron = { ...env, WORK_QUEUE: { send, sendBatch } } as unknown as Env;

      beforeEach(async () => {
        sendBatch.mockReset();
        sendBatch.mockResolvedValue(queued);
        await env.DB.prepare("DELETE FROM scheduled_tasks").run();
      });

      it("accoda un negozio una volta anche con trigger ripetuti e riaccoda un turno perso", async () => {
        expect(await dispatchStoreSyncs(cron, minutes(0))).toEqual(["s-a"]);
        expect(sendBatch).toHaveBeenCalledWith([{ body: { syncStore: "s-a" } }]);
        // Lo stesso turno ricevuto più volte, anche con orari a pochi secondi di distanza.
        expect(await dispatchStoreSyncs(cron, minutes(0))).toEqual([]);
        expect(await dispatchStoreSyncs(cron, minutes(0.1))).toEqual([]);
        expect(sendBatch).toHaveBeenCalledOnce();

        // Il messaggio accettato non arriva più (scaduto o nella DLQ): il checkpoint resta e
        // dopo un'ora il turno si riaccoda.
        expect(await dispatchStoreSyncs(cron, minutes(59))).toEqual([]);
        expect(await dispatchStoreSyncs(cron, minutes(60))).toEqual(["s-a"]);
        const fetcher = ebay();
        const served = message();
        await consumeStoreSync(served, env, fetcher, minutes(61));
        expect(served.ack).toHaveBeenCalledOnce();
        expect(await state()).toMatchObject({
          polled_at: minutes(61).toISOString(),
          dispatched_at: null,
        });
        // Il messaggio originale consegnato in ritardo trova il turno già servito.
        fetcher.mockClear();
        const late = message();
        await consumeStoreSync(late, env, fetcher, minutes(62));
        expect(fetcher).not.toHaveBeenCalled();
        expect(late.ack).toHaveBeenCalledOnce();

        // Il prossimo turno segue la cadenza Free.
        expect(await dispatchStoreSyncs(cron, minutes(80))).toEqual([]);
        expect(await dispatchStoreSyncs(cron, minutes(90))).toEqual(["s-a"]);
      });

      it("durante la prova legge con la cadenza Premium e poi torna a quella Free", async () => {
        expect(await dispatchStoreSyncs(cron, minutes(0))).toEqual(["s-a"]);
        await consumeStoreSync(message(), env, ebay(), minutes(1));
        expect(await dispatchStoreSyncs(cron, minutes(11))).toEqual([]);
        await env.DB.prepare(`INSERT INTO workspace_entitlements (id, workspace_id, source, starts_at, ends_at)
          VALUES ('prova', 'w-a', 'trial', ?, ?)`)
          .bind(minutes(5).toISOString(), minutes(20).toISOString())
          .run();
        expect(await dispatchStoreSyncs(cron, minutes(11))).toEqual(["s-a"]);
        await consumeStoreSync(message(), env, ebay(), minutes(12));
        // Alla fine della prova il turno segue di nuovo la cadenza Free.
        expect(await dispatchStoreSyncs(cron, minutes(23))).toEqual([]);
        expect(await dispatchStoreSyncs(cron, minutes(42))).toEqual(["s-a"]);
      });

      it("fra trigger sovrapposti uno solo prende il turno di un negozio", async () => {
        const turns = await Promise.all([
          dispatchStoreSyncs(cron, minutes(0)),
          dispatchStoreSyncs(cron, minutes(0)),
        ]);
        expect(turns.flat()).toEqual(["s-a"]);
        expect(sendBatch).toHaveBeenCalledOnce();
      });

      it("accoda anche un negozio di un ambiente non configurato, che poi passa il turno", async () => {
        const errors = vi.spyOn(console, "error").mockImplementation(() => {});
        try {
          await env.DB.prepare("UPDATE ebay_stores SET ebay_environment = 'sandbox'").run();
          await env.DB.prepare(
            "INSERT INTO ebay_rate_limits (api_origin, until) VALUES ('https://api.ebay.com', ?)",
          )
            .bind(minutes(15).toISOString())
            .run();
          expect(await dispatchStoreSyncs(cron, minutes(0))).toEqual(["s-a"]);
          const fetcher = ebay();
          const turn = message();
          await consumeStoreSync(turn, env, fetcher, minutes(1));
          expect(fetcher).not.toHaveBeenCalled();
          expect(turn.ack).toHaveBeenCalledOnce();
          expect(errors).toHaveBeenCalledOnce();
          expect(await state()).toMatchObject({
            polled_at: minutes(1).toISOString(),
            dispatched_at: null,
          });
        } finally {
          errors.mockRestore();
        }
      });

      it("con la coda non disponibile libera il turno per il trigger successivo", async () => {
        sendBatch.mockRejectedValueOnce(new Error("queue unavailable"));
        await expect(dispatchStoreSyncs(cron, minutes(0))).rejects.toThrow("queue unavailable");
        expect(await state()).toMatchObject({ dispatched_at: null, polled_at: null });
        expect(await dispatchStoreSyncs(cron, minutes(10))).toEqual(["s-a"]);
      });

      it("non accoda negozi di un keyset in attesa né negozi in pausa", async () => {
        await env.DB.prepare(
          "INSERT INTO ebay_rate_limits (api_origin, until) VALUES ('https://api.ebay.com', ?)",
        )
          .bind(minutes(15).toISOString())
          .run();
        expect(await dispatchStoreSyncs(cron, minutes(0))).toEqual([]);
        await env.DB.prepare("DELETE FROM ebay_rate_limits").run();
        await env.DB.prepare(
          "INSERT INTO ebay_store_pauses (store_id, reason, paused_at) VALUES ('s-a', 'manual', ?)",
        )
          .bind(minutes(1).toISOString())
          .run();
        expect(await dispatchStoreSyncs(cron, minutes(1))).toEqual([]);
        expect(sendBatch).not.toHaveBeenCalled();
      });

      it("il cron accoda compiti e letture senza chiamare eBay e un passo fallito non ferma gli altri", async () => {
        const errors = vi.spyOn(console, "error").mockImplementation(() => {});
        const fetcher = vi.spyOn(globalThis, "fetch");
        try {
          sendBatch.mockRejectedValueOnce(new Error("queue unavailable"));
          await dispatchScheduledWork(cron, minutes(0));
          expect(JSON.parse(String(errors.mock.calls[0]![0]))).toMatchObject({
            operation: "scheduling",
          });
          expect(sendBatch).toHaveBeenLastCalledWith([{ body: { syncStore: "s-a" } }]);
          // I compiti non accodati restano al trigger successivo dello stesso periodo.
          await dispatchScheduledWork(cron, minutes(1));
          expect(sendBatch).toHaveBeenLastCalledWith([
            { body: { task: "maintenance", slot: "2026-09-02T00:00:00.000Z" } },
            { body: { task: "token_refresh", slot: "2026-09-02T00:00:00.000Z" } },
            { body: { task: "inactivity", slot: "2026-09-02T00:00:00.000Z" } },
            { body: { task: "billing", slot: "2026-09-02T00:00:00.000Z" } },
            { body: { task: "telegram", slot: "2026-09-02T00:00:00.000Z" } },
            { body: { task: "telegram_commands", slot: "2026-09-02T00:00:00.000Z" } },
          ]);
          expect(sendBatch).toHaveBeenCalledTimes(3);
          expect(fetcher).not.toHaveBeenCalled();
        } finally {
          errors.mockRestore();
          fetcher.mockRestore();
        }
      });

      it("accoda ogni compito una volta per periodo con trigger ripetuti, sovrapposti o saltati", async () => {
        const slot = (minute: number) => ({ slot: minutes(minute).toISOString() });
        expect(await dispatchTasks(cron, minutes(0))).toEqual([
          "maintenance",
          "token_refresh",
          "inactivity",
          "billing",
          "telegram",
          "telegram_commands",
        ]);
        expect(sendBatch).toHaveBeenCalledWith([
          { body: { task: "maintenance", ...slot(0) } },
          { body: { task: "token_refresh", ...slot(0) } },
          { body: { task: "inactivity", ...slot(0) } },
          { body: { task: "billing", ...slot(0) } },
          { body: { task: "telegram", ...slot(0) } },
          { body: { task: "telegram_commands", ...slot(0) } },
        ]);
        // Ripetuto a pochi secondi, o un trigger precedente consegnato in ritardo.
        expect(await dispatchTasks(cron, minutes(0.05))).toEqual([]);
        expect(await dispatchTasks(cron, minutes(-0.05))).toEqual([]);
        // Il periodo successivo del rinnovo; inattività e riconciliazione sono orarie, la pulizia
        // giornaliera.
        expect(await dispatchTasks(cron, minutes(10))).toEqual(["token_refresh", "telegram"]);
        // Trigger saltati fra 20 e 40: il primo che arriva prende il turno.
        expect(await dispatchTasks(cron, minutes(50))).toEqual(["token_refresh", "telegram"]);
        expect(sendBatch).toHaveBeenLastCalledWith([
          { body: { task: "token_refresh", ...slot(50) } },
          { body: { task: "telegram", ...slot(50) } },
        ]);
        expect(await dispatchTasks(cron, minutes(24 * 60 + 3))).toEqual([
          "maintenance",
          "token_refresh",
          "inactivity",
          "billing",
          "telegram",
          "telegram_commands",
        ]);
        expect(sendBatch).toHaveBeenLastCalledWith([
          { body: { task: "maintenance", ...slot(24 * 60) } },
          { body: { task: "token_refresh", ...slot(24 * 60) } },
          { body: { task: "inactivity", ...slot(24 * 60) } },
          { body: { task: "billing", ...slot(24 * 60) } },
          { body: { task: "telegram", ...slot(24 * 60) } },
          { body: { task: "telegram_commands", ...slot(24 * 60) } },
        ]);
      });

      it("esegue un compito una volta e riaccoda il turno il cui messaggio è andato perso", async () => {
        const expired = () =>
          env.DB.prepare(
            `INSERT INTO "verification" ("id", "identifier", "value", "expiresAt", "createdAt", "updatedAt")
             VALUES ('compito-scaduto', 'compito', 'x', ?1, ?1, ?1)`,
          )
            .bind(minutes(-1).toISOString())
            .run();
        const remaining = async () =>
          (await env.DB.prepare(
            'SELECT count(*) AS total FROM "verification" WHERE "identifier" = \'compito\'',
          ).first<{ total: number }>())!.total;
        await expired();
        await dispatchTasks(cron, minutes(0));
        const body = { task: "maintenance", slot: minutes(0).toISOString() };

        // Accettato e mai consegnato: entro l'ora non si riaccoda, dopo sì, con lo stesso turno.
        expect(await dispatchTasks(cron, minutes(59))).toEqual(["token_refresh", "telegram"]);
        expect(await dispatchTasks(cron, minutes(60))).toEqual([
          "maintenance",
          "token_refresh",
          "inactivity",
          "billing",
          "telegram",
          "telegram_commands",
        ]);
        expect(sendBatch).toHaveBeenLastCalledWith(expect.arrayContaining([{ body }]));

        const first = queueMessage(body);
        await consumeTask(first, env, fetch, minutes(61));
        expect(first.ack).toHaveBeenCalledOnce();
        expect(await remaining()).toBe(0);
        // Una consegna ripetuta, o un turno ormai superato, non ripete il lavoro.
        await expired();
        const repeated = queueMessage(body);
        await consumeTask(repeated, env, fetch, minutes(62));
        expect(repeated.ack).toHaveBeenCalledOnce();
        const older = queueMessage({
          task: "maintenance",
          slot: minutes(-24 * 60).toISOString(),
        });
        await consumeTask(older, env, fetch, minutes(62));
        expect(older.ack).toHaveBeenCalledOnce();
        expect(await remaining()).toBe(1);
        // Un turno concluso non si riaccoda nello stesso giorno.
        expect(await dispatchTasks(cron, minutes(180))).toEqual([
          "token_refresh",
          "inactivity",
          "billing",
          "telegram",
          "telegram_commands",
        ]);
      });

      it("serializza due consegne dello stesso compito e riprende una lease scaduta", async () => {
        await dispatchTasks(cron, minutes(0));
        const body = { task: "maintenance", slot: minutes(0).toISOString() };
        let entered!: () => void;
        let release!: () => void;
        const started = new Promise<void>((resolve) => {
          entered = resolve;
        });
        const blocked = new Promise<void>((resolve) => {
          release = resolve;
        });
        const original = env.DB.batch.bind(env.DB);
        const batch = vi.spyOn(env.DB, "batch").mockImplementation(async (statements) => {
          entered();
          await blocked;
          return original(statements);
        });
        const first = queueMessage(body);
        const running = consumeTask(first, env, fetch, minutes(1));
        try {
          await started;
          const duplicate = queueMessage(body);
          await consumeTask(duplicate, env, fetch, minutes(1));
          expect(duplicate.retry).toHaveBeenCalledWith({ delaySeconds: 60 });
          expect(duplicate.ack).not.toHaveBeenCalled();
          expect(batch).toHaveBeenCalledOnce();
        } finally {
          release();
          await running;
          batch.mockRestore();
        }
        expect(first.ack).toHaveBeenCalledOnce();
        await env.DB.prepare(
          "UPDATE scheduled_tasks SET done_at = NULL, lease = 'interrupted', locked_until = ? WHERE task = 'maintenance'",
        )
          .bind(minutes(2).toISOString())
          .run();
        const resumed = queueMessage(body);
        await consumeTask(resumed, env, fetch, minutes(3));
        expect(resumed.ack).toHaveBeenCalledOnce();
        expect(
          await env.DB.prepare(
            "SELECT lease, locked_until, done_at FROM scheduled_tasks WHERE task = 'maintenance'",
          ).first(),
        ).toEqual({ lease: null, locked_until: null, done_at: minutes(3).toISOString() });
      });

      it("fra trigger sovrapposti uno solo accoda il turno di un compito", async () => {
        const turns = await Promise.all([
          dispatchTasks(cron, minutes(0)),
          dispatchTasks(cron, minutes(0)),
        ]);
        expect(turns.flat().sort()).toEqual([
          "billing",
          "inactivity",
          "maintenance",
          "telegram",
          "telegram_commands",
          "token_refresh",
        ]);
        expect(sendBatch).toHaveBeenCalledOnce();
      });

      it("ogni passo del cron fallito si registra senza fermare gli altri", async () => {
        const errors = vi.spyOn(console, "error").mockImplementation(() => {});
        try {
          await env.DB.prepare(
            `INSERT INTO webhook_receipts
               (id, provider, environment, provider_id, topic, object_id, event_at, expires_at)
             VALUES ('ricevuta-cron', 'stripe', 'test', 'evt-cron', 'evento', 'oggetto', ?1, ?2)`,
          )
            .bind(minutes(0).toISOString(), minutes(60).toISOString())
            .run();
          sendBatch.mockRejectedValue(new Error("queue unavailable"));
          send.mockRejectedValue(new Error("queue unavailable"));
          await dispatchScheduledWork(cron, minutes(0));
          expect(errors.mock.calls.map(([line]) => JSON.parse(String(line)).operation)).toEqual([
            "scheduling",
            "webhook_ingress",
            "scheduling",
          ]);
          expect(sendBatch).toHaveBeenCalledTimes(2);
        } finally {
          errors.mockRestore();
          await env.DB.prepare("DELETE FROM webhook_receipts").run();
        }
      });

      it("il compito di rinnovo rinnova i token in scadenza dal consumer", async () => {
        await env.DB.prepare(
          "UPDATE ebay_store_credentials SET refresh_token = ?, access_expires_at = ?",
        )
          .bind(
            await sealToken(env.BETTER_AUTH_SECRET, "s-a", "refresh", "refresh-sintetico"),
            minutes(20).toISOString(),
          )
          .run();
        await dispatchTasks(cron, minutes(0));
        const token = vi.fn<typeof fetch>(async () =>
          Response.json({ access_token: "token-rinnovato", expires_in: 7200 }),
        );
        const turn = queueMessage({ task: "token_refresh", slot: minutes(0).toISOString() });
        await consumeTask(turn, env, token, minutes(1));
        expect(turn.ack).toHaveBeenCalledOnce();
        expect(token).toHaveBeenCalledOnce();
        expect(
          await env.DB.prepare(
            "SELECT access_expires_at, refreshed_at FROM ebay_store_credentials WHERE store_id = 's-a'",
          ).first(),
        ).toEqual({
          access_expires_at: minutes(121).toISOString(),
          refreshed_at: minutes(1).toISOString(),
        });
      });

      it("un compito fallito riprova con backoff e resta da concludere", async () => {
        const errors = vi.spyOn(console, "error").mockImplementation(() => {});
        try {
          await dispatchTasks(cron, minutes(0));
          const failing = {
            ...env,
            DB: {
              prepare: (sql: string) => env.DB.prepare(sql),
              batch: () => Promise.reject(new Error("d1 unavailable")),
            },
          } as unknown as Env;
          const body = { task: "maintenance", slot: minutes(0).toISOString() };
          const attempt = queueMessage(body, 3);
          await consumeTask(attempt, failing, fetch, minutes(1));
          expect(attempt.retry).toHaveBeenCalledWith({ delaySeconds: 120 });
          expect(attempt.ack).not.toHaveBeenCalled();
          expect(JSON.parse(String(errors.mock.calls[0]![0]))).toMatchObject({
            operation: "maintenance",
          });
          const resumed = queueMessage(body, 4);
          await consumeTask(resumed, env, fetch, minutes(5));
          expect(resumed.ack).toHaveBeenCalledOnce();
        } finally {
          errors.mockRestore();
        }
      });
    });
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
});
