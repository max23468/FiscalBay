#!/usr/bin/env node
/**
 * Ripristino della D1 di un ambiente con Time Travel senza reintrodurre cancellazioni, revoche o
 * credenziali superate (§32.1). Il servizio resta sospeso dalla cattura alla riapertura: un
 * segreto del Worker, fuori dal database, ferma pagine, webhook e cron, e la coda sospende la
 * consegna. La cattura legge dal database corrente le chiavi primarie di ogni tabella, i marker
 * di cancellazione e le revoche successive al punto scelto, e le cifra in un file temporaneo.
 * Dopo il ripristino ogni riga del database ripristinato che oggi non esiste più si elimina di
 * nuovo, i marker e le revoche si riapplicano, sessioni e collegamenti in corso decadono e le
 * password cambiate dopo il punto non tornano valide. Pagamenti e diritti si riconciliano poi
 * con il reinvio degli eventi Stripe, gli ordini con le letture eBay.
 *
 * Il resoconto riporta soltanto conteggi e nomi delle tabelle, mai valori.
 *
 * Uso:
 *   node scripts/recovery.mjs freeze|status|thaw [--mode live]
 *   RECOVERY_KEY=<base64> node scripts/recovery.mjs capture --at <ISO> --out <file> [--mode live]
 *   RECOVERY_KEY=<base64> node scripts/recovery.mjs restore --in <file>
 *   RECOVERY_KEY=<base64> node scripts/recovery.mjs reapply --in <file>
 *   node scripts/recovery.mjs stripe --since <ISO> [--mode live] [--project-name <profilo>]
 *   RECOVERY_KEY=<base64> node scripts/recovery.mjs telegram --in <file>
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { gunzipSync, gzipSync } from "node:zlib";

import { stripeWebhookEvents } from "../app/integrations/stripe-account.server.ts";
import config, { databases } from "../cloudflare.config.ts";
import { cfJson, d1Query } from "./lib/provider.mjs";
import { retryReadback } from "./release/release.mjs";
import { cliRequest } from "./stripe-account.mjs";

/** Finestra di Time Travel su Workers Paid. */
const timeTravelMs = 30 * 24 * 60 * 60_000;

/**
 * Margine prima del punto scelto: il bookmark più vicino può precedere l'istante richiesto.
 * Riapplicare un marker già presente nel ripristino non cambia nulla.
 */
export const restoreMarginMs = 60 * 60_000;

/** Lunghezza massima di un'istruzione, sotto i 100 KB ammessi da D1. */
const statementLimit = 90_000;

/** Righe lette per pagina. */
const pageSize = 10_000;

/** Tabelle del provider e del registro delle migration, fuori dai dati dell'app. */
const internal = /^(?:sqlite_|_cf_|d1_migrations$)/u;

/**
 * Marker da riportare dopo il ripristino. Senza `since` la tabella si riporta intera: è piccola
 * e il compito periodico riapre da sé le richieste i cui dati ricompaiono. `where` limita le
 * righe lette, `parent` a quelle il cui riferimento esiste ancora.
 */
const markerTables = [
  { table: "account_deletions", conflict: "REPLACE" },
  { table: "ebay_account_deletions", conflict: "REPLACE" },
  { table: "stripe_customer_erasures", conflict: "IGNORE" },
  { table: "store_identity_marks", conflict: "REPLACE" },
  {
    table: "deleted_order_keys",
    since: "deleted_at",
    conflict: "IGNORE",
    parent: { column: "store_id", table: "ebay_stores", key: "id" },
  },
  {
    table: "marketing_consents",
    since: "recorded_at",
    conflict: "IGNORE",
    parent: { column: "user_id", table: "user", key: "id" },
  },
  // La chat collegata oggi sostituisce quella recuperata, che ha perso l'autorizzazione.
  {
    table: "telegram_links",
    conflict: "REPLACE",
    parent: { column: "workspace_id", table: "workspaces", key: "id" },
  },
  // Notifiche disattivate: una copia precedente non le riattiva.
  {
    table: "telegram_preferences",
    where: "enabled = 0",
    conflict: "REPLACE",
    parent: { column: "workspace_id", table: "workspaces", key: "id" },
  },
  {
    table: "telegram_store_preferences",
    where: "enabled = 0",
    conflict: "REPLACE",
    parent: { column: "store_id", table: "ebay_stores", key: "id" },
  },
];

