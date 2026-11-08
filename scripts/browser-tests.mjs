#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

/**
 * Prove dello shard `current` su `total`: l'ordine segue un'impronta del titolo, a turno. In ordine
 * di elenco le varianti lente della stessa prova finivano sempre nelle stesse partizioni. Il calcolo
 * è deterministico: ogni macchina ricava da sola la propria parte.
 */
export function shardTests(listing, current, total) {
  const tests = [];
  const visit = (suite, file, titles) => {
    for (const spec of suite.specs ?? [])
      for (const test of spec.tests)
        tests.push(`[${test.projectName}] › ${file} › ${[...titles, spec.title].join(" › ")}`);
    for (const child of suite.suites ?? []) visit(child, file, [...titles, child.title]);
  };
  for (const suite of listing.suites) visit(suite, suite.file, []);
  const digest = (test) => createHash("sha256").update(test).digest("hex");
  return tests
    .map((test) => [digest(test), test])
    .sort(([a], [b]) => a.localeCompare(b))
    .filter((_, index) => index % total === current - 1)
    .map(([, test]) => test);
}

export function listedTestIds(listing) {
  const visit = (suite) => [
    ...(suite.specs ?? []).flatMap((spec) => spec.tests.map(() => spec.id)),
    ...(suite.suites ?? []).flatMap(visit),
  ];
  return visit(listing);
}

/** Un centinaio di prove per runner, fino a otto macchine; nessuna partizione vuota. */
export function browserShards(count) {
  if (!Number.isSafeInteger(count) || count <= 0)
    throw new Error("Inventario browser vuoto o non valido.");
  const total = Math.min(8, Math.ceil(count / 100));
  return { include: Array.from({ length: total }, (_, index) => ({ shard: index + 1, total })) };
}

/** Esito delle prove browser di una run della PR: `passed` con ogni parte riuscita, `failed`, o nulla. */
export function browserOutcome(jobs) {
  const own = jobs.filter((job) => /^Browser \d+\/\d+$/u.test(job.name));
  if (!own.length) return null;
  if (own.some((job) => ["failure", "timed_out"].includes(job.conclusion))) return "failed";
  // GitHub elenca soltanto i job partiti: ogni parte deve esserci, riuscita.
  if (!own.every((job) => job.conclusion === "success")) return null;
  const parts = own.map((job) => /(\d+)\/(\d+)$/u.exec(job.name));
  const total = parts[0][2];
  return parts.every((part) => part[2] === total) &&
    new Set(parts.map((part) => part[1])).size === Number(total)
    ? "passed"
    : null;
}

/**
 * Prova browser riusabile nelle run precedenti della CI della PR: l'ultima run che ha concluso le
 * prove browser, con ogni parte riuscita e lo stesso inventario selezionato (`key`). `narrowing`
 * dice che cosa ripetere fino al commit provato: niente (`reuse`), una selezione ridotta (`grep`)
 * o, con null, tutto. Una run annullata o in corso senza tutte le parti non decide; un fallimento
 * recente non si copre con un successo più vecchio.
 */
export async function browserProof(
  { repository, repositoryId, branch, exclude, key },
  { api, planKey, narrowing },
) {
  const { workflow_runs: runs = [] } = await api(
    `repos/${repository}/actions/workflows/ci.yml/runs?event=pull_request&branch=${encodeURIComponent(branch)}&per_page=30`,
  );
  const ordered = runs
    .filter((run) => run.head_repository?.id === repositoryId && String(run.id) !== String(exclude))
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  for (const run of ordered) {
    const jobs = [];
    for (let page = 1; ; page++) {
      const batch = await api(
        `repos/${repository}/actions/runs/${run.id}/jobs?filter=latest&per_page=30&page=${page}`,
      );
      jobs.push(...batch.jobs);
      if (batch.jobs.length < 30 || jobs.length >= batch.total_count) break;
    }
    const outcome = browserOutcome(jobs);
    if (outcome === "failed") return null;
    if (outcome !== "passed") continue;
    if ((await planKey(run.id)) !== key) return null;
    const rest = await narrowing(run.head_sha);
    return rest ? { run: run.id, commit: run.head_sha, ...rest } : null;
  }
  return null;
}

/** Impronta dell'inventario selezionato: prove, browser e filtri. */
const inventoryKey = (ids, selection) =>
  createHash("sha256")
    .update(JSON.stringify({ ids: [...ids].sort(), selection }))
    .digest("hex");

/** File con l'impronta dell'inventario della run, conservato come artefatto `browser-plan-<run>`. */
const planFile = path.resolve("test-results", "browser-plan.json");

/**
 * Prove browser di questa run della PR già concluse in una run precedente: con il commit provato
 * che le contiene e nessun cambio rilevante per il classificatore, gli otto job non ripartono.
 */
