#!/usr/bin/env node
/**
 * Guardia dopo un deploy: per i minuti indicati legge il sito reale e gli incidenti della console.
 * Fallisce per un incidente P1 aperto dopo l'avvio o per tre letture di fila senza risposta valida:
 * il workflow torna allora alla versione precedente, se compatibile, e avvisa l'owner.
 * Uso: node scripts/release/guard.mjs --mode live --minutes 5
 */
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { readFileSync } from "node:fs";

import { reconcileReceipt, releaseProvider, saveReceipt } from "./release.mjs";

/** Letture consecutive non riuscite che valgono come servizio fermo. */
export const failureLimit = 3;

/** Incidenti gravi aperti dopo l'avvio della guardia: quelli già aperti non dipendono dal deploy. */
export const newIncidents = (rows, baseline) =>
  rows.filter(
    ({ key, severity, opened_at: opened }) =>
      severity === "p1" &&
      !baseline.some(
        (prior) => prior.key === key && prior.severity === "p1" && prior.opened_at === opened,
      ),
  );

/** Esito di una lettura del sito: una pagina e la sessione anonima rispondono senza errori. */
export async function siteHealthy(origin, read = fetch, expectedVersion) {
  try {
    const [page, session] = await Promise.all(
      ["/", "/api/auth/get-session"].map((pathname) =>
        read(`${origin}${pathname}`, {
          headers: { "cache-control": "no-cache" },
          signal: AbortSignal.timeout(20000),
        }),
      ),
    );
    return (
      page.ok &&
      session.ok &&
      (!expectedVersion ||
        [page, session].every(
          (response) => response.headers.get("x-fiscalbay-version") === expectedVersion,
        )) &&
      (await session.json()) === null
    );
  } catch {
    return false;
  }
}

/**
 * Giri di osservazione: `incidents` e `healthy` leggono lo stato, `pause` separa i giri. Restituisce
 * il motivo dell'allarme, oppure `undefined` se il periodo si chiude senza segnali.
 */
export async function watch({ deadline, baseline, healthy, incidents, pause, now = Date.now }) {
  if (!Number.isFinite(deadline) || !Array.isArray(baseline))
    throw new Error("Finestra o baseline della guardia assente.");
  let failures = 0;
  for (;;) {
    failures = (await healthy()) ? 0 : failures + 1;
    if (failures >= failureLimit) return `${failures} letture del sito non riuscite`;
    const opened = newIncidents(await incidents(), baseline);
    if (opened.length) return `incidenti P1: ${opened.map(({ kind }) => kind).join(", ")}`;
    if (now() >= deadline) return undefined;
    await pause(Math.min(60_000, deadline - now()));
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      mode: { type: "string" },
      minutes: { type: "string", default: "5" },
      "expected-sha": { type: "string" },
    },
  });
  if (values.mode !== "live" || !/^[a-f0-9]{40}$/u.test(values["expected-sha"] ?? ""))
    throw new Error("Guardia Production senza candidato atteso.");
  const minutes = Number(values.minutes);
  if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 60)
    throw new Error("Durata della guardia non valida.");
  const receipt = JSON.parse(readFileSync("reports/release.json", "utf8"));
  if (receipt.sha !== values["expected-sha"] || !Array.isArray(receipt.incidentBaseline))
    throw new Error("Ricevuta o baseline del candidato assente.");
  const remote = releaseProvider("production");
  const io = {
    current: remote.currentVersion,
    readback: remote.liveReadback,
    schema: async () => (await remote.applied()).map((name) => ({ name })),
    save: saveReceipt,
  };
  let state = await reconcileReceipt(receipt, io);
  if (state.guardPassed) return;
  state = { ...state, guardStartedAt: state.guardStartedAt ?? new Date().toISOString() };
  saveReceipt(state);
  const reason = await watch({
    deadline: Date.now() + minutes * 60_000,
    baseline: state.incidentBaseline,
    healthy: () => siteHealthy("https://fiscalbay.it", fetch, state.version),
    incidents: remote.incidents,
    pause: sleep,
  });
  if (reason) throw new Error(`Guardia non superata: ${reason}.`);
  state = await reconcileReceipt(state, io);
  saveReceipt({ ...state, guardPassed: true, guardCompletedAt: new Date().toISOString() });
  console.log("Guardia superata: nessun incidente nuovo, sito raggiungibile.");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]))
  await main();
