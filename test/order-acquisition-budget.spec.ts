import { env } from "cloudflare:workers";

import { expect, it, vi } from "vitest";

import {
  countedAccess,
  countedCall,
  loadCallBudget,
  ownCalls,
  quotaUsageStatements,
  workerShare,
} from "../app/domain/order-acquisition-context.server";

import { acquireOrders } from "../app/domain/order-acquisition.server";

import { recordOrderObservation } from "../app/domain/order-import.server";

import { insertEntitlement } from "./fixtures/database-fixtures";

import { access, order } from "./fixtures/ebay-client-fixtures";

import { observation } from "./fixtures/order-import-scenarios";

import {
  acquire,
  calls,
  ebay,
  grantedAt,
  setupScenarios,
} from "./fixtures/order-acquisition-scenarios";

setupScenarios();

const origin = "https://api.ebay.com";
const reset = "2026-09-03T07:00:00.000Z";

/** Lettura del keyset con `consumed` chiamate su 100 per la chiamata indicata. */
const quota = (call: string, consumed: number, resetAt: string | null = reset) =>
  env.DB.prepare(
    `INSERT INTO ebay_quota_usage (api_origin, call, quota_limit, consumed, reset_at, read_at)
     VALUES (?1, ?2, 100, ?3, ?4, '2026-09-01T23:00:00.000Z')`,
  )
    .bind(origin, call, consumed, resetAt)
    .run();

const refs = () =>
  env.DB.prepare(
    "SELECT detail_for, detail_retry_at, detail_attempts FROM order_source_refs",
  ).first();

it("riconosce le chiamate seguite dalla richiesta", () => {
  expect(
    countedCall("https://api.ebay.com/ws/api.dll", {
      headers: { "x-ebay-api-call-name": "GetOrders" },
    }),
  ).toBe("GetOrders");
  expect(countedCall(new Request("https://api.ebay.com/sell/fulfillment/v1/order/1"))).toBe(
    "order",
  );
  expect(countedCall("https://api.ebay.com/commerce/notification/v1/subscription")).toBeNull();
});

it("conta per giorno le chiamate del Worker, anche quelle non riuscite", async () => {
  const fetcher = ebay({ getItem: () => new Response(null, { status: 503 }) });
  await acquire(fetcher);
  const own = await ownCalls(env.DB, origin, new Date("2026-09-02T12:00:00.000Z"));
  // Fulfillment: recenti, storico e dettaglio; Trading: passata periodica e fallback fiscale.
  expect(Object.fromEntries(own)).toEqual({
    order: 3,
    GetOrders: 2,
    GetItem: 1,
    GetStore: 1,
    GetUser: 1,
  });
  // Il giorno dopo il conteggio riparte.
  expect((await ownCalls(env.DB, origin, new Date("2026-09-03T00:00:00.000Z"))).size).toBe(0);
});

it("conserva la lettura giornaliera del keyset soltanto per le chiamate seguite", async () => {
  const rate = (consumed: number, windowSeconds = 86_400) => ({
    limit: 5000,
    consumed,
    resetAt: reset,
    windowSeconds,
  });
  await env.DB.batch(
    quotaUsageStatements(
      env.DB,
      origin,
      [
        { resource: "GetOrders", daily: true, rate: rate(3000) },
        { resource: "TradingAPI.GetItem", daily: true, rate: rate(10) },
        { resource: "GetUser", daily: true, rate: rate(1) },
        { resource: "GetOrders", daily: false, rate: rate(1, 300) },
      ],
      new Date("2026-09-02T00:00:00.000Z"),
    ),
  );
  expect(
    (await env.DB.prepare("SELECT call, consumed FROM ebay_quota_usage ORDER BY call").all())
      .results,
  ).toEqual([
    { call: "GetItem", consumed: 10 },
    { call: "GetOrders", consumed: 3000 },
  ]);
});

