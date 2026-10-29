import { logFailure } from "../errors";
import { readApiQuotas, type ApiRate } from "../integrations/ebay/analytics.server";
import type { EbayNotification } from "../integrations/ebay/notifications.server";
import { ebayConfiguration, sandboxAvailable } from "../integrations/ebay/environment.server";
import type { EbayEnvironment } from "../view-models";
import { serviceSetting } from "./service-settings.server";

/**
 * Vista delle quote eBay della console (D177, D188). Per ambiente, API e chiamata mostra limite,
 * consumo, residuo e azzeramento, insieme alle chiamate che FiscalBay ha sospeso perché eBay ha
 * risposto con il limite superato. Oltre la soglia di attenzione della quota giornaliera, 70%
 * salvo diversa scelta nella console, la lettura apre un'anomalia, una sola per finestra
 * giornaliera e per quota, anche quando più chiamate la condividono, che si chiude quando una
 * lettura riuscita trova il consumo rientrato. Una lettura non riuscita non apre né chiude nulla.
 */

/** Consumo oltre il quale le letture sono a rischio nella stessa giornata. */
const quotaUrgentShare = 0.9;

/** Finestra giornaliera: eBay la indica anche con qualche secondo in meno. */
const daySeconds = 86_340;

/** Chiamate che FiscalBay usa per i negozi: nella vista precedono le altre. */
const expectedCalls = [
  { api: "Trading", call: "GetOrders" },
  { api: "Trading", call: "GetItem" },
  { api: "Trading", call: "GetStore" },
  { api: "Trading", call: "GetUser" },
  // Fulfillment legge soltanto gli ordini: le altre risorse dell'API non sono di FiscalBay.
  { api: "Fulfillment", call: "order" },
] as const;

export type QuotaRow = {
  api: string;
  /** Nome della chiamata come lo riporta eBay. */
  resource: string;
  /** Quota della finestra più lunga: quella giornaliera quando eBay la indica. */
  rate: ApiRate;
  share: number;
  daily: boolean;
  over: boolean;
  /** Chiamata usata da FiscalBay. */
  used: boolean;
};

export type QuotaSuspension = { call: string | null; until: string };

export type EnvironmentQuotas = {
  environment: EbayEnvironment;
  read: "ok" | "failed";
  rows: QuotaRow[];
  suspended: QuotaSuspension[];
};

export type QuotaAnomaly = {
  key: string;
  severity: "p1" | "p2";
  subject: string;
  share: number;
  openedAt: string;
  resolvedAt: string | null;
};

/** Ultima parte del nome: eBay può prefissare la chiamata con l'API. */
const callName = (resource: string) => resource.split(".").at(-1)!;

/** Posizione fra le chiamate di FiscalBay, prima le più usate; -1 per le altre. */
function callRank(api: string, resource: string) {
  return expectedCalls.findIndex(
    (expected) =>
      expected.api === api &&
      (api === "Fulfillment"
        ? callName(resource).toLowerCase().includes(expected.call)
        : expected.call === callName(resource)),
  );
}

/** Ambienti letti: la Sandbox soltanto dove è abilitata. */
function environments(env: Env): EbayEnvironment[] {
  return sandboxAvailable(env) ? ["production", "sandbox"] : ["production"];
}

/** Sospensioni in corso dell'ambiente, dall'origine API delle chiamate. */
async function suspensions(db: D1Database, env: Env, environment: EbayEnvironment, at: string) {
  const origin = ebayConfiguration(env, environment).apiOrigin;
  const { results } = await db
    .prepare(`SELECT api_origin, until FROM ebay_rate_limits
      WHERE until > ?1 AND (api_origin = ?2 OR api_origin LIKE ?2 || '#%') ORDER BY api_origin`)
    .bind(at, origin)
    .all<{ api_origin: string; until: string }>();
  return results.map((row) => ({
    call: row.api_origin.includes("#") ? row.api_origin.split("#")[1]! : null,
    until: row.until,
  }));
}

/** `alertShare`: consumo giornaliero oltre il quale si completa l’Application Growth Check. */
function quotaRow(
  api: string,
  resource: string,
  rates: ApiRate[],
  alertShare: number,
): QuotaRow | null {
  const rate = [...rates].sort((a, b) => b.windowSeconds - a.windowSeconds)[0];
  if (!rate) return null;
  const share = rate.limit > 0 ? rate.consumed / rate.limit : 0;
  const daily = rate.windowSeconds >= daySeconds;
  return {
    api,
    resource,
    rate,
    share,
    daily,
    over: daily && share > alertShare,
    used: callRank(api, resource) >= 0,
  };
}

