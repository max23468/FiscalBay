/**
 * Mutation incrementale del candidato. Sulla prova di `develop` un modulo critico non si ripete
 * se la sua ultima mutation, in una qualifica o in una campagna precedente su un commit antenato,
 * è riuscita in ogni parte e ogni sorgente cambiato da allora che il modulo importa, anche
 * indirettamente, o il modulo stesso, è un modulo critico già provato nella PR che l'ha
 * integrato, sullo stesso contenuto. Un sorgente non critico cambiato, o un commit senza
 * quella prova, ripete il modulo. Dipendenze, strumenti e prove modificate non fanno ripetere
 * nulla: li copre la campagna settimanale, che resta completa.
 * Uso: MATRIX='{"target":[...]}' REPOSITORY=<owner/repo> REPOSITORY_ID=<id> node scripts/mutation-reuse.mjs
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { criticalModule } from "./lib/critical-modules.mjs";
import { importGraph } from "./verify-repo.mjs";
import {
  ghApi,
  git,
  isAncestor,
  latestRunJobs,
  readRunArtifact,
  trackedSources,
} from "./lib/provider.mjs";

/** Workflow le cui mutation valgono come ricevuta. */
const mutationWorkflows = [".github/workflows/candidate.yml", ".github/workflows/mutation.yml"];

/** Ultima parte del nome del job: `<modulo> <parte>/<parti>`. */
export function mutationJob(name) {
  const match = /^((?:app|workers)\/\S+) (\d+)\/(\d+)$/u.exec(name.split(" / ").at(-1) ?? "");
  return match ? { target: match[1], part: Number(match[2]), parts: Number(match[3]) } : null;
}

/**
 * Esito della mutation di un modulo in una run: `passed` solo con ogni parte riuscita. In una
 * run annullata, per esempio per avviarne una nuova, un job annullato non ha un esito.
 */
export function moduleOutcomes(jobs, cancelledRun = false) {
  const modules = new Map();
  const interrupted = new Set();
  for (const job of jobs) {
    const parsed = mutationJob(job.name);
    if (!parsed) continue;
    // Un job annullato o saltato prima di partire non ha provato nulla; uno interrotto mentre
    // girava, anche per il limite di tempo, vale come fallito, salvo nella run annullata.
    if (["cancelled", "skipped"].includes(job.conclusion) && !job.steps?.length) continue;
    if (cancelledRun && job.conclusion === "cancelled") {
      interrupted.add(parsed.target);
      continue;
    }
    const entry = modules.get(parsed.target) ?? { parts: parsed.parts, passed: new Set(), ran: 0 };
    entry.ran += 1;
    if (job.conclusion === "success" && entry.parts === parsed.parts) entry.passed.add(parsed.part);
    modules.set(parsed.target, entry);
  }
  return new Map(
    [...modules]
      .filter(([target]) => !interrupted.has(target))
      .map(([target, entry]) => [
        target,
        entry.ran === entry.parts && entry.passed.size === entry.parts ? "passed" : "failed",
      ]),
  );
}

/** Testi dell'interfaccia e documenti legali: un loro cambio non tocca chi li importa (D244). */
const copyFiles = /^app\/copy\//u;

/**
 * Sorgenti modificati che raggiungono ciascun modulo critico, anche indirettamente; il modulo
 * stesso compreso. Un testo cambiato conta soltanto per sé.
 */
export function affectingSources(changed, graph) {
  const sources = changed.filter((file) => /^(?:app|workers)\/.+\.tsx?$/u.test(file));
  const reached = new Map();
  for (const source of sources) {
    const affected = new Set([source]);
    if (!copyFiles.test(source))
      for (let grew = true; grew;) {
        grew = false;
        for (const [file, imports] of graph)
          if (!affected.has(file) && [...imports].some((target) => affected.has(target))) {
            affected.add(file);
            grew = true;
          }
      }
    for (const file of affected)
      if (criticalModule(file)) reached.set(file, new Set([...(reached.get(file) ?? []), source]));
  }
  return reached;
}

