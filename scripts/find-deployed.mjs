#!/usr/bin/env node
/**
 * Base del confronto sui push a `develop`: l'ultimo deploy test riuscito oppure, se più recente,
 * l'ultima run riuscita le cui modifiche da quel deploy non chiedono un deploy. Una run annullata
 * o un deploy fallito restano nel diff della run successiva; le prove e gli strumenti già
 * qualificati da una run verde non si ripetono finché non arriva il deploy seguente.
 * Senza un deploy riuscito antenato di HEAD l'output resta vuoto e il gate completo.
 */
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { needsDeploy } from "./classify-changes.mjs";
import { ghJson } from "./lib/provider.mjs";

/** Prima run, dalla più recente, con il job di deploy test riuscito su un antenato di HEAD. */
export function lastDeployRun(runs, jobsOf, isAncestor) {
  for (const run of runs) {
    if (!["push", "workflow_dispatch"].includes(run.event)) continue;
    const jobs = jobsOf(run);
    const deploy = jobs.find(({ name }) => name === "Deploy test");
    if (deploy?.conclusion === "success" && isAncestor(run.head_sha)) return { run, jobs };
  }
  return undefined;
}

export const lastDeployed = (runs, jobsOf, isAncestor) =>
  lastDeployRun(runs, jobsOf, isAncestor)?.run.head_sha;

/**
 * Run più recente, riuscita, antenata di HEAD e successiva all'ultimo deploy, senza modifiche da
 * distribuire rispetto a quel deploy; altrimenti il deploy stesso. Le run sono dalla più recente.
 */
export function comparisonBase(runs, jobsOf, isAncestor, needsDeployFrom) {
  const deployed = lastDeployed(runs, jobsOf, isAncestor);
  if (!deployed) return undefined;
  for (const run of runs) {
    if (run.head_sha === deployed) break;
    if (!["push", "workflow_dispatch"].includes(run.event) || run.conclusion !== "success")
      continue;
    if (isAncestor(run.head_sha) && !needsDeployFrom(deployed, run.head_sha)) return run.head_sha;
  }
  return deployed;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const repository = process.env.REPOSITORY;
  if (!repository) throw new Error("Repository non identificato.");
  const api = (url) => ghJson("api", url);
  const runs = api(
    `repos/${repository}/actions/workflows/ci.yml/runs?branch=develop&status=completed&per_page=50`,
  ).workflow_runs.filter(({ id }) => String(id) !== process.env.GITHUB_RUN_ID);
  const sha = comparisonBase(
    runs,
    (run) => api(`repos/${repository}/actions/runs/${run.id}/jobs?per_page=50`).jobs,
    (commit) => {
      try {
        execFileSync("git", ["merge-base", "--is-ancestor", commit, "HEAD"]);
        return true;
      } catch {
        return false;
      }
    },
    needsDeploy,
  );
  if (sha) {
    appendFileSync(process.env.GITHUB_OUTPUT, `sha=${sha}\n`);
    console.log(`Base del confronto: ${sha}.`);
  } else console.log("Nessun deploy test riuscito fra le run recenti: gate completo.");
}
