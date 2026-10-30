import { env } from "cloudflare:workers";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import Stripe from "stripe";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { receiveWebhook, consumeWebhooks, recoverWebhookIngress } from "../app/webhooks.server";
import {
  admitOrigin,
  NotificationLimit,
  verifyEbayNotification,
} from "../app/integrations/ebay/notifications.server";
import {
  resumeEbayAccountDeletions,
  runEbayAccountDeletion,
} from "../app/domain/ebay-account-deletion.server";
import { listAnomalies } from "../app/domain/admin-operations.server";
import { setSwitch } from "../app/domain/service-settings.server";
import { bulkDataAnomalies, recordBulkDataThreshold } from "../app/domain/ebay-quotas.server";
import { sealToken } from "../app/integrations/ebay/seller-credentials.server";
import { purgeExpiredRecords } from "../app/domain/maintenance.server";
import worker from "../workers/app";
import * as site from "../app/routes/site";
import * as features from "../app/routes/features";
import * as pricing from "../app/routes/pricing";
import * as siteSecurity from "../app/routes/site-security";
import * as faq from "../app/routes/faq";
import * as support from "../app/routes/support";
import * as legal from "../app/routes/legal";
import { acquireOrders, consumeOrderConfirmation } from "../app/domain/order-acquisition.server";
import { ebayConfiguration } from "../app/integrations/ebay/environment.server";
import delivery from "./fixtures/ebay-order-notification.json";
import { fakeQueue, queued } from "./fixtures/queue-fixture";
import {
  insertCredentials,
  insertStorePause,
  insertWorkspace,
  resetDatabase,
} from "./fixtures/database-fixtures";

const router = vi.hoisted(() => ({ handle: vi.fn(), create: vi.fn() }));
vi.mock("react-router", async (original) => ({
  ...(await original<typeof import("react-router")>()),
  createRequestHandler: router.create,
}));

const now = new Date("2026-10-11T12:00:00.000Z");
const grantedAt = "2026-10-10T12:00:00.000Z";
const pair = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const publicKey = pair.publicKey.export({ type: "spki", format: "pem" }).toString();
const notification = {
  metadata: { topic: "ORDER_CONFIRMATION", schemaVersion: "1.0" },
  notification: {
    notificationId: "notification-synthetic",
    eventDate: now.toISOString(),
    data: { user: { userId: "seller-synthetic" }, order: { orderId: "12-00000-00001" } },
  },
};
const order = {
  orderId: "12-00000-00001",
  creationDate: now.toISOString(),
  lastModifiedDate: now.toISOString(),
  pricingSummary: { total: { value: "12.5", currency: "EUR" } },
  orderPaymentStatus: "PAID",
  orderFulfillmentStatus: "NOT_STARTED",
  lineItems: [{ lineItemId: "line-synthetic", title: "Articolo sintetico", quantity: 1 }],
};
const send = vi.fn<Queue["send"]>().mockResolvedValue(queued);
const environment: Env = {
  ...env,
  APP_ORIGIN: "https://test.fiscalbay.it",
  WORK_QUEUE: fakeQueue({ send }),
};
/** Richiesta al Worker come la consegna Cloudflare; il contesto serve solo alla build. */
const workerFetch = (request: Request, target: Env) =>
  worker.fetch(request as Parameters<typeof worker.fetch>[0], target, {} as ExecutionContext);
const fetcher = vi.fn<typeof fetch>(async (input, init) => {
  const url = String(input);
  if (url.endsWith("/oauth2/token")) {
    expect(init?.method).toBe("POST");
    const headers = new Headers(init?.headers);
    expect(headers.get("authorization")).toBe(
      `Basic ${btoa(`${env.EBAY_CLIENT_ID}:${env.EBAY_CLIENT_SECRET}`)}`,
    );
    expect(headers.get("content-type")).toBe("application/x-www-form-urlencoded");
    expect(String(init?.body)).toBe(
      new URLSearchParams({
        grant_type: "client_credentials",
        scope: "https://api.ebay.com/oauth/api_scope",
      }).toString(),
    );
    return Response.json({ access_token: "token-synthetic" });
  }
  if (url.includes("/public_key/")) {
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer token-synthetic");
    return Response.json({ key: publicKey.replaceAll("\n", "") });
  }
  if (url.includes("/sell/fulfillment/v1/order/")) return Response.json(order);
  if (url.endsWith("/ws/api.dll"))
    return new Response(
      "<GetOrdersResponse><Ack>Success</Ack><OrderArray><Order><OrderID>12-00000-00001</OrderID></Order></OrderArray></GetOrdersResponse>",
    );
  throw new Error("unexpected_synthetic_request");
});
function ebayRequest(payload: object = notification, kid = "synthetic-key") {
  const body = JSON.stringify(payload);
  const signature = btoa(
    JSON.stringify({
      kid,
      signature: sign("sha256", Buffer.from(body), pair.privateKey).toString("base64"),
      alg: "ECDSA",
      digest: "SHA256",
    }),
  );
  return new Request("https://test.fiscalbay.it/webhooks/ebay", {
    method: "POST",
    headers: { "x-ebay-signature": signature },
    body,
  });
}
async function receive(request = ebayRequest(), target = environment) {
  return receiveWebhook(request, target, fetcher, now);
}
function batch(body: unknown, attempts = 1) {
  const ack = vi.fn();
  const retry = vi.fn();
  return {
    message: { body, ack, retry, attempts },
    value: { messages: [{ body, ack, retry, attempts }] } as unknown as MessageBatch<unknown>,
  };
}

function acquire(fetcher: typeof fetch, calls = 12) {
  return acquireOrders({
    db: env.DB,
    storeId: "webhook-store",
    grantedAt,
    now,
    confirmedOrderId: order.orderId,
    budget: { calls, pages: 0 },
    access: {
      fetcher,
      configuration: ebayConfiguration(environment, "production"),
      accessToken: "access-synthetic",
    },
  });
}

it("verifica direttamente una firma valida e rifiuta header fuori limite", async () => {
  const request = ebayRequest(notification, "direct-validation-key");
  const body = await request.text();
  const signature = request.headers.get("x-ebay-signature")!;
  expect(
    await verifyEbayNotification(
      body,
      signature,
      environment,
      "production",
      fetcher,
      now.getTime(),
    ),
  ).toEqual({ topic: "ORDER_CONFIRMATION", notification: notification.notification });
  expect(send).not.toHaveBeenCalled();
  for (const invalid of ["", "x".repeat(2049)]) {
    await expect(
      verifyEbayNotification(body, invalid, environment, "production", fetcher, now.getTime()),
    ).rejects.toMatchObject({ failure: "header" });
  }
});

it("un negozio occupato restituisce un errore riprovabile al consumer", async () => {
  await env.DB.prepare(
    "INSERT INTO sync_state (store_id, locked_until, updated_at) VALUES ('webhook-store', ?, ?)",
  )
    .bind(new Date(now.getTime() + 60000).toISOString(), grantedAt)
    .run();
  await expect(
    consumeOrderConfirmation(
      environment,
      {
        storeId: "webhook-store",
        grantedAt,
        environment: "production",
        orderId: order.orderId,
        eventAt: now.toISOString(),
      },
      fetcher,
      now,
    ),
  ).rejects.toMatchObject({ failure: "unavailable" });
  expect(fetcher).not.toHaveBeenCalled();
});

it("un consenso revocato durante la lettura non scrive e chiude la ricevuta", async () => {
  await receive(ebayRequest(notification, "revocation-key"));
  const source = vi.fn<typeof fetch>(async () => {
    await env.DB.prepare(
      "DELETE FROM ebay_store_credentials WHERE store_id = 'webhook-store'",
    ).run();
    return Response.json(order);
  });
  const work = batch({ receiptId: (await receipt())!.id });
  await consumeWebhooks(work.value, environment, source, now);
  expect(work.message.ack).toHaveBeenCalledOnce();
  expect(work.message.retry).not.toHaveBeenCalled();
  expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM orders").first<{ n: number }>())?.n).toBe(
    0,
  );
});

it("la conferma usa il marketplace italiano nella lettura fiscale", async () => {
  const source = vi.fn<typeof fetch>(async (input, init) => {
    if (!String(input).includes("/sell/fulfillment/")) return fetcher(input, init);
    return Response.json({
      ...order,
      lineItems: order.lineItems.map((item) => ({ ...item, listingMarketplaceId: "EBAY_IT" })),
    });
  });
  expect(await acquire(source)).toBe("complete");
  const details = source.mock.calls.filter(([url]) => String(url).includes("TAX_BREAKDOWN"));
  expect(details).toHaveLength(1);
  expect(new Headers(details[0]![1]?.headers).get("x-ebay-c-marketplace-id")).toBe("EBAY_IT");
});

it("il challenge Production resta disponibile con sandbox disabilitata", async () => {
  const configured = {
    ...environment,
    EBAY_SANDBOX_ENABLED: "false" as const,
    EBAY_NOTIFICATION_VERIFICATION_TOKEN: "verification-synthetic-token-32-bytes",
  };
  expect(
    (
      await receive(
        new Request("https://test.fiscalbay.it/webhooks/ebay?challenge_code=x"),
        configured,
      )
    )?.status,
  ).toBe(200);
  expect(
    (
      await receive(
        new Request("https://test.fiscalbay.it/webhooks/ebay/sandbox?challenge_code=x"),
        configured,
      )
    )?.status,
  ).toBe(503);
});

it("l'acquisizione puntuale distingue budget, completamento e risposta incoerente", async () => {
  const source = vi.fn<typeof fetch>(fetcher);
  expect(await acquire(source, 0)).toBe("budget");
  expect(source).not.toHaveBeenCalled();
  expect(await acquire(source, 1)).toBe("budget");
  expect(source).toHaveBeenCalledOnce();
  expect(await acquire(source)).toBe("complete");
  await expect(
    acquire(async () => Response.json({ ...order, orderId: "different-order" })),
  ).rejects.toMatchObject({ failure: "invalid_response" });
});

it.each([0, 1, -1])("la finestra dell'ordine esclude la scadenza esatta: %s ms", async (offset) => {
  const source = vi.fn<typeof fetch>(async (input, init) =>
    String(input).includes("/sell/fulfillment/")
      ? Response.json({
          ...order,
          creationDate: new Date(now.getTime() - 30 * 86400000 + offset).toISOString(),
        })
      : fetcher(input, init),
  );
  expect(await acquire(source)).toBe("complete");
  expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM orders").first<{ n: number }>())?.n).toBe(
    offset <= 0 ? 0 : 1,
  );
});

