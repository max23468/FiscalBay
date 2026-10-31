import { priceGeneration } from "../catalog";
import { stripeEnvironment } from "../integrations/stripe.server";
import { activeCoverageSql, activeEntitlementSql } from "./grants.server";
import { dayMilliseconds } from "../time";

/**
 * KPI della console (§31): conteggi aggregati con finestra e denominatore espliciti, calcolati
 * a ogni lettura da D1. I primi passaggi degli spazi sono le righe deduplicate di
 * `workspace_funnel_steps`, scritte dai trigger; le letture sono gli aggregati giornalieri di
 * `sync_daily`. Nessun dato fiscale, buyer o identificativo esce dalla funzione: soltanto numeri.
 */

/** Giorni di aggregati delle letture conservati. */
export const syncDailyRetentionDays = 90;

export const metricWindows = [7, 30, 90] as const;
export type MetricWindow = (typeof metricWindows)[number];

export function metricWindowFrom(value: string | null): MetricWindow {
  const days = Number(value);
  return (metricWindows as readonly number[]).includes(days) ? (days as MetricWindow) : 30;
}

/** Passaggi dello spazio in ordine di funnel, dopo registrazione e verifica dell'email. */
export const spaceSteps = [
  "store_linked",
  "first_sync",
  "first_order",
  "first_tax_id",
  "first_unlock",
  "trial",
  "purchase",
] as const;
export type SpaceStep = (typeof spaceSteps)[number];

export type FunnelStep = {
  step: "registered" | "verified" | SpaceStep;
  /** Passaggio che fa da base, null per la registrazione. */
  after: "registered" | "verified" | SpaceStep | null;
  count: number;
  /** Spazi arrivati al passaggio di base: il denominatore della quota. */
  of: number;
  /** Mediana delle ore dalla registrazione, null senza spazi arrivati. */
  medianHours: number | null;
};

/** Merchant operativo: negozio collegato con una lettura riuscita negli ultimi 30 giorni. */
const operativeDays = 30;
/** Ritardo massimo atteso fra due letture riuscite dello stesso negozio (target 10/30). */
const lagTargetMinutes = 30;
/** Negozi della stima di carico del §31, riferimento della capacità. */
const referenceStores = 150;
/** Soglia prudenziale del singolo database D1. */
const databaseBudgetBytes = 8 * 1024 ** 3;

/** Istante di Better Auth in giorni giuliani, salvato come testo ISO o come millisecondi. */
const julian = (column: string) =>
  `(CASE typeof(${column}) WHEN 'integer' THEN ${column} / 86400000.0 + 2440587.5
    ELSE julianday(${column}) END)`;

/** Negozio che oggi legge: collegato, consenso valido, nessuna pausa, dati presenti. */
const readingStoreSql = `s.data_deleted_at IS NULL AND s.disconnected_at IS NULL
  AND c.rejected_at IS NULL AND c.refresh_expires_at > ?1
  AND NOT EXISTS (SELECT 1 FROM ebay_store_pauses p WHERE p.store_id = s.id)`;

/** Mediana al decimo: oltre, la precisione dei giorni giuliani non è una misura. */
function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
  return Math.round(value * 10) / 10;
}

/** Quota di `count` su `of`; null senza base. */
export const share = (count: number, of: number) => (of > 0 ? count / of : null);

/**
 * Base di ogni passaggio: si conta soltanto chi l'ha già raggiunta, così nessuna quota supera il
 * 100% anche quando un fatto arriva senza il precedente. La prova si offre dopo la prima lettura
 * riuscita; lo spazio, e quindi l'acquisto, esiste dal collegamento del primo negozio.
 */
const funnelBase = {
  verified: "registered",
  store_linked: "verified",
  first_sync: "store_linked",
  first_order: "first_sync",
  first_tax_id: "first_order",
  first_unlock: "first_order",
  trial: "first_sync",
  purchase: "store_linked",
} as const satisfies Record<Exclude<FunnelStep["step"], "registered">, FunnelStep["step"]>;