it("rimanda all'azzeramento la lettura fiscale e le immagini non urgenti oltre metà quota", async () => {
  await quota("GetOrders", 50);
  await quota("GetItem", 50);
  // Ordine di diciotto giorni fa, fuori dal marketplace qualificato: serve il fallback Trading.
  const old = ebay({
    orders: [
      order({
        creationDate: "2026-08-15T08:00:00.000Z",
        lastModifiedDate: "2026-09-01T09:00:00.000Z",
        lineItems: [{ ...order().lineItems[0], listingMarketplaceId: "EBAY_DE" }],
      }),
    ],
  });
  expect(await acquire(old)).toBe("complete");
  expect([calls(old, "GetOrders"), calls(old, "GetItem")]).toEqual([0, 0]);
  expect(await refs()).toEqual({ detail_for: null, detail_retry_at: reset, detail_attempts: 0 });
  // Il dato Fulfillment è comunque scritto e la versione riparte all'azzeramento.
  expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM orders").first()).toEqual({ n: 1 });
  await env.DB.prepare("DELETE FROM ebay_quota_usage").run();
  const after = ebay({ orders: old.orders });
  expect(await acquire(after, "2026-09-03T07:10:00.000Z")).toBe("complete");
  expect([calls(after, "GetOrders"), calls(after, "GetItem")]).toEqual([1, 1]);
  expect(await refs()).toMatchObject({ detail_retry_at: null });
});

it("legge subito un ordine corrente anche oltre metà quota", async () => {
  await quota("GetOrders", 90);
  await quota("GetItem", 90);
  const recent = ebay({
    orders: [order({ lineItems: [{ ...order().lineItems[0], listingMarketplaceId: "EBAY_DE" }] })],
  });
  expect(await acquire(recent)).toBe("complete");
  expect([calls(recent, "GetOrders"), calls(recent, "GetItem")]).toEqual([1, 1]);
});

it("un Worker con una parte della quota si ferma alla sua parte fino all'azzeramento", async () => {
  await quota("GetOrders", 20);
  await env.DB.prepare(
    `INSERT INTO ebay_call_counts (day, api_origin, call, count)
     VALUES ('2026-09-02', ?1, 'GetOrders', 10)`,
  )
    .bind(origin)
    .run();
  const fetcher = ebay({
    orders: [order({ lineItems: [{ ...order().lineItems[0], listingMarketplaceId: "EBAY_DE" }] })],
  });
  const at = new Date("2026-09-02T00:00:00.000Z");
  expect(
    await acquireOrders({
      db: env.DB,
      storeId: "s-a",
      grantedAt,
      access: access(fetcher),
      now: at,
      budget: { calls: 100, pages: 10 },
      workerShare: workerShare({ EBAY_WORKER_SHARE: "10" }),
    }),
  ).toBe("budget");
  // Né la passata Trading né il fallback: la chiamata attende come dopo un limite di eBay.
  expect(fetcher.mock.calls.some(([, init]) => String(init?.body).includes("GetOrders"))).toBe(
    false,
  );
  expect(
    await env.DB.prepare("SELECT until FROM ebay_rate_limits WHERE api_origin = ?")
      .bind(`${origin}#GetOrders`)
      .first(),
  ).toEqual({ until: reset });
  // La lettura fiscale Trading è certa: la versione aspetta l'azzeramento senza errore e senza
  // spendere la lettura Fulfillment e l'immagine.
  expect(
    fetcher.mock.calls.filter(([input]) => new URL(String(input)).pathname.includes("/order/")),
  ).toEqual([]);
  expect(calls(fetcher, "GetItem")).toBe(0);
  expect(
    await env.DB.prepare(
      "SELECT detail_for, detail_error, detail_retry_at, detail_attempts FROM order_source_refs",
    ).first(),
  ).toEqual({ detail_for: null, detail_error: null, detail_retry_at: reset, detail_attempts: 0 });
});

