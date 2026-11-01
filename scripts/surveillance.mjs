#!/usr/bin/env node
/**
 * Rilettura della sorveglianza iniziale (§31, §41), in sola lettura: registrazioni, letture dei
 * negozi, Stripe, code, quote, errori e supporto di un ambiente in una finestra di ore.
 *
 * Le soglie P1 e P2 restano quelle della console: lo script legge gli incidenti che il compito
 * `owner_incidents` ha già valutato e verifica che quel compito stia girando, perché un cron fermo
 * non avvisa nessuno. Aggiunge soltanto ciò che la console non vede: errori delle invocazioni,
 * messaggi nelle code e quote dell'account condiviso.
 *
 * Il resoconto riporta conteggi ed esiti, mai email, importi o identificativi. Esce con 1 se una
 * voce va guardata o non si legge; le voci dell'owner non cambiano l'esito.
 *
 * Uso: node scripts/surveillance.mjs [--mode live] [--hours 24]
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { taskPeriods } from "../app/domain/work-timing.ts";
import { maxWindowHours, metricSql } from "../app/metrics-queries.ts";
import { readAccount } from "./capacity.mjs";
import { report, targetOf } from "./go-live.mjs";
import { cfJson, d1Query } from "./lib/provider.mjs";
import { literal } from "./recovery.mjs";

/** Soglia di attenzione delle quote mensili incluse (§31). */
export const quotaWarning = 0.8;

/** Soglia prudenziale del singolo database (§31). */
export const databaseWarningBytes = 8 * 10 ** 9;

/**
 * Messaggi in coda oltre un turno del cron: ogni turno accoda al massimo 300 letture, a gruppi da
 * dieci. L'API non riporta l'età del messaggio più vecchio, quindi l'arretrato si misura così.
 */
export const backlogWarning = 30;

/** Fatti commerciali contati nella finestra, da `owner_notifications`. */
const accountEvents = ["registered", "admitted", "store_linked", "account_deleted"];
const commerceEvents = [
  "trial_started",
  "trial_ended",
  "purchase",
  "cancel_scheduled",
  "renewal_unpaid",
  "subscription_closed",
  "refund",
  "dispute_opened",
  "dispute_lost",
  "financial_erasure",
];

/** Istruzioni D1 sulla finestra: conteggi senza dati personali. */
export function statements(since, now) {
  const from = literal(since.toISOString());
  const at = literal(now.toISOString());
  return [
    `SELECT kind, severity, opened_at FROM owner_incidents WHERE resolved_at IS NULL
      ORDER BY severity, opened_at`,
    `SELECT slot, done_at, queued_at, locked_until FROM scheduled_tasks WHERE task = 'owner_incidents'`,
    `SELECT COUNT(*) AS accounts, COALESCE(SUM("emailVerified"), 0) AS verified FROM "user"
      WHERE julianday("createdAt") >= julianday(${from})`,
    `SELECT kind, status, COUNT(*) AS count FROM owner_notifications
      WHERE julianday(occurred_at) >= julianday(${from}) GROUP BY kind, status`,
    `SELECT step, COUNT(*) AS count FROM workspace_funnel_steps
      WHERE julianday(occurred_at) >= julianday(${from}) GROUP BY step`,
    `SELECT COALESCE(SUM(attempts), 0) AS attempts, COALESCE(SUM(failures), 0) AS failures
      FROM sync_daily WHERE day >= date(${from})`,
    `SELECT provider, COUNT(*) AS pending FROM webhook_receipts
      WHERE completed_at IS NULL AND expires_at > ${at} GROUP BY provider`,
    `SELECT COUNT(*) AS requests FROM support_requests
      WHERE julianday(sent_at) >= julianday(${from})`,
  ];
}

/** Conteggi dei fatti elencati, sommati fra gli stati di consegna. */
function counts(events, kinds) {
  const total = (kind) => events.reduce((sum, row) => sum + (row.kind === kind ? row.count : 0), 0);
  return kinds
    .filter((kind) => total(kind) > 0)
    .map((kind) => `${kind} ${total(kind)}`)
    .join(", ");
}

