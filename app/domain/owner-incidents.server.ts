import { originUrl } from "../app-links";
import { adminCopy } from "../copy/admin-copy";
import { ownerTelegramCopy as copy } from "../copy/owner-telegram";
import { logFailure } from "../errors";
import { inSequence } from "../sequence";
import { UpstreamError } from "../integrations/http.server";
import {
  ownerChatId,
  sendRichMessage,
  telegramConfigured,
  type BotButton,
} from "../integrations/telegram.server";
import { listAnomalies, type Anomaly, type AnomalyKind } from "./admin-operations.server";
import {
  at,
  duration,
  ownerCallback,
  richMessage,
  type Panel,
  type Row,
} from "./owner-panels.server";

/**
 * Incidenti dell'owner (§15, §31): le anomalie della console di gravità P1 e P2 diventano avvisi
 * sul bot dell'ambiente, uno all'apertura, uno all'aggravamento da P2 a P1 e uno al rientro. La
 * tabella `owner_incidents` conserva l'ultimo stato comunicato: il controllo ripetuto, un nuovo
 * tentativo o un'anomalia che rientra e si riapre fra due controlli non ripetono l'avviso. Le P3
 * restano nella console e in `/incidenti`. L'interruttore degli invii Telegram riguarda i
 * venditori: gli avvisi dell'owner partono comunque.
 */

/** Oggetti elencati in un avviso; gli altri si contano. */
const subjectsShown = 5;
/** Avvisi per controllo: il resto parte al controllo successivo. */
const perRun = 10;
const minute = 60_000;

type Detail = { count: number; total: number; subjects: string[]; href: string };

type IncidentRow = {
  key: string;
  kind: AnomalyKind;
  severity: "p1" | "p2";
  detail: string;
  opened_at: string;
  resolved_at: string | null;
  notified: "none" | "opened" | "resolved";
  notified_severity: "p1" | "p2" | null;
  attempts: number;
};

const t = adminCopy.it;

/** Nome leggibile dell'oggetto di un'anomalia: lavori, provider e interruttori hanno il loro. */
function subjectLabel(kind: AnomalyKind, label: string) {
  if (kind === "task_stalled") return t.labels.tasks[label as keyof typeof t.labels.tasks] ?? label;
  if (kind === "receipts_stalled")
    return t.labels.providers[label as keyof typeof t.labels.providers] ?? label;
  if (kind === "service_off")
    return t.switches.names[label as keyof typeof t.switches.names] ?? label;
  if (kind === "ebay_down")
    return t.quotas.environment[label as keyof typeof t.quotas.environment] ?? label;
  return label;
}

/** Oggetti di un'anomalia in una riga, con il conteggio di quelli non elencati. */
export function subjectsLine(kind: AnomalyKind, labels: string[], total = labels.length) {
  const shown = labels.slice(0, subjectsShown).map((label) => subjectLabel(kind, label));
  const rest = total - shown.length;
  return rest > 0 ? `${shown.join(", ")} ${copy.more(rest)}` : shown.join(", ");
}

/** Istante normalizzato: le anomalie portano istanti scritti da tabelle diverse. */
function instant(value: string, fallback: string) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : fallback;
}

/**
 * Allinea gli incidenti alle anomalie aperte e invia gli avvisi dovuti. Un incidente che si
 * riapre dopo il rientro comunicato è una nuova apertura; uno che si riapre prima conserva
 * l'apertura comunicata, e il rientro non comunicato non parte.
 */
export async function reconcileOwnerIncidents(env: Env, fetcher: typeof fetch, now = new Date()) {
  const db = env.DB;
  const time = now.toISOString();
  const open = (await listAnomalies(db, now)).filter(
    (anomaly): anomaly is Anomaly & { severity: "p1" | "p2" } => anomaly.severity !== "p3",
  );
  await db.batch([
    ...open.map((anomaly) =>
      db
        .prepare(`INSERT INTO owner_incidents (key, kind, severity, detail, opened_at)
          VALUES (?1, ?2, ?3, ?4, ?5)
          ON CONFLICT(key) DO UPDATE SET kind = excluded.kind, severity = excluded.severity,
            detail = excluded.detail,
            opened_at = CASE WHEN owner_incidents.resolved_at IS NOT NULL
              AND owner_incidents.notified <> 'opened' THEN excluded.opened_at
              ELSE owner_incidents.opened_at END,
            attempts = CASE WHEN owner_incidents.resolved_at IS NULL
              THEN owner_incidents.attempts ELSE 0 END,
            retry_at = CASE WHEN owner_incidents.resolved_at IS NULL
              THEN owner_incidents.retry_at END,
            resolved_at = NULL`)
        .bind(
          anomaly.key,
          anomaly.kind,
          anomaly.severity,
          JSON.stringify({
            count: anomaly.count,
            total: anomaly.subjects.length,
            subjects: anomaly.subjects.slice(0, subjectsShown).map((subject) => subject.label),
            href: anomaly.subjects[0]?.href ?? "",
          } satisfies Detail),
          instant(anomaly.since, time),
        ),
    ),
    db
      .prepare(`UPDATE owner_incidents SET resolved_at = ?1, attempts = 0, retry_at = NULL
        WHERE resolved_at IS NULL AND key NOT IN (SELECT value FROM json_each(?2))`)
      .bind(time, JSON.stringify(open.map((anomaly) => anomaly.key))),
    // Il rientro di un incidente mai comunicato non ha nulla da dire.
    db.prepare(`UPDATE owner_incidents SET notified = 'resolved', attempts = 0, retry_at = NULL
      WHERE resolved_at IS NOT NULL AND notified = 'none'`),
  ]);
  if (telegramConfigured(env) && ownerChatId(env)) await deliverOwnerIncidents(env, fetcher, now);
}

