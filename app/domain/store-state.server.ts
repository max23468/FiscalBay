/**
 * Frammenti SQL sul negozio (nome mostrato e condizioni sul suo stato), condivisi dalle query
 * che leggono, importano o consultano i suoi dati. Gli argomenti sono espressioni SQL (alias o parametri), mai valori.
 */

/** Nome mostrato del negozio: quello del negozio eBay, altrimenti lo username dell'account. */
export const storeNameSql = (store: string) =>
  `COALESCE(${store}.store_name, ${store}.display_name, ${store}.ebay_account_id, ${store}.ebay_user_id)`;

/** Nome mostrato con «(Sandbox)» per un negozio dell'ambiente di prova eBay. */
export const storeLabelSql = (store: string) =>
  `${storeNameSql(store)} ||
    CASE WHEN ${store}.ebay_environment = 'sandbox' THEN ' (Sandbox)' ELSE '' END`;

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

/** Il negozio è in pausa per il piano: il Free ne serve uno solo. */
export const planPausedStore = (storeId: string) =>
  `EXISTS (SELECT 1 FROM ebay_store_pauses p WHERE p.store_id = ${storeId} AND p.reason = 'plan')`;

/** Dati del negozio consultabili: non eliminati; la pausa del piano li esclude, quella manuale no. */
export const consultableStore = (store: string) =>
  `${store}.data_deleted_at IS NULL AND NOT ${planPausedStore(`${store}.id`)}`;

/** Consenso non rifiutato e ancora rinnovabile all'istante `at`. Argomento: alias delle credenziali. */
export const renewableConsent = (credentials: string, at: string) =>
  `${credentials}.rejected_at IS NULL AND ${credentials}.refresh_expires_at > ${at}`;

/** Negozio da ricollegare: scollegato o senza un consenso ancora rinnovabile all'istante `at`. */
export const reconnectStore = (store: string, at: string) =>
  `(${store}.disconnected_at IS NOT NULL OR NOT EXISTS (SELECT 1 FROM ebay_store_credentials c
     WHERE c.store_id = ${store}.id AND ${renewableConsent("c", at)}))`;

/**
 * Ordine che compare negli elenchi all'istante `at`: non unito a un altro, ancora conservato e
 * pagato. Argomento: alias dell'ordine.
 */
export const listedOrder = (order: string, at: string) =>
  `${order}.merged_into IS NULL AND ${order}.retention_until > ${at} AND ${order}.is_provisional = 0`;

/**
 * Le scritture di un'importazione valgono solo per il consenso con cui è partita: dopo uno
 * scollegamento, un'eliminazione dei dati, un nuovo consenso o una pausa non scrivono nulla.
 * Parametri: ?1 negozio, ?2 data del consenso.
 */
export const writableStore = `EXISTS (SELECT 1 FROM ebay_store_credentials
   WHERE store_id = ?1 AND granted_at = ?2 AND rejected_at IS NULL)
  AND ${unpausedStore("?1")}`;
