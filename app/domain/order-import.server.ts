import { z } from "zod";
import { orderSearchText } from "../orders/order-search";
import { taxComparisonKey, taxIdentifierType } from "../tax-quality";
import { writableStore } from "./store-state.server";

function staleObservation(): OrderObservationResult {
  console.info(JSON.stringify({ event: "stale_order_observation", count: 1 }));
  return { outcome: "stale" };
}

const text = z
  .string()
  .nullish()
  .transform((value) => value ?? null);
const utc = z.iso.datetime().transform((value) => new Date(value).toISOString());
const money = z.object({
  minor: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  currency: z.string().regex(/^[A-Z]{3}$/u),
});
const address = z
  .object({
    addressLine1: text,
    addressLine2: text,
    city: text,
    postalCode: text,
    stateOrProvince: text,
    countryCode: text,
  })
  .nullish()
  .transform((value) => value ?? null);

/** Campi che eBay smette di restituire con l'età dell'ordine. */
export const maskedBuyerFields = [
  "email",
  "name",
  "phone",
  "billingAddress.addressLine1",
  "shipTo.name",
  "shipTo.phone",
  "shipTo.address.addressLine1",
] as const;
export type MaskedBuyerField = (typeof maskedBuyerFields)[number];

/**
 * Snapshot dell'ordine: l'ordine dei campi è fisso, così la stessa lettura dà lo stesso testo.
 * `masked` elenca i campi mascherati da eBay e mai letti prima; vuoto non compare.
 */
export const buyerSnapshotSchema = z.object({
  username: text,
  name: text,
  email: text,
  phone: text,
  billingAddress: address,
  shipTo: z
    .object({ name: text, phone: text, address })
    .nullish()
    .transform((value) => value ?? null),
  masked: z
    .array(z.enum(maskedBuyerFields))
    .optional()
    .transform((value) => (value?.length ? value : undefined)),
});
export type BuyerSnapshot = z.output<typeof buyerSnapshotSchema>;

/**
 * Lettura normalizzata di un ordine da una fonte eBay. `stableKey` è l'identità della riga
 * comprovata dalla fonte, null se la fonte non la fornisce. `taxIdentifiers.complete` dichiara
 * che l'assenza di un valore è una rimozione autorevole; altrimenti i valori assenti restano.
 */
export const orderObservationSchema = z.object({
  source: z.enum(["fulfillment", "trading"]),
  /** Identità stabile dal solo campo EIASToken dell'ordine Trading, mai dallo username. */
  buyerEiasToken: z.string().trim().min(1).max(2048).nullish(),
  externalOrderId: z.string().min(1),
  provisional: z.boolean(),
  creationTime: utc,
  lastModifiedTime: utc,
  marketplaceId: text,
  total: money,
  paymentStatus: text,
  fulfillmentStatus: text,
  cancelStatus: text,
  buyer: buyerSnapshotSchema,
  items: z.array(
    z.object({
      lineItemId: z.string().min(1),
      // ID dell'inserzione per leggere l'immagine; non si salva.
      legacyItemId: text,
      stableKey: z.string().min(1).nullable(),
      title: z.string(),
      sku: text,
      quantity: z.number().int().positive(),
      total: money.nullable(),
      // URL qualificato dell'immagine; se assente resta quello già salvato.
      imageUrl: z.string().url().optional(),
    }),
  ),
  taxIdentifiers: z
    .object({
      source: z.enum(["ebay_trading_get_orders", "ebay_fulfillment"]),
      complete: z.boolean(),
      availability: z.enum(["present", "absent", "not_included", "masked", "removed"]).optional(),
      verification: z.enum(["completed", "error"]).default("completed"),
      lastModifiedTime: utc.optional(),
      values: z.array(
        z.object({
          type: z.string().min(1),
          issuingCountry: text,
          value: z.string().min(1),
        }),
      ),
    })
    .optional(),
});
export type OrderObservation = z.input<typeof orderObservationSchema>;

/** Lo stesso acquisto riporta due volte la stessa riga: la lettura non si registra. */
export class DuplicateLineIdentity extends Error {
  constructor() {
    super("duplicate_line_identity");
  }
}

export type ReconciliationIssue =
  | "partial_overlap"
  | "missing_line_identity"
  | "multiple_candidates";