/** Ordine fuori dal marketplace qualificato, creato `days` giorni prima del 2026-09-02. */
const foreign = (days: number, id = "12-34567-89012", item = "110000000001") =>
  order({
    orderId: id,
    creationDate: new Date(
      Date.parse("2026-09-02T00:00:00.000Z") - days * 86_400_000,
    ).toISOString(),
    lastModifiedDate: "2026-09-01T09:00:00.000Z",
    lineItems: [
      {
        ...order().lineItems[0],
        lineItemId: `${item}9`,
        legacyItemId: item,
        listingMarketplaceId: "EBAY_DE",
      },
    ],
  });

it("ogni chiamata rimandata riparte all'azzeramento della propria quota", async () => {
  // Soltanto la lettura fiscale oltre metà quota: le immagini si leggono.
  await quota("GetOrders", 50, "2026-09-02T05:00:00.000Z");
  const fiscal = ebay({ orders: [foreign(18)] });
  expect(await acquire(fiscal)).toBe("complete");
  expect([calls(fiscal, "GetOrders"), calls(fiscal, "GetItem")]).toEqual([0, 1]);
  expect(await refs()).toMatchObject({ detail_retry_at: "2026-09-02T05:00:00.000Z" });
});

it("rimanda soltanto le immagini quando è la loro quota a superare metà", async () => {
  await quota("GetItem", 50, "2026-09-02T06:00:00.000Z");
  const images = ebay({ orders: [foreign(18)] });
  expect(await acquire(images)).toBe("complete");
  expect([calls(images, "GetOrders"), calls(images, "GetItem")]).toEqual([1, 0]);
  expect(await refs()).toMatchObject({ detail_retry_at: "2026-09-02T06:00:00.000Z" });
});

it.each([
  ["2026-09-02T07:00:00.000Z", "2026-09-02T06:00:00.000Z"],
  ["2026-09-02T05:00:00.000Z", "2026-09-02T06:00:00.000Z"],
])(
  "con lettura fiscale e immagini rimandate riparte al più tardo degli azzeramenti (%s, %s)",
  async (orders, items) => {
    await quota("GetOrders", 50, orders);
    await quota("GetItem", 50, items);
    const both = ebay({ orders: [foreign(18)] });
    expect(await acquire(both)).toBe("complete");
    expect(await refs()).toMatchObject({ detail_retry_at: [orders, items].sort().at(-1) });
  },
);

it("conta le immagini già lette nell'esecuzione per il budget del giorno", async () => {
  await quota("GetItem", 49);
  const two = ebay({
    orders: [foreign(18), foreign(19, "12-34567-89013", "110000000002")],
  });
  expect(await acquire(two)).toBe("complete");
  expect(calls(two, "GetItem")).toBe(1);
});

it("un ordine creato esattamente sette giorni prima non è più corrente", async () => {
  await quota("GetOrders", 50);
  const boundary = ebay({ orders: [foreign(7)] });
  expect(await acquire(boundary)).toBe("complete");
  expect(calls(boundary, "GetOrders")).toBe(0);
});

/** Copertura a pagamento: gli ordini oltre i trenta giorni del Free restano nello storico. */
const coverage = () =>
  insertEntitlement({
    source: "premium",
    startsAt: "2026-01-01T00:00:00.000Z",
    endsAt: "2027-01-01T00:00:00.000Z",
  }).run();

it("chiede a Trading la lettura fiscale soltanto entro i novanta giorni", async () => {
  await coverage();
  const fetcher = ebay({
    orders: [foreign(89), foreign(90, "12-34567-89013", "110000000002")],
  });
  expect(await acquire(fetcher)).toBe("complete");
  const requested = fetcher.mock.calls
    .filter(([, init]) => new Headers(init?.headers).get("x-ebay-api-call-name") === "GetOrders")
    .map(([, init]) => String(init?.body))
    .filter((body) => !body.includes("<ModTimeFrom>"));
  expect(requested).toHaveLength(1);
  expect(requested[0]).toContain("<OrderID>12-34567-89012</OrderID>");
  expect(requested[0]).not.toContain("<OrderID>12-34567-89013</OrderID>");
});

