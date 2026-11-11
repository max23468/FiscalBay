#!/usr/bin/env node
/**
 * Regole di repository fissate da AGENTS e dal governo della pipeline, sui file versionati e su
 * quelli nuovi non ignorati da Git. Ogni regola riceve l'elenco dei file ({ path, text }) e
 * restituisce gli errori, così i test possono provarla su input sintetici. Nessuna richiesta di
 * rete. `--copy` esegue soltanto la regola sul testo, che il gate dei documenti richiede da sola.
 * Uso: node scripts/verify-repo.mjs [--copy]
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

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
  "api.pwnedpasswords.com",
  "api.cloudflare.com",
  "challenges.cloudflare.com",
  "static.cloudflareinsights.com",
  "cloudflareinsights.com",
  "t.me",
  "www.w3.org",
  "schemas.openxmlformats.org",
  // Indirizzo del negozio negli esempi delle schermate del sito.
  "www.ebay.it",
]);

// Domini email ammessi oltre a `.invalid`, per gli esempi credibili delle schermate del sito:
// gli alias con cui eBay nasconde l'indirizzo e due domini non registrati.
const fixtureEmailDomains = new Set([
  "members.ebay.com",
  "vintagegarageitalia.it",
  "colomborestauri.it",
]);

const isDocumentation = (file) => file.endsWith(".md") || file.startsWith("docs/");
const isAsset = (file) => /\.(?:svg|png|jpe?g|ico|webp|woff2?)$/u.test(file);

/** Sigle di milestone, task e gate ammesse soltanto nella documentazione. */
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
        const name = domain.toLowerCase();
        if (!name.endsWith(".invalid") && !fixtureEmailDomains.has(name))
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

const emDash = String.fromCodePoint(0x2014);
// Entità HTML ed escape Unicode del carattere, composti per non contenerli in questo file.
const encodedEmDash = new RegExp(
  [
    "&md" + "ash;",
    "&#0*" + emDash.codePointAt(0) + ";",
    "&#x0*201" + "4;",
    "\\\\u(?:201" + "4|\\{0*201" + "4\\})",
  ].join("|"),
  "iu",
);

/** Nessun em dash (U+2014), nemmeno codificato, in alcun file di testo della repository. */
export function checkCopy(files) {
  const errors = [];
  for (const { path: file, text } of files)
    for (const [index, line] of text.split("\n").entries())
      if (line.includes(emDash) || encodedEmDash.test(line))
        errors.push(`${file}:${index + 1}: em dash non consentito (U+2014)`);
  return errors;
}

/**
 * Con un diff piccolo alcuni job della CI si saltano, e GitHub salta anche chi dipende da loro
 * salvo una condizione esplicita: i job dopo `Node 26` non devono sparire in silenzio.
 */
export function checkGateJobs(files) {
  const ci = files.find(({ path: file }) => file === ".github/workflows/ci.yml");
  if (!ci) return [];
  const jobs = ci.text.slice(ci.text.indexOf("\njobs:\n")).split(/^(?=  [\w-]+:$)/mu);
  return jobs
    .filter((job) => /^    needs:.*\bgate\b/mu.test(job) && !/^    if:.*!cancelled\(\)/mu.test(job))
    .map((job) => `${ci.path}: «${job.trim().split(":")[0]}» dopo gate senza !cancelled()`);
}

/**
 * Il runner del Mac gira nell'account dell'owner: lo usano soltanto i coordinatori di `cycle.yml`,
 * che eseguono codice di `develop` senza dipendenze, mai i job delle PR o quelli con `pnpm install`.
 */
export function checkSelfHostedRunners(files) {
  const errors = [];
  for (const { path: file, text } of files) {
    if (!/^\.github\/(?:workflows|actions)\/.+\.ya?ml$/u.test(file)) continue;
    if (file === ".github/workflows/cycle.yml") continue;
    for (const [index, line] of text.split("\n").entries())
      if (/self-hosted|fiscalbay-coordinator/u.test(line))
        errors.push(`${file}:${index + 1}: runner del Mac riservato a cycle.yml`);
  }
  return errors;
}