export type OrderObservationResult =
  | { outcome: "stale" | "not_writable" }
  | {
      outcome: "created" | "updated" | "unchanged";
      orderId: string;
      taxChanges: number;
      issue: ReconciliationIssue | null;
    };

type StoredOrder = {
  id: string;
  ebay_order_id: string;
  is_provisional: number;
  last_modified_time: string;
  buyer_json: string | null;
  has_fulfillment: number;
};

const storedOrderColumns = `o.id, o.ebay_order_id, o.is_provisional, o.last_modified_time, o.buyer_json,
  EXISTS (SELECT 1 FROM order_source_refs r
           WHERE r.order_id = o.id AND r.source = 'fulfillment') AS has_fulfillment`;

type StoredItem = {
  id: string;
  line_item_id: string;
  stable_key: string | null;
  sku: string | null;
  title: string;
  quantity: number;
  total_minor: number | null;
  currency: string | null;
  image_url: string | null;
};

/**
 * Un campo mascherato non cancella il valore letto prima: lo snapshot lo conserva e il campo
 * resta in `masked` solo se non è mai stato fornito. Il contenitore è sempre presente, perché
 * la fonte segnala un campo annidato solo insieme al suo contenitore.
 */
function keepMaskedValues(buyer: BuyerSnapshot, stored: string | null): BuyerSnapshot {
  if (!buyer.masked || !stored) return buyer;
  const previous = buyerSnapshotSchema.parse(JSON.parse(stored));
  const result = structuredClone(buyer);
  const masked = buyer.masked.filter((field) => {
    const path = field.split(".");
    const valueAt = (root: unknown, keys: string[]) =>
      keys.reduce<unknown>((value, key) => (value as Record<string, unknown> | null)?.[key], root);
    const kept = valueAt(previous, path);
    if (kept === null || kept === undefined) return true;
    (valueAt(result, path.slice(0, -1)) as Record<string, unknown>)[path.at(-1)!] = kept;
    return false;
  });
  return { ...result, masked: masked.length ? masked : undefined };
}

/**
 * Istante con cui si controllano le scadenze di un lavoro: mai prima del suo inizio, così un
 * job iniziato prima della scadenza non la prolunga.
 */
export function deadlineCheckAt(startedAt: string): string {
  return new Date(Math.max(Date.now(), Date.parse(startedAt))).toISOString();
}

type Observation = z.output<typeof orderObservationSchema>;

type DirectMatch = StoredOrder & { source_modified: string | null };

/**
 * Ordine già noto con lo stesso identificativo esterno, da qualunque fonte, e data dell'ultima
 * lettura applicata per la fonte dell'osservazione.
 */
function findDirect(db: D1Database, storeId: string, observation: Observation) {
  return db
    .prepare(
      `SELECT ${storedOrderColumns},
              (SELECT last_modified_time FROM order_source_refs
                WHERE store_id = ?1 AND source = ?2 AND external_order_id = ?3) AS source_modified
         FROM orders o
        WHERE o.store_id = ?1 AND o.merged_into IS NULL AND o.id IN (
          SELECT COALESCE(original.merged_into, original.id) FROM orders original
          WHERE original.store_id = ?1 AND (original.ebay_order_id = ?3 OR original.id IN (
            SELECT order_id FROM order_source_refs WHERE store_id = ?1 AND external_order_id = ?3)))
        LIMIT 1`,
    )
    .bind(storeId, observation.source, observation.externalOrderId)
    .first<DirectMatch>();
}

type Match = {
  /** Ordine a cui si applica la lettura; null per un ordine nuovo. */
  matched: StoredOrder | null;
  /** Provvisori che confluiscono nell'ordine abbinato. */
  absorbed: StoredOrder[];
  /** Ordini sovrapposti non abbinati, con l'anomalia da registrare. */
  related: Array<[string, ReconciliationIssue]>;
  /** Ordini che condividono almeno un'identità di riga con la lettura. */
  overlappingIds: string[];
};

