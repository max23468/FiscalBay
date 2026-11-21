#!/usr/bin/env node
/**
 * Budget di tempo dei job della CI. Ogni job conclusa della run si divide in attesa (dalla
 * creazione all'avvio sul runner), setup (passi iniziali di preparazione: runner, container,
 * checkout, dipendenze, artefatti e cache) ed esecuzione (il resto). Un job oltre il budget fa
 * fallire `Node 26`: la CI resta veloce perché un rallentamento si vede subito.
 *
 * Uso in CI: GH_TOKEN, GITHUB_REPOSITORY, GITHUB_RUN_ID e GITHUB_RUN_ATTEMPT dall'ambiente.
 */
import { appendFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Passi di preparazione: contano come setup finché precedono il primo passo di lavoro. */
const setupStep =
  /^(?:Set up job|Initialize containers|Checkout(?: .*)?|Set up Node and dependencies|Download (?:verified build|shard reports)|Restore .*|Run actions\/(?:checkout|cache\/restore|download-artifact)@.*)$/u;

/**
 * Secondi per job, in ordine: il primo nome che corrisponde vale. `null` lascia il valore senza
 * limite proprio, con il solo `timeout-minutes` del workflow.
 */
export const budgets = [
  // Formato e lint, tipi: i limiti della CI rapida.
  { job: /^Check check:lint$/u, wait: 10, setup: 30, run: 5 },
  { job: /^Check typecheck$/u, wait: 10, setup: 30, run: 5 },
  { job: /^Check check:tooling$/u, wait: 10, setup: 30, run: 60 },
  { job: /^Check (?:doctor:react|build:live)$/u, wait: 10, setup: 30, run: 30 },
  { job: /^Vitest \d+\/\d+$/u, wait: 10, setup: 30, run: 60 },
  { job: /^Vitest coverage$/u, wait: 10, setup: 30, run: 30 },
  { job: /^Verify$/u, wait: 10, setup: 30, run: 120 },
  // Il container di Playwright richiede da solo da 20 a 36 secondi sui runner ospitati (misura
  // della prima run, 2026-11-21): il setup dei browser scende a 30 secondi soltanto con la cache
  // delle immagini di runner propri.
  { job: /^Browser \d+\/\d+$/u, wait: 10, setup: 60, run: 420 },
  // Le parti della mutation superano i job contemporanei dell'account: la loro attesa non ha
  // ancora un limite, la durata resta quella del `timeout-minutes`.
  { job: /^Mutation /u, wait: null, setup: 30, run: null },
  { job: /^(?:Avvia qualifica|Deploy test)$/u, wait: 10, setup: 30, run: null },
];

/** Chiusura del runner dopo il lavoro: non conta nell'esecuzione. */
const teardownStep = /^(?:Post |Stop containers$|Complete job$)/u;

/** Attesa, setup ed esecuzione in secondi di un job dell'API di GitHub. */
export function split(job) {
  const at = (value) => Date.parse(value);
  const created = at(job.created_at);
  const started = at(job.started_at);
  let setupEnd = started;
  let runEnd = at(job.completed_at);
  let preparing = true;
  for (const step of job.steps ?? []) {
    if (!step.started_at || !step.completed_at || step.conclusion === "skipped") continue;
    if (teardownStep.test(step.name)) {
      runEnd = Math.min(runEnd, at(step.started_at));
      break;
    }
    if (preparing && setupStep.test(step.name))
      setupEnd = Math.max(setupEnd, at(step.completed_at));
    else preparing = false;
  }
  return {
    wait: Math.max(0, (started - created) / 1000),
    setup: (setupEnd - started) / 1000,
    run: Math.max(0, (runEnd - setupEnd) / 1000),
  };
}

/** Superamenti dei budget, uno per valore oltre il limite. */
export function overruns(jobs) {
  const found = [];
  for (const job of jobs) {
    if (job.status !== "completed" || job.conclusion === "skipped" || !job.started_at) continue;
    const budget = budgets.find(({ job: name }) => name.test(job.name));
    if (!budget) continue;
    const measured = split(job);
    for (const kind of ["wait", "setup", "run"])
      if (budget[kind] !== null && measured[kind] > budget[kind])
        found.push({
          job: job.name,
          kind,
          seconds: Math.round(measured[kind]),
          budget: budget[kind],
        });
  }
  return found;
}

async function runJobs() {
  const { GH_TOKEN, GITHUB_REPOSITORY, GITHUB_RUN_ID, GITHUB_RUN_ATTEMPT } = process.env;
  const jobs = [];
  for (let page = 1; ; page++) {
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}/attempts/${GITHUB_RUN_ATTEMPT}/jobs?per_page=100&page=${page}`,
      { headers: { authorization: `Bearer ${GH_TOKEN}`, accept: "application/vnd.github+json" } },
    );
    if (!response.ok) throw new Error(`Job della run non leggibili: HTTP ${response.status}.`);
    const body = await response.json();
    jobs.push(...body.jobs);
    if (jobs.length >= body.total_count || body.jobs.length === 0) return jobs;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const jobs = await runJobs();
  const rows = jobs
    .filter((job) => job.status === "completed" && job.conclusion !== "skipped" && job.started_at)
    .map((job) => ({ name: job.name, ...split(job) }));
  const table = [
    "| Job | Attesa | Setup | Esecuzione |",
    "|---|---|---|---|",
    ...rows.map(
      ({ name, wait, setup, run }) =>
        `| ${name} | ${Math.round(wait)} s | ${Math.round(setup)} s | ${Math.round(run)} s |`,
    ),
  ].join("\n");
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Tempi dei job\n\n${table}\n`);
  const found = overruns(jobs);
  for (const { job, kind, seconds, budget } of found)
    console.log(`::error::${job}: ${kind} ${seconds} s oltre il budget di ${budget} s.`);
  if (found.length > 0) process.exit(1);
  console.log(`${rows.length} job entro i budget.`);
}
