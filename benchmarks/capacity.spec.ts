/**
 * Costi per operazione sul dataset di riferimento, nel runtime Workers locale: righe D1 lette e
 * scritte, query, messaggi in coda e chiamate eBay. Sono valori esatti e ripetibili, la base
 * delle proiezioni mensili; i tempi si misurano sulla build servita (`scripts/capacity.mjs`),
 * perché qui l'orologio del runtime avanza soltanto con l'I/O.
 * Ogni misura esce su una riga `CAPACITY {json}` che lo script raccoglie.
 */
import { env } from "cloudflare:workers";
import { beforeAll, expect, it, vi } from "vitest";

import { loader as loadArea } from "../app/routes/account";
import { loader as loadOrders } from "../app/routes/orders";
import { action as exportAction } from "../app/routes/order-export";
import { consumeExportJob } from "../app/domain/export-jobs.server";
import { consumeStoreSync } from "../app/domain/order-sync.server";
import { dispatchScheduledWork } from "../app/domain/scheduled-work.server";
import { indexOrderSearch, purgeExpiredRecords } from "../app/domain/maintenance.server";
import { legalVersions } from "../app/domain/registration.server";
import { sealToken } from "../app/integrations/ebay/seller-credentials.server";
import { ack, order } from "../test/fixtures/ebay-client-fixtures";
import { emptyTradingOrders } from "../test/fixtures/ebay-fixtures";
import { fakeQueue, queueMessage, queued } from "../test/fixtures/queue-fixture";
import { searchOrders } from "../test/fixtures/order-search-fixtures";
import { callRoute } from "../test/fixtures/route-fixtures";
import {
  capacityStatements,
  largeWorkspace,
  orderCount,
  referenceShape,
  searchTextSql,
  sessionToken,
  storeId,
  workspaceId,
} from "./capacity-dataset";

type Cost = { queries: number; rowsRead: number; rowsWritten: number };
/** Istruzioni più pesanti di una misura, con il testo SQL compattato e le righe sommate. */
type Heaviest = Array<{ sql: string; count: number; rowsRead: number; rowsWritten: number }>;

const shape = referenceShape;
const now = new Date(shape.now);

/**
 * Conta query e righe di ogni istruzione D1 eseguita durante `run`, anche dentro un batch.
 * `first()` non restituisce `meta`: qui passa da `all()`, che legge le stesse righe.
 */
async function metered<T>(
  run: () => Promise<T>,
): Promise<{ value: T; cost: Cost; heaviest: Heaviest }> {
  const cost: Cost = { queries: 0, rowsRead: 0, rowsWritten: 0 };
  const bySql = new Map<string, Heaviest[number]>();
  const sqlOf = new WeakMap<D1PreparedStatement, string>();
  const add = (meta: D1Meta | undefined, sql = "") => {
    cost.queries++;
    cost.rowsRead += meta?.rows_read ?? 0;
    cost.rowsWritten += meta?.rows_written ?? 0;
    const key = sql.replace(/\s+/gu, " ").trim().slice(0, 160);
    const entry = bySql.get(key) ?? { sql: key, count: 0, rowsRead: 0, rowsWritten: 0 };
    entry.count++;
    entry.rowsRead += meta?.rows_read ?? 0;
    entry.rowsWritten += meta?.rows_written ?? 0;
    bySql.set(key, entry);
  };
  const prepare = env.DB.prepare.bind(env.DB);
  const batch = env.DB.batch.bind(env.DB);
  const wrap = (statement: D1PreparedStatement, sql: string): D1PreparedStatement => {
    sqlOf.set(statement, sql);
    const bind = statement.bind.bind(statement);
    const all = statement.all.bind(statement);
    const run = statement.run.bind(statement);
    statement.bind = (...values: unknown[]) => wrap(bind(...values), sql);
    statement.all = async <R>() => {
      const result = await all<R>();
      add(result.meta, sql);
      return result;
    };
    statement.run = async <R>() => {
      const result = await run<R>();
      add(result.meta, sql);
      return result;
    };
    statement.first = (async (column?: string) => {
      const result = await all<Record<string, unknown>>();
      add(result.meta, sql);
      const row = result.results[0] ?? null;
      return column === undefined ? row : (row?.[column] ?? null);
    }) as D1PreparedStatement["first"];
    return statement;
  };
  const prepared = vi
    .spyOn(env.DB, "prepare")
    .mockImplementation((query) => wrap(prepare(query), query));
  const batched = vi.spyOn(env.DB, "batch").mockImplementation(async (statements) => {
    const results = await batch(statements);
    results.forEach((result, index) => add(result.meta, sqlOf.get(statements[index]!)));
    return results;
  });
  try {
    const value = await run();
    const heaviest = [...bySql.values()]
      .sort((a, b) => b.rowsRead + b.rowsWritten - (a.rowsRead + a.rowsWritten))
      .slice(0, 5);
    return { value, cost, heaviest };
  } finally {
    prepared.mockRestore();
    batched.mockRestore();
  }
}

