import { requestLimitRules, type RequestLimit } from "./request-limits";

const limiters = {
  attempts: "REQUEST_LIMIT_ATTEMPTS",
  emails: "REQUEST_LIMIT_EMAILS",
  work: "REQUEST_LIMIT_WORK",
} as const satisfies Record<RequestLimit, keyof Env>;

/** Un indirizzo IPv6 conta per la sua rete /64, che un singolo client controlla per intero. */
export function clientKey(ip: string): string {
  if (!ip.includes(":")) return ip;
  const [head, tail = ""] = ip.split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const groups = [...left, ...Array(8 - left.length - right.length).fill("0"), ...right];
  return `${groups.slice(0, 4).join(":")}::/64`;
}

/**
 * Primo filtro per IP e operazione, con il binding Rate Limiting di Workers (§29): precede
 * sessione, Turnstile e contatori D1, e restituisce i secondi di attesa oltre il limite. Il
 * contatore è del data center e approssimato, mai scritto su D1; la chiave non contiene
 * l'account, quindi la risposta non dice se esiste. Attivo sui domini HTTPS, dove Cloudflare
 * fornisce l'IP del client.
 */
export async function requestLimitWait(
  env: Pick<Env, "APP_ORIGIN" | (typeof limiters)[RequestLimit]>,
  request: Request,
  limit: RequestLimit,
  operation: string,
): Promise<number | null> {
  const ip = request.headers.get("cf-connecting-ip");
  if (!env.APP_ORIGIN.startsWith("https:") || !ip) return null;
  const { success } = await env[limiters[limit]].limit({ key: `${operation}|${clientKey(ip)}` });
  return success ? null : requestLimitRules[limit].period;
}

/** Intestazioni di ogni risposta 429: l'attesa e nessuna copia in cache. */
export function limitedHeaders(wait: number) {
  return { "retry-after": String(wait), "cache-control": "no-store" };
}

/**
 * Intestazioni delle pagine con azioni filtrate: nessuna copia in cache e, dopo un rifiuto, la
 * stessa attesa dell'action, che l'export `headers` della route altrimenti non trasmette.
 */
export function pageHeaders({ actionHeaders }: { actionHeaders: Headers }): HeadersInit {
  const wait = actionHeaders.get("retry-after");
  return { "cache-control": "no-store", ...(wait ? { "retry-after": wait } : {}) };
}