it.each([0, -1])(
  "un token scaduto impedisce l'acquisizione anche al limite: %s ms",
  async (offset) => {
    await env.DB.prepare("UPDATE ebay_store_credentials SET access_expires_at = ?")
      .bind(new Date(now.getTime() + offset).toISOString())
      .run();
    await expect(
      consumeOrderConfirmation(
        environment,
        {
          storeId: "webhook-store",
          grantedAt,
          environment: "production",
          orderId: order.orderId,
          eventAt: now.toISOString(),
        },
        fetcher,
        now,
      ),
    ).rejects.toMatchObject({ failure: "credentials" });
    expect(fetcher).not.toHaveBeenCalled();
  },
);
async function receipt() {
  return env.DB.prepare("SELECT * FROM webhook_receipts").first<{
    id: string;
    queued_at: string | null;
    completed_at: string | null;
    lease: string | null;
  }>();
}

beforeEach(async () => {
  await resetDatabase();
  vi.setSystemTime(now);
  vi.clearAllMocks();
  router.create.mockReturnValue(router.handle);
  send.mockResolvedValue(queued);
  await env.DB.batch([
    ...insertWorkspace({ id: "webhook-workspace", createdAt: grantedAt }),
    env.DB.prepare(
      "INSERT INTO ebay_stores (id, workspace_id, ebay_user_id, ebay_account_id, linked_at) VALUES ('webhook-store', 'webhook-workspace', 'seller-synthetic', 'seller-synthetic', ?)",
    ).bind(grantedAt),
  ]);
  await insertCredentials({
    storeId: "webhook-store",
    accessToken: await sealToken(
      env.BETTER_AUTH_SECRET,
      "webhook-store",
      "access",
      "access-synthetic",
    ),
    accessExpiresAt: "2026-10-12T12:00:00.000Z",
    refreshExpiresAt: "2027-10-12T12:00:00.000Z",
    grantedAt,
  }).run();
});

afterEach(() => vi.useRealTimers());

it("la coda smista richieste di sincronizzazione, compiti, esportazioni e riferimenti dei webhook", async () => {
  const sync = { body: { syncStore: "webhook-store" }, ack: vi.fn(), retry: vi.fn(), attempts: 1 };
  const webhook = { body: { receiptId: "non-valido" }, ack: vi.fn(), retry: vi.fn(), attempts: 1 };
  const task = {
    body: { task: "maintenance", slot: "2026-10-12T00:00:00.000Z" },
    ack: vi.fn(),
    retry: vi.fn(),
    attempts: 1,
  };
  const exportJob = {
    body: { exportJob: crypto.randomUUID() },
    ack: vi.fn(),
    retry: vi.fn(),
    attempts: 1,
  };
  const ebayDeletion = {
    body: { ebayAccountDeletion: crypto.randomUUID() },
    ack: vi.fn(),
    retry: vi.fn(),
    attempts: 1,
  };
  const unknown = { body: { altro: true }, ack: vi.fn(), retry: vi.fn(), attempts: 1 };
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    await worker.queue(
      {
        messages: [sync, webhook, task, exportJob, ebayDeletion, unknown],
      } as unknown as MessageBatch<unknown>,
      environment,
    );
    // Un messaggio sconosciuto non passa dai webhook: si riprova fino ai non consegnati.
    expect(unknown.retry).toHaveBeenCalledOnce();
    expect(unknown.ack).not.toHaveBeenCalled();
    // Il riferimento di un webhook, anche malformato, resta al suo consumer.
    expect(
      logged.mock.calls
        .map(([entry]) => JSON.parse(entry))
        .filter((entry) => entry.operation === "queue" && entry.code === "INVALID_REQUEST"),
    ).toHaveLength(1);
  } finally {
    logged.mockRestore();
  }
  // Senza una richiesta in attesa la consegna si chiude senza leggere eBay.
  expect(sync.ack).toHaveBeenCalledOnce();
  expect(sync.retry).not.toHaveBeenCalled();
  expect(webhook.retry).toHaveBeenCalledOnce();
  expect(webhook.ack).not.toHaveBeenCalled();
  // Un compito senza turno aperto si chiude senza lavoro e senza passare dai webhook.
  expect(task.ack).toHaveBeenCalledOnce();
  expect(task.retry).not.toHaveBeenCalled();
  // Un'esportazione senza lavoro registrato si chiude al suo consumer.
  expect(exportJob.ack).toHaveBeenCalledOnce();
  expect(exportJob.retry).not.toHaveBeenCalled();
  // Una cancellazione richiesta da eBay senza richiesta registrata si chiude al suo consumer.
  expect(ebayDeletion.ack).toHaveBeenCalledOnce();
  expect(ebayDeletion.retry).not.toHaveBeenCalled();
});

it("lascia pagine e callback OAuth al router e rifiuta i metodi diversi", async () => {
  expect(await receive(new Request("https://test.fiscalbay.it/api/auth/callback/ebay"))).toBeNull();
  expect(await receive(new Request("https://test.fiscalbay.it/"))).toBeNull();
  const response = await receive(
    new Request("https://test.fiscalbay.it/webhooks/ebay", { method: "PUT" }),
  );
  expect(response?.status).toBe(405);
  expect(response?.headers.get("allow")).toBe("GET, POST");
  expect(send).not.toHaveBeenCalled();
});

it("il Worker intercetta il webhook prima di caricare la build React Router", async () => {
  expect(
    (
      await workerFetch(
        new Request("https://test.fiscalbay.it/webhooks/stripe", { method: "PUT" }),
        environment,
      )
    )?.status,
  ).toBe(405);
  expect(
    (
      await workerFetch(
        new Request("https://test.fiscalbay.it/webhooks/ebay", { method: "POST", body: "{}" }),
        environment,
      )
    )?.status,
  ).toBe(412);
  expect(router.create).not.toHaveBeenCalled();
  expect(router.handle).not.toHaveBeenCalled();
});

it.each([
  ["https://test.fiscalbay.it", "/", "noindex, nofollow", undefined],
  ["https://fiscalbay.it", "/en/prezzi", null, undefined],
  // Termini e Privacy restano raggiungibili ma fuori dagli indici (D204).
  ["https://fiscalbay.it", "/en/privacy", "noindex, nofollow", undefined],
  ["https://fiscalbay.it", "/app/ordini", "noindex, nofollow", "synthetic-version"],
  ["https://fiscalbay.it", "/", null, "synthetic-version"],
])(
  "il Worker inoltra la richiesta e applica gli header per %s%s",
  async (origin, path, robots, version) => {
    router.handle.mockResolvedValue(new Response("pagina sintetica", { status: 201 }));
    const response = await workerFetch(
      new Request(`${origin}${path}`, {
        method: "POST",
        body: "campo=sintetico",
        headers: { cookie: "session=synthetic", "x-correlation-id": "forged" },
      }),
      {
        ...environment,
        APP_ORIGIN: origin,
        VERSION_METADATA: version ? { id: version } : undefined,
      } as Env,
    );
    expect(response.status).toBe(201);
    expect(await response.text()).toBe("pagina sintetica");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-robots-tag")).toBe(robots);
    expect(response.headers.get("x-fiscalbay-version")).toBe(version ?? null);
    expect(router.handle).toHaveBeenCalledOnce();
    const forwarded = router.handle.mock.calls[0]![0] as Request;
    expect(forwarded.url).toBe(`${origin}${path}`);
    expect(forwarded.method).toBe("POST");
    expect(await forwarded.text()).toBe("campo=sintetico");
    expect(forwarded.headers.get("cookie")).toBe("session=synthetic");
    const correlation = response.headers.get("x-correlation-id");
    expect(correlation).toMatch(/^[\da-f-]{36}$/u);
    expect(correlation).not.toBe("forged");
    expect(forwarded.headers.get("x-correlation-id")).toBe(correlation);
  },
);

it("il Worker risponde no-store a ogni pagina pubblica e in Production noindex ai soli legali", async () => {
  // Il router esegue il loader reale della pagina con gli header che la route dichiara, come
  // React Router: una route che chiedesse una cache pubblica la vedrebbe conservata.
  const pages: Record<string, { loader: (args: never) => unknown; headers?: () => HeadersInit }> = {
    "/": site,
    "/funzionalita": features,
    "/prezzi": pricing,
    "/sicurezza": siteSecurity,
    "/faq": faq,
    "/supporto": support,
    "/termini": legal,
    "/privacy": legal,
  };
  router.handle.mockImplementation(async (request: Request) => {
    const path = new URL(request.url).pathname.replace(/^\/en(?=\/|$)/u, "") || "/";
    const page = pages[path]!;
    const data = await page.loader({ request, params: {}, context: {} } as never);
    return Response.json(data, { headers: page.headers?.() ?? {} });
  });
  try {
    for (const prefix of ["", "/en"])
      for (const path of Object.keys(pages)) {
        const url = `https://fiscalbay.it${prefix}${path === "/" && prefix ? "" : path}`;
        const response = await workerFetch(new Request(url), {
          ...environment,
          APP_ORIGIN: "https://fiscalbay.it",
        } as Env);
        expect(response.status, url).toBe(200);
        expect(response.headers.get("cache-control"), url).toBe("no-store");
        expect(response.headers.get("x-robots-tag"), url).toBe(
          path === "/termini" || path === "/privacy" ? "noindex, nofollow" : null,
        );
      }
  } finally {
    router.handle.mockReset();
  }
});

it("il Worker conserva cache e redirect dichiarati dal router anche con header immutabili", async () => {
  router.handle.mockResolvedValue(Response.redirect("https://test.fiscalbay.it/accesso", 303));
  const request = new Request("https://test.fiscalbay.it/app/ordini");
  const redirect = await workerFetch(request, environment);
  expect(redirect.status).toBe(303);
  expect(redirect.headers.get("location")).toBe("https://test.fiscalbay.it/accesso");
  expect(redirect.headers.get("cache-control")).toBe("no-store");
  router.handle.mockResolvedValue(
    new Response("pubblico", {
      headers: { "cache-control": "public, max-age=60" },
    }),
  );
  expect((await workerFetch(request, environment)).headers.get("cache-control")).toBe(
    "public, max-age=60",
  );
});

it("il Worker risponde all'errore del router con 500 correlato e senza dettagli riservati", async () => {
  router.handle.mockRejectedValue(new Error("NON-ESPORRE"));
  const response = await workerFetch(
    new Request("https://test.fiscalbay.it/app/ordini"),
    environment,
  );
  expect(response.status).toBe(500);
  expect(await response.text()).toBe("");
  const forwarded = router.handle.mock.calls[0]![0] as Request;
  expect(response.headers.get("x-correlation-id")).toBe(forwarded.headers.get("x-correlation-id"));
  expect(response.headers.get("x-correlation-id")).toMatch(/^[\da-f-]{36}$/u);
});

