#!/usr/bin/env node
/**
 * Misure di capacità sul dataset di riferimento, a richiesta e fuori dal gate.
 * - `costs`: suite Workers locale (`vitest.capacity.config.ts`) con righe D1, query, messaggi e
 *   chiamate eBay per operazione, valori esatti e ripetibili.
 * - `latency`: build servita da `vite preview` con lo stesso dataset nella D1 locale: tempi delle
 *   pagine con SSR, a freddo, in sequenza e in parallelo, e fasi da `Server-Timing`. Nessuna
 *   chiamata parte verso eBay: i token del dataset non si aprono. `vite preview` non espone il
 *   cron: il suo costo viene dalla suite, il suo tempo dai Workers Logs (`metrics-query.mjs`).
 * - `remote`: lo stesso dataset nella D1 del test, con i negozi sintetici mai dovuti al cron; tre
 *   accessi con una password generata e mai salvata, le stesse prove delle pagine sul dominio
 *   test, poi CPU, durata e righe D1 della finestra dalla GraphQL Analytics API; infine la
 *   pulizia di ogni riga `cap-` con la verifica tabella per tabella. Solo sul test.
 * - `account`: consumo degli ultimi 30 giorni dell'account Cloudflare condiviso, per Worker, D1 e
 *   coda, dalla GraphQL Analytics API con un token di sola lettura (Account Analytics Read).
 * Senza argomenti esegue `costs` e `latency` e scrive `reports/capacity/summary.md`, con la
 * proiezione mensile del caso di riferimento confrontata con le quote incluse di Workers Paid.
 *
 * Uso: node scripts/capacity.mjs [costs|latency|remote|remote-clean|account] [--prebuilt] [--days 30]
 */
import { execFileSync, spawn } from "node:child_process";
import { createHmac, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import {
  capacityStatements,
  capacityStoreStatements,
  largeWorkspace,
  referenceShape,
  searchIndexStatement,
  sessionToken,
  storeId,
  largeStore,
  userOf,
  workspaceId,
} from "../benchmarks/capacity-dataset.ts";
import { hashPassword } from "../app/password.server.ts";
import { legalVersions } from "../app/domain/registration.server.ts";
import { taskPeriods } from "../app/domain/work-timing.ts";
import { localSecret } from "../e2e/local-account.ts";
import { databases } from "../cloudflare.config.ts";
import { d1Query, keychain } from "./lib/provider.mjs";
import { applyLocalMigrations, executeLocal } from "./local-d1.mjs";

const directory = "reports/capacity";
const port = "5196";
const origin = `http://localhost:${port}`;

/** Quote mensili incluse in Workers Paid lette il 2026-10-28; i prezzi cambiano, rileggerle. */
export const included = {
  requests: 10_000_000,
  cpuMs: 30_000_000,
  d1RowsRead: 25_000_000_000,
  d1RowsWritten: 50_000_000,
  d1StorageBytes: 5_000_000_000,
  queueOperations: 1_000_000,
  logEvents: 20_000_000,
};

/**
 * Modello mensile del caso di riferimento (§36): cadenze dei piani, cron ogni dieci minuti e
 * cento ordini al mese per negozio. Le visite sono un'ipotesi dichiarata, da sostituire con le
 * misure reali quando esistono.
 */
export const referenceModel = {
  days: 30,
  cronRuns: 30 * 24 * 6,
  premiumStores: referenceShape.premium + referenceShape.largeStores,
  freeStores: referenceShape.workspaces - referenceShape.premium,
  premiumTurnsPerDay: 144,
  freeTurnsPerDay: 48,
  newOrdersPerStoreMonth: 100,
  dailyVisits: { orders: 10, search: 2, detail: 5 },
  /** Tempo CPU medio per invocazione del Worker test negli ultimi 30 giorni (readback account). */
  cpuMsPerInvocation: 16,
  /** Negozi accodati al massimo da un turno del cron e negozi per messaggio (`order-sync`). */
  dispatchLimit: 300,
  syncGroupSize: 10,
};

/** Righe `CAPACITY {json}` della suite, indicizzate per nome. */
export function parseCosts(output) {
  const results = {};
  for (const line of output.split("\n")) {
    const at = line.indexOf("CAPACITY ");
    if (at < 0) continue;
    const { name, ...rest } = JSON.parse(line.slice(at + "CAPACITY ".length));
    results[name] = rest;
  }
  return results;
}

/** Quantile per rango più vicino, su valori già misurati. */
export function quantile(values, q) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1))];
}

