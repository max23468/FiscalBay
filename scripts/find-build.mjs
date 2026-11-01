/** Artefatti dello stesso tree, certificati da job riusciti del repository. */
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { ghJson, runJobs } from "./lib/provider.mjs";
import { undatedTree } from "./release/release.mjs";

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
  // La sorgente qualificata su develop vale anche per la sua promozione con il solo giorno della
  // versione; il candidato no, perché la build Production mostra quel giorno.
  const undated = kind === "build" ? undatedTree() : tree;
  const api = (url) => ghJson("api", url);
  let found = 0;
  for (const candidateTree of [...new Set([tree, undated])]) {
    const artifact = `${kind}-${candidateTree}`;
    const candidates = api(
      `repos/${repository}/actions/artifacts?name=${artifact}&per_page=20`,
    ).artifacts;
    found += candidates.length;
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
      if (!verifiedBuildOrigin(candidate, run, jobs, repositoryId, kind)) continue;
      appendFileSync(process.env.GITHUB_OUTPUT, `run-id=${origin.id}\nartifact=${artifact}\n`);
      const note = candidateTree === tree ? "" : `, dal tree ${candidateTree} senza il giorno`;
      console.log(`Tree ${tree}: riuso ${kind} dalla run ${origin.id}${note}.`);
      if (process.env.GITHUB_STEP_SUMMARY)
        appendFileSync(
          process.env.GITHUB_STEP_SUMMARY,
          `\nRiuso ${kind}: tree ${tree}, run ${origin.id}${note}.\n`,
        );
      return;
    }
  }
  const reason =
    found === 0
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
