#!/usr/bin/env node
/**
 * Sceglie il livello del gate dai file modificati, uguale in locale e in CI:
 * - `docs`: documentazione ordinaria e suo archivio, `pnpm verify:documents`;
 * - `tooling`: governo, script, workflow e configurazioni degli strumenti, `pnpm verify:tooling`;
 * - `unit`: test applicativi e loro configurazione, `pnpm verify:unit`;
 * - `build`: prove browser e loro strumenti, controllo del bundle, soli valori testuali delle
 *   variabili del Worker test, `pnpm verify:build`;
 * - `full`: ogni altro file, un diff vuoto o un confronto non disponibile, `pnpm verify`.
 * La sequenza di ogni livello esiste soltanto negli script di package.json; ogni livello comprende
 * il precedente. Il classificatore sceglie anche le prove browser e il deploy test.
 * Uso: node scripts/classify-changes.mjs [--base REF --head REF] [--complete] [--github-output] [--run]
 * Senza --base confronta il checkout, file non tracciati inclusi, con origin/develop.
 */
import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criticalModule } from "./mutation.mjs";
import { importGraph } from "./verify-repo.mjs";

/** Script di package.json eseguito da ciascun livello, dal più leggero. */
export const levelScripts = {
  docs: "verify:documents",
  tooling: "verify:tooling",
  unit: "verify:unit",
  build: "verify:build",
  full: "verify",
};
const levels = Object.keys(levelScripts);

/** Configurazione dei Worker: i soli valori del test hanno un livello proprio. */
export const configFile = "cloudflare.config.ts";

// Il governo contiene i gate Production letti dagli script: richiede anche i loro test.
const governance = /^(?:AGENTS\.md|CLAUDE\.md|docs\/MASTER_PLAN\.md|docs\/engineering\/.+)$/u;

// Strumenti che non entrano nella build, nei test applicativi o nelle prove browser.
const tooling = [
  /^\.github\//u,
  /^\.claude\//u,
  /^scripts\/.+\.test\.mjs$/u,
  /^scripts\/(?:verify-(?:copy|docs|repo|pages)|classify-changes|benchmark|coverage-report|mutation(?:-vitest)?|find-(?:build|deployed)|reset-test-account|watch-invocations|release\/release(?:-notes|-cycle)?)\.mjs$/u,
  /^benchmarks\//u,
  /^(?:\.oxfmtrc\.json|\.oxlintrc\.json|knip\.json|stryker\.config\.json|vitest\.(?:benchmark|mutation)\.config\.ts)$/u,
];

// Test applicativi: non entrano nell'artefatto né nelle prove browser.
const unit = /^(?:test\/|vitest(?:\.(?:cloudflare|unit))?\.config\.ts$)/u;

// Prove browser e loro strumenti: provano la build ma non cambiano l'artefatto distribuito.
const browser =
  /^(?:e2e\/|playwright\.config\.ts$|scripts\/(?:browser-tests|local-preview)\.mjs$)/u;

/**
 * Vero se le due versioni della configurazione differiscono soltanto nei valori
 * `bindings.text("...")` dentro `vars` del Worker test. Nomi, righe aggiunte o tolte, binding,
 * risorse, commenti e il target `live` restano fuori: nel dubbio il confronto fallisce.
 */
export function testVariablesOnly(before, after) {
  if (typeof before !== "string" || typeof after !== "string" || before === after) return false;
  const masked = [before, after].map(maskTestValues);
  return masked[0] !== undefined && masked[0] === masked[1];
}

function maskTestValues(text) {
  const lines = text.split("\n");
  const names = lines.flatMap((line, index) =>
    line.trim() === 'name: "fiscalbay-test",' ? [index] : [],
  );
  if (names.length !== 1) return undefined;
  const start = lines.findIndex((line, index) => index > names[0] && line.trim() === "vars: {");
  const end = lines.findIndex((line, index) => index > start && /^\s*\},?$/u.test(line));
  if (start === -1 || end === -1) return undefined;
  return lines
    .map((line, index) =>
      index > start && index < end
        ? line.replace(/^(\s*[A-Z][A-Z0-9_]*: bindings\.text\()"(?:[^"\\]|\\.)*"(\),)$/u, '$1""$2')
        : line,
    )
    .join("\n");
}

/**
 * Livello di un file ed effetti sulle prove browser e sul deploy test. `change` contiene le due
 * versioni di `cloudflare.config.ts`, quando il confronto le rende disponibili.
 */
