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
 * File che non cambiano l'esito della mutation di nessun modulo: documenti, frammenti, prove
 * browser, script estranei alla mutation, workflow diversi da CI e mutation, stili e immagini.
 */
const mutationNeutral = (file) =>
  /\.md$|^docs\/|^changes\/|^e2e\/|^public\/|\.(?:css|svg|png|jpe?g|webp|avif|ico)$/u.test(file) ||
  (/^scripts\//u.test(file) && !/^scripts\/mutation(?:-vitest|-reuse)?\.mjs$/u.test(file)) ||
  (/^\.github\//u.test(file) && !/^\.github\/workflows\/(?:ci|mutation)\.yml$/u.test(file));

/**
 * Vero se i file cambiati da una prova riuscita lasciano valida la mutation di `target`: nessun
 * sorgente che il modulo importa, anche indirettamente, né il modulo stesso; nessun test che lo
 * importa direttamente e nessun helper o fixture dei test, che possono indebolire qualunque prova;
 * nessuna migration, configurazione o strumento della mutation. `graph` comprende anche i test.
 */
export function proofUnaffected(changed, target, graph) {
  if (affectingSources(changed, graph).has(target)) return false;
  return changed.every((file) => {
    if (/^(?:app|workers)\/.+\.tsx?$/u.test(file)) return true;
    if (/^test\/.+\.(?:spec|unit)\.ts$/u.test(file)) return !graph.get(file)?.has(target);
    return mutationNeutral(file);
  });
}

/** Esito del modulo nei job di una run della PR: `passed` con ogni parte riuscita, `failed`, o nulla. */
export function pullRequestOutcome(jobs, target) {
  const own = jobs.filter((job) => lineMutationJob(job.name) === target);
  if (!own.length) return null;
  if (own.some((job) => ["failure", "timed_out"].includes(job.conclusion))) return "failed";
  // GitHub elenca soltanto i job partiti: ogni parte deve esserci, riuscita.
  if (!own.every((job) => job.conclusion === "success")) return null;
  const parts = own.map((job) => /(\d+)\/(\d+)$/u.exec(job.name));
  const total = Number(parts[0]?.[2] ?? 1);
  const complete =
    parts.every((part) => Number(part?.[2] ?? 1) === total) &&
    new Set(parts.map((part) => Number(part?.[1] ?? 1))).size === total;
  return complete ? "passed" : null;
}

/**
 * Prova riusabile di `target` nelle run della CI della PR sul branch `branch`, fino alla testa
 * `head`: l'ultima run che ha concluso il modulo, su un commit antenato della testa, con ogni parte
 * riuscita e senza cambi che la invalidino da allora (`proofUnaffected`). Una run annullata o in
 * corso senza esito del modulo non decide; un fallimento recente non si copre con un successo
 * più vecchio. Restituisce la run e il suo commit, o null.
 */
export async function pullRequestProof(
  { repository, repositoryId, branch, head, target, graph, exclude },
  api = defaultApi,
) {
  const { workflow_runs: runs = [] } = await api(
    `repos/${repository}/actions/workflows/ci.yml/runs?event=pull_request&branch=${encodeURIComponent(branch)}&per_page=30`,
  );
  const ordered = runs
    .filter((run) => run.head_repository?.id === repositoryId && String(run.id) !== String(exclude))
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  for (const run of ordered) {
    const jobs = [];
    for (let page = 1; ; page++) {
      const batch = await api(
        `repos/${repository}/actions/runs/${run.id}/jobs?filter=latest&per_page=30&page=${page}`,
      );
      jobs.push(...batch.jobs);
      if (batch.jobs.length < 30 || jobs.length >= batch.total_count) break;
    }
    const outcome = pullRequestOutcome(jobs, target);
    if (outcome === "failed") return null;
    if (outcome !== "passed") continue;
    if (run.head_sha === head) return { run: run.id, commit: run.head_sha };
    const compare = await api(`repos/${repository}/compare/${run.head_sha}...${head}`);
    // Oltre trecento file l'API tronca l'elenco: non si può escludere un cambio rilevante.
    const files = (compare.files ?? []).map(({ filename }) => filename);
    if (!["ahead", "identical"].includes(compare.status) || files.length >= 300) return null;
    return proofUnaffected(files, target, graph) ? { run: run.id, commit: run.head_sha } : null;
  }
  return null;
}

/**
 * Run precedenti con gli esiti per modulo, dalla più recente; gli errori dell'API si ripetono.
 * `reusePlan` usa per ogni modulo soltanto la run più recente che lo ha provato: la lettura si
 * ferma quando ogni modulo richiesto ha un esito, invece di scaricare i job di tutte le run.
 */
export async function previousRuns(repository, repositoryId, targets, api = defaultApi) {
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
    // Pagine piccole: con cento job per pagina l'API risponde 502 per alcune run ripetute.
    const jobs = [];
    for (let page = 1; ; page++) {
      const batch = await api(
        `repos/${repository}/actions/runs/${candidate.id}/jobs?filter=latest&per_page=30&page=${page}`,
      );
      jobs.push(...batch.jobs);
      if (batch.jobs.length < 30 || jobs.length >= batch.total_count) break;
    }
    const outcomes = moduleOutcomes(jobs, candidate.conclusion === "cancelled");
    runs.push({ id: candidate.id, commit: candidate.head_sha, outcomes });
    for (const target of outcomes.keys()) pending.delete(target);
    if (!pending.size) break;
  }
  return runs;
}

const defaultApi = (url) =>
  retry(() => ghJson("api", url), { attempts: 6, delay: (attempt) => attempt * 10_000 });

/**
 * Prova di `target` nelle PR integrate da `since`: ogni commit di `develop` che lo modifica viene
 * da una PR dello stesso repository con la mutation del modulo riuscita, sulla testa unita con lo
 * stesso contenuto del modulo nel commit integrato.
 */
async function prCoverage(repository, repositoryId, target, since, api, graph) {
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
    // L'ultima run della PR che ha concluso il modulo, anche precedente alla testa unita se da
    // allora nulla lo ha toccato: la PR può averne riusato la prova dopo un'unione di `develop`.
    const proof = await pullRequestProof(
      { repository, repositoryId, branch: pull.head.ref, head, target, graph },
      api,
    );
    if (!proof) return false;
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
  const runs = await previousRuns(repository, repositoryId, targets, api);
  const sources = git("ls-files")
    .split("\n")
    .filter((file) => /^(?:app|workers)\/.+\.tsx?$/u.test(file) && existsSync(file))
    .map((file) => ({ path: file, text: readFileSync(file, "utf8") }));
  const graph = importGraph(sources);
  const testGraph = importGraph(
    git("ls-files")
      .split("\n")
      .filter((file) => /^(?:app|workers|test)\/.+\.tsx?$/u.test(file) && existsSync(file))
      .map((file) => ({ path: file, text: readFileSync(file, "utf8") })),
    /^(?:app|workers|test)\/.+\.tsx?$/u,
  );
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
      coverage.set(key, prCoverage(repository, repositoryId, source, commit, api, testGraph));
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
