import { searchParam, searchQuery } from "./order-search";
import { seal, unseal } from "./sealed.server";

/**
 * La ricerca attiva resta nell'indirizzo cifrata, così dettaglio, Indietro e ricarica la
 * conservano senza esporre un Codice Fiscale o una Partita IVA in URL, referrer o log. Il testo
 * è legato a utente e sessione: in un'altra sessione, o per un altro utente, non si apre e la
 * ricerca si dimentica.
 */
const purpose = "fiscalbay/order-search/v1";

/** Un testo cifrato della ricerca più lunga resta sotto questa misura. */
const maxTokenLength = 1024;

export function accountSearchScope(session: { user: { id: string }; session: { id: string } }) {
  return `${session.user.id}:${session.session.id}`;
}

export function sealSearch(secret: string, scope: string, query: string): Promise<string> {
  return seal(secret, purpose, scope, query);
}

/** Ricerca dell'indirizzo; null se assente, alterata o di un'altra sessione. */
export async function openSearch(
  secret: string,
  scope: string,
  params: URLSearchParams,
): Promise<string | null> {
  const token = params.get(searchParam);
  if (!token || token.length > maxTokenLength) return null;
  try {
    return searchQuery(await unseal(secret, purpose, scope, token));
  } catch {
    return null;
  }
}

/** Indirizzo dell'elenco con la sola ricerca indicata, oltre ai parametri conservati. */
export async function searchHref(
  secret: string,
  scope: string,
  path: string,
  query: string,
  kept: URLSearchParams = new URLSearchParams(),
): Promise<string> {
  const params = new URLSearchParams(kept);
  params.set(searchParam, await sealSearch(secret, scope, query));
  return `${path}?${params}`;
}
