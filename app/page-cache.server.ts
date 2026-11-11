import { AsyncLocalStorage } from "node:async_hooks";

import { canonicalPath } from "./i18n";
import { pricingPath } from "./app-links";
import { arrivalSource } from "./arrival-source.server";

/** Pagine pubbliche servite dalla cache breve: le più visitate, che leggono il listino. */
const cachedPages = new Set(["/", pricingPath]);

/** Pagina condivisa in preparazione: `stored` diventa falso se la copia non va conservata. */
const sharedPage = new AsyncLocalStorage<{ stored: boolean }>();

/**
 * La risposta in preparazione è la copia condivisa da tutti i visitatori anonimi: niente che
 * dipenda dalla singola richiesta, come il riferimento d'errore.
 */
export function sharedResponse() {
  return sharedPage.getStore() !== undefined;
}

/** La risposta in preparazione non va conservata, come il listino di riserva senza database. */
export function skipPageCache() {
  const page = sharedPage.getStore();
  if (page) page.stored = false;
}

/** Durata della copia: promozioni, posti e sospensioni della console arrivano entro un minuto. */
export const pageCacheSeconds = 60;

/**
 * Soltanto la pagina intera chiesta da un visitatore senza cookie e senza parametri: senza
 * sessione né scelta «Visita il sito» la risposta è la stessa per tutti, mentre ogni cookie,
 * anche estraneo, la fa leggere di nuovo. Le navigazioni interne (`.data`) non passano di qui.
 */
function cacheable(request: Request) {
  const url = new URL(request.url);
  return (
    request.method === "GET" &&
    !request.headers.has("cookie") &&
    !url.search &&
    cachedPages.has(canonicalPath(url.pathname))
  );
}

/**
 * Chiave della copia: indirizzo, versione del Worker e categoria di provenienza (D304), che la
 * pagina porta nei link interni. La categoria viene dall'elenco chiuso calcolato dal root loader,
 * mai dall'host del Referer; una visita dall'interno del sito ha una copia propria.
 */
export function pageCacheKey(request: Request, version: string | undefined, appOrigin: string) {
  const url = new URL(request.url);
  const channel = arrivalSource(request, appOrigin)?.channel ?? "interno";
  return new Request(`${url.origin}${url.pathname}?versione=${version ?? "locale"}&via=${channel}`);
}

/**
 * Home e Prezzi per chi non ha sessione (§23): una copia per indirizzo, versione del Worker e provenienza resta
 * nella cache di Cloudflare per un minuto, così un picco di visite non legge ogni volta il
 * database. Il browser riceve comunque `no-store`: dopo l'accesso la home porta agli Ordini.
 */
export async function withPageCache(
  request: Request,
  version: string | undefined,
  appOrigin: string,
  context: Pick<ExecutionContext, "waitUntil"> | undefined,
  respond: () => Promise<Response>,
): Promise<Response> {
  if (!cacheable(request)) return respond();
  const key = pageCacheKey(request, version, appOrigin);
  const cache = await caches.open("pagine-pubbliche");
  const hit = await cache.match(key).catch(() => undefined);
  if (hit) {
    const response = new Response(hit.body, hit);
    response.headers.set("cache-control", "no-store");
    return response;
  }
  const page = { stored: true };
  const response = await sharedPage.run(page, respond);
  if (!page.stored || response.status !== 200 || response.headers.has("set-cookie"))
    return response;
  // La pagina è piccola: un solo corpo letto per intero serve al browser e alla copia.
  const body = await response.arrayBuffer();
  const copy = new Response(body, response);
  copy.headers.set("cache-control", `public, max-age=${pageCacheSeconds}`);
  const stored = cache.put(key, copy).catch(() => {});
  if (typeof context?.waitUntil === "function") context.waitUntil(stored);
  else await stored;
  return new Response(body, response);
}
