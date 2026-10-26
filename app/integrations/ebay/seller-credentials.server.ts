import { z } from "zod";

import { seal, unseal } from "../../sealed.server";
import { UpstreamError, upstreamJson } from "../http.server";

import type { EbayEnvironment } from "../../view-models";
import { ebayConfiguration } from "./environment.server";

export type SellerTokens = {
  accessToken: string;
  accessExpiresAt: string;
  refreshToken: string;
  refreshExpiresAt: string;
};

type TokenKind = "access" | "refresh";

const sealedPrefix = "v1.";
const keyInfo = "fiscalbay/ebay-seller-token/v1";

const refreshSchema = z.looseObject({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive(),
});

// Negozio e tipo entrano nei dati autenticati: un token copiato su un'altra riga non si apre.
export async function sealToken(
  secret: string,
  storeId: string,
  kind: TokenKind,
  token: string,
): Promise<string> {
  return sealedPrefix + (await seal(secret, keyInfo, `${storeId}:${kind}`, token));
}

/**
 * Decifra un token salvato. Fallisce soltanto per un token che non si apre con il segreto
 * corrente (formato, cifratura o segreto diversi, per esempio dopo una rotazione di
 * `BETTER_AUTH_SECRET`): il consenso non è più utilizzabile e il negozio va ricollegato.
 */
export async function openToken(
  secret: string,
  storeId: string,
  kind: TokenKind,
  value: string,
): Promise<string> {
  if (!value.startsWith(sealedPrefix)) throw new Error("unsupported_token_format");
  return unseal(secret, keyInfo, `${storeId}:${kind}`, value.slice(sealedPrefix.length));
}

/**
 * Segna come rifiutato il consenso con cui è partita l'operazione: il negozio chiede di essere
 * ricollegato e il lavoro periodico smette di usarlo. Un consenso già sostituito non cambia.
 */
export async function rejectCredentials(
  db: D1Database,
  storeId: string,
  grantedAt: string,
  now: Date,
): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE ebay_store_credentials SET rejected_at = ?
        WHERE store_id = ? AND granted_at = ? AND rejected_at IS NULL`,
    )
    .bind(now.toISOString(), storeId, grantedAt)
    .run();
  return result.meta.changes === 1;
}

/** Registra un nuovo consenso: sostituisce i token precedenti e annulla un rifiuto registrato. */
export async function saveStoreCredentials(
  env: Env,
  storeId: string,
  tokens: SellerTokens,
  grantedAt: string,
): Promise<void> {
  const secret = env.BETTER_AUTH_SECRET;
  await env.DB.prepare(
    `INSERT INTO ebay_store_credentials
       (store_id, access_token, access_expires_at, refresh_token, refresh_expires_at, granted_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(store_id) DO UPDATE SET
       access_token = excluded.access_token,
       access_expires_at = excluded.access_expires_at,
       refresh_token = excluded.refresh_token,
       refresh_expires_at = excluded.refresh_expires_at,
       granted_at = excluded.granted_at,
       refreshed_at = NULL,
       rejected_at = NULL`,
  )
    .bind(
      storeId,
      await sealToken(secret, storeId, "access", tokens.accessToken),
      tokens.accessExpiresAt,
      await sealToken(secret, storeId, "refresh", tokens.refreshToken),
      tokens.refreshExpiresAt,
      grantedAt,
    )
    .run();
}

export type RefreshOutcome = "refreshed" | "rejected" | "superseded" | "missing";

/**
 * Rinnova il token di accesso con il refresh token. Ogni scrittura è condizionata al consenso
 * letto: una risposta arrivata dopo un nuovo collegamento non ripristina token superati.
 */
export async function refreshStoreToken(input: {
  env: Env;
  storeId: string;
  fetcher: typeof fetch;
  now?: Date;
}): Promise<RefreshOutcome> {
  const { env: environment, storeId } = input;
  const now = input.now ?? new Date();
  const row = await environment.DB.prepare(
    `SELECT c.refresh_token, c.refresh_expires_at, c.granted_at, s.ebay_environment
       FROM ebay_store_credentials c JOIN ebay_stores s ON s.id = c.store_id
      WHERE c.store_id = ? AND c.rejected_at IS NULL`,
  )
    .bind(storeId)
    .first<{
      refresh_token: string;
      refresh_expires_at: string;
      granted_at: string;
      ebay_environment: EbayEnvironment;
    }>();
  if (!row) return "missing";
  const configuration = ebayConfiguration(environment, row.ebay_environment);

  const reject = async (): Promise<RefreshOutcome> =>
    (await rejectCredentials(environment.DB, storeId, row.granted_at, now))
      ? "rejected"
      : "superseded";
  if (row.refresh_expires_at <= now.toISOString()) return reject();

  let refreshToken: string;
  try {
    refreshToken = await openToken(
      environment.BETTER_AUTH_SECRET,
      storeId,
      "refresh",
      row.refresh_token,
    );
  } catch {
    return reject();
  }
  let token: z.infer<typeof refreshSchema>;
  try {
    token = await upstreamJson(input.fetcher, configuration.tokenUrl, refreshSchema, {
      method: "POST",
      headers: {
        authorization: `Basic ${btoa(`${configuration.clientId}:${configuration.clientSecret}`)}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
    });
  } catch (error) {
    // Solo `invalid_grant` riguarda il consenso del negozio; credenziali dell'app errate o
    // indisponibilità di eBay non devono chiedere al merchant di ricollegarsi.
    if (error instanceof UpstreamError && error.details.providerCode === "invalid_grant") {
      return reject();
    }
    throw error;
  }

  const result = await environment.DB.prepare(
    `UPDATE ebay_store_credentials
        SET access_token = ?, access_expires_at = ?, refreshed_at = ?
      WHERE store_id = ? AND granted_at = ? AND rejected_at IS NULL`,
  )
    .bind(
      await sealToken(environment.BETTER_AUTH_SECRET, storeId, "access", token.access_token),
      new Date(now.getTime() + token.expires_in * 1000).toISOString(),
      now.toISOString(),
      storeId,
      row.granted_at,
    )
    .run();
  return result.meta.changes === 1 ? "refreshed" : "superseded";
}
