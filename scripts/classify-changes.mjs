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
 * Uso: node scripts/classify-changes.mjs [--base REF --head REF] [--complete] [--all] [--github-output] [--json] [--run [--gate-only]]
 * Senza --base confronta il checkout, file non tracciati inclusi, con l'ultimo verde locale di
 * `--run` nello stesso worktree, oppure con origin/develop se manca o con `--all`.
 */
import { execFileSync } from "node:child_process";
import {
  appendFileSync,
  copyFileSync,
  readFileSync,
  existsSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { criticalModule } from "./mutation.mjs";
import { migrationEntry, requiredReview } from "./release/release.mjs";
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
  /^\.agents\//u,
  /^\.codex\//u,
  /^\.mcp\.json$/u,
  /^scripts\/.+\.test\.mjs$/u,
  /^scripts\/(?:verify-(?:docs|repo|pages)|classify-changes|benchmark|capacity|coverage-report|mutation(?:-vitest|-reuse)?|find-(?:build|deployed)|reset-test-account|site-screenshots|stripe-account|telegram-bot|metrics-query|log-archive|zone-protection|credential-expiries|watch-invocations|ebay-mcp|ebay-notifications|recovery|release\/release(?:-notes|-cycle)?|lib\/provider)\.mjs$/u,
  /^benchmarks\//u,
  /^(?:\.oxfmtrc\.json|\.oxlintrc\.json|knip\.json|stryker\.config\.json|vitest\.(?:benchmark|capacity|mutation)\.config\.ts)$/u,
];

// Test applicativi: non entrano nell'artefatto né nelle prove browser.
const unit = /^(?:test\/|vitest(?:\.(?:cloudflare|unit))?\.config\.ts$)/u;

// Spec browser: una spec modificata seleziona se stessa; gli altri file di `e2e/` servono a tutte.
const browserSpec = /^e2e\/([^/]+\.spec)\.ts$/u;

// Prove browser e loro strumenti, compreso il D1 locale dell'account sintetico: provano la build
// ma non cambiano l'artefatto distribuito.
const browser =
  /^(?:e2e\/|playwright\.config\.ts$|scripts\/(?:browser-tests|local-preview|local-d1)\.mjs$)/u;

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
  // Gli avvisi delle licenze sono un file statico dell'artefatto: cambia ciò che si distribuisce.
  if (file === "scripts/third-party-notices.mjs")
    return { level: "build", e2e: false, deploy: true };
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
  const e2e = everything || impacts.some((impact) => impact.e2e);
  // Un diff vuoto distribuisce; prove e soli strumenti no.
  const deploy = files.length === 0 || impacts.some((impact) => impact.deploy);

  // Moduli che cambiano ciò che le prove browser visitano; le spec si selezionano per nome.
  const product = files.filter((file, index) => impacts[index].e2e && !browserSpec.test(file));
  const specs = files.flatMap((file) => browserSpec.exec(file)?.[1] ?? []);

  const graph = importGraph(sources);
  const affected = consumers(files, graph);
  const areas = new Set();
  for (const route of [...affected].filter((file) => file.startsWith("app/routes/"))) {
    if (/orders|home/u.test(route)) areas.add("orders");
    // Ordini e accesso condividono la pagina; il sito pubblico è `site.tsx`.
    if (route.endsWith("/home.tsx")) areas.add("auth");
    if (/stores|store-link/u.test(route)) areas.add("stores");
    if (/settings|whats-new/u.test(route)) areas.add("settings");
    if (/profile/u.test(route)) areas.add("profile");
    if (/security|admin|auth|sign-in/u.test(route)) areas.add("auth");
    if (/legal|site|robots|support/u.test(route)) areas.add("public");
  }
  // Una selezione per area vale soltanto per moduli applicativi risolti fino alle route; senza
  // moduli applicativi bastano le spec modificate.
  const resolved = product.every(
    (file) =>
      graph.has(file) &&
      !/^app\/(?:root\.tsx|routes\.ts|entry\.server|app-copy|app-links|app\.css|components\/(?:ui\/|app-shell|account))/u.test(
        file,
      ),
  );
  const targeted =
    e2e && !complete && (product.length ? areas.size > 0 && resolved : specs.length > 0);
  const browserGrep = targeted
    ? [
        ...(product.length
          ? ["app-shell.spec", "@smoke", ...[...areas].map((area) => areaPatterns[area])]
          : []),
        ...specs,
      ].join("|")
    : ".";
  // Una spec modificata gira come nel candidato, in entrambi i browser.
  const browsers = !e2e
    ? ""
    : !targeted ||
        specs.length > 0 ||
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
        /^scripts\/(?:classify-changes|release\/release(?:-notes)?|find-build|lib\/provider)\.mjs$/u.test(
          file,
        ) ||
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

