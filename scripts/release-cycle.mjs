#!/usr/bin/env node
/** Coordinamento esplicito del ciclo: status legge; pr/candidate/production hanno effetti. */
import { execFileSync, spawn } from "node:child_process";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  existsSync,
  mkdtempSync,
  cpSync,
} from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { plan } from "./classify-changes.mjs";
import { assertBrowserEvidence } from "./release-notes.mjs";
import { verifiedBuildOrigin } from "./find-build.mjs";

const execute = (command, args, options = {}) =>
  (execFileSync(command, args, { encoding: "utf8", ...options }) ?? "").trim();
const git = (...args) => execute("git", args);
const gh = (...args) => execute("gh", args);
const json = (...args) => JSON.parse(gh(...args));
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const watch = (args) =>
  new Promise((resolve, reject) => {
    const child = spawn("gh", args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`Monitoraggio terminato con codice ${code}.`)),
    );
  });

export function assertBase(expected, current) {
  if (!/^[0-9a-f]{40}$/u.test(expected ?? "") || current !== expected)
    throw new Error("La base della PR è avanzata: aggiornarla prima della qualifica finale.");
}

export function candidateRef(command, ref = "main") {
  if (ref !== "main" && !(command === "candidate" && ref === "develop"))
    throw new Error("Production richiede main; la sola prova ammette anche develop.");
  return ref;
}

/** Tempo con almeno un job attivo, distinto da attese e intervalli fra tentativi. */
export function runTimings(run, jobs, now = Date.now()) {
  const start = Date.parse(run.created_at);
  const end = run.status && run.status !== "completed" ? now : Date.parse(run.updated_at);
  const intervals = jobs
    .filter((job) => job.conclusion !== "skipped")
    .map((job) => [
      Math.max(start, Date.parse(job.started_at)),
      Math.min(end, job.completed_at ? Date.parse(job.completed_at) : end),
    ])
    .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b) && b >= a)
    .sort(([a], [b]) => a - b);
  let active = 0;
  let until = start;
  for (const [a, b] of intervals) {
    active += Math.max(0, b - Math.max(a, until));
    until = Math.max(until, b);
  }
  const elapsed = Math.max(0, end - start);
  return {
    attempts: run.run_attempt,
    elapsedSeconds: Math.round(elapsed / 1000),
    activeSeconds: Math.round(active / 1000),
    waitingSeconds: Math.round((elapsed - active) / 1000),
  };
}

export function checkCycleJobs(jobs, deployRequired) {
  if (jobs.find((job) => job.name === "Node 26")?.conclusion !== "success")
    throw new Error("Gate del commit integrato non riuscito.");
  const deploy = jobs.find((job) => job.name === "Deploy test");
  if (deployRequired && deploy?.conclusion !== "success")
    throw new Error("Deploy test richiesto ma non confermato.");
  if (deploy && !["success", "skipped"].includes(deploy.conclusion))
    throw new Error("Deploy test non riuscito.");
  return deploy?.conclusion === "success";
}

export function assertCycleReceipt(receipt, sha, environment) {
  if (
    receipt.sha !== sha ||
    receipt.environment !== environment ||
    !receipt.deployed ||
    !receipt.readback ||
    receipt.rolledBack ||
    !receipt.version ||
    !receipt.digest
  )
    throw new Error("Ricevuta di distribuzione assente, parziale o di un altro candidato.");
}

export function assertRemoteEvidence(report, sha, environment) {
  if (environment === "production") return assertBrowserEvidence(report, sha);
  if (
    report.status !== "passed" ||
    report.partial ||
    report.dirty !== false ||
    report.sha !== sha ||
    report.environment !== "test" ||
    report.baseURL !== "https://test.fiscalbay.it" ||
    !(report.counts?.passed > 0)
  )
    throw new Error("Collaudo remoto test incompleto o di un altro candidato.");
}

export function assertPublishedRelease(release, tagSha, sha, version) {
  if (release.isDraft || release.tagName !== `v${version}` || tagSha !== sha || !release.url)
    throw new Error("Tag o release non confermati sul candidato.");
}