/** Voci dalle righe D1: incidenti, compito che li valuta, registrazioni, letture, Stripe, supporto. */
export function checkData(rows, now) {
  const [incidents, [task], [accounts], events, steps, [sync], receipts, [support]] = rows;
  const lastSlot = Date.parse(task?.slot ?? "");
  const pending = (provider) => receipts.find((row) => row.provider === provider)?.pending ?? 0;
  const undelivered = events
    .filter(({ status }) => status === "failed")
    .reduce((total, { count }) => total + count, 0);
  const sold = events.some(({ kind }) => kind === "purchase");
  return [
    {
      area: "Incidenti",
      item: "nessun incidente P1 o P2 aperto",
      ok: incidents.length === 0,
      detail: incidents.length
        ? incidents.map(({ severity, kind }) => `${severity} ${kind}`).join(", ")
        : undefined,
    },
    {
      area: "Incidenti",
      item: "valutazione degli incidenti in corso",
      ok:
        Number.isFinite(lastSlot) &&
        lastSlot + 2 * taskPeriods.owner_incidents >= now.getTime() &&
        (Boolean(task?.done_at) ||
          Date.parse(task?.locked_until ?? "") > now.getTime() ||
          Date.parse(task?.queued_at ?? "") + taskPeriods.owner_incidents >= now.getTime()),
    },
    {
      area: "Registrazioni",
      item: "account creati",
      ok: true,
      detail: `${accounts.accounts}, verificati ${accounts.verified}`,
    },
    {
      area: "Registrazioni",
      item: "fatti degli account",
      ok: true,
      detail: counts(events, accountEvents) || "nessuno",
    },
    {
      area: "Letture",
      item: "letture dei negozi",
      ok: true,
      detail: `${sync.attempts} tentativi, ${sync.failures} falliti`,
    },
    {
      area: "Letture",
      item: "avanzamento degli spazi",
      ok: true,
      detail:
        steps.map(({ step, count }) => `${step} ${count}`).join(", ") ||
        "nessun passaggio nella finestra",
    },
    {
      area: "Stripe",
      item: "eventi ed esiti commerciali",
      ok: true,
      detail: counts(events, commerceEvents) || "nessuno",
    },
    {
      area: "Stripe",
      item: "ricevute in attesa",
      ok: true,
      detail: ["stripe", "ebay", "telegram"]
        .map((provider) => `${provider} ${pending(provider)}`)
        .join(", "),
    },
    { area: "Alert", item: "avvisi commerciali consegnati", ok: undelivered === 0 },
    {
      area: "Supporto",
      item: "richieste dal modulo, che restano 24 ore",
      ok: true,
      detail: String(support.requests),
    },
    ...(sold
      ? [
          {
            area: "Stripe",
            item: "vendite reali: commercial.mjs verify --since <go-live>",
            ok: null,
          },
        ]
      : []),
  ];
}

/**
 * Voci delle invocazioni dalla query `invocations`: i conteggi sono stime pesate. Le risposte 5xx
 * e le invocazioni fallite di coda e cron si guardano sempre nei primi giorni; un messaggio
 * rimesso in coda è il ritardo ordinario di un provider e si riporta soltanto.
 */
export function checkInvocations(rows) {
  const total = (filter) =>
    Math.round(rows.filter(filter).reduce((sum, { count }) => sum + Number(count), 0));
  const http = total(({ invocation }) => invocation === "http");
  const server = total(({ invocation, outcome }) => invocation === "http" && outcome === "5xx");
  const failed = total(({ outcome }) => outcome === "error");
  const retried = total(({ outcome }) => outcome === "retry");
  return [
    {
      area: "Errori",
      item: "risposte 5xx",
      ok: server === 0,
      detail: `${server} su circa ${http} richieste`,
    },
    {
      area: "Errori",
      item: "invocazioni di coda e cron fallite",
      ok: failed === 0,
      detail: `${failed}, messaggi rimessi in coda ${retried}`,
    },
  ];
}