export function fileImpact(file, change) {
  if (file.startsWith("docs/archive/") || (file.endsWith(".md") && !governance.test(file)))
    return { level: "docs", e2e: false, deploy: false };
  if (governance.test(file) || tooling.some((pattern) => pattern.test(file)))
    return { level: "tooling", e2e: false, deploy: false };
  if (unit.test(file)) return { level: "unit", e2e: false, deploy: false };
  if (browser.test(file)) return { level: "build", e2e: true, deploy: false };
  if (file === "scripts/check-bundle-size.mjs")
    return { level: "build", e2e: false, deploy: false };
  // Il collaudo remoto dopo il deploy prova le variabili nell'ambiente reale.
  if (file === configFile && testVariablesOnly(change?.before, change?.after))
    return { level: "build", e2e: false, deploy: true };
  return { level: "full", e2e: true, deploy: true };
}

/** Livello minimo di un singolo file. */
export const fileLevel = (file, change) => fileImpact(file, change).level;

/** Chiusura inversa: un consumatore di un modulo modificato cambia con esso. */
function consumers(files, graph) {
  const affected = new Set(files);
  let grew = true;
  while (grew) {
    grew = false;
    for (const [file, imports] of graph) {
      if (!affected.has(file) && [...imports].some((target) => affected.has(target))) {
        affected.add(file);
        grew = true;
      }
    }
  }
  return affected;
}

const areaPatterns = {
  orders: "ordini|ordine|orders|idratazione",
  stores: "negozi|negozio|stores",
  settings: "impostazioni|settings|superfici",
  profile: "profilo|profile",
  auth: "accesso|sicurezza|security|auth|admin|idratazione",
  public: "pubblico|standalone|public|termini|privacy",
};

/**
 * Controlli per i file modificati; `complete` qualifica il candidato sul diff cumulativo.
 * `changes` associa a `cloudflare.config.ts` le versioni prima e dopo.
 */
export function plan(files, sources = [], complete = false, changes = {}) {
  const impacts = files.map((file) => fileImpact(file, changes[file]));
  // Un diff vuoto o non disponibile e il candidato eseguono tutto.
  const everything = complete || files.length === 0;
  const gate = everything
    ? "full"
    : levels[Math.max(...impacts.map(({ level }) => levels.indexOf(level)))];
  const product = files.filter((_, index) => ["build", "full"].includes(impacts[index].level));
  const e2e = everything || impacts.some((impact) => impact.e2e);
  // Un diff vuoto distribuisce; prove e soli strumenti no.
  const deploy = files.length === 0 || impacts.some((impact) => impact.deploy);

  const graph = importGraph(sources);
  const affected = consumers(files, graph);
  const areas = new Set();
  for (const route of [...affected].filter((file) => file.startsWith("app/routes/"))) {
    if (/orders|home/u.test(route)) areas.add("orders");
    // Ordini e accesso condividono la pagina; il sito pubblico è `site.tsx`.
    if (route.endsWith("/home.tsx")) areas.add("auth");
    if (/stores|store-link/u.test(route)) areas.add("stores");
    if (/settings/u.test(route)) areas.add("settings");
    if (/profile/u.test(route)) areas.add("profile");
    if (/security|admin|auth|sign-in/u.test(route)) areas.add("auth");
    if (/legal|site|robots/u.test(route)) areas.add("public");
  }
  // Una selezione per area vale soltanto per moduli applicativi risolti fino alle route.
  const targeted =
    e2e &&
    !complete &&
    areas.size > 0 &&
    product.every(
      (file) =>
        graph.has(file) &&
        !/^app\/(?:root\.tsx|routes\.ts|entry\.server|app-copy|app-links|app\.css|components\/(?:ui\/|app-shell|account))/u.test(
          file,
        ),
    );
  const browserGrep = targeted
    ? [
        "app-shell.spec",
        "app-components.spec",
        "@smoke",
        ...[...areas].map((area) => areaPatterns[area]),
      ].join("|")
    : ".";
  const browsers = !e2e
    ? ""
    : !targeted ||
        areas.has("auth") ||
        files.some((file) => /i18n|view-models|date|\.tsx$/u.test(file))
      ? "chromium,webkit"
      : "chromium";
  // Soltanto il candidato esegue mutation: moduli critici modificati e loro consumatori critici.
  // PR e push non ne eseguono; la campagna settimanale prova tutti i moduli critici.
  const critical = (file) => (sources.length === 0 || graph.has(file)) && criticalModule(file);
  const mutation = complete ? [...consumers(files.filter(critical), graph)].filter(critical) : [];
  return {
    gate,
    script: levelScripts[gate],
    e2e,
    build: gate === "build" || gate === "full",
    deploy,
    areas: [...areas].sort(),
    browserGrep,
    browsers,
    promotionReuse: !files.some(
      (file) =>
        /^scripts\/(?:classify-changes|release\/release(?:-notes)?|find-build)\.mjs$/u.test(file) ||
        /^\.github\/(?:actions\/|workflows\/(?:ci|mutation|publish|qualify|promotion)\.yml$)/u.test(
          file,
        ),
    ),
    mutation,
  };
}