/**
 * Divide i moduli fra da provare e riusati. `runs` sono le run precedenti su commit antenati,
 * dalla più recente, con gli esiti per modulo; `affectedSince(commit)` associa a ogni modulo i
 * sorgenti cambiati fino alla testa che lo raggiungono; `covered(source, commit)` dice se ogni
 * modifica di un modulo critico da `commit` è stata provata nella sua PR. Conta
 * soltanto l'ultima run che ha provato il modulo: un fallimento recente non si copre con un
 * successo più vecchio.
 */
export async function reusePlan(targets, runs, affectedSince, covered = async () => false) {
  const run = [];
  const reused = [];
  for (const target of targets) {
    const last = runs.find((entry) => entry.outcomes.has(target));
    if (last?.outcomes.get(target) !== "passed") {
      run.push(target);
      continue;
    }
    const sources = [...(affectedSince(last.commit).get(target) ?? [])];
    let ready = true;
    for (const source of sources)
      if (!criticalModule(source) || !(await covered(source, last.commit))) {
        ready = false;
        break;
      }
    if (ready)
      reused.push({
        target,
        run: last.id,
        commit: last.commit,
        ...(sources.length ? { lines: sources } : {}),
      });
    else run.push(target);
  }
  return { run, reused };
}

/** Modulo di un job della mutation nella CI di una PR, con l'eventuale parte. */
export function lineMutationJob(name) {
  const match = /^Mutation ((?:app|workers)\/\S+)(?: \d+\/\d+)?$/u.exec(name);
  return match ? match[1] : null;
}

/**
 * File che non fanno ripetere la mutation di nessun modulo: documenti, frammenti, prove browser,
 * script e workflow, compresi gli strumenti della mutation, manifest e lockfile, stili e immagini.
 * Strumenti e dipendenze li prova la campagna settimanale completa (D317).
 */
export const mutationNeutral = (file) =>
  /\.md$|^docs\/|^changes\/|^e2e\/|^public\/|^scripts\/|^\.github\/|\.(?:css|svg|png|jpe?g|webp|avif|ico)$/u.test(
    file,
  ) ||
  /^(?:package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|stryker\.config\.json|vitest.*\.config\.ts)$/u.test(
    file,
  );

/**
 * File cambiati diversi dai sorgenti che lasciano valida la prova di `target`. Una prova che lo
 * importa vale invariata se è in `added`, cioè cambiata soltanto con prove aggiunte: una prova in
 * più può uccidere altri mutanti, mai farne sopravvivere uno già ucciso.
 */
function otherFilesUnaffected(changed, target, graph, added = new Set()) {
  return changed.every((file) => {
    if (/^(?:app|workers)\/.+\.tsx?$/u.test(file)) return true;
    if (/^test\/.+\.(?:spec|unit)\.ts$/u.test(file))
      return added.has(file) || !graph.get(file)?.has(target);
    return mutationNeutral(file);
  });
}

/**
 * Righe aggiunte che valgono per ogni prova del file, e quindi possono cambiare quelle esistenti:
 * hook, mock e stub globali, preparazione degli scenari.
 */
const sharedSetup =
  /\b(?:beforeEach|beforeAll|afterEach|afterAll|setupScenarios)\b|\bvi\.(?:mock|doMock|hoisted|stubGlobal|stubEnv|useFakeTimers|setSystemTime)\b/u;

/**
 * File di prova cambiati soltanto con prove aggiunte, dai file di un confronto dell'API di GitHub:
 * nessuna riga tolta, la patch presente e nessuna riga aggiunta che prepari tutte le prove del file.
 * Un file nuovo vale come aggiunto alle stesse condizioni.
 */
