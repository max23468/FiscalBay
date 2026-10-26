import { purchasesOpenSql, waitingSql } from "./admission-state.server";
import { consultableStore } from "./store-state.server";
import type { EbayEnvironment } from "../view-models";
import { dayMilliseconds } from "../time";
import { sqlList } from "./sql.server";

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

/**
 * Spazio con un abbonamento Premium attivo all'istante `at`. Argomenti: espressioni SQL dello
 * spazio e dell'istante.
 */
export function activeEntitlementSql(workspace: string, at: string) {
  return `EXISTS (SELECT 1 FROM workspace_entitlements e WHERE e.workspace_id = ${workspace}
    AND e.revoked_at IS NULL AND julianday(e.starts_at) <= julianday(${at})
    AND (e.ends_at IS NULL OR julianday(${at}) < julianday(e.ends_at)))`;
}

/** Stati in cui un abbonamento Stripe può ancora incassare. */
export const openSubscriptionStatuses = [
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "incomplete",
  "paused",
] as const;

/**
 * Abbonamento dello spazio che può ancora incassare, come un pagamento da confermare o un
 * rinnovo da regolarizzare: un nuovo acquisto o la prova lo sovrapporrebbero.
 */
export function openSubscriptionSql(workspace: string) {
  return `EXISTS (SELECT 1 FROM stripe_subscriptions s WHERE s.workspace_id = ${workspace}
    AND s.unavailable_at IS NULL
    AND s.status IN (${sqlList(openSubscriptionStatuses)}))`;
}

/**
 * Copertura attiva mostrata all'utente: prima un diritto diverso dalla prova, poi quello che
 * dura di più. Argomenti come in `activeEntitlementSql`.
 */
export function activeCoverageSql(column: "source" | "ends_at", workspace: string, at: string) {
  return `(SELECT e.${column} FROM workspace_entitlements e WHERE e.workspace_id = ${workspace}
    AND e.revoked_at IS NULL AND julianday(e.starts_at) <= julianday(${at})
    AND (e.ends_at IS NULL OR julianday(${at}) < julianday(e.ends_at))
    ORDER BY e.source = 'trial', e.ends_at IS NOT NULL, julianday(e.ends_at) DESC LIMIT 1)`;
}

/** Lifetime in vigore: un rimborso o una disputa persa lo revocano e il posto resta occupato. */
export const lifetimeInForceSql = (
  workspace: string,
) => `EXISTS (SELECT 1 FROM workspace_entitlements e
  WHERE e.workspace_id = ${workspace} AND e.source = 'lifetime' AND e.revoked_at IS NULL)`;

/** Durata della prova Premium, in giorni di 24 ore sull'istante UTC come i cicli del Free. */
export const trialDays = 14;

const trialLength = trialDays * dayMilliseconds;

/**
 * Prima lettura riuscita di un negozio dello spazio, anche senza ordini: abilita prova e
 * acquisto. Lo scollegamento successivo non la toglie, il negozio è già stato letto.
 */
export function storeReadSql(workspace: string) {
  return `EXISTS (SELECT 1 FROM ebay_stores s JOIN sync_state ss ON ss.store_id = s.id
      WHERE s.workspace_id = ${workspace} AND ss.last_success_at IS NOT NULL)`;
}

/**
 * La prova si offre allo spazio che non l'ha mai avuta, senza una copertura in corso né un
 * abbonamento che può ancora incassare, dopo la prima lettura riuscita di un suo negozio, e
 * soltanto con gli acquisti aperti: senza capacità per nuovi Premium la prova non è erogabile.
 */
function trialAvailableSql(workspace: string, at: string) {
  return `(NOT EXISTS (SELECT 1 FROM workspace_entitlements e
      WHERE e.workspace_id = ${workspace} AND e.source = 'trial')
    AND NOT ${activeEntitlementSql(workspace, at)} AND NOT ${openSubscriptionSql(workspace)}
    AND ${storeReadSql(workspace)} AND ${purchasesOpenSql})`;
}

/**
 * Attivazione volontaria della prova: 14 giorni fissi da adesso, senza pause né ripartenze,
 * che scorrono anche scollegando il negozio. Nessun abbonamento o pagamento. Restituisce la
 * fine della prova, o null se non era disponibile: già usata, anche da una richiesta
 * concorrente, con un'altra copertura in corso o prima della prima lettura riuscita.
 */
export async function startTrial(db: D1Database, userId: string, now = new Date()) {
  const at = now.toISOString();
  const row = await db
    .prepare(`INSERT INTO workspace_entitlements (id, workspace_id, source, starts_at, ends_at)
    SELECT ?1, w.id, 'trial', ?3, ?4 FROM workspaces w
      JOIN workspace_members wm ON wm.workspace_id = w.id
    WHERE wm.user_id = ?2 AND ${trialAvailableSql("w.id", "?3")}
    ON CONFLICT DO NOTHING RETURNING ends_at`)
    .bind(crypto.randomUUID(), userId, at, new Date(now.getTime() + trialLength).toISOString())
    .first<{ ends_at: string }>();
  return row?.ends_at ?? null;
}

