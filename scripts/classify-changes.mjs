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
 * Uso: node scripts/classify-changes.mjs [--base REF --head REF] [--complete] [--all] [--github-output] [--json] [--run] [--browser]
 * `--run` esegue il gate del livello, `--browser` le sole prove browser scelte, in Chromium.
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

/** Manifest delle dipendenze e file di versioni: il livello dipende dai pacchetti cambiati. */
const manifestFile = "package.json";
const lockFile = "pnpm-lock.yaml";

/** File che si confrontano per contenuto, oltre che per nome. */
const comparedFiles = [configFile, manifestFile, "CHANGELOG.md"];

// Strumenti che entrano nella build o decidono dove girano le prove: un aggiornamento cambia
// l'artefatto o l'ambiente del collaudo.
const buildTool =
  /^(?:vite|vite-.+|@vitejs\/.+|@cloudflare\/(?:vite-plugin|workers-types)|@react-router\/.+|react-router|tailwindcss|@tailwindcss\/.+|typescript|lightningcss|@playwright\/test)$/u;

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
  /^scripts\/(?:verify-(?:docs|repo|pages)|classify-changes|benchmark|capacity|coverage-report|mutation(?:-vitest|-reuse)?|find-(?:build|deployed)|reset-test-account|site-screenshots|stripe-account|telegram-bot|metrics-query|log-archive|zone-protection|credential-expiries|watch-invocations|ebay-mcp|ebay-notifications|recovery|commercial|go-live|surveillance|pages-reuse|release\/(?:release(?:-notes|-cycle)?|guard|notify|records)|lib\/(?:provider|worker))\.mjs$/u,
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

/** Sezioni del manifest diverse fra due versioni, con i pacchetti cambiati. */
function manifestDifference(before, after) {
  const [previous, next] = [before, after].map((text) => JSON.parse(text));
  const sections = [...new Set([...Object.keys(previous), ...Object.keys(next)])].filter(
    (key) => JSON.stringify(previous[key]) !== JSON.stringify(next[key]),
  );
  const packages = (section) => {
    const [from, to] = [previous[section] ?? {}, next[section] ?? {}];
    return [...new Set([...Object.keys(from), ...Object.keys(to)])].filter(
      (name) => from[name] !== to[name],
    );
  };
  return { sections, packages };
}

/**
 * Peso di una modifica del manifest: `tools` se cambiano soltanto strumenti di sviluppo, `build`
 * se cambiano dipendenze o strumenti che entrano nell'artefatto, `undefined` negli altri casi,
 * per esempio se cambiano gli script o un manifest non si legge.
 */
export function dependencyChange(before, after) {
  try {
    const { sections, packages } = manifestDifference(before, after);
    if (!sections.length || sections.some((key) => !/^(?:devD|d)ependencies$/u.test(key)))
      return undefined;
    const runtime = sections.includes("dependencies");
    return runtime || packages("devDependencies").some((name) => buildTool.test(name))
      ? "build"
      : "tools";
  } catch {
    return undefined;
  }
}