export function addedTests(files) {
  return new Set(
    files
      .filter(
        ({ filename, status, deletions, patch }) =>
          /^test\/.+\.(?:spec|unit)\.ts$/u.test(filename) &&
          ["added", "modified"].includes(status) &&
          deletions === 0 &&
          typeof patch === "string" &&
          !patch
            .split("\n")
            .some(
              (line) => line.startsWith("+") && !line.startsWith("+++") && sharedSetup.test(line),
            ),
      )
      .map(({ filename }) => filename),
  );
}

/** Esito del modulo nei job di una run della PR: `passed` con ogni parte riuscita, `failed`, o nulla. */
export function pullRequestOutcome(jobs, target) {
  const own = jobs.filter((job) => lineMutationJob(job.name) === target);
  if (!own.length) return null;
  if (own.some((job) => ["failure", "timed_out"].includes(job.conclusion))) return "failed";
  // GitHub elenca soltanto i job partiti: ogni parte deve esserci, riuscita.
  if (!own.every((job) => job.conclusion === "success")) return null;
  const parts = own.map((job) => pullRequestPart(job.name));
  const total = parts[0].parts;
  const complete =
    parts.every((part) => part.parts === total) &&
    new Set(parts.map((part) => part.part)).size === total;
  return complete ? "passed" : null;
}

/** Parte di un job della mutation della PR, `<parte>/<parti>` in fondo al nome; senza, 1/1. */
function pullRequestPart(name) {
  const match = /(\d+)\/(\d+)$/u.exec(name);
  return match ? { part: Number(match[1]), parts: Number(match[2]) } : { part: 1, parts: 1 };
}

/**
 * Divisione di `target` nel piano della matrice di una run della PR, l'artefatto
 * `mutation-plan-<run>`: numero di parti, impronta del sorgente e intervalli. Due piani dividono
 * il modulo allo stesso modo se hanno la stessa chiave; una parte sola copre tutto il sorgente.
 */
export function planLayout(plan, target) {
  const entry = (plan?.include ?? []).find((job) => job.target === target);
  if (!entry) return null;
  const total = pullRequestPart(entry.shard ?? "").parts;
  const ranges = entry.ranges ? JSON.parse(entry.ranges) : null;
  return {
    total,
    digest: entry.digest ?? null,
    ranges: entry.ranges ?? null,
    key:
      total === 1 ? "whole" : JSON.stringify(ranges?.map(({ start, end }) => [start, end]) ?? null),
  };
}

/**
 * Vero se i file cambiati da una prova riuscita lasciano valida la mutation di `target`: nessun
 * sorgente che il modulo importa, anche indirettamente, né il modulo stesso; nessun test che lo
 * importa direttamente e nessun helper o fixture dei test, che possono indebolire qualunque prova;
 * nessuna migration o altro file letto dai test. `graph` comprende anche i test. Un sorgente
 * critico diverso dal modulo stesso vale come invariato se `excused(source)` lo conferma, per
 * esempio perché è entrato dalla base già provato nella sua PR.
 */
export async function proofStands(
  changed,
  target,
  graph,
  excused = async () => false,
  added = new Set(),
) {
  if (!otherFilesUnaffected(changed, target, graph, added)) return false;
  for (const source of affectingSources(changed, graph).get(target) ?? [])
    if (source === target || !criticalModule(source) || !(await excused(source))) return false;
  return true;
}

const plans = new Map();

/** Piano della matrice di una run della PR, o null se l'artefatto manca o non si legge. */
function defaultPlan(repository, run) {
  if (!plans.has(run))
    plans.set(
      run,
      readRunArtifact(repository, run, { name: `mutation-plan-${run}` }, (directory) =>
        JSON.parse(readFileSync(path.join(directory, "mutation-plan.json"), "utf8")),
      ),
    );
  return plans.get(run);
}