it("la coda senza webhook chiude le sole sincronizzazioni senza riprovare messaggi inesistenti", async () => {
  const sync = { body: { syncStore: "webhook-store" }, ack: vi.fn(), retry: vi.fn(), attempts: 1 };
  await worker.queue({ messages: [sync] } as unknown as MessageBatch<unknown>, environment);
  expect(sync.ack).toHaveBeenCalledOnce();
  expect(sync.retry).not.toHaveBeenCalled();
  await worker.queue({ messages: [] } as unknown as MessageBatch<unknown>, environment);
  expect(send).not.toHaveBeenCalled();
});

it("coda, cron e ingresso dei webhook scrivono esito e durata su Analytics Engine", async () => {
  const points: AnalyticsEngineDataPoint[] = [];
  const dataset: AnalyticsEngineDataset = { writeDataPoint: (point) => void points.push(point!) };
  const metrics = { ...environment, METRICS: dataset };
  const sync = { body: { syncStore: "webhook-store" }, ack: vi.fn(), retry: vi.fn(), attempts: 1 };
  const unknown = { body: { altro: true }, ack: vi.fn(), retry: vi.fn(), attempts: 1 };
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    await worker.queue({ messages: [sync, unknown] } as unknown as MessageBatch<unknown>, metrics);
  } finally {
    logged.mockRestore();
  }
  // Il consumer riceve i messaggi osservati: ack e retry arrivano a quelli originali.
  expect(sync.ack).toHaveBeenCalledOnce();
  expect(unknown.retry).toHaveBeenCalledOnce();
  await worker.scheduled({ scheduledTime: now.getTime() } as ScheduledController, {
    ...metrics,
    WORK_QUEUE: fakeQueue({ send, sendBatch: vi.fn().mockResolvedValue(queued) }),
  });
  const response = await workerFetch(
    new Request("https://test.fiscalbay.it/webhooks/stripe"),
    metrics,
  );
  expect(response.status).toBe(405);
  expect(
    points
      .filter((point) => point.blobs![0] === "invocation")
      .map((point) => point.blobs!.slice(1, 5)),
  ).toEqual([
    ["queue", "unknown", "", "retry"],
    ["queue", "sync", "", "ok"],
    ["cron", "dispatch", "", "ok"],
    ["http", "webhook", "GET", "4xx"],
  ]);
});

it("durante la sospensione pagine, webhook, coda e cron non toccano i dati", async () => {
  const sendBatch = vi.fn<Queue["sendBatch"]>().mockResolvedValue(queued);
  const suspended: Env = {
    ...environment,
    SERVICE_FROZEN: "true",
    WORK_QUEUE: fakeQueue({ send, sendBatch }),
  };
  const page = await workerFetch(new Request("https://test.fiscalbay.it/app/ordini"), suspended);
  expect(page.status).toBe(503);
  expect(page.headers.get("x-fiscalbay-frozen")).toBe("1");
  expect(page.headers.get("retry-after")).toBe("600");
  expect(page.headers.get("cache-control")).toBe("no-store");
  expect(page.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
  expect(await page.text()).toContain("<title>FiscalBay | Manutenzione</title>");
  const webhook = await workerFetch(
    new Request("https://test.fiscalbay.it/webhooks/stripe", { method: "POST", body: "{}" }),
    suspended,
  );
  expect(webhook.status).toBe(503);
  expect(await webhook.text()).toBe("");
  expect(router.handle).not.toHaveBeenCalled();
  const sync = { body: { syncStore: "webhook-store" }, ack: vi.fn(), retry: vi.fn(), attempts: 1 };
  await worker.queue({ messages: [sync] } as unknown as MessageBatch<unknown>, suspended);
  expect(sync.ack).not.toHaveBeenCalled();
  expect(sync.retry).toHaveBeenCalledWith({ delaySeconds: 43_200 });
  await worker.scheduled({ scheduledTime: now.getTime() } as ScheduledController, suspended);
  expect(sendBatch).not.toHaveBeenCalled();
  expect(send).not.toHaveBeenCalled();
  // Un valore diverso da «true» non sospende nulla.
  const open = await workerFetch(new Request("https://test.fiscalbay.it/webhooks/stripe"), {
    ...environment,
    SERVICE_FROZEN: "false",
  });
  expect(open.status).toBe(405);
});

it("il cron del Worker accoda i turni dell'orario pianificato, anche se eseguito in ritardo", async () => {
  const sendBatch = vi.fn<Queue["sendBatch"]>().mockResolvedValue(queued);
  await worker.scheduled({ scheduledTime: now.getTime() } as ScheduledController, {
    ...environment,
    WORK_QUEUE: fakeQueue({ send, sendBatch }),
  });
  expect(sendBatch).toHaveBeenNthCalledWith(1, [
    { body: { task: "maintenance", slot: "2026-10-11T00:00:00.000Z" } },
    { body: { task: "export_files", slot: now.toISOString() } },
    { body: { task: "token_refresh", slot: now.toISOString() } },
    { body: { task: "inactivity", slot: now.toISOString() } },
    { body: { task: "billing", slot: now.toISOString() } },
    { body: { task: "telegram", slot: now.toISOString() } },
    { body: { task: "telegram_commands", slot: "2026-10-11T00:00:00.000Z" } },
    { body: { task: "ebay_quotas", slot: now.toISOString() } },
    { body: { task: "owner_incidents", slot: now.toISOString() } },
    { body: { task: "account_deletion", slot: now.toISOString() } },
  ]);
  expect(sendBatch).toHaveBeenNthCalledWith(2, [{ body: { syncStores: ["webhook-store"] } }]);
  expect(sendBatch).toHaveBeenCalledTimes(2);
  expect(fetcher).not.toHaveBeenCalled();
});

it("risponde al challenge usando l'endpoint configurato e il token custodito", async () => {
  const request = new Request(
    "https://other.example.invalid/webhooks/ebay?challenge_code=challenge",
  );
  expect((await receive(request))?.status).toBe(503);
  const configured = {
    ...environment,
    EBAY_NOTIFICATION_VERIFICATION_TOKEN: "verification-synthetic-token-32-bytes",
  };
  expect(await (await receive(request, configured))?.json()).toEqual({
    challengeResponse: createHash("sha256")
      .update(
        "challengeverification-synthetic-token-32-byteshttps://test.fiscalbay.it/webhooks/ebay",
      )
      .digest("hex"),
  });
  expect(
    (await receive(new Request("https://test.fiscalbay.it/webhooks/ebay"), configured))?.status,
  ).toBe(400);
});

it("rifiuta corpi oltre limite anche senza Content-Length, UTF-8 invalido e corpo assente", async () => {
  for (const request of [
    new Request("https://test.fiscalbay.it/webhooks/ebay", {
      method: "POST",
      headers: { "content-length": "262145" },
      body: "small",
    }),
    new Request("https://test.fiscalbay.it/webhooks/ebay", {
      method: "POST",
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(262145));
          controller.close();
        },
      }),
    }),
  ])
    expect((await receive(request))?.status).toBe(413);
  expect(
    (
      await receive(
        new Request("https://test.fiscalbay.it/webhooks/ebay", {
          method: "POST",
          body: new Uint8Array([255]),
        }),
      )
    )?.status,
  ).toBe(400);
  expect(
    (await receive(new Request("https://test.fiscalbay.it/webhooks/ebay", { method: "POST" })))
      ?.status,
  ).toBe(400);
  expect(fetcher).not.toHaveBeenCalled();
  expect(await receipt()).toBeNull();
});

it("verifica il corpo grezzo, deduplica e accoda soltanto il riferimento", async () => {
  expect((await receive())?.status).toBe(204);
  const row = await receipt();
  expect(row?.queued_at).toBe(now.toISOString());
  expect(send).toHaveBeenCalledExactlyOnceWith({ receiptId: row?.id });
  expect((await receive())?.status).toBe(204);
  expect(send).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls.filter(([url]) => String(url).includes("/public_key/"))).toHaveLength(
    1,
  );
  const altered = ebayRequest();
  const body = await altered.text();
  expect(
    (
      await receive(
        new Request(altered.url, { method: "POST", headers: altered.headers, body: body + " " }),
      )
    )?.status,
  ).toBe(412);
  expect(
    (
      await receive(
        ebayRequest({
          ...notification,
          notification: {
            ...notification.notification,
            data: { ...notification.notification.data, order: { orderId: "different-order" } },
          },
        }),
      )
    )?.status,
  ).toBe(409);
});

it("con chiamate eBay, invii Telegram e acquisti spenti l'ingresso riceve e accoda gli eventi", async () => {
  for (const name of ["ebay_calls", "telegram_sends", "purchases_open"] as const)
    await setSwitch(env.DB, name, false, now);
  // La chiave pubblica della firma non è una chiamata dei negozi: resta disponibile.
  expect((await receive())?.status).toBe(204);
  expect(send).toHaveBeenCalledExactlyOnceWith({ receiptId: (await receipt())?.id });
});

it("rifiuta firma, schema, ambiente e data non validi e ignora venditori senza negozio, senza claim", async () => {
  const missing = new Request("https://test.fiscalbay.it/webhooks/ebay", {
    method: "POST",
    body: "{}",
  });
  expect((await receive(missing))?.status).toBe(412);
  const malformed = ebayRequest();
  malformed.headers.set("x-ebay-signature", "invalid");
  expect((await receive(malformed))?.status).toBe(412);
  for (const [payload, status] of [
    [{ ...notification, metadata: { topic: "OTHER", schemaVersion: "1.0" } }, 412],
    [
      {
        ...notification,
        notification: { ...notification.notification, eventDate: "2026-10-01T12:00:00.000Z" },
      },
      204,
    ],
    [
      {
        ...notification,
        notification: { ...notification.notification, eventDate: "2026-10-12T12:00:00.000Z" },
      },
      400,
    ],
    [
      {
        ...notification,
        notification: {
          ...notification.notification,
          data: { ...notification.notification.data, user: { userId: "other-seller" } },
        },
      },
      204,
    ],
  ] as const)
    expect((await receive(ebayRequest(payload)))?.status).toBe(status);
  const sandbox = ebayRequest();
  expect(
    (await receive(new Request("https://test.fiscalbay.it/webhooks/ebay/sandbox", sandbox)))
      ?.status,
  ).toBe(412);
  expect(await receipt()).toBeNull();
});

