#!/usr/bin/env node
/**
 * Archivio dei log a 90 giorni (§31, D166). Workers Logpush esporta gli eventi di invocazione
 * del Worker dell'ambiente in un bucket R2 UE dedicato, tramite la destinazione S3-compatible
 * sull'endpoint UE, perché quella R2 diretta non supporta la giurisdizione. Lo script descrive
 * bucket, lifecycle e job, li applica e li rilegge, verifica il contenuto degli oggetti esportati
 * e interroga l'archivio con le query di diagnosi del runbook.
 *
 * Le chiamate passano dal profilo della CLI `cf`. Le credenziali S3 limitate al bucket arrivano
 * da `LOG_ARCHIVE_ACCESS_KEY_ID` e `LOG_ARCHIVE_SECRET_ACCESS_KEY` o dal Portachiavi, entrano nel
 * job da un file temporaneo e non compaiono mai negli argomenti o nell'output.
 *
 * Uso: node scripts/log-archive.mjs <plan|apply|readback|verify> [--mode live]
 *      node scripts/log-archive.mjs <errors|webhooks|failures> [--days 1] [--mode live]
 *      node scripts/log-archive.mjs correlation --id <correlation ID> [--days 1] [--mode live]
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { gunzipSync } from "node:zlib";

import { logEvents, logKeys } from "../app/log-records.ts";
import config, { logArchives } from "../cloudflare.config.ts";
import { cf, cfJson, keychain } from "./lib/provider.mjs";

export const retentionDays = 90;
export const dataset = "workers_trace_events";

/**
 * Campi esportati di Workers Trace Events. Restano fuori `Event` (URL, header e contesto della
 * richiesta o del messaggio), `Exceptions` (nome e testo non sanificati delle eccezioni),
 * `ScriptTags`, `DispatchNamespace` ed `Entrypoint`. L'esito di un'eccezione resta in `Outcome`.
 */
export const exportedFields = [
  "EventTimestampMs",
  "EventType",
  "Outcome",
  "ScriptName",
  "ScriptVersion",
  "CPUTimeMs",
  "WallTimeMs",
  "Logs",
];

/** Operazioni dei log applicativi che riguardano gli ingressi e il consumer dei webhook. */
export const webhookOperations = ["webhook_ingress", "webhook_consumer", "stripe_webhook"];

/** Worker, account, bucket e voci del Portachiavi dell'ambiente, da `cloudflare.config.ts`. */
export function targetOf(mode) {
  const live = mode === "live";
  const { worker } = config({ mode: live ? "live" : "development" });
  const environment = live ? "live" : "test";
  return {
    worker: worker.name,
    account: worker.env.CLOUDFLARE_ACCOUNT_ID.value,
    bucket: logArchives[environment],
    job: logArchives[environment],
    keychain: {
      accessKeyId: `FiscalBay log archive ${environment} access key ID`,
      secretAccessKey: `FiscalBay log archive ${environment} secret access key`,
    },
  };
}

/** Endpoint S3 UE dell'account: la giurisdizione del bucket passa da qui. */
export const euEndpoint = (account) => `${account}.eu.r2.cloudflarestorage.com`;

/** Oggetti in sottocartelle giornaliere `AAAAMMGG/`, come le scrive Logpush con `{DATE}`. */
export function destination(target, credentials) {
  const query = new URLSearchParams({
    region: "auto",
    endpoint: euEndpoint(target.account),
    "access-key-id": credentials.accessKeyId,
    "secret-access-key": credentials.secretAccessKey,
  });
  return `s3://${target.bucket}/{DATE}?${query}`;
}

/** Bucket, percorso, regione ed endpoint di una destinazione, senza credenziali. */
export function describeDestination(conf) {
  const match = /^s3:\/\/([^/?]+)\/?([^?]*)\?(.*)$/u.exec(conf ?? "");
  if (!match) return null;
  const query = new URLSearchParams(match[3]);
  return {
    bucket: match[1],
    path: match[2],
    region: query.get("region"),
    endpoint: query.get("endpoint"),
    credentials: query.has("access-key-id") && query.has("secret-access-key"),
  };
}