/**
 * Parti di `target` già provate nelle run della CI della PR sul branch `branch`, fino al commit
 * provato `head`. Il piano di riferimento è quello della run più recente che ha eseguito il
 * modulo: deve avere l'impronta `digest` del sorgente attuale. Vale ogni parte riuscita in una run
 * con lo stesso piano, impronta e intervalli, su un commit antenato di `head` e senza cambi che la
 * invalidino da allora (`proofStands`, con `excused(source, commit)` per i sorgenti critici); per
 * ogni parte decide l'esito più recente, quindi un fallimento non si copre con un successo più
 * vecchio. Le run più vecchie di un piano diverso non contano. Una run senza piano, precedente
 * all'artefatto, vale soltanto con tutte le parti riuscite. Restituisce parti provate e mancanti
 * con gli intervalli del riferimento, o null senza un riferimento con il sorgente attuale.
 */
export async function pullRequestParts(
  { repository, repositoryId, branch, head, target, graph, digest, exclude, excused },
  api = ghApi,
  readPlan = defaultPlan,
) {
  const { workflow_runs: runs = [] } = await api(
    `repos/${repository}/actions/workflows/ci.yml/runs?event=pull_request&branch=${encodeURIComponent(branch)}&per_page=30`,
  );
  const ordered = runs
    .filter((run) => run.head_repository?.id === repositoryId && String(run.id) !== String(exclude))
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  const verdicts = new Map();
  // Commit antenato della testa e nessun cambio che invalidi la prova del modulo da allora.
  const stands = (run) => {
    if (!verdicts.has(run.id))
      verdicts.set(
        run.id,
        (async () => {
          if (run.head_sha === head) return true;
          const compare = await api(`repos/${repository}/compare/${run.head_sha}...${head}`);
          // Oltre trecento file l'API tronca l'elenco: non si può escludere un cambio rilevante.
          const files = (compare.files ?? []).map(({ filename }) => filename);
          if (!["ahead", "identical"].includes(compare.status) || files.length >= 300) return false;
          return proofStands(
            files,
            target,
            graph,
            (source) => (excused ? excused(source, run.head_sha) : false),
            addedTests(compare.files ?? []),
          );
        })(),
      );
    return verdicts.get(run.id);
  };
  let layout = null;
  const decided = new Map();
  for (const run of ordered) {
    const jobs = await latestRunJobs(repository, run.id, api);
    const own = jobs.filter((job) => lineMutationJob(job.name) === target);
    const plan = await readPlan(repository, run.id);
    const entry = planLayout(plan, target);
    if (!own.length && !entry) continue;
    if (!layout && !entry) {
      // Run senza piano: soltanto la prova completa nella stessa run.
      const outcome = pullRequestOutcome(jobs, target);
      if (outcome === "failed") return null;
      if (outcome !== "passed") continue;
      if (!(await stands(run))) return null;
      const total = pullRequestPart(own[0].name).parts;
      return {
        total,
        ranges: null,
        proved: Array.from({ length: total }, (_, index) => ({
          part: index + 1,
          run: run.id,
          commit: run.head_sha,
        })),
        missing: [],
      };
    }
    if (!layout) {
      if (entry.digest !== digest) return null;
      layout = entry;
    } else if (!entry || entry.digest !== layout.digest || entry.key !== layout.key) break;
    for (const job of own) {
      const { part, parts } = pullRequestPart(job.name);
      if (parts !== layout.total || decided.has(part)) continue;
      if (["failure", "timed_out"].includes(job.conclusion)) decided.set(part, null);
      else if (job.conclusion === "success")
        decided.set(part, (await stands(run)) ? { part, run: run.id, commit: run.head_sha } : null);
    }
    if (decided.size === layout.total) break;
  }
  if (!layout) return null;
  const proved = [...decided.values()].filter(Boolean).sort((a, b) => a.part - b.part);
  const missing = Array.from({ length: layout.total }, (_, index) => index + 1).filter(
    (part) => !decided.get(part),
  );
  return { total: layout.total, ranges: layout.ranges, proved, missing };
}