/** Durate per fase dall'header `Server-Timing` (`auth;dur=1.2, d1;dur=3.4`). */
export function serverTiming(header) {
  const phases = {};
  for (const part of (header ?? "").split(",")) {
    const [name, ...params] = part.trim().split(";");
    const duration = params.map((param) => /^dur=([\d.]+)$/u.exec(param.trim())?.[1]).find(Boolean);
    if (name && duration !== undefined) phases[name] = Number(duration);
  }
  return phases;
}

/**
 * Consumo mensile del caso di riferimento dai costi per operazione: ogni voce riporta valore,
 * quota inclusa e quota usata. Il cron usa il turno con tutti i negozi dovuti, un limite superiore.
 */
export function monthlyProjection(costs, model = referenceModel) {
  const stores = model.premiumStores + model.freeStores;
  const turns =
    (model.premiumStores * model.premiumTurnsPerDay + model.freeStores * model.freeTurnsPerDay) *
    model.days;
  const idle = costs["store-sync-idle"];
  const fresh = costs["store-sync-new-orders"];
  const newOrders = stores * model.newOrdersPerStoreMonth;
  // Costo di un ordine nuovo oltre ai turni che lo leggono comunque.
  const perOrder = (key) => (fresh[key] - fresh.turns * idle[key]) / fresh.fresh;
  const workspaces = { premium: referenceShape.premium, large: 1, free: model.freeStores };
  const visits = Object.entries(workspaces).flatMap(([kind, count]) => [
    [costs[`orders-page-${kind}`], count * model.dailyVisits.orders * model.days],
    [costs[`search-suggestions-${kind}`], count * model.dailyVisits.search * model.days],
    [costs[`orders-search-${kind}`], count * model.dailyVisits.search * model.days],
    [costs[`order-detail-${kind}`], count * model.dailyVisits.detail * model.days],
  ]);
  const visitRequests = visits.reduce((total, [, count]) => total + count, 0);
  const sum = (key) =>
    model.cronRuns * costs["cron-due"][key] +
    turns * idle[key] +
    newOrders * perOrder(key) +
    visits.reduce((total, [cost, count]) => total + cost[key] * count, 0);
  // Negozi accodati per turno del cron: i Premium a ogni turno, i Free a uno su tre.
  const dispatched = model.premiumStores + model.freeStores / 3;
  // Messaggi della coda: gruppi del cron, un turno per periodo di ogni compito e, come limite
  // superiore, una notifica eBay per ogni ordine nuovo.
  const groupMessages = model.cronRuns * Math.ceil(dispatched / model.syncGroupSize);
  const minutes = model.days * 24 * 60;
  const taskMessages = Object.values(taskPeriods).reduce(
    (total, period) => total + minutes / (period / 60_000),
    0,
  );
  const messages = groupMessages + taskMessages + newOrders;
  const invocations = model.cronRuns + messages + visitRequests;
  // La CPU segue il lavoro, non i messaggi: ogni lettura di un negozio conta come un'invocazione.
  const cpuUnits = invocations - groupMessages + turns;
  const rows = [
    ["Richieste e invocazioni Worker", invocations, included.requests],
    ["Tempo CPU (ms)", cpuUnits * model.cpuMsPerInvocation, included.cpuMs],
    ["Righe D1 lette", sum("rowsRead"), included.d1RowsRead],
    ["Righe D1 scritte", sum("rowsWritten"), included.d1RowsWritten],
    ["Dimensione D1 (byte)", costs.database.bytes, included.d1StorageBytes],
    ["Operazioni della coda", messages * 3, included.queueOperations],
    ["Eventi di log (uno per invocazione)", invocations, included.logEvents],
  ];
  const ebayDaily = {
    fulfillment:
      turns / model.days +
      (newOrders / model.days) *
        ((fresh.ebayCalls["fulfillment-detail"] ?? 0) / fresh.fresh +
          ((fresh.ebayCalls["fulfillment-list"] ?? 0) - fresh.turns) / fresh.fresh),
    getOrders:
      stores * 12 + (newOrders / model.days) * ((fresh.ebayCalls.GetOrders ?? 0) / fresh.fresh),
    getItem: (newOrders / model.days) * ((fresh.ebayCalls.GetItem ?? 0) / fresh.fresh),
  };
  return {
    turns,
    newOrders,
    messages,
    groupMessages,
    taskMessages,
    invocations,
    rows: rows.map(([name, value, quota]) => ({ name, value, quota, share: value / quota })),
    dispatch: { perTurn: dispatched, share: dispatched / model.dispatchLimit },
    ebayDaily: {
      fulfillment: { calls: ebayDaily.fulfillment, quota: 100_000 },
      getOrders: { calls: ebayDaily.getOrders, quota: 5_000 },
      getItem: { calls: ebayDaily.getItem, quota: 5_000 },
    },
  };
}

