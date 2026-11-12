import { adminPageSize } from "../limits";
import { stripeEnvironment } from "../integrations/stripe.server";
import { vacantLifetimeSeats } from "./lifetime.server";
import { activeCoverageSql } from "./grants.server";
import { storeLabelSql } from "./store-state.server";
import { listWorkspaceStores, pauseReasonSql, type StoreStatus } from "./stores.server";

/**
 * Anagrafica della console (§15): account, spazi e negozi con piano, diritti, incassi e stato
 * delle letture. Nessuna impersonazione, nessun ordine, buyer o valore fiscale: dei negozi
 * compaiono soltanto identità, collegamento e conteggi.
 */

/** Testo cercato: email, nome, ragione sociale, spazio, negozio o account eBay. */
const searchSql = `(?2 IS NULL OR instr(lower(u.email), ?2) > 0 OR instr(lower(u.name), ?2) > 0
  OR instr(lower(COALESCE(p.company_name, '')), ?2) > 0 OR w.id = ?3
  OR EXISTS (SELECT 1 FROM ebay_stores s WHERE s.workspace_id = w.id
    AND (instr(lower(COALESCE(s.store_name, s.display_name, s.ebay_account_id, '')), ?2) > 0
      OR s.id = ?3)))`;

/** Il registro usa il proprietario corrente del negozio, mai lo spazio indicato dal modulo. */
export async function storeAuditTarget(db: D1Database, storeId: string) {
  const store = await db
    .prepare("SELECT workspace_id FROM ebay_stores WHERE id = ?")
    .bind(storeId)
    .first<{ workspace_id: string }>();
  return store ? `workspace:${store.workspace_id}:store:${storeId}` : `store:${storeId}`;
}

export type AccountRow = {
  userId: string;
  email: string;
  name: string;
  company: string | null;
  createdAt: string;
  admin: boolean;
  waitlisted: boolean;
  workspaceId: string | null;
  coverage: "premium" | "trial" | "lifetime" | "admin" | null;
  stores: number;
};

export async function listAccounts(
  db: D1Database,
  options: { query?: string; offset?: number } = {},
  now = new Date(),
): Promise<{ rows: AccountRow[]; more: boolean }> {
  const query = options.query?.trim().toLowerCase() || null;
  const { results } = await db
    .prepare(`SELECT u.id AS userId, u.email, u.name, p.company_name AS company,
        u."createdAt" AS createdAt, u."admin" AS admin, p.waitlisted_at IS NOT NULL AS waitlisted,
        w.id AS workspaceId, ${activeCoverageSql("source", "w.id", "?1")} AS coverage,
        (SELECT COUNT(*) FROM ebay_stores s WHERE s.workspace_id = w.id
          AND s.data_deleted_at IS NULL) AS stores
      FROM "user" u LEFT JOIN user_profiles p ON p.user_id = u.id
      LEFT JOIN workspace_members wm ON wm.user_id = u.id
      LEFT JOIN workspaces w ON w.id = wm.workspace_id
      WHERE ${searchSql}
      ORDER BY u."createdAt" DESC, u.id LIMIT ?4 OFFSET ?5`)
    .bind(
      now.toISOString(),
      query,
      options.query?.trim() ?? null,
      adminPageSize + 1,
      options.offset ?? 0,
    )
    .all<
      Omit<AccountRow, "admin" | "waitlisted" | "createdAt"> & {
        admin: number;
        waitlisted: number;
        createdAt: string | number;
      }
    >();
  return {
    rows: results.slice(0, adminPageSize).map((row) => ({
      ...row,
      createdAt: new Date(row.createdAt).toISOString(),
      admin: row.admin === 1,
      waitlisted: row.waitlisted === 1,
    })),
    more: results.length > adminPageSize,
  };
}

