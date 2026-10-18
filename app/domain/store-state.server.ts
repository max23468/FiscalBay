/**
 * Condizioni SQL sullo stato di un negozio, condivise dalle query che leggono, importano o
 * consultano i suoi dati. Gli argomenti sono espressioni SQL (alias o parametri), mai valori.
 */

/** Il negozio non ha pause di alcun tipo. */
export const unpausedStore = (storeId: string) =>
  `NOT EXISTS (SELECT 1 FROM ebay_store_pauses p WHERE p.store_id = ${storeId})`;

/**
 * Consenso non rifiutato, negozio collegato e senza pause: si può chiamare eBay per suo conto.
 * Argomenti: alias delle credenziali e del negozio.
 */
export const activeStore = (credentials: string, store: string) =>
  `${credentials}.rejected_at IS NULL AND ${store}.disconnected_at IS NULL
   AND ${unpausedStore(`${credentials}.store_id`)}`;

/** Dati del negozio consultabili: non eliminati; la pausa del piano li esclude, quella manuale no. */
export const consultableStore = (store: string) =>
  `${store}.data_deleted_at IS NULL AND NOT EXISTS (
     SELECT 1 FROM ebay_store_pauses p WHERE p.store_id = ${store}.id AND p.reason = 'plan')`;

/**
 * Le scritture di un'importazione valgono solo per il consenso con cui è partita: dopo uno
 * scollegamento, un'eliminazione dei dati, un nuovo consenso o una pausa non scrivono nulla.
 * Parametri: ?1 negozio, ?2 data del consenso.
 */
export const writableStore = `EXISTS (SELECT 1 FROM ebay_store_credentials
   WHERE store_id = ?1 AND granted_at = ?2 AND rejected_at IS NULL)
  AND ${unpausedStore("?1")}`;
