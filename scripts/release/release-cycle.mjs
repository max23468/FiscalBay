#!/usr/bin/env node
/**
 * Coordinamento esplicito del ciclo: status legge; pr/cleanup/candidate/production hanno
 * effetti. Il ciclo di una PR pulisce soltanto il proprio branch; i residui di cicli
 * precedenti si riconciliano a lotti con cleanup e a ogni Production.
 */
import { execFileSync, spawn } from "node:child_process";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  existsSync,
  mkdtempSync,
  cpSync,
  statSync,
} from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { plan } from "../classify-changes.mjs";
import { assertBrowserEvidence } from "./release-notes.mjs";
import { addedMigrations, reviewAdded } from "./release.mjs";
import { verifiedBuildOrigin } from "../find-build.mjs";

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

/**
 * `gh pr` e `gh repo view` passano da GraphQL, che le sessioni Claude Code cloud non
 * raggiungono: repository, PR, file e controlli si leggono con l'API REST. Merge automatico e
 * uscita dalla bozza esistono soltanto in GraphQL: nel cloud passano dalle route del proxy.
 */
export function pullRequestView(pull) {
  const merged = Boolean(pull.merged_at);
  return {
    state: merged ? "MERGED" : pull.state.toUpperCase(),
    isDraft: pull.draft,
    autoMergeRequest: pull.auto_merge,
    headRefName: pull.head.ref,
    headRefOid: pull.head.sha,
    baseRefName: pull.base.ref,
    baseRefOid: pull.base.sha,
    mergeCommit: merged ? { oid: pull.merge_commit_sha } : null,
    headRepository: pull.head.repo ? { nameWithOwner: pull.head.repo.full_name } : null,
    body: pull.body ?? "",
  };
}

export function pullRequestAction(action, repository, number, head, env = process.env) {
  const pull = `repos/${repository}/pulls/${number}`;
  if (env.CLAUDE_CODE_REMOTE === "true")
    return {
      "enable-auto": ["api", "-X", "PUT", `${pull}/ccr/auto_merge`, "-f", "merge_method=squash"],
      "disable-auto": ["api", "-X", "DELETE", `${pull}/ccr/auto_merge`],
      ready: ["api", "-X", "POST", `${pull}/ccr/ready_for_review`],
    }[action];
  return {
    "enable-auto": [
      "pr",
      "merge",
      number,
      "--repo",
      repository,
      "--auto",
      "--squash",
      "--match-head-commit",
      head,
    ],
    "disable-auto": ["pr", "merge", number, "--disable-auto", "--repo", repository],
    ready: ["pr", "ready", number, "--repo", repository],
  }[action];
}

export function checksOutcome(checkRuns) {
  // Come GitHub, conta soltanto l'ultima esecuzione di ogni controllo: una run annullata da
  // quella successiva non fa fallire la PR.
  const latest = new Map();
  for (const check of checkRuns)
    if (!latest.has(check.name) || latest.get(check.name).id < check.id)
      latest.set(check.name, check);
  const current = [...latest.values()];
  const failed = ["failure", "cancelled", "timed_out", "action_required", "startup_failure"];
  if (current.some((check) => failed.includes(check.conclusion))) return "failed";
  return current.every((check) => check.status === "completed") ? "passed" : "pending";
}

/**
 * GitHub rifiuta il merge automatico di una PR già unibile; `gh pr merge --auto` in quel caso
 * unisce subito, e nel cloud si fa lo stesso con il merge REST vincolato alla testa.
 */
function enableAutoMerge(repository, number, head) {
  try {
    gh(...pullRequestAction("enable-auto", repository, number, head));
  } catch (error) {
    if (!/is in (clean|unstable) status/u.test(String(error.stderr ?? ""))) throw error;
    gh(
      "api",
      "-X",
      "PUT",
      `repos/${repository}/pulls/${number}/merge`,
      "-f",
      "merge_method=squash",
      "-f",
      `sha=${head}`,
    );
  }
}

const readPullRequest = (repository, number) =>
  pullRequestView(json("api", `repos/${repository}/pulls/${number}`));

