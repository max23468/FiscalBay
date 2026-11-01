/**
 * D1 locale sullo stato che usano anche `vite dev` e `vite preview`.
 * Temporaneo: `cf --local` stampa l'esito ma non termina (cloudflare/cf#64, cloudflare/cf#25),
 * quindi qui resta Wrangler, con una configurazione minima ricavata da `cloudflare.config.ts`.
 * Da rimuovere quando `cf d1 ... --local` termina da solo.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { databases } from "../cloudflare.config.ts";

const state = ".cloudflare/state";
// Il collaudo Production locale serve la build live, legata alla D1 Production: il suo stato
// locale riceve le stesse migration, senza account sintetici.
export const database = process.env.E2E_PRODUCTION === "1" ? databases.live : databases.test;
const config = ".cloudflare/local-d1.json";

/** @param {string[]} args */
function wrangler(args) {
  mkdirSync(path.dirname(config), { recursive: true });
  writeFileSync(
    config,
    JSON.stringify({
      name: "fiscalbay-test",
      compatibility_date: "2026-09-13",
      d1_databases: [
        {
          binding: "DB",
          database_name: database.name,
          database_id: database.id,
          migrations_dir: path.resolve("migrations"),
        },
      ],
    }),
  );
  execFileSync(
    "pnpm",
    ["exec", "wrangler", ...args, "--local", "--config", config, "--persist-to", state],
    { env: { ...process.env, CI: "1" }, stdio: ["ignore", "ignore", "inherit"] },
  );
}

export const applyLocalMigrations = () => wrangler(["d1", "migrations", "apply", database.name]);

/**
 * Istruzioni dal file temporaneo: un solo argomento ha un limite di lunghezza (128 KiB su Linux)
 * che gli account sintetici superano. In locale il file non sospende il database come in remoto.
 * Wrangler apre lo stato da un altro processo: mentre la preview serve le prove si scrive con
 * `writeLocalDatabase` di `e2e/local-account.ts`.
 * @param {string} sql
 */
export function executeLocal(sql) {
  const directory = mkdtempSync(path.join(tmpdir(), "fiscalbay-d1-"));
  const file = path.join(directory, "statements.sql");
  writeFileSync(file, sql);
  try {
    wrangler(["d1", "execute", database.name, "--file", file]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

// `node scripts/local-d1.mjs migrate` prima di `vite preview`: le pagine pubbliche leggono la D1 già
// dalla risposta che Playwright attende all'avvio.
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  if (process.argv[2] !== "migrate") throw new Error("Comando non supportato.");
  applyLocalMigrations();
}