const subjectOf = (environment: EbayEnvironment, row: Pick<QuotaRow, "api" | "resource">) =>
  `${environment}:${row.api}:${row.resource}`;

/**
 * Apre l'anomalia della finestra giornaliera per ogni quota oltre la soglia e chiude le altre
 * dell'ambiente: quelle rientrate e quelle di una finestra già azzerata. Il soggetto è la prima
 * chiamata di FiscalBay della quota, qualunque sia il numero delle chiamate che la condividono.
 * La chiave porta l'azzeramento indicato da eBay alla prima lettura, o il giorno UTC se manca:
 * finché quell'azzeramento non è passato la stessa quota resta la stessa anomalia, anche se eBay
 * sposta l'orario indicato.
 */
async function anomalyStatements(db: D1Database, quotas: EnvironmentQuotas, now: Date) {
  const at = now.toISOString();
  const { results: open } = await db
    .prepare(`SELECT key, subject, json_extract(detail, '$.resetAt') AS resetAt
      FROM admin_anomalies
      WHERE kind = 'ebay_quota' AND resolved_at IS NULL AND subject LIKE ?1 || ':%'`)
    .bind(quotas.environment)
    .all<{ key: string; subject: string; resetAt: string | null }>();
  // Le chiamate con lo stesso limite, residuo e azzeramento condividono la quota: una sola
  // anomalia per la quota, e soltanto se FiscalBay usa almeno una delle sue chiamate.
  const pools = new Map<string, QuotaRow[]>();
  for (const row of quotas.rows.filter((item) => item.over)) {
    const pool = `${row.api}|${row.rate.limit}|${row.rate.remaining}|${row.rate.resetAt}`;
    pools.set(pool, [...(pools.get(pool) ?? []), row]);
  }
  const over = [...pools.values()]
    .filter((rows) => rows.some((row) => row.used))
    .map((rows) => {
      // Le righe sono già nell'ordine di importanza delle chiamate di FiscalBay.
      const row = rows.find((item) => item.used)!;
      const subject = subjectOf(quotas.environment, row);
      const current = open.find(
        (anomaly) =>
          anomaly.subject === subject &&
          (anomaly.resetAt
            ? Date.parse(anomaly.resetAt) > now.getTime()
            : anomaly.key.endsWith(`:${at.slice(0, 10)}`)),
      );
      const key = current?.key ?? `ebay_quota:${subject}:${row.rate.resetAt ?? at.slice(0, 10)}`;
      return { row, subject, key };
    });
  return [
    db
      .prepare(`UPDATE admin_anomalies SET resolved_at = ?1
        WHERE kind = 'ebay_quota' AND resolved_at IS NULL AND subject LIKE ?2 || ':%'
          AND key NOT IN (SELECT value FROM json_each(?3))`)
      .bind(at, quotas.environment, JSON.stringify(over.map(({ key }) => key))),
    ...over.map(({ row, subject, key }) =>
      db
        .prepare(`INSERT INTO admin_anomalies (key, kind, severity, subject, detail, opened_at,
            seen_at)
          VALUES (?1, 'ebay_quota', ?2, ?3, ?4, ?5, ?5)
          ON CONFLICT(key) DO UPDATE SET severity = excluded.severity, detail = excluded.detail,
            seen_at = excluded.seen_at, resolved_at = NULL`)
        .bind(
          key,
          row.share > quotaUrgentShare ? "p1" : "p2",
          subject,
          JSON.stringify({
            share: row.share,
            limit: row.rate.limit,
            used: row.rate.consumed,
            resetAt: row.rate.resetAt,
          }),
          at,
        ),
    ),
  ];
}

/** Legge le quote di ogni ambiente e aggiorna le anomalie; la lettura non chiama eBay per i negozi. */
export async function readEbayQuotas(
  env: Env,
  fetcher: typeof fetch = fetch,
  now = new Date(),
): Promise<EnvironmentQuotas[]> {
  const at = now.toISOString();
  const alertShare = (await serviceSetting(env.DB, "quota_attention")) / 100;
  return Promise.all(
    environments(env).map(async (environment): Promise<EnvironmentQuotas> => {
      const suspended = await suspensions(env.DB, env, environment, at);
      let quotas: EnvironmentQuotas;
      try {
        const rows = (await readApiQuotas(env, environment, fetcher)).flatMap(
          (quota) => quotaRow(quota.api, quota.resource, quota.rates, alertShare) ?? [],
        );
        quotas = {
          environment,
          read: "ok",
          // Le chiamate di FiscalBay nell'ordine di importanza, poi le altre per consumo.
          rows: rows.sort((a, b) => {
            const [first, second] = [callRank(a.api, a.resource), callRank(b.api, b.resource)];
            if (first >= 0 || second >= 0)
              return (first < 0 ? Infinity : first) - (second < 0 ? Infinity : second);
            return b.share - a.share;
          }),
          suspended,
        };
      } catch (error) {
        logFailure({ error, operation: "admin" });
        return { environment, read: "failed", rows: [], suspended };
      }
      await env.DB.batch(await anomalyStatements(env.DB, quotas, now));
      return quotas;
    }),
  );
}