it("fuori dal marketplace qualificato non usa il codice fiscale di Fulfillment", async () => {
  await coverage();
  const taxIdentifier = {
    taxpayerId: "RSSMRA80A01H501U",
    taxIdentifierType: "CODICE_FISCALE",
    issuingCountry: "IT",
  };
  const buyer = { ...order().buyer, taxIdentifier };
  const fetcher = ebay({ orders: [{ ...foreign(95), buyer }] });
  expect(await acquire(fetcher)).toBe("complete");
  expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM tax_identifiers").first()).toEqual({
    n: 0,
  });
});

it("un dettaglio non riuscito non ferma la lettura dei successivi", async () => {
  const pair = [foreign(18), foreign(19, "12-34567-89013", "110000000002")];
  const read = new Set<string>();
  const fetcher = ebay({
    orders: pair,
    fail: (url) => {
      const id = url.pathname.split("/sell/fulfillment/v1/order/")[1];
      if (id === undefined) return undefined;
      read.add(id);
      return read.size === 1 ? new Response(null, { status: 404 }) : undefined;
    },
  });
  expect(await acquire(fetcher)).toBe("complete");
  expect(read.size).toBe(2);
});

it("una lettura fiscale non riuscita non copre le versioni di un ordine pagato", async () => {
  const at = {
    storeId: "s-a",
    consentGrantedAt: grantedAt,
    observedAt: "2026-09-02T00:00:00.000Z",
  };
  const read = (verification: "completed" | "error") =>
    recordOrderObservation(
      env.DB,
      at,
      observation({
        taxIdentifiers: {
          source: "ebay_trading_get_orders",
          complete: false,
          verification,
          values: [],
        },
      }),
    );
  await read("error");
  expect(await env.DB.prepare("SELECT paid FROM order_tax_checks").first()).toEqual({ paid: 0 });
  await read("completed");
  expect(await env.DB.prepare("SELECT paid FROM order_tax_checks").first()).toEqual({ paid: 1 });
});

it("chiama il fetcher del negozio senza un this, come vuole il fetch dei Workers", async () => {
  // Il fetch globale dei Workers rifiuta una chiamata come metodo di un altro oggetto.
  const strict = vi.fn(function (this: unknown) {
    if (this !== undefined) throw new TypeError("Illegal invocation");
    return Promise.resolve(new Response("ok"));
  }) as unknown as typeof fetch;
  const counted = countedAccess(env.DB, access(strict), new Date("2026-09-02T00:00:00.000Z"));
  const response = await counted.fetcher("https://api.ebay.com/sell/fulfillment/v1/order/1");
  expect(await response.text()).toBe("ok");
  expect(
    Object.fromEntries(await ownCalls(env.DB, origin, new Date("2026-09-02T00:00:00.000Z"))),
  ).toEqual({ order: 1 });
});

it("conta soltanto le chiamate seguite e un errore di D1 non ferma la lettura", async () => {
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  const fetcher = vi.fn<typeof fetch>(async () => new Response("ok"));
  const counted = countedAccess(env.DB, access(fetcher), new Date("2026-09-02T00:00:00.000Z"));
  await counted.fetcher("https://api.ebay.com/commerce/notification/v1/subscription");
  expect((await ownCalls(env.DB, origin, new Date("2026-09-02T00:00:00.000Z"))).size).toBe(0);
  expect(errors).not.toHaveBeenCalled();
  const broken = {
    prepare: () => ({ bind: () => ({ run: () => Promise.reject(new Error("d1")) }) }),
  } as unknown as D1Database;
  const response = await countedAccess(broken, access(fetcher), new Date()).fetcher(
    "https://api.ebay.com/sell/fulfillment/v1/order/1",
  );
  expect(await response.text()).toBe("ok");
  expect(errors).toHaveBeenCalledOnce();
  expect(JSON.parse(String(errors.mock.calls[0]![0]))).toMatchObject({
    operation: "order_acquisition",
  });
  errors.mockRestore();
});

