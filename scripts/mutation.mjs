#!/usr/bin/env node
/**
 * Mutation test mirati: esegue Stryker soltanto sui file o intervalli indicati
 * e fallisce per ogni mutante non ucciso. Timeout ed errori non valgono come
 * successo; un'equivalenza si motiva con un commento `Stryker disable` e resta
 * nel report come ignorata.
 * Gli intervalli di una PR (`file:10-20,40-42`) non producono ricevute riusabili: il
 * candidato qualifica sempre il modulo intero.
 * Uso: node scripts/mutation.mjs <file[:inizio-fine[,inizio-fine]...]>...
 */
import { execFileSync, spawn } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { availableParallelism, totalmem } from "node:os";
import { importPattern, resolveImport } from "./verify-repo.mjs";

export function mutationConcurrency(configured, cpu = availableParallelism(), memory = totalmem()) {
  // Vitest e workerd convivono nello stesso runner: riservare 4 GiB per processo.
  return Math.max(1, Math.min(configured, cpu, Math.floor(memory / (4 * 1024 ** 3))));
}

const accepted = new Set(["Killed", "Ignored"]);

/** Mutanti che fanno fallire la prova, dal report JSON di Stryker. */
export function evaluate(report, ranged = false) {
  const mutants = Object.entries(report.files ?? {}).flatMap(([file, { mutants }]) =>
    mutants.map((mutant) => ({ file, ...mutant })),
  );
  // Righe cambiate senza codice mutabile (commenti, tipi) non hanno mutanti da uccidere.
  if (mutants.length === 0) return ranged ? [] : ["nessun mutante generato"];
  return mutants
    .filter(
      ({ status, statusReason }) =>
        !accepted.has(status) || (status === "Ignored" && !statusReason),
    )
    .map(
      ({ file, location, mutatorName, status }) =>
        `${file}:${location.start.line}:${location.start.column + 1}: ${mutatorName} ${status}`,
    );
}

const hash = (value) => createHash("sha256").update(value).digest("hex");