const format = (value) =>
  value === null || value === undefined
    ? "-"
    : Math.abs(value) >= 100
      ? Math.round(value).toLocaleString("it-IT")
      : value.toLocaleString("it-IT", { maximumFractionDigits: 1 });
const percent = (share) =>
  `${(share * 100).toLocaleString("it-IT", { maximumFractionDigits: 2 })}%`;

/** Riepilogo Markdown di costi, tempi e proiezione. */
export function capacitySummary({ costs, latency, remote }) {
  const lines = ["# Capacità e costi", ""];
  if (costs) {
    const projection = monthlyProjection(costs);
    lines.push(
      "## Costo per operazione",
      "",
      "Suite Workers locale sul dataset di riferimento: valori esatti per una esecuzione.",
      "",
      "| Operazione | Query | Righe lette | Righe scritte | Altro |",
      "|---|---:|---:|---:|---|",
      ...Object.entries(costs)
        .filter(([name]) => name !== "database")
        .map(([name, { queries, rowsRead, rowsWritten, heaviest: _heaviest, ...rest }]) => {
          const other = Object.entries(rest)
            .map(
              ([key, value]) =>
                `${key}: ${typeof value === "object" ? JSON.stringify(value) : value}`,
            )
            .join(", ");
          return `| ${name} | ${format(queries)} | ${format(rowsRead)} | ${format(rowsWritten)} | ${other} |`;
        }),
      "",
      `Database: ${format(costs.database.bytes / 1e6)} MB, ${format(costs.database.orders)} ordini, ${format(costs.database.order_items)} articoli, ${format(costs.database.tax_identifiers)} identificativi.`,
      "",
      "## Proiezione mensile del caso di riferimento",
      "",
      `${format(projection.turns)} letture periodiche dei negozi, ${format(projection.newOrders)} ordini nuovi, ${format(referenceModel.cronRuns)} turni del cron; visite ipotizzate per spazio e giorno: ${JSON.stringify(referenceModel.dailyVisits)}.`,
      "",
      "| Voce | Mese | Inclusa in Workers Paid | Quota |",
      "|---|---:|---:|---:|",
      ...projection.rows.map(
        ({ name, value, quota, share }) =>
          `| ${name} | ${format(value)} | ${format(quota)} | ${percent(share)} |`,
      ),
      "",
      `Negozi accodati per turno del cron: ${format(projection.dispatch.perTurn)} su ${referenceModel.dispatchLimit} (${percent(projection.dispatch.share)}).`,
      "",
      "| API eBay | Chiamate al giorno | Quota del keyset | Quota usata |",
      "|---|---:|---:|---:|",
      ...Object.entries(projection.ebayDaily).map(
        ([name, { calls, quota }]) =>
          `| ${name} | ${format(calls)} | ${format(quota)} | ${percent(calls / quota)} |`,
      ),
      "",
    );
  }
  if (latency) {
    lines.push(
      "## Tempi sulla build servita in locale",
      "",
      "`vite preview` della build test con la D1 locale: macchina di sviluppo, non il runtime distribuito. Millisecondi.",
      "",
      "| Percorso | Prova | Richieste | p50 | p95 | Massimo | auth p50 | d1 p50 | Errori |",
      "|---|---|---:|---:|---:|---:|---:|---:|---:|",
      ...latencyRows(latency),
      "",
    );
  }
  if (remote) {
    const { workers, d1 } = remote.metrics;
    const minutes = (Date.parse(remote.window.to) - Date.parse(remote.window.from)) / 60_000;
    lines.push(
      "## Prova sul Worker test",
      "",
      `${format(remote.orders)} ordini sintetici nella D1 del test dal ${remote.window.from} al ${remote.window.to} (${format(minutes)} minuti), poi eliminati. Millisecondi.`,
      "",
      "| Percorso | Prova | Richieste | p50 | p95 | Massimo | auth p50 | d1 p50 | Errori |",
      "|---|---|---:|---:|---:|---:|---:|---:|---:|",
      ...latencyRows(remote.latency),
      "",
      workers
        ? `Worker nella finestra, tutto il traffico: ${format(workers.sum.requests)} richieste, ${workers.sum.errors} errori, CPU p50 ${format(workers.quantiles.cpuTimeP50 / 1000)} ms e p95 ${format(workers.quantiles.cpuTimeP95 / 1000)} ms, durata p50 ${format(workers.quantiles.wallTimeP50 / 1000)} ms e p95 ${format(workers.quantiles.wallTimeP95 / 1000)} ms.`
        : "Worker nella finestra: nessun dato negli analytics.",
      d1
        ? `D1 del test nella finestra: ${format(d1.readQueries)} letture con ${format(d1.rowsRead)} righe, ${format(d1.writeQueries)} scritture con ${format(d1.rowsWritten)} righe.`
        : "D1 nella finestra: nessun dato negli analytics.",
      "",
    );
  }
  return lines.join("\n");
}

