import { appendFileSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

export function coverageSummary(summary, expectedFiles = []) {
  const metrics = ["lines", "branches", "functions", "statements"];
  for (const metric of metrics) {
    const value = summary.total?.[metric];
    if (
      !value ||
      !Number.isFinite(value.total) ||
      value.total <= 0 ||
      !Number.isFinite(value.covered) ||
      value.covered < 0 ||
      value.covered > value.total ||
      !Number.isFinite(value.pct) ||
      value.pct < 0 ||
      value.pct > 100
    )
      throw new Error(`Copertura incompleta: ${metric}.`);
  }
  const missing = expectedFiles.filter((file) => !Object.hasOwn(summary, path.resolve(file)));
  if (missing.length)
    throw new Error(`File assenti dal report di copertura: ${missing.join(", ")}.`);
  return [
    "### Copertura applicativa Vitest",
    "",
    "Suite Node e Cloudflare; Playwright e test operativi Node esclusi. Nessuna soglia percentuale.",
    "",
    "| Metrica | Coperti / totali | Percentuale |",
    "|---|---:|---:|",
    ...metrics.map((metric) => {
      const value = summary.total[metric];
      return `| ${metric} | ${value.covered} / ${value.total} | ${value.pct}% |`;
    }),
    "",
  ].join("\n");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const summary = coverageSummary(
    JSON.parse(readFileSync("reports/coverage/coverage-summary.json", "utf8")),
    ["app", "workers"].flatMap((directory) =>
      readdirSync(directory, { recursive: true })
        .filter((file) => /\.tsx?$/u.test(file) && !file.endsWith(".d.ts"))
        .map((file) => path.join(directory, file)),
    ),
  );
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
}
