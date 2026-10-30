/**
 * Mutation incrementale della prova del candidato su `develop`: un modulo critico non si ripete
 * se la sua ultima mutation, in una qualifica o in una campagna precedente su un commit antenato,
 * è riuscita in ogni parte e da allora nessun sorgente che importa, anche indirettamente, è
 * cambiato. Un cambio delle dipendenze o della configurazione della mutation fa ripetere tutto; le prove modificate non
 * contano, come nella scelta dei moduli dopo un rilascio, e la campagna settimanale e `Promuovi`
 * restano complete.
 * Uso: MATRIX='{"target":[...]}' REPOSITORY=<owner/repo> REPOSITORY_ID=<id> node scripts/mutation-reuse.mjs
 */
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { criticalModule } from "./mutation.mjs";
import { importGraph } from "./verify-repo.mjs";
import { ghJson } from "./lib/provider.mjs";

/** Workflow le cui mutation valgono come ricevuta. */
const mutationWorkflows = [".github/workflows/publish.yml", ".github/workflows/mutation.yml"];

/** File che cambiano l'esito di ogni mutation: con uno di questi modificato nulla si riusa. */
const toolFiles = [
  /^package\.json$/u,
  /^pnpm-lock\.yaml$/u,
  /^stryker\.config\.json$/u,
  /^vitest(?:\.mutation)?\.config\.ts$/u,
  /^scripts\/mutation(?:-vitest)?\.mjs$/u,
  /^\.github\/actions\//u,
];

/** Ultima parte del nome del job: `<modulo> <parte>/<parti>`. */
export function mutationJob(name) {
  const match = /^((?:app|workers)\/\S+) (\d+)\/(\d+)$/u.exec(name.split(" / ").at(-1) ?? "");
  return match ? { target: match[1], part: Number(match[2]), parts: Number(match[3]) } : null;
}

/** Esito della mutation di un modulo in una run: `passed` solo con ogni parte riuscita. */
export function moduleOutcomes(jobs) {
  const modules = new Map();
  for (const job of jobs) {
    const parsed = mutationJob(job.name);
    if (!parsed) continue;
    const entry = modules.get(parsed.target) ?? { parts: parsed.parts, passed: new Set(), ran: 0 };
    entry.ran += 1;
    if (job.conclusion === "success" && entry.parts === parsed.parts) entry.passed.add(parsed.part);
    modules.set(parsed.target, entry);
  }
  return new Map(
    [...modules].map(([target, entry]) => [
      target,
      entry.ran === entry.parts && entry.passed.size === entry.parts ? "passed" : "failed",
    ]),
  );
}

/** Moduli critici che importano, anche indirettamente, uno dei sorgenti modificati. */
export function affectedModules(changed, graph) {
  const affected = new Set(changed.filter((file) => /^(?:app|workers)\/.+\.tsx?$/u.test(file)));
  let grew = true;
  while (grew) {
    grew = false;
    for (const [file, imports] of graph)
      if (!affected.has(file) && [...imports].some((target) => affected.has(target))) {
        affected.add(file);
        grew = true;
      }
  }
  return new Set([...affected].filter(criticalModule));
}

/**
 * Divide i moduli fra da provare e riusati. `runs` sono le run precedenti su commit antenati,
 * dalla più recente, con gli esiti per modulo; `affectedSince(commit)` restituisce i moduli
 * toccati dal diff fino alla testa, oppure `null` se gli strumenti sono cambiati. Conta soltanto
 * l'ultima run che ha provato il modulo: un fallimento recente non si copre con un successo
 * più vecchio.
 */
export function reusePlan(targets, runs, affectedSince) {
  const run = [];
  const reused = [];
  for (const target of targets) {
    const last = runs.find((entry) => entry.outcomes.has(target));
    const affected = last ? affectedSince(last.commit) : null;
    if (last?.outcomes.get(target) === "passed" && affected && !affected.has(target))
      reused.push({ target, run: last.id, commit: last.commit });
    else run.push(target);
  }
  return { run, reused };
}

const git = (...args) => execFileSync("git", args, { encoding: "utf8" });

function isAncestor(commit) {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", commit, "HEAD"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function main() {
  const repository = process.env.REPOSITORY;
  const repositoryId = Number(process.env.REPOSITORY_ID);
  if (!repository || !repositoryId) throw new Error("Repository non identificato.");
  const targets = JSON.parse(process.env.MATRIX ?? '{"target":[]}').target;
  const api = (url) => ghJson("api", url);
  const runs = [];
  for (const candidate of api(
    `repos/${repository}/actions/runs?status=completed&exclude_pull_requests=true&per_page=50`,
  ).workflow_runs) {
    if (
      !mutationWorkflows.includes(candidate.path) ||
      candidate.event === "pull_request" ||
      candidate.repository?.id !== repositoryId ||
      candidate.head_repository?.id !== repositoryId ||
      !isAncestor(candidate.head_sha)
    )
      continue;
    const jobs = [];
    for (let page = 1; ; page++) {
      const batch = api(
        `repos/${repository}/actions/runs/${candidate.id}/jobs?filter=latest&per_page=100&page=${page}`,
      ).jobs;
      jobs.push(...batch);
      if (batch.length < 100) break;
    }
    runs.push({ id: candidate.id, commit: candidate.head_sha, outcomes: moduleOutcomes(jobs) });
  }
  const sources = git("ls-files")
    .split("\n")
    .filter((file) => /^(?:app|workers)\/.+\.tsx?$/u.test(file) && existsSync(file))
    .map((file) => ({ path: file, text: readFileSync(file, "utf8") }));
  const graph = importGraph(sources);
  const cache = new Map();
  const affectedSince = (commit) => {
    if (!cache.has(commit)) {
      const changed = git("diff", "--name-only", commit, "HEAD").split("\n").filter(Boolean);
      cache.set(
        commit,
        changed.some((file) => toolFiles.some((pattern) => pattern.test(file)))
          ? null
          : affectedModules(changed, graph),
      );
    }
    return cache.get(commit);
  };
  const { run, reused } = reusePlan(targets, runs, affectedSince);
  const summary = `Mutation incrementale: ${run.length} moduli da provare, ${reused.length} riusati.\n${reused.map(({ target, run: id, commit }) => `- ${target}: run ${id} su ${commit.slice(0, 8)}`).join("\n")}\n`;
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `mutation-matrix=${JSON.stringify({ target: run })}\n`,
    );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