function latencyRows(latency) {
  return latency.map(
    ({ name, mode, samples, p50, p95, max, phases, errors }) =>
      `| ${name} | ${mode} | ${samples} | ${format(p50)} | ${format(p95)} | ${format(max)} | ${format(phases.auth)} | ${format(phases.d1)} | ${errors} |`,
  );
}

/** Costi per operazione dalla suite Workers locale. */
function measureCosts() {
  let output;
  try {
    output = execFileSync(
      "pnpm",
      ["exec", "vitest", "run", "--config", "vitest.capacity.config.ts"],
      { encoding: "utf8", env: { ...process.env, DO_NOT_TRACK: "1" }, maxBuffer: 64 << 20 },
    );
  } catch (error) {
    process.stderr.write(String(error.stdout ?? ""));
    throw new Error("Suite di capacità non riuscita.");
  }
  const costs = parseCosts(output);
  if (!costs.database) throw new Error("Misure della suite incomplete.");
  return costs;
}

/** Cookie della sessione sintetica dello spazio, firmato con il segreto della copia locale. */
function cookieOf(workspace) {
  const token = sessionToken(workspace);
  const signature = createHmac("sha256", localSecret).update(token).digest("base64");
  return `better-auth.session_token=${encodeURIComponent(`${token}.${signature}`)}`;
}

async function timed(url, init) {
  const started = performance.now();
  const response = await fetch(url, { redirect: "manual", ...init });
  await response.arrayBuffer();
  return {
    ms: performance.now() - started,
    ok: response.status < 400,
    status: response.status,
    phases: serverTiming(response.headers.get("server-timing")),
    location: response.headers.get("location"),
  };
}

