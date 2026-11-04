/** Metodo della Bot API nel percorso della richiesta, come lo usa il Worker principale. */
const methodPattern = /^\/[A-Za-z]{1,64}$/u;

/**
 * Inoltra a Telegram una chiamata della Bot API ricevuta dal Worker principale, aggiungendo il
 * token del bot all'indirizzo. Restituisce la risposta di Telegram com'è: stato, intestazioni
 * come `Retry-After` e corpo restano da classificare al chiamante.
 */
export async function forward(
  request: Request,
  token: string | undefined,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  const { pathname } = new URL(request.url);
  if (request.method !== "POST" || !methodPattern.test(pathname))
    return new Response(null, { status: 404 });
  if (!token) return new Response(null, { status: 503 });
  return fetcher(`https://api.telegram.org/bot${token}${pathname}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: await request.text(),
  });
}
