import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

/**
 * Cartella della Build Output scritta dal plugin Cloudflare. Il nome porta la versione del formato
 * (`v0`, `v1`, ...), che cambia con il plugin: si ricava da quella presente. Senza build
 * restituisce `undefined`; più formati insieme indicano un'uscita mescolata.
 *
 * @param {string} [base]
 */
export function buildOutput(base = ".cloudflare/output") {
  if (!existsSync(base)) return undefined;
  const versions = readdirSync(base).filter((name) => /^v\d+$/u.test(name));
  if (versions.length > 1)
    throw new Error(`Build Output con più formati in ${base}: ${versions.join(", ")}.`);
  return versions[0] && path.join(base, versions[0]);
}
