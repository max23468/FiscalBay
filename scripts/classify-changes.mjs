#!/usr/bin/env node
/**
 * Classifica i file modificati e sceglie i controlli, uguale in locale e in CI.
 * Categorie: documentazione, test, runtime, tooling. Un file non classificato,
 * un diff vuoto o un confronto non disponibile eseguono il gate completo.
 * Uso: node scripts/classify-changes.mjs [--base REF --head REF] [--github-output] [--run]
 * Senza --base confronta il checkout, file non tracciati inclusi, con origin/develop.
 */
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Documenti che governano operazioni e gate: non ottengono la corsia ridotta.
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
      /^(?:vite|vitest|playwright|react-router)\.config\.ts$/u,
      /^(?:wrangler\.jsonc|components\.json|doctor\.config\.json|stryker\.config\.json)$/u,
      /^(?:\.oxfmtrc\.json|\.gitignore|\.dev\.vars\.example)$/u,
    ],
  ],
];

/** Categoria di un file, oppure `undefined` se non classificato. */
export function classifyFile(file) {
  if (governance.some((pattern) => pattern.test(file))) return "tooling";
  if (file.endsWith(".md")) return "documentation";
  return categories.find(([, patterns]) => patterns.some((pattern) => pattern.test(file)))?.[0];
}

/** Controlli necessari per un insieme di file modificati. */
export function plan(files) {
  if (files.length === 0) return { gate: "full", e2e: true, unclassified: [] };
  const unclassified = files.filter((file) => !classifyFile(file));
  const kinds = new Set(files.map(classifyFile));
  const docsOnly = kinds.size === 1 && kinds.has("documentation");
  const e2e =
    unclassified.length > 0 ||
    kinds.has("runtime") ||
    kinds.has("tooling") ||
    files.some((file) => file.startsWith("e2e/"));
  return { gate: docsOnly ? "docs" : "full", e2e, unclassified };
}

const git = (...args) => execFileSync("git", args, { encoding: "utf8" });
const lines = (text) => text.split("\n").filter(Boolean);

function committedChanges(base, head) {
  if (!base || !head || /^0+$/u.test(base)) return [];
  try {
    return lines(git("diff", "--name-only", `${base}...${head}`));
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
  const result = plan(files);

  for (const file of files) console.log(`${classifyFile(file) ?? "non classificato"}: ${file}`);
  console.log(
    `Gate: ${result.gate === "docs" ? "documentazione" : "completo"}; E2E: ${result.e2e ? "sì" : "no"}.`,
  );
  if (args.includes("--github-output") && process.env.GITHUB_OUTPUT)
    appendFileSync(process.env.GITHUB_OUTPUT, `gate=${result.gate}\ne2e=${result.e2e}\n`);

  if (args.includes("--run")) {
    if (result.gate === "docs") {
      run("node", ["scripts/verify-copy.mjs"]);
      run("node", ["scripts/verify-docs.mjs"]);
    } else run("pnpm", ["verify"]);
    if (result.e2e) run("pnpm", ["test:e2e"], { E2E_PREBUILT: "1" });
  }
}
