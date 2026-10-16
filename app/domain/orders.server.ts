import { buyerSnapshotSchema } from "./order-import.server";
import { taxComparisonKey, taxIdentifierType, taxQuality } from "../tax-quality";
import type { TaxQuality } from "../view-models";

export type PaymentState = "paid" | "unpaid" | "partially_refunded" | "refunded" | "unknown";
export type ShippingState = "to_ship" | "in_progress" | "shipped" | "cancelled" | "unknown";

const paymentStates: Record<string, PaymentState> = {
  PAID: "paid",
  PENDING: "unpaid",
  FAILED: "unpaid",
  PARTIALLY_REFUNDED: "partially_refunded",
  FULLY_REFUNDED: "refunded",
};
const shippingStates: Record<string, ShippingState> = {
  NOT_STARTED: "to_ship",
  IN_PROGRESS: "in_progress",
  FULFILLED: "shipped",
};

/**
 * Stato di pagamento normalizzato dall'originale eBay: un pagamento in attesa o fallito non è
 * incassato e un valore non previsto resta `unknown`. null se la fonte non l'ha fornito.
 */
export function paymentState(status: string | null): PaymentState | null {
  return status === null ? null : (paymentStates[status] ?? "unknown");
}

/** Stato di evasione normalizzato; un annullamento confermato prevale sull'evasione. */
export function shippingState(
  fulfillment: string | null,
  cancel: string | null,
): ShippingState | null {
  if (cancel === "CANCELED") return "cancelled";
  return fulfillment === null ? null : (shippingStates[fulfillment] ?? "unknown");
}

/**
 * Stati originali della fonte, la loro forma normalizzata e righe dell'ordine; null dove la
 * fonte non li ha forniti.
 */
export type OrderSummary = {
  buyer: { username: string | null };
  orderPaymentStatus: string | null;
  orderFulfillmentStatus: string | null;
  payment: PaymentState | null;
  shipping: ShippingState | null;
  lineItems: Array<{ lineItemId: string; title: string; quantity: number; sku: string | null }>;
};

export type VisibleOrder = {
  id: string;
  ebayOrderId: string;
  creationTime: string;
  lastModifiedTime: string;
  currency: string;
  totalMinor: number;
  storeName: string;
  summary: OrderSummary;
  fiscalState: "available" | "locked" | "unchecked" | "checking" | "missing" | "error";
  taxVerification: "unchecked" | "checking" | "completed" | "error";
  taxAvailability: "unknown" | "present" | "absent" | "not_included" | "masked" | "removed";
  taxCheckedAt: string | null;
  firstTaxAvailableAt: string | null;
  /** Nome del dato prima dello sblocco: Partita IVA solo se l'ordine ha soltanto quella. */
  lockedShownAs: "CF" | "PIVA";
  reconciliationIssue: boolean;
  taxIdentifiers: Array<{
    type: string;
    issuingCountry: string | null;
    value: string;
    source: string;
    observedAt: string;
    quality: TaxQuality;
    updated: boolean;
  }>;
};

function isFulfillmentCf(tax: VisibleOrder["taxIdentifiers"][number]): boolean {
  // cfKey qualifica già il Paese prima del confronto fra le fonti.
  return tax.source === "ebay_fulfillment" && tax.type === "CODICE_FISCALE";
}

/**
 * Tipo dell'identificativo come in `taxIdentifierType`: CF e Partita IVA italiani, anche
 * con Paese omesso dove la fonte lo ammette; gli altri restano distinti per tipo e Paese.
 */
const taxKind = (table: string) => `CASE
  WHEN ${table}.issuing_country IS NOT NULL AND ${table}.issuing_country <> 'IT'
    THEN json_array(${table}.identifier_type, ${table}.issuing_country)
  WHEN ${table}.identifier_type IN ('CODICE_FISCALE', 'CodiceFiscale') THEN 'CF'
  WHEN ${table}.identifier_type = 'PartitaIVA'
    OR (${table}.issuing_country = 'IT' AND ${table}.identifier_type IN ('VAT_ID', 'VATIN')) THEN 'PIVA'
  ELSE json_array(${table}.identifier_type, ${table}.issuing_country) END`;