/** Abbina la lettura agli ordini del negozio che ne condividono le identità di riga. */
async function matchOrder(
  db: D1Database,
  storeId: string,
  observation: Observation,
  direct: StoredOrder | null,
): Promise<Match> {
  const keys = observation.items.map((item) => item.stableKey);
  const keySet = new Set<string | null>(keys);
  const { results: candidates } = await db
    .prepare(
      `SELECT ${storedOrderColumns},
              COALESCE(CASE WHEN ?4 = 'trading' THEN o.trading_line_keys END,
                (SELECT json_group_array(stable_key) FROM order_items WHERE order_id = o.id)) AS keys
         FROM orders o
        WHERE o.store_id = ?1 AND o.merged_into IS NULL AND o.id IS NOT ?3 AND (o.id IN (
          SELECT order_id FROM order_items
           WHERE stable_key IN (SELECT value FROM json_each(?2))) OR EXISTS (
             SELECT 1 FROM json_each(o.trading_line_keys) WHERE value IN (SELECT value FROM json_each(?2))))
        ORDER BY o.creation_time, o.id`,
    )
    .bind(storeId, JSON.stringify(keys), direct?.id ?? null, observation.source)
    .all<StoredOrder & { keys: string }>();
  const overlappingIds = candidates.map(({ id }) => id);
  const missingIdentity = observation.items.some((item) => item.stableKey === null);
  const parsed = candidates.map((candidate) => ({
    candidate,
    keys: JSON.parse(candidate.keys) as Array<string | null>,
  }));
  const only = parsed.length === 1 ? parsed[0]! : null;
  const disjoint =
    new Set(parsed.flatMap((entry) => entry.keys)).size ===
    parsed.reduce((count, entry) => count + entry.keys.length, 0);
  if (
    !missingIdentity &&
    !observation.provisional &&
    parsed.length > 0 &&
    disjoint &&
    parsed.every(
      ({ candidate, keys: candidateKeys }) =>
        candidate.is_provisional &&
        candidateKeys.length > 0 &&
        candidateKeys.every((key) => keySet.has(key)),
    )
  ) {
    const matched = direct ?? parsed[0]!.candidate;
    return {
      matched,
      absorbed: parsed.map(({ candidate }) => candidate).filter(({ id }) => id !== matched.id),
      related: [],
      overlappingIds,
    };
  }
  if (
    !direct &&
    only &&
    !missingIdentity &&
    !only.keys.includes(null) &&
    (only.keys.every((key) => keySet.has(key)) ||
      (observation.provisional && !only.candidate.is_provisional)) &&
    keys.every(Set.prototype.has, new Set(only.keys))
  ) {
    return { matched: only.candidate, absorbed: [], related: [], overlappingIds };
  }
  return {
    matched: direct,
    absorbed: [],
    related: parsed.map(({ candidate, keys: candidateKeys }) => [
      candidate.id,
      parsed.length > 1
        ? "multiple_candidates"
        : missingIdentity || candidateKeys.includes(null)
          ? "missing_line_identity"
          : "partial_overlap",
    ]),
    overlappingIds,
  };
}

/**
 * Fulfillment è la fonte dei campi dell'ordine e subentra sempre a un ordine letto solo da
 * Trading: le date delle due fonti non sono confrontabili. Un provvisorio non sostituisce il
 * definitivo e una lettura più vecchia della stessa fonte aggancia soltanto il riferimento.
 */
function fieldOwnership(observation: Observation, matched: StoredOrder | null) {
  const takeover = observation.source === "fulfillment" && !!matched && !matched.has_fulfillment;
  const ownsFields =
    !matched ||
    (!(observation.provisional && !matched.is_provisional) &&
      (takeover ||
        ((observation.source === "fulfillment" || !matched.has_fulfillment) &&
          observation.lastModifiedTime >= matched.last_modified_time)));
  return { takeover, ownsFields };
}

/**
 * Versione dei dati fiscali. Le date Trading e Fulfillment non sono intercambiabili: una
 * risposta senza data può introdurre un dato, ma non sostituire una verifica con versione
 * autorevole già nota.
 */
function taxVersion(observation: Observation): string | null {
  const tax = observation.taxIdentifiers;
  return (
    tax?.lastModifiedTime ??
    (tax?.source ===
    (observation.source === "fulfillment" ? "ebay_fulfillment" : "ebay_trading_get_orders")
      ? observation.lastModifiedTime
      : null)
  );
}

/** Letterale SQL escapato, per le condizioni che non possono usare parametri. */
const literal = (value: string | null) =>
  value === null ? "NULL" : `'${value.replaceAll("'", "''")}'`;

