/**
 * Dataset sintetico del caso di riferimento per le misure di capacità (§36): spazi Premium e Free
 * con un negozio e circa 100 ordini al mese, più uno spazio Premium grande con più negozi. I
 * Premium conservano un anno di ordini e i Free trenta giorni, con i termini che l'app assegna:
 * oltre 70.000 ordini con tre articoli, identificativi fiscali, verifiche, riferimenti
 * Fulfillment e i cinque sblocchi mensili degli spazi Free.
 * Le righe si generano in SQL, così la stessa sequenza popola la D1 della suite Workers e quella
 * locale dell'anteprima. Ogni identificativo inizia con `cap-` e nessun valore è reale.
 * Le versioni dei termini arrivano dal chiamante: il modulo resta senza import, eseguibile anche
 * da Node per gli script.
 */
export type CapacityShape = {
  /** Spazi con un negozio, escluso quello grande: i primi `premium` hanno Premium. */
  workspaces: number;
  premium: number;
  /** Ordini conservati da un negozio Premium (un anno) e da un negozio Free (trenta giorni). */
  premiumOrders: number;
  freeOrders: number;
  /** Negozi e ordini per negozio dello spazio Premium grande. */
  largeStores: number;
  largeOrdersPerStore: number;
  /** Istante di riferimento: gli ordini lo precedono. */
  now: string;
};

/** 50 spazi Premium, uno dei quali con tre negozi, e 100 Free: 78.802 ordini. */
export const referenceShape: CapacityShape = {
  workspaces: 149,
  premium: 49,
  premiumOrders: 1_200,
  freeOrders: 100,
  largeStores: 3,
  largeOrdersPerStore: 3_334,
  now: "2026-10-28T12:00:00.000Z",
};

export const largeWorkspace = "cap-w-large";
export const largeStore = (index: number) => `cap-s-large-${index}`;
export const workspaceId = (index: number) => `cap-w-${String(index).padStart(3, "0")}`;
export const storeId = (index: number) => `cap-s-${String(index).padStart(3, "0")}`;
/** Utente proprietario e token della sua sessione, uno per spazio. */
export const userOf = (workspace: string) => workspace.replace("cap-w-", "cap-u-");
export const sessionToken = (workspace: string) => workspace.replace("cap-w-", "cap-session-");

export function orderCount(shape: CapacityShape) {
  return (
    shape.premium * shape.premiumOrders +
    (shape.workspaces - shape.premium) * shape.freeOrders +
    shape.largeStores * shape.largeOrdersPerStore
  );
}

/** Numeri da 0 a `last`, per generare righe in SQL. */
const sequence = (last: number) =>
  `WITH RECURSIVE seq(n) AS (SELECT 0 UNION ALL SELECT n + 1 FROM seq WHERE n < ${last})`;

const iso = (expression: string) => `strftime('%Y-%m-%dT%H:%M:%fZ', ${expression})`;

