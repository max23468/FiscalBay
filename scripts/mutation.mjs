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
 * `--collect-references <cartella>` riunisce in `.mutation-references/` le parti riuscite di ogni
 * modulo di una run su `develop`; con `MUTATION_REFERENCES` la matrice della PR prova in un solo
 * job il modulo che ha un riferimento completo e pochi mutanti da ripetere.
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
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { availableParallelism, totalmem } from "node:os";
import { importGraph } from "./verify-repo.mjs";
import { gh, ghJson } from "./lib/provider.mjs";
import { criticalModule } from "./lib/critical-modules.mjs";
import { pullRequestProof } from "./mutation-reuse.mjs";

export { criticalModule };

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
  "app/domain/buyer-check.server.ts",
  "app/domain/email-change.server.ts",
  "app/domain/exit-feedback.server.ts",
  "app/domain/history-window.server.ts",
  "app/domain/lifetime.server.ts",
  "app/domain/order-events.server.ts",
  "app/domain/order-suggestions.server.ts",
  "app/domain/order-view.server.ts",
  "app/domain/owner-notifications.server.ts",
  "app/domain/service-settings.server.ts",
  "app/domain/signup-sources.server.ts",
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
  "app/signup-source.ts",
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
 * Mutanti da ripetere entro i quali la PR prova in un solo job un modulo con il riferimento
 * completo: ogni parte ripete la prova iniziale della suite, da cinque a nove minuti sul runner,
 * mentre quaranta mutanti ne richiedono circa sei in un solo processo.
 */