/** Ruoli concessi da un flag: chi oggi non l'ha più lo perde anche nella copia ripristinata. */
const grantFlags = [{ table: "user", key: "id", column: "admin" }];

/**
 * Revoche e diritti consumati che aggiornano una riga esistente: la prima colonna è l'istante,
 * le altre lo accompagnano. Si riapplicano soltanto dove il ripristino le ha tolte; con `newer`
 * anche dove il ripristino ha riportato un istante precedente. `name` distingue due voci della
 * stessa tabella.
 */
const stampTables = [
  { table: "admin_agent_tokens", key: ["token_hash"], columns: ["revoked_at"] },
  { table: "history_extensions", key: ["id"], columns: ["revoked_at"] },
  { table: "order_grants", key: ["id"], columns: ["revoked_at"] },
  { table: "workspace_entitlements", key: ["id"], columns: ["revoked_at", "revocation"] },
  { table: "workspaces", key: ["id"], columns: ["trial_used_at"] },
  // «Scollega ed elimina» cancella anche il profilo del negozio.
  {
    table: "ebay_stores",
    key: ["id"],
    columns: [
      "data_deleted_at",
      "store_name",
      "store_logo_url",
      "store_url",
      "feedback_score",
      "feedback_positive_percent",
      "top_rated_seller",
      "store_profile_read_at",
    ],
  },
  // Limite degli ordini eliminati: resta anche dopo un nuovo collegamento e non torna indietro,
  // altrimenti gli ordini mai osservati prima dell'eliminazione si importerebbero di nuovo.
  {
    name: "ebay_store_deletion_limits",
    table: "ebay_stores",
    key: ["id"],
    columns: ["orders_deleted_through"],
    newer: true,
  },
  { table: "service_notices", key: ["id"], columns: ["withdrawn_at"] },
  // Un consenso eBay rifiutato o revocato non torna valido.
  { table: "ebay_store_credentials", key: ["store_id"], columns: ["rejected_at"] },
];

/** Righe scritte dalla riapplicazione stessa: una ripetizione non le tratta come eliminate. */
const written = { service_settings: [["telegram_sends"]] };

/** Sessioni, verifiche e collegamenti eBay in corso: nessuno torna valido da una copia. */
const transientTables = ["session", "verification", "ebay_store_link_sessions"];

export const ident = (name) => `"${String(name).replaceAll('"', '""')}"`;

export function literal(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Valore numerico non rappresentabile.");
    return String(value);
  }
  if (typeof value === "string") return `'${value.replaceAll("'", "''")}'`;
  throw new Error("Tipo di valore non previsto.");
}

const tuple = (values) => `(${values.map(literal).join(", ")})`;

/** Istruzioni con il maggior numero di elementi entro il limite di lunghezza. */
export function batched(items, head, render, tail = "", limit = statementLimit) {
  const statements = [];
  let current = [];
  let length = 0;
  for (const item of items) {
    const text = render(item);
    if (current.length && head.length + length + text.length + tail.length > limit) {
      statements.push(`${head}${current.join(", ")}${tail}`);
      current = [];
      length = 0;
    }
    current.push(text);
    length += text.length + 2;
  }
  if (current.length) statements.push(`${head}${current.join(", ")}${tail}`);
  return statements;
}

/**
 * Tabelle dei dati con la chiave primaria, dalle figlie alle madri: un'eliminazione non trova
 * mai un riferimento che la blocca. Una tabella senza chiave o un ciclo di riferimenti fermano
 * il ripristino, perché il confronto non sarebbe affidabile.
 */