export type Entitlement = {
  id: string;
  source: "premium" | "trial" | "lifetime" | "admin";
  startsAt: string;
  endsAt: string | null;
  revokedAt: string | null;
  revocation: "refund" | "dispute" | null;
  amountPaid: number | null;
  amountRefunded: number | null;
  currency: string | null;
  paidAt: string | null;
  grantedBy: string | null;
  reason: string | null;
};

export type WorkspaceDetail = {
  id: string;
  name: string;
  createdAt: string;
  members: { userId: string; email: string; role: string; name: string }[];
  profile: { accountType: string; company: string | null; waitlistedAt: string | null } | null;
  coverage: Entitlement["source"] | null;
  entitlements: Entitlement[];
  subscriptions: {
    id: string;
    offer: string;
    status: string;
    customerId: string;
    periodEnd: string;
    cancelAtPeriodEnd: boolean;
    unavailable: boolean;
  }[];
  lifetime: { slot: number; kind: string; status: string; customerId: string | null } | null;
  /** Posti rimasti senza spazio dopo una cancellazione, che lo spazio può riprendere. */
  vacantSeats: Awaited<ReturnType<typeof vacantLifetimeSeats>>;
  customers: { id: string; erased: { source: string; at: string } | null }[];
  billingIncidents: {
    sessionId: string;
    customerId: string | null;
    openedAt: string;
    checkedAt: string;
  }[];
  cycle: { startsAt: string; endsAt: string; quota: number; used: number } | null;
  freeStore: { storeId: string; kind: string; changedAt: string } | null;
  extensions: {
    id: string;
    months: number;
    actor: string;
    reason: string;
    grantedAt: string;
    revokedAt: string | null;
  }[];
  stores: (StoreStatus & { detailErrors: number })[];
  /** Negozi dello spazio con i dati eliminati, che restano per l'identità del collegamento. */
  removedStores: { id: string; label: string }[];
};

