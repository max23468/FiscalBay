import { z } from "zod";

import {
  mapTradingTaxIdentifiers,
  parseTradingOrderTaxIdentifiers,
} from "./ebay-tax-identifiers.server";

// Il collegamento del negozio non chiede l'email: resta separato dal login eBay.
export const ebayStoreScopes = [
  "https://api.ebay.com/oauth/api_scope",
  "https://api.ebay.com/oauth/api_scope/commerce.identity.readonly",
  "https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly",
] as const;

const linkSessionTtlMilliseconds = 10 * 60 * 1000;
const tradingApiVersion = "1455";
const tradingSiteId = "101";

const tokenSchema = z.looseObject({ access_token: z.string().min(1) });
const identitySchema = z.looseObject({ userId: z.string().min(1) });
const orderSchema = z.looseObject({
  orderId: z.string().min(1),
  creationDate: z.string().datetime(),
  lastModifiedDate: z.string().datetime(),
  pricingSummary: z.looseObject({
    total: z.looseObject({
      value: z.string().regex(/^\d+(\.\d{1,2})?$/u),
      currency: z.string().length(3),
    }),
  }),
});
const ordersPageSchema = z.looseObject({ orders: z.array(orderSchema).default([]) });

export type StoreLinkSession = { userId: string; codeVerifier: string; expired: boolean };
export type StoreLinkOutcome = "collegato" | "negato" | "altro-spazio" | "errore";

function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

function randomToken(): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)));
}

function toMinor(value: string): number {
  const [units, decimals = ""] = value.split(".");
  return Number(units) * 100 + Number(decimals.padEnd(2, "0"));
}