/** Motivi per cui uno sblocco non avviene: nessun ordine, quota o testo SQL nel risultato. */
export type UnlockErrorCode =
  | "invalid_order_selection"
  | "order_not_available"
  | "order_not_in_workspace"
  | "free_quota_exhausted"
  | "tax_data_unavailable"
  | "invalid_grant_cycle"
  | "order_already_granted_or_merged"
  | "order_already_granted";

export class UnlockError extends Error {
  constructor(readonly code: UnlockErrorCode) {
    super(code);
    this.name = "UnlockError";
  }
}

/** Rifiuti dei trigger su `order_grants`, con il codice che sollevano. */
const unlockTriggerCodes: UnlockErrorCode[] = [
  "order_not_available",
  "order_not_in_workspace",
  "free_quota_exhausted",
  "tax_data_unavailable",
  "invalid_grant_cycle",
  "order_already_granted_or_merged",
];
// Stryker disable next-line StringLiteral: i codici sono ASCII e il flag non cambia il confronto.
const unlockTriggerPattern = new RegExp(unlockTriggerCodes.join("|"), "u");

/**
 * Codice dello sblocco rifiutato dal database; null per un errore di altra natura. Un ordine
 * fuori dallo spazio, nell'altro ambiente o senza dato lascia nulla la colonna dell'ordine e lo
 * fermano i trigger o, in loro assenza, il vincolo NOT NULL; un grant già esistente, anche
 * scaduto o revocato, viola l'unicità per spazio e ordine.
 */
function unlockErrorCode(error: unknown): UnlockErrorCode | null {
  for (let cause = error; cause instanceof Error; cause = cause.cause) {
    const { message } = cause;
    const trigger = unlockTriggerPattern.exec(message)?.[0];
    if (trigger) return trigger as UnlockErrorCode;
    if (message.includes("NOT NULL constraint failed: order_grants.order_id"))
      return "order_not_in_workspace";
    if (
      message.includes("UNIQUE constraint failed: order_grants.workspace_id, order_grants.order_id")
    )
      return "order_already_granted";
  }
  return null;
}

/** Conferma dello sblocco disattivata per l'utente. */
const skipConfirmationStatement = (db: D1Database, userId: string) =>
  db
    .prepare(`INSERT INTO unlock_preferences VALUES (?, 0)
      ON CONFLICT(user_id) DO UPDATE SET confirm_unlock = 0`)
    .bind(userId);

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
  await skipConfirmationStatement(db, userId).run();
}

/** Sblocchi di un ciclo Free fuori dalle promozioni. */
export const baseFreeQuota = 5;

const cycleLength = 7 * dayMilliseconds;

/**
 * Quota di un ciclo che inizia all'istante `at`, espressione SQL: la promozione in corso a
 * quell'istante, altrimenti la base. Vale la promozione come era configurata a quell'istante,
 * cioè la versione precedente alla prima modifica successiva: una fine anticipata non toglie la
 * quota a un ciclo già iniziato, anche se la sua riga si crea dopo la modifica.
 */
function cycleQuotaSql(at: string) {
  const previous = (column: string) => `(SELECT c.previous_${column} FROM free_promotion_changes c
    WHERE c.promotion_id = p.id AND julianday(c.changed_at) > julianday(${at})
    ORDER BY julianday(c.changed_at) LIMIT 1)`;
  return `COALESCE((SELECT v.quota FROM (SELECT COALESCE(${previous("starts_at")}, p.starts_at)
      AS starts_at, COALESCE(${previous("ends_at")}, p.ends_at) AS ends_at,
      COALESCE(${previous("quota")}, p.quota) AS quota FROM free_promotions p) v
    WHERE julianday(v.starts_at) <= julianday(${at}) AND julianday(${at}) < julianday(v.ends_at)),
    ${baseFreeQuota})`;
}

/** Promozione globale del Free in corso, con la quota e la fine da annunciare. */
export async function currentFreePromotion(db: D1Database, now = new Date()) {
  return db
    .prepare(`SELECT quota, ends_at AS endsAt FROM free_promotions
    WHERE julianday(starts_at) <= julianday(?1) AND julianday(?1) < julianday(ends_at)`)
    .bind(now.toISOString())
    .first<{ quota: number; endsAt: string }>();
}

type EntitlementSource = "premium" | "trial" | "lifetime" | "admin";

type FreeCycle = { id: string; used: number; quota: number; ends_at: string; next_quota: number };

/**
 * Cicli consecutivi di 7×24 ore sul tempo UTC, fissati al primo collegamento riuscito e mai
 * alla riconnessione: ora legale e fuso dell'utente non spostano i confini. Il ciclo si crea
 * quando serve, con la quota decisa al suo inizio; `next_quota` è quella del ciclo seguente.
 */