function summarize(name, mode, results) {
  const ms = results.map(({ ms }) => ms);
  const phase = (key) =>
    quantile(
      results.map(({ phases }) => phases[key]).filter((v) => v !== undefined),
      0.5,
    );
  return {
    name,
    mode,
    samples: results.length,
    p50: quantile(ms, 0.5),
    p95: quantile(ms, 0.95),
    max: Math.max(...ms),
    phases: { auth: phase("auth"), d1: phase("d1") },
    errors: results.filter(({ ok }) => !ok).length,
  };
}

/** Tempi delle pagine sulla build servita, con il dataset nella D1 locale. */
async function measureLatency({ prebuilt }) {
  if (!prebuilt) execFileSync("pnpm", ["build"], { stdio: "inherit" });
  if (!existsSync(".cloudflare/output")) throw new Error("Build assente: eseguire `pnpm build`.");
  // La D1 locale riparte dal dataset: le prove browser la ripopolano con il proprio account.
  rmSync(".cloudflare/state", { recursive: true, force: true });
  applyLocalMigrations();
  executeLocal(
    [...capacityStatements(referenceShape, legalVersions), searchIndexStatement()].join(";\n") +
      ";",
  );
  execFileSync(process.execPath, ["scripts/local-preview.mjs"], {
    stdio: "inherit",
    env: { ...process.env, E2E_PORT: port },
  });
  const server = spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "preview",
      ".cloudflare/preview",
      "--config",
      "vite.config.ts",
      "--host",
      "localhost",
      "--port",
      port,
      "--strictPort",
    ],
    { stdio: "ignore" },
  );
  try {
    for (let attempt = 0; ; attempt++) {
      try {
        if ((await fetch(`${origin}/`)).status < 500) break;
      } catch {}
      if (attempt > 120) throw new Error("Anteprima non raggiungibile.");
      await sleep(500);
    }
    const cookies = Object.fromEntries(
      Object.entries(measuredWorkspaces).map(([kind, workspace]) => [kind, cookieOf(workspace)]),
    );
    return await measurePages(origin, cookies);
  } finally {
    server.kill("SIGTERM");
  }
}

/** Spazi misurati: il grande con tre negozi, un Premium e un Free con un negozio. */
const measuredWorkspaces = {
  large: largeWorkspace,
  premium: workspaceId(0),
  free: workspaceId(referenceShape.workspaces - 1),
};

/**
 * Pagina Ordini e suggerimenti di ricerca per ogni spazio: a freddo, venti in sequenza e dieci
 * in parallelo per tre volte. `cookies` porta la sessione di ciascuno spazio.
 */
async function measurePages(base, cookies) {
  const results = [];
  for (const [kind, cookie] of Object.entries(cookies)) {
    const headers = { cookie };
    const page = () => timed(`${base}/app/ordini`, { headers });
    results.push(summarize(`orders-${kind}`, "a freddo", [await page()]));
    const sequential = [];
    for (let index = 0; index < 20; index++) sequential.push(await page());
    results.push(summarize(`orders-${kind}`, "20 in sequenza", sequential));
    const parallel = [];
    for (let round = 0; round < 3; round++)
      parallel.push(...(await Promise.all(Array.from({ length: 10 }, () => page()))));
    results.push(summarize(`orders-${kind}`, "10 in parallelo x3", parallel));
    const search = (query) =>
      timed(`${base}/api/v1/orders/search`, {
        method: "POST",
        headers: {
          ...headers,
          origin: base,
          accept: "application/json",
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ q: query, language: "it" }),
      });
    results.push(
      summarize(`search-suggestions-${kind}`, "una", [await search("Acquirente Sintetico 12")]),
    );
    const searches = [];
    for (let index = 0; index < 10; index++)
      searches.push(await search(`Acquirente Sintetico ${index}`));
    results.push(summarize(`search-suggestions-${kind}`, "10 in sequenza", searches));
  }
  return results;
}

/**
 * Query sulla D1 del test con la CLI `cf`; restituisce le righe di ogni istruzione. Un errore
 * dell'API si ripete fino a tre volte: la pulizia è ripetibile, mentre un caricamento già
 * applicato fallisce sulle chiavi e la prova si ferma ripulendo.
 */