export async function schemaOf(run) {
  // D1 nega le pragma sulle proprie tabelle `_cf_`.
  const own = "m.type = 'table' AND m.name NOT LIKE '\\_cf%' ESCAPE '\\'";
  const [tables, columns, references] = await run([
    `SELECT name FROM sqlite_master m WHERE ${own} ORDER BY name`,
    `SELECT m.name AS tableName, p.name AS columnName, p.pk AS position
      FROM sqlite_master m, pragma_table_info(m.name) p
      WHERE ${own} AND p.pk > 0 ORDER BY m.name, p.pk`,
    `SELECT m.name AS tableName, f."table" AS parent
      FROM sqlite_master m, pragma_foreign_key_list(m.name) f WHERE ${own}`,
  ]);
  const names = tables.map(({ name }) => name).filter((name) => !internal.test(name));
  const keys = new Map(names.map((name) => [name, []]));
  for (const { tableName, columnName } of columns) keys.get(tableName)?.push(columnName);
  const missing = names.filter((name) => keys.get(name).length === 0);
  if (missing.length) throw new Error(`Tabelle senza chiave primaria: ${missing.join(", ")}.`);
  const parents = new Map(names.map((name) => [name, new Set()]));
  for (const { tableName, parent } of references)
    if (tableName !== parent && keys.has(parent)) parents.get(tableName)?.add(parent);
  // Una madre esce soltanto dopo tutte le sue figlie.
  const ordered = [];
  const pending = new Set(names);
  while (pending.size) {
    const ready = [...pending].filter(
      (name) => ![...pending].some((other) => parents.get(other).has(name)),
    );
    if (!ready.length) throw new Error("Riferimenti circolari fra tabelle.");
    for (const name of ready) {
      ordered.push({ name, key: keys.get(name) });
      pending.delete(name);
    }
  }
  return ordered;
}

