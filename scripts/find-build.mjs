/** Artefatti dello stesso tree, prodotti sul branch protetto e certificati. */
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { ghJson, runJobs } from "./lib/provider.mjs";

export function verifiedBuildOrigin(candidate, run, jobs, repositoryId, tree, kind, readTree) {
  const origin = candidate.workflow_run;
  if (
    candidate.expired ||
    origin?.repository_id !== repositoryId ||
    origin.head_repository_id !== repositoryId ||
    run.id !== origin.id ||
    run.repository?.id !== repositoryId ||
    run.head_repository?.id !== repositoryId ||
    run.head_sha !== origin.head_sha ||
    !/^[a-f0-9]{40}$/u.test(run.head_sha ?? "") ||
    !/^[a-f0-9]{40}$/u.test(tree ?? "") ||
    candidate.name !== `${kind}-${tree}` ||
    run.head_branch !== "develop" ||
    !(
      kind === "candidate" ? ["workflow_dispatch", "schedule"] : ["push", "workflow_dispatch"]
    ).includes(run.event)
  )
    return false;
  const qualified =
    kind === "candidate"
      ? run.path === ".github/workflows/candidate.yml" &&
        jobs.some(
          (job) =>
            job.name === "Qualifica candidato / Candidate qualified" &&
            job.conclusion === "success",
        )
      : kind === "build" && run.path === ".github/workflows/ci.yml" && run.conclusion === "success";
  // Il nome e il manifest dell'artefatto non attestano il sorgente compilato. Solo i
  // workflow sul branch protetto fanno checkout della revisione della run; le PR
  // eseguono codice non fidato e il loro merge sintetico non è identificato da head_sha.
  return qualified && readTree(run.head_sha) === tree;
}

function main() {
  const repository = process.env.REPOSITORY;
  const repositoryId = Number(process.env.REPOSITORY_ID);
  if (!repository || !repositoryId) throw new Error("Repository non identificato.");
  const kind = process.argv.includes("--candidate") ? "candidate" : "build";
  const tree = execFileSync("git", ["rev-parse", "HEAD^{tree}"], { encoding: "utf8" }).trim();
  const api = (url) => ghJson("api", url);
  const artifact = `${kind}-${tree}`;
  const candidates = api(
    `repos/${repository}/actions/artifacts?name=${artifact}&per_page=20`,
  ).artifacts;
  for (const candidate of candidates) {
    const origin = candidate.workflow_run;
    if (
      candidate.expired ||
      origin?.repository_id !== repositoryId ||
      origin.head_repository_id !== repositoryId
    )
      continue;
    const run = api(`repos/${repository}/actions/runs/${origin.id}`);
    const jobs = kind === "candidate" ? runJobs(repository, origin.id) : [];
    if (
      !verifiedBuildOrigin(
        candidate,
        run,
        jobs,
        repositoryId,
        tree,
        kind,
        (sha) => api(`repos/${repository}/git/commits/${sha}`).tree.sha,
      )
    )
      continue;
    appendFileSync(process.env.GITHUB_OUTPUT, `run-id=${origin.id}\nartifact=${artifact}\n`);
    console.log(`Tree ${tree}: riuso ${kind} dalla run ${origin.id}.`);
    if (process.env.GITHUB_STEP_SUMMARY)
      appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        `\nRiuso ${kind}: tree ${tree}, run ${origin.id}.\n`,
      );
    return;
  }
  const reason =
    candidates.length === 0
      ? "artefatto assente per il tree corrente"
      : "artefatti scaduti, origine o qualifica non valida";
  console.log(`Nessun ${kind} riusabile: ${reason}.`);
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `\nRiuso ${kind} non disponibile: ${reason}.\n`,
    );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
