#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
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

function main() {
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
  console.log(`Shard ${values.shard}: ${tests.length} prove assegnate.`);
  playwright(["--test-list", list], { stdio: "inherit" });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