/**
 * Condizione di ogni scrittura: consenso, retention e dati eliminati, e assenza di una lettura
 * più recente della stessa fonte o degli stessi dati fiscali. Si ripete nel batch, così vale
 * anche se una risposta più recente arriva dopo le letture preparatorie.
 */
function writeGuard(input: {
  observation: Observation;
  orderId: string;
  absorbedIds: string[];
  overlappingIds: string[];
  taxModified: string | null;
  observedAt: string;
}): string {
  const { observation, orderId, taxModified, observedAt } = input;
  const tax = observation.taxIdentifiers;
  const keys = observation.items.map((item) => item.stableKey);
  const fresh = `NOT EXISTS (SELECT 1 FROM order_source_refs WHERE store_id = ?1
    AND source = ${literal(observation.source)}
    AND external_order_id = ${literal(observation.externalOrderId)}
    AND last_modified_time > ${literal(observation.lastModifiedTime)})`;
  const freshTax = tax
    ? `AND NOT EXISTS (SELECT 1 FROM order_tax_checks tc JOIN orders original ON original.id = tc.order_id
        WHERE (original.id IN (${[orderId, ...input.absorbedIds].map(literal).join(",")}) OR original.merged_into = ${literal(orderId)})
        AND tc.source = ${literal(tax.source)} AND (
          (tc.last_modified_time IS NOT NULL AND (${literal(taxModified)} IS NULL OR tc.last_modified_time > ${literal(taxModified)}))
          OR (tc.last_modified_time IS ${literal(taxModified)} AND tc.observed_at > ${literal(observedAt)})))
       AND NOT EXISTS (SELECT 1 FROM order_source_refs WHERE order_id = ${literal(orderId)}
         AND source = ${literal(tax.source === "ebay_fulfillment" ? "fulfillment" : "trading")}
         AND ${literal(taxModified)} IS NOT NULL AND last_modified_time > ${literal(taxModified)})`
    : "";
  const at = deadlineCheckAt(observedAt);
  const retained = `EXISTS (SELECT 1 FROM ebay_stores s WHERE s.id = ?1
      AND (s.orders_deleted_through IS NULL OR s.orders_deleted_through < ${literal(observation.creationTime)}))
    AND NOT EXISTS (SELECT 1 FROM deleted_order_keys d WHERE d.store_id = ?1
      AND ((d.kind = 'order' AND d.external_key = ${literal(observation.externalOrderId)})
        OR (d.kind = 'line' AND d.external_key IN (SELECT value FROM json_each(${literal(JSON.stringify(keys))})))))
    AND NOT EXISTS (SELECT 1 FROM orders WHERE id IN (SELECT value FROM json_each(${literal(JSON.stringify(input.overlappingIds))}))
      AND retention_until <= ${literal(at)})
    AND CASE WHEN EXISTS (SELECT 1 FROM orders WHERE id = ${literal(orderId)})
      THEN EXISTS (SELECT 1 FROM orders WHERE id = ${literal(orderId)} AND retention_until > ${literal(at)})
      ELSE strftime('%Y-%m-%dT%H:%M:%fZ', ${literal(observation.creationTime)}, '+30 days') > ${literal(at)} END`;
  return `${writableStore} AND ${retained} AND ${fresh} ${freshTax}`;
}

/**
 * Articoli dell'ordine: aggiorna quelli cambiati, aggiunge i nuovi e rimuove gli assenti. Le
 * identità stabili si confrontano fra loro; altrimenti vale l'ID riga della fonte.
 * Parametri: ?1 negozio, ?2 consenso; `orderExists` usa ?4 come ordine.
 */
