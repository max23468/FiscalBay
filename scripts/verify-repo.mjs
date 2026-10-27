#!/usr/bin/env node
/**
 * Regole di repository fissate da AGENTS e dal governo della pipeline.
 * Ogni regola riceve l'elenco dei file ({ path, text }) e restituisce gli errori,
 * così i test possono provarla su input sintetici. Nessuna richiesta di rete.
 * Uso: node scripts/verify-repo.mjs
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Migration già applicate: il nome registrato dal database è un vincolo di compatibilità.
const appliedMigrationNames = new Set(["migrations/0001_m0_slice.sql"]);

// Moduli server senza consumatore runtime, ciascuno con il motivo. Una voce che
// acquista un consumatore va rimossa: il controllo la segnala come superata.
export const pendingServerModules = new Map();

// Host ammessi nelle fixture oltre a `.invalid`: origini del sistema, endpoint
// dei provider chiamati dal codice sotto test, deep link del bot e namespace XML.
const fixtureHosts = new Set([
  "localhost",
  "127.0.0.1",
  "fiscalbay.it",
  "test.fiscalbay.it",
  "api.ebay.com",
  "apiz.ebay.com",
  "auth.ebay.com",
  "api.sandbox.ebay.com",
  "i.ebayimg.com",
  "i.ebayimg.sandbox.ebay.com",
  "api.telegram.org",
  "t.me",
  "www.w3.org",
  "schemas.openxmlformats.org",
]);

const isDocumentation = (file) => file.endsWith(".md") || file.startsWith("docs/");
const isAsset = (file) => /\.(?:svg|png|jpe?g|ico|webp|woff2?)$/u.test(file);

/** Sigle di milestone, task e gate ammesse soltanto nella documentazione di piano. */
export function checkPlanCodes(files) {
  const errors = [];
  const code = /\b(?:M\d{1,2}(?:-\d{2})?|G-[A-Z]{3,})\b/u;
  for (const { path: file, text } of files) {
    if (isDocumentation(file)) continue;
    if (!appliedMigrationNames.has(file) && /(?:^|[/_.-])m\d{1,2}(?:[/_.-]|$)/iu.test(file))
      errors.push(`${file}: sigla di piano nel nome del file`);
    if (isAsset(file) || file === "pnpm-lock.yaml") continue;
    for (const [index, line] of text.split("\n").entries()) {
      const match = line.match(code);
      if (match) errors.push(`${file}:${index + 1}: sigla di piano «${match[0]}»`);
    }
  }
  return errors;
}

/** Fixture e scenari sintetici usano soltanto host `.invalid` o del sistema. */
export function checkFixtures(files) {
  const errors = [];
  const scope = /^(?:test|e2e|benchmarks|app\/preview)\//u;
  for (const { path: file, text } of files) {
    if (!scope.test(file) || isAsset(file)) continue;
    for (const [index, line] of text.split("\n").entries()) {
      for (const [, host] of line.matchAll(/https?:\/\/([a-z0-9.-]+)/giu)) {
        const name = host.toLowerCase();
        if (!name.endsWith(".invalid") && !fixtureHosts.has(name))
          errors.push(`${file}:${index + 1}: host reale «${name}» in una fixture`);
      }
      for (const [, domain] of line.matchAll(
        /[\w.%+-]+@([a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,})\b/giu,
      )) {
        if (!domain.toLowerCase().endsWith(".invalid"))
          errors.push(`${file}:${index + 1}: email con dominio reale «${domain}» in una fixture`);
      }
    }
  }
  return errors;
}

