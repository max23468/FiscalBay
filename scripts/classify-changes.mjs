#!/usr/bin/env node
/**
 * Sceglie il livello del gate dai file modificati, uguale in locale e in CI:
 * - `docs`: documentazione ordinaria, `pnpm verify:documents`;
 * - `tooling`: governo, script, workflow e configurazioni degli strumenti, `pnpm verify:tooling`;
 * - `full`: ogni altro file, un diff vuoto o un confronto non disponibile, `pnpm verify`.
 * La sequenza di ogni livello esiste soltanto negli script di package.json. Nel livello completo
 * il classificatore sceglie anche le prove browser e il deploy test.
 * Uso: node scripts/classify-changes.mjs [--base REF --head REF] [--complete] [--github-output] [--run]
 * Senza --base confronta il checkout, file non tracciati inclusi, con origin/develop.
 */
import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criticalModule } from "./mutation.mjs";
import { importGraph } from "./verify-repo.mjs";

/** Script di package.json eseguito da ciascun livello. */
export const levelScripts = { docs: "verify:documents", tooling: "verify:tooling", full: "verify" };

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

/** Livello minimo di un singolo file. */
export function fileLevel(file) {
  if (file.endsWith(".md") && !governance.test(file)) return "docs";
  if (governance.test(file) || tooling.some((pattern) => pattern.test(file))) return "tooling";
  return "full";
}

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

/** Controlli per i file modificati; `complete` qualifica il candidato sul diff cumulativo. */
export function plan(files, sources = [], complete = false) {
  const levels = new Set(files.map(fileLevel));
  const gate =
    complete || files.length === 0 || levels.has("full")
      ? "full"
      : levels.has("tooling")
        ? "tooling"
        : "docs";
  const product = files.filter((file) => fileLevel(file) === "full");
  // Le sole prove unitarie non toccano browser né artefatto distribuito.
  const unitOnly =
    !complete && product.length > 0 && product.every((file) => file.startsWith("test/"));
  const e2e = gate === "full" && !unitOnly;
  // Un diff vuoto distribuisce; prove e soli strumenti no.
  const deploy =
    gate === "full" &&
    (files.length === 0 || product.some((file) => !/^(?:test|e2e)\//u.test(file)));

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
    product
      .filter((file) => !file.startsWith("test/"))
      .every(
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
    build: gate === "full",
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
  const files = args.includes("--base")
    ? committedChanges(option("--base"), option("--head"))
    : localChanges();
  const sources = lines(git("ls-files", "--cached", "--others", "--exclude-standard"))
    .filter((file) => /^(?:app|workers)\/.+\.tsx?$/u.test(file) && existsSync(file))
    .map((file) => ({ path: file, text: readFileSync(file, "utf8") }));
  const result = plan(files, sources, args.includes("--complete"));

  for (const file of files) console.log(`${fileLevel(file)}: ${file}`);
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
