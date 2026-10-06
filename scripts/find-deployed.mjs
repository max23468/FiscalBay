#!/usr/bin/env node
/**
 * Commit dell'ultimo deploy test riuscito, base del confronto sui push a `develop`:
 * una run annullata o un deploy fallito restano nel diff della run successiva.
 * Senza un deploy riuscito antenato di HEAD l'output resta vuoto e il gate completo.
 */
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Prima run, dalla più recente, con il job di deploy test riuscito su un antenato di HEAD. */
export function lastDeployed(runs, jobsOf, isAncestor) {
  for (const run of runs) {
    if (!["push", "workflow_dispatch"].includes(run.event)) continue;
    const deploy = jobsOf(run).find(({ name }) => name === "Deploy test");
    if (deploy?.conclusion === "success" && isAncestor(run.head_sha)) return run.head_sha;
  }
  return undefined;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const repository = process.env.REPOSITORY;
  if (!repository) throw new Error("Repository non identificato.");
  const api = (url) => JSON.parse(execFileSync("gh", ["api", url], { encoding: "utf8" }));
  const runs = api(
    `repos/${repository}/actions/workflows/ci.yml/runs?branch=develop&status=completed&per_page=50`,
  ).workflow_runs.filter(({ id }) => String(id) !== process.env.GITHUB_RUN_ID);
  const sha = lastDeployed(
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
  );
  if (sha) {
    appendFileSync(process.env.GITHUB_OUTPUT, `sha=${sha}\n`);
    console.log(`Ultimo deploy test riuscito: ${sha}.`);
  } else console.log("Nessun deploy test riuscito fra le run recenti: gate completo.");
}
