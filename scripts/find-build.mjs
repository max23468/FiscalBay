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

/**
 * File che producono o giudicano la prova di una PR: workflow, Action, script, manifest,
 * lockfile, configurazioni di build, test e lint, helper e reporter delle prove browser. Le spec
 * restano fuori: il merge le eseguirebbe identiche.
 */
export const proofProducer =
  /^(?:\.github\/|scripts\/|e2e\/(?!.+\.spec\.ts$)|package\.json$|pnpm-(?:lock|workspace)\.yaml$|[^/]+\.config\.(?:ts|mts|js|mjs|json)$|tsconfig[^/]*\.json$|\.oxlintrc\.json$|\.oxfmtrc\.json$|knip\.json$)/u;

/**
 * Build della PR riusabile dal push del suo merge su `develop` (D309). Il workflow della PR è
 * codice della PR: vale soltanto se la PR non tocca nessun produttore della prova, così ha
 * eseguito lo stesso processo di `develop`. Il nome lega l'artefatto al tree del merge sintetico,
 * uguale a quello integrato soltanto se la base non è avanzata dopo l'ultima run; la base
 * dell'ultimo deploy test deve essere il genitore del merge, perché la classificazione del push
 * coincida con quella della PR.
 */
export function pullRequestBuildOrigin({
  candidate,
  run,
  pull,
  repositoryId,
  tree,
  parents,
  deployed,
  files,
}) {
  const origin = candidate.workflow_run;
  return Boolean(
    !candidate.expired &&
    /^[a-f0-9]{40}$/u.test(tree ?? "") &&
    candidate.name === `build-${tree}` &&
    origin?.id === run.id &&
    origin.repository_id === repositoryId &&
    origin.head_repository_id === repositoryId &&
    run.repository?.id === repositoryId &&
    run.head_repository?.id === repositoryId &&
    run.path === ".github/workflows/ci.yml" &&
    run.event === "pull_request" &&
    run.conclusion === "success" &&
    pull?.merged_at &&
    pull.base?.ref === "develop" &&
    pull.head?.repo?.id === repositoryId &&
    /^[a-f0-9]{40}$/u.test(run.head_sha ?? "") &&
    run.head_sha === pull.head.sha &&
    parents?.length === 1 &&
    /^[a-f0-9]{40}$/u.test(parents[0]) &&
    parents[0] === deployed &&
    files?.length > 0 &&
    !files.some((file) => proofProducer.test(file)),
  );
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
  // Il push di un merge su `develop` può riusare la build della sua PR: commit, genitori e file
  // si leggono dal checkout, la PR dall'API.
  let merge;
  const mergeContext = () => {
    if (merge !== undefined) return merge;
    const sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    const parents = execFileSync("git", ["rev-list", "--parents", "-n", "1", "HEAD"], {
      encoding: "utf8",
    })
      .trim()
      .split(" ")
      .slice(1);
    const files =
      parents.length === 1
        ? execFileSync("git", ["diff", "--name-only", parents[0], "HEAD"], { encoding: "utf8" })
            .split("\n")
            .filter(Boolean)
        : [];
    const pulls = api(`repos/${repository}/commits/${sha}/pulls`);
    merge = { parents, files, pull: pulls.length === 1 ? pulls[0] : null };
    return merge;
  };
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
    const verified = verifiedBuildOrigin(
      candidate,
      run,
      jobs,
      repositoryId,
      tree,
      kind,
      (sha) => api(`repos/${repository}/git/commits/${sha}`).tree.sha,
    );
    const fromPull =
      !verified &&
      kind === "build" &&
      process.env.EVENT === "push" &&
      run.event === "pull_request" &&
      pullRequestBuildOrigin({
        candidate,
        run,
        repositoryId,
        tree,
        deployed: process.env.DEPLOYED_SHA,
        ...mergeContext(),
      });
    if (!verified && !fromPull) continue;
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `run-id=${origin.id}\nartifact=${artifact}\nsource=${fromPull ? "pull" : "develop"}\n`,
    );
    console.log(
      `Tree ${tree}: riuso ${kind} dalla run ${origin.id}${fromPull ? ` della PR #${merge.pull.number}` : ""}.`,
    );
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
