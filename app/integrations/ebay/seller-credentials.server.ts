import { z } from "zod";

import { logFailure } from "../../errors";
import { UpstreamError, upstreamJson } from "../http.server";

import { ebayConfiguration, type EbayEnvironment } from "./environment.server";

export type SellerTokens = {
  accessToken: string;
  accessExpiresAt: string;
  refreshToken: string;
  refreshExpiresAt: string;
};

type TokenKind = "access" | "refresh";

const sealedPrefix = "v1.";
const keyInfo = new TextEncoder().encode("fiscalbay/ebay-seller-token/v1");
// Il token di accesso vale due ore: il rinnovo parte quando ne restano meno di quaranta minuti,
// così due esecuzioni ogni trenta minuti lasciano sempre un margine.
const refreshMarginMilliseconds = 40 * 60 * 1000;
const refreshBatch = 50;
const refreshLimit = 300;

const refreshSchema = z.looseObject({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive(),
});

export function base64Url(bytes: Uint8Array): string {
  // Stryker disable Regex: in base64 «=» compare solo come riempimento finale.
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
  // Stryker restore Regex
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value.replaceAll("-", "+").replaceAll("_", "/"));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

/** Chiave AES dedicata, derivata dal segreto server: non coincide con le chiavi di Better Auth. */
async function tokenKey(secret: string): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    "HKDF",
    false,
    ["deriveKey"],
  );
  // Stryker disable BooleanLiteral: la chiave non viene mai esportata, estraibile o no.
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(), info: keyInfo },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  // Stryker restore BooleanLiteral
}

// Negozio e tipo entrano nei dati autenticati: un token copiato su un'altra riga non si apre.
function boundTo(storeId: string, kind: TokenKind): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(`${storeId}:${kind}`);
}

export async function sealToken(
  secret: string,
  storeId: string,
  kind: TokenKind,
  token: string,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: boundTo(storeId, kind) },
      await tokenKey(secret),
      new TextEncoder().encode(token),
    ),
  );
  const bytes = new Uint8Array(iv.byteLength + sealed.byteLength);
  bytes.set(iv);
  bytes.set(sealed, iv.byteLength);
  return sealedPrefix + base64Url(bytes);
}

export async function openToken(
  secret: string,
  storeId: string,
  kind: TokenKind,
  value: string,
): Promise<string> {
  if (!value.startsWith(sealedPrefix)) throw new Error("unsupported_token_format");
  const bytes = fromBase64Url(value.slice(sealedPrefix.length));
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: bytes.subarray(0, 12), additionalData: boundTo(storeId, kind) },
    await tokenKey(secret),
    bytes.subarray(12),
  );
  return new TextDecoder().decode(plain);
}

/** Registra un nuovo consenso: sostituisce i token precedenti e annulla un rifiuto registrato. */
export async function saveStoreCredentials(
  environment: Env,
  storeId: string,
  tokens: SellerTokens,
  grantedAt: string,
): Promise<void> {
  const secret = environment.BETTER_AUTH_SECRET;
  await environment.DB.prepare(
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
  environment: Env;
  storeId: string;
  fetcher: typeof fetch;
  now?: Date;
}): Promise<RefreshOutcome> {
  const { environment, storeId } = input;
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

  const reject = async (): Promise<RefreshOutcome> => {
    const result = await environment.DB.prepare(
      `UPDATE ebay_store_credentials SET rejected_at = ?
        WHERE store_id = ? AND granted_at = ? AND rejected_at IS NULL`,
    )
      .bind(now.toISOString(), storeId, row.granted_at)
      .run();
    return result.meta.changes === 1 ? "rejected" : "superseded";
  };
  if (row.refresh_expires_at <= now.toISOString()) return reject();

  const refreshToken = await openToken(
    environment.BETTER_AUTH_SECRET,
    storeId,
    "refresh",
    row.refresh_token,
  );
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

type ExpiringRow = { store_id: string; access_expires_at: string };

/**
 * Lavoro in background: rinnova in anticipo i token di accesso vicini alla scadenza. I negozi
 * in pausa non leggono eBay e restano esclusi; quelli scollegati non hanno più token.
 *
 * Scorre i negozi a blocchi con un cursore, così un errore non fa rileggere lo stesso negozio,
 * fino a `refreshLimit` rinnovi: con due esecuzioni l'ora e token di due ore regge circa mille
 * negozi attivi restando entro le sottorichieste di una esecuzione.
 */
export async function refreshExpiringTokens(
  environment: Env,
  fetcher: typeof fetch,
  now = new Date(),
): Promise<RefreshOutcome[]> {
  const threshold = new Date(now.getTime() + refreshMarginMilliseconds).toISOString();
  const outcomes: RefreshOutcome[] = [];
  // Ultimo negozio letto: scadenza e identificativo, null prima del primo blocco.
  let cursor: [string, string] | [null, null] = [null, null];
  for (let read = 0; read < refreshLimit; read += refreshBatch) {
    const { results }: D1Result<ExpiringRow> = await environment.DB.prepare(
      `SELECT c.store_id, c.access_expires_at FROM ebay_store_credentials c
        WHERE c.rejected_at IS NULL AND c.access_expires_at <= ?1
          AND (?2 IS NULL OR (c.access_expires_at, c.store_id) > (?2, ?3))
          AND NOT EXISTS (SELECT 1 FROM ebay_store_pauses p WHERE p.store_id = c.store_id)
        ORDER BY c.access_expires_at, c.store_id LIMIT ?4`,
    )
      .bind(threshold, ...cursor, refreshBatch)
      .all<ExpiringRow>();
    // In sequenza: un errore di un negozio non ferma gli altri e non sovrappone retry.
    for (const { store_id: storeId } of results) {
      try {
        outcomes.push(await refreshStoreToken({ environment, storeId, fetcher, now }));
      } catch (error) {
        logFailure({ error, operation: "token_refresh" });
      }
    }
    if (results.length < refreshBatch) break;
    const last: ExpiringRow = results.at(-1)!;
    cursor = [last.access_expires_at, last.store_id];
  }
  return outcomes;
}