export const jobFilter = (target) =>
  JSON.stringify({
    where: {
      and: [{ key: "ScriptName", operator: "eq", value: target.worker }],
    },
  });

/** Corpo del job: soltanto il Worker dell'ambiente, i campi ammessi e ogni invocazione. */
export function jobBody(target, credentials) {
  return {
    name: target.job,
    dataset,
    enabled: true,
    destination_conf: destination(target, credentials),
    filter: jobFilter(target),
    // L'aggiornamento sostituisce l'intero oggetto: si invia sempre completo.
    output_options: {
      field_names: exportedFields,
      output_type: "ndjson",
      timestamp_format: "rfc3339",
      sample_rate: 1,
      "CVE-2021-44228": false,
    },
  };
}

/** Oggetti eliminati 90 giorni dopo la scrittura; caricamenti incompleti dopo un giorno. */
export function lifecycleRules() {
  return [
    {
      id: "log-scaduti",
      enabled: true,
      conditions: { prefix: "" },
      deleteObjectsTransition: {
        condition: { type: "Age", maxAge: retentionDays * 86_400 },
      },
      abortMultipartUploadsTransition: {
        condition: { type: "Age", maxAge: 86_400 },
      },
    },
  ];
}

/** Descrizione stampabile del piano, con le credenziali sostituite. */
export function plan(target) {
  const body = jobBody(target, {
    accessKeyId: "<chiave>",
    secretAccessKey: "<segreto>",
  });
  return {
    worker: target.worker,
    bucket: {
      name: target.bucket,
      jurisdiction: "eu",
      lifecycle: lifecycleRules(),
    },
    job: {
      ...body,
      destination_conf: describeDestination(body.destination_conf),
    },
  };
}

/** Stesso JSON a meno di spazi e formattazione restituiti dal provider. */
function sameJson(a, b) {
  try {
    return JSON.stringify(JSON.parse(a)) === JSON.stringify(JSON.parse(b));
  } catch {
    return false;
  }
}

const sameList = (a, b) =>
  Array.isArray(a) && Array.isArray(b) && [...a].sort().join() === [...b].sort().join();

/**
 * Controlli del readback: bucket UE senza accesso pubblico con la sola regola a 90 giorni, un
 * solo job verso il bucket con filtro, campi e destinazione attesi, Worker che invia gli eventi.
 */
export function checkReadback(target, state) {
  const rule = state.lifecycle?.rules ?? [];
  const jobs = (state.jobs ?? []).filter(
    (job) =>
      job.name === target.job ||
      describeDestination(job.destination_conf)?.bucket === target.bucket,
  );
  const job = jobs[0];
  const options = job?.output_options ?? {};
  const sink = describeDestination(job?.destination_conf);
  const checks = [
    ["bucket UE", state.bucket?.jurisdiction === "eu"],
    ["r2.dev disattivato", state.managedDomain?.enabled === false],
    [
      "nessun dominio",
      Array.isArray(state.customDomains?.domains) && !state.customDomains.domains.length,
    ],
    [
      "lifecycle a 90 giorni",
      rule.length === 1 &&
        rule[0].enabled === true &&
        (rule[0].conditions?.prefix ?? "") === "" &&
        rule[0].deleteObjectsTransition?.condition?.type === "Age" &&
        rule[0].deleteObjectsTransition.condition.maxAge === retentionDays * 86_400,
    ],
    ["un solo job verso il bucket", jobs.length === 1],
    ["job attivo", job?.enabled === true && job?.dataset === dataset],
    ["filtro sul Worker dell'ambiente", sameJson(job?.filter, jobFilter(target))],
    ["campi ammessi", sameList(options.field_names, exportedFields)],
    ["campionamento completo", Boolean(job) && (options.sample_rate ?? 1) === 1],
    [
      "endpoint UE",
      sink?.bucket === target.bucket && sink?.endpoint === euEndpoint(target.account),
    ],
    // Un errore passato non conta se un invio riuscito lo segue.
    [
      "job senza errori",
      Boolean(job) &&
        (!job.last_error || (Boolean(job.last_complete) && job.last_complete > job.last_error)),
    ],
    ["Worker con Logpush", state.worker?.logpush === true],
  ];
  return {
    ok: checks.every(([, ok]) => ok),
    checks: Object.fromEntries(checks),
    job: job
      ? {
          id: job.id,
          lastComplete: job.last_complete ?? null,
          lastError: job.last_error ?? null,
        }
      : null,
  };
}