export async function startStoreLink(
  environment: Env,
  userId: string,
  now = new Date(),
): Promise<string> {
  const state = randomToken();
  const codeVerifier = randomToken();
  const challenge = base64Url(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier))),
  );
  await environment.DB.batch([
    environment.DB.prepare("DELETE FROM ebay_store_link_sessions WHERE expires_at <= ?").bind(
      now.toISOString(),
    ),
    environment.DB.prepare(
      `INSERT INTO ebay_store_link_sessions (state, user_id, code_verifier, expires_at)
       VALUES (?, ?, ?, ?)`,
    ).bind(
      state,
      userId,
      codeVerifier,
      new Date(now.getTime() + linkSessionTtlMilliseconds).toISOString(),
    ),
  ]);

  const url = new URL("https://auth.ebay.com/oauth2/authorize");
  url.search = new URLSearchParams({
    client_id: environment.EBAY_CLIENT_ID,
    redirect_uri: environment.EBAY_RUNAME,
    response_type: "code",
    scope: ebayStoreScopes.join(" "),
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();
  return url.toString();
}

// Consuma lo state una sola volta; null indica un callback che non appartiene al collegamento negozio.
export async function takeStoreLinkSession(
  db: D1Database,
  state: string,
  now = new Date(),
): Promise<StoreLinkSession | null> {
  const row = await db
    .prepare(
      `DELETE FROM ebay_store_link_sessions WHERE state = ?
       RETURNING user_id, code_verifier, expires_at`,
    )
    .bind(state)
    .first<{ user_id: string; code_verifier: string; expires_at: string }>();
  if (!row) return null;
  return {
    userId: row.user_id,
    codeVerifier: row.code_verifier,
    expired: row.expires_at <= now.toISOString(),
  };
}

async function ebayJson(fetcher: typeof fetch, url: string, init: RequestInit): Promise<unknown> {
  const response = await fetcher(url, init);
  if (!response.ok) throw new Error(`ebay_http_${response.status}`);
  return response.json();
}

async function workspaceFor(db: D1Database, userId: string, now: string): Promise<string> {
  const existing = await db
    .prepare(
      "SELECT workspace_id FROM workspace_members WHERE user_id = ? ORDER BY workspace_id LIMIT 1",
    )
    .bind(userId)
    .first<{ workspace_id: string }>();
  if (existing) return existing.workspace_id;

  const workspaceId = crypto.randomUUID();
  await db.batch([
    db
      .prepare("INSERT INTO workspaces (id, name, created_at) VALUES (?, 'Spazio personale', ?)")
      .bind(workspaceId, now),
    db
      .prepare("INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, 'owner')")
      .bind(workspaceId, userId),
  ]);
  return workspaceId;
}

export async function completeStoreLink(input: {
  environment: Env;
  link: StoreLinkSession;
  sessionUserId: string | null;
  search: URLSearchParams;
  fetcher: typeof fetch;
  now?: Date;
}): Promise<StoreLinkOutcome> {
  const { environment, link, search, fetcher } = input;
  if (link.expired || input.sessionUserId !== link.userId) return "errore";
  if (search.has("error")) return "negato";

  const now = (input.now ?? new Date()).toISOString();
  const token = tokenSchema.parse(
    await ebayJson(fetcher, "https://api.ebay.com/identity/v1/oauth2/token", {
      method: "POST",
      headers: {
        authorization: `Basic ${btoa(`${environment.EBAY_CLIENT_ID}:${environment.EBAY_CLIENT_SECRET}`)}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: search.get("code")!,
        redirect_uri: environment.EBAY_RUNAME,
        code_verifier: link.codeVerifier,
      }),
    }),
  );
  return importStoreOrders({
    db: environment.DB,
    userId: link.userId,
    accessToken: token.access_token,
    fetcher,
    now,
  });
}

// Collega il negozio al primo spazio dell'utente e importa l'ordine più recente con la fonte fiscale.
export async function importStoreOrders(input: {
  db: D1Database;
  userId: string;
  accessToken: string;
  fetcher: typeof fetch;
  now: string;
}): Promise<"collegato" | "altro-spazio"> {
  const { db, fetcher, now } = input;
  const bearer = { authorization: `Bearer ${input.accessToken}` };
  const identity = identitySchema.parse(
    await ebayJson(fetcher, "https://apiz.ebay.com/commerce/identity/v1/user/", {
      headers: bearer,
    }),
  );

  const workspaceId = await workspaceFor(db, input.userId, now);
  await db
    .prepare(
      `INSERT INTO ebay_stores (id, workspace_id, ebay_user_id, linked_at)
       VALUES (?, ?, ?, ?) ON CONFLICT(ebay_user_id) DO NOTHING`,
    )
    .bind(crypto.randomUUID(), workspaceId, identity.userId, now)
    .run();
  const store = await db
    .prepare("SELECT id, workspace_id FROM ebay_stores WHERE ebay_user_id = ?")
    .bind(identity.userId)
    .first<{ id: string; workspace_id: string }>();
  if (!store || store.workspace_id !== workspaceId) return "altro-spazio";

  const page = ordersPageSchema.parse(
    await ebayJson(fetcher, "https://api.ebay.com/sell/fulfillment/v1/order?limit=1", {
      headers: bearer,
    }),
  );
  const order = page.orders[0];
  if (!order) return "collegato";

  const saved = await db
    .prepare(
      `INSERT INTO orders
         (id, store_id, ebay_order_id, creation_time, last_modified_time, currency, total_minor)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(store_id, ebay_order_id) DO UPDATE SET
         last_modified_time = excluded.last_modified_time,
         currency = excluded.currency,
         total_minor = excluded.total_minor
       RETURNING id`,
    )
    .bind(
      crypto.randomUUID(),
      store.id,
      order.orderId,
      order.creationDate,
      order.lastModifiedDate,
      order.pricingSummary.total.currency,
      toMinor(order.pricingSummary.total.value),
    )
    .first<{ id: string }>();

  const tradingResponse = await fetcher("https://api.ebay.com/ws/api.dll", {
    method: "POST",
    headers: {
      "content-type": "text/xml;charset=UTF-8",
      "x-ebay-api-call-name": "GetOrders",
      "x-ebay-api-siteid": tradingSiteId,
      "x-ebay-api-compatibility-level": tradingApiVersion,
      "x-ebay-api-iaf-token": input.accessToken,
    },
    body:
      '<?xml version="1.0" encoding="utf-8"?>' +
      '<GetOrdersRequest xmlns="urn:ebay:apis:eBLBaseComponents">' +
      `<Version>${tradingApiVersion}</Version><DetailLevel>ReturnAll</DetailLevel>` +
      "<OrderRole>Seller</OrderRole><OrderStatus>All</OrderStatus>" +
      `<OrderIDArray><OrderID>${order.orderId.replace(/[<>&]/gu, "")}</OrderID></OrderIDArray>` +
      "</GetOrdersRequest>",
  });
  if (!tradingResponse.ok) throw new Error(`ebay_http_${tradingResponse.status}`);
  const observations = mapTradingTaxIdentifiers(
    parseTradingOrderTaxIdentifiers(await tradingResponse.text(), order.orderId),
  );
  if (observations.length > 0) {
    await db.batch(
      observations.map((observation) =>
        db
          .prepare(
            `INSERT OR IGNORE INTO tax_identifiers
               (id, order_id, identifier_type, issuing_country, value, source, observed_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            crypto.randomUUID(),
            saved!.id,
            observation.type,
            observation.issuingCountry,
            observation.value,
            observation.source,
            now,
          ),
      ),
    );
  }
  return "collegato";
}
