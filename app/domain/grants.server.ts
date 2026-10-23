import { consultableStore } from "./store-state.server";

/** Predicato condiviso: nessun valore fiscale entra nel risultato prima dell'autorizzazione. */
export function orderAccessSql(order: string, workspace: string, at: string) {
  return `(EXISTS (SELECT 1 FROM order_grants g JOIN orders original ON original.id = g.order_id
    WHERE g.workspace_id = ${workspace} AND (original.id = ${order} OR original.merged_into = ${order})
      AND julianday(g.granted_at) <= julianday(${at}) AND g.revoked_at IS NULL
      AND (g.expires_at IS NULL OR julianday(g.expires_at) > julianday(${at})))
    OR EXISTS (SELECT 1 FROM workspace_entitlements e
      JOIN orders original ON original.id = ${order} OR original.merged_into = ${order}
      JOIN tax_identifiers t ON t.order_id = original.id
      WHERE e.workspace_id = ${workspace} AND e.revoked_at IS NULL
        AND julianday(e.starts_at) <= julianday(${at})
        AND julianday(t.observed_at) <= julianday(${at})
        AND (e.ends_at IS NULL OR julianday(t.observed_at) < julianday(e.ends_at))
        AND (t.removed_at IS NULL OR julianday(t.removed_at) > julianday(e.starts_at))))`;
}

export async function unlockConfirmation(db: D1Database, userId: string): Promise<boolean> {
  const row = await db
    .prepare("SELECT confirm_unlock FROM unlock_preferences WHERE user_id = ?")
    .bind(userId)
    .first<{ confirm_unlock: number }>();
  return row?.confirm_unlock !== 0;
}

export async function restoreUnlockConfirmation(db: D1Database, userId: string) {
  await db.prepare("DELETE FROM unlock_preferences WHERE user_id = ?").bind(userId).run();
}

/** Conferma prima dello sblocco di un singolo ordine; senza riga vale attiva. */
export async function setUnlockConfirmation(db: D1Database, userId: string, confirm: boolean) {
  if (confirm) return restoreUnlockConfirmation(db, userId);
  await db
    .prepare(`INSERT INTO unlock_preferences VALUES (?, 0)
      ON CONFLICT(user_id) DO UPDATE SET confirm_unlock = 0`)
    .bind(userId)
    .run();
}

/** Cicli su tempo UTC, fissati al primo collegamento riuscito e mai alla riconnessione. */
export async function orderAllowance(db: D1Database, userId: string, now = new Date()) {
  const at = now.toISOString();
  const workspace = await db
    .prepare(`SELECT w.id, w.free_cycle_anchor_at,
    EXISTS (SELECT 1 FROM workspace_entitlements e WHERE e.workspace_id = w.id
      AND e.revoked_at IS NULL AND julianday(e.starts_at) <= julianday(?1)
      AND (e.ends_at IS NULL OR julianday(?1) < julianday(e.ends_at))) AS premium
    FROM workspaces w JOIN workspace_members wm ON wm.workspace_id = w.id
    WHERE wm.user_id = ?2`)
    .bind(at, userId)
    .first<{ id: string; free_cycle_anchor_at: string | null; premium: number }>();
  if (!workspace) return null;
  let cycle = await db
    .prepare(`SELECT id, used, quota, ends_at FROM free_cycles
    WHERE workspace_id = ? AND julianday(starts_at) <= julianday(?)
      AND julianday(?) < julianday(ends_at) ORDER BY starts_at DESC LIMIT 1`)
    .bind(workspace.id, at, at)
    .first<{ id: string; used: number; quota: number; ends_at: string }>();
  if (!cycle && workspace.free_cycle_anchor_at) {
    const anchor = Date.parse(workspace.free_cycle_anchor_at);
    const week = 7 * 24 * 60 * 60 * 1000;
    const start = anchor + Math.floor((now.getTime() - anchor) / week) * week;
    if (start >= anchor) {
      const startsAt = new Date(start).toISOString();
      const endsAt = new Date(start + week).toISOString();
      await db
        .prepare(`INSERT OR IGNORE INTO free_cycles (id, workspace_id, starts_at, ends_at, quota)
        VALUES (?, ?, ?, ?, 5)`)
        .bind(crypto.randomUUID(), workspace.id, startsAt, endsAt)
        .run();
      cycle = await db
        .prepare(
          "SELECT id, used, quota, ends_at FROM free_cycles WHERE workspace_id = ? AND starts_at = ?",
        )
        .bind(workspace.id, startsAt)
        .first<{ id: string; used: number; quota: number; ends_at: string }>();
    }
  }
  return {
    workspaceId: workspace.id,
    premium: !!workspace.premium,
    cycle,
    remaining: workspace.premium ? null : cycle ? cycle.quota - cycle.used : 0,
  };
}

/** L'intero lotto e la preferenza sono un unico commit: un rifiuto non consuma nulla. */
export async function unlockOrders(
  db: D1Database,
  userId: string,
  ids: string[],
  skipConfirmation = false,
  ebayEnvironment: "production" | "sandbox" = "production",
  now = new Date(),
) {
  if (!ids.length || ids.length > 100 || ids.some((id) => !id || id.length > 128))
    throw new Error("invalid_order_selection");
  const unique = [...new Set(ids)];
  const allowance = await orderAllowance(db, userId, now);
  if (!allowance?.cycle) throw new Error("order_not_available");
  const at = now.toISOString();
  const access = orderAccessSql("o.id", "?2", "?4");
  await db.batch([
    ...unique.map((id) =>
      db
        .prepare(`INSERT INTO order_grants
      (id, workspace_id, order_id, cycle_id, source, granted_at)
      SELECT ?1, ?2, (SELECT o.id FROM orders o JOIN ebay_stores s ON s.id = o.store_id
        JOIN workspace_members wm ON wm.workspace_id = s.workspace_id
        WHERE o.id = ?3 AND wm.user_id = ?7 AND s.workspace_id = ?2 AND s.ebay_environment = ?6
          AND EXISTS (SELECT 1 FROM tax_identifiers t WHERE t.order_id = o.id AND t.removed_at IS NULL)),
        ?5, 'free_cycle', ?4
      WHERE NOT EXISTS (SELECT 1 FROM orders o JOIN ebay_stores s ON s.id = o.store_id
        WHERE o.id = ?3 AND s.workspace_id = ?2 AND s.ebay_environment = ?6
          AND EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = ?2 AND wm.user_id = ?7)
          AND EXISTS (SELECT 1 FROM tax_identifiers t WHERE t.order_id = o.id AND t.removed_at IS NULL)
          AND o.merged_into IS NULL AND o.retention_until > ?4 AND ${consultableStore("s")}
          AND ${access})`)
        .bind(
          crypto.randomUUID(),
          allowance.workspaceId,
          id,
          at,
          allowance.cycle!.id,
          ebayEnvironment,
          userId,
        ),
    ),
    ...(skipConfirmation && ids.length === 1
      ? [
          db
            .prepare(`INSERT INTO unlock_preferences VALUES (?, 0)
      ON CONFLICT(user_id) DO UPDATE SET confirm_unlock = 0`)
            .bind(userId),
        ]
      : []),
  ]);
  return { unlocked: unique, remaining: (await orderAllowance(db, userId, now))!.remaining };
}