/** Funnel della coorte registrata nella finestra, senza gli admin. */
async function funnel(db: D1Database, from: string, to: string) {
  const cohortSql = `FROM "user" u
    LEFT JOIN workspace_members wm ON wm.user_id = u.id AND wm.role = 'owner'
    WHERE u."admin" = 0
      AND ${julian('u."createdAt"')} >= julianday(?1) AND ${julian('u."createdAt"')} < julianday(?2)`;
  const [cohort, reached] = await db.batch<Record<string, number | string | null>>([
    db
      .prepare(`SELECT u.id AS user, u."emailVerified" = 1 AS verified ${cohortSql}`)
      .bind(from, to),
    db
      .prepare(`SELECT u.id AS user, m.step,
          (julianday(m.occurred_at) - ${julian('u."createdAt"')}) * 24 AS hours
        ${cohortSql.replace("WHERE", "JOIN workspace_funnel_steps m ON m.workspace_id = wm.workspace_id WHERE")}`)
      .bind(from, to),
  ]);
  const users = cohort!.results as { user: string; verified: number }[];
  // Ore dalla registrazione di ogni passaggio raggiunto, per utente.
  const reachedBy = new Map<FunnelStep["step"], Map<string, number | null>>([
    ["registered", new Map(users.map((row) => [row.user, null]))],
    ["verified", new Map(users.filter((row) => row.verified).map((row) => [row.user, null]))],
    ...spaceSteps.map((step) => [step, new Map<string, number | null>()] as const),
  ]);
  for (const row of reached!.results as { user: string; step: SpaceStep; hours: number }[])
    // Un passaggio ricostruito con un istante anteriore alla registrazione vale zero ore.
    reachedBy.get(row.step)!.set(row.user, Math.max(0, row.hours));
  const counted = new Map<FunnelStep["step"], Map<string, number | null>>([
    ["registered", reachedBy.get("registered")!],
  ]);
  const steps: FunnelStep[] = [
    {
      step: "registered",
      after: null,
      count: users.length,
      of: users.length,
      medianHours: null,
    },
  ];
  for (const [step, after] of Object.entries(funnelBase) as [
    keyof typeof funnelBase,
    FunnelStep["step"],
  ][]) {
    const base = counted.get(after)!;
    const inside = new Map([...reachedBy.get(step)!].filter(([user]) => base.has(user)));
    counted.set(step, inside);
    const hours = [...inside.values()].filter((value) => value !== null);
    steps.push({
      step,
      after,
      count: inside.size,
      of: base.size,
      medianHours: median(hours),
    });
  }
  const synced = counted.get("first_sync")!;
  return {
    steps,
    /** Prima lettura riuscita senza ordini: lo spazio non ha ancora un ordine. */
    syncWithoutOrders: [...synced.keys()].filter((user) => !reachedBy.get("first_order")!.has(user))
      .length,
  };
}

