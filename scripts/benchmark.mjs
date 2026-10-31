#!/usr/bin/env node
/**
 * Misure locali dei percorsi applicativi, eseguite a richiesta e fuori dal gate.
 * Tre esecuzioni in sequenza con un solo processo Vitest; il riepilogo riporta mediana e
 * intervallo delle medie. Non misurano CPU, latenza o capacità del Worker remoto.
 * Uso: pnpm benchmark
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repetitions = 3;

export function benchmarkSummary(samples) {
  const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  const names = Object.keys(samples).sort();
  if (
    !names.length ||
    names.some(
      (name) =>
        !Array.isArray(samples[name]) ||
        !samples[name].length ||
        samples[name].some((value) => !Number.isFinite(value) || value <= 0),
    )
  )
    throw new Error("Misure benchmark mancanti o non valide.");
  return [
    "### Benchmark applicativi",
    "",
    "Tempi locali senza copertura; non misurano CPU, latenza o capacità del Worker remoto.",
    "",
    "| Percorso | Mediana ms | Intervallo ms |",
    "|---|---:|---:|",
    ...names.map((name) => {
      const values = samples[name];
      return `| ${name} | ${median(values).toFixed(4)} | ${Math.min(...values).toFixed(4)} - ${Math.max(...values).toFixed(4)} |`;
    }),
    "",
  ].join("\n");
}

function main() {
  const directory = "reports/benchmarks";
  const raw = path.join(directory, "raw");
  rmSync(directory, { recursive: true, force: true });
  mkdirSync(directory, { recursive: true });
  const samples = {};
  for (let repeat = 0; repeat < repetitions; repeat++) {
    rmSync(raw, { recursive: true, force: true });
    execFileSync(
      "pnpm",
      ["exec", "vitest", "bench", "--run", "--config", "vitest.benchmark.config.ts"],
      {
        stdio: "inherit",
        env: { ...process.env, DO_NOT_TRACK: "1" },
      },
    );
    for (const file of readdirSync(raw).filter((name) => name.endsWith(".json")))
      (samples[file.slice(0, -5)] ??= []).push(
        JSON.parse(readFileSync(path.join(raw, file), "utf8")).latency.mean,
      );
  }
  if (Object.values(samples).some((values) => values.length !== repetitions))
    throw new Error("Raccolta benchmark incompleta.");
  const summary = benchmarkSummary(samples);
  writeFileSync(path.join(directory, "summary.md"), summary);
  console.log(summary);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