it("riprende un claim se Queue fallisce, anche senza altre consegne del provider", async () => {
  send.mockRejectedValueOnce(new Error("queue_unavailable"));
  expect((await receive())?.status).toBe(503);
  const row = await receipt();
  expect(row?.queued_at).toBeNull();
  await recoverWebhookIngress(environment, now);
  expect(send).toHaveBeenLastCalledWith({ receiptId: row?.id });
  expect((await receipt())?.queued_at).toBe(now.toISOString());
  await recoverWebhookIngress(environment, now);
  expect(send).toHaveBeenCalledTimes(2);

  // Un messaggio accettato e poi perso (scaduto o nella DLQ) si riaccoda dopo un giorno, finché
  // la ricevuta è valida e nessun consumer la tiene; una ricevuta scaduta non si riaccoda.
  const day = 86_400_000;
  await env.DB.prepare("UPDATE webhook_receipts SET locked_until = ?")
    .bind(new Date(now.getTime() + day + 60_000).toISOString())
    .run();
  await recoverWebhookIngress(environment, new Date(now.getTime() + day));
  expect(send).toHaveBeenCalledTimes(2);
  await env.DB.prepare("UPDATE webhook_receipts SET locked_until = NULL").run();
  await recoverWebhookIngress(environment, new Date(now.getTime() + day - 1));
  expect(send).toHaveBeenCalledTimes(2);
  await recoverWebhookIngress(environment, new Date(now.getTime() + day));
  expect(send).toHaveBeenCalledTimes(3);
  await recoverWebhookIngress(environment, new Date(now.getTime() + 8 * day));
  expect(send).toHaveBeenCalledTimes(3);
});

it("il consumer importa solo l'ordine del negozio verificato e non ripete gli effetti", async () => {
  await receive();
  const work = batch({ receiptId: (await receipt())!.id });
  await consumeWebhooks(work.value, environment, fetcher, now);
  expect(work.message.ack).toHaveBeenCalledTimes(1);
  expect(work.message.retry).not.toHaveBeenCalled();
  expect((await receipt())?.completed_at).toBe(now.toISOString());
  const result = await env.DB.prepare("SELECT store_id, ebay_order_id FROM orders").all();
  expect(result.results).toEqual([{ store_id: "webhook-store", ebay_order_id: order.orderId }]);
  const calls = fetcher.mock.calls.length;
  await consumeWebhooks(work.value, environment, fetcher, now);
  expect(fetcher).toHaveBeenCalledTimes(calls);
  expect(work.message.ack).toHaveBeenCalledTimes(2);
});

it.each(["pause", "disconnect", "reconnect", "erase", "expired"])(
  "il consumer rivalida %s prima di leggere eBay",
  async (change) => {
    await receive();
    const row = (await receipt())!;
    if (change === "pause")
      await insertStorePause({ storeId: "webhook-store", pausedAt: now.toISOString() }).run();
    if (change === "disconnect") await env.DB.prepare("DELETE FROM ebay_store_credentials").run();
    if (change === "reconnect")
      await env.DB.prepare("UPDATE ebay_store_credentials SET granted_at = ?")
        .bind(now.toISOString())
        .run();
    if (change === "erase")
      await env.DB.prepare("UPDATE ebay_stores SET data_deleted_at = ?")
        .bind(now.toISOString())
        .run();
    if (change === "expired")
      await env.DB.prepare("UPDATE webhook_receipts SET expires_at = ?")
        .bind(now.toISOString())
        .run();
    fetcher.mockClear();
    const work = batch({ receiptId: row.id });
    await consumeWebhooks(work.value, environment, fetcher, now);
    expect(fetcher).not.toHaveBeenCalled();
    expect(work.message.ack).toHaveBeenCalledOnce();
    expect(work.message.retry).not.toHaveBeenCalled();
  },
);

it("rispetta lease, retry del provider e riprende dopo un'interruzione", async () => {
  await receive();
  const row = (await receipt())!;
  await env.DB.prepare("UPDATE webhook_receipts SET lease = 'previous', locked_until = ?")
    .bind(new Date(now.getTime() + 60000).toISOString())
    .run();
  const work = batch({ receiptId: row.id });
  await consumeWebhooks(work.value, environment, fetcher, now);
  expect(work.message.retry).toHaveBeenCalledWith({ delaySeconds: 60 });
  expect(work.message.ack).not.toHaveBeenCalled();
  const limited = vi.fn<typeof fetch>(
    async () => new Response(null, { status: 429, headers: { "retry-after": "120" } }),
  );
  await consumeWebhooks(work.value, environment, limited, new Date(now.getTime() + 60001));
  expect(work.message.retry).toHaveBeenLastCalledWith({ delaySeconds: 120 });
  expect((await receipt())?.lease).toBeNull();
  // Una consegna anticipata rispetta l'attesa chiesta da eBay senza chiamarlo.
  fetcher.mockClear();
  await consumeWebhooks(work.value, environment, fetcher, new Date(now.getTime() + 120000));
  expect(fetcher).not.toHaveBeenCalled();
  expect(work.message.retry).toHaveBeenLastCalledWith({ delaySeconds: 61 });
  await consumeWebhooks(work.value, environment, fetcher, new Date(now.getTime() + 180001));
  expect(work.message.ack).toHaveBeenCalledOnce();
});

it("consegne concorrenti non producono due effetti e messaggi invalidi vanno in retry", async () => {
  await receive();
  const id = (await receipt())!.id;
  const first = batch({ receiptId: id });
  const second = batch({ receiptId: id });
  await Promise.all([
    consumeWebhooks(first.value, environment, fetcher, now),
    consumeWebhooks(second.value, environment, fetcher, now),
  ]);
  expect(
    first.message.ack.mock.calls.length + second.message.ack.mock.calls.length,
  ).toBeGreaterThanOrEqual(1);
  expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM orders").first<{ n: number }>())?.n).toBe(
    1,
  );
  const invalid = batch({ payload: "untrusted" });
  await consumeWebhooks(invalid.value, environment, fetcher, now);
  expect(invalid.message.retry).toHaveBeenCalledWith({ delaySeconds: 30 });
});

it("prende in carico Stripe con firma valida e rilegge l'oggetto prima degli effetti", async () => {
  const event = {
    id: "evt_synthetic",
    type: "checkout.session.completed",
    created: now.getTime() / 1000,
    livemode: false,
    data: { object: { id: "cs_synthetic" } },
  };
  const body = JSON.stringify(event);
  const header = await Stripe.webhooks.generateTestHeaderStringAsync({
    payload: body,
    secret: "whsec_fiscalbay_test",
  });
  const request = () =>
    new Request("https://test.fiscalbay.it/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": header },
      body,
    });
  expect((await receive(request()))?.status).toBe(204);
  expect((await receive(request()))?.status).toBe(204);
  expect(send).toHaveBeenCalledTimes(1);
  // Il payload non è usato: la sessione riletta da Stripe è un pagamento, senza abbonamento.
  const stripe = vi.fn<typeof fetch>(async () =>
    Response.json({ id: "cs_synthetic", object: "checkout.session", mode: "payment" }),
  );
  const work = batch({ receiptId: (await receipt())!.id });
  await consumeWebhooks(work.value, environment, stripe, now);
  expect(work.message.ack).toHaveBeenCalledOnce();
  expect(stripe).toHaveBeenCalledOnce();
  expect(new URL(String(stripe.mock.calls[0]![0])).pathname).toBe(
    "/v1/checkout/sessions/cs_synthetic",
  );
  expect((await receipt())?.completed_at).toBe(now.toISOString());
  expect(
    (await receive(request(), { ...environment, STRIPE_WEBHOOK_SECRET: undefined } as Env))?.status,
  ).toBe(503);
  expect(
    (await receive(request(), { ...environment, APP_ORIGIN: "https://fiscalbay.it" }))?.status,
  ).toBe(400);
});

it("la retention è effettiva anche se la pulizia non è partita", async () => {
  await receive();
  const row = (await receipt())!;
  const after = new Date(now.getTime() + 7 * 86400000);
  const work = batch({ receiptId: row.id });
  fetcher.mockClear();
  await consumeWebhooks(work.value, environment, fetcher, after);
  expect(work.message.ack).toHaveBeenCalledOnce();
  expect(fetcher).not.toHaveBeenCalled();
  await recoverWebhookIngress(environment, after);
  await purgeExpiredRecords(env.DB, after);
  expect(await receipt()).toBeNull();
});

it.each(["scadenza", "cancellazione"])(
  "una ricevuta pendente non rilegge eBay dopo %s dell'ordine",
  async (mode) => {
    await acquire(fetcher);
    await receive();
    const row = (await receipt())!;
    if (mode === "scadenza") {
      await env.DB.prepare("UPDATE orders SET retention_until = ?1, purge_after = ?1")
        .bind(now.toISOString())
        .run();
    } else await env.DB.prepare("DELETE FROM orders").run();
    const work = batch({ receiptId: row.id });
    fetcher.mockClear();
    await consumeWebhooks(work.value, environment, fetcher, now);
    expect(work.message.ack).toHaveBeenCalledOnce();
    expect(fetcher).not.toHaveBeenCalled();
  },
);

it("limita i recuperi delle chiavi pubbliche e non accetta una chiave non verificabile", async () => {
  const failed = vi.fn<typeof fetch>(async () => new Response(null, { status: 503 }));
  for (let i = 0; i < 10; i++)
    await receiveWebhook(
      ebayRequest(notification, `failed-${i}`),
      environment,
      failed,
      new Date(now.getTime() + 60000),
    );
  expect(failed.mock.calls.length).toBe(10);
  expect(
    (
      await receiveWebhook(
        ebayRequest(notification, "excess"),
        environment,
        failed,
        new Date(now.getTime() + 60000),
      )
    )?.status,
  ).toBe(429);
  const request = ebayRequest();
  await expect(
    verifyEbayNotification(
      (await request.text()) + " ",
      request.headers.get("x-ebay-signature")!,
      environment,
      "production",
      fetcher,
      now.getTime(),
    ),
  ).rejects.toThrow();
});

