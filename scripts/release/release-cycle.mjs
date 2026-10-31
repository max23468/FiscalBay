#!/usr/bin/env node
/**
 * Coordinamento esplicito del ciclo: status e rc leggono; pr/cleanup/promote/candidate/production
 * hanno effetti; qualification-base e promotion-source controllano nella CI la base e l'origine di
 * una PR. Il ciclo di una PR pulisce soltanto il proprio branch; i residui di cicli
 * precedenti si riconciliano a lotti con cleanup e a ogni Production.
 */
import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
  rmSync,
  existsSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { needsDeploy, plan } from "../classify-changes.mjs";
import {
  addedMigrations,
  assertPromotionSource,
  candidateVersion,
  datedChangelog,
  promotionBranch,
  reviewAdded,
  romeDay,
} from "./release.mjs";
import { verifiedBuildOrigin } from "../find-build.mjs";
import { lastDeployRun } from "../find-deployed.mjs";
import { gh, ghJson, runJobs } from "../lib/provider.mjs";

// Diff e cronologie grandi superano il MiB predefinito di execFileSync.
const execute = (command, args, options = {}) =>
  (
    execFileSync(command, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...options }) ?? ""
  ).trim();
const git = (...args) => execute("git", args);
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

/** File della PR, senza le patch: in una PR grande pesano più di un MiB. */
export function pullRequestFiles(repository, number, run = gh) {
  return run(
    "api",
    "--paginate",
    "--jq",
    ".[].filename",
    `repos/${repository}/pulls/${number}/files?per_page=100`,
  )
    .split("\n")
    .filter(Boolean);
}

const readPullRequest = (repository, number) =>
  pullRequestView(ghJson("api", `repos/${repository}/pulls/${number}`));

