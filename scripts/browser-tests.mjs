#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
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

function main() {
  const { values } = parseArgs({
    options: {
      grep: { type: "string", default: "." },
      browsers: { type: "string", default: "chromium" },
      pages: { type: "boolean", default: false },
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