/** Promesse annidate nei dati di un loader, come quelle in streaming, risolte prima della misura. */
async function settled(value: unknown): Promise<unknown> {
  if (value instanceof Promise) return settled(await value);
  if (value instanceof Response || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return Promise.all(value.map(settled));
  const data = (value as { type?: string; data?: unknown }).type === "DataWithResponseInit";
  const entries = Object.entries(data ? (value as { data: object }).data : value);
  return Object.fromEntries(
    await Promise.all(entries.map(async ([key, inner]) => [key, await settled(inner)])),
  );
}

function record(
  name: string,
  measured: { cost?: Cost; heaviest?: Heaviest },
  details: Record<string, unknown> = {},
) {
  const { cost, heaviest } = measured;
  console.log(`CAPACITY ${JSON.stringify({ name, ...cost, ...details, heaviest })}`);
}

/** Cookie della sessione sintetica, firmato come Better Auth con il segreto della suite. */
async function cookieOf(workspace: string) {
  const token = sessionToken(workspace);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.BETTER_AUTH_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = btoa(
    String.fromCharCode(
      ...new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(token))),
    ),
  );
  return `better-auth.session_token=${encodeURIComponent(`${token}.${signature}`)}`;
}

/** Documento dell'area Ordini: layout e pagina, come una navigazione completa. */
async function ordersDocument(cookie: string, path: string, params = {}) {
  const [area, page] = await Promise.all([
    callRoute(loadArea, path, { cookie, params }).then(settled),
    callRoute(loadOrders, path, { cookie, params }).then(settled),
  ]);
  return { area, page };
}

const ordersOf = (page: unknown) =>
  (page as { page: { orders: Array<{ id: string }> } }).page.orders;

const workspaces = {
  large: largeWorkspace,
  premium: workspaceId(0),
  free: workspaceId(shape.workspaces - 1),
};

beforeAll(async () => {
  vi.setSystemTime(now);
  for (const statement of capacityStatements(shape, legalVersions))
    await env.DB.prepare(statement).run();
  expect(await env.DB.prepare("SELECT count(*) AS n FROM orders").first("n")).toBe(
    orderCount(shape),
  );
}, 600_000);

it("indicizza la ricerca di tutti gli ordini", async () => {
  const indexing = await metered(async () => {
    let total = 0;
    for (let turn; (turn = await indexOrderSearch(env.DB)) > 0;) total += turn;
    return total;
  });
  expect(indexing.value).toBe(orderCount(shape));
  // Il testo calcolato in SQL per l'anteprima coincide con quello dell'app.
  expect(
    await env.DB.prepare(
      `SELECT count(*) AS n FROM orders o WHERE o.id LIKE 'cap-s-%'
         AND o.search_text IS NOT ${searchTextSql}`,
    ).first("n"),
  ).toBe(0);
  record("search-index", indexing, { orders: indexing.value });
});