/** Anomalie delle quote aperte, e quelle chiuse negli ultimi sette giorni. */
export async function quotaAnomalies(db: D1Database, now = new Date()): Promise<QuotaAnomaly[]> {
  const { results } = await db
    .prepare(`SELECT key, severity, subject, json_extract(detail, '$.share') AS share,
        opened_at AS openedAt, resolved_at AS resolvedAt FROM admin_anomalies
      WHERE kind = 'ebay_quota' AND (resolved_at IS NULL
        OR julianday(resolved_at) > julianday(?1) - 7)
      ORDER BY resolved_at IS NOT NULL, severity, opened_at DESC, subject`)
    .bind(now.toISOString())
    .all<QuotaAnomaly>();
  return results;
}

type BulkDataThreshold = Extract<
  EbayNotification,
  { topic: "BULK_DATA_TRANSFER_THRESHOLD" }
>["notification"]["data"];

/**
 * Soglia della Bulk Data Transfer Policy notificata da eBay: un'anomalia per ambiente, regione,
 * categoria di dati e finestra di aggregazione, grave a soglia raggiunta. eBay non notifica il
 * rientro: l'anomalia si chiude da sé alla fine della finestra. Una consegna ripetuta aggiorna la
 * stessa anomalia; una consegna ritentata fuori ordine non abbassa gravità e conteggio, che nella
 * finestra possono soltanto crescere.
 */
export async function recordBulkDataThreshold(
  db: D1Database,
  environment: EbayEnvironment,
  data: BulkDataThreshold,
  now = new Date(),
) {
  // Un batch D1 vuoto non si conclude: una soglia senza metriche non ha nulla da registrare.
  if (!data.metricData.length) return;
  const windowStart = new Date(data.window.aggregationWindowStart).toISOString();
  const windowEnd = new Date(data.window.aggregationWindowEnd).toISOString();
  await db.batch(
    data.metricData.map((metric) => {
      const subject = `${environment}:${data.region}:${metric.metricDataType}`;
      return db
        .prepare(`INSERT INTO admin_anomalies (key, kind, severity, subject, detail, opened_at,
            seen_at, resolved_at)
          VALUES (?1, 'ebay_bulk_data', ?2, ?3, ?4, ?5, ?5, ?6)
          ON CONFLICT(key) DO UPDATE SET severity = min(severity, excluded.severity),
            detail = CASE WHEN json_extract(excluded.detail, '$.count')
              >= json_extract(detail, '$.count') THEN excluded.detail ELSE detail END,
            seen_at = excluded.seen_at`)
        .bind(
          `ebay_bulk_data:${subject}:${windowStart}`,
          metric.thresholdStatus === "REACHED" ? "p1" : "p2",
          subject,
          JSON.stringify({
            status: metric.thresholdStatus,
            share: metric.thresholdPercentage / 100,
            limit: metric.thresholdLimit,
            count: metric.currentCount,
            policy: [data.policyFramework, data.policyVersion].filter(Boolean).join(" "),
            windowEnd,
          }),
          now.toISOString(),
          windowEnd,
        );
    }),
  );
}

export type BulkDataAnomaly = {
  key: string;
  severity: "p1" | "p2";
  subject: string;
  share: number;
  openedAt: string;
  /** Fine della finestra di aggregazione, quando l'anomalia si chiude. */
  until: string;
};

/** Soglie Bulk Data Transfer con la finestra di aggregazione ancora aperta. */
export async function bulkDataAnomalies(
  db: D1Database,
  now = new Date(),
): Promise<BulkDataAnomaly[]> {
  const { results } = await db
    .prepare(`SELECT key, severity, subject, json_extract(detail, '$.share') AS share,
        opened_at AS openedAt, resolved_at AS until FROM admin_anomalies
      WHERE kind = 'ebay_bulk_data' AND resolved_at > ?1 ORDER BY severity, opened_at DESC`)
    .bind(now.toISOString())
    .all<BulkDataAnomaly>();
  return results;
}
