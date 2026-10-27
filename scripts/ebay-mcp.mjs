#!/usr/bin/env node
/**
 * Avvia il server MCP di eBay per gli agenti di sviluppo, soltanto in modalità applicazione:
 * specifiche, metadati e API pubbliche, mai dati dei venditori o degli acquirenti. Legge il
 * keyset Production dal Portachiavi macOS senza scriverlo in file o argomenti.
 * Uso: node scripts/ebay-mcp.mjs (dalla configurazione MCP del client)
 */
import { execFileSync, spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

export const serverPackage = "@ebay/npm-public-api-mcp@1.1.0";
export const keychainItems = {
  clientId: "FiscalBay eBay Production Client ID",
  clientSecret: "FiscalBay eBay Production Client Secret",
};

/** Comando e ambiente del server: nessuna variabile eBay ereditata, nessun token utente. */
export function serverCommand({ clientId, clientSecret }, environment = process.env) {
  if (!clientId?.trim() || !clientSecret?.trim()) throw new Error("missing_keyset");
  const inherited = Object.fromEntries(
    Object.entries(environment).filter(([name]) => !name.startsWith("EBAY_")),
  );
  return {
    command: "npx",
    args: ["--yes", serverPackage],
    options: {
      // Il server carica il `.env` della cartella di avvio: mai quello del checkout.
      cwd: tmpdir(),
      stdio: "inherit",
      env: {
        ...inherited,
        npm_config_ignore_scripts: "true",
        EBAY_CLIENT_ID: clientId.trim(),
        EBAY_CLIENT_SECRET: clientSecret.trim(),
        EBAY_TOKEN_TYPE: "application",
        EBAY_API_ENV: "production",
      },
    },
  };
}

function keychain(service) {
  return execFileSync("security", ["find-generic-password", "-s", service, "-w"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let command;
  try {
    command = serverCommand({
      clientId: keychain(keychainItems.clientId),
      clientSecret: keychain(keychainItems.clientSecret),
    });
  } catch {
    process.stderr.write(
      "Server MCP eBay non avviato: keyset Production assente dal Portachiavi (solo sul Mac).\n",
    );
    process.exit(1);
  }
  const child = spawn(command.command, command.args, command.options);
  child.on("exit", (code, signal) => process.exit(signal ? 1 : (code ?? 1)));
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
}