export const importPattern =
  /(?:^|[\s;])(?:import|export)\s+(?:[\w*{}\s,$]+?\s+from\s+)?["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)/gu;

export function resolveImport(from, specifier, known) {
  let target;
  if (specifier.startsWith("~/")) target = `app/${specifier.slice(2)}`;
  else if (specifier.startsWith(".")) target = path.posix.join(path.posix.dirname(from), specifier);
  else return undefined;
  target = target.split("?")[0];
  for (const candidate of [
    target,
    `${target}.ts`,
    `${target}.tsx`,
    `${target}/index.ts`,
    `${target}/index.tsx`,
  ]) {
    if (known.has(candidate)) return candidate;
  }
  return undefined;
}

/** Grafo degli import applicativi (`app/`, `workers/`); i cicli li rifiuta oxlint. */
export function importGraph(files, scope = /^(?:app|workers)\/.+\.tsx?$/u) {
  const sources = new Map(
    files.filter(({ path: file }) => scope.test(file)).map(({ path: file, text }) => [file, text]),
  );
  const graph = new Map();
  for (const [file, text] of sources) {
    const targets = new Set();
    for (const match of text.matchAll(importPattern)) {
      const target = resolveImport(file, match[1] ?? match[2], sources);
      if (target) targets.add(target);
    }
    graph.set(file, targets);
  }
  return graph;
}

/** Ogni modulo server o route ha un consumatore runtime, salvo quelli in attesa motivati. */
export function checkImports(files, pending = pendingServerModules) {
  const graph = importGraph(files);
  const sources = new Map(files.map(({ path: file, text }) => [file, text]));
  const errors = [];
  const routes = sources.get("app/routes.ts") ?? "";
  const entries = [
    "workers/app.ts",
    "app/root.tsx",
    "app/entry.server.tsx",
    "app/routes.ts",
    ...[...routes.matchAll(/["'](routes\/[^"']+)["']/gu)].map(([, route]) => `app/${route}`),
  ].filter((file) => sources.has(file));
  const reachable = new Set();
  const queue = [...entries];
  while (queue.length) {
    const file = queue.pop();
    if (reachable.has(file)) continue;
    reachable.add(file);
    queue.push(...graph.get(file));
  }
  for (const file of sources.keys()) {
    if (!/\.server\.tsx?$/u.test(file) && !file.startsWith("app/routes/")) continue;
    if (reachable.has(file) && pending.has(file))
      errors.push(`${file}: ha un consumatore runtime, rimuoverlo dai moduli in attesa`);
    else if (!reachable.has(file) && !pending.has(file))
      errors.push(`${file}: modulo server senza consumatore runtime`);
  }
  for (const file of pending.keys())
    if (!sources.has(file)) errors.push(`${file}: modulo in attesa inesistente`);
  return errors;
}

/**
 * `mise.toml` serve all'ambiente locale e ripete le versioni del manifest; la CI le legge
 * direttamente da `package.json` tramite `.github/actions/setup`.
 */
export function checkToolPins(files) {
  const byPath = new Map(files.map(({ path: file, text }) => [file, text]));
  const mise = byPath.get("mise.toml") ?? "";
  const manifest = JSON.parse(byPath.get("package.json") ?? "{}");
  const errors = [];
  if (manifest.engines?.node !== mise.match(/^node\s*=\s*"([^"]+)"/mu)?.[1])
    errors.push(`mise.toml: node diverso da engines.node ${manifest.engines?.node}`);
  if (manifest.packageManager !== `pnpm@${mise.match(/^pnpm\s*=\s*"([^"]+)"/mu)?.[1]}`)
    errors.push(`mise.toml: pnpm diverso da packageManager ${manifest.packageManager}`);
  return errors;
}

/** Ogni Action esterna è fissata allo SHA completo, con la versione in commento. */
export function checkActionPins(files) {
  const errors = [];
  for (const { path: file, text } of files) {
    if (!/^\.github\/(?:workflows|actions)\/.+\.ya?ml$/u.test(file)) continue;
    for (const [index, line] of text.split("\n").entries()) {
      const uses = line.match(/^\s*(?:-\s+)?uses:\s*(\S+)(.*)$/u);
      if (!uses || uses[1].startsWith("./")) continue;
      if (!/@[0-9a-f]{40}$/u.test(uses[1]) || !/^\s+#\s*v\d/u.test(uses[2]))
        errors.push(
          `${file}:${index + 1}: «${uses[1]}» non fissata a SHA con versione in commento`,
        );
    }
  }
  return errors;
}

export const checks = {
  "sigle di piano": checkPlanCodes,
  fixture: checkFixtures,
  "moduli server raggiungibili": (files) => checkImports(files),
  "versioni degli strumenti": checkToolPins,
  "Action fissate": checkActionPins,
};

function readRepository(root) {
  return execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
    cwd: root,
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean)
    .flatMap((file) => {
      try {
        const contents = readFileSync(path.join(root, file));
        return contents.includes(0) ? [] : [{ path: file, text: contents.toString("utf8") }];
      } catch (error) {
        if (error.code === "ENOENT" || error.code === "EISDIR") return [];
        throw error;
      }
    });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const files = readRepository(root);
  let failures = 0;
  for (const [name, check] of Object.entries(checks)) {
    const errors = check(files);
    for (const error of errors) console.error(`${name}: ${error}`);
    failures += errors.length;
  }
  if (failures) process.exitCode = 1;
  else console.log(`Repository: ${Object.keys(checks).length} regole rispettate.`);
}
