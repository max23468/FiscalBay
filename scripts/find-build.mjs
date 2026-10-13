/** Artefatti dello stesso tree, certificati da job riusciti del repository. */
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

export function verifiedBuildOrigin(candidate, run, jobs, repositoryId, kind = "build") {
  const origin = candidate.workflow_run;
  if (
    candidate.expired ||
    origin?.repository_id !== repositoryId ||
    origin.head_repository_id !== repositoryId
  )
    return false;
  return kind === "candidate"
    ? run.path === ".github/workflows/publish.yml" &&
        jobs.some(
          (job) =>
            job.name === "Qualifica candidato / Candidate qualified" &&
            job.conclusion === "success",
        )
    : run.path === ".github/workflows/ci.yml" && run.conclusion === "success";
}

function main() {
  const repository = process.env.REPOSITORY;
  const repositoryId = Number(process.env.REPOSITORY_ID);
  if (!repository || !repositoryId) throw new Error("Repository non identificato.");
  const kind = process.argv.includes("--candidate") ? "candidate" : "build";
  const tree = execFileSync("git", ["rev-parse", "HEAD^{tree}"], { encoding: "utf8" }).trim();
  const artifact = `${kind}-${tree}`;
  const api = (url) => JSON.parse(execFileSync("gh", ["api", url], { encoding: "utf8" }));
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
    const jobs =
      kind === "candidate"
        ? api(`repos/${repository}/actions/runs/${origin.id}/jobs?per_page=100`).jobs
        : [];
    if (!verifiedBuildOrigin(candidate, run, jobs, repositoryId, kind)) continue;
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