function localChanges(mergeBase) {
  return [
    ...new Set([
      ...lines(git("diff", "--name-only", mergeBase)),
      ...lines(git("ls-files", "--others", "--exclude-standard")),
    ]),
  ];
}

/** Tree dell'intero checkout, file non tracciati compresi, senza toccare l'indice del worktree. */
function checkoutTree() {
  const directory = mkdtempSync(path.join(tmpdir(), "verify-changed-"));
  const env = { ...process.env, GIT_INDEX_FILE: path.join(directory, "index") };
  try {
    const index = git("rev-parse", "--git-path", "index").trim();
    if (existsSync(index)) copyFileSync(index, env.GIT_INDEX_FILE);
    execFileSync("git", ["add", "--all"], { env });
    return execFileSync("git", ["write-tree"], { env, encoding: "utf8" }).trim();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

// Ultimo tree verde del gate locale, per worktree; un tree non più presente vale come assente.
const greenFile = () => git("rev-parse", "--git-path", "verify-changed.json").trim();
function lastGreen() {
  try {
    const { tree } = JSON.parse(readFileSync(greenFile(), "utf8"));
    execFileSync("git", ["cat-file", "-e", `${tree}^{tree}`], { stdio: "ignore" });
    return tree;
  } catch {
    return undefined;
  }
}

/** Se le modifiche fra due commit richiedono il deploy test, secondo lo stesso piano della CI. */
export function needsDeploy(base, head) {
  const files = committedChanges(base, head);
  const changes = files.includes(configFile)
    ? { [configFile]: { before: show(base, configFile), after: show(head, configFile) } }
    : {};
  return plan(files, [], false, changes).deploy;
}

/**
 * Migration già presenti nella base e diverse dalla versione con cui sono entrate nella storia, o
 * eliminate: il deploy confronta le migration applicate con quella versione e rifiuta ogni
 * differenza, anche di un commento, quindi il gate la ferma prima della PR. Un ripristino della
 * versione originale passa. `before` legge la versione originale, `after` quella del diff.
 */
export function editedMigrations(files, before, after) {
  return files.filter((file) => {
    if (!/^migrations\/.+\.sql$/u.test(file)) return false;
    const previous = before(file);
    return previous !== undefined && previous !== after(file);
  });
}

// Versione con cui un file è entrato nella storia di un commit; `undefined` se non c'è.
function original(ref, file) {
  if (show(ref, file) === undefined) return undefined;
  const added = git("log", "--diff-filter=A", "--format=%H", "-1", ref, "--", file).trim();
  return added ? show(added, file) : undefined;
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
  const { values: args } = parseArgs({
    options: {
      base: { type: "string" },
      head: { type: "string" },
      all: { type: "boolean" },
      complete: { type: "boolean", default: false },
      "github-output": { type: "boolean" },
      "gate-only": { type: "boolean" },
      json: { type: "boolean" },
      run: { type: "boolean" },
    },
  });
  const option = (name) => args[name] || undefined;
  // Base vuota, a zeri o non raggiungibile (avvio manuale, nuovo branch, storia riscritta):
  // il diff resta vuoto e il gate completo.
  const committed = args.base !== undefined;
  const mergeBase = committed ? undefined : git("merge-base", "origin/develop", "HEAD").trim();
  // In locale una nuova verifica prova soltanto ciò che è cambiato dall'ultimo verde.
  const tree = committed ? undefined : checkoutTree();
  const green = committed || args.all || args.complete ? undefined : lastGreen();
  if (green && green === tree) {
    console.log("Nessuna modifica dall'ultimo verde locale: nessun controllo da ripetere.");
    process.exit(0);
  }
  const files = committed
    ? committedChanges(option("base"), option("head"))
    : green
      ? lines(git("diff", "--name-only", green, tree))
      : localChanges(mergeBase);
  const before = committed ? option("base") : (green ?? mergeBase);
  const edited = editedMigrations(
    files,
    (file) => original(committed ? option("base") : mergeBase, file),
    (file) =>
      committed
        ? show(option("head"), file)
        : existsSync(file)
          ? readFileSync(file, "utf8")
          : undefined,
  );
  if (edited.length > 0)
    throw new Error(
      `Migration già presenti modificate: ${edited.join(", ")}. Il deploy rifiuta ogni differenza dalle migration applicate: ripristinarle e correggere con una nuova migration o nella documentazione.`,
    );
  const changes = files.includes(configFile)
    ? {
        [configFile]: {
          before: show(before, configFile),
          after: committed
            ? show(option("head"), configFile)
            : existsSync(configFile)
              ? readFileSync(configFile, "utf8")
              : undefined,
        },
      }
    : {};
  const sources = lines(git("ls-files", "--cached", "--others", "--exclude-standard"))
    .filter((file) => /^(?:app|workers)\/.+\.tsx?$/u.test(file) && existsSync(file))
    .map((file) => ({ path: file, text: readFileSync(file, "utf8") }));
  const result = plan(files, sources, args.complete, changes);

  if (green) console.log(`Confronto con l'ultimo verde locale ${green.slice(0, 12)}.`);
  for (const file of files) console.log(`${fileLevel(file, changes[file])}: ${file}`);
  const summary = `Gate ${result.gate} (\`pnpm ${result.script}\`); browser: ${result.e2e ? `${result.browsers}, grep ${result.browserGrep}` : "no"}; deploy test: ${result.deploy ? "sì" : "no"}; mutation: ${result.mutation.join(", ") || "nessuna"}.`;
  console.log(summary);
  if (args["github-output"] && process.env.GITHUB_OUTPUT)
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `gate=${result.gate}\ne2e=${result.e2e}\nbuild=${result.build}\ndeploy=${result.deploy}\npromotion-reuse=${result.promotionReuse}\ngrep=${result.browserGrep}\nbrowsers=${result.browsers}\nmutation=${result.mutation.join(" ")}\nmutation-matrix=${JSON.stringify({ target: result.mutation })}\n`,
    );
  if (process.env.GITHUB_STEP_SUMMARY && !args["gate-only"])
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Piano dei controlli\n\n${summary}\n`);
  if (args.json) console.log(JSON.stringify(result));
  // La riga di approvazione entra nel corpo della PR prima della sua apertura, non dopo un
  // `Verify` fallito.
  if (!committed) {
    const added = localChanges(mergeBase)
      .filter((file) => /^migrations\/.+\.sql$/u.test(file) && existsSync(file))
      .filter((file) => show(mergeBase, file) === undefined)
      .map((file) => migrationEntry(file, readFileSync(file)));
    const review = requiredReview(added);
    if (review)
      console.log(
        `Migration non additive: ${review.names.join(", ")}. Dopo l'esame aggiungere al corpo della PR la riga "reviewed-migrations: ${review.digest}".`,
      );
  }

  if (args.run) {
    run("pnpm", [result.script]);
    if (result.e2e && !args["gate-only"])
      run(
        "node",
        ["scripts/browser-tests.mjs", "--grep", result.browserGrep, "--browsers", result.browsers],
        { E2E_PREBUILT: "1" },
      );
    if (tree) writeFileSync(greenFile(), `${JSON.stringify({ tree })}\n`);
  }
}