/** Abbonamenti, prove e lifetime ora; conversioni e incassi nella finestra. */
async function commerce(env: Env, from: string, to: string) {
  const db = env.DB;
  const [subscriptions, coverage, trials, purchases, cash] = await db.batch<
    Record<string, number | string | null>
  >([
    db
      .prepare(`SELECT offer, price_generation = ?3 AS listed, COUNT(*) AS count,
          SUM(cancel_at_period_end) AS cancelling
        FROM stripe_subscriptions WHERE environment = ?2 AND status IN ('active', 'past_due')
          AND unavailable_at IS NULL AND julianday(current_period_end) > julianday(?1)
        GROUP BY offer, listed`)
      .bind(to, stripeEnvironment(env), priceGeneration.id),
    db
      .prepare(`SELECT
          COUNT(DISTINCT CASE WHEN source = 'trial'
            AND ${activeCoverageSql("source", "o.workspace_id", "?1")} = 'trial'
            THEN workspace_id END) AS trialsOpen,
          COUNT(DISTINCT CASE WHEN source = 'lifetime' AND amount_paid > 0 THEN workspace_id END)
            AS lifetimePaid,
          COUNT(DISTINCT CASE WHEN source = 'lifetime' AND COALESCE(amount_paid, 0) = 0
            THEN workspace_id END) AS lifetimeGifted,
          COUNT(DISTINCT CASE WHEN source = 'admin' THEN workspace_id END) AS granted
        FROM workspace_entitlements o WHERE revoked_at IS NULL
          AND julianday(starts_at) <= julianday(?1)
          AND (ends_at IS NULL OR julianday(ends_at) > julianday(?1))`)
      .bind(to),
    // Prove concluse nella finestra e quante hanno un acquisto dopo il loro inizio.
    db
      .prepare(`SELECT COUNT(*) AS ended, COALESCE(SUM(EXISTS (
            SELECT 1 FROM workspace_funnel_steps m WHERE m.workspace_id = t.workspace_id
              AND m.step = 'purchase' AND julianday(m.occurred_at) >= julianday(t.starts_at))), 0)
            AS converted
        FROM workspace_entitlements t WHERE t.source = 'trial'
          AND julianday(COALESCE(t.revoked_at, t.ends_at)) >= julianday(?1)
          AND julianday(COALESCE(t.revoked_at, t.ends_at)) < julianday(?2)`)
      .bind(from, to),
    // Primi acquisti nella finestra: dopo una prova o direttamente dal Free.
    db
      .prepare(`SELECT COUNT(*) AS total, COALESCE(SUM(EXISTS (
            SELECT 1 FROM workspace_funnel_steps t WHERE t.workspace_id = m.workspace_id
              AND t.step = 'trial' AND julianday(t.occurred_at) <= julianday(m.occurred_at))), 0)
            AS afterTrial
        FROM workspace_funnel_steps m WHERE m.step = 'purchase'
          AND julianday(m.occurred_at) >= julianday(?1) AND julianday(m.occurred_at) < julianday(?2)`)
      .bind(from, to),
    db
      .prepare(`SELECT COALESCE(SUM(amount_paid), 0) AS paid,
          COALESCE(SUM(amount_refunded), 0) AS refunded
        FROM workspace_entitlements WHERE amount_paid IS NOT NULL AND currency = 'eur'
          AND julianday(paid_at) >= julianday(?1) AND julianday(paid_at) < julianday(?2)`)
      .bind(from, to),
  ]);
  const rows = subscriptions!.results as {
    offer: "monthly" | "annual";
    listed: number;
    count: number;
    cancelling: number;
  }[];
  const count = (offer: "monthly" | "annual") =>
    rows.filter((row) => row.offer === offer).reduce((sum, row) => sum + row.count, 0);
  const listed = (offer: "monthly" | "annual") =>
    rows
      .filter((row) => row.offer === offer && row.listed)
      .reduce((sum, row) => sum + row.count, 0);
  const totals = coverage!.results[0] as {
    trialsOpen: number;
    lifetimePaid: number;
    lifetimeGifted: number;
    granted: number;
  };
  const trial = trials!.results[0] as { ended: number; converted: number };
  const bought = purchases!.results[0] as { total: number; afterTrial: number };
  const money = cash!.results[0] as { paid: number; refunded: number };
  return {
    subscriptions: {
      monthly: count("monthly"),
      annual: count("annual"),
      cancelling: rows.reduce((sum, row) => sum + row.cancelling, 0),
      /** Abbonamenti di un'altra generazione, fuori dal ricavo ricorrente calcolato. */
      unlisted: rows.filter((row) => !row.listed).reduce((sum, row) => sum + row.count, 0),
    },
    /**
     * Ricavo ricorrente mensile netto dal listino: l'annuale vale un dodicesimo, il lifetime e
     * le prove ne restano fuori.
     */
    mrr: Math.round(
      listed("monthly") * priceGeneration.net.monthly +
        (listed("annual") * priceGeneration.net.annual) / 12,
    ),
    paying: count("monthly") + count("annual") + totals.lifetimePaid,
    ...totals,
    trials: { ended: trial.ended, converted: trial.converted },
    purchases: { total: bought.total, afterTrial: bought.afterTrial },
    cash: money,
  };
}

