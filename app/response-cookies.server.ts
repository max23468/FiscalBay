import { AsyncLocalStorage } from "node:async_hooks";

// Cookie che una lettura lato server deve restituire al browser, come il rinnovo della
// sessione: le route non ne conoscono la risposta finale, che li riceve qui.
const requestCookies = new AsyncLocalStorage<Headers>();

function cookieName(cookie: string): string {
  return cookie.slice(0, cookie.indexOf("=")).trim();
}

/** Accoda i `set-cookie` alla risposta della richiesta in corso; fuori da una richiesta li ignora. */
export function queueResponseCookies(headers: Headers): void {
  const pending = requestCookies.getStore();
  for (const cookie of headers.getSetCookie()) pending?.append("set-cookie", cookie);
}

/**
 * Esegue la richiesta e aggiunge alla risposta i cookie accodati. Un cookie che la risposta
 * imposta già, come la sessione nuova di un accesso o quella chiusa da un'uscita, prevale.
 */
export async function withResponseCookies(run: () => Promise<Response>): Promise<Response> {
  const pending = new Headers();
  const response = await requestCookies.run(pending, run);
  const set = new Set(response.headers.getSetCookie().map(cookieName));
  const added = pending.getSetCookie().filter((cookie) => !set.has(cookieName(cookie)));
  if (added.length === 0) return response;
  const headers = new Headers(response.headers);
  for (const cookie of added) headers.append("set-cookie", cookie);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
