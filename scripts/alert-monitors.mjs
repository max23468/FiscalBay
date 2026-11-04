#!/usr/bin/env node
/**
 * Monitor degli avvisi (OBSERVABILITY.md, incidenti): query della SQL API che Cloudflare valuta
 * fuori dal Worker, con l'avviso per email all'owner. Coprono ciò che il compito
 * `owner_incidents` non può segnalare: cron fermo, eccezioni, coda dei falliti, spazio D1 ed
 * email non consegnate. Sono policy `custom_analytics` dell'account, riconosciute dal nome:
 * `apply` crea quelle mancanti e riscrive le altre; il readback le confronta con le previste.
 * Il monitor delle email è comune ai due ambienti.
 *
 * L'account ammette cinque policy `custom_analytics`, quante ne servono a un ambiente: restano
 * quelle della Production. `--mode test` serve a provarle sul test e prende il loro posto, così
 * come `apply` della Production toglie quelle del test.
 *
 * Ogni query si valuta una volta per periodo e conta gli eventi dell'intero periodo, che il
 * provider le assegna pari all'intervallo di esecuzione. Con valutazioni al minuto e la media sul
 * periodo, un monitor appena creato non vede i dati precedenti e scatta sul primo minuto vuoto.
 *
 * Uso: node scripts/alert-monitors.mjs <plan|apply|readback> [--mode live]
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { databases } from "../cloudflare.config.ts";
import * as provider from "./lib/provider.mjs";
import { workerOf } from "./lib/worker.mjs";
import { alertEmail } from "./zone-protection.mjs";

/** Spazio D1 oltre il quale si apre il punto di arresto della tabella delle quote. */
export const d1StopBytes = 8_000_000_000;

/** Worker, account, code dei falliti e database dell'ambiente, da `cloudflare.config.ts`. */
export function targetOf(mode) {
  const worker = workerOf(mode);
  return {
    worker: worker.name,
    account: worker.env.CLOUDFLARE_ACCOUNT_ID.value,
    failedQueues: worker.triggers
      .filter((trigger) => trigger.type === "queue")
      .map(({ deadLetterQueue }) => deadLetterQueue),
    database: databases[mode === "live" ? "live" : "test"].id,
  };
}

const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;

/** Policy del monitor: soglia sulla media della query nel periodo. */
function monitor({ name, description, query, operator, value, window }) {
  return {
    name,
    description,
    enabled: true,
    alert_type: "custom_analytics",
    alert_interval: "1h",
    mechanisms: { email: [{ id: alertEmail }] },
    filters: {
      source: ["sql_api"],
      selectors: [query],
      alert_trigger_preferences: ["threshold"],
      alert_trigger_preferences_operator: [operator],
      alert_trigger_preferences_value: [String(value)],
      alert_trigger_preferences_short_window: [window],
      execution_interval: [window],
    },
  };
}

/**
 * Monitor previsti per l'ambiente. `queueIds` sono gli identificativi delle code dei falliti, che
 * la SQL API registra al posto del nome: un solo monitor le copre, nel limite di cinque policy.
 */
export function desiredMonitors(target, queueIds) {
  const account = quote(target.account);
  const outcome = `"attributes"['$workers.outcome']`;
  const events = `FROM logs.workersLogs WHERE accountTag = ${account} AND scriptName = ${quote(target.worker)} AND logType = 'cf-worker-event'`;
  return [
    monitor({
      name: `${target.worker} cron fermo`,
      description: `Nessuna esecuzione del cron del Worker ${target.worker} negli ultimi 30 minuti.`,
      query: `SELECT COUNT(*) AS value ${events} AND invocationType = 'scheduled'`,
      // Un cron ogni dieci minuti: in 30 minuti ne mancano almeno due prima dell'avviso.
      operator: "<",
      value: 1,
      window: "30m",
    }),
    monitor({
      name: `${target.worker} eccezioni`,
      description: `Almeno tre invocazioni del Worker ${target.worker} chiuse da un'eccezione o da un limite in 15 minuti.`,
      // Gli attributi JSON ammettono soltanto confronti diretti, non `NOT IN`.
      query: `SELECT COUNT(*) AS value ${events} AND ${outcome} != 'ok' AND ${outcome} != 'canceled'`,
      operator: ">=",
      value: 3,
      window: "15m",
    }),
    monitor({
      name: `${target.worker} coda dei falliti`,
      description: `Messaggi scritti nelle code ${target.failedQueues.join(" e ")} nell'ultima ora.`,
      query: `SELECT COUNT(*) AS value FROM events.queuesMessages WHERE accountTag = ${account} AND queueId IN (${queueIds.map(quote).join(", ")}) AND actionType = 'WriteMessage'`,
      operator: ">",
      value: 0,
      window: "1h",
    }),
    monitor({
      name: `${target.worker} spazio D1`,
      description: `Database dell'ambiente oltre 8 GB, il punto di arresto della tabella delle quote.`,
      query: `SELECT MAX(databaseSizeBytes) AS value FROM states.d1Storage WHERE accountTag = ${account} AND databaseId = ${quote(target.database)}`,
      operator: ">",
      value: d1StopBytes,
      // Lo spazio si campiona da un quarto d'ora a un'ora: una finestra più corta resta vuota.
      window: "1h",
    }),
    monitor({
      name: "fiscalbay email non consegnate",
      description:
        "Almeno tre invii da fiscalbay.it non consegnati in un'ora, esclusi i destinatari .invalid delle prove.",
      query: `SELECT COUNT(*) AS value FROM logs.emails WHERE accountTag = ${account} AND isEmailSending = 1 AND sendingDomain = 'fiscalbay.it' AND outcome = 'deliveryFailed' AND envelopeTo NOT LIKE '%.invalid'`,
      operator: ">=",
      value: 3,
      window: "1h",
    }),
  ];
}