const testQuery = (sql) => d1Query(databases.test.id, sql, { stderr: "pipe" });

/** Negozi del dataset, nell'ordine in cui si caricano. */
const datasetStores = () => [
  ...Array.from({ length: referenceShape.workspaces }, (_, index) => storeId(index)),
  ...Array.from({ length: referenceShape.largeStores }, (_, index) => largeStore(index)),
];

/**
 * Righe con un identificativo `cap-` in ogni tabella che porta spazio, negozio, utente o ordine,
 * con un'istruzione per colonna e venti istruzioni per chiamata: D1 limita i termini di una
 * `UNION ALL`.
 */
export function leftoverSql(columns) {
  const blocks = [];
  for (let start = 0; start < columns.length; start += 20)
    blocks.push(
      columns
        .slice(start, start + 20)
        .map(
          ({ t, c }) =>
            `SELECT '${t}.${c}' AS place, count(*) AS n FROM "${t}" WHERE "${c}" LIKE 'cap-%'`,
        )
        .join(";\n"),
    );
  return blocks;
}

async function cleanTest() {
  const [present] = await testQuery(
    `SELECT count(*) AS n FROM orders WHERE store_id LIKE 'cap-s-%'`,
  );
  // Gli ordini si eliminano negozio per negozio: i trigger scrivono le chiavi dei cancellati.
  if (present[0].n > 0)
    for (const store of datasetStores())
      await testQuery(`DELETE FROM orders WHERE store_id = '${store}'`);
  await testQuery(`DELETE FROM deleted_order_keys WHERE store_id LIKE 'cap-s-%';
    DELETE FROM workspaces WHERE id LIKE 'cap-w-%';
    DELETE FROM "user" WHERE id LIKE 'cap-u-%'`);
  const [columns] = await testQuery(`SELECT m.name AS t, p.name AS c
    FROM sqlite_master m, pragma_table_info(m.name) p
    WHERE m.type = 'table' AND m.name NOT LIKE '\\_cf%' ESCAPE '\\' AND m.name <> 'd1_migrations'
      AND p.name IN ('id', 'store_id', 'workspace_id', 'user_id', 'userId', 'order_id')`);
  const left = [];
  for (const sql of leftoverSql(columns))
    left.push(...(await testQuery(sql)).flat().filter(({ n }) => n > 0));
  if (left.length) throw new Error(`Righe sintetiche rimaste: ${JSON.stringify(left)}`);
  return columns.length;
}