it("accetta un corpo al limite, legge più chunk senza alterare byte e rifiuta l'algoritmo errato", async () => {
  const base = JSON.stringify(notification);
  const body = base + " ".repeat(262144 - new TextEncoder().encode(base).length);
  const signature = btoa(
    JSON.stringify({
      kid: "synthetic-key",
      alg: "ECDSA",
      digest: "SHA256",
      signature: sign("sha256", Buffer.from(body), pair.privateKey).toString("base64"),
    }),
  );
  const bytes = new TextEncoder().encode(body);
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(bytes.slice(0, 20));
      controller.enqueue(bytes.slice(20));
      controller.close();
    },
  });
  expect(
    (
      await receive(
        new Request("https://test.fiscalbay.it/webhooks/ebay", {
          method: "POST",
          headers: { "x-ebay-signature": signature, "content-length": "262144" },
          body: stream,
        }),
      )
    )?.status,
  ).toBe(204);
  const wrong = ebayRequest();
  const header = JSON.parse(atob(wrong.headers.get("x-ebay-signature")!));
  wrong.headers.set("x-ebay-signature", btoa(JSON.stringify({ ...header, digest: "SHA1" })));
  expect((await receive(wrong))?.status).toBe(412);
});

it("rifiuta eventi scaduti e riprende un negozio occupato senza avanzare il watermark", async () => {
  await env.DB.prepare(
    "UPDATE ebay_store_credentials SET granted_at = '2026-09-01T12:00:00.000Z'",
  ).run();
  const old = {
    ...notification,
    notification: {
      ...notification.notification,
      eventDate: new Date(now.getTime() - 7 * 86400000).toISOString(),
    },
  };
  expect((await receive(ebayRequest(old)))?.status).toBe(400);
  await env.DB.prepare("UPDATE ebay_store_credentials SET granted_at = ?").bind(grantedAt).run();
  await receive();
  await env.DB.prepare(
    "INSERT INTO sync_state (store_id, cursor, locked_until, updated_at) VALUES ('webhook-store', ?, ?, ?)",
  )
    .bind(grantedAt, new Date(now.getTime() + 60000).toISOString(), grantedAt)
    .run();
  const work = batch({ receiptId: (await receipt())!.id }, 3);
  fetcher.mockClear();
  await consumeWebhooks(work.value, environment, fetcher, now);
  expect(work.message.retry).toHaveBeenCalledWith({ delaySeconds: 120 });
  expect(fetcher).not.toHaveBeenCalled();
  await consumeWebhooks(work.value, environment, fetcher, new Date(now.getTime() + 60000));
  expect(work.message.ack).toHaveBeenCalledOnce();
  expect(
    (
      await env.DB.prepare("SELECT cursor FROM sync_state WHERE store_id = 'webhook-store'").first<{
        cursor: string;
      }>()
    )?.cursor,
  ).toBe(grantedAt);
});

it.each([0, 1])(
  "un ordine fuori retention da %s ms non viene ricreato e un ID diverso non viene importato",
  async (elapsed) => {
    await receive();
    const row = (await receipt())!;
    const work = batch({ receiptId: row.id });
    const ancient = vi.fn<typeof fetch>(async () =>
      Response.json({
        ...order,
        creationDate: new Date(now.getTime() - 30 * 86_400_000 - elapsed).toISOString(),
      }),
    );
    await consumeWebhooks(work.value, environment, ancient, now);
    expect(work.message.ack).toHaveBeenCalledOnce();
    expect(
      (await env.DB.prepare("SELECT COUNT(*) AS n FROM orders").first<{ n: number }>())?.n,
    ).toBe(0);
    await env.DB.prepare("UPDATE webhook_receipts SET completed_at = NULL").run();
    const mismatch = vi.fn<typeof fetch>(async () =>
      Response.json({ ...order, orderId: "different-order" }),
    );
    const wrong = batch({ receiptId: row.id });
    await consumeWebhooks(wrong.value, environment, mismatch, now);
    expect(wrong.message.ack).not.toHaveBeenCalled();
    expect(wrong.message.retry).toHaveBeenCalledWith({ delaySeconds: 30 });
  },
);

it("la conferma aggiorna un ordine con retention esplicita oltre i trenta giorni", async () => {
  expect(await acquire(fetcher)).toBe("complete");
  await env.DB.prepare("UPDATE orders SET retention_until = ?1, purge_after = ?1")
    .bind("2027-10-11T12:00:00.000Z")
    .run();
  const later = new Date("2026-11-12T12:00:00.000Z");
  await env.DB.prepare("UPDATE ebay_store_credentials SET access_expires_at = ?")
    .bind("2027-10-11T12:00:00.000Z")
    .run();
  vi.setSystemTime(later);
  const updated = vi.fn<typeof fetch>(async () =>
    Response.json({
      ...order,
      lastModifiedDate: later.toISOString(),
      orderPaymentStatus: "FULLY_REFUNDED",
    }),
  );
  await consumeOrderConfirmation(
    environment,
    {
      storeId: "webhook-store",
      grantedAt,
      environment: "production",
      orderId: order.orderId,
      eventAt: later.toISOString(),
    },
    updated,
    later,
  );
  expect(await env.DB.prepare("SELECT payment_status FROM orders").first()).toEqual({
    payment_status: "FULLY_REFUNDED",
  });
});

it("il challenge controlla dimensione, configurazione e metodi anche con Stripe", async () => {
  const configured = {
    ...environment,
    EBAY_NOTIFICATION_VERIFICATION_TOKEN: "verification-synthetic-token-32-bytes",
  };
  expect(
    (
      await receive(
        new Request("https://test.fiscalbay.it/webhooks/ebay?challenge_code=" + "a".repeat(256)),
        configured,
      )
    )?.status,
  ).toBe(200);
  expect(
    (
      await receive(
        new Request("https://test.fiscalbay.it/webhooks/ebay?challenge_code=" + "a".repeat(257)),
        configured,
      )
    )?.status,
  ).toBe(400);
  expect(
    (
      await receive(
        new Request("https://test.fiscalbay.it/webhooks/ebay/sandbox?challenge_code=a"),
        configured,
      )
    )?.status,
  ).toBe(503);
  expect(
    (
      await receive(new Request("https://test.fiscalbay.it/webhooks/ebay?challenge_code=a"), {
        ...configured,
        EBAY_NOTIFICATION_VERIFICATION_TOKEN: "invalid",
      })
    )?.status,
  ).toBe(503);
  const stripeGet = await receive(
    new Request("https://test.fiscalbay.it/webhooks/stripe?challenge_code=a"),
    configured,
  );
  expect(stripeGet?.status).toBe(405);
  expect(stripeGet?.headers.get("allow")).toBe("POST");
  expect((await receive(ebayRequest(), configured))?.status).toBe(204);
});

it("la dimensione dell'header viene controllata prima di recuperare la chiave", async () => {
  const request = ebayRequest();
  const header = JSON.parse(atob(request.headers.get("x-ebay-signature")!));
  let padding = 0;
  let encoded = "";
  while (encoded.length < 2048)
    encoded = btoa(JSON.stringify({ ...header, padding: "a".repeat(padding++) }));
  expect(encoded.length).toBe(2048);
  request.headers.set("x-ebay-signature", encoded);
  expect((await receive(request))?.status).toBe(204);
  const oversized = ebayRequest();
  oversized.headers.set(
    "x-ebay-signature",
    btoa(JSON.stringify({ ...header, padding: "a".repeat(padding + 8) })),
  );
  fetcher.mockClear();
  expect((await receive(oversized))?.status).toBe(412);
  expect(fetcher).not.toHaveBeenCalled();
});

it("un ID non può cambiare negozio, consenso, tipo o data della ricevuta", async () => {
  await receive();
  expect(
    await env.DB.prepare(
      "SELECT provider, environment, topic, object_id, store_id, consent_granted_at, event_at FROM webhook_receipts",
    ).first(),
  ).toEqual({
    provider: "ebay",
    environment: "production",
    topic: "ORDER_CONFIRMATION",
    object_id: order.orderId,
    store_id: "webhook-store",
    consent_granted_at: grantedAt,
    event_at: now.toISOString(),
  });
  await env.DB.prepare("UPDATE webhook_receipts SET topic = 'different'").run();
  expect((await receive())?.status).toBe(409);
  await env.DB.prepare("UPDATE webhook_receipts SET topic = 'ORDER_CONFIRMATION'").run();
  const changed = {
    ...notification,
    notification: {
      ...notification.notification,
      eventDate: new Date(now.getTime() + 60000).toISOString(),
    },
  };
  expect((await receive(ebayRequest(changed)))?.status).toBe(409);
  await env.DB.prepare(
    "UPDATE ebay_store_credentials SET granted_at = '2026-10-11T11:00:00.000Z'",
  ).run();
  expect((await receive())?.status).toBe(409);
  await env.DB.prepare("UPDATE ebay_store_credentials SET granted_at = ?").bind(grantedAt).run();
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO ebay_stores (id, workspace_id, ebay_user_id, ebay_account_id, linked_at) VALUES ('other-store', 'webhook-workspace', 'other-seller', 'other-seller', ?)",
    ).bind(grantedAt),
    env.DB.prepare(
      "INSERT INTO ebay_store_credentials (store_id, access_token, access_expires_at, refresh_token, refresh_expires_at, granted_at, refreshed_at, rejected_at, reconnect_notice_at) SELECT 'other-store', access_token, access_expires_at, refresh_token, refresh_expires_at, granted_at, refreshed_at, rejected_at, reconnect_notice_at FROM ebay_store_credentials WHERE store_id = 'webhook-store'",
    ),
  ]);
  expect(
    (
      await receive(
        ebayRequest({
          ...notification,
          notification: {
            ...notification.notification,
            data: { ...notification.notification.data, user: { userId: "other-seller" } },
          },
        }),
      )
    )?.status,
  ).toBe(409);
});

it("consenso e tolleranza di orologio includono esattamente il confine previsto", async () => {
  await env.DB.prepare("UPDATE ebay_store_credentials SET granted_at = ?")
    .bind(now.toISOString())
    .run();
  expect((await receive())?.status).toBe(204);
  await env.DB.prepare("DELETE FROM webhook_receipts").run();
  expect(
    (
      await receive(
        ebayRequest({
          ...notification,
          notification: {
            ...notification.notification,
            eventDate: new Date(now.getTime() + 300000).toISOString(),
          },
        }),
      )
    )?.status,
  ).toBe(204);
});

