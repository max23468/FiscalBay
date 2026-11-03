import { env } from "cloudflare:workers";

import { generateKeyPairSync, sign } from "node:crypto";

import { afterEach, beforeEach, expect, vi } from "vitest";

import { receiveWebhook } from "../../app/webhooks.server";

import { sealToken } from "../../app/integrations/ebay/seller-credentials.server";

import worker from "../../workers/app";

import { acquireOrders } from "../../app/domain/order-acquisition.server";

import { ebayConfiguration } from "../../app/integrations/ebay/environment.server";

import { fakeQueue, queued } from "./queue-fixture";

import { insertCredentials, insertWorkspace, resetDatabase } from "./database-fixtures";

export const now = new Date("2026-10-11T12:00:00.000Z");

export const grantedAt = "2026-10-10T12:00:00.000Z";

export const pair = generateKeyPairSync("ec", { namedCurve: "prime256v1" });

export const publicKey = pair.publicKey.export({ type: "spki", format: "pem" }).toString();

export const notification = {
  metadata: { topic: "ORDER_CONFIRMATION", schemaVersion: "1.0" },
  notification: {
    notificationId: "notification-synthetic",
    eventDate: now.toISOString(),
    data: { user: { userId: "seller-synthetic" }, order: { orderId: "12-00000-00001" } },
  },
};

export const order = {
  orderId: "12-00000-00001",
  creationDate: now.toISOString(),
  lastModifiedDate: now.toISOString(),
  pricingSummary: { total: { value: "12.5", currency: "EUR" } },
  orderPaymentStatus: "PAID",
  orderFulfillmentStatus: "NOT_STARTED",
  lineItems: [{ lineItemId: "line-synthetic", title: "Articolo sintetico", quantity: 1 }],
};

export const send = vi.fn<Queue["send"]>().mockResolvedValue(queued);

export const environment: Env = {
  ...env,
  APP_ORIGIN: "https://test.fiscalbay.it",
  WORK_QUEUE: fakeQueue({ send }),
  INGRESS_QUEUE: fakeQueue({ send }),
};

/** Richiesta al Worker come la consegna Cloudflare; il contesto serve solo alla build. */
export const workerFetch = (request: Request, target: Env) =>
  worker.fetch(request as Parameters<typeof worker.fetch>[0], target, {} as ExecutionContext);

export const fetcher = vi.fn<typeof fetch>(async (input, init) => {
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

export function ebayRequest(payload: object = notification, kid = "synthetic-key") {
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

export async function receive(request = ebayRequest(), target = environment) {
  return receiveWebhook(request, target, fetcher, now);
}

export function batch(
  body: unknown,
  attempts = 1,
): {
  message: {
    body: unknown;
    ack: import("vitest").Mock<() => void>;
    retry: import("vitest").Mock<() => void>;
    attempts: number;
  };
  value: MessageBatch<unknown>;
} {
  const ack = vi.fn();
  const retry = vi.fn();
  return {
    message: { body, ack, retry, attempts },
    value: { messages: [{ body, ack, retry, attempts }] } as unknown as MessageBatch<unknown>,
  };
}

export function acquire(fetcher: typeof fetch, calls = 12) {
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

/** D1 fittizio che annota inizio e fine di ogni istruzione, per provare il guscio del registro. */
export function recordingDatabase() {
  const calls: string[] = [];
  const statements: object[] = [];
  const statement = (sql: string) => ({
    statement: sql,
    bind: () => statement(sql),
    run: async () => {
      calls.push(sql);
      for (let tick = 0; tick < 20; tick += 1) await Promise.resolve();
      calls.push(`fine ${sql}`);
      return { meta: { changes: 1 } };
    },
  });
  const batch = vi.fn(async (queries: object[]) => queries);
  const exec = vi.fn(async () => ({ count: 1, duration: 0 }));
  const db = {
    prepare(sql: string) {
      const prepared = statement(sql);
      statements.push(prepared);
      return prepared;
    },
    batch,
    exec,
  };
  return { db: db as unknown as D1Database, calls, statements, batch, exec };
}

export async function receipt() {
  return env.DB.prepare("SELECT * FROM webhook_receipts").first<{
    id: string;
    queued_at: string | null;
    completed_at: string | null;
    lease: string | null;
  }>();
}

export const revocation = {
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

export const revokedBy = (data: Partial<typeof revocation.notification.data>) => ({
  ...revocation,
  notification: { ...revocation.notification, data: { ...revocation.notification.data, ...data } },
});

export const threshold = (status: "WARNING" | "REACHED") => ({
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

export const accountDeletion = (data: {
  userId: string;
  eiasToken?: string;
  username?: string;
}) => ({
  metadata: { topic: "MARKETPLACE_ACCOUNT_DELETION", schemaVersion: "1.0", deprecated: false },
  notification: {
    notificationId: `deletion-${data.userId}`,
    eventDate: now.toISOString(),
    publishDate: now.toISOString(),
    publishAttemptCount: 1,
    data,
  },
});

export const deletions = () =>
  env.DB.prepare(
    "SELECT id, ebay_environment, ebay_user_id, eias_token, username, notified_at, completed_at FROM ebay_account_deletions",
  ).all();

export function setupScenarios(router: {
  create: ReturnType<typeof vi.fn>;
  handle: ReturnType<typeof vi.fn>;
}) {
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
}
