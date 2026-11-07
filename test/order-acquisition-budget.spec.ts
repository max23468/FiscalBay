import { env } from "cloudflare:workers";

import { expect, it } from "vitest";

import {
  countedCall,
  ownCalls,
  quotaUsageStatements,
} from "../app/domain/order-acquisition-context.server";

import { acquireOrders } from "../app/domain/order-acquisition.server";

import { recordOrderObservation } from "../app/domain/order-import.server";

import { access, configuration, order } from "./fixtures/ebay-client-fixtures";

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
      access: { ...access(fetcher), configuration: { ...configuration, workerShare: 0.1 } },
      now: at,
      budget: { calls: 100, pages: 10 },
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
