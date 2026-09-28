#!/usr/bin/env node
/**
 * Budget del JavaScript client: somma gzip di tutti i file .js della build client.
 * La build fallisce oltre il budget; rivedere il valore solo con una motivazione.
 * Uso: node scripts/check-bundle-size.mjs [cartella]
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

export const budgetKiB = 350;

/** Byte gzip dei file JavaScript sotto `directory`, dal più pesante. */
export function measure(directory) {
  return readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.m?js$/u.test(entry.name))
    .map((entry) => {
      const file = path.join(entry.parentPath, entry.name);
      return { file, bytes: gzipSync(readFileSync(file)).length };
    })
    .toSorted((a, b) => b.bytes - a.bytes);
}

const kib = (bytes) => (bytes / 1024).toFixed(1);

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const files = measure(process.argv[2] ?? "build/client");
  const total = files.reduce((sum, { bytes }) => sum + bytes, 0);
  if (files.length === 0) {
    console.error("Nessun JavaScript client trovato: la build non è stata prodotta.");
    process.exit(1);
  }
  const summary = `JavaScript client: ${kib(total)} KiB gzip su ${budgetKiB} KiB, ${files.length} file.`;
  if (total > budgetKiB * 1024) {
    console.error(`${summary} Budget superato. File più pesanti:`);
    for (const { file, bytes } of files.slice(0, 5)) console.error(`  ${kib(bytes)} KiB ${file}`);
    process.exit(1);
  }
  console.log(summary);
}