/** Avviso dovuto per l'incidente: apertura, aggravamento o rientro. */
function pendingState(row: IncidentRow) {
  if (row.resolved_at) return "resolved" as const;
  return row.notified === "opened" ? ("escalated" as const) : ("opened" as const);
}

export function incidentPanel(env: Env, row: IncidentRow): Panel {
  const kind = t.overview.kinds[row.kind];
  const detail = JSON.parse(row.detail) as Detail;
  const state = pendingState(row);
  const incidents: BotButton[] = [
    // L'elenco apre un nuovo messaggio: l'avviso resta leggibile nella chat.
    { text: copy.views.incidenti, callback_data: ownerCallback("incidenti", 0, "n") },
  ];
  if (state === "resolved")
    return {
      title: `${copy.resolvedIcon} ${copy.incident.resolved} · ${kind.title}`,
      sections: [
        {
          title: copy.incident.resolved,
          rows: [
            [copy.openedAt, at(row.opened_at)],
            [copy.resolvedAt, at(row.resolved_at)],
            [copy.duration, duration(row.opened_at, row.resolved_at!)],
          ],
        },
      ],
      buttons: [incidents],
    };
  return {
    title: `${copy.severityIcon[row.severity]} ${copy.incident[state]} · ${kind.title}`,
    lead: kind.consequence,
    sections: [
      {
        title: t.severity[row.severity],
        rows: [
          [copy.openedAt, at(row.opened_at)],
          [copy.subjects, subjectsLine(row.kind, detail.subjects, detail.total)],
          ...(detail.count > 1 ? [[copy.occurrences, String(detail.count)] as Row] : []),
          [copy.action, kind.action],
        ],
      },
    ],
    buttons: [
      [{ text: copy.openConsole, url: originUrl(env, `/admin/${detail.href}`) }],
      incidents,
    ],
  };
}

async function deliverOwnerIncidents(env: Env, fetcher: typeof fetch, now: Date) {
  const db = env.DB;
  const chatId = ownerChatId(env)!;
  const { results } = await db
    .prepare(`SELECT key, kind, severity, detail, opened_at, resolved_at, notified,
        notified_severity, attempts FROM owner_incidents
      WHERE (retry_at IS NULL OR retry_at <= ?1)
        AND ((resolved_at IS NULL AND (notified <> 'opened'
            OR (severity = 'p1' AND notified_severity = 'p2')))
          OR (resolved_at IS NOT NULL AND notified = 'opened'))
      ORDER BY resolved_at IS NOT NULL, severity, opened_at LIMIT ?2`)
    .bind(now.toISOString(), perRun)
    .all<IncidentRow>();
  // Un avviso alla volta, nell'ordine: il primo invio fallito ferma gli altri fino al controllo
  // successivo, perché probabilmente fallirebbero allo stesso modo.
  await inSequence(results, async (row) => {
    const resolved = row.resolved_at !== null;
    try {
      await sendRichMessage(env, chatId, richMessage(env, incidentPanel(env, row), now), fetcher);
    } catch (error) {
      // Attese crescenti fino a sei ore, o quella indicata da Telegram.
      const wait =
        error instanceof UpstreamError && error.details.retryAfter !== undefined
          ? error.details.retryAfter * 1000
          : Math.min(360, 10 * 2 ** row.attempts) * minute;
      await db
        .prepare(`UPDATE owner_incidents SET attempts = attempts + 1, retry_at = ?2
          WHERE key = ?1`)
        .bind(row.key, new Date(now.getTime() + wait).toISOString())
        .run();
      logFailure({ error, operation: "owner_incidents" });
      throw new DeliveryPaused();
    }
    // Lo stato comunicato si registra soltanto se l'incidente non è cambiato nel frattempo.
    await db
      .prepare(`UPDATE owner_incidents SET notified = ?2, notified_severity = ?3, attempts = 0,
          retry_at = NULL WHERE key = ?1 AND (resolved_at IS NOT NULL) = ?4`)
      .bind(row.key, resolved ? "resolved" : "opened", row.severity, resolved ? 1 : 0)
      .run();
  }).catch((error: unknown) => {
    if (!(error instanceof DeliveryPaused)) throw error;
  });
}

/** Invio fallito: gli avvisi rimasti aspettano il controllo successivo. */
class DeliveryPaused extends Error {}

export type RecentIncident = {
  key: string;
  kind: AnomalyKind;
  severity: "p1" | "p2";
  openedAt: string;
  resolvedAt: string;
};

/** Incidenti rientrati negli ultimi sette giorni, dal più recente. */
export async function recentIncidents(db: D1Database, now = new Date()) {
  const { results } = await db
    .prepare(`SELECT key, kind, severity, opened_at AS openedAt, resolved_at AS resolvedAt
      FROM owner_incidents WHERE resolved_at IS NOT NULL
        AND julianday(resolved_at) > julianday(?) - 7
      ORDER BY resolved_at DESC LIMIT 20`)
    .bind(now.toISOString())
    .all<RecentIncident>();
  return results;
}