it("mantiene la lease durante la lettura e registra soltanto errori tecnici minimizzati", async () => {
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const invalid = ebayRequest();
    invalid.headers.set("x-ebay-signature", "invalid");
    await receive(invalid);
    expect(logged).not.toHaveBeenCalled();
    send.mockRejectedValueOnce(new Error("sensitive_unprinted_payload"));
    await receive();
    expect(JSON.parse(logged.mock.calls[0]![0])).toMatchObject({
      operation: "webhook_ingress",
      event: "application_error",
    });
    await recoverWebhookIngress(environment, now);
    const id = (await receipt())!.id;
    let release!: () => void;
    let started!: () => void;
    const waiting = new Promise<void>((resolve) => {
      release = resolve;
    });
    const reading = new Promise<void>((resolve) => {
      started = resolve;
    });
    const slow = vi.fn<typeof fetch>(async (input, init) => {
      started();
      await waiting;
      return fetcher(input, init);
    });
    const work = batch({ receiptId: id });
    const consuming = consumeWebhooks(work.value, environment, slow, now);
    await Promise.race([
      reading,
      consuming.then(() => {
        throw new Error("lettura attesa non avviata");
      }),
    ]);
    try {
      expect(
        (
          await env.DB.prepare("SELECT locked_until FROM webhook_receipts").first<{
            locked_until: string;
          }>()
        )?.locked_until,
      ).toBe(new Date(now.getTime() + 15 * 60000).toISOString());
      const duplicate = batch({ receiptId: id });
      await consumeWebhooks(duplicate.value, environment, fetcher, now);
      expect(duplicate.message.retry).toHaveBeenCalledWith({ delaySeconds: 60 });
    } finally {
      release();
      await consuming;
    }
    const bad = batch({ invalid: true }, 3);
    await consumeWebhooks(bad.value, environment, fetcher, now);
    expect(bad.message.retry).toHaveBeenCalledWith({ delaySeconds: 120 });
    expect(JSON.parse(logged.mock.calls.at(-1)![0])).toMatchObject({
      operation: "webhook_consumer",
      event: "application_error",
    });
    expect(JSON.stringify(logged.mock.calls)).not.toContain("sensitive_unprinted_payload");
  } finally {
    logged.mockRestore();
  }
});

it("separa le ricevute Stripe live e test e non interroga il dominio eBay per Stripe", async () => {
  for (const live of [false, true]) {
    const body = JSON.stringify({
      id: `evt_${live}`,
      type: "checkout.session.completed",
      created: now.getTime() / 1000,
      livemode: live,
      data: { object: { id: "cs_synthetic" } },
    });
    const signature = await Stripe.webhooks.generateTestHeaderStringAsync({
      payload: body,
      secret: "whsec_fiscalbay_test",
    });
    const request = new Request("https://test.fiscalbay.it/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": signature },
      body,
    });
    expect(
      (
        await receive(request, {
          ...environment,
          APP_ORIGIN: live ? "https://fiscalbay.it" : "https://test.fiscalbay.it",
        })
      )?.status,
    ).toBe(204);
    const row = await env.DB.prepare(
      "SELECT id, environment FROM webhook_receipts WHERE provider_id = ?",
    )
      .bind(`evt_${live}`)
      .first<{ id: string; environment: string }>();
    expect(row?.environment).toBe(live ? "live" : "test");
    const queries = vi.spyOn(env.DB, "prepare");
    try {
      await consumeWebhooks(batch({ receiptId: row!.id }).value, environment, fetcher, now);
      expect(queries.mock.calls.some(([query]) => query.includes("ebay_store"))).toBe(false);
    } finally {
      queries.mockRestore();
    }
  }
  expect(
    (
      await receive(
        new Request("https://test.fiscalbay.it/webhooks/stripe", { method: "POST", body: "{}" }),
      )
    )?.status,
  ).toBe(412);
});

it("le chiavi scadono all'ora esatta e i recuperi usano credenziali e corpo OAuth applicativi", async () => {
  const request = ebayRequest(notification, "expiry-key");
  const body = await request.text();
  const signature = request.headers.get("x-ebay-signature")!;
  const at = now.getTime() + 5 * 3600000;
  await verifyEbayNotification(body, signature, environment, "production", fetcher, at);
  await verifyEbayNotification(body, signature, environment, "production", fetcher, at + 3599999);
  expect(fetcher.mock.calls.filter(([url]) => String(url).includes("/public_key/"))).toHaveLength(
    1,
  );
  await verifyEbayNotification(body, signature, environment, "production", fetcher, at + 3600000);
  expect(fetcher.mock.calls.filter(([url]) => String(url).includes("/public_key/"))).toHaveLength(
    2,
  );
  const lower = btoa(JSON.stringify({ ...JSON.parse(atob(signature)), alg: "ecdsa" }));
  await expect(
    verifyEbayNotification(body, lower, environment, "production", fetcher, at + 3600001),
  ).resolves.toMatchObject({
    notification: { notificationId: notification.notification.notificationId },
  });
});

it("il recupero delle chiavi limita anche i byte delle risposte del provider", async () => {
  const at = now.getTime() + 10 * 3600000;
  for (const tokenOversize of [true, false]) {
    const request = ebayRequest(notification, `size-key-${tokenOversize}`);
    const oversized = vi.fn<typeof fetch>(async (input) =>
      String(input).endsWith("/oauth2/token")
        ? Response.json({ access_token: "token", extra: "x".repeat(tokenOversize ? 16384 : 0) })
        : Response.json({ key: publicKey, extra: "x".repeat(8192) }),
    );
    await expect(
      verifyEbayNotification(
        await request.text(),
        request.headers.get("x-ebay-signature")!,
        environment,
        "production",
        oversized,
        at,
      ),
    ).rejects.toMatchObject({ failure: "invalid_response" });
    expect(oversized).toHaveBeenCalledTimes(tokenOversize ? 1 : 2);
  }
});

it("la cache delle chiavi conserva cento elementi ed elimina il più vecchio", async () => {
  const at = now.getTime() + 15 * 3600000;
  const headers: string[] = [];
  const body = JSON.stringify(notification);
  for (let i = 0; i < 100; i++) {
    const request = ebayRequest(notification, `capacity-${i}`);
    headers.push(request.headers.get("x-ebay-signature")!);
    await verifyEbayNotification(
      body,
      headers[i]!,
      environment,
      "production",
      fetcher,
      at + Math.floor(i / 10) * 60000,
    );
  }
  fetcher.mockClear();
  await verifyEbayNotification(
    body,
    headers[0]!,
    environment,
    "production",
    fetcher,
    at + 10 * 60000,
  );
  expect(fetcher).not.toHaveBeenCalled();
  const extra = ebayRequest(notification, "capacity-extra");
  await verifyEbayNotification(
    body,
    extra.headers.get("x-ebay-signature")!,
    environment,
    "production",
    fetcher,
    at + 10 * 60000,
  );
  fetcher.mockClear();
  await verifyEbayNotification(
    body,
    headers[0]!,
    environment,
    "production",
    fetcher,
    at + 10 * 60000,
  );
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it("i token challenge rispettano alfabeto e limiti del contratto eBay", async () => {
  const request = () => new Request("https://test.fiscalbay.it/webhooks/ebay?challenge_code=a");
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
  for (const token of [alphabet.slice(0, 32), (alphabet + alphabet).slice(0, 80)])
    expect(
      (await receive(request(), { ...environment, EBAY_NOTIFICATION_VERIFICATION_TOKEN: token }))
        ?.status,
    ).toBe(200);
  for (const token of [
    "a".repeat(31),
    "a".repeat(81),
    "!" + "a".repeat(32),
    "a".repeat(32) + "!",
    "ä".repeat(32),
  ])
    expect(
      (await receive(request(), { ...environment, EBAY_NOTIFICATION_VERIFICATION_TOKEN: token }))
        ?.status,
    ).toBe(503);
  for (let code = 32; code < 127; code++) {
    const character = String.fromCharCode(code);
    if (alphabet.includes(character)) continue;
    expect(
      (
        await receive(request(), {
          ...environment,
          EBAY_NOTIFICATION_VERIFICATION_TOKEN: "a".repeat(31) + character,
        })
      )?.status,
    ).toBe(503);
  }
});

it("una ricevuta conserva il retry anche se il rilascio della lease fallisce", async () => {
  await receive();
  const row = (await receipt())!;
  const original = env.DB.prepare.bind(env.DB);
  const failing = vi.spyOn(env.DB, "prepare").mockImplementation((query) =>
    query.startsWith("UPDATE webhook_receipts SET lease = NULL")
      ? ({
          bind: () => ({ run: () => Promise.reject(new Error("database_unavailable")) }),
        } as unknown as D1PreparedStatement)
      : original(query),
  );
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});
  const work = batch({ receiptId: row.id });
  try {
    await consumeWebhooks(
      work.value,
      environment,
      vi.fn<typeof fetch>(async () => new Response(null, { status: 503 })),
      now,
    );
    expect(work.message.retry).toHaveBeenCalledWith({ delaySeconds: 30 });
    expect(work.message.ack).not.toHaveBeenCalled();
    expect(logged).toHaveBeenCalledTimes(2);
    for (const [entry] of logged.mock.calls)
      expect(JSON.parse(entry)).toMatchObject({ operation: "webhook_consumer" });
    // Come negli altri moduli, il log porta il codice e il tipo dell'errore, mai il messaggio.
    expect(logged.mock.calls.map(([entry]) => JSON.parse(entry))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "INTERNAL_ERROR" }),
        expect.objectContaining({ code: "UPSTREAM_UNAVAILABLE", failure: "unavailable" }),
      ]),
    );
    expect(JSON.stringify(logged.mock.calls)).not.toContain("database_unavailable");
  } finally {
    failing.mockRestore();
    logged.mockRestore();
  }
});

it("la data canonica non cambia la deduplica quando eBay omette i millisecondi", async () => {
  await receive();
  const same = {
    ...notification,
    notification: { ...notification.notification, eventDate: "2026-10-11T12:00:00Z" },
  };
  expect((await receive(ebayRequest(same)))?.status).toBe(204);
  expect(send).toHaveBeenCalledTimes(1);
});

it("verifica una consegna di prova eBay reale e la conferma senza effetti", async () => {
  // Corpo, firma e chiave pubblica catturati da una consegna Sandbox: ECDSA SHA-256 sui byte ricevuti.
  const later = new Date(now.getTime() + 3_600_000);
  const real = vi.fn<typeof fetch>(async (input) =>
    String(input).includes("/public_key/")
      ? Response.json({ key: delivery.key })
      : Response.json({ access_token: "token-synthetic" }),
  );
  const request = (body = delivery.body) =>
    new Request("https://test.fiscalbay.it/webhooks/ebay", {
      method: "POST",
      headers: { "x-ebay-signature": delivery.signature, "content-type": "application/json" },
      body,
    });
  expect((await receiveWebhook(request(), environment, real, later))?.status).toBe(204);
  const altered = request(JSON.stringify(JSON.parse(delivery.body)));
  expect((await receiveWebhook(altered, environment, real, later))?.status).toBe(412);
  expect(send).not.toHaveBeenCalled();
  const { results } = await env.DB.prepare("SELECT id FROM webhook_receipts").all();
  expect(results).toEqual([]);
});

