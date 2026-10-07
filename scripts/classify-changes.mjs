#!/usr/bin/env node
/**
 * Classifica i file modificati e sceglie i controlli, uguale in locale e in CI.
 * Categorie: documentazione, test, runtime, tooling. Un file non classificato,
 * un diff vuoto o un confronto non disponibile eseguono il gate completo.
 * Uso: node scripts/classify-changes.mjs [--base REF --head REF] [--github-output] [--run]
 * Senza --base confronta il checkout, file non tracciati inclusi, con origin/develop.
 */
import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { importGraph } from "./verify-repo.mjs";

// Il governo richiede anche i test degli script, senza implicare browser o deploy.
const governance = [
  /^AGENTS\.md$/u,
  /^CLAUDE\.md$/u,
  /^docs\/MASTER_PLAN\.md$/u,
  /^docs\/engineering\//u,
];
const categories = [
  ["test", [/^test\//u, /^e2e\//u]],
  ["runtime", [/^app\//u, /^workers\//u, /^public\//u, /^migrations\//u, /^placeholder\//u]],
  [
    "tooling",
    [
      /^\.github\//u,
      /^\.claude\//u,
      /^scripts\//u,
      /^(?:package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|mise\.toml)$/u,
      /^tsconfig(?:\.\w+)?\.json$/u,
      /^(?:vite|vitest(?:\.(?:unit|cloudflare))?|playwright|react-router)\.config\.ts$/u,
      /^(?:wrangler\.jsonc|components\.json|doctor\.config\.json|stryker\.config\.json)$/u,
      /^(?:\.oxfmtrc\.json|\.gitignore|\.dev\.vars\.example)$/u,
    ],
  ],
];

function toolingFile(file) {
  return (
    file.endsWith(".md") ||
    /^scripts\/(?:verify-(?:copy|docs|repo|pages)|guardrails\.test|classify-changes|release(?:-notes)?|find-(?:build|deployed)|reset-test-account|watch-invocations)\.mjs$/u.test(
      file,
    ) ||
    /^\.github\/(?:dependabot\.yml|workflows\/(?:ci|publish|promotion|mutation|react-doctor|actionlint|pr-title|dependency-review|dependabot-auto-merge)\.yml)$/u.test(
      file,
    ) ||
    /^(?:\.oxfmtrc\.json|doctor\.config\.json)$/u.test(file)
  );
}

/** Categoria di un file, oppure `undefined` se non classificato. */
export function classifyFile(file) {
  if (governance.some((pattern) => pattern.test(file))) return "tooling";
  if (file.endsWith(".md")) return "documentation";
  return categories.find(([, patterns]) => patterns.some((pattern) => pattern.test(file)))?.[0];
}

/** Controlli necessari per un insieme di file modificati. */
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

export function plan(files, sources = [], complete = false) {
  const unclassified = files.filter((file) => !classifyFile(file));
  const kinds = new Set(files.map(classifyFile));
  const docsOnly = kinds.size === 1 && kinds.has("documentation");
  const toolsOnly = files.length > 0 && files.every(toolingFile);
  const graph = importGraph(sources);
  const affected = consumers(files, graph);
  const full =
    complete ||
    files.length === 0 ||
    unclassified.length > 0 ||
    files.some((file) => classifyFile(file) === "tooling" && !toolingFile(file)) ||
    files.some((file) =>
      /^(?:app\/(?:root\.tsx|routes\.ts|entry\.server|app-copy|app-links)|app\/components\/(?:ui\/|app-shell|account)|app\/app\.css|public\/|workers\/|migrations\/|e2e\/)/u.test(
        file,
      ),
    ) ||
    (kinds.has("runtime") &&
      (sources.length === 0 || files.some((file) => file.startsWith("app/") && !graph.has(file))));
  const areas = new Set();
  const routes = [...affected].filter((file) => file.startsWith("app/routes/"));
  for (const route of routes) {
    if (/orders|home/u.test(route)) areas.add("orders");
    // Ordini e accesso condividono la pagina; il sito pubblico è `site.tsx`.
    if (route.endsWith("/home.tsx")) areas.add("auth");
    if (/stores|store-link/u.test(route)) areas.add("stores");
    if (/settings/u.test(route)) areas.add("settings");
    if (/profile/u.test(route)) areas.add("profile");
    if (/security|admin|auth|sign-in/u.test(route)) areas.add("auth");
    if (/legal|site|robots/u.test(route)) areas.add("public");
  }
  const unitOnly =
    files.some((file) => classifyFile(file) === "test") &&
    files.every(
      (file) => toolingFile(file) || (classifyFile(file) === "test" && !file.startsWith("e2e/")),
    );
  const mode =
    docsOnly && !complete
      ? "docs"
      : toolsOnly && !complete
        ? "tooling"
        : unitOnly && !complete
          ? "unit"
          : full || areas.size === 0
            ? "full"
            : "targeted";
  const e2e = mode === "full" || mode === "targeted";
  const patterns = {
    orders: "ordini|ordine|orders|idratazione",
    stores: "negozi|negozio|stores",
    settings: "impostazioni|settings|superfici",
    profile: "profilo|profile",
    auth: "accesso|sicurezza|security|auth|admin|idratazione",
    public: "pubblico|standalone|public|termini|privacy",
  };
  const browserGrep =
    mode === "targeted"
      ? [
          "app-shell.spec",
          "app-components.spec",
          "@smoke",
          ...[...areas].map((area) => patterns[area]),
        ].join("|")
      : ".";
  // I mutanti partono dai moduli critici modificati e risalgono ai consumatori critici:
  // un modulo condiviso non critico non estende la campagna a tutti i domini.
  const critical = (file) =>
    (sources.length === 0 || graph.has(file)) &&
    /^app\/(?:auth(?:-route)?|domain\/(?:orders|order-import|quota|grants|cycles|sessions|sign-in-methods|registration|stores|export)|integrations\/(?:stripe|ebay\/(?:seller-credentials|store-link|tax-identifiers|fulfillment))).*\.server\.ts$/u.test(
      file,
    );
  const mutationInputs = files.filter(critical);
  if (
    files.some((file) =>
      /^(?:test\/(?:auth-route\.unit|worker-context)\.ts|vitest\.unit\.config\.ts)$/u.test(file),
    )
  )
    mutationInputs.push("app/auth-route.server.ts");
  const mutation = [...consumers(mutationInputs, graph)].filter(critical);
  const browsers = e2e
    ? mode === "full" ||
      areas.has("auth") ||
      files.some((file) => /i18n|view-models|date|\.tsx$/u.test(file))
      ? "chromium,webkit"
      : "chromium"
    : "";
  const build = mode === "full" || mode === "targeted" || mode === "unit";
  const deploy =
    files.length === 0 ||
    unclassified.length > 0 ||
    kinds.has("runtime") ||
    files.some((file) => classifyFile(file) === "tooling" && !toolingFile(file));
  const doctor =
    complete ||
    unclassified.length > 0 ||
    files.length === 0 ||
    (full && kinds.has("runtime")) ||
    files.some((file) => classifyFile(file) === "tooling" && !toolingFile(file)) ||
    [...affected].some((file) => /^app\/.*\.tsx$/u.test(file)) ||
    files.some((file) => /^(?:package\.json|pnpm-lock\.yaml|doctor\.config\.json)$/u.test(file));
  return {
    gate: mode === "docs" ? "docs" : mode === "tooling" ? "tooling" : "full",
    e2e,
    unclassified,
    mode,
    areas: [...areas].sort(),
    browserGrep,
    browsers,
    build,
    deploy,
    doctor,
    promotionReuse: !files.some(
      (file) =>
        /^scripts\/(?:classify-changes|release(?:-notes)?|find-build)\.mjs$/u.test(file) ||
        /^\.github\/workflows\/(?:ci|mutation|publish|promotion)\.yml$/u.test(file),
    ),
    mutation,
    reasons: [
      complete ? "diff cumulativo, collaudo completo" : `modalità ${mode}`,
      ...(unclassified.length ? ["file non classificati"] : []),
      ...routes.map((route) => `consumatore ${route}`),
      `browser ${e2e ? "richiesti dal perimetro applicativo" : "non richiesti"}`,
      `build ${build ? "richiesta dal gate applicativo" : "non richiesta"}`,
      `deploy ${deploy ? "richiesto da runtime, configurazione o perimetro sconosciuto" : "nessun artefatto applicativo modificato"}`,
      ...files
        .filter((file) => !toolingFile(file) && classifyFile(file) !== "test")
        .map((file) => `impatto applicativo o non classificato: ${file}`),
    ],
  };
}

/** Sequenza del gate condivisa da locale e CI, senza browser o mutation. */
export function gateCommands({ gate, doctor }) {
  if (gate === "docs")
    return [
      ["node", ["scripts/verify-copy.mjs"]],
      ["node", ["scripts/verify-docs.mjs"]],
    ];
  const checks =
    gate === "tooling"
      ? ["verify:tooling"]
      : ["verify:tooling", "verify:pages", "typecheck", "test", "build"];
  if (doctor) checks.push("doctor:react");
  return checks.map((check) => ["pnpm", [check]]);
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
  const base = option("--base");
  const head = option("--head");
  // Base vuota, a zeri o non raggiungibile (avvio manuale, nuovo branch, storia riscritta):
  // il diff resta vuoto e il gate completo.
  const files = !args.includes("--base") ? localChanges() : committedChanges(base, head);
  const sources = lines(git("ls-files", "--cached", "--others", "--exclude-standard"))
    .filter((file) => /^(?:app|workers)\/.+\.tsx?$/u.test(file) && existsSync(file))
    .map((file) => ({ path: file, text: readFileSync(file, "utf8") }));
  const result = plan(files, sources, args.includes("--complete"));

  for (const file of files) console.log(`${classifyFile(file) ?? "non classificato"}: ${file}`);
  console.log(
    `Gate: ${result.gate === "docs" ? "documentazione" : result.gate === "tooling" ? "strumenti" : "completo"}; E2E: ${result.e2e ? "sì" : "no"}.`,
  );
  if (args.includes("--github-output") && process.env.GITHUB_OUTPUT)
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `gate=${result.gate}\ne2e=${result.e2e}\nbuild=${result.build}\ndeploy=${result.deploy}\ndoctor=${result.doctor}\npromotion-reuse=${result.promotionReuse}\nmode=${result.mode}\ngrep=${result.browserGrep}\nbrowsers=${result.browsers}\nmutation=${result.mutation.join(" ")}\nmutation-matrix=${JSON.stringify({ target: result.mutation })}\n`,
    );
  if (process.env.GITHUB_STEP_SUMMARY && !args.includes("--gate-only"))
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `### Piano dei controlli\n\n${result.reasons.map((reason) => `- ${reason}`).join("\n")}\n\nBrowser: ${result.browsers || "non applicabili"}. Mutation: ${result.mutation.join(", ") || "nessun dominio critico modificato"}.\n`,
    );
  if (args.includes("--json")) console.log(JSON.stringify(result));

  if (args.includes("--run")) {
    for (const [command, arguments_] of gateCommands(result)) run(command, arguments_);
    if (result.e2e && !args.includes("--gate-only"))
      run(
        "node",
        ["scripts/browser-tests.mjs", "--grep", result.browserGrep, "--browsers", result.browsers],
        { E2E_PREBUILT: "1" },
      );
    if (result.mutation.length && !args.includes("--gate-only"))
      run("pnpm", ["test:mutation", ...result.mutation]);
  }
}
