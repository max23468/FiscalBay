#!/usr/bin/env node
/**
 * Worker del bot Telegram (`telegram-worker/`), separato dal Worker principale perché le tracce
 * di quest'ultimo registrano l'indirizzo delle chiamate in uscita e la Bot API vuole il token nel
 * percorso (D293). Cambia di rado e non passa dal ciclo di pubblicazione.
 *
 * - `deploy` costruisce il Worker e lo distribuisce con il segreto `TELEGRAM_BOT_TOKEN`, letto
 *   dalla variabile del solo comando (per esempio dal Portachiavi), poi rilegge;
 * - `readback` controlla che il Worker esista senza domini, con il segreto, e che il Worker
 *   principale lo raggiunga con il binding `TELEGRAM`.
 *
 * Il primo deploy precede quello del Worker principale con il binding.
 *
 * Uso: [TELEGRAM_BOT_TOKEN=…] node scripts/telegram-worker.mjs <deploy|readback> [--mode live]
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import telegramConfig from "../telegram-worker/cloudflare.config.ts";
import config from "../cloudflare.config.ts";
import * as provider from "./lib/provider.mjs";

const root = path.resolve(fileURLToPath(import.meta.url), "../../telegram-worker");

/** Worker del bot e Worker principale distribuito dell'ambiente, dalle due configurazioni. */
export function targetOf(mode) {
  const live = mode === "live";
  const bot = telegramConfig({ mode: live ? "live" : "production" }).worker;
  const main = config({ mode: live ? "live" : "production" }).worker;
  return { live, worker: bot.name, main: main.name, binding: main.env.TELEGRAM?.worker };
}

/** Voci del readback da quanto letto con la CLI. */
export function checkWorker(target, state) {
  const worker = state.workers?.find(({ name }) => name === target.worker);
  return [
    {
      item: `Worker ${target.worker} senza domini`,
      ok: Boolean(worker) && (worker.references?.domains ?? []).length === 0,
    },
    {
      item: "segreto TELEGRAM_BOT_TOKEN",
      ok: Boolean(state.secrets?.includes("TELEGRAM_BOT_TOKEN")),
    },
    { item: `binding TELEGRAM di ${target.main}`, ok: target.binding === target.worker },
  ];
}

function readState(target) {
  return {
    workers: provider.optionalJson(["workers", "list"]),
    secrets: provider
      .optionalJson(["workers", "secrets", "list", "--worker", target.worker])
      ?.map(({ name }) => name),
  };
}

function deploy(target) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) throw new Error("Serve TELEGRAM_BOT_TOKEN dell'ambiente.");
  const mode = target.live ? "live" : "production";
  execFileSync("pnpm", ["exec", "vite", "build", "--mode", mode, "--config", "vite.config.ts"], {
    cwd: root,
    stdio: "inherit",
  });
  const directory = mkdtempSync(path.join(tmpdir(), "telegram-worker-"));
  const secrets = path.join(directory, "secrets.json");
  try {
    writeFileSync(secrets, JSON.stringify({ TELEGRAM_BOT_TOKEN: token }), { mode: 0o600 });
    execFileSync(
      "pnpm",
      ["exec", "cf", "deploy", "--prebuilt", "--mode", mode, "--secrets-file", secrets],
      { cwd: root, stdio: ["ignore", "inherit", "inherit"] },
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { mode: { type: "string" } },
  });
  const [command] = positionals;
  if (!["deploy", "readback"].includes(command)) throw new Error("Comandi: deploy, readback");
  const target = targetOf(provider.modeOf(values.mode, "test"));
  if (command === "deploy") deploy(target);
  const results = checkWorker(target, readState(target));
  for (const { item, ok } of results) console.log(`${ok ? "ok" : "da guardare"}  ${item}`);
  if (results.some(({ ok }) => !ok)) process.exitCode = 1;
}