const revocation = {
  metadata: { topic: "AUTHORIZATION_REVOCATION", schemaVersion: "1.0", deprecated: false },
  notification: {
    notificationId: "revocation-synthetic",
    eventDate: now.toISOString(),
    publishDate: now.toISOString(),
    publishAttemptCount: 1,
    data: {
      username: "seller-name-synthetic",
      userId: "seller-synthetic",
      eiasToken: "eias-synthetic",
      revokeReason: "REVOKED_BY_USER",
      revocationDate: "2026-10-11T11:00:00.000Z",
    },
  },
};
const revokedBy = (data: Partial<typeof revocation.notification.data>) => ({
  ...revocation,
  notification: { ...revocation.notification, data: { ...revocation.notification.data, ...data } },
});

it("la revoca del consenso porta il negozio da ricollegare senza toccare i dati", async () => {
  expect((await receive(ebayRequest(revocation)))?.status).toBe(204);
  const row = await env.DB.prepare(
    "SELECT id, topic, object_id, store_id, consent_granted_at, event_at FROM webhook_receipts",
  ).first();
  expect(row).toMatchObject({
    topic: "AUTHORIZATION_REVOCATION",
    object_id: "seller-synthetic",
    store_id: "webhook-store",
    consent_granted_at: grantedAt,
    event_at: "2026-10-11T11:00:00.000Z",
  });
  expect(send).toHaveBeenCalledExactlyOnceWith({ receiptId: row?.id });
  const { message, value } = batch({ receiptId: row?.id });
  await consumeWebhooks(value, environment, fetcher, now);
  expect(message.ack).toHaveBeenCalledOnce();
  expect(
    await env.DB.prepare(
      "SELECT c.rejected_at, c.refresh_token IS NOT NULL AS kept, s.disconnected_at, s.data_deleted_at FROM ebay_store_credentials c JOIN ebay_stores s ON s.id = c.store_id",
    ).first(),
  ).toEqual({
    rejected_at: now.toISOString(),
    kept: 1,
    disconnected_at: null,
    data_deleted_at: null,
  });
  // Nessuna lettura eBay per conto del negozio: solo chiave pubblica e token dell'applicazione.
  expect(fetcher.mock.calls.every(([url]) => !String(url).includes("/sell/"))).toBe(true);
  expect((await receipt())?.completed_at).toBe(now.toISOString());
});

it("una revoca consegnata oltre i sette giorni porta comunque il negozio da ricollegare", async () => {
  const late = new Date(now.getTime() + 8 * 86_400_000);
  expect((await receiveWebhook(ebayRequest(revocation), environment, fetcher, late))?.status).toBe(
    204,
  );
  const row = await receipt();
  expect(await env.DB.prepare("SELECT expires_at FROM webhook_receipts").first("expires_at")).toBe(
    new Date(late.getTime() + 7 * 86_400_000).toISOString(),
  );
  const { message, value } = batch({ receiptId: row?.id });
  await consumeWebhooks(value, environment, fetcher, late);
  expect(message.ack).toHaveBeenCalledOnce();
  expect(
    await env.DB.prepare("SELECT rejected_at FROM ebay_store_credentials").first("rejected_at"),
  ).toBe(late.toISOString());
});

it("una revoca senza negozio attivo, anteriore al consenso o di prova non accoda nulla", async () => {
  for (const payload of [
    revokedBy({ userId: "other-seller" }),
    revokedBy({ revocationDate: "2026-10-09T12:00:00.000Z" }),
    revokedBy({ userId: undefined }),
    // Valori segnaposto di una consegna di prova.
    revokedBy({ userId: "" }),
  ])
    expect((await receive(ebayRequest(payload)))?.status).toBe(204);
  await env.DB.prepare("UPDATE ebay_store_credentials SET rejected_at = ?").bind(grantedAt).run();
  expect((await receive(ebayRequest(revocation)))?.status).toBe(204);
  expect(await receipt()).toBeNull();
  expect(send).not.toHaveBeenCalled();
});

it("una data della revoca in un altro formato vale, una illeggibile lascia la data dell'evento", async () => {
  expect(
    (await receive(ebayRequest(revokedBy({ revocationDate: "2026-10-11T13:00:00+02:00" }))))
      ?.status,
  ).toBe(204);
  expect(await env.DB.prepare("SELECT event_at FROM webhook_receipts").first("event_at")).toBe(
    "2026-10-11T11:00:00.000Z",
  );
  await env.DB.prepare("DELETE FROM webhook_receipts").run();
  expect(
    (
      await receive(
        ebayRequest({
          ...revokedBy({ revocationDate: "string" }),
          notification: {
            ...revokedBy({ revocationDate: "string" }).notification,
            notificationId: "revocation-placeholder",
          },
        }),
      )
    )?.status,
  ).toBe(204);
  expect(await env.DB.prepare("SELECT event_at FROM webhook_receipts").first("event_at")).toBe(
    now.toISOString(),
  );
});

it("il 412 di una consegna firmata registra soltanto il motivo, le sonde nulla", async () => {
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const malformed = ebayRequest();
    malformed.headers.set("x-ebay-signature", "invalid");
    expect((await receive(malformed))?.status).toBe(412);
    const altered = ebayRequest();
    const body = await altered.text();
    expect(
      (
        await receive(
          new Request(altered.url, { method: "POST", headers: altered.headers, body: body + " " }),
        )
      )?.status,
    ).toBe(412);
    expect(
      (
        await receive(
          ebayRequest({ ...notification, metadata: { topic: "OTHER", schemaVersion: "1.0" } }),
        )
      )?.status,
    ).toBe(412);
    const logged = errors.mock.calls.map(([line]) => JSON.parse(String(line)));
    expect(logged).toEqual(
      ["signature", "schema"].map((failure) => ({
        event: "application_error",
        code: "INVALID_REQUEST",
        operation: "webhook_ingress",
        failure,
        status: 412,
      })),
    );
    expect(JSON.stringify(logged)).not.toContain(notification.notification.notificationId);
  } finally {
    errors.mockRestore();
  }
});

const threshold = (status: "WARNING" | "REACHED") => ({
  metadata: { topic: "BULK_DATA_TRANSFER_THRESHOLD", schemaVersion: "1.0" },
  notification: {
    notificationId: `threshold-${status}`,
    eventDate: now.toISOString(),
    data: {
      policyFramework: "BULK_DATA_TRANSFER_POLICY",
      policyVersion: "1.0",
      region: "US",
      metricType: "USER",
      window: {
        aggregationWindowStart: "2026-10-01T00:00:00Z",
        aggregationWindowEnd: "2026-10-31T00:00:00Z",
      },
      metricData: [
        {
          metricDataType: "PersonalFinancialData",
          thresholdLimit: 1000,
          currentCount: status === "REACHED" ? 1000 : 800,
          thresholdStatus: status,
          previousThresholdStatus: "NORMAL",
          thresholdPercentage: status === "REACHED" ? 100 : 80,
          apiElements: [{ apiContext: "Sell", apiName: "Finances", apiOperations: ["getPayout"] }],
        },
      ],
    },
  },
});

it("la soglia Bulk Data Transfer apre un'anomalia della console fino alla fine della finestra", async () => {
  expect((await receive(ebayRequest(threshold("WARNING"))))?.status).toBe(204);
  expect((await receive(ebayRequest(threshold("REACHED"))))?.status).toBe(204);
  expect((await receive(ebayRequest(threshold("REACHED"))))?.status).toBe(204);
  // Un avviso ritentato da eBay dopo la soglia raggiunta non abbassa gravità e conteggio.
  expect((await receive(ebayRequest(threshold("WARNING"))))?.status).toBe(204);
  expect(await receipt()).toBeNull();
  expect(send).not.toHaveBeenCalled();
  const { results } = await env.DB.prepare(
    "SELECT key, severity, json_extract(detail, '$.share') AS share, resolved_at FROM admin_anomalies",
  ).all();
  expect(results).toEqual([
    {
      key: "ebay_bulk_data:production:US:PersonalFinancialData:2026-10-01T00:00:00.000Z",
      severity: "p1",
      share: 1,
      resolved_at: "2026-10-31T00:00:00.000Z",
    },
  ]);
  expect(
    (await listAnomalies(env.DB, now)).filter((anomaly) => anomaly.kind === "ebay_bulk_data"),
  ).toMatchObject([
    { severity: "p1", subjects: [{ id: "production:US:PersonalFinancialData", href: "quote" }] },
  ]);
  expect(await bulkDataAnomalies(env.DB, now)).toMatchObject([
    {
      severity: "p1",
      subject: "production:US:PersonalFinancialData",
      share: 1,
      until: "2026-10-31T00:00:00.000Z",
    },
  ]);
  const closed = (await listAnomalies(env.DB, new Date("2026-10-31T00:00:00.000Z"))).filter(
    (anomaly) => anomaly.kind === "ebay_bulk_data",
  );
  expect(closed).toEqual([]);
  // Con il database guasto risponde 503, così eBay ritenta.
  const failing = vi
    .spyOn(env.DB, "batch")
    .mockRejectedValueOnce(new Error("database_unavailable"));
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});
  expect((await receive(ebayRequest(threshold("REACHED"))))?.status).toBe(503);
  expect(logged).toHaveBeenCalledTimes(1);
  failing.mockRestore();
  logged.mockRestore();
  // Una soglia senza metriche non è un avviso valido.
  const empty = threshold("WARNING");
  empty.notification.data.metricData = [];
  expect((await receive(ebayRequest(empty)))?.status).toBe(412);
  // Registrata comunque, si conclude senza scrivere: un batch D1 vuoto non terminerebbe.
  await env.DB.prepare("DELETE FROM admin_anomalies").run();
  await recordBulkDataThreshold(
    env.DB,
    "production",
    empty.notification.data as Parameters<typeof recordBulkDataThreshold>[2],
    now,
  );
  expect(await env.DB.prepare("SELECT count(*) AS n FROM admin_anomalies").first("n")).toBe(0);
});

const accountDeletion = (data: { userId: string; eiasToken?: string; username?: string }) => ({
  metadata: { topic: "MARKETPLACE_ACCOUNT_DELETION", schemaVersion: "1.0", deprecated: false },
  notification: {
    notificationId: `deletion-${data.userId}`,
    eventDate: now.toISOString(),
    publishDate: now.toISOString(),
    publishAttemptCount: 1,
    data,
  },
});
const deletions = () =>
  env.DB.prepare(
    "SELECT id, ebay_environment, ebay_user_id, eias_token, username, notified_at, completed_at FROM ebay_account_deletions",
  ).all();