/**
 * Impronte SHA-256 degli indirizzi degli account delle verifiche live, che restano
 * nell'inventario privato (AGENTS): il controllo li riconosce senza scriverli qui.
 */
const privateAddressHashes = new Set([
  "b48ba865305b142dccb2743171b8b490611bef089390a98ea6ad2ce2abe8d2a0",
]);

/** Nessun indirizzo degli account delle verifiche live in file, test, fixture o documenti. */
export function checkPrivateAddresses(files, hashes = privateAddressHashes) {
  const errors = [];
  for (const { path: file, text } of files)
    for (const [index, line] of text.split("\n").entries())
      for (const [address] of line.matchAll(/[\w.%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+/giu))
        if (hashes.has(createHash("sha256").update(address.toLowerCase()).digest("hex")))
          errors.push(`${file}:${index + 1}: indirizzo di un account delle verifiche live`);
  return errors;
}

/** Giorni di anticipo con cui `security.txt` chiede il rinnovo della scadenza (RFC 9116). */
const securityTxtNotice = 30;

/**
 * `security.txt` ha contatto, indirizzo canonico e una scadenza entro un anno: una scadenza
 * vicina ferma il gate prima che il file diventi non valido per chi segnala una vulnerabilità.
 */
export function checkSecurityTxt(files, now = new Date()) {
  const file = files.find(({ path: name }) => name === "public/.well-known/security.txt");
  if (!file) return ["public/.well-known/security.txt: file assente"];
  const field = (name) => file.text.match(new RegExp(`^${name}:\\s*(\\S+)\\s*$`, "mu"))?.[1];
  const errors = [];
  for (const name of ["Contact", "Canonical"])
    if (!field(name)) errors.push(`${file.path}: campo ${name} assente`);
  const expires = Date.parse(field("Expires") ?? "");
  const day = 86_400_000;
  if (Number.isNaN(expires)) errors.push(`${file.path}: campo Expires assente o non valido`);
  else if (expires - now.getTime() < securityTxtNotice * day)
    errors.push(`${file.path}: Expires entro ${securityTxtNotice} giorni, da rinnovare`);
  else if (expires - now.getTime() > 366 * day) errors.push(`${file.path}: Expires oltre un anno`);
  return errors;
}

// Due migration applicate lo stesso giorno con lo stesso numero: i nomi sono registrati.
const sharedMigrationNumbers = new Set(["0084"]);

/** Ogni migration ha un numero proprio: due PR con lo stesso numero si accorgono prima del merge. */
export function checkMigrationNumbers(files, shared = sharedMigrationNumbers) {
  const seen = new Map();
  const errors = [];
  for (const { path: file } of files) {
    const number = file.match(/^migrations\/(\d{4})_/u)?.[1];
    if (!number || shared.has(number)) continue;
    if (seen.has(number)) errors.push(`${file}: numero già usato da ${seen.get(number)}`);
    else seen.set(number, file);
  }
  return errors;
}

export const checks = {
  "sigle di piano": checkPlanCodes,
  "numeri delle migration": (files) => checkMigrationNumbers(files),
  fixture: checkFixtures,
  "moduli server raggiungibili": (files) => checkImports(files),
  "versioni degli strumenti": checkToolPins,
  "Action fissate": checkActionPins,
  "job dopo Node 26": checkGateJobs,
  "runner del Mac": checkSelfHostedRunners,
  "indirizzi privati": (files) => checkPrivateAddresses(files),
  "security.txt": (files) => checkSecurityTxt(files),
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
  const { values } = parseArgs({ options: { copy: { type: "boolean" } } });
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const files = readRepository(root);
  const selected = values.copy ? { "em dash": checkCopy } : checks;
  let failures = 0;
  for (const [name, check] of Object.entries(selected)) {
    const errors = check(files);
    for (const error of errors) console.error(`${name}: ${error}`);
    failures += errors.length;
  }
  if (failures) process.exitCode = 1;
  else
    console.log(
      values.copy
        ? "Copy: nessun em dash nei file della repository."
        : `Repository: ${Object.keys(checks).length} regole rispettate.`,
    );
}
