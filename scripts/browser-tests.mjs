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

export function assertCandidateReports(parts, sha, expected) {
  for (const kind of ["source", "production"]) {
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
      browsers: { type: "string", default: "chromium" },
      pages: { type: "boolean", default: false },
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
    const expected = Object.fromEntries(
      ["source", "production"].map((kind) => [
        kind,
        listedTestIds(
          JSON.parse(
            execFileSync(
              "pnpm",
              [
                "exec",
                "playwright",
                "test",
                ...(kind === "production" ? ["e2e/pages.spec.ts"] : []),
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
    assertCandidateReports(parts, sha, expected);
    console.log("Qualifica completa: otto partizioni browser coerenti, senza prove parziali.");
    return;
  }
  const browsers = values.browsers.split(",");
  if (browsers.some((browser) => !["chromium", "webkit"].includes(browser)))
    throw new Error("Browser non supportato.");
  const selection = [
    ...(values.pages ? ["e2e/pages.spec.ts"] : []),
    "--grep",
    values.grep,
    ...browsers.flatMap((browser) => ["--project", browser]),
  ];
  const playwright = (args, options) =>
    execFileSync("pnpm", ["exec", "playwright", "test", ...args, ...selection], options);
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
