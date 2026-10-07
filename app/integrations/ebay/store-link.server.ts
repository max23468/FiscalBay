import { z } from "zod";
import { logFailure } from "../../errors";
import type { Language } from "../../i18n";
import { upstreamJson, upstreamText } from "../http.server";
import { recordOrderObservation, writableStore } from "../../domain/order-import.server";
import { fulfillmentObservation } from "./fulfillment.server";
import { base64Url, saveStoreCredentials } from "./seller-credentials.server";
import { ebayConfiguration, type EbayEnvironment } from "./environment.server";

import {
  mapTradingTaxIdentifiers,
  parseTradingOrderTaxIdentifiers,
} from "./tax-identifiers.server";

// Il collegamento del negozio non chiede l'email: resta separato dal login eBay.
export const ebayStoreScopes = [
  "https://api.ebay.com/oauth/api_scope",
  "https://api.ebay.com/oauth/api_scope/commerce.identity.readonly",
  "https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly",
] as const;

const linkSessionTtlMilliseconds = 10 * 60 * 1000;
const tradingApiVersion = "1455";
const tradingSiteId = "101";

const tokenSchema = z.looseObject({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive(),
  refresh_token: z.string().min(1),
  refresh_token_expires_in: z.number().int().positive(),
});
// `userId` è l'identificativo eBay immutabile; lo username può cambiare ed è solo un attributo.
const identitySchema = z.looseObject({
  userId: z.string().min(1).max(256),
  username: z.string().min(1).max(256).optional(),
});
const ordersPageSchema = z.looseObject({ orders: z.array(z.unknown()).default([]) });

export type StoreLinkOutcome = "collegato" | "negato" | "altro-spazio" | "errore";
export type StoreLinkClaim =
  | {
      kind: "new";
      userId: string;
      codeVerifier: string;
      expired: boolean;
      ebayEnvironment: EbayEnvironment;
    }
  | {
      kind: "duplicate";
      userId: string;
      outcome: StoreLinkOutcome | null;
      ebayEnvironment: EbayEnvironment;
    };

function randomToken(): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function startStoreLink(
  environment: Env,
  userId: string,
  now = new Date(),
  language: Language = "it",
  ebayEnvironment: EbayEnvironment = "production",
): Promise<string> {
  const configuration = ebayConfiguration(environment, ebayEnvironment);
  const state = `${language}_${randomToken()}`;
  const codeVerifier = randomToken();
  const challenge = base64Url(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier))),
  );
  await environment.DB.batch([
    environment.DB.prepare("DELETE FROM ebay_store_link_sessions WHERE expires_at <= ?").bind(
      now.toISOString(),
    ),
    environment.DB.prepare(
      `INSERT INTO ebay_store_link_sessions (state, user_id, code_verifier, expires_at, ebay_environment)
       VALUES (?, ?, ?, ?, ?)`,
    ).bind(
      state,
      userId,
      codeVerifier,
      new Date(now.getTime() + linkSessionTtlMilliseconds).toISOString(),
      ebayEnvironment,
    ),
  ]);

  const url = new URL(configuration.authorizationUrl);
  url.search = new URLSearchParams({
    client_id: configuration.clientId,
    redirect_uri: configuration.runame,
    response_type: "code",
    scope: ebayStoreScopes.join(" "),
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();
  return url.toString();
}

/**
 * Consuma lo state una sola volta. Un secondo callback con lo stesso state non ripete lo scambio
 * del codice: riceve l'esito del primo. null indica un callback estraneo al collegamento negozio.
 */
export async function claimStoreLinkSession(
  db: D1Database,
  state: string,
  now = new Date(),
): Promise<StoreLinkClaim | null> {
  const claimed = await db
    .prepare(
      `UPDATE ebay_store_link_sessions SET consumed_at = ?
        WHERE state = ? AND consumed_at IS NULL
       RETURNING user_id, code_verifier, expires_at, ebay_environment`,
    )
    .bind(now.toISOString(), state)
    .first<{
      user_id: string;
      code_verifier: string;
      expires_at: string;
      ebay_environment: EbayEnvironment;
    }>();
  if (claimed) {
    return {
      kind: "new",
      userId: claimed.user_id,
      codeVerifier: claimed.code_verifier,
      expired: claimed.expires_at <= now.toISOString(),
      ebayEnvironment: claimed.ebay_environment,
    };
  }
  const used = await db
    .prepare(
      "SELECT user_id, outcome, ebay_environment FROM ebay_store_link_sessions WHERE state = ?",
    )
    .bind(state)
    .first<{
      user_id: string;
      outcome: StoreLinkOutcome | null;
      ebay_environment: EbayEnvironment;
    }>();
  return used
    ? {
        kind: "duplicate",
        userId: used.user_id,
        outcome: used.outcome,
        ebayEnvironment: used.ebay_environment,
      }
    : null;
}

/** Registra l'esito per i callback duplicati e cancella il verifier, ormai inutile. */
export async function recordStoreLinkOutcome(
  db: D1Database,
  state: string,
  outcome: StoreLinkOutcome,
): Promise<void> {
  await db
    .prepare("UPDATE ebay_store_link_sessions SET outcome = ?, code_verifier = '' WHERE state = ?")
    .bind(outcome, state)
    .run();
}

const workspaceNames: Record<Language, string> = { it: "Spazio personale", en: "Personal space" };

async function workspaceFor(
  db: D1Database,
  userId: string,
  now: string,
  language: Language,
): Promise<string> {
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
      .prepare("INSERT INTO workspaces (id, name, created_at) VALUES (?, ?, ?)")
      .bind(workspaceId, workspaceNames[language], now),
    db
      .prepare("INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, 'owner')")
      .bind(workspaceId, userId),
  ]);
  return workspaceId;
}