it("la cancellazione di un utente eBay sconosciuto risponde 204 senza lasciare traccia", async () => {
  const payload = accountDeletion({
    userId: "unknown-user",
    eiasToken: "eias-unknown",
    username: "unknown-name",
  });
  expect((await receive(ebayRequest(payload)))?.status).toBe(204);
  // Anche oltre la finestra delle ricevute: eBay ritenta la stessa notifica per giorni.
  expect(
    (
      await receiveWebhook(
        ebayRequest(payload),
        environment,
        fetcher,
        new Date(now.getTime() + 30 * 86_400_000),
      )
    )?.status,
  ).toBe(204);
  expect((await deletions()).results).toEqual([]);
  expect(await receipt()).toBeNull();
  expect(send).not.toHaveBeenCalled();
});

it("registra e accoda una sola volta la cancellazione di un venditore noto, anche se tardiva", async () => {
  const payload = accountDeletion({
    userId: "seller-synthetic",
    eiasToken: "eias-seller",
    username: "seller-name",
  });
  const later = new Date(now.getTime() + 10 * 86_400_000);
  expect((await receiveWebhook(ebayRequest(payload), environment, fetcher, later))?.status).toBe(
    204,
  );
  expect((await receiveWebhook(ebayRequest(payload), environment, fetcher, later))?.status).toBe(
    204,
  );
  const { results } = await deletions();
  expect(results).toEqual([
    {
      id: expect.any(String),
      ebay_environment: "production",
      ebay_user_id: "seller-synthetic",
      eias_token: "eias-seller",
      username: "seller-name",
      notified_at: now.toISOString(),
      completed_at: null,
    },
  ]);
  expect(send.mock.calls).toEqual([
    [{ ebayAccountDeletion: results[0]!.id }],
    [{ ebayAccountDeletion: results[0]!.id }],
  ]);
  // Nessuna ricevuta: la cancellazione ha una richiesta propria e non scade dopo sette giorni.
  expect(await receipt()).toBeNull();
});

it("una coda non disponibile risponde 503 e il compito periodico conclude la cancellazione", async () => {
  send.mockRejectedValueOnce(new Error("queue_unavailable"));
  const payload = accountDeletion({ userId: "seller-synthetic" });
  expect((await receive(ebayRequest(payload)))?.status).toBe(503);
  expect((await deletions()).results).toMatchObject([{ completed_at: null }]);
  await resumeEbayAccountDeletions(environment, now);
  expect((await deletions()).results).toMatchObject([{ completed_at: now.toISOString() }]);
  expect(
    await env.DB.prepare(
      "SELECT ebay_user_id, ebay_account_id, data_deleted_at FROM ebay_stores WHERE id = 'webhook-store'",
    ).first(),
  ).toEqual({
    ebay_user_id: "webhook-store",
    ebay_account_id: null,
    data_deleted_at: now.toISOString(),
  });
  // eBay ritenta la consegna: l'utente non è più noto e nulla riparte.
  expect((await receive(ebayRequest(payload)))?.status).toBe(204);
  expect(send).toHaveBeenCalledOnce();
  expect((await deletions()).results).toMatchObject([{ completed_at: now.toISOString() }]);
});

it("una cancellazione con firma o schema non validi non registra nulla", async () => {
  const valid = ebayRequest(accountDeletion({ userId: "seller-synthetic" }));
  const altered = new Request(valid.url, {
    method: "POST",
    headers: valid.headers,
    body: JSON.stringify(accountDeletion({ userId: "webhook-store" })),
  });
  expect((await receive(altered))?.status).toBe(412);
  for (const data of [{ userId: "" }, { userId: "seller-synthetic", eiasToken: "x".repeat(257) }])
    expect((await receive(ebayRequest(accountDeletion(data as { userId: string }))))?.status).toBe(
      412,
    );
  expect((await deletions()).results).toEqual([]);
  expect(send).not.toHaveBeenCalled();
});

it("l'ordine di un acquirente cancellato da eBay non ritorna con una nuova conferma", async () => {
  await acquire(fetcher);
  await env.DB.prepare("UPDATE orders SET buyer_eias_token = 'eias-buyer'").run();
  expect(
    (
      await receive(
        ebayRequest(accountDeletion({ userId: "buyer-synthetic", eiasToken: "eias-buyer" })),
      )
    )?.status,
  ).toBe(204);
  const { results } = await deletions();
  expect(await runEbayAccountDeletion(environment, String(results[0]!.id), now)).toBe("done");
  expect((await env.DB.prepare("SELECT id FROM orders").all()).results).toEqual([]);
  // Una nuova conferma dello stesso ordine, anche già in coda, non lo importa di nuovo.
  const again = {
    ...notification,
    notification: { ...notification.notification, notificationId: "again" },
  };
  expect((await receive(ebayRequest(again)))?.status).toBe(204);
  const work = batch({ receiptId: (await receipt())!.id });
  await consumeWebhooks(work.value, environment, fetcher, now);
  expect(work.message.ack).toHaveBeenCalledOnce();
  expect((await env.DB.prepare("SELECT id FROM orders").all()).results).toEqual([]);
  // Il negozio resta collegato: la cancellazione riguarda soltanto l'acquirente.
  expect(
    await env.DB.prepare("SELECT ebay_account_id, data_deleted_at FROM ebay_stores").first(),
  ).toEqual({ ebay_account_id: "seller-synthetic", data_deleted_at: null });
});

it("limita le consegne per origine prima di leggere il corpo, con memoria limitata", async () => {
  const empty = (origin: string, at = now) =>
    receiveWebhook(
      new Request("https://test.fiscalbay.it/webhooks/ebay", {
        method: "POST",
        headers: { "cf-connecting-ip": origin, "content-length": "0" },
      }),
      environment,
      fetcher,
      at,
    );
  const start = new Date(now.getTime() + 3_600_000);
  for (let i = 0; i < 600; i++) expect((await empty("192.0.2.1", start))?.status).toBe(400);
  expect((await empty("192.0.2.1", start))?.status).toBe(429);
  expect((await empty("192.0.2.2", start))?.status).toBe(400);
  // Stripe e Telegram non condividono il limite dell'ingresso eBay.
  expect(
    (
      await receiveWebhook(
        new Request("https://test.fiscalbay.it/webhooks/stripe", {
          method: "POST",
          headers: { "cf-connecting-ip": "192.0.2.1" },
        }),
        environment,
        fetcher,
        start,
      )
    )?.status,
  ).not.toBe(429);
  expect((await empty("192.0.2.1", new Date(start.getTime() + 59_999)))?.status).toBe(429);
  expect((await empty("192.0.2.1", new Date(start.getTime() + 60_000)))?.status).toBe(400);

  // Oltre mille origini la meno recente esce dal conteggio e ricomincia.
  const at = start.getTime() + 120_000;
  for (let i = 0; i < 600; i++) admitOrigin("198.51.100.1", at);
  expect(() => admitOrigin("198.51.100.1", at)).toThrow(NotificationLimit);
  for (let i = 0; i < 999; i++) admitOrigin(`203.0.113.${i}`, at);
  expect(() => admitOrigin("198.51.100.1", at)).toThrow(NotificationLimit);
  admitOrigin("203.0.114.1", at);
  expect(() => admitOrigin("198.51.100.1", at)).not.toThrow();
});

it("un'origine che riparte con una nuova finestra diventa la più recente", () => {
  // Mille origini scadute sostituiscono quelle rimaste dalle altre prove.
  const start = Date.parse("2027-01-01T00:00:00.000Z");
  for (let i = 0; i < 1000; i++) admitOrigin(`198.18.0.${i}`, start - 120_000);
  admitOrigin("198.18.1.1", start);
  admitOrigin("198.18.1.2", start + 1);
  // La prima origine riparte e raggiunge il limite: altre 999 origini fanno uscire le scadute e
  // la seconda, non la prima, che resta al limite.
  for (let i = 0; i < 600; i++) admitOrigin("198.18.1.1", start + 60_000);
  for (let i = 0; i < 999; i++) admitOrigin(`198.18.2.${i}`, start + 60_001);
  expect(() => admitOrigin("198.18.1.1", start + 60_002)).toThrow(NotificationLimit);
});

it("accetta la firma SHA-1 delle notifiche di cancellazione dichiarata dalla chiave di eBay", async () => {
  const signed = (payload: object, digest: "SHA1" | "sha1" | "SHA256", kid: string) => {
    const body = JSON.stringify(payload);
    const signature = sign(
      digest.toLowerCase() === "sha1" ? "sha1" : "sha256",
      Buffer.from(body),
      pair.privateKey,
    ).toString("base64");
    return new Request("https://test.fiscalbay.it/webhooks/ebay", {
      method: "POST",
      headers: {
        "x-ebay-signature": btoa(JSON.stringify({ alg: "ecdsa", kid, signature, digest })),
      },
      body,
    });
  };
  const sha1Key = vi.fn<typeof fetch>(async (input, init) =>
    String(input).includes("/public_key/")
      ? Response.json({
          algorithm: "ECDSA",
          digest: "SHA1",
          key: publicKey.replaceAll("\n", ""),
        })
      : fetcher(input, init),
  );
  const payload = accountDeletion({ userId: "seller-synthetic", eiasToken: "eias-seller" });
  expect(
    (await receiveWebhook(signed(payload, "SHA1", "sha1-key"), environment, sha1Key, now))?.status,
  ).toBe(204);
  expect((await deletions()).results).toHaveLength(1);
  // Il digest dell'header vale in maiuscolo e in minuscolo.
  expect(
    (await receiveWebhook(signed(payload, "sha1", "sha1-key"), environment, sha1Key, now))?.status,
  ).toBe(204);
  // La chiave dichiara SHA-1: un header con un altro digest, anche firmato, non vale.
  expect(
    (await receiveWebhook(signed(payload, "SHA256", "sha1-key"), environment, sha1Key, now))
      ?.status,
  ).toBe(412);
  const mismatch = signed(payload, "SHA256", "sha1-key");
  await expect(
    verifyEbayNotification(
      await mismatch.text(),
      mismatch.headers.get("x-ebay-signature"),
      environment,
      "production",
      sha1Key,
      now.getTime(),
    ),
  ).rejects.toMatchObject({ failure: "signature" });
  // Una firma SHA-1 senza il digest dichiarato dalla chiave segue l'header.
  expect(
    (await receiveWebhook(signed(payload, "SHA1", "plain-key"), environment, fetcher, now))?.status,
  ).toBe(204);
});