export async function workspaceDetail(
  env: Env,
  workspaceId: string,
  now = new Date(),
): Promise<WorkspaceDetail | null> {
  const db = env.DB;
  const at = now.toISOString();
  const workspace = await db
    .prepare(`SELECT w.id, w.name, w.created_at AS createdAt,
        ${activeCoverageSql("source", "w.id", "?2")} AS coverage FROM workspaces w WHERE w.id = ?1`)
    .bind(workspaceId, at)
    .first<{
      id: string;
      name: string;
      createdAt: string;
      coverage: Entitlement["source"] | null;
    }>();
  if (!workspace) return null;
  const environment = stripeEnvironment(env);
  const [
    members,
    entitlements,
    subscriptions,
    lifetime,
    customers,
    cycle,
    freeStore,
    extensions,
    removed,
    profile,
    detailErrors,
    billingIncidents,
  ] = await db.batch<Record<string, unknown>>([
    db
      .prepare(`SELECT wm.user_id AS userId, u.email, u.name, wm.role FROM workspace_members wm
          JOIN "user" u ON u.id = wm.user_id WHERE wm.workspace_id = ? ORDER BY wm.role DESC`)
      .bind(workspaceId),
    db
      .prepare(`SELECT id, source, starts_at AS startsAt, ends_at AS endsAt,
            revoked_at AS revokedAt, revocation, amount_paid AS amountPaid,
            amount_refunded AS amountRefunded, currency, paid_at AS paidAt,
            COALESCE((SELECT u.email FROM "user" u WHERE u.id = granted_by), granted_by)
              AS grantedBy, grant_reason AS reason
          FROM workspace_entitlements WHERE workspace_id = ? ORDER BY starts_at DESC`)
      .bind(workspaceId),
    db
      .prepare(`SELECT id, offer, status, customer_id AS customerId,
            current_period_end AS periodEnd, cancel_at_period_end AS cancelAtPeriodEnd,
            unavailable_at IS NOT NULL AS unavailable
          FROM stripe_subscriptions WHERE workspace_id = ? AND environment = ?
          ORDER BY current_period_start DESC`)
      .bind(workspaceId, environment),
    db
      .prepare(`SELECT slot, kind, status, customer_id AS customerId FROM lifetime_allocations
          WHERE workspace_id = ?`)
      .bind(workspaceId),
    db
      .prepare(`SELECT c.id, e.source, e.received_at AS at FROM (
            SELECT customer_id AS id FROM stripe_subscriptions WHERE workspace_id = ?1
              AND environment = ?2
            UNION SELECT customer_id FROM lifetime_allocations WHERE workspace_id = ?1
              AND customer_id IS NOT NULL
            UNION SELECT customer_id FROM billing_incidents WHERE workspace_id = ?1
              AND environment = ?2 AND customer_id IS NOT NULL AND resolved_at IS NULL) c
          LEFT JOIN stripe_customer_erasures e ON e.customer_id = c.id`)
      .bind(workspaceId, environment),
    db
      .prepare(`SELECT starts_at AS startsAt, ends_at AS endsAt, quota, used FROM free_cycles
          WHERE workspace_id = ?1 AND julianday(starts_at) <= julianday(?2)
            AND julianday(?2) < julianday(ends_at)`)
      .bind(workspaceId, at),
    db
      .prepare(`SELECT c.store_id AS storeId, c.kind, c.changed_at AS changedAt
          FROM free_store_changes c JOIN ebay_stores s ON s.id = c.store_id
            AND s.workspace_id = c.workspace_id
          WHERE c.workspace_id = ? ORDER BY c.changed_at DESC, c.rowid DESC LIMIT 1`)
      .bind(workspaceId),
    db
      .prepare(`SELECT id, months,
          COALESCE((SELECT u.email FROM "user" u WHERE u.id = actor), actor) AS actor, reason,
          granted_at AS grantedAt,
            revoked_at AS revokedAt FROM history_extensions WHERE workspace_id = ?
          ORDER BY granted_at DESC`)
      .bind(workspaceId),
    db
      .prepare(`SELECT s.id, ${storeLabelSql("s")} AS label FROM ebay_stores s
          WHERE s.workspace_id = ? AND s.data_deleted_at IS NOT NULL ORDER BY s.linked_at`)
      .bind(workspaceId),
    db
      .prepare(`SELECT p.account_type AS accountType, p.company_name AS company,
          p.waitlisted_at AS waitlistedAt FROM workspace_members wm
        JOIN user_profiles p ON p.user_id = wm.user_id WHERE wm.workspace_id = ?
        ORDER BY wm.role = 'owner' DESC LIMIT 1`)
      .bind(workspaceId),
    db
      .prepare(`SELECT r.store_id AS id, COUNT(*) AS count FROM order_source_refs r
      JOIN ebay_stores s ON s.id = r.store_id
      WHERE s.workspace_id = ? AND r.detail_error IS NOT NULL GROUP BY r.store_id`)
      .bind(workspaceId),
    db
      .prepare(`SELECT session_id AS sessionId, customer_id AS customerId, opened_at AS openedAt, checked_at AS checkedAt
      FROM billing_incidents i WHERE workspace_id = ?1 AND environment = ?2 AND resolved_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM stripe_customer_erasures e WHERE e.customer_id = i.customer_id)
      ORDER BY opened_at`)
      .bind(workspaceId, environment),
  ]);
  return {
    ...workspace,
    billingIncidents: billingIncidents!.results as WorkspaceDetail["billingIncidents"],
    members: members!.results as WorkspaceDetail["members"],
    profile: (profile!.results[0] as WorkspaceDetail["profile"]) ?? null,
    entitlements: entitlements!.results as Entitlement[],
    subscriptions: (subscriptions!.results as Record<string, unknown>[]).map((row) => ({
      ...(row as Omit<
        WorkspaceDetail["subscriptions"][number],
        "cancelAtPeriodEnd" | "unavailable"
      >),
      cancelAtPeriodEnd: row.cancelAtPeriodEnd === 1,
      unavailable: row.unavailable === 1,
    })),
    lifetime: (lifetime!.results[0] as WorkspaceDetail["lifetime"]) ?? null,
    customers: (
      customers!.results as { id: string; source: string | null; at: string | null }[]
    ).map((row) => ({
      id: row.id,
      erased: row.source ? { source: row.source, at: row.at! } : null,
    })),
    cycle: (cycle!.results[0] as WorkspaceDetail["cycle"]) ?? null,
    freeStore: (freeStore!.results[0] as WorkspaceDetail["freeStore"]) ?? null,
    extensions: extensions!.results as WorkspaceDetail["extensions"],
    stores: (await listWorkspaceStores(db, workspaceId, now)).map((store) => ({
      ...store,
      detailErrors: Number(detailErrors!.results.find((row) => row.id === store.id)?.count ?? 0),
    })),
    removedStores: removed!.results as WorkspaceDetail["removedStores"],
    vacantSeats: await vacantLifetimeSeats(db),
  };
}