// La pausa del piano esclude i dati del negozio; la pausa manuale li lascia consultabili.
const consultable = `NOT EXISTS (
  SELECT 1 FROM ebay_store_pauses p WHERE p.store_id = s.id AND p.reason = 'plan'
)`;

function summaryOf(row: {
  buyer_json: string | null;
  payment_status: string | null;
  fulfillment_status: string | null;
  cancel_status: string | null;
  items_json: string;
}): OrderSummary {
  return {
    buyer: {
      username: row.buyer_json
        ? buyerSnapshotSchema.parse(JSON.parse(row.buyer_json)).username
        : null,
    },
    orderPaymentStatus: row.payment_status,
    orderFulfillmentStatus: row.fulfillment_status,
    payment: paymentState(row.payment_status),
    shipping: shippingState(row.fulfillment_status, row.cancel_status),
    lineItems: JSON.parse(row.items_json),
  };
}

export async function listVisibleOrders(
  db: D1Database,
  userId: string,
  requestedLimit = 50,
  ebayEnvironment: "production" | "sandbox" = "production",
): Promise<VisibleOrder[]> {
  const limit = Math.max(1, Math.min(100, Math.trunc(requestedLimit)));
  const result = await db
    .prepare(
      `WITH visible_orders AS (
         SELECT o.id, wm.workspace_id
           FROM workspace_members wm
           JOIN ebay_stores s ON s.workspace_id = wm.workspace_id
           JOIN orders o ON o.store_id = s.id
          WHERE wm.user_id = ? AND s.ebay_environment = ? AND ${consultable}
            AND o.merged_into IS NULL
            AND NOT (o.is_provisional = 1 AND o.cancel_status IS 'CANCELED')
          ORDER BY o.last_modified_time DESC, o.id DESC
          LIMIT ?
       )
       SELECT o.id, o.ebay_order_id, o.creation_time, o.last_modified_time,
              o.currency, o.total_minor, o.buyer_json, o.payment_status, o.fulfillment_status,
              o.cancel_status,
              (SELECT json_object('availability', availability, 'at', observed_at, 'verification', verification)
                 FROM order_tax_checks tc JOIN orders original ON original.id = tc.order_id
                WHERE original.id = o.id OR original.merged_into = o.id
                ORDER BY tc.observed_at DESC, tc.source LIMIT 1) AS tax_check_json,
              EXISTS (SELECT 1 FROM order_source_refs r WHERE r.order_id = o.id
                AND r.detail_error IS NOT NULL) AS tax_error,
              EXISTS (SELECT 1 FROM order_source_refs r WHERE r.order_id = o.id
                AND r.source = 'fulfillment' AND r.detail_for IS NOT r.last_modified_time) AS tax_pending,
              (SELECT MIN(t.observed_at) FROM tax_identifiers t JOIN orders original ON original.id = t.order_id
                WHERE original.id = o.id OR original.merged_into = o.id) AS first_tax_available_at,
              (EXISTS (SELECT 1 FROM order_reconciliation_issues i
                WHERE i.order_id = o.id OR i.related_order_id = o.id)
               OR EXISTS (SELECT 1 FROM order_items i WHERE i.order_id = o.id AND i.stable_key IS NULL)) AS reconciliation_issue,
              (SELECT json_group_array(json_object('lineItemId', line_item_id, 'title', title,
                        'quantity', quantity, 'sku', sku))
                 FROM (SELECT * FROM order_items WHERE order_id = o.id ORDER BY rowid)) AS items_json,
              COALESCE(s.display_name, s.ebay_account_id, s.ebay_user_id) ||
                CASE WHEN s.ebay_environment = 'sandbox' THEN ' (Sandbox)' ELSE '' END AS store_name,
              EXISTS (SELECT 1 FROM tax_identifiers
                       WHERE order_id = o.id AND removed_at IS NULL) AS has_identifiers,
              NOT EXISTS (SELECT 1 FROM tax_identifiers
                           WHERE order_id = o.id AND removed_at IS NULL
                             AND NOT (identifier_type = 'PartitaIVA' AND (issuing_country IS NULL OR issuing_country = 'IT')
                               OR identifier_type IN ('VAT_ID', 'VATIN') AND issuing_country = 'IT')) AS vat_only,
              g.id AS grant_id, ti.identifier_type,
              EXISTS (SELECT 1 FROM tax_identifiers previous
                JOIN orders original ON original.id = previous.order_id
                WHERE (original.id = o.id OR original.merged_into = o.id)
                AND previous.source = ti.source
                AND ${taxKind("previous")} = ${taxKind("ti")}
                AND previous.removed_at <= ti.observed_at) AS tax_updated,
              ti.issuing_country, ti.value, ti.source, ti.observed_at
         FROM visible_orders vo
         JOIN orders o ON o.id = vo.id
         JOIN ebay_stores s ON s.id = o.store_id
         LEFT JOIN order_grants g
           ON g.id = (SELECT granted.id FROM order_grants granted JOIN orders original
             ON original.id = granted.order_id
             WHERE granted.workspace_id = vo.workspace_id
               AND (original.id = o.id OR original.merged_into = o.id)
             ORDER BY granted.granted_at, granted.id LIMIT 1)
         LEFT JOIN tax_identifiers ti
           ON ti.order_id = o.id AND ti.removed_at IS NULL AND g.id IS NOT NULL
        ORDER BY o.last_modified_time DESC, o.id DESC, ti.identifier_type, ti.issuing_country DESC`,
    )
    .bind(userId, ebayEnvironment, limit)
    .all<{
      id: string;
      ebay_order_id: string;
      creation_time: string;
      last_modified_time: string;
      currency: string;
      total_minor: number;
      buyer_json: string | null;
      payment_status: string | null;
      fulfillment_status: string | null;
      cancel_status: string | null;
      tax_check_json: string | null;
      tax_error: number;
      tax_pending: number;
      first_tax_available_at: string | null;
      tax_updated: number;
      vat_only: number;
      reconciliation_issue: number;
      items_json: string;
      store_name: string;
      has_identifiers: number;
      grant_id: string | null;
      identifier_type: string | null;
      issuing_country: string | null;
      value: string | null;
      source: string | null;
      observed_at: string | null;
    }>();

  const orders = new Map<string, VisibleOrder>();
  for (const row of result.results) {
    const check = row.tax_check_json
      ? (JSON.parse(row.tax_check_json) as {
          availability: VisibleOrder["taxAvailability"];
          at: string;
          verification: "completed" | "error";
        })
      : null;
    const verification =
      row.tax_error || check?.verification === "error"
        ? "error"
        : row.tax_pending
          ? "checking"
          : check
            ? "completed"
            : "unchecked";
    const order = orders.get(row.id) ?? {
      id: row.id,
      ebayOrderId: row.ebay_order_id,
      creationTime: row.creation_time,
      lastModifiedTime: row.last_modified_time,
      currency: row.currency,
      totalMinor: row.total_minor,
      storeName: row.store_name,
      summary: summaryOf(row),
      fiscalState: row.has_identifiers
        ? row.grant_id
          ? "available"
          : "locked"
        : verification === "completed"
          ? "missing"
          : verification,
      taxVerification: verification,
      taxAvailability: check?.availability ?? (row.has_identifiers ? "present" : "unknown"),
      taxCheckedAt: check?.at ?? null,
      firstTaxAvailableAt: row.first_tax_available_at,
      lockedShownAs: row.has_identifiers && row.vat_only ? "PIVA" : "CF",
      reconciliationIssue: !!row.reconciliation_issue,
      taxIdentifiers: [],
    };
    // Le colonne dell'identificativo sono tutte presenti o tutte assenti (join senza grant).
    if (row.identifier_type !== null) {
      const buyer = row.buyer_json ? buyerSnapshotSchema.parse(JSON.parse(row.buyer_json)) : null;
      order.taxIdentifiers.push({
        type: row.identifier_type,
        issuingCountry: row.issuing_country,
        value: row.value!,
        source: row.source!,
        observedAt: row.observed_at!,
        quality: taxQuality(
          { type: row.identifier_type, issuingCountry: row.issuing_country, value: row.value! },
          [buyer?.name, buyer?.shipTo?.name],
        ),
        updated: !!row.tax_updated,
      });
    }
    orders.set(row.id, order);
  }
  return [...orders.values()].map((order) => {
    const primary = new Map<string, VisibleOrder["taxIdentifiers"][number]>();
    const cfKey = (tax: VisibleOrder["taxIdentifiers"][number]) =>
      taxIdentifierType(tax.type, tax.issuingCountry) === "CF" &&
      (tax.source === "ebay_trading_get_orders" || isFulfillmentCf(tax))
        ? taxComparisonKey({ ...tax, issuingCountry: "IT" })
        : null;
    for (const tax of order.taxIdentifiers) {
      const key = cfKey(tax);
      if (key === null) continue;
      const previous = primary.get(key);
      const updated = !!previous?.updated || tax.updated;
      if (
        !previous ||
        (isFulfillmentCf(tax) && !isFulfillmentCf(previous)) ||
        (tax.source === previous.source && tax.issuingCountry === "IT")
      ) {
        tax.updated = updated;
        primary.set(key, tax);
      } else previous.updated = updated;
    }
    return {
      ...order,
      // Le osservazioni restano nel database; la consultazione sceglie il CF più completo.
      taxIdentifiers: order.taxIdentifiers.filter((tax) => {
        const key = cfKey(tax);
        return key === null || primary.get(key) === tax;
      }),
    };
  });
}