async function waitChecks(repository, sha) {
  for (;;) {
    const outcome = checksOutcome(
      json(
        "api",
        "--paginate",
        "--slurp",
        `repos/${repository}/commits/${sha}/check-runs?per_page=100`,
      ).flatMap((page) => page.check_runs),
    );
    if (outcome === "failed") throw new Error("Monitoraggio terminato con controlli falliti.");
    if (outcome === "passed") return;
    await pause(30_000);
  }
}

/**
 * Blocco a cartella con il PID del titolare. Quello di un processo terminato si rimuove; una
 * cartella ancora senza titolare è appena nata in un altro ciclo, salvo che sia vecchia di un
 * minuto e quindi rimasta da un processo interrotto.
 */
export function acquireLock(directory, pid = process.pid, now = Date.now()) {
  if (existsSync(directory)) {
    let owner;
    try {
      owner = JSON.parse(readFileSync(path.join(directory, "owner.json"), "utf8"));
    } catch {
      if (now - statSync(directory).mtimeMs < 60_000) return false;
    }
    if (owner) {
      try {
        process.kill(owner.pid, 0);
        return false;
      } catch (error) {
        if (error.code !== "ESRCH") return false;
      }
    }
    rmSync(directory, { recursive: true, force: true });
  }
  try {
    mkdirSync(directory);
  } catch (error) {
    if (error.code === "EEXIST") return false;
    throw error;
  }
  writeFileSync(path.join(directory, "owner.json"), JSON.stringify({ pid }));
  return true;
}

/** Esegue `work` con il blocco, attendendo che l'altro titolare lo lasci; vale anche se asincrono. */
export function withLock(directory, label, work, wait = 5000) {
  for (let notified = false; !acquireLock(directory); notified = true) {
    if (!notified) console.log(`In attesa che un altro ciclo concluda ${label}.`);
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, wait);
  }
  const release = () => rmSync(directory, { recursive: true, force: true });
  let result;
  try {
    result = work();
  } catch (error) {
    release();
    throw error;
  }
  if (result instanceof Promise) return result.finally(release);
  release();
  return result;
}

/**
 * Blocchi del clone, nella cartella Git comune a tutti i worktree: uno per oggetto del ciclo e
 * due brevi condivisi, per i riferimenti locali e per il merge.
 */
function lockDirectory(name) {
  const root = path.resolve(git("rev-parse", "--git-common-dir"), "release-cycle");
  mkdirSync(root, { recursive: true });
  return path.join(root, name);
}

/** Fetch, worktree e branch locali: un ciclo alla volta, per pochi secondi. */
const localGit = (work) => withLock(lockDirectory("git"), "le operazioni Git locali", work);

export function assertBase(expected, current) {
  if (!/^[0-9a-f]{40}$/u.test(expected ?? "") || current !== expected)
    throw new Error("La base della PR è avanzata: aggiornarla prima della qualifica finale.");
}

// File che valgono per tutto il prodotto o per la procedura di qualifica: se cambiano da una
// delle due parti, la PR si riqualifica sulla base attuale.
const globalFile =
  /^(?:package\.json|pnpm-(?:lock|workspace)\.yaml|tsconfig[^/]*\.json|[^/]+\.config\.ts|\.github\/|scripts\/(?:classify-changes\.mjs|release\/)|e2e\/(?![^/]+\.spec\.ts$))/u;

/**
 * Vero se i commit entrati nella base non richiedono di riqualificare la PR: file disgiunti,
 * nessun file globale da una delle due parti e migration nuove da una parte sola. Il push su
 * `develop` riesegue comunque il gate sul tree integrato prima del deploy test.
 */
export function independentBase(prFiles, baseFiles) {
  if (!baseFiles.length) return true;
  const own = new Set(prFiles);
  const migrations = (files) => files.some((file) => file.startsWith("migrations/"));
  return !(
    baseFiles.some((file) => own.has(file)) ||
    [...prFiles, ...baseFiles].some((file) => globalFile.test(file)) ||
    (migrations(prFiles) && migrations(baseFiles))
  );
}

/**
 * Confronta la base qualificata `tested` con quella attuale: i file della PR partono dal punto
 * di divergenza fra `tested` e la testa, quelli della base da `tested`.
 */
export function compatibleBase(tested, current, head, run = git) {
  if (tested === current) return true;
  const files = (from, to) => run("diff", "--name-only", from, to).split("\n").filter(Boolean);
  return independentBase(files(run("merge-base", tested, head), head), files(tested, current));
}