function publishedRelease(repository, sha, version) {
  const releases = version
    ? [{ tagName: `v${version}` }]
    : json(
        "release",
        "list",
        "--repo",
        repository,
        "--limit",
        "50",
        "--json",
        "tagName,isDraft",
      ).filter((release) => !release.isDraft);
  for (const release of releases) {
    const ref = json("api", `repos/${repository}/git/ref/tags/${release.tagName}`);
    const commit =
      ref.object.type === "tag"
        ? json("api", `repos/${repository}/git/tags/${ref.object.sha}`).object.sha
        : ref.object.sha;
    if (commit !== sha && !version) continue;
    const details = json(
      "release",
      "view",
      release.tagName,
      "--repo",
      repository,
      "--json",
      "url,tagName,isDraft",
    );
    assertPublishedRelease(details, commit, sha, version ?? release.tagName.slice(1));
    console.log(`Release verificata: ${details.url}.`);
    return;
  }
  throw new Error("Release sul candidato non osservata.");
}

function candidateAvailable(repository, tree) {
  const repositoryId = json("api", `repos/${repository}`).id;
  const artifacts = json(
    "api",
    `repos/${repository}/actions/artifacts?name=candidate-${tree}&per_page=20`,
  ).artifacts;
  for (const artifact of artifacts) {
    const origin = artifact.workflow_run;
    if (
      artifact.expired ||
      origin?.repository_id !== repositoryId ||
      origin.head_repository_id !== repositoryId
    )
      continue;
    const run = json("api", `repos/${repository}/actions/runs/${origin.id}`);
    const jobs = json(
      "api",
      `repos/${repository}/actions/runs/${origin.id}/jobs?per_page=100`,
    ).jobs;
    if (verifiedBuildOrigin(artifact, run, jobs, repositoryId, "candidate")) return true;
  }
  return false;
}

export function effectiveProductionVariable(read, repository, name) {
  try {
    return read(`repos/${repository}/environments/production/variables/${name}`);
  } catch (error) {
    if (!/HTTP 404/u.test(String(error.stderr ?? error.message))) throw error;
    return read(`repos/${repository}/actions/variables/${name}`);
  }
}

function summary(repository, runId) {
  const run = json("api", `repos/${repository}/actions/runs/${runId}`);
  const jobs = [];
  for (let attempt = 1; attempt <= run.run_attempt; attempt++) {
    const pages = json(
      "api",
      "--paginate",
      "--slurp",
      `repos/${repository}/actions/runs/${runId}/attempts/${attempt}/jobs?per_page=100`,
    );
    jobs.push(...pages.flatMap((page) => page.jobs));
  }
  console.log(
    JSON.stringify({ run: run.html_url, conclusion: run.conclusion, ...runTimings(run, jobs) }),
  );
  return run;
}

async function waitRun(
  repository,
  workflow,
  sha,
  branch,
  events = ["push", "workflow_dispatch"],
  since = 0,
) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const runs = json(
      "run",
      "list",
      "--repo",
      repository,
      "--workflow",
      workflow,
      "--branch",
      branch,
      "--limit",
      "50",
      "--json",
      "databaseId,headSha,event,status,conclusion,createdAt",
    );
    const run = runs.find(
      (item) =>
        item.headSha === sha && events.includes(item.event) && Date.parse(item.createdAt) >= since,
    );
    if (run) {
      if (run.status !== "completed")
        await watch([
          "run",
          "watch",
          String(run.databaseId),
          "--repo",
          repository,
          "--exit-status",
          "--interval",
          "30",
        ]);
      const result = summary(repository, run.databaseId);
      if (result.conclusion !== "success")
        throw new Error(`Run ${run.databaseId} non riuscita: riconciliare prima della ripresa.`);
      return result;
    }
    await pause(10000);
  }
  throw new Error("Workflow non osservato sul commit atteso: nessun rilancio automatico.");
}