it("apre la pagina Ordini, una ricerca e il dettaglio", async () => {
  for (const [kind, workspace] of Object.entries(workspaces)) {
    const cookie = await cookieOf(workspace);
    const cold = await metered(() => ordersDocument(cookie, "/app/ordini"));
    expect(ordersOf(cold.value.page).length).toBeGreaterThan(0);
    record(`orders-page-${kind}`, cold);
    const suggestions = await metered(() => searchOrders(cookie, "Acquirente Sintetico 12"));
    record(`search-suggestions-${kind}`, suggestions);
    const searched = await metered(() => ordersDocument(cookie, suggestions.value.href));
    record(`orders-search-${kind}`, searched);
    const listed = ordersOf(cold.value.page)[0]!.id;
    const detail = await metered(() =>
      ordersDocument(cookie, `/app/ordini/${listed}`, { ordine: listed }),
    );
    expect((detail.value.page as { notFound?: boolean }).notFound).not.toBe(true);
    record(`order-detail-${kind}`, detail);
  }
});

it("crea un file XLSX dalla coda per lo spazio grande", async () => {
  const cookie = await cookieOf(largeWorkspace);
  const send = vi.spyOn(env.WORK_QUEUE, "send").mockResolvedValue(queued);
  const request = await metered(() =>
    callRoute(exportAction, "/api/v1/orders/export", {
      cookie,
      headers: { accept: "application/json" },
      fields: { period: "90", format: "xlsx", rows: "item", language: "it" },
    }),
  );
  expect((request.value as Response).status).toBe(202);
  record("export-request", request);
  const [[body]] = send.mock.calls as [[unknown]];
  send.mockRestore();
  const delivery = queueMessage(body);
  const job = await metered(() => consumeExportJob(delivery, env));
  expect(delivery.ack).toHaveBeenCalledOnce();
  const file = await env.DB.prepare("SELECT file_id FROM export_jobs WHERE state = 'ready'").first<{
    file_id: string;
  }>();
  const stored = await env.EXPORT_FILES.head(file!.file_id);
  const orders = await env.DB.prepare(
    `SELECT count(*) AS n FROM orders o JOIN ebay_stores s ON s.id = o.store_id
      WHERE s.workspace_id = ? AND o.creation_time >= ?`,
  )
    .bind(largeWorkspace, new Date(now.getTime() - 90 * 86_400_000).toISOString())
    .first<number>("n");
  record("export-job", job, { orders, bytes: stored?.size ?? 0 });
});

it("smista i negozi dovuti dal cron e poi un turno senza lavoro", async () => {
  // Messaggi accodati: gruppi di letture dei negozi, negozi che contengono e compiti periodici.
  const messages = { groups: 0, stores: 0, tasks: 0 };
  const count = (body: unknown) => {
    const { syncStores } = body as { syncStores?: string[] };
    if (syncStores) {
      messages.groups++;
      messages.stores += syncStores.length;
    } else messages.tasks++;
  };
  const queue = fakeQueue({
    send: vi.fn(async (body: unknown) => {
      count(body);
      return queued;
    }),
    sendBatch: vi.fn(async (batch: Iterable<MessageSendRequest>) => {
      for (const { body } of batch) count(body);
      return queued;
    }),
  });
  const due = await metered(() => dispatchScheduledWork({ ...env, WORK_QUEUE: queue }, now));
  record("cron-due", due, { ...messages });
  // Il consumer ha servito ogni negozio: al turno successivo nessuno è dovuto.
  await env.DB.prepare(
    `UPDATE sync_state SET polled_at = ?1, dispatched_at = NULL, requested_at = NULL
      WHERE store_id LIKE 'cap-s-%'`,
  )
    .bind(shape.now)
    .run();
  Object.assign(messages, { groups: 0, stores: 0, tasks: 0 });
  const idle = await metered(() =>
    dispatchScheduledWork({ ...env, WORK_QUEUE: queue }, new Date(now.getTime() + 60_000)),
  );
  record("cron-idle", idle, { ...messages });
});

