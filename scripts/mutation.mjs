#!/usr/bin/env node
/**
 * Mutation test mirati: esegue Stryker soltanto sui file o intervalli indicati
 * e fallisce per ogni mutante non ucciso. Timeout ed errori non valgono come
 * successo; un'equivalenza si motiva con un commento `Stryker disable` e resta
 * nel report come ignorata.
 * Uso: node scripts/mutation.mjs <file[:inizio-fine]>...
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

const accepted = new Set(["Killed", "Ignored"]);

/** Mutanti che fanno fallire la prova, dal report JSON di Stryker. */
export function evaluate(report) {
  const mutants = Object.entries(report.files ?? {}).flatMap(([file, { mutants }]) =>
    mutants.map((mutant) => ({ file, ...mutant })),
  );
  if (mutants.length === 0) return ["nessun mutante generato"];
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

/** Stryker non rileva cambiamenti negli helper, negli altri moduli o nell'ambiente.
 * Solo il sorgente mutato è escluso dal contesto: Stryker confronta quel file da sé.
 * I test, incluse fixture e setup, invalidano integralmente il riuso, anche dei mutanti statici.
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
  ]),
) {
  const source = files.find(({ path: file }) => file === target)?.text;
  if (source === undefined) throw new Error(`Sorgente mutation inesistente: ${target}`);
  const context = hash(
    JSON.stringify([
      runtime,
      target,
      files
        .filter(({ path: file }) => file !== target && !file.endsWith(".md"))
        .sort((a, b) => a.path.localeCompare(b.path)),
    ]),
  );
  const prefix = `mutation-${context}-`;
  return { target, prefix, key: `${prefix}${hash(source)}` };
}

function inputs() {
  return execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
    encoding: "utf8",
  })
    .split("\n")
    .filter((file) => file && existsSync(file))
    .map((file) => ({ path: file, text: readFileSync(file).toString("base64") }));
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
    run.path === ".github/workflows/ci.yml" &&
    jobs.some((job) => job.name === `Mutation / ${target}` && job.conclusion === "success")
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
  console.log(`Nessuna ricevuta mutation riusabile: ${expected.target}.`);
}

async function runTarget(target, files) {
  const file = target.split(":")[0];
  const expected = identity(file, files);
  const dir = directory(file);
  mkdirSync(dir, { recursive: true });
  const incremental = process.env.MUTATION_INCREMENTAL === "1" && target === file;
  const previous = `${dir}/context.json`;
  if (
    !incremental ||
    !existsSync(previous) ||
    JSON.parse(readFileSync(previous, "utf8")).prefix !== expected.prefix
  )
    rmSync(`${dir}/incremental.json`, { force: true });
  writeFileSync(previous, JSON.stringify(expected));
  const reportPath = `${dir}/mutation.json`;
  rmSync(reportPath, { force: true });
  rmSync(`${dir}/receipt.json`, { force: true });
  const config = {
    ...JSON.parse(readFileSync("stryker.config.json", "utf8")),
    mutate: [target],
    incremental,
    incrementalFile: `${dir}/incremental.json`,
    jsonReporter: { fileName: reportPath },
    ...(file === "app/auth-route.server.ts"
      ? { vitest: { configFile: "vitest.unit.config.ts" } }
      : {}),
  };
  const configPath = `${dir}/stryker.json`;
  writeFileSync(configPath, JSON.stringify(config));
  const start = Date.now();
  let failure;
  let log = "";
  try {
    const child = spawn("pnpm", ["exec", "stryker", "run", configPath], {
      stdio: ["inherit", "pipe", "pipe"],
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
  const failures = report ? evaluate(report) : ["report mutation assente"];
  const mutants = Object.values(report?.files ?? {}).flatMap(({ mutants }) => mutants);
  const counts = {};
  for (const { status } of mutants) counts[status] = (counts[status] ?? 0) + 1;
  const receipt = {
    ...expected,
    passed: !failure && failures.length === 0 && target === file,
    seconds: Math.round((Date.now() - start) / 1000),
    reused: Number(log.match(/Result:\s*(\d+) of/u)?.[1] ?? 0),
    reportDigest: report ? hash(JSON.stringify(report)) : null,
    counts,
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
    const [command, target] = targets;
    const expected = identity(target, files);
    const dir = directory(target);
    output({
      "cache-prefix": expected.prefix,
      "cache-key": expected.key,
      artifact: expected.key,
      directory: dir,
    });
    if (command === "--find") findVerified(expected);
    else if (command === "--check") {
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
