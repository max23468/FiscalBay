#!/usr/bin/env node
/**
 * Durata misurata di ogni file Vitest, dal report JSON di `vitest run --reporter=json`. Il
 * sequencer di `vitest.config.ts` la legge da `test/durations.json` per dividere gli shard della CI
 * in parti di durata simile; un file assente vale come la mediana dei presenti.
 *
 * Uso: node scripts/vitest-durations.mjs <report.json> [destinazione]
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Il report può venire da un'altra macchina, per esempio dagli shard della CI uniti con `vitest
 * --merge-reports`: il percorso conta da `test/`, non dalla cartella di chi lo legge.
 */
export function durations(report) {
  const entries = report.testResults.map((file) => {
    const name = file.name.split(path.sep).join("/");
    const relative = /(?:^|\/)(test\/.+)$/u.exec(name)?.[1];
    if (!relative) throw new Error(`File di test fuori da test/: ${file.name}`);
    return [relative, Math.round((file.endTime - file.startTime) / 100) / 10];
  });
  return Object.fromEntries(entries.toSorted(([a], [b]) => (a < b ? -1 : 1)));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [source, target = "test/durations.json"] = process.argv.slice(2);
  if (!source) throw new Error("Indicare il report JSON di Vitest.");
  const result = durations(JSON.parse(readFileSync(source, "utf8")));
  writeFileSync(target, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`${Object.keys(result).length} file in ${target}.`);
}