/** Oggetto JSON di una riga NDJSON, o `null` per righe vuote o illeggibili. */
function parseLine(line) {
  try {
    const value = JSON.parse(line);
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

/** Record di un oggetto esportato: gzip o testo NDJSON. */
export function parseObject(bytes) {
  const text = (bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes).toString(
    "utf8",
  );
  return text
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => parseLine(line) ?? { invalid: true });
}

/**
 * Marcatore di Logpush oltre i 16.384 caratteri per invocazione: può seguire l'inizio di un
 * evento applicativo, che resta ammesso soltanto senza spazi, `@` o altro testo libero.
 */
const truncated = /^[\w":,.{}-]*<<<Logpush: [a-z ]+ truncated>>>$/u;
const scalar = /^[\w.:-]{1,64}$/u;

/**
 * Evento applicativo di un messaggio di `Logs`: un solo argomento, oggetto JSON con evento e
 * chiavi degli elenchi chiusi e valori scalari brevi. `null` per tutto il resto.
 */
export function applicationEvent(entry) {
  const parts = Array.isArray(entry?.Message) ? entry.Message : [entry?.Message];
  if (parts.length !== 1 || typeof parts[0] !== "string") return null;
  const value = parseLine(parts[0]);
  if (!value || !logEvents.includes(value.event)) return null;
  for (const [key, field] of Object.entries(value)) {
    if (!logKeys.includes(key)) return null;
    if (typeof field === "number" ? !Number.isFinite(field) : !scalar.test(String(field)))
      return null;
  }
  return value;
}

/** Problemi di un record esportato rispetto all'allowlist e al Worker dell'ambiente. */
export function recordProblems(record, worker) {
  if (record.invalid) return ["riga illeggibile"];
  const problems = Object.keys(record)
    .filter((key) => !exportedFields.includes(key))
    .map((key) => `campo ${key}`);
  if (record.ScriptName !== worker) problems.push("altro Worker");
  for (const entry of record.Logs ?? []) {
    const parts = Array.isArray(entry?.Message) ? entry.Message : [entry?.Message];
    if (parts.length === 1 && truncated.test(String(parts[0]))) continue;
    if (!applicationEvent(entry)) problems.push("messaggio fuori allowlist");
  }
  return problems;
}

const increment = (counts, key) => counts.set(key, (counts.get(key) ?? 0) + 1);
const sorted = (counts) =>
  Object.fromEntries([...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));

/** Esito della verifica: conteggi, mai il contenuto dei messaggi. */
export function verifyRecords(records, worker) {
  const problems = new Map();
  const events = new Map();
  const scripts = new Map();
  for (const record of records) {
    for (const problem of recordProblems(record, worker)) increment(problems, problem);
    if (!record.invalid) increment(scripts, String(record.ScriptName));
    for (const entry of record.Logs ?? []) {
      const event = applicationEvent(entry);
      if (event) increment(events, event.event);
    }
  }
  return {
    ok: records.length > 0 && problems.size === 0,
    records: records.length,
    scripts: sorted(scripts),
    events: sorted(events),
    problems: sorted(problems),
  };
}

const eventsOf = (record) => (record.Logs ?? []).map(applicationEvent).filter(Boolean);
const errorKey = (event) =>
  [event.code, event.operation, event.failure].filter((part) => part !== undefined).join(" ");

/** Errori applicativi per codice, operazione e tipo di guasto del provider. */
export function errorsByCode(records, operations) {
  const counts = new Map();
  for (const record of records)
    for (const event of eventsOf(record))
      if (
        event.event === "application_error" &&
        (!operations || operations.includes(event.operation))
      )
        increment(counts, errorKey(event));
  return sorted(counts);
}

/**
 * Invocazioni non riuscite per tipo, esito e versione: eccezioni non gestite, invocazioni
 * annullate e scritture interrotte, il cui testo resta fuori dall'archivio.
 */
export function failedInvocations(records) {
  const counts = new Map();
  for (const record of records)
    if (!record.invalid && record.Outcome !== "ok")
      increment(
        counts,
        [record.EventType, record.Outcome, record.ScriptVersion?.ID ?? "-"].join(" "),
      );
  return sorted(counts);
}

/** Istante dell'evento: Logpush scrive `EventTimestampMs` in millisecondi anche con `rfc3339`. */
const instant = (value) =>
  typeof value === "number" && Number.isFinite(value) ? new Date(value).toISOString() : value;

/** Invocazioni con un correlation ID, in ordine di tempo, con i soli eventi applicativi. */
export function correlationTrail(records, id) {
  return records
    .filter((record) => eventsOf(record).some((event) => event.correlationId === id))
    .map((record) => ({
      at: instant(record.EventTimestampMs),
      type: record.EventType,
      outcome: record.Outcome,
      version: record.ScriptVersion?.ID ?? null,
      events: eventsOf(record).map((event) =>
        Object.fromEntries(Object.entries(event).filter(([key]) => key !== "correlationId")),
      ),
    }))
    .sort((a, b) => String(a.at).localeCompare(String(b.at)));
}

/** Prefissi giornalieri UTC degli ultimi `days` giorni, dal più recente. */
export function dayPrefixes(days, now = new Date()) {
  return Array.from({ length: days }, (_, index) => {
    const day = new Date(now.getTime() - index * 86_400_000);
    return `${day.toISOString().slice(0, 10).replaceAll("-", "")}/`;
  });
}

/** Ogni comando sul bucket indica la giurisdizione: senza, la CLI cerca fuori dall'UE. */
const jurisdiction = ["--cf-r2-jurisdiction", "eu"];

function readState(target) {
  // Le letture facoltative tacciono gli errori, come per un bucket non ancora creato.
  const optional = (args) => {
    try {
      return cfJson(args, { stderr: "ignore" });
    } catch {
      return null;
    }
  };
  return {
    bucket: optional(["r2", "buckets", "get", target.bucket, ...jurisdiction]),
    lifecycle: optional(["r2", "buckets", "lifecycle", "get", target.bucket, ...jurisdiction]),
    managedDomain: optional([
      "r2",
      "buckets",
      "domains",
      "managed",
      "list",
      "--bucket-name",
      target.bucket,
      ...jurisdiction,
    ]),
    customDomains: optional([
      "r2",
      "buckets",
      "domains",
      "custom",
      "list",
      "--bucket-name",
      target.bucket,
      ...jurisdiction,
    ]),
    jobs: optional(["logpush", "account-jobs", "list"]) ?? [],
    worker: optional(["workers", "get", target.worker]),
  };
}

function credentialsOf(target) {
  const read = (variable, service) => {
    if (process.env[variable]?.trim()) return process.env[variable].trim();
    try {
      return keychain(service);
    } catch {
      throw new Error(`Credenziale assente: ${variable} o voce «${service}» del Portachiavi.`);
    }
  };
  return {
    accessKeyId: read("LOG_ARCHIVE_ACCESS_KEY_ID", target.keychain.accessKeyId),
    secretAccessKey: read("LOG_ARCHIVE_SECRET_ACCESS_KEY", target.keychain.secretAccessKey),
  };
}

/** Esegue la CLI con il corpo in un file temporaneo leggibile soltanto dall'utente. */
function withBodyFile(body, run) {
  const directory = mkdtempSync(path.join(tmpdir(), "log-archive-"));
  const file = path.join(directory, "body.json");
  try {
    writeFileSync(file, JSON.stringify(body), { mode: 0o600 });
    return run(`@${file}`);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function apply(target) {
  const state = readState(target);
  if (!state.bucket) cf(["r2", "buckets", "create", "--name", target.bucket, ...jurisdiction]);
  cf([
    "r2",
    "buckets",
    "lifecycle",
    "update",
    target.bucket,
    ...jurisdiction,
    "--force",
    "--rules",
    JSON.stringify(lifecycleRules()),
  ]);
  // Il token si limita a un bucket esistente: bucket e regola nascono prima delle credenziali.
  const credentials = credentialsOf(target);
  const existing = state.jobs.find((job) => job.name === target.job);
  const body = jobBody(target, credentials);
  withBodyFile(existing ? { ...body, dataset: undefined, name: undefined } : body, (file) =>
    existing
      ? cf(["logpush", "account-jobs", "update", String(existing.id), "--body", file])
      : // `--kind` soddisfa soltanto la validazione della CLI, che alla creazione rifiuta il
        // valore vuoto predefinito; con `--body` la richiesta usa il corpo così com'è, senza
        // `kind`, come vuole un job Logpush.
        cf(["logpush", "account-jobs", "create", "--kind", "edge", "--body", file]),
  );
}

function listObjects(target, prefix) {
  const objects = cfJson([
    "r2",
    "objects",
    "list",
    "--bucket-name",
    target.bucket,
    "--prefix",
    prefix,
    ...jurisdiction,
  ]);
  return (Array.isArray(objects) ? objects : (objects?.objects ?? [])).map((object) => object.key);
}

function readObject(target, key) {
  return parseObject(
    cf(["r2", "objects", "get", key, "--bucket-name", target.bucket, ...jurisdiction], {
      encoding: "buffer",
    }),
  );
}

function readDays(target, days) {
  return dayPrefixes(days)
    .flatMap((prefix) => listObjects(target, prefix))
    .flatMap((key) => readObject(target, key));
}

const print = (value) => console.log(JSON.stringify(value, null, 2));

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      mode: { type: "string" },
      days: { type: "string", default: "1" },
      id: { type: "string" },
    },
  });
  const [name] = positionals;
  const target = targetOf(values.mode);
  if (name === "plan") return print(plan(target));
  if (name === "apply") apply(target);
  if (name === "apply" || name === "readback") {
    const result = checkReadback(target, readState(target));
    print(result);
    process.exitCode = result.ok ? 0 : 1;
    return;
  }
  if (name === "verify") {
    // L'oggetto più recente degli ultimi due giorni: le chiavi iniziano con l'istante.
    const key = dayPrefixes(2)
      .flatMap((prefix) => listObjects(target, prefix))
      .sort()
      .at(-1);
    if (!key) throw new Error("Nessun oggetto esportato negli ultimi due giorni.");
    const result = {
      object: key,
      ...verifyRecords(readObject(target, key), target.worker),
    };
    print(result);
    process.exitCode = result.ok ? 0 : 1;
    return;
  }
  const days = Number(values.days);
  if (!Number.isInteger(days) || days < 1 || days > retentionDays)
    throw new Error(`--days fra 1 e ${retentionDays}`);
  if (name === "correlation") {
    if (!/^[0-9a-f-]{36}$/u.test(values.id ?? "")) throw new Error("--id: un correlation ID");
    return print(correlationTrail(readDays(target, days), values.id));
  }
  const queries = {
    errors: (records) => errorsByCode(records),
    webhooks: (records) => errorsByCode(records, webhookOperations),
    failures: failedInvocations,
  };
  if (!(name in queries))
    throw new Error(
      `Comandi: plan, apply, readback, verify, ${Object.keys(queries).join(", ")}, correlation`,
    );
  print({
    worker: target.worker,
    days,
    rows: queries[name](readDays(target, days)),
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]))
  await main().catch((error) => {
    // Soltanto il messaggio: l'errore della CLI non porta credenziali, lo stack non serve.
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