/** Istruzioni SQL del dataset, nell'ordine in cui vanno eseguite. */
export function capacityStatements(
  shape: CapacityShape,
  legalVersions: { terms: string; privacy: string },
): string[] {
  const { now } = shape;
  const day = `'${now}'`;
  const workspaces = [
    ...Array.from({ length: shape.workspaces }, (_, index) => ({
      id: workspaceId(index),
      premium: index < shape.premium,
      stores: [storeId(index)],
    })),
    {
      id: largeWorkspace,
      premium: true,
      stores: Array.from({ length: shape.largeStores }, (_, index) => largeStore(index)),
    },
  ];
  const values = (rows: string[][]) =>
    rows.map((row) => `(${row.map((value) => `'${value}'`).join(", ")})`).join(",\n");
  const expires = new Date(Date.parse(now) + 30 * 86_400_000).toISOString();
  const users = workspaces.map(({ id }) => userOf(id));
  const stores = workspaces.flatMap(({ id, stores }) => stores.map((store) => [store, id]));
  return [
    `INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt") VALUES
     ${values(users.map((user) => [user, "Venditore sintetico", `${user}@example.invalid`, "1", "2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z"]))}`,
    `INSERT INTO user_profiles (user_id, first_name, last_name, account_type, company_name, updated_at)
     SELECT id, 'Utente', 'Sintetico', 'private', NULL, ${day} FROM "user" WHERE id LIKE 'cap-u-%'`,
    `INSERT INTO terms_acceptances (user_id, terms_version, privacy_version, language, accepted_at)
     SELECT id, '${legalVersions.terms}', '${legalVersions.privacy}', 'it', ${day}
       FROM "user" WHERE id LIKE 'cap-u-%'`,
    `INSERT INTO session (id, token, "userId", "expiresAt", "createdAt", "updatedAt") VALUES
     ${values(workspaces.map(({ id }) => [sessionToken(id), sessionToken(id), userOf(id), expires, now, now]))}`,
    `INSERT INTO workspaces (id, name, created_at) VALUES
     ${values(workspaces.map(({ id }) => [id, "Spazio sintetico", "2026-01-01T00:00:00.000Z"]))}`,
    `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES
     ${values(workspaces.map(({ id }) => [id, userOf(id), "owner"]))}`,
    `INSERT INTO workspace_entitlements (id, workspace_id, source, starts_at, ends_at) VALUES
     ${values(
       workspaces
         .filter(({ premium }) => premium)
         .map(({ id }) => [
           `${id}-premium`,
           id,
           "premium",
           "2026-01-01T00:00:00.000Z",
           "2027-12-31T00:00:00.000Z",
         ]),
     )}`,
    // Profilo del negozio letto il giorno prima: la lettura settimanale non è dovuta.
    `INSERT INTO ebay_stores (id, workspace_id, ebay_user_id, linked_at, display_name, store_profile_read_at) VALUES
     ${values(stores.map(([store, workspace]) => [store!, workspace!, `${store}-ebay`, "2026-01-01T00:00:00.000Z", store!, new Date(Date.parse(now) - 86_400_000).toISOString()]))}`,
    // Token che non si aprono e lontani dalla scadenza: nessuna chiamata parte dal dataset.
    `INSERT INTO ebay_store_credentials
       (store_id, access_token, access_expires_at, refresh_token, refresh_expires_at, granted_at)
     SELECT id, 'v1.sintetico', '2099-01-01T00:00:00.000Z', 'v1.sintetico', '2099-01-01T00:00:00.000Z',
            '2026-01-01T00:00:00.000Z' FROM ebay_stores WHERE id LIKE 'cap-s-%'`,
    // Storico concluso, ultima lettura e passata Trading un'ora prima: ogni negozio è dovuto al
    // prossimo cron, la passata Trading dei modificati no.
    `INSERT INTO sync_state (store_id, last_success_at, polled_at, updated_at, history_from,
                             history_done_at, history_through, trading_cursor)
     SELECT id, ${iso(`${day}, '-1 hour'`)}, ${iso(`${day}, '-1 hour'`)}, ${day},
            '2025-10-28T12:00:00.000Z', '2026-01-02T00:00:00.000Z', '2025-10-28T12:00:00.000Z',
            ${iso(`${day}, '-1 hour'`)}
       FROM ebay_stores WHERE id LIKE 'cap-s-%'`,
    ...capacityStoreStatements(shape),
  ];
}

/**
 * Ordini e righe collegate di un negozio, o di tutti i negozi del dataset senza `store`. Sulla
 * D1 remota si eseguono negozio per negozio: un'istruzione su centinaia di migliaia di righe
 * supera i limiti di esecuzione.
 */
