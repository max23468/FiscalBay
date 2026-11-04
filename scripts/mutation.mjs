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
 * Stryker gira in modo incrementale: con `MUTATION_INCREMENTAL_BASE`, il report di una prova
 * precedente, ripete soltanto i mutanti con codice o test cambiati.
 * `--incremental-base <file>` scrive quel report dalle prove precedenti della PR o, senza, dal
 * riferimento di `develop` in `MUTATION_REFERENCE`.
 */
import { execFileSync, spawn } from "node:child_process";
import {
  appendFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { availableParallelism, totalmem } from "node:os";
import { importGraph } from "./verify-repo.mjs";
import { gh, ghJson } from "./lib/provider.mjs";

/**
 * Regole condivise dei moduli critici: dati fiscali, orari, lista ordini, coda,
 * sospensione del servizio e periodicità degli abbonamenti.
 */
const criticalShared = new Set([
  "app/service-activity.server.ts",
  "app/markup.ts",
  "app/tax-quality.ts",
  "app/time.ts",
  "app/orders/order-list.ts",
  "app/domain/work-timing.ts",
  "app/domain/subscription-offers.ts",
  "app/domain/auth-attempts.server.ts",
  "app/domain/deletion-steps.server.ts",
  "app/domain/webhook-receipts.server.ts",
]);

/**
 * Moduli server di Auth, filtro delle richieste, sessioni, chiavi derivate, isolamento, ordini, export e file XLSX, negozi
 * e loro segni, integrazioni, diritti e destinatari Telegram.
 */
export function criticalModule(file) {
  return (
    criticalShared.has(file) ||
    /^app\/(?:auth(?:-route)?|request-limits|sealed|domain\/(?:billing|refunds|orders|order-import|order-observation|order-acquisition|order-sync|order-export|quota|grants|cycles|sessions|sign-in-methods|registration|stores|store-marks|export|xlsx|telegram)|integrations\/(?:webhooks|stripe|telegram|ebay\/(?:environment|notifications|seller-credentials|store-link|tax-identifiers|fulfillment))).*\.server\.ts$/u.test(
      file,
    )
  );
}

/**
 * Moduli non critici importati dai moduli critici: testi, link, tipi, errori e servizi provati
 * dalla suite senza mutation. Un modulo nuovo importato da un modulo critico, per esempio una
 * regola estratta, ferma `pnpm test:scripts` finché non diventa critico o non entra qui.
 */
export const supportModules = new Set([
  "app/account-email.server.ts",
  "app/account/device-name.ts",
  "app/app-copy.ts",
  "app/app-links.ts",
  "app/bot-commands.ts",
  "app/catalog.ts",
  "app/contact.ts",
  "app/copy/copy-it.ts",
  "app/copy/telegram.ts",
  "app/domain/account-deletion.server.ts",
  "app/domain/admission-state.server.ts",
  "app/domain/admission.server.ts",
  "app/domain/email-change.server.ts",
  "app/domain/history-window.server.ts",
  "app/domain/lifetime.server.ts",
  "app/domain/order-events.server.ts",
  "app/domain/order-suggestions.server.ts",
  "app/domain/order-view.server.ts",
  "app/domain/owner-notifications.server.ts",
  "app/domain/service-settings.server.ts",
  "app/domain/sql.server.ts",
  "app/domain/store-link.server.ts",
  "app/domain/store-profile.server.ts",
  "app/domain/store-state.server.ts",
  "app/errors.ts",
  "app/i18n.ts",
  "app/integrations/ebay/trading.server.ts",
  "app/integrations/http.server.ts",
  "app/limits.ts",
  "app/log-records.ts",
  "app/money.ts",
  "app/orders/ebay-links.ts",
  "app/orders/export-columns.ts",
  "app/orders/export-scope.server.ts",
  "app/orders/order-search.ts",
  "app/password.server.ts",
  "app/preferences.ts",
  "app/request-limits.ts",
  "app/response-cookies.server.ts",
  "app/sequence.ts",
  "app/view-models.ts",
]);

/** Import dei moduli critici verso moduli non critici e non dichiarati, e dichiarazioni superate. */
export function mutationCoverageGaps(files) {
  const graph = importGraph(files);
  const used = new Set();
  const gaps = [];
  for (const [file, targets] of graph) {
    if (!criticalModule(file)) continue;
    for (const target of targets) {
      if (criticalModule(target)) continue;
      used.add(target);
      if (!supportModules.has(target)) gaps.push(`${file} importa ${target}, non critico`);
    }
  }
  for (const module of supportModules)
    if (!used.has(module)) gaps.push(`${module} non serve più ai moduli critici`);
  return gaps;
}

// Le prove unitarie Node coprono questi moduli; gli altri usano la suite Cloudflare.
const unitTargets = new Set([
  "app/auth-route.server.ts",
  "app/request-limits.server.ts",
  "app/integrations/ebay/fulfillment.server.ts",
  "app/markup.ts",
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
 * Prima i file che importano il modulo direttamente: un mutante statico esegue tutta la selezione
 * e deve incontrare il test che lo uccide prima del timeout di Stryker.
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
  const direct = (file) => graph.get(file)?.has(target);
  return tests.length ? [...tests.filter(direct), ...tests.filter((file) => !direct(file))] : suite;
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
  return shardRanges(
    mutants,
    Math.max(1, Math.ceil(mutants.length / mutantsPerShard)),
    lastLine,
  ).map((range) => ({
    ...range,
    mutants: mutants.filter(({ start, end }) => start >= range.start && end <= range.end).length,
  }));
}

/**
 * Job della matrice, una parte per intervallo di ogni modulo. GitHub li avvia in quest'ordine:
 * i più pesanti, mutanti per test che coprono il modulo, entrano per primi nei posti disponibili.
 */
export async function mutationJobs(targets, shardsOf = moduleShards, testsOf = () => 1) {
  const jobs = await Promise.all(
    targets.map(async (target) => {
      const shards = await shardsOf(target);
      return shards.map(({ mutants }, index) => ({
        job: { target, shard: `${index + 1}/${shards.length}` },
        weight: mutants * testsOf(target),
      }));
    }),
  );
  return {
    include: jobs
      .flat()
      .sort((first, second) => second.weight - first.weight)
      .map(({ job }) => job),
  };
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

const mutantKey = ({ mutatorName, replacement, location }) =>
  `${mutatorName}|${replacement ?? ""}|${location.start.line}:${location.start.column}-${location.end.line}:${location.end.column}`;

/** Esiti che dipendono soltanto da codice e test: timeout ed errori si provano di nuovo. */
const stableStatuses = new Set(["Killed", "Survived", "NoCoverage", "Ignored"]);

/**
 * Un solo report incrementale dalle parti di una prova precedente: mutanti dello stesso sorgente
 * riuniti senza doppioni, test per nome. Stryker identifica mutanti e test per contenuto e
 * posizione, non per numero, quindi le parti si sommano. Timeout ed errori, che possono dipendere
 * dal carico del runner, restano fuori e si ripetono.
 */
export function mergeReports(reports) {
  if (!reports.length) return undefined;
  const files = {};
  const testFiles = {};
  for (const report of reports) {
    for (const [file, entry] of Object.entries(report.files ?? {})) {
      const mutants = entry.mutants.filter(({ status }) => stableStatuses.has(status));
      const current = files[file];
      if (!current) files[file] = { ...entry, mutants };
      else if (current.source === entry.source) {
        const known = new Set(current.mutants.map(mutantKey));
        current.mutants.push(...mutants.filter((mutant) => !known.has(mutantKey(mutant))));
      }
    }
    for (const [file, entry] of Object.entries(report.testFiles ?? {})) testFiles[file] ??= entry;
  }
  return { ...reports[0], files, testFiles };
}

/** Report incrementali di `target` in una cartella di artefatti scaricati. */
function incrementalReports(directory, target) {
  const slug = target.replaceAll("/", "_");
  const found = [];
  const visit = (folder) => {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const file = path.join(folder, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.name === "incremental.json" && path.basename(folder).startsWith(slug))
        found.push(JSON.parse(readFileSync(file, "utf8")));
    }
  };
  visit(directory);
  return found;
}

/**
 * File che possono cambiare fra la prova precedente e quella attuale senza invalidarne la base:
 * Stryker confronta il testo di ogni mutante e i file di test, ma non vede le altre righe del
 * modulo, i moduli importati né helper e fixture dei test.
 */
export const incrementalSafe = (file) =>
  /^test\/.+\.(?:spec|unit)\.ts$|\.md$|^docs\/|^changes\//u.test(file);

/**
 * Base incrementale della mutation della PR: le prove del modulo nella run precedente più recente
 * della stessa PR, dello stesso repository, se da allora sono cambiati soltanto test e documenti.
 * Senza, il riferimento di `develop` (`MUTATION_REFERENCE`), salvato dall'ultima qualifica o
 * campagna riuscita del modulo: Stryker ripete i mutanti con codice o test cambiati da allora.
 * Senza riferimento il modulo si prova per intero.
 */
async function writeIncrementalBase(output) {
  const { REPOSITORY: repository, HEAD_REF: branch, GITHUB_RUN_ID: current } = process.env;
  const { HEAD_SHA: head, GITHUB_RUN_ATTEMPT: attempt = "1" } = process.env;
  const target = process.env.MUTATION_TARGET;
  const repositoryId = Number(process.env.REPOSITORY_ID);
  if (!repository || !branch || !target || !repositoryId || !head)
    throw new Error("PR, repository, testa o modulo della base incrementale non indicati.");
  const { workflow_runs: runs } = ghJson(
    "api",
    `repos/${repository}/actions/workflows/ci.yml/runs?event=pull_request&branch=${encodeURIComponent(branch)}&per_page=20`,
  );
  // Una ripetizione dei job falliti parte dai tentativi precedenti della stessa run.
  for (const run of runs.filter(
    (entry) =>
      (String(entry.id) !== current || Number(attempt) > 1) &&
      entry.head_repository?.id === repositoryId,
  )) {
    if (run.head_sha !== head) {
      const { files = [] } = ghJson("api", `repos/${repository}/compare/${run.head_sha}...${head}`);
      const changed = files
        .map(({ filename }) => filename)
        .filter((file) => !incrementalSafe(file));
      if (changed.length) {
        console.log(
          `Base incrementale della run ${run.id} non riusabile: cambiati ${changed.slice(0, 5).join(", ")}.`,
        );
        break;
      }
    }
    const directory = mkdtempSync(path.join(tmpdir(), "mutation-base-"));
    try {
      try {
        gh(
          "run",
          "download",
          String(run.id),
          "--repo",
          repository,
          "--pattern",
          `mutation-pr-${run.id}-*`,
          "--dir",
          directory,
        );
      } catch {
        continue;
      }
      const report = mergeReports(incrementalReports(directory, target));
      if (!report) continue;
      writeFileSync(output, JSON.stringify(report));
      console.log(`Base incrementale di ${target}: run ${run.id}.`);
      return;
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }
  const reference = process.env.MUTATION_REFERENCE;
  if (reference && existsSync(reference)) {
    copyFileSync(reference, output);
    console.log(`Base incrementale di ${target}: riferimento di develop.`);
  } else console.log(`Nessuna base incrementale di ${target}: mutation dell'intero modulo.`);
}

/**
 * Moduli critici che la PR prova: quelli con il sorgente cambiato e quelli importati direttamente
 * da un test cambiato, perché un test indebolito lascia vivo un mutante anche su righe invariate.
 * I moduli raggiunti soltanto attraverso altri import restano al candidato e alla campagna: ogni
 * modulo in più costa la prova iniziale dell'intera suite che lo copre.
 */
export function prTargets(changed, files) {
  const present = new Set(files.map(({ path: file }) => file));
  const targets = new Set(changed.filter((file) => criticalModule(file) && present.has(file)));
  const tests = changed.filter(
    (file) => /^test\/.+\.(?:spec|unit)\.ts$/u.test(file) && present.has(file),
  );
  if (tests.length) {
    const graph = importGraph(files, /^(?:app|workers|test)\/.+\.tsx?$/u);
    for (const test of tests)
      for (const file of graph.get(test) ?? []) if (criticalModule(file)) targets.add(file);
  }
  return [...targets].sort();
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
  // Senza base Stryker prova tutti i mutanti e scrive comunque il report per la prova seguente.
  const incrementalFile = `${directory}/incremental.json`;
  const base = process.env.MUTATION_INCREMENTAL_BASE;
  if (base && existsSync(base)) copyFileSync(base, incrementalFile);
  writeFileSync(
    configPath,
    JSON.stringify({
      ...settings,
      incremental: true,
      incrementalFile,
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
  const {
    positionals: args,
    values: { matrix: matrixMode, "incremental-base": baseFile },
  } = parseArgs({
    allowPositionals: true,
    options: {
      matrix: { type: "boolean" },
      "incremental-base": { type: "string" },
    },
  });
  if (baseFile) {
    await writeIncrementalBase(baseFile);
    process.exit(0);
  }
  const files = sources();
  if (matrixMode) {
    const matrix = mutationMatrix(
      args.join(" "),
      files.map(({ path: file }) => file),
    );
    console.log(`Moduli critici: ${matrix.target.join(", ") || "nessuno"}.`);
    const jobs = await mutationJobs(
      matrix.target,
      moduleShards,
      (target) => consumerTests(target, files).length,
    );
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