it("senza un azzeramento valido il lavoro rimandato riparte alla mezzanotte UTC", async () => {
  const at = new Date("2026-09-02T10:00:00.000Z");
  for (const resetAt of [null, "2026-09-02T09:00:00.000Z", at.toISOString()]) {
    await env.DB.prepare("DELETE FROM ebay_quota_usage").run();
    await quota("GetOrders", 60, resetAt);
    const budget = await loadCallBudget(env.DB, access(ebay()), at);
    expect(budget.background("GetOrders")).toBe(resetAt === null ? false : true);
    expect(budget.reopenAt("GetOrders")).toBe("2026-09-03T00:00:00.000Z");
  }
  // Un azzeramento futuro vale come indicato da eBay.
  await env.DB.prepare("DELETE FROM ebay_quota_usage").run();
  await quota("GetOrders", 60, "2026-09-02T11:00:00.000Z");
  expect((await loadCallBudget(env.DB, access(ebay()), at)).reopenAt("GetOrders")).toBe(
    "2026-09-02T11:00:00.000Z",
  );
});

it("la parte del Worker vale soltanto sotto l'intera quota e con un limite letto", async () => {
  const at = new Date("2026-09-02T00:00:00.000Z");
  const own = (count: number) =>
    env.DB.prepare(
      `INSERT INTO ebay_call_counts (day, api_origin, call, count) VALUES ('2026-09-02', ?1, 'GetOrders', ?2)
       ON CONFLICT (day, api_origin, call) DO UPDATE SET count = excluded.count`,
    )
      .bind(origin, count)
      .run();
  const limited = () =>
    env.DB.prepare("SELECT COUNT(*) AS n FROM ebay_rate_limits").first<{ n: number }>();
  await quota("GetOrders", 0);
  await own(100);
  await loadCallBudget(env.DB, access(ebay()), at, 1);
  expect(await limited()).toEqual({ n: 0 });
  // Sotto la propria parte il Worker continua: 9 chiamate su 100 con il 10%.
  await own(9);
  await loadCallBudget(env.DB, access(ebay()), at, 0.1);
  expect(await limited()).toEqual({ n: 0 });
  await env.DB.prepare("UPDATE ebay_quota_usage SET quota_limit = 0").run();
  await own(0);
  await loadCallBudget(env.DB, access(ebay()), at, 0.1);
  expect(await limited()).toEqual({ n: 0 });
});

it("legge la parte del Worker in percentuale e ignora un valore non valido", () => {
  expect(workerShare({ EBAY_WORKER_SHARE: "10" })).toBe(0.1);
  expect(workerShare({ EBAY_WORKER_SHARE: "1" })).toBe(0.01);
  expect(workerShare({ EBAY_WORKER_SHARE: "100" })).toBe(1);
  for (const value of [undefined, "", "0", "101", "10.5", "dieci"])
    expect(workerShare({ EBAY_WORKER_SHARE: value })).toBe(1);
});

it("la passata Trading conta nel budget del lavoro non urgente", async () => {
  // 49 su 100: la passata ne usa una e il fallback di un ordine non corrente supererebbe metà.
  await quota("GetOrders", 49);
  const old = ebay({ orders: [foreign(18)] });
  expect(await acquire(old)).toBe("complete");
  expect(calls(old, "GetOrders")).toBe(0);
});

it("conserva l'azzeramento della quota, o nessuno se eBay non lo indica", async () => {
  const at = new Date("2026-09-02T00:00:00.000Z");
  const rate = (resetAt: string | null) => ({ limit: 5000, consumed: 1, resetAt });
  await env.DB.batch(
    quotaUsageStatements(
      env.DB,
      origin,
      [
        { resource: "GetOrders", daily: true, rate: rate(reset) },
        { resource: "GetItem", daily: true, rate: rate(null) },
      ],
      at,
    ),
  );
  expect(
    (await env.DB.prepare("SELECT call, reset_at FROM ebay_quota_usage ORDER BY call").all())
      .results,
  ).toEqual([
    { call: "GetItem", reset_at: null },
    { call: "GetOrders", reset_at: reset },
  ]);
});