export async function orderAllowance(db: D1Database, userId: string, now = new Date()) {
  const at = now.toISOString();
  const workspace = await db
    .prepare(`SELECT w.id, w.free_cycle_anchor_at, ${activeEntitlementSql("w.id", "?1")} AS premium,
      ${activeCoverageSql("source", "w.id", "?1")} AS coverage,
      ${activeCoverageSql("ends_at", "w.id", "?1")} AS coverage_ends_at,
      ${trialAvailableSql("w.id", "?1")} AS trial_available, ${waitingSql("w.id")} AS waiting,
      ${purchasesOpenSql} AS purchases_open
    FROM workspaces w JOIN workspace_members wm ON wm.workspace_id = w.id
    WHERE wm.user_id = ?2`)
    .bind(at, userId)
    .first<{
      id: string;
      free_cycle_anchor_at: string | null;
      premium: number;
      coverage: EntitlementSource | null;
      coverage_ends_at: string | null;
      trial_available: number;
      waiting: number;
      purchases_open: number;
    }>();
  if (!workspace) return null;
  const current = db
    .prepare(`SELECT c.id, c.used, c.quota, c.ends_at, ${cycleQuotaSql("c.ends_at")} AS next_quota
    FROM free_cycles c WHERE c.workspace_id = ?1 AND julianday(c.starts_at) <= julianday(?2)
      AND julianday(?2) < julianday(c.ends_at) ORDER BY c.starts_at DESC LIMIT 1`)
    .bind(workspace.id, at);
  let cycle = await current.first<FreeCycle>();
  if (!cycle && workspace.free_cycle_anchor_at) {
    const anchor = Date.parse(workspace.free_cycle_anchor_at);
    const start = anchor + Math.floor((now.getTime() - anchor) / cycleLength) * cycleLength;
    if (start >= anchor) {
      // Richieste concorrenti calcolano la stessa finestra e la stessa quota: vince una riga.
      await db
        .prepare(`INSERT OR IGNORE INTO free_cycles (id, workspace_id, starts_at, ends_at, quota)
        VALUES (?1, ?2, ?3, ?4, ${cycleQuotaSql("?3")})`)
        .bind(
          crypto.randomUUID(),
          workspace.id,
          new Date(start).toISOString(),
          new Date(start + cycleLength).toISOString(),
        )
        .run();
      cycle = await current.first<FreeCycle>();
    }
  }
  return {
    workspaceId: workspace.id,
    premium: !!workspace.premium,
    /** Origine e fine della copertura in corso; la fine è null per il lifetime. */
    coverage: workspace.coverage
      ? { source: workspace.coverage, endsAt: workspace.coverage_ends_at }
      : null,
    trialAvailable: !!workspace.trial_available,
    /** In lista d'attesa senza copertura: il Free, con i suoi sblocchi, non è ancora erogato. */
    waiting: !workspace.premium && !!workspace.waiting,
    /** Acquisti e prove aperti. */
    purchasesOpen: !!workspace.purchases_open,
    cycle,
    remaining: workspace.premium
      ? null
      : cycle && !workspace.waiting
        ? cycle.quota - cycle.used
        : 0,
  };
}

/**
 * L'intero lotto e la preferenza sono un unico commit: un rifiuto non consuma nulla. Ogni rifiuto
 * dello sblocco, anche del database, diventa un `UnlockError`; gli altri errori restano tali.
 */
export async function unlockOrders(
  db: D1Database,
  userId: string,
  ids: string[],
  skipConfirmation = false,
  ebayEnvironment: EbayEnvironment = "production",
  now = new Date(),
) {
  if (!ids.length || ids.length > 100 || ids.some((id) => !id || id.length > 128))
    throw new UnlockError("invalid_order_selection");
  const unique = [...new Set(ids)];
  const allowance = await orderAllowance(db, userId, now);
  if (!allowance?.cycle) throw new UnlockError("order_not_available");
  if (allowance.waiting) throw new UnlockError("free_quota_exhausted");
  const at = now.toISOString();
  const access = orderAccessSql("o.id", "?2", "?4");
  const grants = [
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
    ...(skipConfirmation && ids.length === 1 ? [skipConfirmationStatement(db, userId)] : []),
  ];
  try {
    await db.batch(grants);
  } catch (error) {
    const code = unlockErrorCode(error);
    throw code ? new UnlockError(code) : error;
  }
  return { unlocked: unique, remaining: (await orderAllowance(db, userId, now))!.remaining };
}

/** Prova in corso per l'interfaccia, se nessun'altra copertura è attiva insieme a essa. */
export function accountCoverage(allowance: Awaited<ReturnType<typeof orderAllowance>>): {
  trial?: { endsAt: string };
} {
  const coverage = allowance?.coverage;
  return coverage?.source === "trial" && coverage.endsAt
    ? { trial: { endsAt: coverage.endsAt } }
    : {};
}
