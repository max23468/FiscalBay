#!/usr/bin/env node
/**
 * Esegue un comando registrando con `wrangler tail` le invocazioni del Worker, e ne salva
 * un riepilogo senza header, cookie né query string: metodo, percorso, stato, esito, tempi,
 * eccezioni e fasi tracciate dal collaudo. Serve a distinguere una richiesta appesa nel Worker da una mai arrivata.
 * Uso: node scripts/watch-invocations.mjs --worker NOME --output FILE -- COMANDO [ARGOMENTI]
 */
import { spawn } from "node:child_process";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

/** Separa gli oggetti JSON concatenati che `wrangler tail --format json` scrive su stdout. */
export function jsonObjects() {
  let buffer = "";
  return (chunk) => {
    buffer += chunk;
    const objects = [];
    let depth = 0;
    let start = 0;
    let inString = false;
    let escaped = false;
    for (let index = 0; index < buffer.length; index++) {
      const char = buffer[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === '"') inString = false;
      } else if (char === '"') inString = true;
      else if (char === "{" && depth++ === 0) start = index;
      else if (char === "}" && --depth === 0) {
        objects.push(JSON.parse(buffer.slice(start, index + 1)));
        buffer = buffer.slice(index + 1);
        index = -1;
      }
    }
    return objects;
  };
}

/** Invocazioni oltre questo tempo totale sono segnalate come lente. */
export const slowWallMs = 10_000;

/** Riepilogo ripulito delle invocazioni e di quelle lente o fallite. */
export function summarize(events) {
  const invocations = events
    .filter((event) => event.event?.request?.url)
    .map((event) => {
      const url = new URL(event.event.request.url);
      return {
        at: event.eventTimestamp ? new Date(event.eventTimestamp).toISOString() : undefined,
        method: event.event.request.method,
        path: url.pathname,
        status: event.event.response?.status,
        outcome: event.outcome,
        wallMs: event.wallTime,
        cpuMs: event.cpuTime,
        exceptions: (event.exceptions ?? []).map(({ name, message }) => `${name}: ${message}`),
        phases: (event.logs ?? []).flatMap(({ message }) =>
          (message ?? []).flatMap((entry) => {
            try {
              const parsed = JSON.parse(entry);
              return parsed?.event === "phase" ? [String(parsed.phase)] : [];
            } catch {
              return [];
            }
          }),
        ),
      };
    });
  const anomalies = invocations.filter(
    (entry) =>
      entry.outcome !== "ok" ||
      entry.exceptions.length > 0 ||
      !(entry.status < 500) ||
      entry.wallMs > slowWallMs,
  );
  return { total: invocations.length, anomalies, invocations };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const separator = process.argv.indexOf("--");
  if (separator === -1) throw new Error("Manca il comando dopo --.");
  const { values } = parseArgs({
    args: process.argv.slice(2, separator),
    options: { worker: { type: "string" }, output: { type: "string" } },
  });
  if (!values.worker || !values.output) throw new Error("Servono --worker e --output.");
  const [command, ...args] = process.argv.slice(separator + 1);

  const events = [];
  const parse = jsonObjects();
  const tail = spawn("pnpm", ["exec", "wrangler", "tail", values.worker, "--format", "json"], {
    stdio: ["ignore", "pipe", "ignore"],
  });
  tail.stdout.setEncoding("utf8");
  tail.stdout.on("data", (chunk) => events.push(...parse(chunk)));
  // Il tail non segnala la connessione: un margine fisso prima del comando osservato.
  await sleep(10_000);

  const code = await new Promise((resolve) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("exit", (status) => resolve(status ?? 1));
  });
  // Gli eventi arrivano qualche secondo dopo la fine dell'invocazione.
  await sleep(10_000);
  tail.kill();

  const summary = summarize(events);
  mkdirSync(path.dirname(values.output), { recursive: true });
  writeFileSync(values.output, JSON.stringify(summary, null, 2));
  const lines = [
    `Invocazioni ${values.worker}: ${summary.total}, anomalie ${summary.anomalies.length}`,
    ...summary.anomalies.map(
      (entry) =>
        `- ${entry.at ?? ""} ${entry.method} ${entry.path}: ${entry.status ?? "senza risposta"}, ${entry.outcome}, ${entry.wallMs} ms totali, ${entry.cpuMs} ms CPU${entry.exceptions.length ? `, ${entry.exceptions.join("; ")}` : ""}${entry.phases.length ? `, fasi ${entry.phases.join(" > ")}` : ""}`,
    ),
  ];
  console.log(lines.join("\n"));
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join("\n")}\n`);
  process.exitCode = code;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