/**
 * eBay sintetico: elenco Fulfillment filtrato e paginato, nessun modificato in Trading, codice
 * fiscale dal dettaglio Trading e immagine da GetItem.
 */
function ebay(orders: Array<ReturnType<typeof order>>) {
  return vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(String(input));
    const call = new Headers(init?.headers).get("x-ebay-api-call-name");
    if (call === "GetStore")
      return new Response(ack("<Ack>Success</Ack><Store><Name>Negozio</Name></Store>"));
    if (call === "GetUser")
      return new Response(ack("<Ack>Success</Ack><User><FeedbackScore>7</FeedbackScore></User>"));
    if (call === "GetItem") return new Response(ack("<Ack>Success</Ack><Item></Item>"));
    if (call === "GetOrders") {
      if (String(init?.body).includes("<ModTimeFrom>")) return new Response(emptyTradingOrders);
      const id = /<OrderID>([^<]*)<\/OrderID>/u.exec(String(init?.body))![1];
      return new Response(
        `<GetOrdersResponse><Ack>Success</Ack><OrderArray><Order><OrderID>${id}</OrderID>` +
          `<BuyerTaxIdentifier><Type>CODICE_FISCALE</Type><ID>SINTETICO</ID></BuyerTaxIdentifier>` +
          `</Order></OrderArray></GetOrdersResponse>`,
      );
    }
    const single = url.pathname.split("/sell/fulfillment/v1/order/")[1];
    if (single !== undefined) {
      const found = orders.find(({ orderId }) => orderId === decodeURIComponent(single));
      return found ? Response.json(found) : new Response(null, { status: 404 });
    }
    const [, field, from, to] = /^(\w+):\[(.+)\.\.(.+)\]$/u.exec(url.searchParams.get("filter")!)!;
    const key = field === "creationdate" ? "creationDate" : "lastModifiedDate";
    const matching = orders.filter((item) => item[key] >= from! && item[key] <= to!);
    const limit = Number(url.searchParams.get("limit"));
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const next = new URL(url);
    next.searchParams.set("offset", String(offset + limit));
    return Response.json({
      orders: matching.slice(offset, offset + limit),
      total: matching.length,
      ...(offset + limit < matching.length ? { next: next.href } : {}),
    });
  });
}

/** Chiamate eBay per API, come le conta la quota del keyset. */
function ebayCalls(fetcher: ReturnType<typeof ebay>) {
  const calls: Record<string, number> = {};
  for (const [input, init] of fetcher.mock.calls) {
    const name = new Headers(init?.headers).get("x-ebay-api-call-name");
    const body = String(init?.body);
    const key = name
      ? name === "GetOrders" && body.includes("<ModTimeFrom>")
        ? "GetOrders-modified"
        : name
      : new URL(String(input)).pathname.endsWith("/order")
        ? "fulfillment-list"
        : "fulfillment-detail";
    calls[key] = (calls[key] ?? 0) + 1;
  }
  return calls;
}