function readback(repository, run, environment) {
  const directory = mkdtempSync(path.join(tmpdir(), "release-readback-"));
  const checkout = path.join(directory, "checkout");
  let attached = false;
  try {
    git("fetch", "origin", environment === "test" ? "develop" : "main");
    git("worktree", "add", "--detach", checkout, run.head_sha);
    attached = true;
    const executeHere = (command, args, options = {}) =>
      execute(command, args, { cwd: checkout, ...options });
    executeHere("pnpm", ["install", "--frozen-lockfile"], { stdio: "inherit" });
    const output = path.join(directory, "build-output");
    executeHere(
      process.execPath,
      ["scripts/find-build.mjs", ...(environment === "production" ? ["--candidate"] : [])],
      {
        env: {
          ...process.env,
          REPOSITORY: repository,
          REPOSITORY_ID: String(json("api", `repos/${repository}`).id),
          GITHUB_OUTPUT: output,
        },
      },
    );
    if (!existsSync(output))
      throw new Error("Artefatto qualificato non disponibile per il readback.");
    const fields = Object.fromEntries(
      readFileSync(output, "utf8")
        .trim()
        .split("\n")
        .map((line) => line.split("=")),
    );
    executeHere("gh", [
      "run",
      "download",
      fields["run-id"],
      "--repo",
      repository,
      "--name",
      fields.artifact,
      "--dir",
      ".cloudflare/output",
    ]);
    const artifacts = json(
      "api",
      `repos/${repository}/actions/runs/${run.id}/artifacts?per_page=100`,
    ).artifacts;
    const prefix = environment === "test" ? "deployed" : "release-receipt";
    const artifact = artifacts.find(
      (item) => item.name === `${prefix}-${run.id}-${run.run_attempt}` && !item.expired,
    );
    if (!artifact) throw new Error("Ricevuta del deploy non disponibile.");
    gh(
      "run",
      "download",
      String(run.id),
      "--repo",
      repository,
      "--name",
      artifact.name,
      "--dir",
      path.join(directory, "receipt"),
    );
    const receiptFile = path.join(directory, "receipt/reports/release.json");
    assertCycleReceipt(JSON.parse(readFileSync(receiptFile, "utf8")), run.head_sha, environment);
    for (const name of environment === "test"
      ? ["test-smoke", "test-pages"]
      : ["production-remote"]) {
      const evidence = path.join(directory, `receipt/test-results/browser/${name}.json`);
      if (!existsSync(evidence)) throw new Error(`Collaudo remoto non disponibile: ${name}.`);
      assertRemoteEvidence(JSON.parse(readFileSync(evidence, "utf8")), run.head_sha, environment);
    }
    mkdirSync(path.join(checkout, "reports"), { recursive: true });
    cpSync(receiptFile, path.join(checkout, "reports/release.json"));
    executeHere(
      process.execPath,
      [
        "scripts/release.mjs",
        "confirm",
        "--environment",
        environment,
        "--expected-sha",
        run.head_sha,
      ],
      {
        stdio: "inherit",
        env: {
          ...process.env,
          ...(environment === "production"
            ? {
                PRODUCTION_PUBLISH_ENABLED: effectiveProductionVariable(
                  (endpoint) => gh("api", endpoint, "--jq", ".value"),
                  repository,
                  "PRODUCTION_PUBLISH_ENABLED",
                ),
                OWNER_APPROVED_SHA: effectiveProductionVariable(
                  (endpoint) => gh("api", endpoint, "--jq", ".value"),
                  repository,
                  "OWNER_APPROVED_SHA",
                ),
              }
            : {}),
        },
      },
    );
    console.log(`Readback provider confermato: ${environment}, ${run.head_sha}.`);
  } finally {
    if (attached) git("worktree", "remove", "--force", checkout);
    rmSync(directory, { recursive: true, force: true });
  }
}

export function squashIntegrated(branchSha, mergeSha, cwd = process.cwd()) {
  const localGit = (...args) => execute("git", args, { cwd, stdio: ["ignore", "pipe", "ignore"] });
  try {
    const parent = localGit("rev-parse", `${mergeSha}^`);
    const expected = localGit("merge-tree", "--write-tree", parent, branchSha).split("\n")[0];
    return expected === localGit("rev-parse", `${mergeSha}^{tree}`);
  } catch {
    return false;
  }
}