/** Campi confrontati dal readback e riscritti da `apply`. */
const comparable = ({ name, description, enabled, alert_type, mechanisms, filters }) => ({
  name,
  description,
  enabled,
  alert_type,
  emails: (mechanisms?.email ?? []).map(({ id }) => id).sort(),
  filters: Object.fromEntries(
    Object.entries(filters ?? {})
      .filter(([key]) => !key.startsWith("alert_trigger_preferences_long"))
      .sort(([a], [b]) => a.localeCompare(b)),
  ),
});

/** Esito del confronto fra policy previste e lette: una voce per monitor. */
export function checkReadback(desired, policies) {
  const checks = desired.map((expected) => {
    const found = policies.filter((policy) => policy.name === expected.name);
    return [
      expected.name,
      found.length === 1 &&
        JSON.stringify(comparable(found[0])) === JSON.stringify(comparable(expected)),
    ];
  });
  return { ok: checks.every(([, ok]) => ok), checks: Object.fromEntries(checks) };
}

const withBodyFile = (body, run) => provider.withBodyFile(body, run, "alert-monitors");

function failedQueueIds(target) {
  const queues = provider.cfJson(["queues", "list"]);
  return target.failedQueues.map((name) => {
    const queue = queues.find(({ queue_name }) => queue_name === name);
    if (!queue) throw new Error(`Coda ${name} non trovata.`);
    return queue.queue_id;
  });
}

const readPolicies = () => provider.cfJson(["alerting", "policies", "list"]) ?? [];

function apply(desired, other) {
  // Prima si libera il posto occupato dai monitor dell'altro ambiente.
  const names = new Set(desired.map(({ name }) => name));
  const stale = readPolicies().filter(
    ({ name }) => name.startsWith(`${other} `) && !names.has(name),
  );
  for (const policy of stale)
    provider.cf(["alerting", "policies", "delete", policy.id, "--force", "-q"]);
  const existing = readPolicies();
  for (const policy of desired) {
    const current = existing.find(({ name }) => name === policy.name);
    withBodyFile(policy, (body) =>
      provider.cf(
        current
          ? ["alerting", "policies", "update", current.id, "--body", body, "-q"]
          : ["alerting", "policies", "create", "--body", body, "-q"],
      ),
    );
  }
}

const print = (value) => console.log(JSON.stringify(value, null, 2));

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { mode: { type: "string" } },
  });
  const [name] = positionals;
  const mode = provider.modeOf(values.mode, "test");
  const target = targetOf(mode);
  if (!["plan", "apply", "readback"].includes(name))
    throw new Error("Comandi: plan, apply, readback");
  if (name === "plan")
    return print(
      desiredMonitors(
        target,
        target.failedQueues.map((queue) => `<id di ${queue}>`),
      ),
    );
  const desired = desiredMonitors(target, failedQueueIds(target));
  if (name === "apply") apply(desired, targetOf(mode === "live" ? "test" : "live").worker);
  const result = checkReadback(desired, readPolicies());
  print(result);
  process.exitCode = result.ok ? 0 : 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]))
  await main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