const git = (...args) => execFileSync("git", args, { encoding: "utf8" });
const lines = (text) => text.split("\n").filter(Boolean);

function committedChanges(base, head) {
  if (!base || !head || /^0+$/u.test(base)) return [];
  try {
    return lines(git("diff", "--name-only", base, head));
  } catch {
    console.log(`Confronto ${base}...${head} non disponibile: gate completo.`);
    return [];
  }
}

function localChanges() {
  const mergeBase = git("merge-base", "origin/develop", "HEAD").trim();
  return [
    ...new Set([
      ...lines(git("diff", "--name-only", mergeBase)),
      ...lines(git("ls-files", "--others", "--exclude-standard")),
    ]),
  ];
}

// Versione di un file a un commit; `undefined` se manca o il confronto non è disponibile.
function show(ref, file) {
  try {
    return execFileSync("git", ["show", `${ref}:${file}`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return undefined;
  }
}

function run(command, args, env = {}) {
  console.log(`\n$ ${command} ${args.join(" ")}`);
  execFileSync(command, args, { stdio: "inherit", env: { ...process.env, ...env } });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const option = (name) => {
    const index = args.indexOf(name);
    return index === -1 ? undefined : args[index + 1] || undefined;
  };
  // Base vuota, a zeri o non raggiungibile (avvio manuale, nuovo branch, storia riscritta):
  // il diff resta vuoto e il gate completo.
  const committed = args.includes("--base");
  const files = committed ? committedChanges(option("--base"), option("--head")) : localChanges();
  const before = committed ? option("--base") : git("merge-base", "origin/develop", "HEAD").trim();
  const changes = files.includes(configFile)
    ? {
        [configFile]: {
          before: show(before, configFile),
          after: committed
            ? show(option("--head"), configFile)
            : existsSync(configFile)
              ? readFileSync(configFile, "utf8")
              : undefined,
        },
      }
    : {};
  const sources = lines(git("ls-files", "--cached", "--others", "--exclude-standard"))
    .filter((file) => /^(?:app|workers)\/.+\.tsx?$/u.test(file) && existsSync(file))
    .map((file) => ({ path: file, text: readFileSync(file, "utf8") }));
  const result = plan(files, sources, args.includes("--complete"), changes);

  for (const file of files) console.log(`${fileLevel(file, changes[file])}: ${file}`);
  const summary = `Gate ${result.gate} (\`pnpm ${result.script}\`); browser: ${result.e2e ? `${result.browsers}, grep ${result.browserGrep}` : "no"}; deploy test: ${result.deploy ? "sì" : "no"}; mutation: ${result.mutation.join(", ") || "nessuna"}.`;
  console.log(summary);
  if (args.includes("--github-output") && process.env.GITHUB_OUTPUT)
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `gate=${result.gate}\ne2e=${result.e2e}\nbuild=${result.build}\ndeploy=${result.deploy}\npromotion-reuse=${result.promotionReuse}\ngrep=${result.browserGrep}\nbrowsers=${result.browsers}\nmutation=${result.mutation.join(" ")}\nmutation-matrix=${JSON.stringify({ target: result.mutation })}\n`,
    );
  if (process.env.GITHUB_STEP_SUMMARY && !args.includes("--gate-only"))
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Piano dei controlli\n\n${summary}\n`);
  if (args.includes("--json")) console.log(JSON.stringify(result));

  if (args.includes("--run")) {
    run("pnpm", [result.script]);
    if (result.e2e && !args.includes("--gate-only"))
      run(
        "node",
        ["scripts/browser-tests.mjs", "--grep", result.browserGrep, "--browsers", result.browsers],
        { E2E_PREBUILT: "1" },
      );
  }
}