/** Sessione di uno spazio sintetico, con l'accesso del sito test. */
async function signIn(base, email, password) {
  const response = await fetch(`${base}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { origin: base, "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error(`Accesso non riuscito: ${response.status}`);
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

/** Richieste, CPU e durata del Worker test e righe della sua D1 in una finestra. */
export const windowQuery = `query ($account: String!, $since: Time!, $until: Time!, $script: String!, $database: String!) {
  viewer { accounts(filter: { accountTag: $account }) {
    workers: workersInvocationsAdaptive(limit: 1, filter: { scriptName: $script, datetime_geq: $since, datetime_leq: $until }) {
      sum { requests errors cpuTimeUs } quantiles { cpuTimeP50 cpuTimeP95 wallTimeP50 wallTimeP95 } }
    d1: d1AnalyticsAdaptiveGroups(limit: 1, filter: { databaseId: $database, datetimeMinute_geq: $since, datetimeMinute_leq: $until }) {
      sum { readQueries writeQueries rowsRead rowsWritten } }
  } }
}`;

async function graphql(query, variables) {
  const response = await fetch("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST",
    headers: { authorization: `Bearer ${analyticsToken()}`, "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const body = await response.json();
  if (!response.ok || body.errors?.length)
    throw new Error(`GraphQL: ${response.status} ${JSON.stringify(body.errors ?? [])}`);
  return body.data;
}

async function readWindow(since, until) {
  const { default: config } = await import("../cloudflare.config.ts");
  const data = await graphql(windowQuery, {
    account: config({ mode: "development" }).worker.env.CLOUDFLARE_ACCOUNT_ID.value,
    since: since.toISOString(),
    until: until.toISOString(),
    script: "fiscalbay-test",
    database: databases.test.id,
  });
  const [account] = data.viewer.accounts;
  return { workers: account.workers[0] ?? null, d1: account.d1[0]?.sum ?? null };
}

/** Dataset nella D1 del test, prove delle pagine sul dominio test e pulizia. */
async function measureRemote() {
  const base = "https://test.fiscalbay.it";
  const shape = { ...referenceShape, now: new Date().toISOString() };
  // Una prova precedente interrotta lascia righe: si ripuliscono prima di ricominciare.
  await cleanTest();
  const password = randomBytes(24).toString("base64url");
  let measured;
  let failure;
  try {
    const seeded = new Date();
    const statements = capacityStatements(shape, legalVersions);
    await testQuery(
      statements.slice(0, statements.length - capacityStoreStatements(shape).length).join(";\n"),
    );
    // Negozi mai dovuti al cron, che non tenta letture con token che non si aprono.
    await testQuery(`UPDATE sync_state SET polled_at = '2099-01-01T00:00:00.000Z' WHERE store_id LIKE 'cap-s-%';
      UPDATE workspaces SET active_at = '${shape.now}' WHERE id LIKE 'cap-w-%'`);
    for (const store of datasetStores())
      await testQuery(
        [...capacityStoreStatements(shape, store), searchIndexStatement(store)].join(";\n"),
      );
    const hash = await hashPassword(password);
    await testQuery(
      Object.values(measuredWorkspaces)
        .map(
          (
            workspace,
          ) => `INSERT INTO "account" (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
            VALUES ('${userOf(workspace)}-password', '${userOf(workspace)}', 'credential', '${userOf(workspace)}', '${hash}', '${shape.now}', '${shape.now}')`,
        )
        .join(";\n"),
    );
    const [[{ n: orders }]] = await testQuery(
      `SELECT count(*) AS n FROM orders WHERE store_id LIKE 'cap-s-%'`,
    );
    const cookies = {};
    for (const [kind, workspace] of Object.entries(measuredWorkspaces))
      cookies[kind] = await signIn(base, `${userOf(workspace)}@example.invalid`, password);
    const started = new Date();
    const latency = await measurePages(base, cookies);
    measured = {
      orders,
      seeding: { from: seeded.toISOString(), to: started.toISOString() },
      window: { from: started.toISOString(), to: new Date().toISOString() },
      latency,
    };
  } catch (error) {
    failure = error;
  }
  try {
    await cleanTest();
  } catch (error) {
    // Le misure restano anche se la pulizia va ripresa con `remote-clean`.
    if (measured)
      writeFileSync(path.join(directory, "remote-partial.json"), JSON.stringify(measured, null, 2));
    throw error;
  }
  if (failure) throw failure;
  return measured;
}

/** Metriche della finestra, lette quando gli analytics le hanno raccolte. */
async function remoteMetrics(remote) {
  // D1 aggrega per minuto: la finestra si allarga ai minuti interi che la contengono.
  const minute = 60_000;
  const window = await readWindow(
    new Date(Math.floor(Date.parse(remote.window.from) / minute) * minute),
    new Date(Math.ceil(Date.parse(remote.window.to) / minute) * minute),
  );
  return { ...remote, metrics: window };
}

/** Consumo dell'account negli ultimi giorni, per Worker, database e coda. */
export const accountQuery = `query ($account: String!, $since: Date!, $until: Date!, $sinceTime: Time!, $untilTime: Time!) {
  viewer { accounts(filter: { accountTag: $account }) {
    workers: workersInvocationsAdaptive(limit: 100, filter: { date_geq: $since, date_leq: $until }) {
      sum { requests errors subrequests cpuTimeUs } dimensions { scriptName } }
    d1: d1AnalyticsAdaptiveGroups(limit: 100, filter: { date_geq: $since, date_leq: $until }) {
      sum { readQueries writeQueries rowsRead rowsWritten } dimensions { databaseId } }
    storage: d1StorageAdaptiveGroups(limit: 100, filter: { date_geq: $since, date_leq: $until }) {
      max { databaseSizeBytes } dimensions { databaseId } }
    queues: queueMessageOperationsAdaptiveGroups(limit: 100, filter: { datetime_geq: $sinceTime, datetime_leq: $untilTime }) {
      sum { billableOperations } dimensions { queueId } }
  } }
}`;

/** Totali dell'account e quota inclusa usata, dal risultato della query. */
export function accountUsage(data) {
  const [account] = data.viewer.accounts;
  const total = (rows, key) => rows.reduce((sum, row) => sum + (row.sum?.[key] ?? 0), 0);
  return {
    workers: account.workers.map(({ dimensions, sum }) => ({
      script: dimensions.scriptName,
      ...sum,
    })),
    d1: account.d1.map(({ dimensions, sum }) => ({ database: dimensions.databaseId, ...sum })),
    totals: {
      requests: { value: total(account.workers, "requests"), quota: included.requests },
      cpuMs: { value: total(account.workers, "cpuTimeUs") / 1000, quota: included.cpuMs },
      d1RowsRead: { value: total(account.d1, "rowsRead"), quota: included.d1RowsRead },
      d1RowsWritten: { value: total(account.d1, "rowsWritten"), quota: included.d1RowsWritten },
      queueOperations: {
        value: total(account.queues, "billableOperations"),
        quota: included.queueOperations,
      },
    },
  };
}

/**
 * Token di sola lettura delle metriche: `CLOUDFLARE_API_TOKEN` oppure la voce del Portachiavi
 * del token del test, con Account Analytics Read sull'account condiviso. Mai stampato.
 */
function analyticsToken() {
  if (process.env.CLOUDFLARE_API_TOKEN) return process.env.CLOUDFLARE_API_TOKEN;
  try {
    return keychain("FiscalBay analytics test");
  } catch {
    throw new Error(
      "Token assente: CLOUDFLARE_API_TOKEN o Portachiavi «FiscalBay analytics test».",
    );
  }
}

export async function readAccount(days) {
  const { default: config } = await import("../cloudflare.config.ts");
  const until = new Date();
  const since = new Date(until.getTime() - days * 86_400_000);
  const date = (at) => at.toISOString().slice(0, 10);
  return accountUsage(
    await graphql(accountQuery, {
      account: config({ mode: "development" }).worker.env.CLOUDFLARE_ACCOUNT_ID.value,
      since: date(since),
      until: date(until),
      sinceTime: since.toISOString(),
      untilTime: until.toISOString(),
    }),
  );
}

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { prebuilt: { type: "boolean" }, days: { type: "string", default: "30" } },
  });
  const [step] = positionals;
  if (step === "account") {
    console.log(JSON.stringify(await readAccount(Number(values.days)), null, 2));
    return;
  }
  if (step === "remote-clean") {
    console.log(`Nessuna riga sintetica nel test: ${await cleanTest()} colonne verificate.`);
    return;
  }
  if (step && !["costs", "latency", "remote"].includes(step))
    throw new Error("Passi: costs, latency, remote, remote-clean, account");
  mkdirSync(directory, { recursive: true });
  const resultsFile = path.join(directory, "results.json");
  const previous = existsSync(resultsFile) ? JSON.parse(readFileSync(resultsFile, "utf8")) : {};
  let results;
  if (step === "remote") {
    const remote = await measureRemote();
    // Gli analytics raccolgono la finestra con qualche minuto di ritardo.
    await sleep(180_000);
    results = { ...previous, remote: await remoteMetrics(remote) };
  } else
    results = {
      ...previous,
      ...(step !== "latency" ? { costs: measureCosts() } : {}),
      ...(step !== "costs" ? { latency: await measureLatency({ prebuilt: values.prebuilt }) } : {}),
    };
  writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  const summary = capacitySummary(results);
  writeFileSync(path.join(directory, "summary.md"), summary);
  console.log(summary);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]))
  await main();