async function waitChecks(repository, sha) {
  for (;;) {
    const outcome = checksOutcome(
      ghJson(
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
  /^(?:package\.json|pnpm-(?:lock|workspace)\.yaml|tsconfig[^/]*\.json|[^/]+\.config\.ts|\.github\/|scripts\/(?:classify-changes\.mjs|release\/|lib\/)|e2e\/(?![^/]+\.spec\.ts$))/u;

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

/** Controllo della CI sulla PR: confronta la base provata con quella attuale di `origin`. */
function qualificationBase({ ref, base, head }) {
  if (!["develop", "main"].includes(ref)) throw new Error("--ref develop o main richiesto.");
  git("fetch", "--quiet", "origin", ref);
  assertQualificationBase(ref, base, git("rev-parse", "FETCH_HEAD"), head);
  console.log(`Base della qualifica valida verso ${ref}.`);
}

/**
 * Controllo della CI sulle PR verso `main`: `develop`, oppure `promuovi/<versione>` che contiene
 * `develop` e ne differisce soltanto per il giorno della versione.
 */
function promotionSource({ ref, head }) {
  if (ref === "develop") return console.log("Promozione da develop.");
  git("fetch", "--quiet", "origin", "develop");
  const develop = git("rev-parse", "FETCH_HEAD");
  if (!contains(develop, head)) throw new Error(`${ref} non contiene develop: ricrearlo.`);
  assertPromotionSource({
    headRef: ref,
    files: git("diff", "--name-only", develop, head).split("\n").filter(Boolean),
    develop: git("show", `${develop}:CHANGELOG.md`),
    head: git("show", `${head}:CHANGELOG.md`),
  });
  console.log(`${ref}: develop con il giorno della versione.`);
}

/**
 * Apre l'unica PR di promozione: `promuovi/<versione>` è `develop` con il giorno di oggi
 * nell'intestazione della versione, che il riallineamento riporta poi su `develop`.
 */
async function promoteCycle({ repository, values }) {
  const version = values.version;
  if (!/^\d+\.\d+\.\d+$/u.test(version ?? "")) throw new Error("--version <x.y.z> richiesto.");
  const branch = promotionBranch(version);
  const day = romeDay();
  const directory = mkdtempSync(path.join(tmpdir(), "fiscalbay-promuovi-"));
  try {
    const develop = localGit(() => {
      git("fetch", "--quiet", "origin", "develop");
      const sha = git("rev-parse", "FETCH_HEAD");
      git("worktree", "add", "--quiet", "--detach", directory, sha);
      return sha;
    });
    const file = path.join(directory, "CHANGELOG.md");
    writeFileSync(file, datedChangelog(readFileSync(file, "utf8"), version, day));
    const inside = (...args) => execute("git", args, { cwd: directory });
    inside("commit", "--quiet", "-m", `chore: giorno della ${version}`, "--", "CHANGELOG.md");
    // Un branch rimasto da un tentativo precedente si sostituisce soltanto se è ancora suo.
    inside(
      "push",
      "--quiet",
      `--force-with-lease=refs/heads/${branch}`,
      "origin",
      `HEAD:refs/heads/${branch}`,
    );
    const pull = ghJson(
      "api",
      "-X",
      "POST",
      `repos/${repository}/pulls`,
      "-f",
      "base=main",
      "-f",
      `head=${branch}`,
      "-f",
      `title=chore: promuove la ${version}`,
      "-f",
      `body=Promozione di \`develop\` (\`${develop}\`) su \`main\` per la \`${version}\`, con il giorno ${day} nel changelog.`,
    );
    console.log(`PR di promozione: ${pull.html_url}`);
  } finally {
    localGit(() => git("worktree", "remove", "--force", directory));
  }
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
  if (deploy?.conclusion === "success") assertConfirmed(jobs, "test");
  return deploy?.conclusion === "success";
}

// Il readback provider chiude il job di distribuzione, con segreti e rete del workflow: il ciclo
// ne legge l'esito con l'API REST, anche da una sessione senza accesso a Cloudflare.
const confirmation = {
  test: ["Deploy test", "Confirm provider readback"],
  production: ["Distribuisci e verifica", "Create immutable tag and release"],
};

export function assertConfirmed(jobs, environment) {
  const [jobName, stepName] = confirmation[environment];
  const job = jobs.find((item) => item.name === jobName);
  if (job?.steps?.find((step) => step.name === stepName)?.conclusion !== "success")
    throw new Error(`Readback provider non confermato nella run: ${environment}.`);
}

/**
 * Deploy test riuscito e collaudato, fallito soltanto alla conferma: la conferma richiede che
 * `develop` sia ancora sul commit distribuito, quindi un merge successivo durante il deploy la
 * rifiuta anche se distribuzione e prove remote sono riuscite. Ogni altro job deve essere
 * riuscito o saltato.
 */
export function readbackSuperseded(jobs) {
  const deploy = jobs.find((job) => job.name === "Deploy test");
  if (deploy?.conclusion !== "failure") return false;
  if (jobs.some((job) => job !== deploy && !["success", "skipped"].includes(job.conclusion)))
    return false;
  const step = (name) => deploy.steps?.find((item) => item.name === name)?.conclusion;
  const failed = (deploy.steps ?? []).filter((item) => item.conclusion === "failure");
  return (
    failed.length === 1 &&
    failed[0].name === "Confirm provider readback" &&
    [
      "Deploy verified artifact",
      "Check deployed browser interactions",
      "Check deployed pages",
    ].every((name) => step(name) === "success") &&
    step("Roll back test deploy") !== "success"
  );
}

/**
 * Run che chiude il ciclo del commit integrato. Se la sua conferma è stata superata da un merge
 * successivo, segue la run della nuova testa di `develop`, che deve contenere il commit e avere
 * deploy test e readback confermati; fino a tre merge successivi. Ogni altro esito si ferma.
 */
export async function settleMergeRun(merge, deployRequired, io) {
  let run = await io.wait(merge);
  let jobs = await io.jobs(run);
  let required = deployRequired;
  for (let hop = 0; run.conclusion !== "success"; hop++) {
    if (hop === 3 || !readbackSuperseded(jobs))
      throw new Error(`Run ${run.id} non riuscita: riconciliare prima della ripresa.`);
    const head = await io.head();
    if (head === run.head_sha || !(await io.contains(merge, head)))
      throw new Error(`Run ${run.id} non riuscita: riconciliare prima della ripresa.`);
    console.log("Readback superato da un merge successivo: si segue la run della nuova testa.");
    run = await io.wait(head);
    jobs = await io.jobs(run);
    // La nuova testa distribuisce anche il commit integrato: il deploy confermato è richiesto.
    required = true;
  }
  return { run, jobs, deployRequired: required };
}

export function assertPublishedRelease(release, tagSha, sha, version) {
  if (release.isDraft || release.tagName !== `v${version}` || tagSha !== sha || !release.url)
    throw new Error("Tag o release non confermati sul candidato.");
}

function publishedRelease(repository, sha, version) {
  const releases = version
    ? [{ tagName: `v${version}` }]
    : ghJson("api", `repos/${repository}/releases?per_page=50`)
        .filter((release) => !release.draft)
        .map((release) => ({ tagName: release.tag_name }));
  for (const release of releases) {
    const ref = ghJson("api", `repos/${repository}/git/ref/tags/${release.tagName}`);
    const commit =
      ref.object.type === "tag"
        ? ghJson("api", `repos/${repository}/git/tags/${ref.object.sha}`).object.sha
        : ref.object.sha;
    if (commit !== sha && !version) continue;
    const found = ghJson("api", `repos/${repository}/releases/tags/${release.tagName}`);
    const details = { tagName: found.tag_name, isDraft: found.draft, url: found.html_url };
    assertPublishedRelease(details, commit, sha, version ?? release.tagName.slice(1));
    console.log(`Release verificata: ${details.url}.`);
    return;
  }
  throw new Error("Release sul candidato non osservata.");
}

/**
 * Identità della release candidate: la testa di `develop`, con una RC in cima al changelog,
 * distribuita sul test dall'ultimo deploy confermato. Dopo quel deploy e dopo la sezione della
 * versione non entrano modifiche da distribuire: una correzione distribuita apre la RC successiva.
 * La qualifica completa del tree, richiesta dalla decisione sulla RC, si riporta senza attenderla.
 */
export async function identifyCandidate(io) {
  const head = await io.head();
  const version = candidateVersion(await io.changelog(head));
  if (!version) throw new Error("Nessuna release candidate in cima al changelog di develop.");
  const changed = async (base) => base !== head && (await io.needsDeploy(base, head));
  const deploy = await io.lastDeploy(head);
  if (!deploy) throw new Error("Nessun deploy test riuscito su un antenato di develop.");
  checkCycleJobs(deploy.jobs, true);
  if (await changed(deploy.run.head_sha))
    throw new Error("Modifiche da distribuire dopo l'ultimo deploy test: attendere il deploy.");
  if (await changed(await io.introduced(version, head)))
    throw new Error(
      `Candidato cambiato dopo la sezione ${version}: aggiungere la RC successiva al changelog.`,
    );
  const receipt = await io.receipt(deploy.run);
  if (receipt.sha !== deploy.run.head_sha || !receipt.readback || receipt.rolledBack)
    throw new Error("Ricevuta del deploy test non confermata.");
  if ((await io.liveVersion()) !== receipt.version)
    throw new Error("La versione attiva sul test non è quella del deploy confermato.");
  const tree = await io.tree(head);
  return {
    version,
    commit: head,
    tree,
    deployedCommit: receipt.sha,
    artifact: receipt.digest,
    workerVersion: receipt.version,
    run: deploy.run.html_url,
    migrations: receipt.schema.length,
    lastMigration: receipt.schema.at(-1)?.name ?? null,
    config: await io.config(head),
    qualified: await io.certified(tree),
  };
}

function candidateAvailable(repository, tree) {
  const repositoryId = ghJson("api", `repos/${repository}`).id;
  const artifacts = ghJson(
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
    const run = ghJson("api", `repos/${repository}/actions/runs/${origin.id}`);
    const jobs = runJobs(repository, origin.id);
    if (verifiedBuildOrigin(artifact, run, jobs, repositoryId, "candidate")) return true;
  }
  return false;
}

function summary(repository, runId) {
  const run = ghJson("api", `repos/${repository}/actions/runs/${runId}`);
  const jobs = [];
  for (let attempt = 1; attempt <= run.run_attempt; attempt++)
    jobs.push(...runJobs(repository, runId, attempt));
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
  accepted = ["success"],
) {
  const cancelled = new Set();
  for (let attempt = 0; attempt < 12; attempt++) {
    const runs = ghJson(
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
      if (!accepted.includes(result.conclusion))
        throw new Error(`Run ${run.databaseId} non riuscita: riconciliare prima della ripresa.`);
      return result;
    }
    await pause(10000);
  }
  throw new Error("Workflow non osservato sul commit atteso: nessun rilancio automatico.");
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
  // Un branch locale rimasto indietro sulla testa unita, per esempio dopo l'aggiornamento della
  // base fatto dal ciclo mentre il checkout era su un altro branch, non ha contenuto proprio.
  const behind = () => {
    try {
      git("merge-base", "--is-ancestor", local, pr.headRefOid);
      return true;
    } catch {
      return false;
    }
  };
  if (
    (local && local !== pr.headRefOid && !behind()) ||
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
    const pr = ghJson(
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

const cycleCommands = [
  "status",
  "rc",
  "pr",
  "cleanup",
  "candidate",
  "production",
  "resume",
  "promote",
  "qualification-base",
  "promotion-source",
];

/** Comando e argomento posizionale; il formato dell'argomento si controlla nel comando. */
export function cycleCommand([command, number]) {
  if (!cycleCommands.includes(command))
    throw new Error(
      "Uso: release:cycle status <run> | rc | pr <numero> | cleanup | candidate --sha <sha> | promote --version <versione> | production --sha <sha> --version <versione> | resume <run> | qualification-base --ref <branch> --base <sha> --head <sha> | promotion-source --ref <branch> --head <sha>.",
    );
  return { command, number };
}

/** Oggetto del blocco locale: cicli su oggetti diversi procedono insieme. */
export const lockObject = (command, number) =>
  command === "pr" ? `pr-${number}` : command === "resume" ? `run-${number}` : command;

function assertRun(number) {
  if (!/^\d+$/u.test(number ?? "")) throw new Error("Run non valida.");
}

/** Il ciclo PR accetta soltanto feature branch dello stesso repository verso develop. */
export function assertCyclePullRequest(pr, repository) {
  if (pr.baseRefName !== "develop" || pr.headRepository?.nameWithOwner !== repository)
    throw new Error("Il ciclo PR gestisce soltanto branch dello stesso repository verso develop.");
  if (["main", "develop", "legacy/1.x"].includes(pr.headRefName))
    throw new Error("La PR non parte da un feature branch.");
  if (pr.state === "CLOSED") throw new Error("PR chiusa senza merge.");
}

/** Vero se l'ultima run è fallita al controllo delle migration; i job si leggono solo allora. */
export function migrationReviewBlocked(run, readJobs) {
  return (
    run?.conclusion === "failure" &&
    readJobs(run.databaseId)
      .flatMap((job) => job.steps ?? [])
      .some((step) => step.name === "Check migration review" && step.conclusion === "failure")
  );
}

/**
 * Qualifica fallita: si riprova, fino al terzo tentativo, soltanto se la base è avanzata su file
 * comuni o globali; `compatible` si valuta solo quando un nuovo tentativo è ammesso.
 */
export const retryQualification = (attempt, compatible) => attempt < 3 && !compatible();

/** Al merge la PR entra con la base compatibile, altrimenti si riqualifica fino al terzo giro. */
export function mergeDecision(round, compatible) {
  if (compatible) return "merge";
  if (round === 3) throw new Error("Base avanzata più volte: ciclo riprendibile dalla stessa PR.");
  return "requalify";
}

/** Run riprendibili: soltanto i workflow del ciclo sui branch di integrazione. */
export function assertResumableRun(run) {
  if (
    ![".github/workflows/ci.yml", ".github/workflows/publish.yml"].includes(run.path) ||
    !["develop", "main"].includes(run.head_branch) ||
    !["push", "workflow_dispatch"].includes(run.event)
  )
    throw new Error("Run fuori dal ciclo supportato.");
}

/** Ambiente distribuito dalla run riuscita, `null` se il job di distribuzione non è riuscito. */
export function deployedEnvironment(run, jobs) {
  const environment = run.path.endsWith("publish.yml") ? "production" : "test";
  const deploy = environment === "test" ? "Deploy test" : "Distribuisci e verifica";
  return jobs.some((job) => job.name === deploy && job.conclusion === "success")
    ? environment
    : null;
}

/**
 * Run già presente sul candidato: in corso o non riuscita si riconcilia con resume; riuscita vale
 * come Production pubblicata o come qualifica da confermare con l'artefatto candidato.
 */
export function existingCandidate(command, existing, jobs) {
  const publish = jobs.find((job) => job.name === "Distribuisci e verifica");
  if (
    existing.status !== "completed" ||
    existing.conclusion !== "success" ||
    !["success", "skipped"].includes(publish?.conclusion)
  )
    throw new Error(
      `Candidato già presente: riconciliare con release:cycle resume ${existing.databaseId}, senza un nuovo dispatch.`,
    );
  return command === "production" && publish.conclusion === "success" ? "published" : "qualified";
}

function statusCycle({ repository, number }) {
  assertRun(number);
  summary(repository, number);
}

/** Identità della RC sul test, in sola lettura: GitHub, Git e risposta del Worker test. */
async function candidateCycle({ repository }) {
  const show = (sha, file) => git("show", `${sha}:${file}`);
  const identity = await identifyCandidate({
    head: () => {
      const head = gh("api", `repos/${repository}/git/ref/heads/develop`, "--jq", ".object.sha");
      localGit(() => {
        git("fetch", "--quiet", "origin", "develop");
        completeHistory();
      });
      return head;
    },
    // Senza changelog non c'è una RC da identificare.
    changelog: (sha) =>
      git("ls-tree", "--name-only", sha, "CHANGELOG.md") ? show(sha, "CHANGELOG.md") : "",
    introduced: (version, head) =>
      git(
        "log",
        "--reverse",
        "--format=%H",
        "--extended-regexp",
        `-G^## \\[?${version.replaceAll(".", "\\.")}\\]?( |$)`,
        head,
        "--",
        "CHANGELOG.md",
      ).split("\n")[0],
    needsDeploy,
    lastDeploy: (head) =>
      lastDeployRun(
        ghJson(
          "api",
          `repos/${repository}/actions/workflows/ci.yml/runs?branch=develop&status=completed&per_page=50`,
        ).workflow_runs,
        (run) => runJobs(repository, run.id),
        (sha) => contains(sha, head),
      ),
    receipt: (run) => {
      const directory = mkdtempSync(path.join(tmpdir(), "release-candidate-"));
      try {
        gh(
          "run",
          "download",
          String(run.id),
          "--repo",
          repository,
          "--name",
          `deployed-${run.id}-${run.run_attempt}`,
          "--dir",
          directory,
        );
        return JSON.parse(readFileSync(path.join(directory, "reports/release.json"), "utf8"));
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    },
    liveVersion: async () =>
      (
        await fetch("https://test.fiscalbay.it/", {
          headers: { "cache-control": "no-cache" },
          signal: AbortSignal.timeout(20000),
        })
      ).headers.get("x-fiscalbay-version"),
    tree: (sha) => git("rev-parse", `${sha}^{tree}`),
    certified: (tree) => candidateAvailable(repository, tree),
    config: (sha) => createHash("sha256").update(show(sha, "cloudflare.config.ts")).digest("hex"),
  });
  console.log(JSON.stringify(identity, null, 2));
}

function cleanupCycle({ repository }) {
  cleanupIntegrated(repository);
}

async function resumeCycle({ repository, number, values }) {
  assertRun(number);
  let run = ghJson("api", `repos/${repository}/actions/runs/${number}`);
  assertResumableRun(run);
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
  const jobs = runJobs(repository, number);
  const environment = deployedEnvironment(run, jobs);
  if (environment) {
    assertConfirmed(jobs, environment);
    if (environment === "production") {
      publishedRelease(repository, run.head_sha, values.version);
      cleanupIntegrated(repository);
    }
  }
  console.log("Run riconciliata; per la pulizia PR riprendere release:cycle pr sul suo numero.");
}

/**
 * Le migration non additive si approvano prima della qualifica: senza la riga il ciclo si ferma
 * subito; con la riga aggiunta dopo l'apertura ripete il `Verify` fallito.
 */
async function rerunMigrationReview(repository, pr) {
  const forkPoint = git("merge-base", "origin/develop", pr.headRefOid);
  if (!reviewAdded(addedMigrations(forkPoint, pr.headRefOid), pr.body)) return;
  const last = ghJson(
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
  if (!migrationReviewBlocked(last, (id) => runJobs(repository, id))) return;
  gh("run", "rerun", String(last.databaseId), "--repo", repository, "--failed");
  for (let attempt = 0; attempt < 30; attempt++) {
    const run = ghJson("api", `repos/${repository}/actions/runs/${last.databaseId}`);
    if (run.status !== "completed") break;
    await pause(2000);
  }
}

/** Qualifica e merge di una PR aperta; restituisce la PR riletta dopo l'esito. */
async function mergeOpenPullRequest(repository, number, pr) {
  // Il merge automatico resta sospeso finché la testa non è qualificata sulla base attuale.
  if (pr.autoMergeRequest)
    gh(...pullRequestAction("disable-auto", repository, number, pr.headRefOid));
  const read = () => readPullRequest(repository, number);
  const develop = () =>
    gh("api", `repos/${repository}/git/ref/heads/develop`, "--jq", ".object.sha");
  const fetchHead = (...refs) => localGit(() => git("fetch", "origin", ...refs, pr.headRefName));
  // Una base avanzata richiede una nuova qualifica soltanto se tocca file della PR o globali.
  const independent = (base) =>
    compatibleBase(git("merge-base", base, pr.headRefOid), base, pr.headRefOid);
  fetchHead("develop");
  await rerunMigrationReview(repository, pr);
  // Una base avanzata su file comuni fa fallire la qualifica: il ciclo aggiorna la PR e segue la
  // nuova qualifica, fino a tre volte, senza rimetterla in bozza.
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
        await waitRun(repository, "ci.yml", pr.headRefOid, pr.headRefName, ["pull_request"], since);
        return;
      } catch (error) {
        const current = develop();
        fetchHead("develop");
        if (!retryQualification(attempt, () => independent(current))) throw error;
        console.log("Base avanzata su file comuni durante la qualifica: aggiornamento.");
        pr = read();
      }
    }
  };
  // Un merge alla volta: le qualifiche delle altre PR proseguono intanto, e la PR entra soltanto
  // se la base attuale resta compatibile con la sua testa, altrimenti si riqualifica.
  for (let round = 1; pr.state === "OPEN"; round++) {
    await qualify();
    const expectedHead = pr.headRefOid;
    const requalify = await withLock(lockDirectory("merge"), "il merge", async () => {
      fetchHead("develop");
      pr = read();
      if (pr.headRefOid !== expectedHead) throw new Error("PR modificata durante la qualifica.");
      if (mergeDecision(round, independent(develop())) === "requalify") {
        console.log("Base avanzata su file comuni in attesa del merge: nuova qualifica.");
        return true;
      }
      enableAutoMerge(repository, number, pr.headRefOid);
      await waitChecks(repository, pr.headRefOid);
      // Il blocco del merge ferma le altre PR: l'esito si rilegge ogni dieci secondi.
      for (let attempt = 0; attempt < 180; attempt++) {
        pr = read();
        if (pr.state !== "OPEN") break;
        if (pr.headRefOid !== expectedHead) throw new Error("PR modificata durante il ciclo.");
        await pause(10_000);
      }
      return false;
    });
    if (!requalify) break;
  }
  return pr;
}

/** Run del commit integrato, deploy test confermato e pulizia del branch della PR unita. */
async function settleMergedPullRequest(repository, number, pr) {
  const files = pullRequestFiles(repository, number);
  const { jobs, deployRequired } = await settleMergeRun(pr.mergeCommit.oid, plan(files).deploy, {
    wait: (sha) =>
      waitRun(repository, "ci.yml", sha, "develop", undefined, undefined, ["success", "failure"]),
    jobs: (run) => runJobs(repository, run.id),
    head: () => gh("api", `repos/${repository}/git/ref/heads/develop`, "--jq", ".object.sha"),
    contains: (ancestor, head) =>
      localGit(() => {
        git("fetch", "origin", "develop");
        try {
          git("merge-base", "--is-ancestor", ancestor, head);
          return true;
        } catch {
          return false;
        }
      }),
  });
  if (checkCycleJobs(jobs, deployRequired))
    console.log("Deploy test, collaudo remoto e readback provider confermati nella run.");
  localGit(() => {
    git("fetch", "origin", "develop", `refs/pull/${number}/head`);
    if (git("branch", "--show-current") === pr.headRefName && !git("status", "--porcelain"))
      git("merge", "--ff-only", pr.headRefOid);
    cleanup(pr);
  });
  console.log("Merge, collaudo CI e pulizia del branch riconciliati.");
}

async function pullRequestCycle({ repository, number }) {
  if (!/^\d+$/u.test(number ?? "")) throw new Error("Numero PR non valido.");
  let pr = readPullRequest(repository, number);
  assertCyclePullRequest(pr, repository);
  if (pr.state === "OPEN") pr = await mergeOpenPullRequest(repository, number, pr);
  if (pr.state !== "MERGED")
    throw new Error("Merge non confermato: ciclo riprendibile dalla stessa PR.");
  await settleMergedPullRequest(repository, number, pr);
}

function confirmProduction(repository, jobs, sha, version) {
  assertConfirmed(jobs, "production");
  publishedRelease(repository, sha, version);
  cleanupIntegrated(repository);
}

/** Qualifica del candidato o pubblicazione Production con `publish.yml`, senza doppi dispatch. */
async function publishCycle({ repository, command, values }) {
  if (!/^[0-9a-f]{40}$/u.test(values.sha ?? "")) throw new Error("SHA completo richiesto.");
  const ref = candidateRef(command, values.ref);
  assertBase(
    values.sha,
    gh("api", `repos/${repository}/git/ref/heads/${ref}`, "--jq", ".object.sha"),
  );
  if (command === "production" && !values.version)
    throw new Error("Versione Production richiesta.");
  const existing = ghJson(
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
    const jobs = runJobs(repository, existing.databaseId);
    if (existingCandidate(command, existing, jobs) === "published") {
      const run = summary(repository, existing.databaseId);
      confirmProduction(repository, jobs, run.head_sha, values.version);
      return;
    }
    const tree = ghJson("api", `repos/${repository}/git/commits/${values.sha}`).tree.sha;
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
  if (command === "production")
    confirmProduction(repository, runJobs(repository, run.id), run.head_sha, values.version);
  console.log(
    command === "candidate"
      ? "Candidato qualificato, senza deploy."
      : "Workflow Production concluso; ricevuta e release disponibili nella run.",
  );
}

const cycles = {
  cleanup: cleanupCycle,
  resume: resumeCycle,
  pr: pullRequestCycle,
  promote: promoteCycle,
  candidate: publishCycle,
  production: publishCycle,
};

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      sha: { type: "string" },
      ref: { type: "string" },
      base: { type: "string" },
      head: { type: "string" },
      version: { type: "string" },
      "reviewed-migrations": { type: "string", default: "" },
    },
  });
  const { command, number } = cycleCommand(positionals);
  // Gira nei job della CI senza token: nessuna lettura del repository remoto con gh.
  if (command === "qualification-base") return qualificationBase(values);
  if (command === "promotion-source") return promotionSource(values);
  const repository = ghJson("api", "repos/{owner}/{repo}").full_name;
  // status legge soltanto: nessun checkout pulito né blocco.
  if (command === "status") return statusCycle({ repository, number });
  if (command === "rc") return candidateCycle({ repository });
  if (git("status", "--porcelain"))
    throw new Error(
      "Il ciclo richiede un checkout pulito; conservare e completare il lavoro locale.",
    );
  localGit(() => completeHistory());
  // Cicli su oggetti diversi procedono insieme; sullo stesso oggetto uno solo.
  const object = lockObject(command, number);
  const directory = lockDirectory(object);
  if (!acquireLock(directory)) throw new Error(`Un altro ciclo locale è già attivo: ${object}.`);
  try {
    await cycles[command]({ repository, command, number, values });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]))
  await main();