export type StoreRow = {
  id: string;
  label: string;
  workspaceId: string;
  ownerEmail: string | null;
  environment: string;
  linkedAt: string;
  disconnected: boolean;
  removed: boolean;
  consent: "valid" | "rejected" | "expired" | "none";
  pauses: string[];
  lastSuccessAt: string | null;
  failures: number;
  requestedAt: string | null;
  syncing: boolean;
  orders: number;
  detailErrors: number;
};

/**
 * Stato delle letture del negozio `s` con le credenziali `c`: collegamento, consenso, esito delle
 * ultime due letture e dettagli degli ordini non riusciti.
 */
const storeHealthSql = (
  at: string,
) => `s.disconnected_at IS NOT NULL AS disconnected, s.data_deleted_at IS NOT NULL AS removed,
  CASE WHEN c.store_id IS NULL THEN 'none' WHEN c.rejected_at IS NOT NULL THEN 'rejected'
    WHEN c.refresh_expires_at <= ${at} THEN 'expired' ELSE 'valid' END AS consent,
  (SELECT COUNT(*) FROM (SELECT ok FROM sync_runs r WHERE r.store_id = s.id
    ORDER BY started_at DESC, id DESC LIMIT 2) WHERE ok = 0) AS failures,
  (SELECT COUNT(*) FROM order_source_refs r WHERE r.store_id = s.id
    AND r.detail_error IS NOT NULL) AS detailErrors`;

/**
 * Negozio con un problema, sulle colonne di `storeHealthSql`: ancora collegato, con il consenso
 * non valido, due letture fallite di seguito o dettagli non riusciti. Vale per l'elenco e per il
 * conteggio della panoramica.
 */
const storeProblemSql = `(NOT removed AND NOT disconnected
  AND (failures = 2 OR detailErrors > 0 OR consent <> 'valid'))`;