/**
 * Prova riusabile di `target` nelle run della CI della PR: ogni parte provata, anche in run
 * diverse (`pullRequestParts`). Restituisce la run più recente, il suo commit e tutte le run
 * usate, o null.
 */
export async function pullRequestProof(args, api = ghApi, readPlan = defaultPlan) {
  const parts = await pullRequestParts(args, api, readPlan);
  if (!parts || parts.missing.length) return null;
  // Gli ID delle run crescono nel tempo: il più alto è la run più recente.
  const runs = [...new Set(parts.proved.map(({ run }) => run))].sort((a, b) => b - a);
  return { run: runs[0], commit: parts.proved.find(({ run }) => run === runs[0]).commit, runs };
}

/**
 * Run precedenti con gli esiti per modulo, dalla più recente; gli errori dell'API si ripetono.
 * `reusePlan` usa per ogni modulo soltanto la run più recente che lo ha provato: la lettura si
 * ferma quando ogni modulo richiesto ha un esito, invece di scaricare i job di tutte le run.
 */
export async function previousRuns(repository, repositoryId, targets, api = ghApi) {
  if (!targets.length) return [];
  const pending = new Set(targets);
  const runs = [];
  // Per workflow: fra le run di tutto il repository CI e CodeQL spingono fuori le qualifiche.
  const candidates = [];
  for (const workflow of mutationWorkflows)
    candidates.push(
      ...(
        await api(
          `repos/${repository}/actions/workflows/${path.basename(workflow)}/runs?status=completed&exclude_pull_requests=true&per_page=30`,
        )
      ).workflow_runs,
    );
  candidates.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  for (const candidate of candidates) {
    if (
      !mutationWorkflows.includes(candidate.path) ||
      candidate.event === "pull_request" ||
      candidate.repository?.id !== repositoryId ||
      candidate.head_repository?.id !== repositoryId ||
      !isAncestor(candidate.head_sha)
    )
      continue;
    const jobs = await latestRunJobs(repository, candidate.id, api);
    const outcomes = moduleOutcomes(jobs, candidate.conclusion === "cancelled");
    runs.push({ id: candidate.id, commit: candidate.head_sha, outcomes });
    for (const target of outcomes.keys()) pending.delete(target);
    if (!pending.size) break;
  }
  return runs;
}

/** Impronta SHA-256 di un file in un commit, come quella dei piani della matrice. */
const commitDigest = (commit, file) =>
  createHash("sha256")
    .update(execFileSync("git", ["show", `${commit}:${file}`], { maxBuffer: 64 * 1024 ** 2 }))
    .digest("hex");

/**
 * Prova di `target` nelle PR integrate fra `since` e `tip`: almeno un commit di `develop` lo
 * modifica e ognuno viene da una PR dello stesso repository con la mutation del modulo riuscita,
 * sulla testa unita con lo stesso contenuto del modulo nel commit integrato. Nella prova della PR
 * un sorgente critico entrato dalla sua base, e non modificato dalla PR, vale se è a sua volta
 * coperto (`covered`) fino alla base del commit integrato.
 */
