#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

/**
 * Prove dello shard `current` su `total`, assegnate a turno nell'ordine dell'elenco di
 * Playwright: `--shard` assegna blocchi consecutivi, e le varianti lente della stessa prova
 * finivano tutte sulla stessa macchina.
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
  return tests.filter((_, index) => index % total === current - 1);
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
function flakyHistory(directory, kinds) {
  const repository = process.env.GH_REPO;
  if (!repository) return [];
  const name = kinds.includes("source") ? "flaky-tests" : "production-flaky-tests";
  const { artifacts } = JSON.parse(
    execFileSync("gh", ["api", `repos/${repository}/actions/artifacts?name=${name}&per_page=30`], {
      encoding: "utf8",
    }),
  );
  const repositoryId = JSON.parse(
    execFileSync("gh", ["api", `repos/${repository}`], { encoding: "utf8" }),
  ).id;
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
      const origin = JSON.parse(
        execFileSync("gh", ["api", `repos/${repository}/actions/runs/${run.id}`], {
          encoding: "utf8",
        }),
      );
      return kinds.includes("source")
        ? origin.path === ".github/workflows/candidate.yml" && origin.conclusion === "success"
        : origin.path === ".github/workflows/publish.yml" && origin.head_branch === "main";
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

export function assertCandidateReports(parts, sha, expected, kinds = ["source", "production"]) {
  for (const kind of kinds) {
    const inventory = new Set(expected?.[kind]);
    if (!inventory.size || inventory.has(undefined) || inventory.size !== expected[kind].length)
      throw new Error(`Qualifica browser senza inventario valido: ${kind}.`);
    const ids = new Set();
    for (let shard = 1; shard <= 4; shard++) {
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
  const { values } = parseArgs({
    options: {
      grep: { type: "string", default: "." },
      "grep-invert": { type: "string", default: "" },
      kinds: { type: "string", default: "source,production" },
      browsers: { type: "string", default: "chromium" },
      pages: { type: "boolean", default: false },
      plan: { type: "boolean", default: false },
      shard: { type: "string" },
      "check-evidence": { type: "string" },
    },
  });
  if (values["check-evidence"]) {
    const directory = values["check-evidence"];
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
    const kinds = values.kinds.split(",");
    const invert = values["grep-invert"] ? ["--grep-invert", values["grep-invert"]] : [];
    const expected = Object.fromEntries(
      kinds.map((kind) => [
        kind,
        listedTestIds(
          JSON.parse(
            execFileSync(
              "pnpm",
              [
                "exec",
                "playwright",
                "test",
                ...(kind === "production" ? ["e2e/pages.spec.ts", ...invert] : invert),
                "--list",
                "--reporter",
                "json",
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
                  E2E_MATRIX: "full",
                  E2E_PRODUCTION: kind === "production" ? "1" : "",
                },
              },
            ),
          ),
        ),
      ]),
    );
    assertCandidateReports(parts, sha, expected, kinds);
    const flaky = flakyTests(parts);
    const repeated = repeatedFlaky(flaky, flakyHistory(directory, kinds));
    writeFileSync(path.join(directory, "flaky.json"), JSON.stringify(flaky));
    if (repeated.length) throw new Error(`Prove instabili da correggere: ${repeated.join("; ")}.`);
    console.log("Qualifica completa: partizioni browser coerenti, senza prove parziali.");
    return;
  }
  const browsers = values.browsers.split(",");
  if (browsers.some((browser) => !["chromium", "webkit"].includes(browser)))
    throw new Error("Browser non supportato.");
  const selection = [
    ...(values.pages ? ["e2e/pages.spec.ts"] : []),
    "--grep",
    values.grep,
    ...(values["grep-invert"] ? ["--grep-invert", values["grep-invert"]] : []),
    ...browsers.flatMap((browser) => ["--project", browser]),
  ];
  const playwright = (args, options) =>
    execFileSync("pnpm", ["exec", "playwright", "test", ...args, ...selection], options);
  if (values.plan) {
    const listing = JSON.parse(
      playwright(["--list", "--reporter", "json"], {
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
      }),
    );
    const count = listedTestIds(listing).length;
    const matrix = browserShards(count);
    const result = `browser-matrix=${JSON.stringify(matrix)}\nbrowser-count=${count}\n`;
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
  console.log(`Shard ${values.shard}: ${tests.length} prove assegnate a turno.`);
  playwright(["--test-list", list], { stdio: "inherit" });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
