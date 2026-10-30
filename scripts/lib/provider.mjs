/**
 * Accesso ai provider dagli script: CLI `cf` alla versione fissata, D1 remota, `gh` e
 * Portachiavi macOS. Le opzioni di ogni chiamata restano al chiamante: ambiente, `--mode`,
 * `--zone` e flussi d'uscita.
 */
import { execFileSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

// Elenchi di oggetti R2, eventi e risposte di gh superano il MiB predefinito di execFileSync.
const maxBuffer = 512 << 20;
// Un documento troncato non si rilegge da ogni parentesi interna.
const preambleBrackets = 16;

/**
 * CLI `cf`. `stdout: "ignore"` non raccoglie l'esito, `stderr: "ignore"` tace gli errori delle
 * letture facoltative, `ci` la rende non interattiva.
 */
export function cf(
  args,
  { encoding = "utf8", stdout = "pipe", stderr = "inherit", ci = false } = {},
) {
  return execFileSync("pnpm", ["exec", "cf", ...args], {
    encoding,
    maxBuffer,
    env: ci ? { ...process.env, CI: "true" } : process.env,
    stdio: ["ignore", stdout, stderr],
  });
}

/**
 * Valore JSON nell'uscita della CLI, che può precedere il documento con avvisi o righe di
 * avanzamento: vale il primo `[` o `{` da cui il resto è JSON, entro poche parentesi del
 * preambolo. Toglie l'involucro `result` delle risposte API; `null` se la CLI non stampa JSON,
 * come per l'eliminazione di un segreto.
 */
export function jsonOutput(output) {
  let failure;
  let tries = 0;
  for (const match of output.matchAll(/[[{]/gu)) {
    try {
      const value = JSON.parse(output.slice(match.index));
      return value && !Array.isArray(value) && "result" in value ? value.result : value;
    } catch (error) {
      failure ??= error;
      if (++tries === preambleBrackets) break;
    }
  }
  if (failure) throw new Error(`Uscita JSON della CLI non leggibile: ${failure.message}`);
  return null;
}

export const cfJson = (args, options) => jsonOutput(cf(args, options));

/** Ripete `task` fino a `attempts` volte, attendendo `delay(attempt)` millisecondi fra i tentativi. */
export async function retry(task, { attempts, delay }) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await task();
    } catch (error) {
      if (attempt >= attempts) throw error;
      await sleep(delay(attempt));
    }
  }
}

/**
 * Istruzioni sulla D1 remota con `cf d1 query`; restituisce le righe di ogni istruzione. Con un
 * elenco di istruzioni verifica che ognuna abbia un esito. Un errore dell'API si ripete fino a
 * tre volte, dopo 5 e 10 secondi.
 */
export function d1Query(
  database,
  sql,
  { query = cfJson, delay = (attempt) => attempt * 5000, ...options } = {},
) {
  const statements = Array.isArray(sql) ? sql : null;
  const text = statements ? statements.join(";\n") : sql;
  return retry(
    () => {
      const results = query(["d1", "query", database, "--sql", text], options);
      if (
        !Array.isArray(results) ||
        (statements && results.length !== statements.length) ||
        results.some(({ success }) => !success)
      )
        throw new Error("Risposta D1 incompleta.");
      return results.map(({ results: rows }) => rows);
    },
    { attempts: 3, delay },
  );
}

/** Voce del Portachiavi macOS, senza stampare gli errori di `security`. */
export function keychain(service) {
  return execFileSync("security", ["find-generic-password", "-s", service, "-w"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

/** CLI `gh` con l'uscita ripulita; gli errori arrivano sullo stderr del processo. */
export function gh(...args) {
  return (
    execFileSync("gh", args, {
      encoding: "utf8",
      maxBuffer,
      stdio: ["ignore", "pipe", "inherit"],
    }) ?? ""
  ).trim();
}

export const ghJson = (...args) => JSON.parse(gh(...args));
