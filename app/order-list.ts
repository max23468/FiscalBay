/** Ordini mostrati per ogni «Carica altri», nell'area reale e nell'anteprima. */
export const ordersPageSize = 6;

/** Pagine dell'elenco già caricate con «Carica altri». */
export const pagesParam = "mostra";

/**
 * Istantanea dell'elenco aperto: gli ordini entrati negli elenchi dopo di essa non si
 * inseriscono fra quelli già letti, così «Carica altri», dettaglio, Indietro e ricarica
 * ritrovano lo stesso ordine. Nell'indirizzo è un cursore opaco.
 */
export const snapshotParam = "vista";

/** Cursore opaco dell'istantanea; l'ordine dell'elenco è sempre dal più recente, poi per ID. */
export function snapshotCursor(at: Date): string {
  return at.getTime().toString(36);
}

/** Istante dell'istantanea; null se il cursore è assente o non valido. */
export function snapshotInstant(cursor: string | null): Date | null {
  if (!cursor || !/^[0-9a-z]{1,10}$/u.test(cursor)) return null;
  const at = new Date(Number.parseInt(cursor, 36));
  return Number.isNaN(at.getTime()) ? null : at;
}

/** Parametri che appartengono all'elenco aperto: un nuovo filtro o una nuova ricerca li toglie. */
export function withoutListPosition(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  next.delete(pagesParam);
  next.delete(snapshotParam);
  return next;
}

/**
 * L'unico cambio è l'istantanea aggiunta all'indirizzo che ne era privo: la pagina la riceve
 * già dalla risposta che sta mostrando e non serve una nuova lettura.
 */
export function snapshotOnlyAdded(current: URL, next: URL): boolean {
  if (current.pathname !== next.pathname || current.searchParams.has(snapshotParam)) return false;
  if (!next.searchParams.has(snapshotParam)) return false;
  const rest = new URLSearchParams(next.searchParams);
  rest.delete(snapshotParam);
  return rest.toString() === current.searchParams.toString();
}

/**
 * Negozio ricordato fra le sessioni nel browser, insieme all'ordinamento che è sempre dal più
 * recente. Ricerca, periodo e altri filtri sono temporanei e non si ricordano.
 */
export const rememberedStoreCookie = "fiscalbay-negozio";

/** Ricorda o dimentica nel browser il negozio scelto fra i filtri. */
export function rememberStore(storeId: string | null) {
  const secure = location.protocol === "https:" ? "; secure" : "";
  document.cookie = storeId
    ? `${rememberedStoreCookie}=${encodeURIComponent(storeId)}; path=/; max-age=31536000; samesite=lax${secure}`
    : `${rememberedStoreCookie}=; path=/; max-age=0; samesite=lax${secure}`;
}

/** Negozio ricordato nella richiesta, se fra quelli che l'elenco può filtrare. */
export function rememberedStore(cookie: string | null, storeIds: readonly string[]): string | null {
  const value = cookie
    ?.split(/;\s*/u)
    .find((part) => part.startsWith(`${rememberedStoreCookie}=`))
    ?.slice(rememberedStoreCookie.length + 1);
  if (!value) return null;
  let id: string;
  try {
    id = decodeURIComponent(value);
  } catch {
    return null;
  }
  // Il filtro del negozio compare soltanto con più negozi: con uno solo resterebbe invisibile.
  return storeIds.length > 1 && storeIds.includes(id) ? id : null;
}