function itemStatements(
  db: D1Database,
  scope: readonly [string, string],
  orderId: string,
  items: Observation["items"],
  stored: StoredItem[],
  guards: { guarded: string; orderExists: string },
): D1PreparedStatement[] {
  const kept = new Set<string>();
  const upserts: D1PreparedStatement[] = [];
  for (const item of items) {
    const existing = stored.find(
      (row) =>
        !kept.has(row.id) &&
        (item.stableKey && row.stable_key
          ? row.stable_key === item.stableKey
          : row.line_item_id === item.lineItemId),
    );
    const values = [
      item.lineItemId,
      item.stableKey,
      item.sku,
      item.title,
      item.quantity,
      item.total?.minor ?? null,
      item.total?.currency ?? null,
      item.imageUrl ?? existing?.image_url ?? null,
    ];
    if (existing) {
      kept.add(existing.id);
      const current = [
        existing.line_item_id,
        existing.stable_key,
        existing.sku,
        existing.title,
        existing.quantity,
        existing.total_minor,
        existing.currency,
        existing.image_url,
      ];
      if (values.every((value, index) => value === current[index])) continue;
    }
    upserts.push(
      db
        .prepare(
          `INSERT INTO order_items
             (id, order_id, line_item_id, stable_key, sku, title, quantity, total_minor, currency,
              image_url)
           SELECT ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12 WHERE ${guards.orderExists}
           ON CONFLICT (id) DO UPDATE SET line_item_id = excluded.line_item_id,
             stable_key = excluded.stable_key, sku = excluded.sku, title = excluded.title,
             quantity = excluded.quantity, total_minor = excluded.total_minor,
             currency = excluded.currency, image_url = excluded.image_url`,
        )
        .bind(...scope, existing?.id ?? crypto.randomUUID(), orderId, ...values),
    );
  }
  const removed = stored.filter((row) => !kept.has(row.id)).map((row) => row.id);
  return [
    db
      .prepare(
        `DELETE FROM order_items
          WHERE order_id = ?3 AND id IN (SELECT value FROM json_each(?4)) AND ${guards.guarded}`,
      )
      .bind(...scope, orderId, JSON.stringify(removed)),
    ...upserts,
  ];
}

/**
 * Variazioni degli identificativi fiscali della fonte: chiude i valori sostituiti, poi aggiunge
 * i nuovi, nella stessa transazione. Un valore presente aggiorna quel tipo/Paese; l'omissione
 * di un altro tipo non lo rimuove, salvo una lettura completa. Un provvisorio non rimuove i
 * valori di un definitivo.
 */
async function taxStatements(
  db: D1Database,
  scope: readonly [string, string],
  orderId: string,
  absorbedIds: string[],
  observation: Observation,
  matched: StoredOrder | null,
  guards: { guarded: string; orderExists: string },
): Promise<D1PreparedStatement[]> {
  const tax = observation.taxIdentifiers!;
  const current = new Map(tax.values.map((value) => [taxComparisonKey(value), value]));
  const { results: stored } = await db
    .prepare(
      `SELECT identifier_type AS type, issuing_country AS issuingCountry, value
       FROM tax_identifiers WHERE order_id IN (SELECT value FROM json_each(?))
         AND source = ? AND removed_at IS NULL`,
    )
    .bind(JSON.stringify([orderId, ...absorbedIds]), tax.source)
    .all<{ type: string; issuingCountry: string | null; value: string }>();
  const known = new Set(stored.map(taxComparisonKey));
  const additions: D1PreparedStatement[] = [];
  for (const [key, value] of current) {
    if (known.has(key)) continue;
    additions.push(
      db
        .prepare(
          `INSERT OR IGNORE INTO tax_identifiers
             (id, order_id, identifier_type, issuing_country, value, source, observed_at)
           SELECT ?3, ?4, ?5, ?6, ?7, ?8, strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE ${guards.orderExists}`,
        )
        .bind(
          ...scope,
          crypto.randomUUID(),
          orderId,
          value.type,
          value.issuingCountry,
          value.value,
          tax.source,
        ),
    );
  }
  if (observation.provisional && matched && !matched.is_provisional) return additions;
  const group = (value: { type: string; issuingCountry: string | null }) => {
    const kind = taxIdentifierType(value.type, value.issuingCountry);
    return JSON.stringify([kind === "OTHER" ? value.type : kind, value.issuingCountry]);
  };
  const groups = new Set([...current.values()].map(group));
  const removed = stored.filter(
    (value) => !current.has(taxComparisonKey(value)) && (tax.complete || groups.has(group(value))),
  );
  return [
    db
      .prepare(
        `UPDATE tax_identifiers SET removed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          WHERE order_id = ?4 AND source = ?5 AND removed_at IS NULL
            AND json_array(identifier_type, issuing_country, value) IN
              (SELECT value FROM json_each(?6))
            AND ${guards.guarded}`,
      )
      .bind(
        ...scope,
        null,
        orderId,
        tax.source,
        // Le copie assorbite hanno nuovi ID, ma conservano tipo, Paese e valore originali.
        JSON.stringify(
          removed.map((value) => JSON.stringify([value.type, value.issuingCountry, value.value])),
        ),
      ),
    ...additions,
  ];
}

