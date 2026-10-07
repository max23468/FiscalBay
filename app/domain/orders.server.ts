import { buyerSnapshotSchema } from "./order-import.server";

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
  fiscalState: "available" | "locked" | "unchecked";
  taxIdentifiers: Array<{
    type: string;
    issuingCountry: string | null;
    value: string;
    source: string;
    observedAt: string;
  }>;
};

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
          ORDER BY o.last_modified_time DESC, o.id DESC
          LIMIT ?
       )
       SELECT o.id, o.ebay_order_id, o.creation_time, o.last_modified_time,
              o.currency, o.total_minor, o.buyer_json, o.payment_status, o.fulfillment_status,
              o.cancel_status,
              (SELECT json_group_array(json_object('lineItemId', line_item_id, 'title', title,
                        'quantity', quantity, 'sku', sku))
                 FROM (SELECT * FROM order_items WHERE order_id = o.id ORDER BY rowid)) AS items_json,
              COALESCE(s.display_name, s.ebay_account_id, s.ebay_user_id) ||
                CASE WHEN s.ebay_environment = 'sandbox' THEN ' (Sandbox)' ELSE '' END AS store_name,
              EXISTS (SELECT 1 FROM tax_identifiers
                       WHERE order_id = o.id AND removed_at IS NULL) AS has_identifiers,
              g.id AS grant_id, ti.identifier_type,
              ti.issuing_country, ti.value, ti.source, ti.observed_at
         FROM visible_orders vo
         JOIN orders o ON o.id = vo.id
         JOIN ebay_stores s ON s.id = o.store_id
         LEFT JOIN order_grants g
           ON g.workspace_id = vo.workspace_id AND g.order_id = o.id
         LEFT JOIN tax_identifiers ti
           ON ti.order_id = o.id AND ti.removed_at IS NULL AND g.id IS NOT NULL
        ORDER BY o.last_modified_time DESC, o.id DESC, ti.identifier_type`,
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
    const order = orders.get(row.id) ?? {
      id: row.id,
      ebayOrderId: row.ebay_order_id,
      creationTime: row.creation_time,
      lastModifiedTime: row.last_modified_time,
      currency: row.currency,
      totalMinor: row.total_minor,
      storeName: row.store_name,
      summary: summaryOf(row),
      fiscalState: row.has_identifiers ? (row.grant_id ? "available" : "locked") : "unchecked",
      taxIdentifiers: [],
    };
    // Le colonne dell'identificativo sono tutte presenti o tutte assenti (join senza grant).
    if (row.identifier_type !== null) {
      order.taxIdentifiers.push({
        type: row.identifier_type,
        issuingCountry: row.issuing_country,
        value: row.value!,
        source: row.source!,
        observedAt: row.observed_at!,
      });
    }
    orders.set(row.id, order);
  }
  return [...orders.values()];
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
          AND EXISTS (SELECT 1 FROM tax_identifiers WHERE order_id = o.id AND removed_at IS NULL)
          AND ${consultable}
       RETURNING id`,
    )
    .bind(input.id, input.grantedAt, userId, input.workspaceId, input.orderId, input.cycleId)
    .first<{ id: string }>();
  if (!result) throw new Error("order_not_available");
}