/** Conserva tutti i test consumatori e i loro input; import ambigui richiedono il completo. */
export function mutationInputs(target, files) {
  const unit = ["app/auth-route.server.ts", "app/integrations/ebay/fulfillment.server.ts"].includes(
    target,
  );
  const suite = files.filter(({ path: file }) =>
    unit ? file.endsWith(".unit.ts") : file.endsWith(".spec.ts") && file.startsWith("test/"),
  );
  const known = new Map(files.map((file) => [file.path, file]));
  const graph = new Map();
  let ambiguous = false;
  for (const { text } of files.filter(({ path: file }) => /^tsconfig.*\.json$/u.test(file))) {
    try {
      const paths = JSON.parse(text).compilerOptions?.paths ?? {};
      if (
        Object.keys(paths).some((alias) => alias !== "~/*") ||
        (paths["~/*"] && JSON.stringify(paths["~/*"]) !== '["./app/*"]')
      )
        ambiguous = true;
    } catch {
      // Una configurazione non leggibile non consente una firma ridotta.
      ambiguous = true;
    }
  }
  const sources = files.filter(
    ({ path: file }) =>
      /^(?:app|workers|test)\/.*\.[cm]?[jt]sx?$/u.test(file) ||
      /^[^/]+\.config\.[cm]?[jt]s$/u.test(file),
  );
  const queued = new Set(sources.map((source) => source.path));
  for (const { path: file, text } of sources) {
    const imports = new Set();
    // I tipi delle route sono generati e non eseguiti dal runner.
    const source = text.replace(
      /(?:^|\n)\s*import\s+type\s+(?:\{[^{};"'`]*\}|[\w$]+)\s+from\s*["'][^"'\n]+["']\s*;?/gu,
      "",
    );
    if (
      /\b(?:import|require|(?:vi|vitest)\.(?:mock|doMock))\s*\(\s*(?!["'\s])|import\.meta\.glob|\b(?:eval|Function)\s*\(/u.test(
        source,
      )
    )
      ambiguous = true;
    for (const match of source.matchAll(importPattern)) {
      const specifier = match[1] ?? match[2];
      if (!specifier.startsWith(".") && !specifier.startsWith("~/")) continue;
      const resolved = resolveImport(file, specifier, known);
      if (resolved) imports.add(resolved);
      else ambiguous = true;
    }
    // Un require o mock può caricare un modulo senza un import ES.
    for (const match of source.matchAll(
      /\b(?:require|(?:vi|vitest)\.(?:mock|doMock))\s*\(\s*["']([^"']+)["']/gu,
    )) {
      const specifier = match[1];
      if (!specifier.startsWith(".") && !specifier.startsWith("~/")) continue;
      const resolved = resolveImport(file, specifier, known);
      if (resolved) imports.add(resolved);
      else ambiguous = true;
    }
    for (const match of source.matchAll(
      /new\s+URL\(\s*["'](\.[^"']+)["']\s*,\s*import\.meta\.url/gu,
    )) {
      const resolved = resolveImport(file, match[1], known);
      if (resolved) imports.add(resolved);
      else ambiguous = true;
    }
    graph.set(file, imports);
    for (const dependency of imports) {
      if (!queued.has(dependency) && /\.[cm]?[jt]sx?$/u.test(dependency)) {
        queued.add(dependency);
        sources.push(known.get(dependency));
      }
    }
  }
  const closure = (entry) => {
    const visited = new Set();
    const queue = [entry];
    while (queue.length) {
      const file = queue.pop();
      if (visited.has(file)) continue;
      visited.add(file);
      queue.push(...(graph.get(file) ?? []));
    }
    return visited;
  };
  const tests = suite
    .filter(({ path: file }) => closure(file).has(target))
    .map(({ path: file }) => file)
    .sort();
  if (ambiguous || tests.length === 0)
    return {
      files: files.filter(({ path: file }) => !file.endsWith(".md")),
      tests: suite.map(({ path: file }) => file).sort(),
      mode: "full",
    };
  const selected = new Set([
    target,
    ...tests.flatMap((file) => [...closure(file)]),
    ...closure(target),
    ...files
      .filter(
        ({ path: file }) =>
          (file.startsWith("test/") && !/\.(?:spec|unit)\.ts$/u.test(file)) ||
          /^[^/]+\.config\.[cm]?[jt]s$/u.test(file),
      )
      .flatMap(({ path: file }) => [...closure(file)]),
  ]);
  return {
    files: files.filter(
      ({ path: file }) =>
        !file.endsWith(".md") &&
        (selected.has(file) ||
          (!/^(?:app|workers|e2e|placeholder|\.github)\//u.test(file) &&
            !/^test\/.*\.(?:spec|unit)\.ts$/u.test(file)) ||
          /^\.github\/workflows\/(?:ci|mutation|publish|qualify)\.yml$/u.test(file)),
    ),
    tests,
    mode: "targeted",
  };
}

/** Stryker confronta il testo dei singoli mutanti, non tutte le loro dipendenze.
 * Anche un helper nello stesso sorgente può cambiarne l'esito: il riuso richiede
 * tutti gli input identici, inclusi sorgente, test, fixture, setup e runtime.
 */
export function identity(
  target,
  files,
  runtime = JSON.stringify([
    process.version,
    process.platform,
    process.arch,
    process.env.CLOUDFLARE_ENV,
    process.env.NODE_OPTIONS,
    process.env.TZ,
    process.env.CI,
    process.env.ImageOS,
    process.env.ImageVersion,
    availableParallelism(),
    mutationConcurrency(Number.MAX_SAFE_INTEGER),
  ]),
) {
  const source = files.find(({ path: file }) => file === target)?.text;
  if (source === undefined) throw new Error(`Sorgente mutation inesistente: ${target}`);
  const selected = mutationInputs(target, files);
  const context = hash(
    JSON.stringify([
      runtime,
      target,
      selected.files.sort((a, b) => a.path.localeCompare(b.path)),
      selected.tests,
      selected.mode,
    ]),
  );
  const prefix = `mutation-${context}-`;
  return {
    target,
    prefix,
    key: `${prefix}${hash(source)}`,
    tests: selected.tests,
    mode: selected.mode,
  };
}

function inputs() {
  return execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
    encoding: "utf8",
  })
    .split("\n")
    .filter((file) => file && existsSync(file))
    .map((file) => {
      const content = readFileSync(file);
      return { path: file, text: content.toString("utf8"), digest: hash(content) };
    });
}

function directory(target) {
  return `reports/mutation/${hash(target).slice(0, 16)}`;
}

export function checkReceipt(expected, receipt, report, source) {
  if (receipt.key !== expected.key || receipt.target !== expected.target || !receipt.passed)
    throw new Error("Ricevuta mutation incompatibile o non riuscita.");
  if (
    Object.keys(report.files ?? {}).length !== 1 ||
    report.files[expected.target]?.source !== source
  )
    throw new Error("Report mutation di un sorgente differente.");
  if (receipt.reportDigest !== hash(JSON.stringify(report)))
    throw new Error("Report mutation incompleto o modificato.");
  const failures = evaluate(report);
  if (failures.length) throw new Error(failures.join("\n"));
}

/** Una prova del modulo può essere valida anche se un altro job della CI fallisce. */
export function verifiedMutationOrigin(candidate, run, jobs, repositoryId, target) {
  const origin = candidate.workflow_run;
  return (
    !candidate.expired &&
    origin?.repository_id === repositoryId &&
    origin.head_repository_id === repositoryId &&
    [".github/workflows/ci.yml", ".github/workflows/publish.yml"].includes(run.path) &&
    jobs.some(
      (job) =>
        [`Mutation / ${target}`, `Qualifica candidato / Mutation / ${target}`].includes(job.name) &&
        job.conclusion === "success",
    )
  );
}

function output(values) {
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      Object.entries(values)
        .map(([key, value]) => `${key}=${value}\n`)
        .join(""),
    );
}

function findVerified(expected) {
  const repository = process.env.REPOSITORY;
  const repositoryId = Number(process.env.REPOSITORY_ID);
  if (!repository || !repositoryId) throw new Error("Repository non identificato.");
  const artifact = expected.key;
  const api = (url) => JSON.parse(execFileSync("gh", ["api", url], { encoding: "utf8" }));
  const candidates = api(
    `repos/${repository}/actions/artifacts?name=${artifact}&per_page=20`,
  ).artifacts;
  for (const candidate of candidates) {
    const origin = candidate.workflow_run;
    if (
      candidate.expired ||
      origin?.repository_id !== repositoryId ||
      origin.head_repository_id !== repositoryId
    )
      continue;
    const run = api(`repos/${repository}/actions/runs/${origin.id}`);
    const { jobs } = api(`repos/${repository}/actions/runs/${origin.id}/jobs?per_page=100`);
    if (!verifiedMutationOrigin(candidate, run, jobs, repositoryId, expected.target)) continue;
    output({ "run-id": origin.id });
    console.log(`Mutation già verificata dalla run ${origin.id}: ${expected.target}.`);
    return;
  }
  const reason =
    candidates.length === 0
      ? "input del modulo senza ricevuta"
      : "origine, esito o scadenza non validi";
  console.log(`Nessuna ricevuta mutation riusabile: ${expected.target}; ${reason}.`);
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `\n${expected.target}: ${expected.mode}, ${expected.tests.length} file di test; ${reason}.\n`,
    );
}

/** Modulo e voci `mutate` di Stryker per un bersaglio intero o a intervalli. */
export function parseTarget(target) {
  const [file, lines] = target.split(":");
  return {
    file,
    ranged: lines !== undefined,
    mutate: lines === undefined ? [file] : lines.split(",").map((range) => `${file}:${range}`),
  };
}

async function runTarget(target, files) {
  const { file, ranged, mutate } = parseTarget(target);
  const expected = identity(file, files);
  const dir = directory(file);
  mkdirSync(dir, { recursive: true });
  const incremental = process.env.MUTATION_INCREMENTAL === "1" && !ranged;
  const previous = `${dir}/context.json`;
  if (
    !incremental ||
    !existsSync(previous) ||
    JSON.parse(readFileSync(previous, "utf8")).key !== expected.key
  )
    rmSync(`${dir}/incremental.json`, { force: true });
  writeFileSync(previous, JSON.stringify(expected));
  const reportPath = `${dir}/mutation.json`;
  rmSync(reportPath, { force: true });
  rmSync(`${dir}/receipt.json`, { force: true });
  const config = {
    ...JSON.parse(readFileSync("stryker.config.json", "utf8")),
    concurrency: mutationConcurrency(
      JSON.parse(readFileSync("stryker.config.json", "utf8")).concurrency,
    ),
    mutate,
    incremental,
    incrementalFile: `${dir}/incremental.json`,
    jsonReporter: { fileName: reportPath },
    vitest: { configFile: "vitest.mutation.config.ts" },
  };
  const configPath = `${dir}/stryker.json`;
  writeFileSync(configPath, JSON.stringify(config));
  const start = Date.now();
  let failure;
  let log = "";
  try {
    const child = spawn("pnpm", ["exec", "stryker", "run", configPath], {
      stdio: ["inherit", "pipe", "pipe"],
      env: {
        ...process.env,
        MUTATION_TARGET: file,
        MUTATION_TEST_FILES: JSON.stringify(expected.tests),
      },
    });
    for (const [stream, destination] of [
      [child.stdout, process.stdout],
      [child.stderr, process.stderr],
    ])
      stream.on("data", (chunk) => {
        log += chunk;
        destination.write(chunk);
      });
    const code = await new Promise((resolve, reject) => {
      child.on("error", reject);
      child.on("close", resolve);
    });
    if (code !== 0) failure = new Error(`Stryker terminato con codice ${code}.`);
  } catch (error) {
    failure = error;
  }
  writeFileSync(`${dir}/stryker.log`, log);
  const report = existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, "utf8")) : undefined;
  const failures = report
    ? evaluate(report, ranged)
    : ranged && !failure
      ? []
      : ["report mutation assente"];
  const mutants = Object.values(report?.files ?? {}).flatMap(({ mutants }) => mutants);
  const counts = {};
  for (const { status } of mutants) counts[status] = (counts[status] ?? 0) + 1;
  const receipt = {
    ...expected,
    passed: !failure && failures.length === 0 && !ranged,
    seconds: Math.round((Date.now() - start) / 1000),
    reused: Number(log.match(/Result:\s*(\d+) of/u)?.[1] ?? 0),
    reportDigest: report ? hash(JSON.stringify(report)) : null,
    counts,
    dryRun: log.match(/Initial test run succeeded\.[^\n]*/u)?.[0] ?? "",
  };
  writeFileSync(`${dir}/receipt.json`, JSON.stringify(receipt, null, 2));
  const summary = `${target}: ${receipt.seconds}s, ${receipt.reused} mutanti riutilizzati, ${JSON.stringify(counts)}, ${failures.length} problemi.\n`;
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  for (const item of failures) console.error(`Mutante non ucciso: ${item}`);
  if (failure || failures.length) return false;
  console.log("Mutation: tutti i mutanti uccisi o motivati.");
  return true;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const targets = process.argv.slice(2);
  if (targets.length === 0) {
    console.error("Uso: node scripts/mutation.mjs <file[:inizio-fine]>...");
    process.exit(2);
  }
  const files = inputs();
  if (targets[0].startsWith("--")) {
    const [command, requested] = targets;
    const { file: target, ranged } = parseTarget(requested);
    const expected = identity(target, files);
    const dir = directory(target);
    output({
      "cache-prefix": expected.prefix,
      "cache-key": expected.key,
      artifact: expected.key,
      directory: dir,
      reusable: !ranged,
    });
    if (command === "--find") {
      if (ranged) console.log(`Intervalli di ${target}: nessuna ricevuta del modulo intero.`);
      else findVerified(expected);
    } else if (command === "--check") {
      checkReceipt(
        expected,
        JSON.parse(readFileSync(`${dir}/receipt.json`, "utf8")),
        JSON.parse(readFileSync(`${dir}/mutation.json`, "utf8")),
        readFileSync(target, "utf8"),
      );
      console.log(`Ricevuta mutation confermata: ${target}.`);
    } else if (command !== "--identity")
      throw new Error(`Comando mutation sconosciuto: ${command}`);
  } else {
    for (const target of targets) if (!(await runTarget(target, files))) process.exitCode = 1;
  }
}
