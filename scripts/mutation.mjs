#!/usr/bin/env node
/**
 * Mutation test dei moduli critici: esegue Stryker sui file indicati e fallisce per ogni
 * mutante non ucciso. Timeout ed errori non valgono come successo; un'equivalenza si motiva
 * con un commento `Stryker disable` e resta nel report come ignorata.
 * Uso: node scripts/mutation.mjs <file>...
 *      node scripts/mutation.mjs --matrix [<file>... | <matrice JSON>]
 * `--matrix` scrive la matrice dei job per GitHub; senza file comprende tutti i moduli critici.
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
import { fileURLToPath } from "node:url";
import { availableParallelism, totalmem } from "node:os";
import { importGraph } from "./verify-repo.mjs";

/** Moduli server di Auth, sessioni, isolamento, ordini, export, negozi, integrazioni e diritti. */
export function criticalModule(file) {
  return (
    file === "app/tax-quality.ts" ||
    /^app\/(?:auth(?:-route)?|domain\/(?:billing|orders|order-import|order-acquisition|order-sync|quota|grants|cycles|sessions|sign-in-methods|registration|stores|export)|integrations\/(?:webhooks|stripe|ebay\/(?:notifications|seller-credentials|store-link|tax-identifiers|fulfillment))).*\.server\.ts$/u.test(
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

async function runTarget(target, files) {
  if (!criticalModule(target) || !existsSync(target))
    throw new Error(`Modulo critico inesistente: ${target}`);
  const directory = `reports/mutation/${target.replaceAll("/", "_")}`;
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
      mutate: [target],
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
  const summary = `${target}: ${Math.round((Date.now() - start) / 1000)}s, ${tests.length} file di test, ${JSON.stringify(counts)}, ${failures.length} problemi.\n`;
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
    if (process.env.GITHUB_OUTPUT)
      appendFileSync(process.env.GITHUB_OUTPUT, `matrix=${JSON.stringify(matrix)}\n`);
  } else if (args.length === 0) {
    console.error("Uso: node scripts/mutation.mjs <file>...");
    process.exitCode = 2;
  } else {
    for (const target of args) if (!(await runTarget(target, files))) process.exitCode = 1;
  }
}