export const unsplitRetests = 40;

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
  const before = (line) =>
    mutants.filter(({ end }) => end < line).reduce((sum, mutant) => sum + (mutant.weight ?? 1), 0);
  const total = before(lastLine + 1);
  const cuts = [];
  for (let part = 1; part < shards; part++) {
    const target = (part * total) / shards;
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

/**
 * Parti del modulo con al più `mutantsPerShard` mutanti ciascuna dove i tagli lo consentono.
 * I tagli cadono fra le funzioni, quindi le parti escono sbilanciate: se la più grande supera
 * il limite si prova con una parte in più, fino a quattro oltre il minimo, tenendo la divisione
 * con la parte più piccola. Con due parti `stores.server.ts` ne aveva una da 162 mutanti che
 * superava i 60 minuti del job.
 */
export function shardPlan(mutants, lastLine, preparationMs = 0) {
  const inside = (range) =>
    mutants.filter(({ start, end }) => start >= range.start && end <= range.end).length;
  const minimum = Math.max(1, Math.ceil(mutants.length / mutantsPerShard));
  let best = null;
  const timed = mutants.some((mutant) => mutant.weight !== undefined);
  for (let shards = minimum; shards <= minimum + 4; shards++) {
    const plan = shardRanges(mutants, shards, lastLine).map((range) => ({
      ...range,
      mutants: inside(range),
      ...(timed
        ? {
            estimatedMs:
              preparationMs +
              mutants
                .filter(({ start, end }) => start >= range.start && end <= range.end)
                .reduce((sum, mutant) => sum + mutant.weight, 0),
          }
        : {}),
    }));
    const largest = timed
      ? Math.max(
          ...plan.map((range) =>
            mutants
              .filter(({ start, end }) => start >= range.start && end <= range.end)
              .reduce((sum, mutant) => sum + mutant.weight, 0),
          ),
        ) +
        (preparationMs * plan.length) / 4
      : Math.max(...plan.map((part) => part.mutants));
    if (best === null || largest < best.largest) best = { plan, largest };
    if (!timed && largest <= mutantsPerShard) break;
  }
  return best.plan;
}

/** Intervalli delle parti del modulo, secondo `shardPlan`. */
export function timedMutants(mutants, history, digest) {
  if (
    !Array.isArray(history) ||
    !history.length ||
    history.some(
      (entry) =>
        entry.digest !== digest ||
        !Number.isFinite(entry.mutationMs) ||
        !(entry.mutationMs > 0) ||
        !(entry.mutants > 0) ||
        !Number.isFinite(entry.preparationMs) ||
        entry.preparationMs < 0,
    )
  )
    return mutants;
  return mutants.map((mutant) => {
    const sample = history.find(({ start, end }) => mutant.start >= start && mutant.end <= end);
    return { ...mutant, weight: sample ? sample.mutationMs / sample.mutants : 1000 };
  });
}

const sourceDigest = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");

/**
 * Vero se le parti misurate coprono tutto il modulo, contigue e con lo stesso digest. Digest e
 * righe vengono dalle misure: la raccolta non legge i sorgenti del commit qualificato.
 */
export function completeTimings(parts) {
  const [first] = parts;
  return (
    parts.length > 0 &&
    /^[a-f0-9]{64}$/u.test(first.digest ?? "") &&
    Number.isSafeInteger(first.lines) &&
    first.start === 1 &&
    parts.at(-1).end === first.lines &&
    parts.every(
      (part, index) =>
        part.digest === first.digest &&
        part.lines === first.lines &&
        Number.isFinite(part.mutationMs) &&
        Number.isFinite(part.preparationMs) &&
        (index === 0 || part.start === parts[index - 1].end + 1),
    )
  );
}

/**
 * Righe del sorgente attuale, numerate da 1, fra il primo e l'ultimo punto in cui differisce da
 * `before`; `null` se sono uguali. Più modifiche distanti contano come un solo blocco: la stima
 * può soltanto crescere, e allora il modulo si divide come sempre.
 */
export function changedRange(before, after) {
  if (before === after) return null;
  const old = before.split("\n");
  const current = after.split("\n");
  let start = 0;
  while (start < old.length && start < current.length && old[start] === current[start]) start++;
  let end = 0;
  while (
    end < old.length - start &&
    end < current.length - start &&
    old[old.length - 1 - end] === current[current.length - 1 - end]
  )
    end++;
  return { start: start + 1, end: Math.max(start + 1, current.length - end) };
}

/** Mutanti che toccano le righe cambiate: Stryker ripete questi e quelli dei test cambiati. */
export const retestEstimate = (mutants, range) =>
  range ? mutants.filter(({ start, end }) => end >= range.start && start <= range.end).length : 0;

const referenceSlug = (target) => target.replaceAll("/", "_");

/**
 * Riferimenti completi dei moduli dalle parti di una run: un modulo entra soltanto con tutte le
 * parti presenti e senza mutanti da correggere, come i riferimenti delle singole parti. Ogni
 * voce porta modulo, parte, numero di parti, report JSON e report incrementale.
 */
export function moduleReferences(parts) {
  const modules = new Map();
  for (const part of parts) {
    const entry = modules.get(part.target) ?? { parts: part.parts, found: new Map(), valid: true };
    modules.set(part.target, entry);
    if (entry.parts !== part.parts || evaluate(part.report).length) entry.valid = false;
    entry.found.set(part.part, part.incremental);
  }
  return new Map(
    [...modules]
      .filter(([, entry]) => entry.valid && entry.found.size === entry.parts)
      .map(([target, entry]) => [target, mergeReports([...entry.found.values()])]),
  );
}

/** Parti scaricate in `directory`: cartelle `<modulo>` o `<modulo>-<parte>-<parti>`. */
function downloadedParts(directory) {
  const parts = [];
  const visit = (folder) => {
    for (const entry of readdirSync(folder, { withFileTypes: true }))
      if (entry.isDirectory()) visit(path.join(folder, entry.name));
    const report = path.join(folder, "mutation.json");
    const incremental = path.join(folder, "incremental.json");
    if (!existsSync(report) || !existsSync(incremental)) return;
    const parsed = JSON.parse(readFileSync(report, "utf8"));
    const [target] = Object.keys(parsed.files ?? {});
    if (!target) return;
    const shard = /-(\d+)-(\d+)$/u.exec(path.basename(folder));
    parts.push({
      target,
      part: shard ? Number(shard[1]) : 1,
      parts: shard ? Number(shard[2]) : 1,
      report: parsed,
      incremental: JSON.parse(readFileSync(incremental, "utf8")),
    });
  };
  visit(directory);
  return parts;
}

/**
 * Parti della PR: il modulo con il riferimento completo di `develop` e al più `unsplitRetests`
 * mutanti sulle righe cambiate da allora si prova in un solo job, che ripete la prova iniziale
 * una volta sola; gli altri si dividono come nella campagna.
 */
export async function pullRequestShards(target, references, shardsOf = moduleShards) {
  const reference = path.join(references, `${referenceSlug(target)}.json`);
  if (existsSync(reference)) {
    const source = JSON.parse(readFileSync(reference, "utf8")).files?.[target]?.source;
    if (typeof source === "string") {
      const retests = retestEstimate(
        await mutantLines(target),
        changedRange(source, readFileSync(target, "utf8")),
      );
      if (retests <= unsplitRetests) return [{ mutants: retests, reference }];
    }
  }
  return shardsOf(target);
}

const timingFile = ".mutation-timings.json";
function timingHistory() {
  try {
    return JSON.parse(readFileSync(timingFile, "utf8"));
  } catch {
    return {};
  }
}

export async function moduleShards(file) {
  const history = timingHistory()[file];
  const mutants = timedMutants(await mutantLines(file), history, sourceDigest(file));
  const preparation = mutants.some((entry) => entry.weight !== undefined)
    ? Math.max(...history.map((entry) => entry.preparationMs || 0))
    : 0;
  return shardPlan(mutants, readFileSync(file, "utf8").split("\n").length, preparation);
}

export function validateRanges(ranges, lastLine, mutants) {
  if (
    !Array.isArray(ranges) ||
    !ranges.length ||
    ranges[0].start !== 1 ||
    ranges.at(-1).end !== lastLine ||
    ranges.some(
      (range, index) =>
        !Number.isSafeInteger(range.start) ||
        !Number.isSafeInteger(range.end) ||
        range.end < range.start ||
        (index > 0 && range.start !== ranges[index - 1].end + 1),
    ) ||
    mutants.some(
      ({ start, end }) =>
        ranges.filter((range) => start >= range.start && end <= range.end).length !== 1,
    )
  )
    throw new Error("Intervalli mutation incompleti o sovrapposti.");
  return ranges;
}

/**
 * Job mutation contemporanei. La qualifica del candidato, automatica o richiesta, precede
 * `Promuovi` e mantiene i suoi posti per tutta la durata: il numero si fissa una volta, alla
 * pianificazione. Soltanto le campagne lasciano posti alle PR e ai cicli attivi, e di notte
 * senza altro lavoro usano quasi tutti i venti posti dell'account.
 */
export function backgroundConcurrency(runs, { qualification = false, campaign = false } = {}) {
  const busy = runs.some(
    (run) =>
      run.status !== "completed" &&
      (run.event === "pull_request" || run.path === ".github/workflows/cycle.yml"),
  );
  if (busy) return qualification ? 8 : 4;
  return campaign ? 16 : 8;
}

/**
 * Job della matrice, una parte per intervallo di ogni modulo. GitHub li avvia in quest'ordine:
 * i più pesanti, mutanti per test che coprono il modulo, entrano per primi nei posti disponibili.
 */
export async function mutationJobs(targets, shardsOf = moduleShards, testsOf = () => 1) {
  const jobs = await Promise.all(
    targets.map(async (target) => {
      const shards = await shardsOf(target);
      return shards.map(({ mutants, estimatedMs, reference }, index) => ({
        job: {
          target,
          shard: `${index + 1}/${shards.length}`,
          ...(shards.every((range) => Number.isInteger(range.start))
            ? { ranges: JSON.stringify(shards), digest: sourceDigest(target) }
            : {}),
          ...(reference ? { reference } : {}),
        },
        // Un job con il riferimento completo costa almeno la prova iniziale della suite.
        weight: estimatedMs ?? Math.max(1, mutants) * testsOf(target),
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

/**
 * Moduli della PR ancora da provare: quelli senza una prova riusabile in una run precedente della
 * stessa PR (`pullRequestProof`), per esempio dopo un'unione di `develop` che non li tocca. I
 * riusati finiscono nel riepilogo della run, con la run che li ha provati.
 */
async function withoutProvedModules(targets, files) {
  const repositoryId = Number(process.env.REPOSITORY_ID);
  const { REPOSITORY: repository, MUTATION_PR_BRANCH: branch, HEAD_SHA: head } = process.env;
  if (!repository || !repositoryId || !head)
    throw new Error("PR, repository o testa non indicati.");
  const graph = importGraph(files, /^(?:app|workers|test)\/.+\.tsx?$/u);
  const run = [];
  const reused = [];
  for (const target of targets) {
    const proof = await pullRequestProof({
      repository,
      repositoryId,
      branch,
      head,
      target,
      graph,
      exclude: process.env.GITHUB_RUN_ID,
    });
    if (proof) reused.push(`${target}: run ${proof.run} su ${proof.commit.slice(0, 8)}`);
    else run.push(target);
  }
  const summary = `Mutation della PR: ${run.length} moduli da provare, ${reused.length} già provati.${reused.length ? `\n\nRiusati:\n${reused.map((line) => `- ${line}`).join("\n")}` : ""}\n`;
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  return run;
}

async function runTarget(target, files, shard = "1/1") {
  if (!criticalModule(target) || !existsSync(target))
    throw new Error(`Modulo critico inesistente: ${target}`);
  const [part, shards] = shard.split("/").map(Number);
  if (!Number.isInteger(part) || !Number.isInteger(shards) || part < 1 || part > shards)
    throw new Error(`Parte mutation non valida: ${shard}`);
  if (process.env.MUTATION_DIGEST && process.env.MUTATION_DIGEST !== sourceDigest(target))
    throw new Error("Sorgente mutation diverso dal piano.");
  const mutants = await mutantLines(target);
  const ranges = process.env.MUTATION_RANGES
    ? validateRanges(
        JSON.parse(process.env.MUTATION_RANGES),
        readFileSync(target, "utf8").split("\n").length,
        mutants,
      )
    : shards > 1
      ? await moduleShards(target)
      : [null];
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
      reporters: [...settings.reporters, "timing"],
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
        MUTATION_STARTED_AT: String(start),
        MUTATION_TIMING_FILE: path.resolve(directory, "preparation.json"),
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
  // Solo esecuzioni complete alimentano il bilanciamento: l'incrementale costa meno.
  if (!base && failures.length === 0) {
    const preparationMs = existsSync(`${directory}/preparation.json`)
      ? JSON.parse(readFileSync(`${directory}/preparation.json`, "utf8")).preparationMs
      : 0;
    writeFileSync(
      `${directory}/timing.json`,
      JSON.stringify({
        target,
        digest: sourceDigest(target),
        start: range?.start ?? 1,
        end: range?.end ?? readFileSync(target, "utf8").split("\n").length,
        lines: readFileSync(target, "utf8").split("\n").length,
        mutants: mutants.filter(
          ({ start, end }) => !range || (start >= range.start && end <= range.end),
        ).length,
        preparationMs,
        mutationMs: Math.max(1, Date.now() - start - preparationMs),
      }),
    );
  }
  const summary = `${target}${shards > 1 ? ` (parte ${shard})` : ""}: ${Math.round((Date.now() - start) / 1000)}s, ${tests.length} file di test, ${JSON.stringify(counts)}, ${failures.length} problemi.\n`;
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  for (const item of failures) console.error(`Mutante non ucciso: ${item}`);
  return failures.length === 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const {
    positionals: args,
    values: {
      matrix: matrixMode,
      "incremental-base": baseFile,
      "collect-timings": collectTimings,
      "collect-references": collectReferences,
    },
  } = parseArgs({
    allowPositionals: true,
    options: {
      matrix: { type: "boolean" },
      "incremental-base": { type: "string" },
      "collect-timings": { type: "string" },
      "collect-references": { type: "string" },
    },
  });
  if (collectTimings) {
    const history = timingHistory();
    const samples = readdirSync(collectTimings, { recursive: true })
      .filter((file) => file.endsWith("timing.json"))
      .map((file) => JSON.parse(readFileSync(path.join(collectTimings, file), "utf8")));
    // Una run con parti incrementali misura soltanto una parte del modulo: le durate si
    // sostituiscono quando le parti complete coprono tutto il sorgente corrente.
    for (const target of new Set(samples.map((entry) => entry.target))) {
      const parts = samples
        .filter((entry) => entry.target === target)
        .sort((a, b) => a.start - b.start);
      if (completeTimings(parts)) history[target] = parts;
    }
    writeFileSync(timingFile, JSON.stringify(history));
    process.exit(0);
  }
  // I riferimenti dei moduli assenti dalla run restano quelli precedenti.
  if (collectReferences) {
    const output = ".mutation-references";
    mkdirSync(output, { recursive: true });
    const references = moduleReferences(downloadedParts(collectReferences));
    for (const [target, report] of references)
      writeFileSync(path.join(output, `${referenceSlug(target)}.json`), JSON.stringify(report));
    console.log(`Riferimenti completi: ${[...references.keys()].join(", ") || "nessuno"}.`);
    process.exit(0);
  }
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
    if (process.env.MUTATION_PR_BRANCH)
      matrix.target = await withoutProvedModules(matrix.target, files);
    const references = process.env.MUTATION_REFERENCES;
    const jobs = await mutationJobs(
      matrix.target,
      references ? (target) => pullRequestShards(target, references) : moduleShards,
      (target) => consumerTests(target, files).length,
    );
    console.log(
      `Job: ${jobs.include.map(({ target, shard }) => `${target} ${shard}`).join(", ")}.`,
    );
    if (process.env.GITHUB_OUTPUT)
      appendFileSync(process.env.GITHUB_OUTPUT, `matrix=${JSON.stringify(jobs)}\n`);
    if (process.env.GITHUB_OUTPUT && process.env.GH_TOKEN) {
      const runs = ["queued", "in_progress", "waiting", "pending"].flatMap((status) =>
        ghJson(
          "api",
          "--paginate",
          "--slurp",
          `repos/${process.env.GITHUB_REPOSITORY}/actions/runs?status=${status}&per_page=100`,
        ).flatMap((page) => page.workflow_runs),
      );
      appendFileSync(
        process.env.GITHUB_OUTPUT,
        `parallel=${backgroundConcurrency(runs, { qualification: process.env.MUTATION_QUALIFICATION === "true", campaign: process.env.MUTATION_CAMPAIGN === "true" })}\n`,
      );
    }
  } else if (args.length === 0) {
    console.error("Uso: node scripts/mutation.mjs <file>...");
    process.exitCode = 2;
  } else {
    for (const target of args)
      if (!(await runTarget(target, files, process.env.MUTATION_SHARD))) process.exitCode = 1;
  }
}
