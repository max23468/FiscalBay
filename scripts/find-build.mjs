/** Trova esclusivamente artefatti di CI riuscite, dello stesso repository e tree. */
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";

const repository = process.env.REPOSITORY;
const repositoryId = Number(process.env.REPOSITORY_ID);
if (!repository || !repositoryId) throw new Error("Repository non identificato.");
const tree = execFileSync("git", ["rev-parse", "HEAD^{tree}"], { encoding: "utf8" }).trim();
const artifact = `build-${tree}`;
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
  if (run.path !== ".github/workflows/ci.yml" || run.conclusion !== "success") continue;
  appendFileSync(process.env.GITHUB_OUTPUT, `run-id=${origin.id}\nartifact=${artifact}\n`);
  console.log(`Tree ${tree} già verificato dalla run ${origin.id}.`);
  process.exit(0);
}
console.log("Nessun artefatto verificato riusabile: gate completo richiesto.");