/** Voci delle code: arretrato oltre un turno e messaggi nella coda dei falliti. */
export function checkQueues(target, metrics) {
  return [
    {
      area: "Code",
      item: `arretrato di ${target.queue.name}`,
      ok: metrics.work?.backlog_count <= backlogWarning,
      detail: String(metrics.work?.backlog_count ?? "?"),
    },
    {
      area: "Code",
      item: `coda ${target.queue.deadLetterQueue} vuota`,
      ok: metrics.failed?.backlog_count === 0,
      detail: String(metrics.failed?.backlog_count ?? "?"),
    },
  ];
}

/** Voci delle quote dell'account condiviso, sugli ultimi 30 giorni, e del database dell'ambiente. */
export function checkQuotas(usage, database) {
  const names = {
    requests: "richieste",
    cpuMs: "CPU",
    d1RowsRead: "righe D1 lette",
    d1RowsWritten: "righe D1 scritte",
    queueOperations: "operazioni della coda",
  };
  const shares = Object.entries(names).map(([key, name]) => [
    name,
    usage.totals[key].value / usage.totals[key].quota,
  ]);
  const high = shares.filter(([, share]) => share >= quotaWarning);
  const [name, share] = shares.toSorted((a, b) => b[1] - a[1])[0];
  return [
    {
      area: "Quote",
      item: `quote dell'account sotto ${quotaWarning * 100}%`,
      ok: high.length === 0,
      detail: `la più alta: ${name} ${(share * 100).toFixed(1)}%`,
    },
    {
      area: "Quote",
      item: "database dell'ambiente sotto 8 GB",
      ok: Number(database?.file_size) < databaseWarningBytes,
      detail: `${(Number(database?.file_size) / 10 ** 6).toFixed(1)} MB`,
    },
  ];
}

/** Prove che nessuna lettura sostituisce. */
export const ownerItems = [
  { area: "Supporto", item: "casella supporto@ e richieste con un termine di Stripe e Link" },
];

/** Esegue una lettura di area: se non riesce la voce risulta non letta, le altre proseguono. */
export async function area(name, item, read) {
  try {
    return await read();
  } catch (error) {
    return [{ area: name, item, ok: false, detail: `non letto: ${error.message.split("\n")[0]}` }];
  }
}

function readQueues(target) {
  const queues = cfJson(["queues", "list"]);
  const metrics = (name) => {
    const queue = queues.find(({ queue_name: found }) => found === name);
    if (!queue) throw new Error(`coda ${name} assente`);
    return cfJson(["queues", "metrics", "get", queue.queue_id]);
  };
  return { work: metrics(target.queue.name), failed: metrics(target.queue.deadLetterQueue) };
}

async function main() {
  const { values } = parseArgs({
    options: {
      mode: { type: "string", default: "test" },
      hours: { type: "string", default: "24" },
    },
  });
  if (!["test", "live"].includes(values.mode)) throw new Error("--mode accetta test o live.");
  const hours = Number(values.hours);
  if (!Number.isInteger(hours) || hours < 1 || hours > maxWindowHours)
    throw new Error(`--hours fra 1 e ${maxWindowHours}`);
  const target = targetOf(values.mode);
  const now = new Date();
  const since = new Date(now.getTime() - hours * 3_600_000);
  const dataset = target.metrics;
  const results = [
    ...(await area("Incidenti", "dati dell'ambiente", async () =>
      checkData(await d1Query(target.database.id, statements(since, now)), now),
    )),
    ...(await area("Errori", "invocazioni", () =>
      checkInvocations(
        cfJson([
          "analytics-engine",
          "sql",
          "query",
          "--body",
          metricSql("invocations", dataset, hours),
        ]).data,
      ),
    )),
    ...(await area("Code", "code dell'ambiente", () => checkQueues(target, readQueues(target)))),
    ...(await area("Quote", "consumo dell'account", async () =>
      checkQuotas(await readAccount(30), cfJson(["d1", "get", target.database.id])),
    )),
    ...ownerItems.map((entry) => ({ ...entry, ok: null })),
  ];
  console.log(`Sorveglianza · ${target.environment} · ultime ${hours} ore`);
  console.log(report(results));
  const failed = results.filter(({ ok }) => ok === false).length;
  console.log(`\nVoci da guardare: ${failed}.`);
  if (failed) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]))
  await main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