/** Righe di una tabella in pagine ordinate per chiave. */
async function readRows(run, table, key, columns, where = "") {
  const keyList = key.map(ident).join(", ");
  const rows = [];
  for (;;) {
    const last = rows.at(-1);
    const conditions = [
      ...(where ? [`(${where})`] : []),
      ...(last ? [`(${keyList}) > ${tuple(key.map((column) => last[column]))}`] : []),
    ];
    const [page] = await run([
      `SELECT ${columns} FROM ${ident(table)}${conditions.length ? ` WHERE ${conditions.join(" AND ")}` : ""} ORDER BY ${keyList} LIMIT ${pageSize}`,
    ]);
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

/** Chiavi primarie di una tabella, ciascuna come elenco di valori. */
async function readKeys(run, { name, key }) {
  const rows = await readRows(run, name, key, key.map(ident).join(", "));
  return rows.map((row) => key.map((column) => row[column]));
}

const since = (column, at) => `julianday(${ident(column)}) >= julianday(${literal(at)})`;

/** Stato da riapplicare, letto dal database corrente a servizio sospeso. */
export async function capture(run, at) {
  const threshold = new Date(Date.parse(at) - restoreMarginMs).toISOString();
  const tables = await schemaOf(run);
  const keys = {};
  for (const table of tables) keys[table.name] = await readKeys(run, table);
  const key = (name) => tables.find((table) => table.name === name).key;
  const markers = {};
  for (const marker of markerTables)
    markers[marker.table] = await readRows(
      run,
      marker.table,
      key(marker.table),
      "*",
      [marker.where, marker.since && since(marker.since, threshold)].filter(Boolean).join(" AND "),
    );
  const stamps = {};
  for (const stamp of stampTables)
    stamps[stamp.name ?? stamp.table] = await readRows(
      run,
      stamp.table,
      stamp.key,
      [...stamp.key, ...stamp.columns].map(ident).join(", "),
      since(stamp.columns[0], threshold),
    );
  const grants = {};
  for (const flag of grantFlags)
    grants[flag.table] = (
      await readRows(run, flag.table, [flag.key], ident(flag.key), `${ident(flag.column)} = 1`)
    ).map((row) => row[flag.key]);
  const [migrations, credentials, telegram] = await run([
    "SELECT name FROM d1_migrations ORDER BY id",
    `SELECT "id" FROM "account" WHERE "providerId" = 'credential' AND ${since("updatedAt", threshold)}`,
    "SELECT value FROM service_settings WHERE name = 'telegram_sends'",
  ]);
  return {
    since: threshold,
    migrations: migrations.map(({ name }) => name),
    tables,
    keys,
    markers,
    stamps,
    grants,
    credentials: credentials.map(({ id }) => id),
    telegramSends: telegram[0]?.value ?? null,
  };
}

/** Eliminazione delle chiavi indicate, una o più colonne. */
function deleteKeys(table, key, keys) {
  if (key.length === 1)
    return batched(
      keys,
      `DELETE FROM ${ident(table)} WHERE ${ident(key[0])} IN (`,
      ([value]) => literal(value),
      ")",
    );
  return batched(
    keys,
    `DELETE FROM ${ident(table)} WHERE (${key.map(ident).join(", ")}) IN (VALUES `,
    tuple,
    ")",
  );
}

/** Marker riportati: tutti, oppure soltanto quelli il cui riferimento esiste ancora. */
function insertMarkers({ table, conflict, parent }, rows) {
  if (!rows.length) return [];
  const columns = Object.keys(rows[0]);
  const values = (row) => tuple(columns.map((column) => row[column]));
  const head = `INSERT OR ${conflict} INTO ${ident(table)} (${columns.map(ident).join(", ")})`;
  if (!parent) return batched(rows, `${head} VALUES `, values);
  const position = columns.indexOf(parent.column) + 1;
  return batched(
    rows,
    `${head} SELECT * FROM (VALUES `,
    values,
    `) WHERE EXISTS (SELECT 1 FROM ${ident(parent.table)} p WHERE p.${ident(parent.key)} = column${position})`,
  );
}

/** Revoche riportate soltanto dove il ripristino le ha tolte. */
function restoreStamps({ table, key, columns, newer }, rows) {
  return rows.map(
    (row) =>
      `UPDATE ${ident(table)} SET ${columns.map((column) => `${ident(column)} = ${literal(row[column])}`).join(", ")}
        WHERE ${key.map((column) => `${ident(column)} = ${literal(row[column])}`).join(" AND ")}
          AND (${ident(columns[0])} IS NULL${newer ? ` OR ${ident(columns[0])} < ${literal(row[columns[0]])}` : ""})`,
  );
}

/**
 * Riapplica lo stato catturato al database ripristinato. Ripetibile: una seconda esecuzione
 * non trova più nulla da eliminare né revoche da riportare. Gli invii Telegram restano spenti
 * fino a `telegram`, così gli ordini riletti dopo il ripristino non si notificano di nuovo.
 */
export async function reapply(run, captured, now = new Date()) {
  const [applied] = await run(["SELECT name FROM d1_migrations ORDER BY id"]);
  if (JSON.stringify(applied.map(({ name }) => name)) !== JSON.stringify(captured.migrations))
    throw new Error(
      "Migration del database ripristinato diverse da quelle catturate: applicarle e ripetere.",
    );
  const tables = await schemaOf(run);
  if (JSON.stringify(tables) !== JSON.stringify(captured.tables))
    throw new Error("Schema del database ripristinato diverso da quello catturato.");
  await run(transientTables.map((table) => `DELETE FROM ${ident(table)}`));
  const deleted = {};
  const stale = {};
  for (const table of tables) {
    const present = new Set(
      [...captured.keys[table.name], ...(written[table.name] ?? [])].map((key) =>
        JSON.stringify(key),
      ),
    );
    stale[table.name] = (await readKeys(run, table)).filter(
      (key) => !present.has(JSON.stringify(key)),
    );
    const statements = deleteKeys(table.name, table.key, stale[table.name]);
    if (statements.length) await run(statements);
    if (stale[table.name].length) deleted[table.name] = stale[table.name].length;
  }
  const markers = markerTables.flatMap((marker) =>
    insertMarkers(marker, captured.markers[marker.table]),
  );
  if (markers.length) await run(markers);
  const stamps = stampTables.flatMap((stamp) =>
    restoreStamps(stamp, captured.stamps[stamp.name ?? stamp.table]),
  );
  if (stamps.length) await run(stamps);
  await run(
    grantFlags.map(
      ({ table, key, column }) =>
        `UPDATE ${ident(table)} SET ${ident(column)} = 0 WHERE ${ident(column)} = 1${
          captured.grants[table].length
            ? ` AND ${ident(key)} NOT IN (${captured.grants[table].map(literal).join(", ")})`
            : ""
        }`,
    ),
  );
  const credentials = batched(
    captured.credentials,
    `UPDATE "account" SET "password" = NULL WHERE "providerId" = 'credential' AND "id" IN (`,
    literal,
    ")",
  );
  if (credentials.length) await run(credentials);
  await run([
    `INSERT INTO service_settings (name, value, updated_at)
      VALUES ('telegram_sends', 'false', ${literal(now.toISOString())})
      ON CONFLICT (name) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ]);
  // Nessuna riga eliminata dopo il punto ripristinato deve essere rimasta.
  for (const table of tables) {
    if (!stale[table.name].length) continue;
    const removed = new Set(stale[table.name].map((key) => JSON.stringify(key)));
    if ((await readKeys(run, table)).some((key) => removed.has(JSON.stringify(key))))
      throw new Error(`Eliminazioni non riapplicate: ${table.name}.`);
  }
  return {
    deleted,
    markers: Object.fromEntries(
      markerTables.map(({ table }) => [table, captured.markers[table].length]),
    ),
    stamps: stampTables.reduce(
      (total, { name, table }) => total + captured.stamps[name ?? table].length,
      0,
    ),
    credentials: captured.credentials.length,
  };
}

/**
 * Ripresa degli invii Telegram dopo la rilettura degli ordini: gli eventi precedenti non
 * arrivano più, poi l'interruttore torna come prima del ripristino.
 */
export function telegramResume(captured, now = new Date()) {
  const at = literal(now.toISOString());
  return [
    `UPDATE telegram_links SET resumed_at = ${at}
      WHERE resumed_at IS NULL OR julianday(resumed_at) < julianday(${at})`,
    captured.telegramSends === null
      ? "DELETE FROM service_settings WHERE name = 'telegram_sends'"
      : `UPDATE service_settings SET value = ${literal(captured.telegramSends)}, updated_at = ${at}
          WHERE name = 'telegram_sends'`,
  ];
}

/** Chiave del file: 32 byte in base64, dal Portachiavi alla sola variabile del comando. */
export function recoveryKey(encoded) {
  const key = Buffer.from(encoded ?? "", "base64");
  if (key.length !== 32) throw new Error("RECOVERY_KEY deve contenere 32 byte in base64.");
  return key;
}

/** File cifrato con AES-256-GCM; l'intestazione resta leggibile ma autenticata. */
export function seal(header, payload, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(JSON.stringify(header)));
  const data = Buffer.concat([cipher.update(gzipSync(JSON.stringify(payload))), cipher.final()]);
  return JSON.stringify({
    header,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: data.toString("base64"),
  });
}

export function unseal(text, key) {
  const { header, iv, tag, data } = JSON.parse(text);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
  decipher.setAAD(Buffer.from(JSON.stringify(header)));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  try {
    const plain = Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]);
    return { header, payload: JSON.parse(gunzipSync(plain).toString("utf8")) };
  } catch {
    throw new Error("File di ripristino alterato o chiave errata.");
  }
}

/** Istante di ripristino ammesso: passato ed entro la finestra di Time Travel. */
export function restorePoint(at, now = new Date()) {
  const time = Date.parse(at ?? "");
  if (!Number.isFinite(time) || time >= now.getTime() || now.getTime() - time > timeTravelMs)
    throw new Error("--at deve essere un istante ISO passato, entro 30 giorni.");
  return new Date(time).toISOString();
}

/**
 * Stato della sospensione dalle tre fonti: segreto del Worker, consegna della coda e risposta
 * della pagina iniziale. «partial» se non concordano.
 */
export function freezeState({ secret, paused, status, marked }) {
  if (secret && paused && status === 503 && marked) return "frozen";
  if (!secret && !paused && status !== 503 && !marked) return "open";
  return "partial";
}

/** Ambiente letto da `cloudflare.config.ts` con la stessa modalità della build. */
export function targetOf(mode) {
  const { worker } = config({ mode: mode === "live" ? "live" : "development" });
  return {
    live: mode === "live",
    worker: worker.name,
    origin: worker.env.APP_ORIGIN.value,
    queue: worker.env.WORK_QUEUE.name,
    database: (mode === "live" ? databases.live : databases.test).id,
  };
}

/** Comando `cf` con l'esito in JSON; l'eliminazione di un segreto non ne stampa. */
const cf = (...args) => cfJson(args, { ci: true });

/** Istruzioni sulla D1 remota in chiamate entro il limite; un errore dell'API si ripete. */
function remoteRun(database) {
  const call = (statements) => d1Query(database, statements, { ci: true });
  return async (statements) => {
    const results = [];
    let group = [];
    let length = 0;
    for (const statement of statements) {
      if (group.length && length + statement.length > statementLimit) {
        results.push(...(await call(group)));
        group = [];
        length = 0;
      }
      group.push(statement);
      length += statement.length + 2;
    }
    if (group.length) results.push(...(await call(group)));
    return results;
  };
}

function queueOf(target) {
  const queue = cf("queues", "list").find(({ queue_name: name }) => name === target.queue);
  if (!queue) throw new Error("Coda dell'ambiente non trovata.");
  return queue;
}

const frozenSecret = (target) =>
  cf("workers", "secrets", "list", "--worker", target.worker).some(
    ({ name }) => name === "SERVICE_FROZEN",
  );

async function readFreeze(target) {
  const secret = frozenSecret(target);
  const paused = queueOf(target).settings?.delivery_paused === true;
  const response = await fetch(`${target.origin}/`, {
    headers: { "cache-control": "no-cache" },
    redirect: "manual",
    signal: AbortSignal.timeout(20_000),
  });
  return freezeState({
    secret,
    paused,
    status: response.status,
    marked: response.headers.get("x-fiscalbay-frozen") === "1",
  });
}

/** Attende lo stato atteso: il segreto nuovo raggiunge l'edge in qualche secondo. */
async function expectFreeze(target, expected) {
  await retryReadback(async () => {
    const state = await readFreeze(target);
    if (state !== expected) throw new Error(`Sospensione ${state}, attesa ${expected}.`);
  });
}

async function freeze(target) {
  cf(
    "workers",
    "secrets",
    "update",
    "SERVICE_FROZEN",
    "--worker",
    target.worker,
    "--text",
    "true",
    "--type",
    "secret_text",
  );
  cf("queues", "edit", queueOf(target).queue_id, "--settings-delivery-paused", "true");
  await expectFreeze(target, "frozen");
}

/** Ripetibile: una riapertura interrotta riprende dal passo mancante. */
async function thaw(target) {
  if (frozenSecret(target))
    cf("workers", "secrets", "delete", "SERVICE_FROZEN", "--worker", target.worker, "--force");
  cf("queues", "edit", queueOf(target).queue_id, "--settings-delivery-paused", "false");
  await expectFreeze(target, "open");
}

function readCapture(file, target) {
  const opened = unseal(readFileSync(file, "utf8"), recoveryKey(process.env.RECOVERY_KEY));
  if (opened.header.database !== target.database || opened.header.live !== target.live)
    throw new Error("File di ripristino di un altro database.");
  return opened;
}

const report = (label, counts) => console.log(`${label}: ${JSON.stringify(counts)}`);

/** Eventi Stripe dal punto ripristinato, reinviati all'endpoint dell'ambiente. */
export function replayStripe(request, origin, from) {
  const url = `${origin}/webhooks/stripe`;
  const endpoint = request("get", "/v1/webhook_endpoints", { limit: 100 }).data.find(
    (item) => item.url === url,
  );
  if (!endpoint) throw new Error("Endpoint Stripe dell'ambiente assente.");
  const events = [];
  for (let page; !page || page.has_more;) {
    page = request("get", "/v1/events", {
      "created[gte]": Math.floor(Date.parse(from) / 1000),
      types: [...stripeWebhookEvents],
      limit: 100,
      ...(events.length ? { starting_after: events.at(-1).id } : {}),
    });
    events.push(...page.data);
  }
  // Dal più vecchio: il consumer rilegge comunque lo stato corrente di ogni oggetto.
  for (const event of events.toReversed())
    request("post", `/v1/events/${event.id}/retry`, { webhook_endpoint: endpoint.id });
  return events.length;
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      mode: { type: "string", default: "test" },
      at: { type: "string" },
      since: { type: "string" },
      in: { type: "string" },
      out: { type: "string" },
      "project-name": { type: "string" },
    },
  });
  if (!["test", "live"].includes(values.mode)) throw new Error("--mode accetta test o live.");
  const target = targetOf(values.mode);
  const run = remoteRun(target.database);
  const command = positionals[0];
  if (command === "freeze") return freeze(target);
  if (command === "thaw") return thaw(target);
  if (command === "status") return console.log(await readFreeze(target));
  if (command === "stripe") {
    if (!Number.isFinite(Date.parse(values.since ?? ""))) throw new Error("--since richiesto.");
    const request = cliRequest({ live: target.live, project: values["project-name"] });
    return report("eventi Stripe reinviati", replayStripe(request, target.origin, values.since));
  }
  if (command === "capture") {
    if (!values.out) throw new Error("--out richiesto.");
    const key = recoveryKey(process.env.RECOVERY_KEY);
    const at = restorePoint(values.at);
    await expectFreeze(target, "frozen");
    const { bookmark } = cf(
      "d1",
      "time-travel",
      "get-bookmark",
      target.database,
      "--timestamp",
      at,
    );
    const payload = await capture(run, at);
    // Il bookmark corrente annulla il ripristino, se serve tornare allo stato catturato.
    const { bookmark: undo } = cf("d1", "time-travel", "get-bookmark", target.database);
    const header = {
      format: 1,
      live: target.live,
      database: target.database,
      at,
      since: payload.since,
      bookmark,
      undo,
      capturedAt: new Date().toISOString(),
    };
    writeFileSync(values.out, seal(header, payload, key), { flag: "wx", mode: 0o600 });
    return report("catturato", {
      since: payload.since,
      tabelle: payload.tables.length,
      chiavi: Object.values(payload.keys).reduce((total, keys) => total + keys.length, 0),
      revoche: Object.values(payload.stamps).reduce((total, rows) => total + rows.length, 0),
      credenziali: payload.credentials.length,
    });
  }
  if (!values.in) throw new Error("--in richiesto.");
  const { header, payload } = readCapture(values.in, target);
  if (command === "telegram") {
    await run(telegramResume(payload));
    return console.log("Invii Telegram ripresi senza gli eventi precedenti.");
  }
  if (!["restore", "reapply"].includes(command)) throw new Error("Comando non supportato.");
  await expectFreeze(target, "frozen");
  if (command === "restore") {
    cf("d1", "time-travel", "restore", target.database, "--bookmark", header.bookmark, "--force");
    console.log(`Database ripristinato; per annullare: --bookmark ${header.undo}`);
  }
  report("riapplicato", await reapply(run, payload));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]))
  await main();
