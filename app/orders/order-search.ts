/**
 * Regole della ricerca ordini, uguali per l'area reale, l'anteprima e la barra superiore.
 * Il confronto ignora maiuscole e accenti di qualunque alfabeto: «lucia» trova «Lucía».
 */

/** Parametro dell'indirizzo con la ricerca attiva: un testo cifrato, mai la query in chiaro. */
export const searchParam = "ricerca";

/** Caratteri considerati di una ricerca; il resto si ignora. */
export const maxSearchLength = 200;

/** Lunghezza minima per i suggerimenti della barra superiore. */
export const minSuggestionLength = 2;

/** Forma di confronto: minuscole e senza segni diacritici. */
export function searchFold(text: string): string {
  return text.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "");
}

/** Testo cercato nei limiti ammessi, oppure null se resta vuoto. */
export function searchQuery(value: unknown): string | null {
  const query = typeof value === "string" ? value.trim().slice(0, maxSearchLength).trim() : "";
  return query || null;
}

/** Parole della ricerca nella forma di confronto, al massimo dieci: ognuna deve comparire. */
export function searchTokens(query: string | null): string[] {
  return query ? searchFold(query).split(/\s+/u).filter(Boolean).slice(0, 10) : [];
}

/**
 * Testo cercabile di un ordine senza dati fiscali: numero, acquirente, titoli e SKU. I valori
 * fiscali si confrontano a parte, soltanto se l'utente vi ha accesso.
 */
export function orderSearchText(order: {
  ebayOrderId: string;
  buyerName: string | null | undefined;
  buyerUsername: string | null | undefined;
  items: ReadonlyArray<{ title: string; sku: string | null | undefined }>;
}): string {
  return searchFold(
    [
      order.ebayOrderId,
      order.buyerName ?? "",
      order.buyerUsername ?? "",
      ...order.items.flatMap((item) => [item.title, item.sku ?? ""]),
    ].join(" "),
  );
}
