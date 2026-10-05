import type { z } from "zod";

import { ApplicationError, type ErrorCode } from "../errors";

/**
 * Confine minimo delle chiamate ai provider: timeout sull'intera lettura, limite dei byte anche
 * senza Content-Length e classificazione stabile degli errori. Il body del provider non entra
 * mai nell'errore: resta disponibile solo un codice OAuth breve, utile a chi chiama.
 */
export type UpstreamFailure =
  | "credentials"
  | "rate_limited"
  | "unavailable"
  | "invalid_response"
  | "rejected";

const failureCodes: Record<UpstreamFailure, ErrorCode> = {
  credentials: "STORE_RECONNECT_REQUIRED",
  rate_limited: "UPSTREAM_UNAVAILABLE",
  unavailable: "UPSTREAM_UNAVAILABLE",
  invalid_response: "UPSTREAM_UNAVAILABLE",
  rejected: "INVALID_REQUEST",
};

export class UpstreamError extends ApplicationError {
  constructor(
    readonly failure: UpstreamFailure,
    readonly details: { status?: number; retryAfter?: number; providerCode?: string } = {},
  ) {
    super(failureCodes[failure]);
    this.name = "UpstreamError";
  }
}

export type UpstreamOptions = { timeoutMs?: number; maxBytes?: number; now?: number };

const defaultTimeoutMs = 15_000;
const defaultMaxBytes = 1_048_576;

/** Secondi indicati da Retry-After, come numero o data HTTP; null se assente o illeggibile. */
export function retryAfterSeconds(value: string | null, now = Date.now()): number | null {
  if (!value?.trim()) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, Math.ceil(seconds));
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, Math.ceil((date - now) / 1000)) : null;
}

async function readLimited(response: Response, maxBytes: number): Promise<Uint8Array> {
  const declared = Number(response.headers.get("content-length"));
  if (declared > maxBytes) {
    await response.body?.cancel();
    throw new UpstreamError("invalid_response", { status: response.status });
  }
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new UpstreamError("invalid_response", { status: response.status });
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function providerCode(text: string): string | undefined {
  try {
    const code = (JSON.parse(text) as { error?: unknown }).error;
    return typeof code === "string" && /^[a-z_]{1,64}$/u.test(code) ? code : undefined;
  } catch {
    return undefined;
  }
}

/** Esegue la richiesta e restituisce il testo di una risposta 2xx entro tempo e dimensione. */
export async function upstreamText(
  fetcher: typeof fetch,
  url: string,
  init: RequestInit = {},
  options: UpstreamOptions = {},
): Promise<string> {
  const timeout = AbortSignal.timeout(options.timeoutMs ?? defaultTimeoutMs);
  const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  let text: string;
  let response: Response;
  try {
    response = await fetcher(url, { ...init, signal });
    text = new TextDecoder().decode(
      await readLimited(response, options.maxBytes ?? defaultMaxBytes),
    );
  } catch (error) {
    if (error instanceof UpstreamError) throw error;
    // Rete interrotta, timeout o lettura annullata a metà: il provider non ha risposto.
    throw new UpstreamError("unavailable");
  }
  const { status } = response;
  if (status >= 200 && status < 300) return text;
  const retryAfter =
    retryAfterSeconds(response.headers.get("retry-after"), options.now) ?? undefined;
  if (status === 401 || status === 403) throw new UpstreamError("credentials", { status });
  if (status === 429) throw new UpstreamError("rate_limited", { status, retryAfter });
  if (status >= 500) throw new UpstreamError("unavailable", { status, retryAfter });
  throw new UpstreamError("rejected", { status, providerCode: providerCode(text) });
}

/** Come upstreamText, poi valida il JSON con lo schema: un payload diverso è un errore distinto. */
export async function upstreamJson<Schema extends z.ZodType>(
  fetcher: typeof fetch,
  url: string,
  schema: Schema,
  init: RequestInit = {},
  options: UpstreamOptions = {},
): Promise<z.infer<Schema>> {
  const text = await upstreamText(fetcher, url, init, options);
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new UpstreamError("invalid_response");
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new UpstreamError("invalid_response");
  return parsed.data;
}
