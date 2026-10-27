#!/usr/bin/env node
/**
 * Mutation test dei moduli critici: esegue Stryker sui file indicati e fallisce per ogni
 * mutante non ucciso. Timeout ed errori non valgono come successo; un'equivalenza si motiva
 * con un commento `Stryker disable` e resta nel report come ignorata.
 * Uso: node scripts/mutation.mjs <file>...
 *      node scripts/mutation.mjs --matrix [<file>... | <matrice JSON>]
 * `--matrix` scrive la matrice dei job per GitHub; senza file comprende tutti i moduli critici.
 * Un modulo con molti mutanti si divide in parti, eseguite in job paralleli: con
 * `MUTATION_SHARD=<parte>/<parti>` lo script prova soltanto la parte indicata.
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
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { availableParallelism, totalmem } from "node:os";
import { importGraph } from "./verify-repo.mjs";

/**
 * Moduli server di Auth, sessioni, isolamento, ordini, export, negozi, integrazioni, diritti e
 * destinatari Telegram.
 */
export function criticalModule(file) {
  return (
    file === "app/tax-quality.ts" ||
    /^app\/(?:auth(?:-route)?|domain\/(?:billing|refunds|orders|order-import|order-acquisition|order-sync|quota|grants|cycles|sessions|sign-in-methods|registration|stores|export|telegram)|integrations\/(?:webhooks|stripe|telegram|ebay\/(?:notifications|seller-credentials|store-link|tax-identifiers|fulfillment))).*\.server\.ts$/u.test(
      file,
    )
  );
}

// Le prove unitarie Node coprono questi moduli; gli altri usano la suite Cloudflare.
const unitTargets = new Set([
  "app/auth-route.server.ts",
  "app/integrations/ebay/fulfillment.server.ts",
  "app/tax-quality.ts",
]);

export function mutationConcurrency(configured, cpu = availableParallelism(), memory = totalmem()) {
  // Vitest e workerd convivono nello stesso runner: riservare 4 GiB per processo.
  return Math.max(1, Math.min(configured, cpu, Math.floor(memory / (4 * 1024 ** 3))));
}

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

/**
 * Test della suite pertinente che importano il modulo, anche indirettamente. Senza consumatori
 * riconoscibili resta l'intera suite: un test mancante produce sopravvissuti, non un successo.
 */
export function consumerTests(target, files) {
  const suite = files
    .map(({ path: file }) => file)
    .filter((file) =>
      unitTargets.has(target)
        ? /^test\/.+\.unit\.ts$/u.test(file)
        : /^test\/.+\.spec\.ts$/u.test(file),
    )
    .sort();
  const graph = importGraph(files, /^(?:app|workers|test)\/.+\.tsx?$/u);
  const reaches = (entry) => {
    const visited = new Set();
    const queue = [entry];
    while (queue.length) {
      const file = queue.pop();
      if (visited.has(file)) continue;
      visited.add(file);
      queue.push(...(graph.get(file) ?? []));
    }
    return visited.has(target);
  };
  const tests = suite.filter(reaches);
  return tests.length ? tests : suite;
}

/** Mutanti provati in un job: oltre, il modulo si divide in parti di circa quindici minuti. */
export const mutantsPerShard = 150;

/**
 * Righe, numerate da 1, dei mutanti che Stryker genera nel modulo, con lo stesso instrumenter e
 * le equivalenze motivate comprese.
 */
export async function mutantLines(file) {
  const core = createRequire(import.meta.resolve("@stryker-mutator/core"));
  const { Instrumenter } = await import(
    pathToFileURL(core.resolve("@stryker-mutator/instrumenter")).href
  );
  const silent = () => {};
  const logger = {
    ...Object.fromEntries(
      ["debug", "info", "warn", "error", "trace"].map((level) => [level, silent]),
    ),
    isDebugEnabled: () => false,
    isTraceEnabled: () => false,
  };
  const { mutants } = await new Instrumenter(logger).instrument(
    [{ name: file, content: readFileSync(file, "utf8"), mutate: true }],
    { plugins: null, excludedMutations: [], ignorers: [], noHeader: true },
  );
  return mutants.map(({ location }) => ({
    start: location.start.line + 1,
    end: location.end.line + 1,
  }));
}

/**
 * Intervalli di righe di `shards` parti con circa lo stesso numero di mutanti. Stryker genera
 * un mutante soltanto se il suo nodo sta per intero in un intervallo: si taglia soltanto fra due
 * righe che nessun mutante attraversa, così ogni mutante sta in una sola parte.
 */
export function shardRanges(mutants, shards, lastLine) {
  const crossed = (line) => mutants.some(({ start, end }) => start < line && end >= line);
  const before = (line) => mutants.filter(({ end }) => end < line).length;
  const cuts = [];
  for (let part = 1; part < shards; part++) {
    const target = (part * mutants.length) / shards;
    let best = null;
    for (let line = (cuts.at(-1) ?? 1) + 1; line <= lastLine; line++)
      if (
        !crossed(line) &&
        (best === null || Math.abs(before(line) - target) < Math.abs(before(best) - target))
      )
        best = line;
    if (best !== null && before(best) > (cuts.length ? before(cuts.at(-1)) : 0)) cuts.push(best);
  }
  return [1, ...cuts].map((start, index) => ({
    start,
    end: (cuts[index] ?? lastLine + 1) - 1,
  }));
}

