import { env } from "cloudflare:workers";

import { afterEach, beforeEach, vi } from "vitest";

import { acquireOrders } from "../../app/domain/order-acquisition.server";

import { consumeStoreSync, dispatchStoreSyncs } from "../../app/domain/order-sync.server";

import {
  insertCredentials,
  now,
  resetDatabase,
  resetOrderFixtures,
  seed,
} from "./database-fixtures";

import { fakeQueue, queueMessage, queued } from "./queue-fixture";

import { emptyTradingOrders } from "./ebay-fixtures";

import { access, ack, order } from "./ebay-client-fixtures";

export const grantedAt = "2026-09-01T00:00:00.000Z";

export const image = "https://i.ebayimg.com/images/g/abc/s-l1600.jpg";

const storeResponse = ack(
  `<Ack>Success</Ack><Store><Name>Negozio Sintetico</Name><Logo><URL>${image}</URL></Logo></Store>`,
);

type FakeOrder = ReturnType<typeof order>;

/**
 * eBay sintetico con paginazione reale: filtra per data, ordina dal più recente e restituisce
 * `next` con l'offset, al più `pageLimit` ordini per pagina. `before` interviene prima di ogni
 * richiesta.
 */
export const ebay = (
  options: {
    orders?: FakeOrder[];
    pageLimit?: number;
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
    // La sottoscrizione agli ordini trova l'ingresso senza destinazione e si ferma.
    if (url.pathname === "/identity/v1/oauth2/token")
      return Response.json({ access_token: "token-applicazione" });
    if (url.pathname === "/commerce/notification/v1/destination")
      return Response.json({ destinations: [] });
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
      // Un ordine per ogni ID richiesto, nell'ordine della richiesta.
      const ids = [...String(init?.body).matchAll(/<OrderID>([^<]*)<\/OrderID>/gu)].map(
        ([, id]) => id!,
      );
      return (
        options.trading?.() ??
        new Response(
          `<GetOrdersResponse><Ack>Success</Ack><OrderArray>` +
            ids
              .map(
                (id) =>
                  `<Order><OrderID>${id}</OrderID>` +
                  `<BuyerTaxIdentifier><Type>CODICE_FISCALE</Type><ID>SINTETICO</ID></BuyerTaxIdentifier>` +
                  `</Order>`,
              )
              .join("") +
            `</OrderArray></GetOrdersResponse>`,
        )
      );
    }
    const single = url.pathname.split("/sell/fulfillment/v1/order/")[1];
    if (single !== undefined) {
      const found = orders.find(({ orderId }) => orderId === decodeURIComponent(single));
      return found ? Response.json(found) : new Response(null, { status: 404 });
    }
    const ids = url.searchParams.get("orderIds");
    if (ids !== null) {
      const wanted = ids.split(",");
      const found = orders.filter(({ orderId }) => wanted.includes(orderId));
      return Response.json({ orders: found, total: found.length });
    }
    const [, field, from, to] = /^(\w+):\[(.+)\.\.(.+)\]$/u.exec(url.searchParams.get("filter")!)!;
    const key = field === "creationdate" ? "creationDate" : "lastModifiedDate";
    const matching = orders
      .filter((item) => item[key] >= from! && item[key] <= to!)
      .sort((a, b) => b.creationDate.localeCompare(a.creationDate));
    const limit = Math.min(Number(url.searchParams.get("limit")), options.pageLimit ?? Infinity);
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
export const calls = (fetcher: ReturnType<typeof ebay>, name: string) =>
  fetcher.mock.calls.filter(
    ([, init]) =>
      new Headers(init?.headers).get("x-ebay-api-call-name") === name &&
      !String(init?.body).includes("<ModTimeFrom>"),
  ).length;

/** Intervalli delle letture dell'elenco per il campo indicato, con l'offset delle pagine seguite. */
export const slices = (fetcher: ReturnType<typeof ebay>, field: string) =>
  fetcher.mock.calls
    .map(([input]) => new URL(String(input)).searchParams)
    .filter((params) => params.get("filter")?.startsWith(`${field}:`))
    .map((params) => {
      const [, range] = /\[(.+)\]/u.exec(params.get("filter")!)!;
      return params.has("offset") ? `${range}@${params.get("offset")}` : range!;
    });

export const acquire = (
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

export const syncState = () =>
  env.DB.prepare(
    `SELECT cursor, recent_end, history_from, history_until, history_through, history_done_at,
              locked_until, last_success_at FROM sync_state WHERE store_id = 's-a'`,
  ).first<Record<string, string | null>>();

export const count = async (sql: string) =>
  (await env.DB.prepare(sql).first<{ total: number }>())!.total;

/** Un turno del cron e poi il consumer della coda nello stesso istante, un messaggio alla volta. */
export const cronTurn = async (environment: Env, fetcher: typeof fetch, at: Date) => {
  const sendBatch = vi.fn<Queue["sendBatch"]>(async () => queued);
  const stores = await dispatchStoreSyncs(
    { ...environment, WORK_QUEUE: fakeQueue({ sendBatch }) },
    at,
  );
  for (const [batch] of sendBatch.mock.calls)
    for (const { body } of batch)
      await consumeStoreSync(queueMessage(body), environment, fetcher, at);
  return stores;
};

// Ordini creati a un'ora di distanza prima di `until`, modificati un minuto dopo.
export const series = (prefix: string, total: number, until: string) =>
  Array.from({ length: total }, (_, index) => {
    const created = Date.parse(until) - (index + 1) * 60 * 60 * 1000;
    return order({
      orderId: `${prefix}-${String(index).padStart(5, "0")}`,
      creationDate: new Date(created).toISOString(),
      lastModifiedDate: new Date(created + 60_000).toISOString(),
      lineItems: [],
    });
  });

export const tradingFailure = (code: string) =>
  ebay({
    orders: [],
    fail: (_, init) =>
      String(init?.body).includes("<ModTimeFrom>")
        ? new Response(
            `<GetOrdersResponse><Ack>Failure</Ack><Errors><ErrorCode>${code}</ErrorCode><SeverityCode>Error</SeverityCode></Errors></GetOrdersResponse>`,
          )
        : undefined,
  });

export const tradingPasses = (fetcher: ReturnType<typeof ebay>) =>
  fetcher.mock.calls.filter(([, init]) => String(init?.body).includes("<ModTimeFrom>")).length;

export function setupScenarios() {
  beforeEach(resetDatabase);
  afterEach(() => vi.useRealTimers());
  beforeEach(async () => {
    await seed();
    await resetOrderFixtures();
    await insertCredentials({ accessExpiresAt: now, grantedAt }).run();
    // Ogni utente ha una sessione aperta: gli spazi sono seguiti e leggono con la cadenza del piano.
    await env.DB.prepare(
      `INSERT OR IGNORE INTO "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
       SELECT user_id, user_id, user_id || '@example.test', 1, ?1, ?1 FROM workspace_members`,
    )
      .bind(now)
      .run();
    await env.DB.prepare(
      `INSERT OR IGNORE INTO "session" ("id", "expiresAt", "token", "createdAt", "updatedAt", "userId")
       SELECT 'sessione-' || user_id, '2099-01-01T00:00:00.000Z', 'token-' || user_id, ?1, ?1,
              user_id FROM workspace_members`,
    )
      .bind(now)
      .run();
  });
}