export async function grantFreeOrder(
  db: D1Database,
  userId: string,
  input: {
    id: string;
    workspaceId: string;
    orderId: string;
    cycleId: string;
    grantedAt: string;
  },
): Promise<void> {
  // La rilettura autorizzata rende idempotente anche uno sblocco acquisito prima del merge.
  const granted = () =>
    db
      .prepare(`SELECT g.id FROM workspace_members wm
    JOIN ebay_stores s ON s.workspace_id = wm.workspace_id
    JOIN orders o ON o.store_id = s.id
    JOIN orders original ON original.id = o.id OR original.merged_into = o.id
    JOIN order_grants g ON g.order_id = original.id AND g.workspace_id = wm.workspace_id
    WHERE wm.user_id = ? AND wm.workspace_id = ? AND o.id = ?
      AND o.merged_into IS NULL AND ${consultable} LIMIT 1`)
      .bind(userId, input.workspaceId, input.orderId)
      .first();
  const result = await db
    .prepare(
      `INSERT INTO order_grants
         (id, workspace_id, order_id, cycle_id, source, granted_at)
       SELECT ?, wm.workspace_id, o.id, c.id, 'free_cycle', ?
         FROM workspace_members wm
         JOIN ebay_stores s ON s.workspace_id = wm.workspace_id
         JOIN orders o ON o.store_id = s.id
         JOIN free_cycles c ON c.workspace_id = wm.workspace_id
        WHERE wm.user_id = ? AND wm.workspace_id = ?
          AND o.id = ? AND c.id = ?
          AND o.merged_into IS NULL
          -- Un acquisto non ancora pagato può confluire in un ordine combinato: niente quota.
          AND o.is_provisional = 0
          AND NOT EXISTS (SELECT 1 FROM order_grants g JOIN orders original ON original.id = g.order_id
            WHERE g.workspace_id = wm.workspace_id AND (original.id = o.id OR original.merged_into = o.id))
          AND EXISTS (SELECT 1 FROM tax_identifiers WHERE order_id = o.id AND removed_at IS NULL)
          AND ${consultable}
       RETURNING id`,
    )
    .bind(input.id, input.grantedAt, userId, input.workspaceId, input.orderId, input.cycleId)
    .first<{ id: string }>();
  if (!result && !(await granted())) throw new Error("order_not_available");
}