/** Intervalli delle parti del modulo, una ogni `mutantsPerShard` mutanti dove i tagli lo consentono. */
export async function moduleShards(file) {
  const mutants = await mutantLines(file);
  const lastLine = readFileSync(file, "utf8").split("\n").length;
  return shardRanges(mutants, Math.max(1, Math.ceil(mutants.length / mutantsPerShard)), lastLine);
}

/** Job della matrice: una parte per intervallo di ogni modulo. */
export async function mutationJobs(targets, shardsOf = moduleShards) {
  const jobs = await Promise.all(
    targets.map(async (target) => {
      const shards = (await shardsOf(target)).length;
      return Array.from({ length: shards }, (_, index) => ({
        target,
        shard: `${index + 1}/${shards}`,
      }));
    }),
  );
  return { include: jobs.flat() };
}

/** Matrice dei job: JSON già pronto, file indicati o tutti i moduli critici. */
export function mutationMatrix(argument, files) {
  if (argument.trim().startsWith("{")) {
    const matrix = JSON.parse(argument);
    if (!Array.isArray(matrix.target) || matrix.target.some((file) => !criticalModule(file)))
      throw new Error("Matrice mutation non valida.");
    return matrix;
  }
  const requested = argument.split(/\s+/u).filter(Boolean);
  for (const file of requested)
    if (!criticalModule(file) || !files.includes(file))
      throw new Error(`Modulo critico inesistente: ${file}`);
  return { target: requested.length ? requested : files.filter(criticalModule).sort() };
}

function sources() {
  return execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
    encoding: "utf8",
  })
    .split("\n")
    .filter((file) => /^(?:app|workers|test)\/.+\.tsx?$/u.test(file) && existsSync(file))
    .map((file) => ({ path: file, text: readFileSync(file, "utf8") }));
}

async function runTarget(target, files, shard = "1/1") {
  if (!criticalModule(target) || !existsSync(target))
    throw new Error(`Modulo critico inesistente: ${target}`);
  const [part, shards] = shard.split("/").map(Number);
  if (!Number.isInteger(part) || !Number.isInteger(shards) || part < 1 || part > shards)
    throw new Error(`Parte mutation non valida: ${shard}`);
  const ranges = shards > 1 ? await moduleShards(target) : [null];
  // La matrice e il job leggono lo stesso sorgente: parti diverse indicano un altro commit.
  if (ranges.length !== shards) throw new Error(`Parti mutation diverse per ${target}: ${shard}`);
  const range = ranges[part - 1];
  const directory = `reports/mutation/${target.replaceAll("/", "_")}${shards > 1 ? `-${part}-${shards}` : ""}`;
  rmSync(directory, { recursive: true, force: true });
  mkdirSync(directory, { recursive: true });
  const reportPath = `${directory}/mutation.json`;
  const settings = JSON.parse(readFileSync("stryker.config.json", "utf8"));
  const configPath = `${directory}/stryker.json`;
  writeFileSync(
    configPath,
    JSON.stringify({
      ...settings,
      concurrency: mutationConcurrency(settings.concurrency),
      mutate: [range ? `${target}:${range.start}-${range.end}` : target],
      jsonReporter: { fileName: reportPath },
      vitest: { configFile: "vitest.mutation.config.ts" },
    }),
  );
  const tests = consumerTests(target, files);
  const start = Date.now();
  const code = await new Promise((resolve, reject) => {
    const child = spawn("pnpm", ["exec", "stryker", "run", configPath], {
      stdio: "inherit",
      env: {
        ...process.env,
        MUTATION_TARGET: target,
        MUTATION_TEST_FILES: JSON.stringify(tests),
      },
    });
    child.on("error", reject);
    child.on("close", resolve);
  });
  const report = existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, "utf8")) : undefined;
  const failures = report ? evaluate(report) : ["report mutation assente"];
  if (code !== 0) failures.push(`Stryker terminato con codice ${code}`);
  const counts = {};
  for (const { status } of Object.values(report?.files ?? {}).flatMap(({ mutants }) => mutants))
    counts[status] = (counts[status] ?? 0) + 1;
  const summary = `${target}${shards > 1 ? ` (parte ${shard})` : ""}: ${Math.round((Date.now() - start) / 1000)}s, ${tests.length} file di test, ${JSON.stringify(counts)}, ${failures.length} problemi.\n`;
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  for (const item of failures) console.error(`Mutante non ucciso: ${item}`);
  return failures.length === 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const files = sources();
  if (args[0] === "--matrix") {
    const matrix = mutationMatrix(
      args.slice(1).join(" "),
      files.map(({ path: file }) => file),
    );
    console.log(`Moduli critici: ${matrix.target.join(", ") || "nessuno"}.`);
    const jobs = await mutationJobs(matrix.target);
    console.log(
      `Job: ${jobs.include.map(({ target, shard }) => `${target} ${shard}`).join(", ")}.`,
    );
    if (process.env.GITHUB_OUTPUT)
      appendFileSync(process.env.GITHUB_OUTPUT, `matrix=${JSON.stringify(jobs)}\n`);
  } else if (args.length === 0) {
    console.error("Uso: node scripts/mutation.mjs <file>...");
    process.exitCode = 2;
  } else {
    for (const target of args)
      if (!(await runTarget(target, files, process.env.MUTATION_SHARD))) process.exitCode = 1;
  }
}
