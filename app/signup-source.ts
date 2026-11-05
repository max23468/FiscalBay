/**
 * Provenienza degli iscritti (D304): la categoria del canale da cui un visitatore arriva sul sito
 * e la prima pagina vista. Il Worker la ricava dal Referer, che con `strict-origin-when-cross-origin`
 * porta la sola origine, o da un'etichetta nei link che pubblichiamo; poi viaggia nell'indirizzo
 * dei link interni fino alla registrazione. Nessun cookie né archivio del browser.
 */

import { canonicalPath } from "./i18n";

/** Categorie chiuse, nell'ordine della console. */
export const signupChannels = [
  "google",
  "bing",
  "other_search",
  "ai_assistant",
  "ebay_community",
  "ebay_other",
  "github",
  "youtube",
  "reddit",
  "telegram",
  "email",
  "other_site",
  "direct",
  "unknown",
] as const;
export type SignupChannel = (typeof signupChannels)[number];

/** Etichette ammesse nei link che pubblichiamo: valgono più del Referer. */
export const labelledChannels = [
  "ebay_community",
  "github",
  "youtube",
  "reddit",
  "telegram",
  "email",
] as const satisfies readonly SignupChannel[];

/** Parametro dell'indirizzo, per le etichette e per la propagazione fra le pagine. */
export const sourceParam = "via";

export type SignupSource = {
  channel: SignupChannel;
  /** Percorso della prima pagina vista, senza query; null soltanto per «unknown». */
  firstPage: string | null;
};

/** Percorso di una pagina del sito: minuscole, cifre, trattini e barre, mai una query. */
const pagePattern = /^\/[a-z0-9/_-]{0,119}$/u;

/** Origini note, verificate in ordine: il primo dominio che corrisponde decide la categoria. */
const hostChannels: [RegExp, SignupChannel][] = [
  [/(^|\.)(mail\.google\.com|outlook\.(live|office)\.com|mail\.yahoo\.com)$/u, "email"],
  [
    /(^|\.)(chatgpt\.com|chat\.openai\.com|perplexity\.ai|claude\.ai|gemini\.google\.com|copilot\.microsoft\.com)$/u,
    "ai_assistant",
  ],
  [/(^|\.)google\.[a-z]{2,3}(\.[a-z]{2})?$/u, "google"],
  [/(^|\.)bing\.com$/u, "bing"],
  [
    /(^|\.)(duckduckgo\.com|yahoo\.com|ecosia\.org|qwant\.com|search\.brave\.com|startpage\.com|yandex\.[a-z]{2,3}|baidu\.com)$/u,
    "other_search",
  ],
  [/(^|\.)community\.ebay\.[a-z]{2,3}(\.[a-z]{2})?$/u, "ebay_community"],
  [/(^|\.)ebay\.[a-z]{2,3}(\.[a-z]{2})?$/u, "ebay_other"],
  [/(^|\.)github\.com$/u, "github"],
  [/(^|\.)(youtube\.com|youtu\.be)$/u, "youtube"],
  [/(^|\.)(reddit\.com|redd\.it)$/u, "reddit"],
  [/(^|\.)(t\.me|telegram\.org|telegram\.me)$/u, "telegram"],
];

/** Categoria di un host esterno; un host sconosciuto è un altro sito. */
export function channelFromHost(host: string): SignupChannel {
  const name = host.toLowerCase().replace(/\.$/u, "");
  return hostChannels.find(([pattern]) => pattern.test(name))?.[1] ?? "other_site";
}

/**
 * Valore del parametro: un'etichetta dell'elenco chiuso, oppure categoria e prima pagina
 * (`google:/prezzi`) propagate dai link interni. Qualunque altro valore è ignorato.
 */
export function parseSource(value: string | null | undefined): SignupSource | null {
  if (!value || value.length > 160) return null;
  const separator = value.indexOf(":");
  if (separator < 0) {
    return (labelledChannels as readonly string[]).includes(value)
      ? { channel: value as SignupChannel, firstPage: null }
      : null;
  }
  const channel = value.slice(0, separator);
  const firstPage = value.slice(separator + 1);
  if (channel === "unknown" || !(signupChannels as readonly string[]).includes(channel))
    return null;
  if (!pagePattern.test(firstPage)) return null;
  return { channel: channel as SignupChannel, firstPage };
}

export function formatSource(source: SignupSource): string {
  return source.firstPage ? `${source.channel}:${source.firstPage}` : source.channel;
}

