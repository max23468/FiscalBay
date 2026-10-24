import { env } from "cloudflare:workers";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import Stripe from "stripe";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  receiveWebhook,
  consumeWebhooks,
  recoverWebhookIngress,
} from "../app/integrations/webhooks.server";
import { verifyOrderNotification } from "../app/integrations/ebay/notifications.server";
import { sealToken } from "../app/integrations/ebay/seller-credentials.server";
import { purgeExpiredRecords } from "../app/domain/maintenance.server";
import worker from "../workers/app";
import { acquireOrders, consumeOrderConfirmation } from "../app/domain/order-acquisition.server";
import { ebayConfiguration } from "../app/integrations/ebay/environment.server";
import delivery from "./fixtures/ebay-order-notification.json";

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
const send = vi.fn<Queue["send"]>().mockResolvedValue(undefined);
const environment = {
  ...env,
  APP_ORIGIN: "https://test.fiscalbay.it",
  WORK_QUEUE: { send },
} as Env;
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
function ebayRequest(payload = notification, kid = "synthetic-key") {
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
    await verifyOrderNotification(
      body,
      signature,
      environment,
      "production",
      fetcher,
      now.getTime(),
    ),
  ).toEqual(notification.notification);
  expect(send).not.toHaveBeenCalled();
  for (const invalid of ["", "x".repeat(2049)]) {
    await expect(
      verifyOrderNotification(body, invalid, environment, "production", fetcher, now.getTime()),
    ).rejects.toThrow();
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
    EBAY_SANDBOX_ENABLED: "false",
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
  vi.setSystemTime(now);
  vi.clearAllMocks();
  router.create.mockReturnValue(router.handle);
  send.mockResolvedValue(undefined);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM webhook_receipts"),
    env.DB.prepare("DELETE FROM ebay_rate_limits"),
    env.DB.prepare("DELETE FROM ebay_stores"),
    env.DB.prepare("DELETE FROM workspaces WHERE id = 'webhook-workspace'"),
    env.DB.prepare(
      "INSERT INTO workspaces (id, name, created_at) VALUES ('webhook-workspace', 'Sintetico', ?)",
    ).bind(grantedAt),
    env.DB.prepare(
      "INSERT INTO ebay_stores (id, workspace_id, ebay_user_id, ebay_account_id, linked_at) VALUES ('webhook-store', 'webhook-workspace', 'seller-synthetic', 'seller-synthetic', ?)",
    ).bind(grantedAt),
  ]);
  await env.DB.prepare(`INSERT INTO ebay_store_credentials (store_id, access_token, access_expires_at, refresh_token, refresh_expires_at, granted_at)
    VALUES ('webhook-store', ?, '2026-10-12T12:00:00.000Z', 'r', '2027-10-12T12:00:00.000Z', ?)`)
    .bind(
      await sealToken(env.BETTER_AUTH_SECRET, "webhook-store", "access", "access-synthetic"),
      grantedAt,
    )
    .run();
});

afterEach(() => vi.useRealTimers());

