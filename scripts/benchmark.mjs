import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { arch, cpus, platform, tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function extractBenchmarkSources(root, reference, directory) {
  const archive = path.join(directory, "sources.tar");
  try {
    execFileSync("git", ["archive", "--output", archive, reference, "app"], { cwd: root });
    execFileSync("tar", ["-x", "-f", archive, "-C", directory]);
  } finally {
    rmSync(archive, { force: true });
  }
}

export function comparableDependencies(base, head) {
  const sorted = (dependencies) =>
    Object.entries(dependencies ?? {}).sort(([a], [b]) => a.localeCompare(b));
  return (
    JSON.stringify(sorted(base.dependencies)) === JSON.stringify(sorted(head.dependencies)) &&
    base.devDependencies?.vitest === head.devDependencies?.vitest &&
    base.engines?.node === head.engines?.node
  );
}

export function benchmarkSummary(current, baseline, reason = "base non richiesta") {
  const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  const names = Object.keys(current).sort();
  const invalid = (values) =>
    !Array.isArray(values) ||
    !values.length ||
    values.some((value) => !Number.isFinite(value) || value <= 0);
  if (
    !names.length ||
    names.some((name) => invalid(current[name])) ||
    (baseline &&
      (JSON.stringify(Object.keys(baseline).sort()) !== JSON.stringify(names) ||
        names.some((name) => invalid(baseline[name]))))
  )
    throw new Error("Misure benchmark mancanti o non valide.");
  return [
    "### Benchmark applicativi",
    "",
    "Tempi locali senza copertura; non misurano CPU, latenza o capacità del Worker remoto.",
    baseline
      ? "Confronto sullo stesso runner con harness e dipendenze identici. Variazioni informative, nessuna soglia bloccante."
      : `Confronto non disponibile: ${reason}.`,
    "",
    "| Percorso | Mediana ms | Intervallo ms | Base ms | Variazione |",
    "|---|---:|---:|---:|---:|",
    ...names.map((name) => {
      const samples = current[name];
      const value = median(samples);
      const before = baseline?.[name] && median(baseline[name]);
      return `| ${name} | ${value.toFixed(4)} | ${Math.min(...samples).toFixed(4)} - ${Math.max(...samples).toFixed(4)} | ${before ? before.toFixed(4) : "n/d"} | ${before ? `${((value / before - 1) * 100).toFixed(1)}%` : "n/d"} |`;
    }),
    "",
  ].join("\n");
}

function main() {
  const root = process.cwd();
  const directory = path.join(root, "reports/benchmarks");
  rmSync(directory, { recursive: true, force: true });
  mkdirSync(directory, { recursive: true });
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  const baseIndex = process.argv.indexOf("--base");
  const requestedBase =
    baseIndex === -1 ? process.env.BENCHMARK_BASE_SHA : process.argv[baseIndex + 1];
  if (baseIndex !== -1 && !requestedBase) throw new Error("--base richiede un commit.");
  const configs = readdirSync(root).filter((file) => /^tsconfig(?:\.\w+)?\.json$/u.test(file));
  const harnessFiles = [
    "vitest.benchmark.config.ts",
    ...configs,
    ...readdirSync("benchmarks", { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => path.relative(root, path.join(entry.parentPath, entry.name))),
  ].sort();
  const manifest = {
    head: git("rev-parse", "HEAD"),
    dirty: git("status", "--porcelain").length > 0,
    base: null,
    node: process.version,
    platform: platform(),
    arch: arch(),
    cpu: cpus()[0]?.model,
    image: process.env.ImageVersion ?? null,
    vitest: JSON.parse(readFileSync("package.json", "utf8")).devDependencies.vitest,
    lockfile: createHash("sha256").update(readFileSync("pnpm-lock.yaml")).digest("hex"),
    harness: harnessFiles
      .reduce((hash, file) => hash.update(file).update(readFileSync(file)), createHash("sha256"))
      .digest("hex"),
    repetitions: 3,
  };
  const samples = (cwd) => {
    const collected = {};
    for (let repeat = 0; repeat < manifest.repetitions; repeat++) {
      rmSync(path.join(cwd, "reports/benchmarks/raw"), { recursive: true, force: true });
      execFileSync(
        path.join(root, "node_modules/.bin/vitest"),
        ["bench", "--run", "--config", "vitest.benchmark.config.ts"],
        {
          cwd,
          stdio: "inherit",
          env: { ...process.env, DO_NOT_TRACK: "1" },
        },
      );
      const raw = path.join(cwd, "reports/benchmarks/raw");
      for (const file of readdirSync(raw).filter((file) => file.endsWith(".json"))) {
        const result = JSON.parse(readFileSync(path.join(raw, file), "utf8"));
        (collected[file.slice(0, -5)] ??= []).push(result.latency.mean);
      }
    }
    if (
      !Object.keys(collected).length ||
      Object.values(collected).some((values) => values.length !== manifest.repetitions)
    )
      throw new Error("Raccolta benchmark incompleta.");
    return collected;
  };
  let baseline;
  let reason = "base non richiesta";
  let temporary;
  try {
    if (requestedBase) {
      const resolved = spawnSync("git", ["rev-parse", "--verify", `${requestedBase}^{commit}`], {
        cwd: root,
        encoding: "utf8",
      });
      if (resolved.status === 0) manifest.base = resolved.stdout.trim();
      else reason = "commit base non disponibile";
    }
    writeFileSync(path.join(directory, "manifest.json"), JSON.stringify(manifest, null, 2));
    if (manifest.base) {
      const basePackage = JSON.parse(git("show", `${manifest.base}:package.json`));
      const headPackage = JSON.parse(readFileSync("package.json", "utf8"));
      if (!comparableDependencies(basePackage, headPackage)) {
        reason = "dipendenze applicative, Node o Vitest diversi";
      } else {
        // Il solo sorgente applicativo viene dalla base; il test prestazionale resta identico.
        temporary = mkdtempSync(path.join(tmpdir(), "fiscalbay-benchmark-"));
        extractBenchmarkSources(root, manifest.base, temporary);
        for (const file of ["package.json", "vitest.benchmark.config.ts", ...configs, "benchmarks"])
          cpSync(path.join(root, file), path.join(temporary, file), { recursive: true });
        symlinkSync(path.join(root, "node_modules"), path.join(temporary, "node_modules"), "dir");
        baseline = samples(temporary);
        writeFileSync(path.join(directory, "base.json"), JSON.stringify(baseline, null, 2));
      }
    }
    const current = samples(root);
    const summary = benchmarkSummary(current, baseline, reason);
    writeFileSync(path.join(directory, "current.json"), JSON.stringify(current, null, 2));
    writeFileSync(
      path.join(directory, "manifest.json"),
      JSON.stringify({ ...manifest, reason: baseline ? null : reason }, null, 2),
    );
    writeFileSync(path.join(directory, "summary.md"), summary);
    console.log(summary);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  } finally {
    if (temporary && existsSync(temporary)) rmSync(temporary, { recursive: true, force: true });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
