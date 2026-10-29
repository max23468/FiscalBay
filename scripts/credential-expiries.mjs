#!/usr/bin/env node
/**
 * Registro delle scadenze delle credenziali (§29). La fonte è l'inventario privato, fuori dal
 * checkout: un file JSON con, per ambiente, nomi logici e date di scadenza, mai valori o
 * riferimenti di custodia. Lo script lo convalida, lo confronta con i segreti dichiarati in
 * `cloudflare.config.ts` e con `apply` lo copia nella D1 dell'ambiente, dove la console ne ricava
 * le anomalie: una scadenza entro 45 giorni avvisa l'owner sul Control Center, una voce senza
 * data resta da completare.
 *
 * Forma del file, con `expires` uguale a una data, a `null` se ancora da cercare o a `"never"`
 * per una credenziale che non scade:
 *   { "test": [{ "name": "EBAY_CLIENT_SECRET", "expires": "2027-04-30" }], "live": [] }
 *
 * Uso: node scripts/credential-expiries.mjs [plan|apply] [--mode live] [--local]
 *        [--file <percorso>]
 * Il percorso predefinito è `FISCALBAY_CREDENTIAL_REGISTRY` o
 * `~/.config/fiscalbay/credential-expiries.json`.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import config, { databases } from "../cloudflare.config.ts";
import { executeLocal } from "./local-d1.mjs";

export const warningDays = 45;
const day = 86_400_000;
const namePattern = /^[\p{L}\p{N} _.:'()«»-]{1,80}$/u;

export const defaultFile = () =>
  process.env.FISCALBAY_CREDENTIAL_REGISTRY ??
  path.join(homedir(), ".config", "fiscalbay", "credential-expiries.json");

/** Segreti del Worker dell'ambiente dichiarati in `cloudflare.config.ts`. */
export function declaredSecrets(mode) {
  const { env } = config({ mode: mode === "live" ? "live" : "development" }).worker;
  return Object.entries(env)
    .filter(([, binding]) => binding?.type === "secret")
    .map(([name]) => name)
    .sort();
}

const validDate = (value) =>
  /^\d{4}-\d{2}-\d{2}$/u.test(value) &&
  new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;

/**
 * Voci dell'ambiente dal contenuto del file. Rifiuta il registro intero alla prima voce non
 * valida: un registro copiato a metà nasconderebbe una scadenza.
 */
export function parseRegistry(text, environment) {
  let registry;
  try {
    registry = JSON.parse(text);
  } catch {
    throw new Error("Il registro non è un JSON valido.");
  }
  const entries = registry?.[environment];
  if (!Array.isArray(entries)) throw new Error(`Il registro non ha l'elenco «${environment}».`);
  const seen = new Set();
  return entries.map((entry, index) => {
    const name = typeof entry?.name === "string" ? entry.name.trim() : "";
    if (!namePattern.test(name)) throw new Error(`Voce ${index + 1}: nome logico non valido.`);
    if (seen.has(name)) throw new Error(`Voce ${index + 1}: «${name}» compare due volte.`);
    seen.add(name);
    const { expires } = entry;
    if (
      expires !== null &&
      expires !== "never" &&
      !(typeof expires === "string" && validDate(expires))
    )
      throw new Error(`Voce «${name}»: scadenza non valida, serve AAAA-MM-GG, null o "never".`);
    return { name, expires };
  });
}

/** Stato di ogni voce rispetto a oggi e segreti dichiarati senza voce. */
export function review(entries, secrets, today = new Date()) {
  const start = Date.parse(`${today.toISOString().slice(0, 10)}T00:00:00.000Z`);
  const rows = entries.map((entry) => {
    if (entry.expires === "never") return { ...entry, state: "never" };
    if (entry.expires === null) return { ...entry, state: "undated" };
    const days = Math.round((Date.parse(`${entry.expires}T00:00:00.000Z`) - start) / day);
    return {
      ...entry,
      days,
      state: days <= 0 ? "expired" : days <= warningDays ? "expiring" : "valid",
    };
  });
  const names = new Set(entries.map((entry) => entry.name));
  return { rows, missing: secrets.filter((secret) => !names.has(secret)) };
}

const quote = (value) => (value === null ? "NULL" : `'${String(value).replaceAll("'", "''")}'`);

/**
 * Sostituisce il registro della D1 in un'unica istruzione batch. Le voci che non scadono non
 * entrano; i segreti dichiarati senza voce entrano senza data, così restano segnalati.
 */
export function registrySql(entries, missing, now = new Date()) {
  const at = now.toISOString();
  const rows = [
    ...entries.filter((entry) => entry.expires !== "never"),
    ...missing.map((name) => ({ name, expires: null })),
  ];
  return [
    "DELETE FROM credential_expiries;",
    ...rows.map(
      (row) =>
        `INSERT INTO credential_expiries (name, expires_on, recorded_at) VALUES (${quote(row.name)}, ${quote(row.expires)}, ${quote(at)});`,
    ),
  ].join("\n");
}

const labels = {
  expired: "scaduta",
  expiring: "in scadenza",
  valid: "valida",
  undated: "senza data",
  never: "non scade",
};

export function report(environment, { rows, missing }) {
  const lines = [`Registro delle scadenze · ${environment}`];
  for (const row of rows)
    lines.push(
      `  ${row.name}: ${labels[row.state]}${row.expires && row.expires !== "never" ? ` (${row.expires}, ${row.days} giorni)` : ""}`,
    );
  for (const name of missing)
    lines.push(`  ${name}: segreto del Worker senza voce, entra senza data`);
  const count = (state) => rows.filter((row) => row.state === state).length;
  lines.push(
    `Voci ${rows.length}: ${count("expired")} scadute, ${count("expiring")} entro ${warningDays} giorni, ${count("undated") + missing.length} senza data.`,
  );
  return lines.join("\n");
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      mode: { type: "string" },
      local: { type: "boolean", default: false },
      file: { type: "string" },
    },
  });
  const command = positionals[0] ?? "plan";
  if (!["plan", "apply"].includes(command)) throw new Error(`Comando sconosciuto: ${command}`);
  const environment = values.mode === "live" ? "live" : "test";
  const entries = parseRegistry(readFileSync(values.file ?? defaultFile(), "utf8"), environment);
  const result = review(entries, declaredSecrets(values.mode));
  console.log(report(environment, result));
  if (command === "plan") return;
  const sql = registrySql(entries, result.missing);
  if (values.local) executeLocal(sql);
  else
    execFileSync("pnpm", ["exec", "cf", "d1", "raw", databases[environment].id, "--sql", sql], {
      stdio: ["ignore", "ignore", "inherit"],
    });
  console.log(`Registro copiato su ${databases[environment].name}.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