it("la coda smista richieste di sincronizzazione, compiti e riferimenti dei webhook", async () => {
  const sync = { body: { syncStore: "webhook-store" }, ack: vi.fn(), retry: vi.fn(), attempts: 1 };
  const webhook = { body: { receiptId: "non-valido" }, ack: vi.fn(), retry: vi.fn(), attempts: 1 };
  const task = {
    body: { task: "maintenance", slot: "2026-10-12T00:00:00.000Z" },
    ack: vi.fn(),
    retry: vi.fn(),
    attempts: 1,
  };
  const unknown = { body: { altro: true }, ack: vi.fn(), retry: vi.fn(), attempts: 1 };
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    await worker.queue(
      { messages: [sync, webhook, task, unknown] } as unknown as MessageBatch<unknown>,
      environment,
      {} as ExecutionContext,
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
      await worker.fetch(
        new Request("https://test.fiscalbay.it/webhooks/stripe", { method: "PUT" }),
        environment,
      )
    )?.status,
  ).toBe(405);
  expect(
    (
      await worker.fetch(
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
  ["https://fiscalbay.it", "/en/privacy", null, undefined],
  ["https://fiscalbay.it", "/app/ordini", "noindex, nofollow", "synthetic-version"],
  ["https://fiscalbay.it", "/", null, "synthetic-version"],
])(
  "il Worker inoltra la richiesta e applica gli header per %s%s",
  async (origin, path, robots, version) => {
    router.handle.mockResolvedValue(new Response("pagina sintetica", { status: 201 }));
    const response = await worker.fetch(
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

it("il Worker conserva cache e redirect dichiarati dal router anche con header immutabili", async () => {
  router.handle.mockResolvedValue(Response.redirect("https://test.fiscalbay.it/accesso", 303));
  const request = new Request("https://test.fiscalbay.it/app/ordini");
  const redirect = await worker.fetch(request, environment);
  expect(redirect.status).toBe(303);
  expect(redirect.headers.get("location")).toBe("https://test.fiscalbay.it/accesso");
  expect(redirect.headers.get("cache-control")).toBe("no-store");
  router.handle.mockResolvedValue(
    new Response("pubblico", {
      headers: { "cache-control": "public, max-age=60" },
    }),
  );
  expect((await worker.fetch(request, environment)).headers.get("cache-control")).toBe(
    "public, max-age=60",
  );
});

it("il Worker risponde all'errore del router con 500 correlato e senza dettagli riservati", async () => {
  router.handle.mockRejectedValue(new Error("NON-ESPORRE"));
  const response = await worker.fetch(
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
  await worker.queue(
    { messages: [sync] } as unknown as MessageBatch<unknown>,
    environment,
    {} as ExecutionContext,
  );
  expect(sync.ack).toHaveBeenCalledOnce();
  expect(sync.retry).not.toHaveBeenCalled();
  await worker.queue(
    { messages: [] } as unknown as MessageBatch<unknown>,
    environment,
    {} as ExecutionContext,
  );
  expect(send).not.toHaveBeenCalled();
});

it("il cron del Worker accoda i turni dell'orario pianificato, anche se eseguito in ritardo", async () => {
  await env.DB.prepare("DELETE FROM scheduled_tasks").run();
  const sendBatch = vi.fn<Queue["sendBatch"]>().mockResolvedValue(undefined);
  await worker.scheduled(
    { scheduledTime: now.getTime() } as ScheduledController,
    { ...environment, WORK_QUEUE: { send, sendBatch } } as Env,
    {} as ExecutionContext,
  );
  expect(sendBatch).toHaveBeenNthCalledWith(1, [
    { body: { task: "maintenance", slot: "2026-10-11T00:00:00.000Z" } },
    { body: { task: "token_refresh", slot: now.toISOString() } },
  ]);
  expect(sendBatch).toHaveBeenNthCalledWith(2, [{ body: { syncStore: "webhook-store" } }]);
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

it("rifiuta firma, schema, identità, ambiente e data non validi senza claim", async () => {
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
      409,
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
      409,
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
      await env.DB.prepare("INSERT INTO ebay_store_pauses VALUES ('webhook-store', 'manual', ?)")
        .bind(now.toISOString())
        .run();
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

it("prende in carico Stripe con firma valida senza anticipare gli effetti commerciali", async () => {
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
  const work = batch({ receiptId: (await receipt())!.id });
  await consumeWebhooks(work.value, environment, fetcher, now);
  expect(work.message.ack).toHaveBeenCalledOnce();
  expect(fetcher).not.toHaveBeenCalled();
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
    verifyOrderNotification(
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
      "INSERT INTO ebay_store_credentials SELECT 'other-store', access_token, access_expires_at, refresh_token, refresh_expires_at, granted_at, refreshed_at, rejected_at FROM ebay_store_credentials WHERE store_id = 'webhook-store'",
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
  await verifyOrderNotification(body, signature, environment, "production", fetcher, at);
  await verifyOrderNotification(body, signature, environment, "production", fetcher, at + 3599999);
  expect(fetcher.mock.calls.filter(([url]) => String(url).includes("/public_key/"))).toHaveLength(
    1,
  );
  await verifyOrderNotification(body, signature, environment, "production", fetcher, at + 3600000);
  expect(fetcher.mock.calls.filter(([url]) => String(url).includes("/public_key/"))).toHaveLength(
    2,
  );
  const lower = btoa(JSON.stringify({ ...JSON.parse(atob(signature)), alg: "ecdsa" }));
  await expect(
    verifyOrderNotification(body, lower, environment, "production", fetcher, at + 3600001),
  ).resolves.toMatchObject({ notificationId: notification.notification.notificationId });
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
      verifyOrderNotification(
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
    await verifyOrderNotification(
      body,
      headers[i]!,
      environment,
      "production",
      fetcher,
      at + Math.floor(i / 10) * 60000,
    );
  }
  fetcher.mockClear();
  await verifyOrderNotification(
    body,
    headers[0]!,
    environment,
    "production",
    fetcher,
    at + 10 * 60000,
  );
  expect(fetcher).not.toHaveBeenCalled();
  const extra = ebayRequest(notification, "capacity-extra");
  await verifyOrderNotification(
    body,
    extra.headers.get("x-ebay-signature")!,
    environment,
    "production",
    fetcher,
    at + 10 * 60000,
  );
  fetcher.mockClear();
  await verifyOrderNotification(
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
