import { z } from "zod";

/**
 * Le scritture di un'importazione valgono solo per il consenso con cui è partita: dopo uno
 * scollegamento, un'eliminazione dei dati, un nuovo consenso o una pausa non scrivono nulla.
 * Parametri: ?1 negozio, ?2 data del consenso.
 */
export const writableStore = `EXISTS (SELECT 1 FROM ebay_store_credentials
   WHERE store_id = ?1 AND granted_at = ?2)
  AND NOT EXISTS (SELECT 1 FROM ebay_store_pauses WHERE store_id = ?1)`;

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
      values: z.array(
        z.object({
          type: z.string().min(1),
          issuingCountry: z.string().nullable(),
          value: z.string().min(1),
        }),
      ),
    })
    .optional(),
});
export type OrderObservation = z.input<typeof orderObservationSchema>;

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
  is_provisional: number;
  last_modified_time: string;
  buyer_json: string | null;
  has_fulfillment: number;
};

const storedOrderColumns = `o.id, o.is_provisional, o.last_modified_time, o.buyer_json,
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

const separator = "\u001f";

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
    const parent = valueAt(result, path.slice(0, -1)) as Record<string, unknown> | null;
    if (kept === null || kept === undefined || !parent) return true;
    parent[path.at(-1)!] = kept;
    return false;
  });
  return { ...result, masked: masked.length ? masked : undefined };
}

/**
 * Registra una lettura dell'ordine nello stesso negozio, con un UUID interno stabile.
 *
 * L'ordine si riconosce dall'identificativo esterno già visto (qualunque fonte) oppure, se è
 * nuovo, dall'insieme delle identità stabili delle righe: solo un candidato con le stesse
 * identità è lo stesso ordine, così un provvisorio diventa definitivo e un provvisorio
 * arrivato dopo il definitivo vi si aggancia. Sovrapposizioni parziali, righe senza identità
 * o più candidati creano un ordine distinto con l'anomalia registrata, senza unire nulla.
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
  const scope = [target.storeId, target.consentGrantedAt] as const;

  const direct = await db
    .prepare(
      `SELECT ${storedOrderColumns},
              (SELECT last_modified_time FROM order_source_refs
                WHERE store_id = ?1 AND source = ?2 AND external_order_id = ?3) AS source_modified
         FROM orders o
        WHERE o.store_id = ?1 AND (o.ebay_order_id = ?3 OR o.id IN (
          SELECT order_id FROM order_source_refs WHERE store_id = ?1 AND external_order_id = ?3))
        LIMIT 1`,
    )
    .bind(target.storeId, observation.source, observation.externalOrderId)
    .first<StoredOrder & { source_modified: string | null }>();
  if (direct?.source_modified && observation.lastModifiedTime < direct.source_modified) {
    return { outcome: "stale" };
  }

  let matched: StoredOrder | null = direct;
  const related: Array<[string, ReconciliationIssue]> = [];
  const keys = observation.items.flatMap((item) => (item.stableKey ? [item.stableKey] : []));
  if (!matched) {
    const { results: candidates } = await db
      .prepare(
        `SELECT ${storedOrderColumns},
                (SELECT json_group_array(stable_key) FROM order_items WHERE order_id = o.id) AS keys
           FROM orders o
          WHERE o.store_id = ?1 AND o.id IN (
            SELECT order_id FROM order_items
             WHERE stable_key IN (SELECT value FROM json_each(?2)))`,
      )
      .bind(target.storeId, JSON.stringify(keys))
      .all<StoredOrder & { keys: string }>();
    const missingIdentity = keys.length < observation.items.length;
    const parsed = candidates.map((candidate) => ({
      candidate,
      keys: JSON.parse(candidate.keys) as Array<string | null>,
    }));
    const only = parsed.length === 1 ? parsed[0]! : null;
    if (
      only &&
      !missingIdentity &&
      only.keys.length === keys.length &&
      keys.every(Set.prototype.has, new Set(only.keys))
    ) {
      matched = only.candidate;
    } else {
      for (const { candidate, keys: candidateKeys } of parsed) {
        related.push([
          candidate.id,
          parsed.length > 1
            ? "multiple_candidates"
            : missingIdentity || candidateKeys.includes(null)
              ? "missing_line_identity"
              : "partial_overlap",
        ]);
      }
    }
  }

  const orderId = matched?.id ?? crypto.randomUUID();
  const buyer = keepMaskedValues(observation.buyer, matched?.buyer_json ?? null);
  // Fulfillment è la fonte dei campi dell'ordine e subentra sempre a un ordine letto solo da
  // Trading: le date delle due fonti non sono confrontabili. Un provvisorio non sostituisce il
  // definitivo e una lettura più vecchia della stessa fonte aggancia soltanto il riferimento.
  const takeover = observation.source === "fulfillment" && !!matched && !matched.has_fulfillment;
  const ownsFields =
    !matched ||
    (!(observation.provisional && !matched.is_provisional) &&
      (takeover ||
        ((observation.source === "fulfillment" || !matched.has_fulfillment) &&
          observation.lastModifiedTime >= matched.last_modified_time)));

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
  // Il consenso si verifica nella stessa transazione delle scritture.
  const statements = [db.prepare(`SELECT 1 AS ok WHERE ${writableStore}`).bind(...scope)];
  if (!matched) {
    statements.push(
      db
        .prepare(
          `INSERT INTO orders
             (id, store_id, ebay_order_id, creation_time, last_modified_time, currency,
              total_minor, is_provisional, marketplace_id, payment_status, fulfillment_status,
              cancel_status, buyer_json)
           SELECT ?3, ?1, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14 WHERE ${writableStore}`,
        )
        .bind(...scope, orderId, ...orderValues),
    );
  } else if (ownsFields) {
    // La sola data di modifica non è una variazione dell'ordine.
    statements.push(
      db
        .prepare(
          `UPDATE orders SET ebay_order_id = ?4, creation_time = ?5, last_modified_time = ?6,
                  currency = ?7, total_minor = ?8, is_provisional = ?9, marketplace_id = ?10,
                  payment_status = ?11, fulfillment_status = ?12, cancel_status = ?13,
                  buyer_json = ?14
            WHERE id = ?3 AND (?15 OR last_modified_time <= ?6) AND ${writableStore}
              AND (ebay_order_id IS NOT ?4 OR creation_time IS NOT ?5 OR currency IS NOT ?7
                OR total_minor IS NOT ?8 OR is_provisional IS NOT ?9 OR marketplace_id IS NOT ?10
                OR payment_status IS NOT ?11 OR fulfillment_status IS NOT ?12
                OR cancel_status IS NOT ?13 OR buyer_json IS NOT ?14)`,
        )
        .bind(...scope, orderId, ...orderValues, takeover ? 1 : 0),
    );
  }
  const orderExists = `${writableStore} AND EXISTS (SELECT 1 FROM orders WHERE id = ?4)`;

  if (ownsFields) {
    // ponytail: l'ordine fra lettura degli articoli e batch è garantito dalla sincronizzazione
    // serializzata per negozio; con scritture concorrenti servirebbe una versione dell'ordine.
    const { results: stored } = matched
      ? await db
          .prepare(
            `SELECT id, line_item_id, stable_key, sku, title, quantity, total_minor, currency,
                    image_url
               FROM order_items WHERE order_id = ?`,
          )
          .bind(orderId)
          .all<StoredItem>()
      : { results: [] as StoredItem[] };
    const kept = new Set<string>();
    const upserts: D1PreparedStatement[] = [];
    for (const item of observation.items) {
      // Le identità stabili si confrontano fra loro; altrimenti vale l'ID riga della fonte.
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
             SELECT ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12 WHERE ${orderExists}
             ON CONFLICT (id) DO UPDATE SET line_item_id = excluded.line_item_id,
               stable_key = excluded.stable_key, sku = excluded.sku, title = excluded.title,
               quantity = excluded.quantity, total_minor = excluded.total_minor,
               currency = excluded.currency, image_url = excluded.image_url`,
          )
          .bind(...scope, existing?.id ?? crypto.randomUUID(), orderId, ...values),
      );
    }
    const removed = stored.filter((row) => !kept.has(row.id)).map((row) => row.id);
    statements.push(
      db
        .prepare(
          `DELETE FROM order_items
            WHERE order_id = ?3 AND id IN (SELECT value FROM json_each(?4)) AND ${writableStore}`,
        )
        .bind(...scope, orderId, JSON.stringify(removed)),
      ...upserts,
    );
  }

  const taxStart = statements.length;
  const tax = observation.taxIdentifiers;
  if (tax) {
    const current = new Map(
      tax.values.map((value) => [
        [value.type, value.issuingCountry ?? "", value.value].join(separator),
        value,
      ]),
    );
    for (const value of current.values()) {
      statements.push(
        db
          .prepare(
            `INSERT OR IGNORE INTO tax_identifiers
               (id, order_id, identifier_type, issuing_country, value, source, observed_at)
             SELECT ?3, ?4, ?5, ?6, ?7, ?8, ?9 WHERE ${orderExists}`,
          )
          .bind(
            ...scope,
            crypto.randomUUID(),
            orderId,
            value.type,
            value.issuingCountry,
            value.value,
            tax.source,
            target.observedAt,
          ),
      );
    }
    if (tax.complete) {
      statements.push(
        db
          .prepare(
            `UPDATE tax_identifiers SET removed_at = ?3
              WHERE order_id = ?4 AND source = ?5 AND removed_at IS NULL
                AND identifier_type || char(31) || COALESCE(issuing_country, '') || char(31) ||
                    value NOT IN (SELECT value FROM json_each(?6))
                AND ${writableStore}`,
          )
          .bind(
            ...scope,
            target.observedAt,
            orderId,
            tax.source,
            JSON.stringify([...current.keys()]),
          ),
      );
    }
  }
  const taxEnd = statements.length;
  statements.push(
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
    statements.push(
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
  if (results[0]!.results.length === 0) return { outcome: "not_writable" };
  const changes = (from: number, to: number) =>
    results.slice(from, to).reduce((total, result) => total + result.meta.changes, 0);
  return {
    // Ordine e articoli occupano le istruzioni fra il controllo del consenso e i dati fiscali.
    outcome: !matched ? "created" : changes(1, taxStart) > 0 ? "updated" : "unchanged",
    orderId,
    taxChanges: changes(taxStart, taxEnd),
    issue: related[0]?.[1] ?? null,
  };
}
