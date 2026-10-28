#!/usr/bin/env node
/**
 * Query riproducibili delle metriche tecniche su Workers Analytics Engine, con le stesse query
 * della console (`app/metrics-queries.ts`), e prova del campione controllato: invia al test un
 * numero noto di richieste anonime riconoscibili e confronta il conteggio stimato, pesato con
 * `_sample_interval`, con quello atteso. `cpu` legge dai Workers Logs il tempo CPU delle pagine.
 * Le query passano dal profilo della CLI `cf`, quindi nessun token passa da qui.
 *
 * Uso: node scripts/metrics-query.mjs <invocations|phases|pages> [--mode live] [--hours 24]
 *      node scripts/metrics-query.mjs cpu [--mode live] [--hours 24]
 *      node scripts/metrics-query.mjs sample [--count 40] [--wait 120]
 * Il campione si invia soltanto al test: la Production non riceve richieste sintetiche.
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import {
  cpuKinds,
  cpuPages,
  cpuValues,
  maxCpuWindowHours,
  maxWindowHours,
  metricQueries,
  metricSql,
  pageCpuQuery,
  samplePath,
} from "../app/metrics-queries.ts";
import config from "../cloudflare.config.ts";

export { samplePath };

/** Dataset, Worker e origine dell'ambiente, letti da `cloudflare.config.ts` come nella build. */
export function targetOf(mode) {
  const { env } = config({ mode: mode === "live" ? "live" : "development" }).worker;
  return {
    dataset: env.METRICS_DATASET.value,
    service: env.WORKER_NAME.value,
    origin: env.APP_ORIGIN.value,
  };
}

/** Istante nel formato della SQL API, al secondo. */
const sqlTime = (date) => date.toISOString().slice(0, 19).replace("T", " ");

/**
 * Query del campione: soltanto le invocazioni della finestra di invio con la classe `sample`,
 * che il Worker dà alla sola richiesta del campione, con conteggio pesato e righe conservate.
 */
export function sampleSql(dataset, from, to) {
  if (!/^[a-z][a-z0-9_]{0,62}$/u.test(dataset)) throw new Error("INVALID_DATASET");
  return `SELECT
  SUM(_sample_interval * double1) AS requests,
  count() AS rows
FROM ${dataset}
WHERE blob1 = 'invocation' AND blob2 = 'http' AND blob3 = 'sample' AND blob4 = 'HEAD'
  AND blob5 = '4xx'
  AND timestamp >= toDateTime('${sqlTime(from)}') AND timestamp <= toDateTime('${sqlTime(to)}')
FORMAT JSON`;
}

/** Confronto con l'atteso: il conteggio stimato coincide con le richieste inviate. */
export function compareSample(count, row) {
  const requests = Number(row?.requests ?? 0);
  const rows = Number(row?.rows ?? 0);
  return {
    expected: { requests: count },
    observed: { requests, rows },
    // Campionato se le righe conservate sono meno delle richieste stimate.
    sampled: rows < requests,
    ok: requests === count,
  };
}

function cf(args) {
  const output = execFileSync("pnpm", ["exec", "cf", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  return JSON.parse(output.slice(output.indexOf("{")));
}

const query = (sql) => cf(["analytics-engine", "sql", "query", "--body", sql]);

/** Tempo CPU delle pagine, documento e dati, dai Workers Logs del Worker dell'ambiente. */
function readCpu(service, hours) {
  return cpuPages.flatMap(({ page }) =>
    cpuKinds.map((kind) => {
      const result = cf([
        "o11y",
        "telemetry",
        "query",
        "--body",
        JSON.stringify(pageCpuQuery(service, page, kind, hours)),
      ]);
      // La CLI restituisce il risultato della API, con o senza l'involucro `result`.
      return { page, kind, ...cpuValues((result.result ?? result).calculations) };
    }),
  );
}

async function sendSample(origin, count) {
  for (let index = 0; index < count; index++) {
    const response = await fetch(`${origin}${samplePath}`, { method: "HEAD" });
    if (response.status !== 405) throw new Error(`Risposta inattesa: ${response.status}`);
  }
}

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      mode: { type: "string" },
      hours: { type: "string", default: "24" },
      count: { type: "string", default: "40" },
      wait: { type: "string", default: "120" },
    },
  });
  const [name] = positionals;
  const target = targetOf(values.mode);
  if (name === "sample") {
    if (values.mode === "live")
      throw new Error("Il campione controllato si invia soltanto al test.");
    const count = Number(values.count);
    if (!Number.isInteger(count) || count < 1 || count > 1000)
      throw new Error("--count fra 1 e 1000");
    const from = new Date(Date.now() - 1000);
    await sendSample(target.origin, count);
    const to = new Date(Date.now() + 1000);
    // I punti diventano interrogabili dopo qualche decina di secondi.
    await sleep(Number(values.wait) * 1000);
    const result = query(sampleSql(target.dataset, from, to));
    const comparison = compareSample(count, result.data?.[0]);
    console.log(
      JSON.stringify(
        { window: { from: from.toISOString(), to: to.toISOString() }, ...comparison },
        null,
        2,
      ),
    );
    process.exitCode = comparison.ok ? 0 : 1;
    return;
  }
  const hours = Number(values.hours);
  if (name === "cpu") {
    if (!Number.isInteger(hours) || hours < 1 || hours > maxCpuWindowHours)
      throw new Error(`--hours fra 1 e ${maxCpuWindowHours}`);
    console.log(
      JSON.stringify(
        { service: target.service, hours, rows: readCpu(target.service, hours) },
        null,
        2,
      ),
    );
    return;
  }
  if (!metricQueries.includes(name))
    throw new Error(`Query: ${[...metricQueries, "cpu", "sample"].join(", ")}`);
  if (!Number.isInteger(hours) || hours < 1 || hours > maxWindowHours)
    throw new Error(`--hours fra 1 e ${maxWindowHours}`);
  const result = query(metricSql(name, target.dataset, hours));
  console.log(JSON.stringify({ dataset: target.dataset, hours, rows: result.data }, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]))
  await main();