/** Letture nella finestra, ritardo dei negozi che leggono, merchant operativi e capacità. */
async function operations(db: D1Database, from: string, to: string) {
  const at = Date.parse(to);
  const [reads, stores, spaces, quota, volume] = await db.batch<
    Record<string, number | string | null>
  >([
    // Giorni di calendario della finestra fino a oggi compreso, come il resto del pannello.
    db
      .prepare(`SELECT COALESCE(SUM(attempts), 0) AS attempts,
          COALESCE(SUM(failures), 0) AS failures, COUNT(*) AS days
        FROM sync_daily WHERE day > date(?1) AND day <= date(?2)`)
      .bind(from, to),
    db
      .prepare(`SELECT t.last_success_at AS lastSuccess FROM ebay_stores s
        JOIN ebay_store_credentials c ON c.store_id = s.id
        LEFT JOIN sync_state t ON t.store_id = s.id WHERE ${readingStoreSql}`)
      .bind(to),
    db
      .prepare(`SELECT COUNT(DISTINCT s.workspace_id) AS operative,
          (SELECT COUNT(*) FROM workspaces w
            WHERE julianday(w.active_at) > julianday(?1) - ?2) AS active
        FROM ebay_stores s JOIN ebay_store_credentials c ON c.store_id = s.id
        JOIN sync_state t ON t.store_id = s.id
        WHERE ${readingStoreSql} AND julianday(t.last_success_at) > julianday(?1) - ?2`)
      .bind(to, operativeDays),
    // Cicli Free in corso degli spazi senza una copertura.
    db
      .prepare(`SELECT COUNT(*) AS cycles, COALESCE(SUM(used), 0) AS used,
          COALESCE(SUM(quota), 0) AS quota, COALESCE(SUM(used = quota), 0) AS exhausted
        FROM free_cycles f WHERE julianday(f.starts_at) <= julianday(?1)
          AND julianday(f.ends_at) > julianday(?1)
          AND NOT ${activeEntitlementSql("f.workspace_id", "?1")}`)
      .bind(to),
    db.prepare(`SELECT (SELECT COUNT(*) FROM workspace_funnel_steps) AS steps,
        (SELECT COUNT(*) FROM sync_daily) AS days, (SELECT COUNT(*) FROM sync_runs) AS runs`),
  ]);
  const read = reads!.results[0] as { attempts: number; failures: number; days: number };
  const lags = (stores!.results as { lastSuccess: string | null }[]).map((row) =>
    row.lastSuccess === null ? null : Math.max(0, (at - Date.parse(row.lastSuccess)) / 60_000),
  );
  const measured = lags.filter((lag) => lag !== null);
  const active = spaces!.results[0] as { operative: number; active: number };
  const cycles = quota!.results[0] as {
    cycles: number;
    used: number;
    quota: number;
    exhausted: number;
  };
  const kept = volume!.results[0] as { steps: number; days: number; runs: number };
  return {
    reads: {
      attempts: read.attempts,
      failures: read.failures,
      errorRate: share(read.failures, read.attempts),
      /** Giorni con almeno una lettura, denominatore della media giornaliera. */
      days: read.days,
    },
    lag: {
      targetMinutes: lagTargetMinutes,
      stores: lags.length,
      neverRead: lags.length - measured.length,
      medianMinutes: median(measured),
      maxMinutes: measured.length ? Math.max(...measured) : null,
      late: measured.filter((lag) => lag > lagTargetMinutes).length,
    },
    spaces: active,
    freeQuota: cycles,
    volume: kept,
  };
}

/**
 * KPI della finestra che termina adesso. La coorte del funnel è quella registrata nella
 * finestra; abbonamenti, prove aperte, ritardo e capacità valgono all'istante della lettura.
 */
export async function productMetrics(env: Env, days: MetricWindow, now = new Date()) {
  const to = now.toISOString();
  const from = new Date(now.getTime() - days * dayMilliseconds).toISOString();
  // La dimensione del database arriva con i metadati di qualsiasi lettura.
  const [cohort, money, ops, size] = await Promise.all([
    funnel(env.DB, from, to),
    commerce(env, from, to),
    operations(env.DB, from, to),
    env.DB.prepare("SELECT 1").run(),
  ]);
  return {
    window: { days, from, to, options: metricWindows },
    funnel: cohort,
    commerce: money,
    ...ops,
    capacity: {
      databaseBytes: size.meta.size_after ?? null,
      databaseBudget: databaseBudgetBytes,
      readingStores: ops.lag.stores,
      referenceStores,
    },
  };
}

export type ProductMetrics = Awaited<ReturnType<typeof productMetrics>>;
