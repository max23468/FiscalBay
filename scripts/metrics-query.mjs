#!/usr/bin/env node
/**
 * Query riproducibili delle metriche tecniche su Workers Analytics Engine, con le stesse query
 * della console (`app/metrics-queries.ts`), e prova del campione controllato: invia al report
 * del browser un numero noto di misure sintetiche e confronta conteggio e quantili stimati con
 * quelli attesi. Le query passano dal profilo della CLI `cf`, quindi nessun token passa da qui.
 *
 * Uso: node scripts/metrics-query.mjs <invocations|phases|pages> [--mode live] [--hours 24]
 *      node scripts/metrics-query.mjs sample [--count 40] [--wait 120]
 * Il campione si invia soltanto al test: la Production non riceve misure sintetiche.
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { maxWindowHours, metricQueries, metricSql } from "../app/metrics-queries.ts";
import config from "../cloudflare.config.ts";

/** Pronta delle misure sintetiche: oltre ogni caricamento reale, entro il massimo accettato. */
export const sampleReadyBase = 119_000;

/** Dataset e origine dell'ambiente, letti da `cloudflare.config.ts` come nella build. */
export function targetOf(mode) {
  const { env } = config({ mode: mode === "live" ? "live" : "development" }).worker;
  return { dataset: env.METRICS_DATASET.value, origin: env.APP_ORIGIN.value };
}

/** Report sintetici: TTFB da 1 a `count` ms e pronta riconoscibile, pagina Negozi. */
export function sampleReports(count) {
  return Array.from({ length: count }, (_, index) => ({
    page: "stores",
    ttfb: index + 1,
    ready: sampleReadyBase + index + 1,
    server: {},
  }));
}

/** Istante nel formato della SQL API, al secondo. */
const sqlTime = (date) => date.toISOString().slice(0, 19).replace("T", " ");

/**
 * Query del campione: soltanto i report della finestra di invio con la pronta sintetica, con
 * conteggio pesato, righe conservate e mediana pesata del TTFB.
 */
export function sampleSql(dataset, from, to) {
  if (!/^[a-z][a-z0-9_]{0,62}$/u.test(dataset)) throw new Error("INVALID_DATASET");
  return `SELECT
  SUM(_sample_interval) AS reports,
  count() AS rows,
  quantileExactWeighted(0.5)(double1, _sample_interval) AS ttfb_p50_ms
FROM ${dataset}
WHERE blob1 = 'page' AND blob3 = 'stores' AND double4 > ${sampleReadyBase}
  AND timestamp >= toDateTime('${sqlTime(from)}') AND timestamp <= toDateTime('${sqlTime(to)}')
FORMAT JSON`;
}

/** Confronto con l'atteso: conteggio esatto quando nulla è campionato, mediana entro un report. */
export function compareSample(count, row) {
  const reports = Number(row?.reports ?? 0);
  const rows = Number(row?.rows ?? 0);
  const median = Number(row?.ttfb_p50_ms ?? Number.NaN);
  const expectedMedian = Math.ceil(count / 2);
  return {
    expected: { reports: count, ttfbP50: expectedMedian },
    observed: { reports, rows, ttfbP50: median },
    // Campionato se le righe conservate sono meno dei report stimati.
    sampled: rows < reports,
    ok: reports === count && Math.abs(median - expectedMedian) <= 1,
  };
}

function query(sql) {
  const output = execFileSync(
    "pnpm",
    ["exec", "cf", "analytics-engine", "sql", "query", "--body", sql],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    },
  );
  return JSON.parse(output.slice(output.indexOf("{")));
}

async function sendSample(origin, count) {
  for (const report of sampleReports(count)) {
    const response = await fetch(`${origin}/api/v1/page-timing`, {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify(report),
    });
    if (response.status !== 204) throw new Error(`Report rifiutato: ${response.status}`);
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
  if (!metricQueries.includes(name))
    throw new Error(`Query: ${[...metricQueries, "sample"].join(", ")}`);
  const hours = Number(values.hours);
  if (!Number.isInteger(hours) || hours < 1 || hours > maxWindowHours)
    throw new Error(`--hours fra 1 e ${maxWindowHours}`);
  const result = query(metricSql(name, target.dataset, hours));
  console.log(JSON.stringify({ dataset: target.dataset, hours, rows: result.data }, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]))
  await main();