/** Risposta `GetOrders` con un blocco per ogni ordine indicato, senza identificativi fiscali. */
const tradingOrders =
  (...ids: string[]) =>
  () =>
    new Response(
      `<GetOrdersResponse><Ack>Success</Ack><HasMoreOrders>false</HasMoreOrders><OrderArray>` +
        ids.map((id) => `<Order><OrderID>${id}</OrderID></Order>`).join("") +
        `</OrderArray></GetOrdersResponse>`,
    );

it("una lettura Trading senza il dato fiscale non toglie quello già letto", async () => {
  const unpaid = foreign(1);
  const first = ebay({ orders: [{ ...unpaid, orderPaymentStatus: "PENDING" }] });
  expect(await acquire(first)).toBe("complete");
  const next = {
    ...first.orders[0]!,
    lastModifiedDate: "2026-09-02T00:30:00.000Z",
  };
  const absent = ebay({ orders: [next], trading: tradingOrders(next.orderId) });
  expect(await acquire(absent, "2026-09-02T01:00:00.000Z")).toBe("complete");
  expect(calls(absent, "GetOrders")).toBe(1);
  expect(
    await env.DB.prepare("SELECT value FROM tax_identifiers WHERE removed_at IS NULL").all(),
  ).toMatchObject({ results: [{ value: "SINTETICO" }] });
});

it("la lettura fiscale riservata per il lotto conta subito nel budget del giorno", async () => {
  // La passata Trading porta il consumo a 49, il lotto a 50: il secondo ordine non corrente aspetta.
  await quota("GetOrders", 48);
  const two = ebay({ orders: [foreign(18), foreign(19, "12-34567-89013", "110000000002")] });
  expect(await acquire(two)).toBe("complete");
  expect(calls(two, "GetOrders")).toBe(1);
  expect(
    (
      await env.DB.prepare(
        "SELECT detail_retry_at FROM order_source_refs ORDER BY detail_retry_at",
      ).all()
    ).results,
  ).toEqual([{ detail_retry_at: null }, { detail_retry_at: reset }]);
});

it("oltre cento letture fiscali apre un lotto nuovo, con la sua chiamata nel budget", async () => {
  // Inserzioni distinte: righe uguali consoliderebbero gli ordini in un solo acquisto.
  const orders = Array.from({ length: 101 }, (_, index) =>
    foreign(1, `12-00000-${String(index).padStart(5, "0")}`, `2${String(index).padStart(11, "0")}`),
  );
  const many = ebay({ orders });
  const budget = { calls: 1_000, pages: 100 };
  expect(await acquire(many, undefined, budget)).toBe("complete");
  expect(calls(many, "GetOrders")).toBe(2);
  // Ogni chiamata fatta per il negozio, salvo il profilo fuori budget, scala il budget.
  const made = many.mock.calls.filter(([input, init]) => {
    const call = new Headers(init?.headers).get("x-ebay-api-call-name");
    return call
      ? !["GetStore", "GetUser"].includes(call)
      : new URL(String(input)).pathname.startsWith("/sell/fulfillment/");
  }).length;
  expect(1_000 - budget.calls).toBe(made);
});

it("l'errore di un solo ordine del lotto lascia leggere gli altri", async () => {
  const pair = [foreign(1), foreign(1, "12-34567-89013", "110000000002")];
  // Due blocchi per il primo ordine: la sua lettura è ambigua, quella del secondo no.
  const mixed = ebay({
    orders: pair,
    trading: tradingOrders(pair[0]!.orderId, pair[0]!.orderId, pair[1]!.orderId),
  });
  expect(await acquire(mixed)).toBe("complete");
  expect(
    (
      await env.DB.prepare(
        "SELECT external_order_id, detail_attempts, detail_for IS NULL AS pending FROM order_source_refs WHERE source = 'fulfillment' ORDER BY external_order_id",
      ).all()
    ).results,
  ).toEqual([
    { external_order_id: pair[0]!.orderId, detail_attempts: 1, pending: 1 },
    { external_order_id: pair[1]!.orderId, detail_attempts: 0, pending: 0 },
  ]);
});
