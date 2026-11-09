import type { ShouldRevalidateFunctionArgs } from "react-router";

import { listFilterParams, snapshotParam } from "./order-criteria";

/** Ordini mostrati per ogni «Carica altri», nell'area reale e nell'anteprima. */
export const ordersPageSize = 6;

/** Pagine dell'elenco già caricate con «Carica altri». */
export const pagesParam = "mostra";

/**
 * Soli filtri dell'elenco da un indirizzo, con valori brevi: li conserva la ricerca della barra
 * superiore avviata dagli Ordini.
 */
export function listFilters(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams();
  for (const name of listFilterParams) {
    const value = params.get(name);
    if (value && value.length <= 64) next.set(name, value);
  }
  return next;
}

/** Parametri che appartengono all'elenco aperto: un nuovo filtro o una nuova ricerca li toglie. */
export function withoutListPosition(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  next.delete(pagesParam);
  next.delete(snapshotParam);
  return next;
}

/** Criteri dell'elenco: due indirizzi con la stessa chiave mostrano gli stessi ordini. */
export function listKey(search: string): string {
  return withoutListPosition(new URLSearchParams(search)).toString();
}

/**
 * Indirizzo dell'elenco da mostrare nei controlli: durante una navigazione che resta sulla stessa
 * pagina vale quello in arrivo, così un filtro appena scelto non torna al valore precedente.
 * `changing` dice se cambiano i criteri e non soltanto le pagine caricate o l'istantanea.
 */
export function pendingList(
  current: { pathname: string; search: string },
  next: { pathname: string; search: string } | undefined,
): { search: string; changing: boolean } {
  if (!next || next.pathname !== current.pathname)
    return { search: current.search, changing: false };
  return { search: next.search, changing: listKey(next.search) !== listKey(current.search) };
}

/**
 * L'unico cambio è l'istantanea aggiunta all'indirizzo che ne era privo: la pagina la riceve
 * già dalla risposta che sta mostrando e non serve una nuova lettura.
 */
function snapshotOnlyAdded(current: URL, next: URL): boolean {
  if (current.pathname !== next.pathname || current.searchParams.has(snapshotParam)) return false;
  if (!next.searchParams.has(snapshotParam)) return false;
  const rest = new URLSearchParams(next.searchParams);
  rest.delete(snapshotParam);
  return rest.toString() === current.searchParams.toString();
}

/** Regola di nuova lettura delle pagine che mostrano l'elenco Ordini o lo contengono. */
export function revalidateUnlessSnapshot({
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
}: Pick<ShouldRevalidateFunctionArgs, "currentUrl" | "nextUrl" | "defaultShouldRevalidate">) {
  return snapshotOnlyAdded(currentUrl, nextUrl) ? false : defaultShouldRevalidate;
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
  try {
    const id = decodeURIComponent(value);
    // Il filtro del negozio compare soltanto con più negozi: con uno solo resterebbe invisibile.
    return storeIds.length > 1 && storeIds.includes(id) ? id : null;
  } catch {
    return null;
  }
}

/**
 * Un nuovo accesso agli Ordini, senza filtri né ordine aperto, riapre l'elenco `ordersHref` sul
 * negozio scelto l'ultima volta, se è fra quelli filtrabili; null altrimenti.
 */
export function rememberedStoreHref(
  request: Request,
  ordersHref: string,
  openedOrder: string | undefined,
  storeIds: readonly string[],
): string | null {
  if (new URL(request.url).searchParams.size > 0 || openedOrder) return null;
  const store = rememberedStore(request.headers.get("cookie"), storeIds);
  return store ? `${ordersHref}?${new URLSearchParams({ negozio: store })}` : null;
}
