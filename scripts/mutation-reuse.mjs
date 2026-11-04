/**
 * Mutation incrementale del candidato. Sulla prova di `develop` un modulo critico non si ripete
 * se la sua ultima mutation, in una qualifica o in una campagna precedente su un commit antenato,
 * è riuscita in ogni parte e ogni sorgente cambiato da allora che il modulo importa, anche
 * indirettamente, o il modulo stesso, è un modulo critico già provato riga per riga nella PR che
 * l'ha integrato, sullo stesso contenuto. Un sorgente non critico cambiato, o un commit senza
 * quella prova, ripete il modulo. Dipendenze, strumenti e prove modificate non fanno ripetere
 * nulla: li copre la campagna settimanale, che resta completa.
 * Uso: MATRIX='{"target":[...]}' REPOSITORY=<owner/repo> REPOSITORY_ID=<id> node scripts/mutation-reuse.mjs
 */
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { criticalModule } from "./mutation.mjs";
import { importGraph } from "./verify-repo.mjs";
import { ghJson, git, isAncestor, retry } from "./lib/provider.mjs";

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

/** Moduli critici raggiunti da almeno un sorgente modificato. */
export const affectedModules = (changed, graph) => new Set(affectingSources(changed, graph).keys());

/**
 * Divide i moduli fra da provare e riusati. `runs` sono le run precedenti su commit antenati,
 * dalla più recente, con gli esiti per modulo; `affectedSince(commit)` associa a ogni modulo i
 * sorgenti cambiati fino alla testa che lo raggiungono; `covered(source, commit)` dice se ogni
 * modifica di un modulo critico da `commit` è stata provata riga per riga nella sua PR. Conta
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

/** Modulo di un job della mutation delle righe nella CI di una PR, con l'eventuale parte. */
export function lineMutationJob(name) {
  const match = /^Mutation ((?:app|workers)\/\S+)(?: \d+\/\d+)?$/u.exec(name);
  return match ? match[1] : null;
}

/**
 * Vero se la run della PR ha provato le righe del modulo: almeno un job del modulo e ogni suo
 * job riuscito, nella run riuscita.
 */
export function linesProved(run, jobs, target) {
  const own = jobs.filter((job) => lineMutationJob(job.name) === target);
  return (
    run?.conclusion === "success" &&
    own.length > 0 &&
    own.every((job) => job.conclusion === "success")
  );
}

/** Run precedenti con gli esiti per modulo, dalla più recente; gli errori dell'API si ripetono. */
async function previousRuns(repository, repositoryId) {
  const api = (url) =>
    retry(() => ghJson("api", url), { attempts: 6, delay: (attempt) => attempt * 10_000 });
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
    // Pagine piccole: con cento job per pagina l'API risponde 502 per alcune run ripetute.
    const jobs = [];
    for (let page = 1; ; page++) {
      const batch = await api(
        `repos/${repository}/actions/runs/${candidate.id}/jobs?filter=latest&per_page=30&page=${page}`,
      );
      jobs.push(...batch.jobs);
      if (batch.jobs.length < 30 || jobs.length >= batch.total_count) break;
    }
    runs.push({
      id: candidate.id,
      commit: candidate.head_sha,
      outcomes: moduleOutcomes(jobs, candidate.conclusion === "cancelled"),
    });
  }
  return runs;
}

/**
 * Prova delle righe di `target` nelle PR integrate da `since`: ogni commit di `develop` che lo
 * modifica viene da una PR dello stesso repository con la mutation delle righe riuscita, sulla
 * testa unita con lo stesso contenuto del modulo nel commit integrato.
 */
async function prCoverage(repository, repositoryId, target, since, api) {
  const commits = git("rev-list", "--first-parent", `${since}..HEAD`, "--", target)
    .split("\n")
    .filter(Boolean);
  for (const commit of commits) {
    const pull = (await api(`repos/${repository}/commits/${commit}/pulls`)).find(
      (entry) => entry.merged_at && entry.merge_commit_sha === commit,
    );
    if (!pull || pull.head.repo?.id !== repositoryId) return false;
    const head = pull.head.sha;
    const blob = git("rev-parse", `${commit}:${target}`).trim();
    // Un modulo assente dalla testa della PR non ha una prova da riusare: nessuna ripetizione.
    let tested;
    try {
      tested = ghJson("api", `repos/${repository}/contents/${target}?ref=${head}`);
    } catch {
      return false;
    }
    if (tested?.sha !== blob) return false;
    const { workflow_runs: prRuns } = await api(
      `repos/${repository}/actions/workflows/ci.yml/runs?event=pull_request&head_sha=${head}&status=success&per_page=10`,
    );
    let proved = false;
    for (const prRun of prRuns.filter((entry) => entry.repository?.id === repositoryId)) {
      const { jobs } = await api(
        `repos/${repository}/actions/runs/${prRun.id}/jobs?filter=latest&per_page=100`,
      );
      if (linesProved(prRun, jobs, target)) {
        proved = true;
        break;
      }
    }
    if (!proved) return false;
  }
  return true;
}

async function main() {
  const repository = process.env.REPOSITORY;
  const repositoryId = Number(process.env.REPOSITORY_ID);
  if (!repository || !repositoryId) throw new Error("Repository non identificato.");
  const targets = JSON.parse(process.env.MATRIX ?? '{"target":[]}').target;
  const api = (url) =>
    retry(() => ghJson("api", url), { attempts: 6, delay: (attempt) => attempt * 10_000 });
  // Senza esiti leggibili la pianificazione fallisce e si ripete: la mutation completa resta
  // alla campagna settimanale, mai un ripiego della prova del candidato.
  const runs = await previousRuns(repository, repositoryId);
  const sources = git("ls-files")
    .split("\n")
    .filter((file) => /^(?:app|workers)\/.+\.tsx?$/u.test(file) && existsSync(file))
    .map((file) => ({ path: file, text: readFileSync(file, "utf8") }));
  const graph = importGraph(sources);
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
  const coverage = new Map();
  const covered = (source, commit) => {
    const key = `${source} ${commit}`;
    if (!coverage.has(key))
      coverage.set(key, prCoverage(repository, repositoryId, source, commit, api));
    return coverage.get(key);
  };
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
                `${target}: run ${id} su ${commit.slice(0, 8)}${lines ? `, righe provate nelle PR per ${lines.join(", ")}` : ""}`,
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