async function reusedBrowsers(key) {
  const { gh, ghJson, retry } = await import("./lib/provider.mjs");
  const { browserNarrowing } = await import("./classify-changes.mjs");
  const repositoryId = Number(process.env.REPOSITORY_ID);
  const { REPOSITORY: repository, BROWSER_PR_BRANCH: branch } = process.env;
  if (!repository || !repositoryId) throw new Error("Repository non indicato.");
  const api = (url) =>
    retry(() => ghJson("api", url), { attempts: 6, delay: (attempt) => attempt * 10_000 });
  const planKey = (id) => {
    const directory = mkdtempSync(path.join(tmpdir(), "browser-plan-"));
    try {
      gh(
        "run",
        "download",
        String(id),
        "--repo",
        repository,
        "--name",
        `browser-plan-${id}`,
        "--dir",
        directory,
      );
      return JSON.parse(readFileSync(path.join(directory, "browser-plan.json"), "utf8")).key;
    } catch {
      return null;
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  };
  // Nella PR il commit provato è l'unione con la base: il primo genitore è la base.
  const sources = execFileSync("git", ["ls-files"], { encoding: "utf8" })
    .split("\n")
    .filter((file) => /^(?:app|workers)\/.+\.tsx?$/u.test(file) && existsSync(file))
    .map((file) => ({ path: file, text: readFileSync(file, "utf8") }));
  const narrowing = (commit) => {
    try {
      execFileSync("git", ["merge-base", "--is-ancestor", commit, "HEAD"], { stdio: "ignore" });
      execFileSync("git", ["rev-parse", "--verify", "HEAD^2"], { stdio: "ignore" });
    } catch {
      return null;
    }
    return browserNarrowing(commit, "HEAD", "HEAD^1", sources);
  };
  return browserProof(
    { repository, repositoryId, branch, exclude: process.env.GITHUB_RUN_ID, key },
    { api, planKey, narrowing },
  );
}

async function main() {
  const { values } = parseArgs({
    options: {
      grep: { type: "string", default: "." },
      "grep-invert": { type: "string", default: "" },
      browsers: { type: "string", default: "chromium" },
      pages: { type: "boolean", default: false },
      plan: { type: "boolean", default: false },
      shard: { type: "string" },
    },
  });
  const browsers = values.browsers.split(",");
  if (browsers.some((browser) => !["chromium", "webkit"].includes(browser)))
    throw new Error("Browser non supportato.");
  const selectionFor = (grep) => [
    ...(values.pages ? ["e2e/pages.spec.ts"] : []),
    "--grep",
    grep,
    ...(values["grep-invert"] ? ["--grep-invert", values["grep-invert"]] : []),
    ...browsers.flatMap((browser) => ["--project", browser]),
  ];
  const selection = selectionFor(values.grep);
  const playwright = (args, options, chosen = selection) =>
    execFileSync("pnpm", ["exec", "playwright", "test", ...args, ...chosen], options);
  const inventory = (chosen) =>
    listedTestIds(
      JSON.parse(
        playwright(
          ["--list", "--reporter", "json"],
          { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
          chosen,
        ),
      ),
    );
  if (values.plan) {
    const ids = inventory(selection);
    let count = ids.length;
    let matrix = browserShards(count);
    let result = "";
    if (process.env.BROWSER_PR_BRANCH) {
      const key = inventoryKey(ids, selection);
      mkdirSync(path.dirname(planFile), { recursive: true });
      writeFileSync(planFile, JSON.stringify({ key }));
      const proof = await reusedBrowsers(key);
      // La selezione ridotta si elenca di nuovo: i runner seguono le prove che restano.
      const narrowed = proof?.grep ? inventory(selectionFor(proof.grep)) : null;
      const summary = !proof
        ? ""
        : narrowed?.length
          ? `Prove browser già concluse nella run ${proof.run} su ${proof.commit.slice(0, 8)}: da allora si ripetono ${narrowed.length} prove su ${count}, quelle delle aree toccate sia dai cambi sia dalla PR (\`${proof.grep}\`).\n`
          : `Prove browser già concluse nella run ${proof.run} su ${proof.commit.slice(0, 8)}: nessun cambio rilevante da allora.\n`;
      if (proof && !narrowed?.length) result += "browser-reused=true\n";
      else if (narrowed) {
        count = narrowed.length;
        matrix = browserShards(count);
        result += `browser-grep=${proof.grep}\n`;
      }
      if (summary) {
        console.log(summary);
        if (process.env.GITHUB_STEP_SUMMARY)
          writeFileSync(process.env.GITHUB_STEP_SUMMARY, summary, { flag: "a" });
      }
    }
    result += `browser-matrix=${JSON.stringify(matrix)}\nbrowser-count=${count}\n`;
    if (process.env.GITHUB_OUTPUT) writeFileSync(process.env.GITHUB_OUTPUT, result, { flag: "a" });
    console.log(`Browser: ${count} prove, ${matrix.include.length} runner.`);
    return;
  }
  if (!values.shard) return void playwright([], { stdio: "inherit" });

  const [current, total] = values.shard.split("/").map(Number);
  if (!(current >= 1 && current <= total)) throw new Error("Shard non valido.");
  const listing = JSON.parse(
    playwright(["--list", "--reporter", "json"], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "inherit"],
    }),
  );
  const tests = shardTests(listing, current, total);
  if (tests.length === 0) return void console.log(`Shard ${values.shard}: nessuna prova.`);
  const list = path.resolve("test-results", `shard-${current}-of-${total}.txt`);
  mkdirSync(path.dirname(list), { recursive: true });
  writeFileSync(list, `${tests.join("\n")}\n`);
  console.log(`Shard ${values.shard}: ${tests.length} prove assegnate.`);
  playwright(["--test-list", list], { stdio: "inherit" });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