function cleanup(pr) {
  const branch = pr.headRefName;
  if (
    ["main", "develop", "legacy/1.x"].includes(branch) ||
    /(?:^|\/)rollback(?:\/|$)/u.test(branch)
  )
    throw new Error("Riferimento protetto: conservato.");
  const local = git("for-each-ref", "--format=%(objectname)", `refs/heads/${branch}`);
  if ((local && local !== pr.headRefOid) || !squashIntegrated(pr.headRefOid, pr.mergeCommit.oid))
    throw new Error("Branch locale con contenuto non riconciliato: conservato.");
  const worktrees = git("worktree", "list", "--porcelain");
  const current = git("branch", "--show-current");
  if (current !== branch && worktrees.split("\n").includes(`branch refs/heads/${branch}`))
    throw new Error("Branch ancora usato in un altro worktree: conservato.");
  if (current === branch) {
    if (git("status", "--porcelain")) throw new Error("Checkout modificato: pulizia sospesa.");
    git("switch", pr.baseRefName);
    git("merge", "--ff-only", `origin/${pr.baseRefName}`);
  }
  const remote = git("ls-remote", "origin", `refs/heads/${branch}`).split(/\s/u)[0];
  if (remote) {
    if (remote !== pr.headRefOid) throw new Error("Branch remoto avanzato: conservato.");
    git(
      "push",
      "--force-with-lease=" + `refs/heads/${branch}:${remote}`,
      "origin",
      `:refs/heads/${branch}`,
    );
  }
  if (local) git("branch", "-D", branch);
  git("fetch", "--prune", "origin");
}

