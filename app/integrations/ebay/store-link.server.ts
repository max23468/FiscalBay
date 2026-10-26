import { z } from "zod";
import type { Language } from "../../i18n";
import { upstreamJson } from "../http.server";
import { base64Url } from "../../sealed.server";
import type { SellerTokens } from "./seller-credentials.server";
import type { EbayEnvironment } from "../../view-models";
import { ebayConfiguration, type EbayAccess } from "./environment.server";

// Il collegamento del negozio non chiede l'email: resta separato dal login eBay.
export const ebayStoreScopes = [
  "https://api.ebay.com/oauth/api_scope",
  "https://api.ebay.com/oauth/api_scope/commerce.identity.readonly",
  "https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly",
] as const;

const linkSessionTtlMilliseconds = 10 * 60 * 1000;

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

export type EbayStoreIdentity = z.infer<typeof identitySchema>;

export type StoreLinkOutcome =
  | "collegato"
  | "negato"
  | "altro-spazio"
  | "negozio-diverso"
  | "errore";
export type StoreLinkClaim =
  | {
      kind: "new";
      userId: string;
      codeVerifier: string;
      expired: boolean;
      ebayEnvironment: EbayEnvironment;
      expectedStoreId: string | null;
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
  env: Env,
  userId: string,
  now = new Date(),
  language: Language = "it",
  ebayEnvironment: EbayEnvironment = "production",
  expectedStoreId: string | null = null,
  fromStores = false,
): Promise<string> {
  const configuration = ebayConfiguration(env, ebayEnvironment);
  // Lingua e pagina di ritorno viaggiano nello state: il callback le legge senza altre tabelle.
  const state = `${language}${fromStores ? "-negozi" : ""}_${randomToken()}`;
  const codeVerifier = randomToken();
  const challenge = base64Url(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier))),
  );
  await env.DB.batch([
    env.DB.prepare("DELETE FROM ebay_store_link_sessions WHERE expires_at <= ?").bind(
      now.toISOString(),
    ),
    env.DB.prepare(
      `INSERT INTO ebay_store_link_sessions (state, user_id, code_verifier, expires_at, ebay_environment, expected_store_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(
      state,
      userId,
      codeVerifier,
      new Date(now.getTime() + linkSessionTtlMilliseconds).toISOString(),
      ebayEnvironment,
      expectedStoreId,
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
  // Senza locale eBay mostra accesso e consenso in inglese anche agli account italiani.
  if (language === "it") url.searchParams.set("locale", "it-IT");
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
       RETURNING user_id, code_verifier, expires_at, ebay_environment, expected_store_id`,
    )
    .bind(now.toISOString(), state)
    .first<{
      user_id: string;
      code_verifier: string;
      expires_at: string;
      ebay_environment: EbayEnvironment;
      expected_store_id: string | null;
    }>();
  if (claimed) {
    return {
      kind: "new",
      userId: claimed.user_id,
      codeVerifier: claimed.code_verifier,
      expired: claimed.expires_at <= now.toISOString(),
      ebayEnvironment: claimed.ebay_environment,
      expectedStoreId: claimed.expected_store_id,
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

/** Consenso concesso dal venditore: identità eBay stabile, token e accesso per le prime letture. */
export type StoreConsent = {
  identity: EbayStoreIdentity;
  tokens: SellerTokens;
  access: EbayAccess;
};

/** Scambia il codice del callback con i token del negozio e legge l'identità eBay del venditore. */
export async function exchangeStoreConsent(
  env: Env,
  link: { ebayEnvironment: EbayEnvironment; codeVerifier: string },
  code: string,
  fetcher: typeof fetch,
  issued: Date,
): Promise<StoreConsent> {
  const configuration = ebayConfiguration(env, link.ebayEnvironment);
  const token = await upstreamJson(fetcher, configuration.tokenUrl, tokenSchema, {
    method: "POST",
    headers: {
      authorization: `Basic ${btoa(`${configuration.clientId}:${configuration.clientSecret}`)}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: configuration.runame,
      code_verifier: link.codeVerifier,
    }),
  });
  const identity = await upstreamJson(fetcher, configuration.identityUrl, identitySchema, {
    headers: { authorization: `Bearer ${token.access_token}` },
  });
  return {
    identity,
    tokens: {
      accessToken: token.access_token,
      accessExpiresAt: new Date(issued.getTime() + token.expires_in * 1000).toISOString(),
      refreshToken: token.refresh_token,
      refreshExpiresAt: new Date(
        issued.getTime() + token.refresh_token_expires_in * 1000,
      ).toISOString(),
    },
    access: { fetcher, configuration, accessToken: token.access_token },
  };
}
