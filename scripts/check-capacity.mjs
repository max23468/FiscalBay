#!/usr/bin/env node
/**
 * Capacità misurata al deploy test: traffico sintetico marcato, CPU delle sole
 * invocazioni marcate raccolta via `wrangler tail`, fallimento oltre il p95
 * ammesso, con errori o con eventi mancanti. In CI l'esito è un avviso, non un blocco (D148).
 * Le route interrogate non chiamano eBay, Stripe o Telegram.
 * Uso: node scripts/check-capacity.mjs --url URL --worker NOME [--max-p95 MS] [--requests GIRI_PER_ROUTE]
 */
import { execFileSync, spawn } from "node:child_process";
import { appendFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";

// Limite CPU per richiesta di Workers Free, l'assetto scelto (decisione owner D146).
export const maxP95Ms = 10;
export const probeHeader = "x-capacity-probe";
const warmupRounds = 10;
// Pagine pubbliche, sessione assente e Auth senza cookie: nessun provider esterno.
export const probePaths = ["/", "/en", "/auth/error", "/api/auth/get-session"];

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

/** p95 con rango più vicino. */
export function percentile95(values) {
  const sorted = values.toSorted((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * 0.95) - 1];
}

/** Esito sugli eventi delle richieste misurate. */
export function evaluate(events, { sent, maxP95 }) {
  const failures = [];
  if (events.length < sent) failures.push(`eventi ricevuti ${events.length} su ${sent} richieste`);
  const errors = events.filter(
    (event) =>
      event.outcome !== "ok" ||
      event.exceptions?.length > 0 ||
      !(event.event?.response?.status < 500),
  );
  if (errors.length > 0) failures.push(`${errors.length} invocazioni con errore`);
  const p95 = events.length > 0 ? percentile95(events.map((event) => event.cpuTime)) : undefined;
  if (p95 === undefined || !(p95 <= maxP95)) failures.push(`CPU p95 ${p95} ms oltre ${maxP95} ms`);
  return { ok: failures.length === 0, p95, failures };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(condition, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) return false;
    await sleep(500);
  }
  return true;
}

async function main() {
  const { values } = parseArgs({
    options: {
      url: { type: "string" },
      worker: { type: "string" },
      "max-p95": { type: "string", default: String(maxP95Ms) },
      requests: { type: "string", default: "50" },
    },
  });
  if (!values.url || !values.worker) throw new Error("Servono --url e --worker.");
  const maxP95 = Number(values["max-p95"]);
  const rounds = Number(values.requests);

  const status = JSON.parse(
    execFileSync(
      "pnpm",
      ["exec", "wrangler", "deployments", "status", "--name", values.worker, "--json"],
      {
        encoding: "utf8",
      },
    ),
  );
  const version = status.versions.find((entry) => entry.percentage === 100)?.version_id;
  if (!version) throw new Error("Nessuna versione distribuita al 100%: misura non attendibile.");

  const token = crypto.randomUUID();
  const events = { warmup: [], measure: [] };
  const tail = spawn(
    "pnpm",
    [
      "exec",
      "wrangler",
      "tail",
      values.worker,
      "--format",
      "json",
      "--header",
      probeHeader,
      "--version-id",
      version,
    ],
    { stdio: ["ignore", "pipe", "inherit"] },
  );
  const parse = jsonObjects();
  tail.stdout.setEncoding("utf8");
  tail.stdout.on("data", (chunk) => {
    for (const event of parse(chunk)) {
      const marker = event.event?.request?.headers?.[probeHeader];
      if (marker === `${token}:warmup`) events.warmup.push(event);
      else if (marker === token) events.measure.push(event);
    }
  });

  const request = async (path, marker) => {
    const response = await fetch(new URL(path, values.url), { headers: { [probeHeader]: marker } });
    await response.arrayBuffer();
  };

  try {
    // Il tail non segnala la connessione: le richieste di riscaldamento la provano
    // e scaldano gli isolate appena distribuiti, senza entrare nella misura. Con
    // meno giri gli avvii a freddo spostano il p95 da una misura all'altra.
    const deadline = Date.now() + 90_000;
    while (events.warmup.length < probePaths.length * warmupRounds && Date.now() < deadline) {
      for (const path of probePaths) await request(path, `${token}:warmup`);
      await sleep(500);
    }
    if (events.warmup.length === 0)
      throw new Error("Tail non collegato: nessun evento di riscaldamento.");

    for (let round = 0; round < rounds; round++)
      for (const path of probePaths) await request(path, token);
    const sent = rounds * probePaths.length;
    await waitFor(() => events.measure.length >= sent, 30_000);

    const result = evaluate(events.measure, { sent, maxP95 });
    const receipt = [
      `Capacità ${values.worker}: ${result.ok ? "superata" : "non superata"}`,
      `- versione ${version}`,
      `- eventi ${events.measure.length} su ${sent} richieste, route ${probePaths.join(" ")}`,
      `- CPU p95 ${result.p95} ms, soglia ${maxP95} ms`,
      ...result.failures.map((failure) => `- ${failure}`),
    ].join("\n");
    console.log(receipt);
    if (process.env.GITHUB_STEP_SUMMARY)
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${receipt}\n`);
    process.exitCode = result.ok ? 0 : 1;
  } finally {
    tail.kill();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
