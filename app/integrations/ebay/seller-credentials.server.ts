import { z } from "zod";

import { logFailure } from "../../errors";
import { UpstreamError, upstreamJson } from "../http.server";

export const ebayTokenUrl = "https://api.ebay.com/identity/v1/oauth2/token";

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

const refreshSchema = z.looseObject({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive(),
});

export function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
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
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(), info: keyInfo },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
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
    `SELECT refresh_token, refresh_expires_at, granted_at FROM ebay_store_credentials
      WHERE store_id = ? AND rejected_at IS NULL`,
  )
    .bind(storeId)
    .first<{ refresh_token: string; refresh_expires_at: string; granted_at: string }>();
  if (!row) return "missing";

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
    token = await upstreamJson(input.fetcher, ebayTokenUrl, refreshSchema, {
      method: "POST",
      headers: {
        authorization: `Basic ${btoa(`${environment.EBAY_CLIENT_ID}:${environment.EBAY_CLIENT_SECRET}`)}`,
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

/**
 * Lavoro in background: rinnova in anticipo i token di accesso vicini alla scadenza. I negozi
 * in pausa non leggono eBay e restano esclusi; quelli scollegati non hanno più token.
 */
export async function refreshExpiringTokens(
  environment: Env,
  fetcher: typeof fetch,
  now = new Date(),
): Promise<RefreshOutcome[]> {
  const { results } = await environment.DB.prepare(
    `SELECT c.store_id FROM ebay_store_credentials c
      WHERE c.rejected_at IS NULL AND c.access_expires_at <= ?
        AND NOT EXISTS (SELECT 1 FROM ebay_store_pauses p WHERE p.store_id = c.store_id)
      ORDER BY c.access_expires_at LIMIT ?`,
  )
    .bind(new Date(now.getTime() + refreshMarginMilliseconds).toISOString(), refreshBatch)
    .all<{ store_id: string }>();
  const outcomes: RefreshOutcome[] = [];
  // In sequenza: un errore di un negozio non ferma gli altri e non sovrappone retry.
  for (const { store_id: storeId } of results) {
    try {
      outcomes.push(await refreshStoreToken({ environment, storeId, fetcher, now }));
    } catch (error) {
      logFailure({ error, operation: "token_refresh" });
    }
  }
  return outcomes;
}