function cleanupIntegrated(repository) {
  const locals = git(
    "for-each-ref",
    "--format=%(refname:short)",
    "refs/heads/codex",
    "refs/heads/riallinea",
  ).split("\n");
  const remotes = git(
    "for-each-ref",
    "--format=%(refname:short)",
    "refs/remotes/origin/codex",
    "refs/remotes/origin/riallinea",
  )
    .split("\n")
    .map((ref) => ref.replace(/^origin\//u, ""));
  const residuals = [];
  for (const branch of new Set([...locals, ...remotes].filter(Boolean))) {
    const prs = json(
      "pr",
      "list",
      "--repo",
      repository,
      "--head",
      branch,
      "--state",
      "merged",
      "--limit",
      "1",
      "--json",
      "number,headRefName,headRefOid,baseRefName,mergeCommit",
    );
    const pr = prs[0];
    if (!pr || !["main", "develop"].includes(pr.baseRefName)) {
      residuals.push(`${branch}: lavoro non integrato o PR non riconciliata`);
      continue;
    }
    git("fetch", "origin", pr.baseRefName, `refs/pull/${pr.number}/head`);
    try {
      cleanup(pr);
    } catch (error) {
      residuals.push(`${branch}: ${error.message}`);
    }
  }
  const current = git("branch", "--show-current");
  if (["develop", "main"].includes(current) && !git("status", "--porcelain")) {
    git("fetch", "origin", current);
    git("merge", "--ff-only", `origin/${current}`);
  }
  console.log("Inventario worktree conservati:");
  console.log(git("worktree", "list"));
  console.log(
    `Stash conservati: ${git("stash", "list", "--format=%gd").split("\n").filter(Boolean).length}.`,
  );
  for (const residual of residuals) console.log(`Residuo conservato: ${residual}.`);
}

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      sha: { type: "string" },
      ref: { type: "string" },
      version: { type: "string" },
      "reviewed-migrations": { type: "string", default: "" },
    },
  });
  const [command, number] = positionals;
  if (!["status", "pr", "candidate", "production", "resume"].includes(command))
    throw new Error(
      "Uso: release:cycle status <run> | pr <numero> | candidate --sha <sha> | production --sha <sha> --version <versione> | resume <run>.",
    );
  const repository = json("repo", "view", "--json", "nameWithOwner").nameWithOwner;
  if (command === "status") {
    if (!/^\d+$/u.test(number ?? "")) throw new Error("Run non valida.");
    summary(repository, number);
    return;
  }
  if (git("status", "--porcelain"))
    throw new Error(
      "Il ciclo richiede un checkout pulito; conservare e completare il lavoro locale.",
    );
  const directory = path.resolve(git("rev-parse", "--git-common-dir"), "release-cycle.lock");
  if (existsSync(directory)) {
    const owner = JSON.parse(readFileSync(path.join(directory, "owner.json"), "utf8"));
    try {
      process.kill(owner.pid, 0);
      throw new Error("Un altro ciclo locale è già attivo.");
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
      rmSync(directory, { recursive: true });
    }
  }
  mkdirSync(directory);
  writeFileSync(path.join(directory, "owner.json"), JSON.stringify({ pid: process.pid }));
  try {
    if (command === "resume") {
      if (!/^\d+$/u.test(number ?? "")) throw new Error("Run non valida.");
      let run = json("api", `repos/${repository}/actions/runs/${number}`);
      if (
        ![".github/workflows/ci.yml", ".github/workflows/publish.yml"].includes(run.path) ||
        !["develop", "main"].includes(run.head_branch) ||
        !["push", "workflow_dispatch"].includes(run.event)
      )
        throw new Error("Run fuori dal ciclo supportato.");
      assertBase(
        run.head_sha,
        gh("api", `repos/${repository}/git/ref/heads/${run.head_branch}`, "--jq", ".object.sha"),
      );
      if (run.status === "completed" && run.conclusion !== "success")
        gh("run", "rerun", number, "--repo", repository, "--failed");
      if (run.conclusion !== "success")
        await watch([
          "run",
          "watch",
          number,
          "--repo",
          repository,
          "--exit-status",
          "--interval",
          "30",
        ]);
      run = summary(repository, number);
      if (run.conclusion !== "success") throw new Error("Ripresa non riuscita.");
      const jobs = json("api", `repos/${repository}/actions/runs/${number}/jobs?per_page=100`).jobs;
      const environment = run.path.endsWith("publish.yml") ? "production" : "test";
      if (
        jobs.some(
          (job) =>
            job.name === (environment === "test" ? "Deploy test" : "Distribuisci e verifica") &&
            job.conclusion === "success",
        )
      ) {
        readback(repository, run, environment);
        if (environment === "production") {
          publishedRelease(repository, run.head_sha, values.version);
          cleanupIntegrated(repository);
        }
      }
      console.log(
        "Run riconciliata; per la pulizia PR riprendere release:cycle pr sul suo numero.",
      );
      return;
    }
    if (command === "pr") {
      if (!/^\d+$/u.test(number ?? "")) throw new Error("Numero PR non valido.");
      const fields =
        "state,isDraft,autoMergeRequest,headRefName,headRefOid,baseRefName,baseRefOid,mergeCommit,headRepository";
      let pr = json("pr", "view", number, "--repo", repository, "--json", fields);
      if (pr.baseRefName !== "develop" || pr.headRepository?.nameWithOwner !== repository)
        throw new Error(
          "Il ciclo PR gestisce soltanto branch dello stesso repository verso develop.",
        );
      if (["main", "develop", "legacy/1.x"].includes(pr.headRefName))
        throw new Error("La PR non parte da un feature branch.");
      if (pr.state === "CLOSED") throw new Error("PR chiusa senza merge.");
      if (pr.state === "OPEN") {
        // Solo la qualifica finale viene coordinata; il lavoro in bozza resta indipendente.
        if (pr.autoMergeRequest) gh("pr", "merge", number, "--disable-auto", "--repo", repository);
        if (!pr.isDraft) gh("pr", "ready", number, "--undo", "--repo", repository);
        const base = gh("api", `repos/${repository}/git/ref/heads/develop`, "--jq", ".object.sha");
        git("fetch", "origin", "develop", pr.headRefName);
        let current = false;
        try {
          git("merge-base", "--is-ancestor", base, pr.headRefOid);
          current = true;
        } catch {
          /* Base da aggiornare. */
        }
        if (!current) gh("pr", "update-branch", number, "--repo", repository);
        pr = json("pr", "view", number, "--repo", repository, "--json", fields);
        const expectedHead = pr.headRefOid;
        const since = Date.now() - 1000;
        gh("pr", "ready", number, "--repo", repository);
        await waitRun(repository, "ci.yml", expectedHead, pr.headRefName, ["pull_request"], since);
        pr = json("pr", "view", number, "--repo", repository, "--json", fields);
        if (pr.headRefOid !== expectedHead) throw new Error("PR modificata durante la qualifica.");
        gh(
          "pr",
          "merge",
          number,
          "--repo",
          repository,
          "--auto",
          "--squash",
          "--match-head-commit",
          pr.headRefOid,
        );
        await watch(["pr", "checks", number, "--repo", repository, "--watch", "--interval", "30"]);
        for (let attempt = 0; attempt < 60; attempt++) {
          pr = json("pr", "view", number, "--repo", repository, "--json", fields);
          if (pr.state !== "OPEN") break;
          if (pr.headRefOid !== expectedHead) throw new Error("PR modificata durante il ciclo.");
          await pause(30000);
        }
      }
      if (pr.state !== "MERGED")
        throw new Error("Merge non confermato: ciclo riprendibile dalla stessa PR.");
      const run = await waitRun(repository, "ci.yml", pr.mergeCommit.oid, "develop");
      const jobs = json("api", `repos/${repository}/actions/runs/${run.id}/jobs?per_page=100`).jobs;
      const files = json("pr", "view", number, "--repo", repository, "--json", "files").files.map(
        (file) => file.path,
      );
      const deployed = checkCycleJobs(jobs, plan(files).deploy);
      if (deployed) readback(repository, run, "test");
      git("fetch", "origin", "develop", `refs/pull/${number}/head`);
      if (git("branch", "--show-current") === pr.headRefName && !git("status", "--porcelain"))
        git("merge", "--ff-only", pr.headRefOid);
      cleanup(pr);
      cleanupIntegrated(repository);
      console.log("Merge, collaudo CI e pulizia del branch riconciliati.");
      console.log(git("worktree", "list"));
      console.log(git("for-each-ref", "--format=%(refname:short)", "refs/heads/codex"));
      return;
    }
    if (!/^[0-9a-f]{40}$/u.test(values.sha ?? "")) throw new Error("SHA completo richiesto.");
    const ref = candidateRef(command, values.ref);
    assertBase(
      values.sha,
      gh("api", `repos/${repository}/git/ref/heads/${ref}`, "--jq", ".object.sha"),
    );
    if (command === "production" && !values.version)
      throw new Error("Versione Production richiesta.");
    const existing = json(
      "run",
      "list",
      "--repo",
      repository,
      "--workflow",
      "publish.yml",
      "--branch",
      ref,
      "--limit",
      "50",
      "--json",
      "databaseId,headSha,status,conclusion",
    ).find((run) => run.headSha === values.sha);
    if (existing) {
      const jobs = json(
        "api",
        `repos/${repository}/actions/runs/${existing.databaseId}/jobs?per_page=100`,
      ).jobs;
      const publish = jobs.find((job) => job.name === "Distribuisci e verifica");
      if (
        existing.status !== "completed" ||
        existing.conclusion !== "success" ||
        !["success", "skipped"].includes(publish?.conclusion)
      )
        throw new Error(
          `Candidato già presente: riconciliare con release:cycle resume ${existing.databaseId}, senza un nuovo dispatch.`,
        );
      if (command === "production" && publish.conclusion === "success") {
        const run = summary(repository, existing.databaseId);
        readback(repository, run, "production");
        publishedRelease(repository, run.head_sha, values.version);
        cleanupIntegrated(repository);
        return;
      }
      const tree = json("api", `repos/${repository}/git/commits/${values.sha}`).tree.sha;
      const certified = candidateAvailable(repository, tree);
      if (command === "candidate" && certified) {
        summary(repository, existing.databaseId);
        console.log("Qualifica già riuscita: nessun nuovo dispatch.");
        return;
      }
    }
    const since = Date.now() - 1000;
    gh(
      "workflow",
      "run",
      "publish.yml",
      "--repo",
      repository,
      "--ref",
      ref,
      "-f",
      `expected_sha=${values.sha}`,
      "-f",
      `prova=${command === "candidate"}`,
      "-f",
      `version=${values.version ?? ""}`,
      "-f",
      `reviewed_migrations=${values["reviewed-migrations"]}`,
    );
    const run = await waitRun(
      repository,
      "publish.yml",
      values.sha,
      ref,
      ["workflow_dispatch"],
      since,
    );
    if (command === "production") {
      readback(repository, run, "production");
      publishedRelease(repository, run.head_sha, values.version);
      cleanupIntegrated(repository);
    }
    console.log(
      command === "candidate"
        ? "Candidato qualificato, senza deploy."
        : "Workflow Production concluso; ricevuta e release disponibili nella run.",
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]))
  await main();