/**
 * Registra una lettura dell'ordine nello stesso negozio, con un UUID interno stabile.
 *
 * L'ordine si riconosce dall'identificativo esterno già visto (qualunque fonte) oppure, se è
 * nuovo, dalle identità stabili delle righe. Più provvisori con righe disgiunte interamente
 * contenute nel definitivo confluiscono nello stesso UUID; gli originali conservano storico
 * e grant. Un provvisorio tardivo interamente contenuto si aggancia al definitivo. Identità
 * mancanti, sovrapposizioni parziali e candidati concorrenti restano anomalie esplicite.
 *
 * I campi dell'ordine appartengono a Fulfillment quando l'ha letto; un provvisorio non
 * sovrascrive mai un definitivo. Gli identificativi fiscali conservano la propria fonte e
 * ogni variazione effettiva resta nello storico. Una lettura più vecchia di quella già
 * applicata per la stessa fonte viene scartata prima di ogni scrittura.
 */
export async function recordOrderObservation(
  db: D1Database,
  target: { storeId: string; consentGrantedAt: string; observedAt: string },
  input: OrderObservation,
): Promise<OrderObservationResult> {
  const observation = orderObservationSchema.parse(input);
  const observedAt = utc.parse(target.observedAt);
  if (
    new Set(observation.items.map((item) => item.lineItemId)).size !== observation.items.length ||
    new Set(observation.items.flatMap((item) => (item.stableKey ? [item.stableKey] : []))).size !==
      observation.items.filter((item) => item.stableKey).length
  )
    throw new DuplicateLineIdentity();
  const scope = [target.storeId, target.consentGrantedAt] as const;

  const direct = await findDirect(db, target.storeId, observation);
  if (direct?.source_modified && observation.lastModifiedTime < direct.source_modified) {
    return staleObservation();
  }
  const { matched, absorbed, related, overlappingIds } = await matchOrder(
    db,
    target.storeId,
    observation,
    direct,
  );
  const absorbedIds = absorbed.map((order) => order.id);
  const orderId = matched?.id ?? crypto.randomUUID();
  const { takeover, ownsFields } = fieldOwnership(observation, matched);
  // La sincronizzazione serializza gli articoli del negozio; questa è l'ultima lettura
  // preparatoria, prima di fissare l'istante con cui autorizzare le scritture.
  const { results: stored } =
    ownsFields && matched
      ? await db
          .prepare(
            `SELECT id, line_item_id, stable_key, sku, title, quantity, total_minor, currency,
                  image_url
             FROM order_items WHERE order_id = ?`,
          )
          .bind(orderId)
          .all<StoredItem>()
      : { results: [] as StoredItem[] };
  const tax = observation.taxIdentifiers;
  const taxModified = taxVersion(observation);
  const guarded = writeGuard({
    observation,
    orderId,
    absorbedIds,
    overlappingIds,
    taxModified,
    observedAt,
  });
  const orderExists = `${guarded} AND EXISTS (SELECT 1 FROM orders WHERE id = ?4)`;
  const guards = { guarded, orderExists };
  const buyer = keepMaskedValues(observation.buyer, matched?.buyer_json ?? null);
  const orderValues = [
    observation.externalOrderId,
    observation.creationTime,
    observation.lastModifiedTime,
    observation.total.currency,
    observation.total.minor,
    observation.provisional ? 1 : 0,
    observation.marketplaceId,
    observation.paymentStatus,
    observation.fulfillmentStatus,
    observation.cancelStatus,
    JSON.stringify(buyer),
  ];

  const statements: D1PreparedStatement[] = [];
  /** Accoda le istruzioni e restituisce la posizione della prima nel batch. */
  const add = (...added: D1PreparedStatement[]) => statements.push(...added) - added.length;
  // Il consenso si verifica nella stessa transazione delle scritture.
  const consentCheck = add(db.prepare(`SELECT 1 AS ok WHERE ${writableStore}`).bind(...scope));
  const guardCheck = add(db.prepare(`SELECT 1 AS ok WHERE ${guarded}`).bind(...scope));

  // Ordine e articoli: le loro modifiche distinguono «updated» da «unchanged».
  const orderWrites = statements.length;
  // Istante d'ingresso negli elenchi, con l'orologio del Worker che apre l'elenco.
  const listedAt = new Date().toISOString();
  if (!matched) {
    add(
      db
        .prepare(
          `INSERT INTO orders
             (id, store_id, ebay_order_id, creation_time, last_modified_time, currency,
              total_minor, is_provisional, marketplace_id, payment_status, fulfillment_status,
              cancel_status, buyer_json, listed_at)
           SELECT ?3, ?1, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15 WHERE ${guarded}`,
        )
        .bind(...scope, orderId, ...orderValues, listedAt),
    );
  } else if (ownsFields) {
    // La sola data di modifica non è una variazione dell'ordine. Un acquisto provvisorio
    // pagato entra negli elenchi in quel momento.
    add(
      db
        .prepare(
          `UPDATE orders SET listed_at = CASE WHEN is_provisional = 1 AND ?9 = 0 THEN ?16
                    ELSE listed_at END, ebay_order_id = ?4, creation_time = ?5, last_modified_time = ?6,
                  currency = ?7, total_minor = ?8, is_provisional = ?9, marketplace_id = ?10,
                  payment_status = ?11, fulfillment_status = ?12, cancel_status = ?13,
                  buyer_json = ?14
            WHERE id = ?3 AND (?15 OR last_modified_time <= ?6) AND ${guarded}
              AND (ebay_order_id IS NOT ?4 OR creation_time IS NOT ?5 OR currency IS NOT ?7
                OR total_minor IS NOT ?8 OR is_provisional IS NOT ?9 OR marketplace_id IS NOT ?10
                OR payment_status IS NOT ?11 OR fulfillment_status IS NOT ?12
                OR cancel_status IS NOT ?13 OR buyer_json IS NOT ?14)`,
        )
        .bind(...scope, orderId, ...orderValues, takeover ? 1 : 0, listedAt),
    );
  }
  if (observation.buyerEiasToken !== undefined) {
    add(
      db
        .prepare(`UPDATE orders SET buyer_eias_token = ?4
        WHERE id = ?3 AND buyer_eias_token IS NOT ?4 AND ${guarded}`)
        .bind(...scope, orderId, observation.buyerEiasToken),
    );
  }
  for (const original of absorbed) {
    // Conserva le osservazioni fiscali originali; copia solo i valori correnti sul definitivo.
    add(
      db
        .prepare(`INSERT OR IGNORE INTO tax_identifiers
        (id, order_id, identifier_type, issuing_country, value, source, observed_at)
        SELECT lower(hex(randomblob(16))), ?4, identifier_type, issuing_country, value, source, observed_at
          FROM tax_identifiers WHERE order_id = ?3 AND removed_at IS NULL AND ${orderExists}`)
        .bind(...scope, original.id, orderId),
      db
        .prepare(`UPDATE orders SET merged_into = ?4 WHERE merged_into = ?3 AND ${orderExists}`)
        .bind(...scope, original.id, orderId),
      db
        .prepare(`UPDATE orders SET merged_into = ?4 WHERE id = ?3 AND ${orderExists}`)
        .bind(...scope, original.id, orderId),
      db
        .prepare(`DELETE FROM order_reconciliation_issues
        WHERE order_id IN (?3, ?4) AND related_order_id IN (?3, ?4) AND ${orderExists}`)
        .bind(...scope, original.id, orderId),
      db
        .prepare(
          `UPDATE order_source_refs SET order_id = ?4 WHERE order_id = ?3 AND ${orderExists}`,
        )
        .bind(...scope, original.id, orderId),
    );
  }
  if (ownsFields) add(...itemStatements(db, scope, orderId, observation.items, stored, guards));
  const orderWritesEnd = statements.length;
  if (ownsFields) {
    // Testo cercabile dagli stessi campi appena scritti: derivato, non è una variazione.
    const searchText = orderSearchText({
      ebayOrderId: observation.externalOrderId,
      buyerName: buyer.name,
      buyerUsername: buyer.username,
      items: observation.items,
    });
    add(
      db
        .prepare(`UPDATE orders SET search_text = ?3 WHERE id = ?4
      AND search_text IS NOT ?3 AND ${orderExists}`)
        .bind(...scope, searchText, orderId),
    );
  }

  // Identificativi correnti prima e dopo le variazioni, per contare quelle effettive.
  const taxSnapshot = db
    .prepare(
      `SELECT identifier_type AS type, issuing_country AS issuingCountry, value
       FROM tax_identifiers WHERE order_id = ?4 AND removed_at IS NULL AND ${orderExists}`,
    )
    .bind(...scope, null, orderId);
  let taxSnapshots: { before: number; after: number } | null = null;
  if (tax) {
    const before = add(taxSnapshot);
    add(...(await taxStatements(db, scope, orderId, absorbedIds, observation, matched, guards)));
    taxSnapshots = { before, after: add(taxSnapshot) };
    add(
      db
        .prepare(
          `INSERT INTO order_tax_checks (order_id, source, last_modified_time, observed_at, availability, verification)
       SELECT ?4, ?3, ?5, ?6, ?7, ?8 WHERE ${orderExists}
       ON CONFLICT (order_id, source) DO UPDATE SET last_modified_time = excluded.last_modified_time,
         observed_at = excluded.observed_at, availability = excluded.availability, verification = excluded.verification`,
        )
        .bind(
          ...scope,
          tax.source,
          orderId,
          taxModified,
          observedAt,
          tax.values.length ? "present" : tax.complete ? "removed" : (tax.availability ?? "absent"),
          tax.verification,
        ),
    );
  }
  if (
    observation.source === "trading" &&
    (ownsFields ||
      (!observation.provisional && matched!.ebay_order_id === observation.externalOrderId))
  ) {
    add(
      db
        .prepare(`UPDATE orders SET trading_line_keys = ?3 WHERE id = ?4
      AND trading_line_keys IS NOT ?3 AND ${orderExists}`)
        .bind(...scope, JSON.stringify(observation.items.map((item) => item.stableKey)), orderId),
    );
  } else if (ownsFields && matched?.is_provisional && !observation.provisional) {
    // Le righe del definitivo sostituiscono l'insieme parziale del provvisorio promosso.
    add(
      db
        .prepare(`UPDATE orders SET trading_line_keys = NULL WHERE id = ?4 AND ${orderExists}`)
        .bind(...scope, null, orderId),
    );
  }
  add(
    db
      .prepare(
        `INSERT INTO order_source_refs
           (store_id, source, external_order_id, order_id, last_modified_time)
         SELECT ?1, ?3, ?5, ?4, ?6 WHERE ${orderExists}
         ON CONFLICT (store_id, source, external_order_id) DO UPDATE
           SET last_modified_time = excluded.last_modified_time
         WHERE excluded.last_modified_time > order_source_refs.last_modified_time`,
      )
      .bind(
        ...scope,
        observation.source,
        orderId,
        observation.externalOrderId,
        observation.lastModifiedTime,
      ),
  );
  for (const [relatedOrderId, kind] of related) {
    add(
      db
        .prepare(
          `INSERT OR IGNORE INTO order_reconciliation_issues
             (order_id, related_order_id, kind, detected_at)
           SELECT ?4, ?3, ?5, ?6 WHERE ${orderExists}`,
        )
        .bind(...scope, relatedOrderId, orderId, kind, target.observedAt),
    );
  }

  const results = await db.batch(statements);
  if (results[consentCheck]!.results.length === 0) return { outcome: "not_writable" };
  if (results[guardCheck]!.results.length === 0) return staleObservation();
  const orderChanges = results
    .slice(orderWrites, orderWritesEnd)
    .reduce((total, result) => total + result.meta.changes, 0);
  const taxKeys = (index: number) =>
    new Set(
      results[index]!.results.map((row) => {
        const value = row as { type: string; issuingCountry: string | null; value: string };
        // CF coincidenti con Paese assente/IT sono lo stesso dato anche se cambia la fonte.
        return taxComparisonKey(
          taxIdentifierType(value.type, value.issuingCountry) === "CF"
            ? { ...value, issuingCountry: "IT" }
            : value,
        );
      }),
    );
  const beforeTax = taxSnapshots ? taxKeys(taxSnapshots.before) : new Set<string>();
  const afterTax = taxSnapshots ? taxKeys(taxSnapshots.after) : new Set<string>();
  return {
    outcome: !matched ? "created" : orderChanges > 0 ? "updated" : "unchanged",
    orderId,
    taxChanges:
      [...beforeTax].filter((key) => !afterTax.has(key)).length +
      [...afterTax].filter((key) => !beforeTax.has(key)).length,
    issue: related[0]?.[1] ?? null,
  };
}
