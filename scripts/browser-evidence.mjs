#!/usr/bin/env node
/**
 * Evidenza browser della qualifica del candidato: report delle partizioni, inventario atteso e
 * prove instabili. Non esegue prove: un cambio qui non richiede i browser della PR.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { inventoryArgs, listedTestIds } from "./browser-tests.mjs";
import { ghJson } from "./lib/provider.mjs";

/** Pagine riuscite soltanto alla ripetizione, dalle otto partizioni. */
export function flakyTests(parts) {
  return [
    ...new Set(
      parts.flatMap(({ report }) =>
        (report?.rows ?? [])
          .filter(({ status, retry }) => status === "passed" && retry > 0)
          .map(({ project, page }) => `${project}: ${page}`),
      ),
    ),
  ].sort();
}

/**
 * Prove instabili anche ora e in almeno `limit` qualifiche recenti: oltre due volte l'instabilità
 * è un difetto, che ferma la certificazione finché la prova non si corregge.
 */
export function repeatedFlaky(current, history, limit = 2) {
  return current.filter((test) => history.filter((run) => run.includes(test)).length >= limit);
}

/** Elenchi delle prove instabili delle ultime qualifiche, dagli artefatti delle run. */
function flakyHistory(directory) {
  const repository = process.env.GH_REPO;
  if (!repository) return [];
  const name = "flaky-tests";
  const { artifacts } = ghJson(
    "api",
    `repos/${repository}/actions/artifacts?name=${name}&per_page=30`,
  );
  const repositoryId = ghJson("api", `repos/${repository}`).id;
  const seen = new Set();
  return artifacts
    .filter(({ expired, workflow_run: run }) => {
      if (
        expired ||
        run?.repository_id !== repositoryId ||
        run.head_repository_id !== repositoryId ||
        String(run.id) === process.env.GITHUB_RUN_ID ||
        seen.has(run.id)
      )
        return false;
      seen.add(run.id);
      const origin = ghJson("api", `repos/${repository}/actions/runs/${run.id}`);
      return origin.path === ".github/workflows/candidate.yml" && origin.conclusion === "success";
    })
    .slice(0, 5)
    .map(({ id, workflow_run: { id: run } }) => {
      const target = path.join(directory, "history", String(id));
      execFileSync(
        "gh",
        ["run", "download", String(run), "--repo", repository, "--name", name, "--dir", target],
        { stdio: "inherit" },
      );
      return JSON.parse(readFileSync(path.join(target, "flaky.json"), "utf8"));
    });
}

const candidateKinds = ["source", "production"];

export function assertCandidateReports(parts, sha, expected) {
  for (const kind of candidateKinds) {
    const inventory = new Set(expected?.[kind]);
    if (!inventory.size || inventory.has(undefined) || inventory.size !== expected[kind].length)
      throw new Error(`Qualifica browser senza inventario valido: ${kind}.`);
    const shards = Math.max(
      0,
      ...parts.filter((part) => part.kind === kind).map((part) => part.shard),
    );
    if (!Number.isSafeInteger(shards) || shards < 1 || shards > (kind === "source" ? 8 : 1))
      throw new Error(`Partizioni browser non valide: ${kind}.`);
    const ids = new Set();
    for (let shard = 1; shard <= shards; shard++) {
      const part = parts
        .filter((part) => part.kind === kind && part.shard === shard)
        .sort((a, b) => b.attempt - a.attempt)[0];
      const report = part?.report;
      if (
        !report ||
        report.sha !== sha ||
        report.status !== "passed" ||
        report.partial !== false ||
        report.dirty !== false ||
        report.baseURL !== "locale" ||
        report.environment !== (kind === "source" ? "local" : "production") ||
        !(report.counts?.passed > 0) ||
        !report.rows?.length
      )
        throw new Error(`Qualifica browser incompleta o diversa: ${kind} ${shard}.`);
      for (const row of report.rows) {
        if (!row.id || ids.has(row.id))
          throw new Error("Partizione browser duplicata o priva di identità.");
        if (
          row.status !== "passed" &&
          !(row.status === "skipped" && row.reason?.startsWith("Non applicabile:"))
        )
          throw new Error("Partizione con prove fallite o esclusioni non motivate.");
        ids.add(row.id);
      }
      if (
        report.counts.passed !== report.rows.filter((row) => row.status === "passed").length ||
        (report.counts.skipped ?? 0) !==
          report.rows.filter((row) => row.status === "skipped").length
      )
        throw new Error("Conteggi del collaudo incoerenti con le prove.");
    }
    if (ids.size !== inventory.size || [...ids].some((id) => !inventory.has(id)))
      throw new Error(`Qualifica browser diversa dall'inventario atteso: ${kind}.`);
  }
}

function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { "grep-invert": { type: "string", default: "" } },
  });
  {
    const directory = positionals[0];
    if (!directory)
      throw new Error("Uso: node scripts/browser-evidence.mjs <cartella> [--grep-invert <tag>]");
    const parts = readdirSync(directory, { recursive: true }).flatMap((file) => {
      const match = file.match(
        /candidate-browser-\d+-(\d+)-(source|production)-(\d+)\/browser\/\2-\3\.json$/u,
      );
      return match
        ? [
            {
              attempt: Number(match[1]),
              kind: match[2],
              shard: Number(match[3]),
              report: JSON.parse(readFileSync(path.join(directory, file), "utf8")),
            },
          ]
        : [];
    });
    const sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    const invert = values["grep-invert"] ? ["--grep-invert", values["grep-invert"]] : [];
    const expected = Object.fromEntries(
      candidateKinds.map((kind) => [
        kind,
        listedTestIds(
          execFileSync(
            "pnpm",
            [
              "exec",
              "playwright",
              "test",
              ...(kind === "production" ? ["e2e/pages.spec.ts", ...invert] : invert),
              ...inventoryArgs,
              "--project",
              "chromium",
              "--project",
              "webkit",
            ],
            {
              encoding: "utf8",
              maxBuffer: 64 * 1024 * 1024,
              stdio: ["ignore", "pipe", "inherit"],
              env: {
                ...process.env,
                E2E_BASE_URL: "",
                E2E_MATRIX: kind === "production" ? "single" : "full",
                E2E_PRODUCTION: kind === "production" ? "1" : "",
              },
            },
          ),
        ),
      ]),
    );
    assertCandidateReports(parts, sha, expected);
    const flaky = flakyTests(parts);
    const repeated = repeatedFlaky(flaky, flakyHistory(directory));
    writeFileSync(path.join(directory, "flaky.json"), JSON.stringify(flaky));
    if (repeated.length) throw new Error(`Prove instabili da correggere: ${repeated.join("; ")}.`);
    console.log("Qualifica completa: partizioni browser coerenti, senza prove parziali.");
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
