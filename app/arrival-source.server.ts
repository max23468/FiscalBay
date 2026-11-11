import { createIsbotFromList, list } from "isbot";

import {
  channelFromHost,
  parseSource,
  sitePage,
  sourceParam,
  type SignupSource,
} from "./signup-source";

/**
 * Crawler dei motori di ricerca e degli assistenti. Un browser automatico («headless») resta un
 * visitatore: non indicizza i link che segue.
 */
const isCrawler = createIsbotFromList(list.filter((pattern) => pattern !== "headless"));

/**
 * Provenienza di una richiesta di pagina: l'etichetta di un link pubblicato vale più del Referer,
 * un valore propagato solo se non si arriva da un altro sito, perché un motore di ricerca può
 * averlo salvato seguendo i link interni. Un Referer della stessa origine non è un nuovo arrivo e
 * dà null, l'assenza di Referer vale «direct». La prima pagina è il percorso richiesto, se non
 * arriva già con il parametro. Un crawler non è un arrivo: senza provenienza i link che segue
 * restano gli indirizzi canonici.
 */
export function arrivalSource(request: Request, appOrigin: string): SignupSource | null {
  const agent = request.headers.get("user-agent");
  if (agent && isCrawler(agent)) return null;
  const url = new URL(request.url);
  const page = sitePage(url);
  const referer = request.headers.get("referer");
  let from: URL | null = null;
  try {
    from = referer ? new URL(referer) : null;
  } catch {
    // Un Referer illeggibile non dice da dove si arriva.
  }
  const external = from !== null && from.host !== new URL(appOrigin).host;
  const labelled = parseSource(url.searchParams.get(sourceParam));
  if (labelled && !(labelled.firstPage && external))
    return { channel: labelled.channel, firstPage: labelled.firstPage ?? page };
  if (!from) return { channel: "direct", firstPage: page };
  if (!external) return null;
  const channel = /^https?:$/u.test(from.protocol) ? channelFromHost(from.hostname) : "other_site";
  return { channel, firstPage: page };
}