/**
 * Base della qualifica finale: `main` riceve soltanto `develop` già aggiornato; verso `develop`
 * basta una base attuale compatibile con quella provata.
 */
export function assertQualificationBase(ref, tested, current, head, run = git) {
  if (ref === "main") {
    assertBase(tested, current);
    if (!contains(tested, head, run)) throw new Error("La promozione non contiene la base.");
    return;
  }
  if (!/^[0-9a-f]{40}$/u.test(tested ?? "") || !compatibleBase(tested, current, head, run))
    throw new Error(
      "La base della PR è avanzata su file comuni o globali: aggiornarla e riqualificarla.",
    );
}

/**
 * `gh pr update-branch` risponde prima che GitHub crei il merge con la base: la PR va riletta
 * finché la sua testa cambia e contiene la base, altrimenti il ciclo attenderebbe la run sul
 * commit precedente.
 */
export async function waitUpdatedHead(read, previous, contains, attempts = 30, delay = 2000) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const pr = read();
    if (pr.headRefOid !== previous && contains(pr.headRefOid)) return pr;
    await pause(delay);
  }
  throw new Error("Base della PR non aggiornata da GitHub: nessun rilancio automatico.");
}

function contains(base, head, run = git) {
  try {
    run("merge-base", "--is-ancestor", base, head);
    return true;
  } catch {
    return false;
  }
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

/**
 * Run più recente del workflow sul commit atteso, esclusi gli eventi estranei e le run già
 * annullate da una successiva: il ritorno della PR da bozza a pronta avvia una nuova run che
 * annulla, per concorrenza, quella avviata dalla push.
 */
export function expectedRun(runs, sha, events, since, cancelled = new Set()) {
  return runs
    .filter(
      (item) =>
        item.headSha === sha &&
        events.includes(item.event) &&
        Date.parse(item.createdAt) >= since &&
        !cancelled.has(item.databaseId),
    )
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
}

async function waitRun(
  repository,
  workflow,
  sha,
  branch,
  events = ["push", "workflow_dispatch"],
  since = 0,
) {
  const cancelled = new Set();
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
    const run = expectedRun(runs, sha, events, since, cancelled);
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
        ]).catch(() => {
          /* L'esito si rilegge sotto, compreso l'annullamento per una run successiva. */
        });
      const result = summary(repository, run.databaseId);
      // Il monitoraggio interrotto, per esempio dalla rete, lascia la run in corso: si riprende.
      if (result.status !== "completed") {
        attempt = -1;
        await pause(10000);
        continue;
      }
      if (result.conclusion === "cancelled") {
        // Una run successiva sullo stesso commit la sostituisce: si segue quella.
        cancelled.add(run.databaseId);
        attempt = -1;
        continue;
      }
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
    localGit(() => {
      git("fetch", "origin", environment === "test" ? "develop" : "main");
      git("worktree", "add", "--detach", checkout, run.head_sha);
    });
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
        "scripts/release/release.mjs",
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
    if (attached) localGit(() => git("worktree", "remove", "--force", checkout));
    rmSync(directory, { recursive: true, force: true });
  }
}