export async function completeStoreLink(input: {
  environment: Env;
  link: Extract<StoreLinkClaim, { kind: "new" }>;
  sessionUserId: string | null;
  search: URLSearchParams;
  fetcher: typeof fetch;
  request?: Request;
  now?: Date;
}): Promise<StoreLinkOutcome> {
  const { environment, link, search, fetcher } = input;
  if (link.expired || input.sessionUserId !== link.userId) return "errore";
  if (search.has("error")) return "negato";

  const issued = input.now ?? new Date();
  const now = issued.toISOString();
  const configuration = ebayConfiguration(environment, link.ebayEnvironment);
  const token = await upstreamJson(fetcher, configuration.tokenUrl, tokenSchema, {
    method: "POST",
    headers: {
      authorization: `Basic ${btoa(`${configuration.clientId}:${configuration.clientSecret}`)}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: search.get("code")!,
      redirect_uri: configuration.runame,
      code_verifier: link.codeVerifier,
    }),
  });
  const identity = await upstreamJson(fetcher, configuration.identityUrl, identitySchema, {
    headers: { authorization: `Bearer ${token.access_token}` },
  });

  // Lo state porta la lingua in cui il merchant ha avviato il collegamento.
  const language: Language = search.get("state")!.startsWith("en_") ? "en" : "it";
  const storeId = await linkStore(environment.DB, link.userId, identity, now, {
    ebayEnvironment: link.ebayEnvironment,
    language,
  });
  // Il negozio di un altro spazio non riceve token e l'esito non dice nulla di quello spazio.
  if (!storeId) return "altro-spazio";
  await saveStoreCredentials(
    environment,
    storeId,
    {
      accessToken: token.access_token,
      accessExpiresAt: new Date(issued.getTime() + token.expires_in * 1000).toISOString(),
      refreshToken: token.refresh_token,
      refreshExpiresAt: new Date(
        issued.getTime() + token.refresh_token_expires_in * 1000,
      ).toISOString(),
    },
    now,
  );

  // Un negozio in pausa non legge eBay neppure al ricollegamento: riprende alla ripresa.
  const paused = await environment.DB.prepare(
    "SELECT 1 FROM ebay_store_pauses WHERE store_id = ? LIMIT 1",
  )
    .bind(storeId)
    .first();
  if (paused) return "collegato";

  // Il collegamento è già riuscito: un errore nella lettura del primo ordine non lo annulla.
  await importLatestOrder({
    db: environment.DB,
    storeId,
    grantedAt: now,
    accessToken: token.access_token,
    fetcher,
    now,
    configuration,
  }).catch((error: unknown) => {
    logFailure({ request: input.request, error, operation: "store_link" });
  });
  return "collegato";
}

/**
 * Associa l'account eBay al primo spazio dell'utente con una sola istruzione: l'identificativo
 * stabile è unico, quindi lo stesso negozio non entra in due spazi neppure con richieste
 * concorrenti. Un nuovo username aggiorna il negozio esistente e il ricollegamento lo riattiva,
 * anche dopo uno scollegamento o un'eliminazione dei dati: gli ordini letti da quel momento
 * sono nuovi e si possono eliminare di nuovo. null se appartiene ad altri.
 */
async function linkStore(
  db: D1Database,
  userId: string,
  identity: z.infer<typeof identitySchema>,
  now: string,
  { ebayEnvironment, language }: { ebayEnvironment: EbayEnvironment; language: Language },
): Promise<string | null> {
  const workspaceId = await workspaceFor(db, userId, now, language);
  const store = await db
    .prepare(
      `INSERT INTO ebay_stores (id, workspace_id, ebay_user_id, linked_at, display_name, ebay_environment, ebay_account_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(ebay_user_id) DO UPDATE SET
         display_name = COALESCE(excluded.display_name, ebay_stores.display_name),
         disconnected_at = NULL,
         data_deleted_at = NULL
       WHERE ebay_stores.workspace_id = excluded.workspace_id
         AND ebay_stores.ebay_environment = excluded.ebay_environment
       RETURNING id`,
    )
    .bind(
      crypto.randomUUID(),
      workspaceId,
      ebayEnvironment === "production"
        ? identity.userId
        : JSON.stringify([ebayEnvironment, identity.userId]),
      now,
      identity.username ?? null,
      ebayEnvironment,
      identity.userId,
    )
    .first<{ id: string }>();
  return store?.id ?? null;
}

/** Importa l'ordine più recente con la relativa fonte fiscale Trading. */
async function importLatestOrder(input: {
  db: D1Database;
  storeId: string;
  grantedAt: string;
  accessToken: string;
  fetcher: typeof fetch;
  now: string;
  configuration: ReturnType<typeof ebayConfiguration>;
}): Promise<void> {
  const { db, fetcher, now } = input;
  const page = await upstreamJson(fetcher, input.configuration.ordersUrl, ordersPageSchema, {
    headers: { authorization: `Bearer ${input.accessToken}` },
  });
  // Lettura riuscita: l'ultima sincronizzazione del negozio, senza toccare il cursore.
  const recordSync = () =>
    db
      .prepare(
        `INSERT INTO sync_state (store_id, last_success_at, updated_at)
         SELECT ?1, ?3, ?3 WHERE ${writableStore}
         ON CONFLICT(store_id) DO UPDATE SET
           last_success_at = excluded.last_success_at,
           updated_at = excluded.updated_at`,
      )
      .bind(input.storeId, input.grantedAt, now)
      .run();
  if (page.orders.length === 0) {
    await recordSync();
    return;
  }

  const observation = fulfillmentObservation(page.orders[0]);
  const trading = await upstreamText(fetcher, input.configuration.tradingUrl, {
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
      `<OrderIDArray><OrderID>${observation.externalOrderId.replace(/[<>&]/gu, "")}</OrderID></OrderIDArray>` +
      "</GetOrdersRequest>",
  }).then(
    (xml) => ({
      values: mapTradingTaxIdentifiers(
        parseTradingOrderTaxIdentifiers(xml, observation.externalOrderId),
      ),
    }),
    (error: unknown) => ({ error }),
  );
  // Senza Trading l'ordine si salva comunque, senza dati fiscali. L'assenza del campo in
  // Trading non è ancora qualificata come rimozione autorevole.
  await recordOrderObservation(
    db,
    { storeId: input.storeId, consentGrantedAt: input.grantedAt, observedAt: now },
    "values" in trading
      ? {
          ...observation,
          taxIdentifiers: {
            source: "ebay_trading_get_orders",
            complete: false,
            values: trading.values,
          },
        }
      : observation,
  );
  if ("error" in trading) throw trading.error;
  await recordSync();
}