/** Vero se due changelog differiscono soltanto per il giorno di una versione. */
export function changelogDayOnly(before, after) {
  if (typeof before !== "string" || typeof after !== "string" || before === after) return false;
  const undated = (text) => text.replace(/^(## \[[^\]]+\]) - \d{4}-\d{2}-\d{2}$/gmu, "$1");
  return undated(before) === undated(after);
}

/**
 * Livello di un file ed effetti sulle prove browser e sul deploy test. `change` contiene le due
 * versioni dei file confrontati per contenuto, quando il confronto le rende disponibili; `lock`
 * dice se il lockfile accompagna un manifest che cambia soltanto strumenti di sviluppo.
 * `core` limita i browser al nucleo essenziale: la suite completa resta alla qualifica.
 */
export function fileImpact(file, change, lock) {
  // Le Novità dell'app si leggono dal changelog alla build: cambia ciò che si distribuisce. Il
  // giorno scritto dopo una pubblicazione è già nella build distribuita.
  if (file === "CHANGELOG.md")
    return changelogDayOnly(change?.before, change?.after)
      ? { level: "docs", e2e: false, deploy: false }
      : { level: "build", e2e: false, deploy: true };
  if (file === manifestFile) {
    const weight = dependencyChange(change?.before, change?.after);
    if (weight === "tools") return { level: "full", e2e: false, deploy: false };
    if (weight === "build") return { level: "full", e2e: true, deploy: true, core: true };
  }
  if (file === lockFile)
    return lock === "tools"
      ? { level: "full", e2e: false, deploy: false }
      : { level: "full", e2e: true, deploy: true, core: true };
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

/**
 * Area dei moduli applicativi, dichiarata per percorso: i moduli di dominio si importano a catena
 * fino a quasi tutte le route, quindi gli import transitivi non distinguono le aree. Un elenco
 * vuoto vale per i moduli che nessuna pagina mostra, come code, cron e log. Shell, copy, componenti
 * comuni e aggregatori stanno in `sharedModules` e provano tutto: un modulo assente da entrambi
 * ferma `pnpm test:scripts`, così nulla prova tutto per dimenticanza.
 */
const billing = ["orders", "public", "settings"];
export const moduleAreas = [
  [
    /^app\/(?:components\/orders\/|orders\/(?!export-)|preview\/order-list\.server\.ts$|domain\/(?:orders|order-(?:view|suggestions|observation))\.server\.ts$)/u,
    ["orders"],
  ],
  [
    /^app\/(?:orders\/export-|domain\/order-export\.server\.ts$|domain\/(?:export-(?:configurations|files|jobs)|account-export|xlsx)\.server\.ts$|copy\/account-export\.ts$)/u,
    ["orders", "settings"],
  ],
  [
    /^app\/(?:integrations\/ebay\/|domain\/order-(?:sync|acquisition(?:-context|-details)?|import|events)\.server\.ts$)/u,
    ["orders", "stores"],
  ],
  [/^app\/(?:webhooks\.server|webhook-paths)\.ts$/u, ["orders", "settings", "stores"]],
  [
    /^app\/(?:components\/stores\/|domain\/(?:stores|store-(?:link|marks|profile|state|transfer)|free-store|ebay-quotas|ebay-account-deletion|token-refresh|reconnect-notices)\.server\.ts$)/u,
    ["stores"],
  ],
  [
    /^app\/(?:components\/settings\/|preview\/settings-page\.server\.ts$|settings-actions\.server\.ts$|domain\/(?:notifications|notification-reads|email-change|sessions|sign-in-methods|support|support-requests|preferences)\.server\.ts$)/u,
    ["settings"],
  ],
  [
    /^app\/(?:catalog\.ts|domain\/subscription-offers\.ts|integrations\/stripe(?:-account)?\.server\.ts|domain\/(?:billing|billing-subscriptions|checkout|lifetime|grants|concessions|refunds|plan-view)\.server\.ts)$/u,
    billing,
  ],
  [/^app\/domain\/billing-incidents\.server\.ts$/u, ["auth", "settings"]],
  [
    /^app\/(?:domain\/telegram(?:-bot|-deliveries|-messages)?\.server\.ts|copy\/(?:owner-)?telegram\.ts|integrations\/telegram\.server\.ts|bot-commands\.ts)$/u,
    ["auth", "settings"],
  ],
  [
    /^app\/(?:account-email\.server\.ts|domain\/(?:registration|account-deletion|deletion-steps)\.server\.ts)$/u,
    ["auth", "settings"],
  ],
  [
    /^app\/(?:components\/(?:access|admin)\/|account\/|components\/turnstile\.tsx$|copy\/admin-copy\.ts$|(?:admin-console|auth-route|security-actions|password|turnstile|metrics)\.server\.ts$|turnstile\.ts$|metrics-queries\.ts$|domain\/(?:admin-[a-z]+|owner-[a-z]+|admission(?:-state)?|auth-attempts|abuse-review|technical-metrics|product-metrics|maintenance)\.server\.ts$)/u,
    ["auth"],
  ],
  [
    /^app\/(?:copy\/(?:site-pages|legal-documents)\.server\.ts|components\/(?:site-layout|site-footer|faq-list|product-shot|standalone-page)\.tsx|components\/site-column\.ts|site\.server\.ts|site-meta\.ts|contact\.ts)$/u,
    ["public"],
  ],
  [/^app\/components\/language-switch\.tsx$/u, ["auth", "public"]],
  [
    /^app\/(?:domain\/(?:scheduled-work|sql|page-timing|webhook-receipts)\.server\.ts|domain\/work-timing\.ts|integrations\/http\.server\.ts|log-records\.ts|observability\.server\.ts|page-timing(?:\.server)?\.ts|sequence\.ts|service-activity\.server\.ts|settle\.server\.ts)$/u,
    [],
  ],
];

/** Moduli che ogni pagina attraversa, oppure senza un'area che li contenga: provano tutto. */
export const sharedModules =
  /^(?:workers\/app\.ts|app\/(?:components\/|copy\/|app\.css$|routes\.ts$|root\.tsx$|entry\.(?:client|server)\.tsx$|(?:access-notice|app-copy|app-links|changelog|client-action|error-response|errors|format|i18n|limits|markup|money|preferences|request-limits|support|tax-quality|time|view-models|web-analytics)\.ts$|(?:account-area|account-page|area-actions|auth|content-security|request-limits|response-cookies|sealed|whats-new)\.server\.ts$|domain\/(?:history-window|service-notices|service-settings)\.server\.ts$|preview\/(?:(?:scenarios|scenario-orders|state)\.server|scenario-text)\.ts$))/u;

/** Moduli applicativi senza area dichiarata e fuori da `sharedModules`. */
export const undeclaredModules = (files) =>
  files.filter(
    (file) =>
      !file.startsWith("app/routes/") &&
      !moduleAreas.some(([pattern]) => pattern.test(file)) &&
      !sharedModules.test(file),
  );

/** Aree di una route; `undefined` se il nome non ne indica una. */
function routeAreas(route) {
  const areas = [];
  if (/orders|order-|home|preview\.tsx|preview-search/u.test(route)) areas.push("orders");
  // Ordini e accesso condividono la pagina; il sito pubblico è `site.tsx`.
  if (route.endsWith("/home.tsx")) areas.push("auth");
  if (/stores|store-link/u.test(route)) areas.push("stores");
  if (/settings|whats-new/u.test(route)) areas.push("settings");
  if (/profile/u.test(route)) areas.push("profile");
  if (/security|admin|auth|sign-in/u.test(route)) areas.push("auth");
  if (/legal|site|robots|support|faq|features|pricing|sitemap/u.test(route)) areas.push("public");
  return areas.length ? areas : undefined;
}

/**
 * Aree di un modulo applicativo modificato: quella dichiarata, o della route stessa, più quelle
 * delle route che lo importano direttamente. `undefined` se un modulo o una route non ha area.
 */
function moduleArea(file, graph) {
  const own = file.startsWith("app/routes/")
    ? routeAreas(file)
    : moduleAreas.find(([pattern]) => pattern.test(file))?.[1];
  if (!own || !graph.has(file)) return undefined;
  const areas = [...own];
  for (const [route, imports] of graph) {
    if (!route.startsWith("app/routes/") || !imports.has(file)) continue;
    const direct = routeAreas(route);
    if (!direct) return undefined;
    areas.push(...direct);
  }
  return areas;
}

const areaPatterns = {
  orders: "ordini|ordine|orders|idratazione",
  stores: "negozi|negozio|stores",
  settings: "impostazioni|settings|superfici",
  profile: "profilo|profile",
  auth: "accesso|sicurezza|security|auth|admin|idratazione",
  public: "pubblico|standalone|public|termini|privacy",
};

/** Aree con prove proprie: i tag `@pages-<area>` del catalogo. */
export const areaTags = Object.keys(areaPatterns);

/** Cambiare il processo richiede la sua qualifica anche senza distribuire il prodotto. */
export const qualificationChange = (files) =>
  files.some((file) =>
    /^(?:\.github\/(?:workflows\/|actions\/)|scripts\/(?:release\/|classify-changes|browser-tests|pages-reuse|find-(?:build|deployed)|mutation(?:-reuse)?|lib\/(?:provider|worker)))/u.test(
      file,
    ),
  );

// Le visite del catalogo si scelgono soltanto per area, con il loro tag; le altre prove per titolo.
const areaGrep = (areas) => [
  ...areas.map((area) => `@pages-${area}`),
  `^(?!.*@pages).*(?:${areas.map((area) => areaPatterns[area]).join("|")})`,
];

// Moduli server: un cambio di dati o di logica non dipende dal motore del browser.
const serverOnly = /\.server\.ts$|^app\/domain\/|^app\/integrations\//u;

/**
 * Controlli per i file modificati; `complete` qualifica il candidato sul diff cumulativo.
 * `changes` associa a `cloudflare.config.ts` le versioni prima e dopo.
 */
export function plan(files, sources = [], complete = false, changes = {}) {
  const lock =
    files.includes(lockFile) && files.includes(manifestFile)
      ? dependencyChange(changes[manifestFile]?.before, changes[manifestFile]?.after)
      : undefined;
  const impacts = files.map((file) => fileImpact(file, changes[file], lock));
  // Un diff vuoto o non disponibile e il candidato eseguono tutto.
  const everything = complete || files.length === 0;
  const gate = everything
    ? "full"
    : levels[Math.max(...impacts.map(({ level }) => levels.indexOf(level)))];
  // Un diff vuoto distribuisce; prove e soli strumenti no.
  const deploy = files.length === 0 || impacts.some((impact) => impact.deploy);

  // Moduli che cambiano ciò che le prove browser visitano; le spec si selezionano per nome.
  const browserFiles = files.filter((_, index) => impacts[index].e2e);
  const product = browserFiles.filter(
    (file) => !browserSpec.test(file) && !impacts[files.indexOf(file)].core,
  );
  const core = impacts.some((impact) => impact.core);
  const specs = files.flatMap((file) => browserSpec.exec(file)?.[1] ?? []);

  const graph = importGraph(sources);
  // Una selezione per area vale soltanto se ogni modulo applicativo ha un'area; senza moduli
  // applicativi bastano le spec modificate o il nucleo essenziale.
  const owned = product.map((file) => moduleArea(file, graph));
  const areas = new Set(owned.flatMap((area) => area ?? []));
  const resolved = owned.every(Boolean);
  // I moduli che nessuna pagina mostra non chiedono browser.
  const quiet = !everything && resolved && !areas.size && !specs.length && !core;
  const e2e = everything || (browserFiles.length > 0 && !quiet);
  const targeted = e2e && !everything && resolved;
  const browserGrep = targeted
    ? [
        ...(areas.size || core ? ["@smoke"] : []),
        ...(areas.size ? areaGrep([...areas].sort()) : []),
        ...specs,
      ].join("|")
    : ".";
  // Il catalogo è il grosso della suite: una sua modifica lo visita con una sola combinazione.
  const matrix = targeted && specs.includes("pages.spec") ? "single" : "";
  // WebKit prova Safari e iPhone: serve se cambia ciò che il browser disegna o esegue. La logica
  // server gira in Chromium, WebKit resta alla qualifica.
  const browsers = !e2e
    ? ""
    : targeted && !specs.length && !core && product.every((file) => serverOnly.test(file))
      ? "chromium"
      : "chromium,webkit";
  // Soltanto il candidato esegue la mutation completa: moduli critici modificati e loro
  // consumatori critici. Le PR provano le righe cambiate dei moduli critici che toccano.
  const critical = (file) => (sources.length === 0 || graph.has(file)) && criticalModule(file);
  const mutationInputs =
    files.some((file) =>
      /^(?:package\.json|pnpm-(?:lock|workspace)\.yaml|stryker\.config\.json|vitest.*\.config\.ts)$/u.test(
        file,
      ),
    ) || qualificationChange(files)
      ? [...graph.keys()].filter(critical)
      : files.filter(critical);
  const mutation = complete ? [...consumers(mutationInputs, graph)].filter(critical) : [];
  return {
    gate,
    script: levelScripts[gate],
    e2e,
    build: gate === "build" || gate === "full",
    deploy,
    areas: [...areas].sort(),
    browserGrep,
    browsers,
    matrix,
    mutation,
    changedCritical: complete ? [] : files.filter(critical),
    qualify: deploy || qualificationChange(files),
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
const greenFile = (kind = "gate") =>
  git(
    "rev-parse",
    "--git-path",
    kind === "browser" ? "verify-browser.json" : "verify-changed.json",
  ).trim();
function lastGreen(kind) {
  try {
    const { tree } = JSON.parse(readFileSync(greenFile(kind), "utf8"));
    execFileSync("git", ["cat-file", "-e", `${tree}^{tree}`], { stdio: "ignore" });
    return tree;
  } catch {
    return undefined;
  }
}

/** Versioni dei file confrontati per contenuto fra due commit. */
function committedVersions(files, base, head) {
  return Object.fromEntries(
    comparedFiles
      .filter((file) => files.includes(file))
      .map((file) => [file, { before: show(base, file), after: show(head, file) }]),
  );
}

/** Se le modifiche fra due commit richiedono il deploy test, secondo lo stesso piano della CI. */
export function needsDeploy(base, head) {
  const files = committedChanges(base, head);
  return plan(files, [], false, committedVersions(files, base, head)).deploy;
}

/** Se fra due commit cambia ciò che si distribuisce: senza differenze non c'è nulla da pubblicare. */
export function distributes(base, head) {
  const files = committedChanges(base, head);
  return files.length > 0 && plan(files, [], false, committedVersions(files, base, head)).deploy;
}

/** Righe nuove di ogni blocco, dall'intestazione di `git diff -U0`: `12-14`. */
export function changedLines(diff) {
  return [...diff.matchAll(/^@@ -\S+ \+(\d+)(?:,(\d+))? @@/gmu)].flatMap(([, start, count]) => {
    const length = count === undefined ? 1 : Number(count);
    return length ? [`${start}-${Number(start) + length - 1}`] : [];
  });
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
      browser: { type: "boolean" },
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
  const kind = args.browser ? "browser" : "gate";
  const green = committed || args.all || args.complete ? undefined : lastGreen(kind);
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
  const changes = committed
    ? committedVersions(files, before, option("head"))
    : Object.fromEntries(
        comparedFiles
          .filter((file) => files.includes(file))
          .map((file) => [
            file,
            {
              before: show(before, file),
              after: existsSync(file) ? readFileSync(file, "utf8") : undefined,
            },
          ]),
      );
  const sources = lines(git("ls-files", "--cached", "--others", "--exclude-standard"))
    .filter((file) => /^(?:app|workers)\/.+\.tsx?$/u.test(file) && existsSync(file))
    .map((file) => ({ path: file, text: readFileSync(file, "utf8") }));
  const result = plan(files, sources, args.complete, changes);

  if (green) console.log(`Confronto con l'ultimo verde locale ${green.slice(0, 12)}.`);
  for (const file of files) console.log(`${fileLevel(file, changes[file])}: ${file}`);
  const criticalLines = committed
    ? result.changedCritical.flatMap((file) => {
        const lines = changedLines(git("diff", "-U0", option("base"), option("head"), "--", file));
        return lines.length ? [{ target: file, lines: lines.join(",") }] : [];
      })
    : [];
  const summary = `Gate ${result.gate} (\`pnpm ${result.script}\`); browser: ${result.e2e ? `${result.browsers}, grep ${result.browserGrep}` : "no"}; deploy test: ${result.deploy ? "sì" : "no"}; mutation: ${result.mutation.join(", ") || "nessuna"}.`;
  console.log(summary);
  if (args["github-output"] && process.env.GITHUB_OUTPUT)
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `gate=${result.gate}\ne2e=${result.e2e}\nbuild=${result.build}\ndeploy=${result.deploy}\nqualify=${result.qualify}\ndistributes=${committed && distributes(option("base"), option("head"))}\ngrep=${result.browserGrep}\nbrowsers=${result.browsers}\nmatrix=${result.matrix}\nmutation=${result.mutation.join(" ")}\nmutation-matrix=${JSON.stringify({ target: result.mutation })}\nmutation-lines=${JSON.stringify({ include: criticalLines })}\n`,
    );
  if (process.env.GITHUB_STEP_SUMMARY && !args.run)
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
    if (tree) writeFileSync(greenFile(), `${JSON.stringify({ tree })}\n`);
  }
  // In locale le prove scelte girano in Chromium: WebKit e la suite completa restano alla CI.
  if (args.browser) {
    if (result.e2e)
      run(
        "node",
        ["scripts/browser-tests.mjs", "--grep", result.browserGrep, "--browsers", "chromium"],
        result.matrix ? { E2E_MATRIX: result.matrix } : {},
      );
    if (tree) writeFileSync(greenFile("browser"), `${JSON.stringify({ tree })}\n`);
  }
}