async function prCoverage({
  repository,
  repositoryId,
  target,
  since,
  tip,
  api,
  graph,
  readPlan,
  covered,
}) {
  const commits = git("rev-list", "--first-parent", `${since}..${tip}`, "--", target)
    .split("\n")
    .filter(Boolean);
  // Senza commit di `develop` il contenuto non viene da una PR provata.
  if (!commits.length) return false;
  for (const commit of commits) {
    const pull = (await api(`repos/${repository}/commits/${commit}/pulls`)).find(
      (entry) => entry.merged_at && entry.merge_commit_sha === commit,
    );
    if (!pull || pull.head.repo?.id !== repositoryId) return false;
    const head = pull.head.sha;
    const blob = git("rev-parse", `${commit}:${target}`).trim();
    // Un modulo assente dalla testa della PR non ha una prova da riusare.
    let tested;
    try {
      tested = await api(`repos/${repository}/contents/${target}?ref=${head}`);
    } catch {
      return false;
    }
    if (tested?.sha !== blob) return false;
    const base = git("rev-parse", `${commit}^1`).trim();
    const own = new Set(git("diff", "--name-only", base, commit).split("\n").filter(Boolean));
    // Le run della PR che hanno provato il modulo, anche in parti di run diverse e precedenti alla
    // testa unita se da allora nulla lo ha toccato: la PR può averne riusato la prova.
    const proof = await pullRequestProof(
      {
        repository,
        repositoryId,
        branch: pull.head.ref,
        head,
        target,
        graph,
        digest: commitDigest(commit, target),
        excused: async (source, proved) => {
          if (own.has(source)) return false;
          const point = (await api(`repos/${repository}/compare/${proved}...${base}`))
            .merge_base_commit?.sha;
          return Boolean(point) && covered(source, point, base);
        },
      },
      api,
      readPlan,
    );
    if (!proof) return false;
  }
  return true;
}

/**
 * `covered(source, since, tip = "HEAD")`: vero se ogni modifica del modulo critico `source` fra
 * `since` e `tip` è stata provata nella sua PR (`prCoverage`). Gli esiti restano in memoria.
 */
export function pullRequestCoverage(
  { repository, repositoryId, graph },
  api = ghApi,
  readPlan = defaultPlan,
) {
  const cache = new Map();
  const covered = (source, since, tip = "HEAD") => {
    const key = `${source} ${since} ${tip}`;
    if (!cache.has(key))
      cache.set(
        key,
        prCoverage({
          repository,
          repositoryId,
          target: source,
          since,
          tip,
          api,
          graph,
          readPlan,
          covered,
        }),
      );
    return cache.get(key);
  };
  return covered;
}

async function main() {
  const repository = process.env.REPOSITORY;
  const repositoryId = Number(process.env.REPOSITORY_ID);
  if (!repository || !repositoryId) throw new Error("Repository non identificato.");
  const targets = JSON.parse(process.env.MATRIX ?? '{"target":[]}').target;
  // Senza esiti leggibili la pianificazione fallisce e si ripete: la mutation completa resta
  // alla campagna settimanale, mai un ripiego della prova del candidato.
  const runs = await previousRuns(repository, repositoryId, targets, ghApi);
  const graph = importGraph(trackedSources());
  const withTests = /^(?:app|workers|test)\/.+\.tsx?$/u;
  const testGraph = importGraph(trackedSources(withTests), withTests);
  const cache = new Map();
  const affectedSince = (commit) => {
    if (!cache.has(commit))
      cache.set(
        commit,
        affectingSources(
          git("diff", "--name-only", commit, "HEAD").split("\n").filter(Boolean),
          graph,
        ),
      );
    return cache.get(commit);
  };
  const covered = pullRequestCoverage({ repository, repositoryId, graph: testGraph }, ghApi);
  const { run, reused } = await reusePlan(targets, runs, affectedSince, covered);
  const list = (entries) => entries.map((entry) => `- ${entry}`).join("\n");
  const summary = [
    `Mutation incrementale: ${run.length} moduli da provare, ${reused.length} riusati.`,
    ...(reused.length
      ? [
          "",
          "Riusati:",
          list(
            reused.map(
              ({ target, run: id, commit, lines }) =>
                `${target}: run ${id} su ${commit.slice(0, 8)}${lines ? `, sorgenti provati nelle PR: ${lines.join(", ")}` : ""}`,
            ),
          ),
        ]
      : []),
    ...(run.length ? ["", "Da provare:", list(run)] : []),
    "",
  ].join("\n");
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `mutation-matrix=${JSON.stringify({ target: run })}\n`,
    );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]))
  await main();