/** Negozi di tutti gli spazi, eventualmente soltanto quelli con un problema delle letture. */
export async function listAllStores(
  db: D1Database,
  options: { query?: string; problems?: boolean; offset?: number } = {},
  now = new Date(),
): Promise<{ rows: StoreRow[]; more: boolean }> {
  const query = options.query?.trim().toLowerCase() || null;
  const { results } = await db
    .prepare(`SELECT * FROM (SELECT s.id, ${storeLabelSql("s")} AS label,
        s.workspace_id AS workspaceId, s.ebay_environment AS environment, s.linked_at AS linkedAt,
        (SELECT u.email FROM workspace_members wm JOIN "user" u ON u.id = wm.user_id
          WHERE wm.workspace_id = s.workspace_id ORDER BY wm.role = 'owner' DESC LIMIT 1)
          AS ownerEmail,
        ${storeHealthSql("?1")},
        (SELECT group_concat(${pauseReasonSql}) FROM ebay_store_pauses p
          WHERE p.store_id = s.id) AS pauses,
        ss.last_success_at AS lastSuccessAt, ss.requested_at AS requestedAt,
        COALESCE(ss.locked_until > ?1, 0) AS syncing,
        (SELECT COUNT(*) FROM orders o WHERE o.store_id = s.id) AS orders
      FROM ebay_stores s LEFT JOIN ebay_store_credentials c ON c.store_id = s.id
      LEFT JOIN sync_state ss ON ss.store_id = s.id
      WHERE ?2 IS NULL OR s.id = ?3 OR s.workspace_id = ?3
        OR instr(lower(${storeLabelSql("s")}), ?2) > 0) x
      WHERE ?4 = 0 OR ${storeProblemSql}
      ORDER BY x.linkedAt DESC, x.id LIMIT ?5 OFFSET ?6`)
    .bind(
      now.toISOString(),
      query,
      options.query?.trim() ?? null,
      options.problems ? 1 : 0,
      adminPageSize + 1,
      options.offset ?? 0,
    )
    .all<
      Omit<StoreRow, "disconnected" | "removed" | "syncing" | "pauses"> & {
        disconnected: number;
        removed: number;
        syncing: number;
        pauses: string | null;
      }
    >();
  return {
    rows: results.slice(0, adminPageSize).map((row) => ({
      ...row,
      disconnected: row.disconnected === 1,
      removed: row.removed === 1,
      syncing: row.syncing === 1,
      pauses: row.pauses?.split(",").sort() ?? [],
    })),
    more: results.length > adminPageSize,
  };
}

export type ConsoleSummary = {
  users: number;
  waitlisted: number;
  coverage: { premium: number; lifetime: number; trial: number; admin: number };
  stores: { active: number; problems: number };
};

/**
 * Numeri chiave della panoramica: account, spazi coperti per origine e negozi che leggono,
 * con quelli che hanno un problema delle letture o del collegamento.
 */
export async function consoleSummary(db: D1Database, now = new Date()): Promise<ConsoleSummary> {
  const at = now.toISOString();
  const [accounts, coverage, stores] = await db.batch<Record<string, number | string | null>>([
    db.prepare(`SELECT (SELECT COUNT(*) FROM "user") AS users,
        (SELECT COUNT(*) FROM user_profiles WHERE waitlisted_at IS NOT NULL) AS waitlisted`),
    db
      .prepare(`SELECT coverage, COUNT(*) AS count FROM (
          SELECT ${activeCoverageSql("source", "w.id", "?1")} AS coverage FROM workspaces w)
        WHERE coverage IS NOT NULL GROUP BY coverage`)
      .bind(at),
    db
      .prepare(`SELECT SUM(NOT removed AND NOT disconnected AND consent = 'valid' AND NOT paused)
            AS active,
          SUM(${storeProblemSql}) AS problems
        FROM (SELECT ${storeHealthSql("?1")},
            EXISTS (SELECT 1 FROM ebay_store_pauses p WHERE p.store_id = s.id) AS paused
          FROM ebay_stores s LEFT JOIN ebay_store_credentials c ON c.store_id = s.id)`)
      .bind(at),
  ]);
  const totals = accounts!.results[0] as { users: number; waitlisted: number };
  const byCoverage = new Map(
    (coverage!.results as { coverage: string; count: number }[]).map((row) => [
      row.coverage,
      row.count,
    ]),
  );
  const storeTotals = stores!.results[0] as { active: number | null; problems: number | null };
  return {
    users: totals.users,
    waitlisted: totals.waitlisted,
    coverage: {
      premium: byCoverage.get("premium") ?? 0,
      lifetime: byCoverage.get("lifetime") ?? 0,
      trial: byCoverage.get("trial") ?? 0,
      admin: byCoverage.get("admin") ?? 0,
    },
    stores: { active: storeTotals.active ?? 0, problems: storeTotals.problems ?? 0 },
  };
}