it("legge un negozio senza novità e uno con dieci ordini nuovi", async () => {
  for (const [kind, store, fresh] of [
    ["idle", storeId(shape.workspaces - 2), 0],
    ["new-orders", storeId(shape.workspaces - 3), 10],
  ] as const) {
    await env.DB.prepare(
      "UPDATE ebay_store_credentials SET access_token = ?, access_expires_at = ? WHERE store_id = ?",
    )
      .bind(
        await sealToken(env.BETTER_AUTH_SECRET, store, "access", `token-${store}`),
        new Date(now.getTime() + 2 * 3_600_000).toISOString(),
        store,
      )
      .run();
    const orders = Array.from({ length: fresh }, (_, index) => {
      const created = new Date(now.getTime() - (index + 1) * 60_000).toISOString();
      return order({
        orderId: `cap-nuovo-${store}-${index}`,
        creationDate: created,
        lastModifiedDate: created,
        // Articoli propri: righe uguali consoliderebbero gli ordini in un solo acquisto.
        lineItems: [0, 1, 2].map((line) => ({
          lineItemId: `${index}${line}0000000`,
          legacyItemId: `${index}${line}00000000`,
          title: `Articolo nuovo ${line}`,
          quantity: 1,
          lineItemCost: { value: "16.63", currency: "EUR" },
          listingMarketplaceId: "EBAY_IT",
        })),
      });
    });
    const fetcher = ebay(orders);
    // Turni del cron, dieci minuti l'uno dall'altro, finché resta lavoro oltre l'elenco: ogni
    // turno ha un budget di chiamate e i dettagli degli ordini nuovi si completano nei successivi.
    const sync: { cost: Cost; heaviest: Heaviest } = {
      cost: { queries: 0, rowsRead: 0, rowsWritten: 0 },
      heaviest: [],
    };
    let turns = 0;
    let calls = 0;
    do {
      const at = new Date(now.getTime() + turns * 600_000);
      vi.setSystemTime(at);
      await env.DB.prepare("UPDATE sync_state SET dispatched_at = ? WHERE store_id = ?")
        .bind(at.toISOString(), store)
        .run();
      const delivery = queueMessage({ syncStore: store });
      const before = fetcher.mock.calls.length;
      const turn = await metered(() => consumeStoreSync(delivery, env, fetcher, at));
      expect(delivery.ack).toHaveBeenCalledOnce();
      for (const key of Object.keys(sync.cost) as Array<keyof Cost>)
        sync.cost[key] += turn.cost[key];
      sync.heaviest = turn.heaviest;
      calls = fetcher.mock.calls.length - before;
      turns++;
    } while (calls > 1 && turns < 10);
    vi.setSystemTime(now);
    expect(calls).toBe(1);
    const saved = await env.DB.prepare(
      "SELECT count(*) AS n FROM orders WHERE store_id = ? AND ebay_order_id LIKE 'cap-nuovo-%'",
    )
      .bind(store)
      .first<number>("n");
    expect(saved).toBe(fresh);
    record(`store-sync-${kind}`, sync, { ebayCalls: ebayCalls(fetcher), fresh, turns });
  }
});

it("pulisce senza ordini scaduti e poi i cento ordini scaduti di un negozio Free", async () => {
  const idle = await metered(() => purgeExpiredRecords(env.DB, now));
  record("purge-idle", idle);
  // La pulizia giornaliera del Free: gli ordini oltre i trenta giorni di grazia.
  const store = storeId(shape.workspaces - 4);
  await env.DB.prepare(
    "UPDATE orders SET retention_until = ?1, purge_after = ?1 WHERE store_id = ?2",
  )
    .bind(new Date(now.getTime() - 86_400_000).toISOString(), store)
    .run();
  const expired = await metered(() => purgeExpiredRecords(env.DB, now));
  const left = await env.DB.prepare("SELECT count(*) AS n FROM orders WHERE store_id = ?")
    .bind(store)
    .first<number>("n");
  expect(left).toBe(0);
  record("purge-expired", expired, { orders: shape.freeOrders });
});

it("riporta la dimensione del database", async () => {
  // `size_after` è la dimensione del database dopo l'istruzione, come la riporta D1.
  const { meta } = await env.DB.prepare("SELECT 1").run();
  const counts = Object.fromEntries(
    await Promise.all(
      ["orders", "order_items", "tax_identifiers", "order_grants", "ebay_stores"].map(
        async (table) => [
          table,
          await env.DB.prepare(`SELECT count(*) AS n FROM ${table}`).first<number>("n"),
        ],
      ),
    ),
  );
  record("database", {}, { bytes: meta.size_after, ...counts });
});
