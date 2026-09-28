#!/usr/bin/env node
/**
 * Mutation test mirati: esegue Stryker soltanto sui file o intervalli indicati
 * e fallisce per ogni mutante non ucciso. Timeout ed errori non valgono come
 * successo; un'equivalenza si motiva con un commento `Stryker disable` e resta
 * nel report come ignorata.
 * Uso: node scripts/mutation.mjs <file[:inizio-fine]>...
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const accepted = new Set(["Killed", "Ignored"]);

/** Mutanti che fanno fallire la prova, dal report JSON di Stryker. */
export function evaluate(report) {
  const mutants = Object.entries(report.files ?? {}).flatMap(([file, { mutants }]) =>
    mutants.map((mutant) => ({ file, ...mutant })),
  );
  if (mutants.length === 0) return ["nessun mutante generato"];
  return mutants
    .filter(
      ({ status, statusReason }) =>
        !accepted.has(status) || (status === "Ignored" && !statusReason),
    )
    .map(
      ({ file, location, mutatorName, status }) =>
        `${file}:${location.start.line}:${location.start.column + 1}: ${mutatorName} ${status}`,
    );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const targets = process.argv.slice(2);
  if (targets.length === 0) {
    console.error("Uso: node scripts/mutation.mjs <file[:inizio-fine]>...");
    process.exit(2);
  }
  const report = "reports/mutation/mutation.json";
  execFileSync("pnpm", ["exec", "stryker", "run", "--mutate", targets.join(",")], {
    stdio: "inherit",
  });
  const failures = evaluate(JSON.parse(readFileSync(report, "utf8")));
  for (const failure of failures) console.error(`Mutante non ucciso: ${failure}`);
  if (failures.length) process.exitCode = 1;
  else console.log("Mutation: tutti i mutanti uccisi o motivati.");
}
