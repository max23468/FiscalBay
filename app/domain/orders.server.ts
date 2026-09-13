export type VisibleOrder = {
  id: string;
  ebayOrderId: string;
  creationTime: string;
  lastModifiedTime: string;
  currency: string;
  totalMinor: number;
  taxIdentifiers: Array<{
    type: string;
    issuingCountry: string;
    value: string;
  }>;
};

export async function listVisibleOrders(
  db: D1Database,
  userId: string,
  requestedLimit = 50,
): Promise<VisibleOrder[]> {
  const limit = Math.max(1, Math.min(100, Math.trunc(requestedLimit)));
  const result = await db
    .prepare(
      `WITH visible_orders AS (
         SELECT o.id, wm.workspace_id
           FROM workspace_members wm
           JOIN ebay_stores s ON s.workspace_id = wm.workspace_id
           JOIN orders o ON o.store_id = s.id
          WHERE wm.user_id = ?
          ORDER BY o.last_modified_time DESC, o.id DESC
          LIMIT ?
       )
       SELECT o.id, o.ebay_order_id, o.creation_time, o.last_modified_time,
              o.currency, o.total_minor, ti.identifier_type,
              ti.issuing_country, ti.value
         FROM visible_orders vo
         JOIN orders o ON o.id = vo.id
         LEFT JOIN order_grants g
           ON g.workspace_id = vo.workspace_id AND g.order_id = o.id
         LEFT JOIN tax_identifiers ti
           ON ti.order_id = o.id AND g.id IS NOT NULL
        ORDER BY o.last_modified_time DESC, o.id DESC, ti.identifier_type`,
    )
    .bind(userId, limit)
    .all<{
      id: string;
      ebay_order_id: string;
      creation_time: string;
      last_modified_time: string;
      currency: string;
      total_minor: number;
      identifier_type: string | null;
      issuing_country: string | null;
      value: string | null;
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
      taxIdentifiers: [],
    };
    if (row.identifier_type && row.issuing_country && row.value) {
      order.taxIdentifiers.push({
        type: row.identifier_type,
        issuingCountry: row.issuing_country,
        value: row.value,
      });
    }
    orders.set(row.id, order);
  }
  return [...orders.values()];
}

export async function grantFreeOrder(
  db: D1Database,
  input: {
    id: string;
    workspaceId: string;
    orderId: string;
    cycleId: string;
    grantedAt: string;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO order_grants
         (id, workspace_id, order_id, cycle_id, source, granted_at)
       VALUES (?, ?, ?, ?, 'free_cycle', ?)`,
    )
    .bind(input.id, input.workspaceId, input.orderId, input.cycleId, input.grantedAt)
    .run();
}
