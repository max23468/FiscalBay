import { z } from "zod";

import { seal, unseal } from "../../sealed.server";
import { UpstreamError } from "../http.server";

import type { EbayEnvironment } from "../../view-models";
import { ebayConfiguration, requestToken } from "./environment.server";

export type SellerTokens = {
  accessToken: string;
  accessExpiresAt: string;
  refreshToken: string;
  refreshExpiresAt: string;
};

type TokenKind = "access" | "refresh";

/**
 * Segreti delle versioni della chiave, indicate dal prefisso del valore salvato: `v1` deriva da
 * `BETTER_AUTH_SECRET` e resta soltanto in lettura, `v2` da `EBAY_TOKEN_SECRET`, separato da
 * quello di Auth. Ogni nuova cifratura usa `v2`; il rinnovo ricifra i token ancora in `v1`, così
 * quando nessun token in `v1` resta il segreto di Auth si ruota senza ricollegare i negozi.
 */
export type TokenKeys = Pick<Env, "BETTER_AUTH_SECRET" | "EBAY_TOKEN_SECRET">;

const keyVersions = {
  "v1.": (keys: TokenKeys) => keys.BETTER_AUTH_SECRET,
  "v2.": (keys: TokenKeys) => keys.EBAY_TOKEN_SECRET,
} as const;

const currentVersion = "v2.";

/**
 * Scopo della chiave derivata e dati autenticati: negozio e tipo, così un token copiato su
 * un'altra riga non si apre. Calcolati a ogni uso, come lo schema del rinnovo, perché il
 * mutation test provi soltanto le prove che li coprono.
 */
const sealContext = (storeId: string, kind: TokenKind) =>
  ["fiscalbay/ebay-seller-token/v1", `${storeId}:${kind}`] as const;

export async function sealToken(
  keys: TokenKeys,
  storeId: string,
  kind: TokenKind,
  token: string,
): Promise<string> {
  const secret = keyVersions[currentVersion](keys);
  return currentVersion + (await seal(secret, ...sealContext(storeId, kind), token));
}

/**
 * Decifra un token salvato con la chiave della sua versione. Fallisce soltanto per un token che
 * non si apre (versione, formato, cifratura o segreto diversi, per esempio dopo una rotazione):
 * il consenso non è più utilizzabile e il negozio va ricollegato.
 */
export async function openToken(
  keys: TokenKeys,
  storeId: string,
  kind: TokenKind,
  value: string,
): Promise<string> {
  const version = Object.keys(keyVersions).find((prefix) => value.startsWith(prefix)) as
    | keyof typeof keyVersions
    | undefined;
  if (!version) throw new Error("unsupported_token_format");
  const secret = keyVersions[version](keys);
  return unseal(secret, ...sealContext(storeId, kind), value.slice(version.length));
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

/** Letture consecutive con le credenziali rifiutate dopo cui il negozio va ricollegato. */
const credentialFailureLimit = 3;

/**
 * Conta una lettura con le credenziali rifiutate da eBay: un rifiuto passeggero non chiude il
 * consenso, la terza lettura consecutiva sì.
 */
export async function countCredentialFailure(
  db: D1Database,
  storeId: string,
  grantedAt: string,
  now: Date,
): Promise<void> {
  const row = await db
    .prepare(
      `UPDATE ebay_store_credentials SET credential_failures = credential_failures + 1
        WHERE store_id = ? AND granted_at = ? AND rejected_at IS NULL
        RETURNING credential_failures`,
    )
    .bind(storeId, grantedAt)
    .first<{ credential_failures: number }>();
  if (row && row.credential_failures >= credentialFailureLimit)
    await rejectCredentials(db, storeId, grantedAt, now);
}

/** Una lettura riuscita azzera i rifiuti contati per il consenso. */
export async function clearCredentialFailures(db: D1Database, storeId: string, grantedAt: string) {
  await db
    .prepare(
      `UPDATE ebay_store_credentials SET credential_failures = 0
        WHERE store_id = ? AND granted_at = ? AND credential_failures > 0`,
    )
    .bind(storeId, grantedAt)
    .run();
}

/** Registra un nuovo consenso: sostituisce i token precedenti e annulla un rifiuto registrato. */
export async function saveStoreCredentials(
  env: Env,
  storeId: string,
  tokens: SellerTokens,
  grantedAt: string,
): Promise<void> {
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
       rejected_at = NULL,
       credential_failures = 0,
       order_events = NULL,
       order_events_checked_at = NULL`,
  )
    .bind(
      storeId,
      await sealToken(env, storeId, "access", tokens.accessToken),
      tokens.accessExpiresAt,
      await sealToken(env, storeId, "refresh", tokens.refreshToken),
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
    refreshToken = await openToken(environment, storeId, "refresh", row.refresh_token);
  } catch {
    return reject();
  }
  const refreshSchema = z.looseObject({
    access_token: z.string().min(1),
    expires_in: z.number().int().positive(),
  });
  let token: z.infer<typeof refreshSchema>;
  try {
    token = await requestToken(configuration, input.fetcher, refreshSchema, {
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });
  } catch (error) {
    // Solo `invalid_grant` riguarda il consenso del negozio; credenziali dell'app errate o
    // indisponibilità di eBay non devono chiedere al merchant di ricollegarsi.
    if (error instanceof UpstreamError && error.details.providerCode === "invalid_grant") {
      return reject();
    }
    throw error;
  }

  // Anche il refresh token si ricifra: uno salvato con una chiave precedente passa alla corrente.
  // `refreshed_at` serve alla sola diagnosi sul database: nessun codice lo legge.
  const result = await environment.DB.prepare(
    `UPDATE ebay_store_credentials
        SET access_token = ?, access_expires_at = ?, refreshed_at = ?, refresh_token = ?
      WHERE store_id = ? AND granted_at = ? AND rejected_at IS NULL`,
  )
    .bind(
      await sealToken(environment, storeId, "access", token.access_token),
      new Date(now.getTime() + token.expires_in * 1000).toISOString(),
      now.toISOString(),
      await sealToken(environment, storeId, "refresh", refreshToken),
      storeId,
      row.granted_at,
    )
    .run();
  return result.meta.changes === 1 ? "refreshed" : "superseded";
}