/**
 * Provenienza di una richiesta di pagina: il parametro vale più del Referer; un Referer della
 * stessa origine non è un nuovo arrivo e dà null, l'assenza di Referer vale «direct». La prima
 * pagina è il percorso richiesto, se non arriva già con il parametro.
 */
export function arrivalSource(request: Request, appOrigin: string): SignupSource | null {
  const url = new URL(request.url);
  const page = pagePattern.test(url.pathname) ? url.pathname : null;
  const labelled = parseSource(url.searchParams.get(sourceParam));
  if (labelled) return { channel: labelled.channel, firstPage: labelled.firstPage ?? page };
  const referer = request.headers.get("referer");
  let from: URL | null = null;
  try {
    from = referer ? new URL(referer) : null;
  } catch {
    // Un Referer illeggibile non dice da dove si arriva.
  }
  if (!from) return { channel: "direct", firstPage: page };
  if (from.host === new URL(appOrigin).host) return null;
  const channel = /^https?:$/u.test(from.protocol) ? channelFromHost(from.hostname) : "other_site";
  return { channel, firstPage: page };
}

/** Pagine dove la provenienza non serve, sul percorso italiano: area, console, anteprima, API e file. */
const outsideSite = /^\/(app|admin|anteprima|api)(\/|$)|\.[a-z0-9]+$/u;

/**
 * Link interno con la provenienza, per le sole pagine del sito e dell'accesso. Query e
 * frammento restano come sono, così `?registrati` non diventa `?registrati=`; un valore già
 * presente si sostituisce. Gli altri link tornano invariati.
 */
export function withSource(href: string, source: string, origin: string): string {
  // Soltanto percorsi assoluti o indirizzi completi: un frammento resta nella pagina.
  if (!/^\/(?!\/)/u.test(href) && !href.startsWith(`${origin}/`)) return href;
  const url = new URL(href, origin);
  if (url.origin !== new URL(origin).origin || outsideSite.test(canonicalPath(url.pathname)))
    return href;
  const hash = href.indexOf("#");
  const head = hash < 0 ? href : href.slice(0, hash);
  const fragment = hash < 0 ? "" : href.slice(hash);
  const [path, query = ""] = head.split(/\?(.*)/su);
  const kept = query
    .split("&")
    .filter((pair) => pair && pair.split("=")[0] !== sourceParam)
    .concat(`${sourceParam}=${encodeURIComponent(source)}`)
    .join("&");
  return `${path}?${kept}${fragment}`;
}

/** Indirizzo senza il parametro, per ripulire la barra del browser. */
export function withoutSource(href: string): string {
  const url = new URL(href);
  if (!url.searchParams.has(sourceParam)) return href;
  const [head, fragment = ""] = href.split(/#(.*)/su);
  const [path, query = ""] = head!.split(/\?(.*)/su);
  const kept = query
    .split("&")
    .filter((pair) => pair && pair.split("=")[0] !== sourceParam)
    .join("&");
  return `${path}${kept ? `?${kept}` : ""}${fragment ? `#${fragment}` : ""}`;
}

type View = Pick<Window, "location" | "history" | "document">;

/**
 * Porta la provenienza nei link interni della pagina e la toglie dalla barra dell'indirizzo,
 * così un link copiato o condiviso non la trasmette. Usa soltanto gli attributi dei link e la
 * voce corrente della cronologia: nessun cookie né archivio del browser. I link disegnati dopo
 * l'avvio la ricevono al clic. Restituisce la funzione che rimuove gli ascoltatori.
 */
export function carrySource(arrival: string, view: View): () => void {
  const { document, history, location } = view;
  const carry = (anchor: HTMLAnchorElement) => {
    const href = anchor.getAttribute("href");
    if (href) anchor.setAttribute("href", withSource(href, arrival, location.origin));
  };
  for (const anchor of document.querySelectorAll<HTMLAnchorElement>("a[href]")) carry(anchor);
  history.replaceState(history.state, "", withoutSource(location.href));
  const onClick = (event: Event) => {
    const anchor = (event.target as Element | null)?.closest?.("a[href]");
    if (anchor) carry(anchor as HTMLAnchorElement);
  };
  document.addEventListener("click", onClick, true);
  document.addEventListener("auxclick", onClick, true);
  return () => {
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("auxclick", onClick, true);
  };
}