/** I cloni delle sessioni cloud sono superficiali: merge-base e merge-tree richiedono la storia. */
export function completeHistory(cwd = process.cwd()) {
  const git = (...args) => execute("git", args, { cwd });
  if (git("rev-parse", "--is-shallow-repository") === "true")
    git("fetch", "--quiet", "--unshallow", "origin");
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

export function cleanup(pr, cwd = process.cwd()) {
  const git = (...args) => execute("git", args, { cwd });
  const branch = pr.headRefName;
  if (
    ["main", "develop", "legacy/1.x"].includes(branch) ||
    /(?:^|\/)rollback(?:\/|$)/u.test(branch)
  )
    throw new Error("Riferimento protetto: conservato.");
  const local = git("for-each-ref", "--format=%(objectname)", `refs/heads/${branch}`);
  if (
    (local && local !== pr.headRefOid) ||
    !squashIntegrated(pr.headRefOid, pr.mergeCommit.oid, cwd)
  )
    throw new Error("Branch locale con contenuto non riconciliato: conservato.");
  const worktrees = git("worktree", "list", "--porcelain").split("\n");
  const current = git("branch", "--show-current");
  if (current !== branch && worktrees.includes(`branch refs/heads/${branch}`))
    throw new Error("Branch ancora usato in un altro worktree: conservato.");
  if (current === branch) {
    if (git("status", "--porcelain")) throw new Error("Checkout modificato: pulizia sospesa.");
    // In un worktree dedicato la base è spesso attiva nel checkout principale e git
    // rifiuta di attivarla due volte: il worktree resta staccato sulla base remota.
    if (worktrees.includes(`branch refs/heads/${pr.baseRefName}`))
      git("switch", "--detach", `origin/${pr.baseRefName}`);
    else {
      git("switch", pr.baseRefName);
      git("merge", "--ff-only", `origin/${pr.baseRefName}`);
    }
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
  localGit(() => cleanupIntegratedBranches(repository));
}

function cleanupIntegratedBranches(repository) {
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
    const owner = repository.split("/")[0];
    const pr = json(
      "api",
      `repos/${repository}/pulls?state=closed&head=${owner}:${encodeURIComponent(branch)}&per_page=100`,
    )
      .filter((pull) => pull.merged_at)
      .map((pull) => ({ number: pull.number, ...pullRequestView(pull) }))[0];
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
  if (!["status", "pr", "cleanup", "candidate", "production", "resume"].includes(command))
    throw new Error(
      "Uso: release:cycle status <run> | pr <numero> | cleanup | candidate --sha <sha> | production --sha <sha> --version <versione> | resume <run>.",
    );
  const repository = json("api", "repos/{owner}/{repo}").full_name;
  if (command === "status") {
    if (!/^\d+$/u.test(number ?? "")) throw new Error("Run non valida.");
    summary(repository, number);
    return;
  }
  if (git("status", "--porcelain"))
    throw new Error(
      "Il ciclo richiede un checkout pulito; conservare e completare il lavoro locale.",
    );
  localGit(() => completeHistory());
  // Cicli su oggetti diversi procedono insieme; sullo stesso oggetto uno solo.
  const object =
    command === "pr" ? `pr-${number}` : command === "resume" ? `run-${number}` : command;
  const directory = lockDirectory(object);
  if (!acquireLock(directory)) throw new Error(`Un altro ciclo locale è già attivo: ${object}.`);
  try {
    if (command === "cleanup") {
      cleanupIntegrated(repository);
      return;
    }
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
      let pr = readPullRequest(repository, number);
      if (pr.baseRefName !== "develop" || pr.headRepository?.nameWithOwner !== repository)
        throw new Error(
          "Il ciclo PR gestisce soltanto branch dello stesso repository verso develop.",
        );
      if (["main", "develop", "legacy/1.x"].includes(pr.headRefName))
        throw new Error("La PR non parte da un feature branch.");
      if (pr.state === "CLOSED") throw new Error("PR chiusa senza merge.");
      if (pr.state === "OPEN") {
        // Il merge automatico resta sospeso finché la testa non è qualificata sulla base attuale.
        if (pr.autoMergeRequest)
          gh(...pullRequestAction("disable-auto", repository, number, pr.headRefOid));
        const read = () => readPullRequest(repository, number);
        const develop = () =>
          gh("api", `repos/${repository}/git/ref/heads/develop`, "--jq", ".object.sha");
        const fetchHead = (...refs) =>
          localGit(() => git("fetch", "origin", ...refs, pr.headRefName));
        // Una base avanzata richiede una nuova qualifica soltanto se tocca file della PR o globali.
        const independent = (base) =>
          compatibleBase(git("merge-base", base, pr.headRefOid), base, pr.headRefOid);
        // Le migration non additive si approvano prima della qualifica: senza la riga il ciclo
        // si ferma subito; con la riga aggiunta dopo l'apertura ripete il `Verify` fallito.
        fetchHead("develop");
        const forkPoint = git("merge-base", "origin/develop", pr.headRefOid);
        if (reviewAdded(addedMigrations(forkPoint, pr.headRefOid), pr.body)) {
          const last = json(
            "run",
            "list",
            "--repo",
            repository,
            "--workflow",
            "ci.yml",
            "--commit",
            pr.headRefOid,
            "--event",
            "pull_request",
            "--limit",
            "1",
            "--json",
            "databaseId,status,conclusion",
          )[0];
          const blocked =
            last?.conclusion === "failure" &&
            json("api", `repos/${repository}/actions/runs/${last.databaseId}/jobs?per_page=100`)
              .jobs.flatMap((job) => job.steps ?? [])
              .some(
                (step) => step.name === "Check migration review" && step.conclusion === "failure",
              );
          if (blocked) {
            gh("run", "rerun", String(last.databaseId), "--repo", repository, "--failed");
            for (let attempt = 0; attempt < 30; attempt++) {
              const run = json("api", `repos/${repository}/actions/runs/${last.databaseId}`);
              if (run.status !== "completed") break;
              await pause(2000);
            }
          }
        }
        // Una base avanzata su file comuni fa fallire la qualifica: il ciclo aggiorna la PR e
        // segue la nuova qualifica, fino a tre volte, senza rimetterla in bozza.
        const qualify = async () => {
          for (let attempt = 1; ; attempt++) {
            const base = develop();
            fetchHead("develop");
            let since = 0;
            if (!independent(base)) {
              since = Date.now() - 1000;
              gh(
                "api",
                "-X",
                "PUT",
                `repos/${repository}/pulls/${number}/update-branch`,
                "-f",
                `expected_head_sha=${pr.headRefOid}`,
              );
              pr = await waitUpdatedHead(read, pr.headRefOid, (head) => {
                fetchHead();
                return contains(base, head);
              });
            }
            if (pr.isDraft) {
              since = Date.now() - 1000;
              gh(...pullRequestAction("ready", repository, number, pr.headRefOid));
            }
            // Senza aggiornamento vale la run già avviata sulla testa, anche se ancora in corso.
            try {
              await waitRun(
                repository,
                "ci.yml",
                pr.headRefOid,
                pr.headRefName,
                ["pull_request"],
                since,
              );
              return;
            } catch (error) {
              const current = develop();
              fetchHead("develop");
              if (attempt === 3 || independent(current)) throw error;
              console.log("Base avanzata su file comuni durante la qualifica: aggiornamento.");
              pr = read();
            }
          }
        };
        // Un merge alla volta: le qualifiche delle altre PR proseguono intanto, e la PR entra
        // soltanto se la base attuale resta compatibile con la sua testa, altrimenti si riqualifica.
        for (let round = 1; pr.state === "OPEN"; round++) {
          await qualify();
          const expectedHead = pr.headRefOid;
          const requalify = await withLock(lockDirectory("merge"), "il merge", async () => {
            fetchHead("develop");
            pr = read();
            if (pr.headRefOid !== expectedHead)
              throw new Error("PR modificata durante la qualifica.");
            if (!independent(develop())) {
              if (round === 3)
                throw new Error("Base avanzata più volte: ciclo riprendibile dalla stessa PR.");
              console.log("Base avanzata su file comuni in attesa del merge: nuova qualifica.");
              return true;
            }
            enableAutoMerge(repository, number, pr.headRefOid);
            await waitChecks(repository, pr.headRefOid);
            // Il blocco del merge ferma le altre PR: l'esito si rilegge ogni dieci secondi.
            for (let attempt = 0; attempt < 180; attempt++) {
              pr = read();
              if (pr.state !== "OPEN") break;
              if (pr.headRefOid !== expectedHead)
                throw new Error("PR modificata durante il ciclo.");
              await pause(10_000);
            }
            return false;
          });
          if (!requalify) break;
        }
      }
      if (pr.state !== "MERGED")
        throw new Error("Merge non confermato: ciclo riprendibile dalla stessa PR.");
      const run = await waitRun(repository, "ci.yml", pr.mergeCommit.oid, "develop");
      const jobs = json("api", `repos/${repository}/actions/runs/${run.id}/jobs?per_page=100`).jobs;
      const files = json(
        "api",
        "--paginate",
        "--slurp",
        `repos/${repository}/pulls/${number}/files?per_page=100`,
      )
        .flat()
        .map((file) => file.filename);
      const deployed = checkCycleJobs(jobs, plan(files).deploy);
      if (deployed) readback(repository, run, "test");
      localGit(() => {
        git("fetch", "origin", "develop", `refs/pull/${number}/head`);
        if (git("branch", "--show-current") === pr.headRefName && !git("status", "--porcelain"))
          git("merge", "--ff-only", pr.headRefOid);
        cleanup(pr);
      });
      console.log("Merge, collaudo CI e pulizia del branch riconciliati.");
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