export function capacityStoreStatements(shape: CapacityShape, store?: string): string[] {
  const day = `'${shape.now}'`;
  const largestOrders = Math.max(shape.premiumOrders, shape.freeOrders, shape.largeOrdersPerStore);
  const premiumSql = (workspace: string) =>
    `EXISTS (SELECT 1 FROM workspace_entitlements e WHERE e.workspace_id = ${workspace})`;
  // Ordini del negozio e minuti fra uno e il successivo: un anno nel Premium, trenta giorni nel Free.
  const orders = `CASE WHEN s.workspace_id = '${largeWorkspace}' THEN ${shape.largeOrdersPerStore}
    WHEN ${premiumSql("s.workspace_id")} THEN ${shape.premiumOrders} ELSE ${shape.freeOrders} END`;
  const spacing = `(CASE WHEN ${premiumSql("s.workspace_id")} THEN 525600.0 ELSE 43200.0 END
    / (${orders}))`;
  const created = `${iso(`${day}, '-' || CAST(seq.n * ${spacing} AS INTEGER) || ' minutes'`)}`;
  // Termini come li assegna l'app: un anno dalla data dell'ordine nel Premium, trenta giorni nel Free.
  const term = `CASE WHEN ${premiumSql("s.workspace_id")} THEN ${iso(`${created}, '+12 months'`)}
    ELSE ${iso(`${created}, '+30 days'`)} END`;
  const stores = store ? `s.id = '${store}'` : "s.id LIKE 'cap-s-%'";
  const ordersOf = store ? `o.store_id = '${store}'` : "o.id LIKE 'cap-s-%'";
  return [
    `${sequence(largestOrders - 1)}
     INSERT INTO orders (id, store_id, ebay_order_id, creation_time, last_modified_time, currency,
                         total_minor, marketplace_id, payment_status, fulfillment_status, buyer_json,
                         retention_until, purge_after, listed_at)
     SELECT s.id || '-o-' || seq.n, s.id, printf('%02d-%05d-%05d', seq.n % 100, seq.n, s.rowid),
            ${created}, ${created},
            'EUR', 1299 + seq.n % 5000, 'EBAY_IT', 'PAID', 'FULFILLED',
            json_object('username', 'acquirente-' || seq.n, 'name', 'Acquirente Sintetico ' || seq.n,
              'email', NULL, 'phone', NULL,
              'billingAddress', json_object('addressLine1', 'Via Sintetica ' || seq.n,
                'addressLine2', NULL, 'city', 'Roma', 'postalCode', '00100',
                'stateOrProvince', 'RM', 'countryCode', 'IT'),
              'shipTo', NULL),
            ${term}, ${term}, ${day}
       FROM ebay_stores s JOIN seq ON seq.n < ${orders}
      WHERE ${stores}`,
    `INSERT INTO order_items (id, order_id, line_item_id, sku, title, quantity, total_minor, currency)
     SELECT o.id || '-' || k.n, o.id, 'line-' || k.n, 'SKU-' || k.n,
            'Articolo sintetico ' || k.n || ' ' || substr(o.ebay_order_id, -5), 1 + k.n, 433, 'EUR'
       FROM orders o, (SELECT 0 AS n UNION ALL SELECT 1 UNION ALL SELECT 2) k
      WHERE ${ordersOf}`,
    `INSERT INTO order_source_refs (store_id, source, external_order_id, order_id, last_modified_time, detail_for)
     SELECT o.store_id, 'fulfillment', o.ebay_order_id, o.id, o.last_modified_time, o.last_modified_time
       FROM orders o WHERE ${ordersOf}`,
    `INSERT INTO order_tax_checks (order_id, source, last_modified_time, observed_at, availability)
     SELECT o.id, 'ebay_trading_get_orders', o.last_modified_time, o.last_modified_time, 'present'
       FROM orders o WHERE ${ordersOf}`,
    // Un codice fiscale per ordine e una partita IVA ogni cinque ordini.
    `INSERT INTO tax_identifiers (id, order_id, identifier_type, issuing_country, value, source, observed_at)
     SELECT o.id || '-cf', o.id, 'CODICE_FISCALE', 'IT', 'RSSMRA80A01H501U', 'synthetic_fixture', o.last_modified_time
       FROM orders o WHERE ${ordersOf}`,
    `INSERT INTO tax_identifiers (id, order_id, identifier_type, issuing_country, value, source, observed_at)
     SELECT o.id || '-iva', o.id, 'VAT_ID', 'IT', '00123456789', 'synthetic_fixture', o.last_modified_time
       FROM orders o WHERE ${ordersOf} AND o.rowid % 5 = 0`,
    // Negli spazi Free è consultabile un ordine ogni venti: i cinque sblocchi della quota mensile.
    `INSERT INTO order_grants (id, workspace_id, order_id, source, granted_at)
     SELECT o.id || '-grant', s.workspace_id, o.id, 'admin', o.last_modified_time
       FROM orders o JOIN ebay_stores s ON s.id = o.store_id
      WHERE ${ordersOf} AND o.rowid % 20 = 0
        AND NOT EXISTS (SELECT 1 FROM workspace_entitlements e WHERE e.workspace_id = s.workspace_id)`,
  ];
}

/**
 * Testo di ricerca calcolato in SQL, uguale a quello dell'app per i valori ASCII del dataset:
 * popola la D1 dell'anteprima senza passare dai compiti periodici. La suite lo confronta con
 * l'indicizzazione dell'app.
 */
export const searchTextSql = `lower(o.ebay_order_id || ' ' ||
  COALESCE(json_extract(o.buyer_json, '$.name'), '') || ' ' ||
  COALESCE(json_extract(o.buyer_json, '$.username'), '') ||
  COALESCE((SELECT group_concat(' ' || title || ' ' || COALESCE(sku, ''), '')
    FROM (SELECT title, sku FROM order_items WHERE order_id = o.id ORDER BY rowid)), ''))`;

/** Testo di ricerca degli ordini di un negozio, o di tutti i negozi del dataset. */
export const searchIndexStatement = (store?: string) =>
  `UPDATE orders AS o SET search_text = ${searchTextSql}
  WHERE ${store ? `o.store_id = '${store}'` : "o.id LIKE 'cap-s-%'"} AND o.search_text IS NULL`;
