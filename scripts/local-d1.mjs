/**
 * D1 locale sullo stato che usano anche `vite dev` e `vite preview`.
 * Temporaneo: `cf --local` stampa l'esito ma non termina (cloudflare/cf#64, cloudflare/cf#25),
 * quindi qui resta Wrangler, con una configurazione minima ricavata da `cloudflare.config.ts`.
 * Da rimuovere quando `cf d1 ... --local` termina da solo.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { databases } from "../cloudflare.config.ts";

const state = ".cloudflare/state";
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
          database_name: databases.test.name,
          database_id: databases.test.id,
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

export const applyLocalMigrations = () =>
  wrangler(["d1", "migrations", "apply", databases.test.name]);

/** @param {string} sql */
export const executeLocal = (sql) =>
  wrangler(["d1", "execute", databases.test.name, "--command", sql]);
