#!/usr/bin/env node
/**
 * Coordinamento esplicito del ciclo: status, metrics e preflight leggono;
 * pr/cleanup/candidate/promote/resume/rollback hanno effetti; qualification-base controlla nella
 * CI la base di una PR. Il ciclo di una PR pulisce soltanto il proprio branch; i residui di cicli
 * precedenti si riconciliano a lotti con cleanup e a ogni promozione.
 */
import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  appendFileSync,
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
import { distributes, mainProcessChange, needsDeploy } from "../classify-changes.mjs";
import {
  addedMigrations,
  assertMergedChangesVersion,
  changeFile,
  declaredReview,
  fullChangelog,
  latestReleased,
  nextVersions,
  openedChangelog,
  requiredReview,
  reviewAdded,
  receiptArtifact,
  romeDay,
  topVersion,
  versionToOpen,
} from "./release.mjs";
import { releaseNotes } from "./release-notes.mjs";
import { verifiedBuildOrigin } from "../find-build.mjs";
import { publishedCommit } from "../find-deployed.mjs";
import { publicVersion, publicationRecord, downloadRecord } from "./records.mjs";
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
  // quella successiva non fa fallire la PR. I coordinatori girano sulla testa di `develop`, anche
  // quelli di altre PR in parallelo: nessuno aspetta sé stesso o un altro ciclo.
  const latest = new Map();
  for (const check of checkRuns.filter(({ name }) => !name.startsWith("Coordinatore")))
    if (!latest.has(check.name) || latest.get(check.name).id < check.id)
      latest.set(check.name, check);
  const current = [...latest.values()];
  const failed = ["failure", "cancelled", "timed_out", "action_required", "startup_failure"];
  if (current.some((check) => failed.includes(check.conclusion))) return "failed";
  return current.every((check) => check.status === "completed") ? "passed" : "pending";
}

/** Risposta di GitHub persa o non servita: l'effetto può essere arrivato o no. */
export const transientGitHub = (error) =>
  /\b50[234]\b|Bad Gateway|Service Unavailable|Gateway Timeout|TLS handshake timeout|connection reset|ECONNRESET/iu.test(
    String(error.stderr ?? error.message ?? ""),
  );

/**
 * GitHub rifiuta il merge automatico di una PR già unibile; `gh pr merge --auto` in quel caso
 * unisce subito, e nel cloud si fa lo stesso con il merge REST vincolato alla testa. Dopo una
 * risposta 5xx la PR si rilegge: con il merge automatico attivo o la PR unita l'effetto è
 * arrivato, altrimenti la richiesta si ripete, al più quattro volte.
 */
export async function enableAutoMerge(
  repository,
  number,
  head,
  { run = gh, read = () => readPullRequest(repository, number), wait = pause } = {},
) {
  for (let attempt = 1; ; attempt++) {
    try {
      try {
        run(...pullRequestAction("enable-auto", repository, number, head));
      } catch (error) {
        if (!/is in (clean|unstable) status/u.test(String(error.stderr ?? ""))) throw error;
        run(
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
      return;
    } catch (error) {
      if (!transientGitHub(error) || attempt === 4) throw error;
      const pr = read();
      if (pr.state === "MERGED" || pr.autoMergeRequest) return;
      console.error(`Merge automatico non confermato da GitHub: tentativo ${attempt}/4.`);
      await wait(attempt * 5000);
    }
  }
}

const readPullRequest = (repository, number) =>
  pullRequestView(ghJson("api", `repos/${repository}/pulls/${number}`));

async function waitChecks(repository, sha, limit = Infinity) {
  for (const deadline = Date.now() + limit; ;) {
    if (Date.now() > deadline)
      throw new Error(
        "Controlli ancora in corso: merge rinviato, ciclo riprendibile dalla stessa PR.",
      );
    const checks = ghJson(
      "api",
      "--paginate",
      "--slurp",
      `repos/${repository}/commits/${sha}/check-runs?per_page=100`,
    ).flatMap((page) => page.check_runs);
    const outcome = checksOutcome(checks);
    if (outcome === "failed") throw new Error("Monitoraggio terminato con controlli falliti.");
    const required = checks
      .filter((check) => check.name === "Node 26")
      .sort((a, b) => b.id - a.id)[0];
    if (outcome === "passed" && required?.conclusion === "success") return;
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
 * uno breve condiviso per i riferimenti locali. Il merge usa il blocco fra runner.
 */
function lockDirectory(name) {
  const root = path.resolve(git("rev-parse", "--git-common-dir"), "release-cycle");
  mkdirSync(root, { recursive: true });
  return path.join(root, name);
}

/** Fetch, worktree e branch locali: un ciclo alla volta, per pochi secondi. */
const localGit = (work) => withLock(lockDirectory("git"), "le operazioni Git locali", work);

/**
 * Un blocco del merge più vecchio di così è rimasto da un ciclo interrotto: il titolare resta
 * sotto il blocco al più quindici minuti per i controlli e trenta per il merge.
 */
export const remoteLockTtl = 60 * 60_000;

/**
 * Blocco fra runner e sessioni per un passo breve, come il merge: i cicli delle PR girano in
 * parallelo e si mettono in fila soltanto qui. `store` crea il blocco una sola volta, lo legge con
 * titolare e ora e lo rimuove se è ancora quello letto. Un blocco scaduto si rimuove; una
 * risposta persa dopo la creazione si riconosce dal titolare.
 */
export async function withRemoteLock(
  store,
  work,
  { owner, ttl = remoteLockTtl, delay = 10_000, now = Date.now } = {},
) {
  for (let notified = false; ;) {
    const held = await store.read();
    if (held?.owner === owner) break;
    if (!held) {
      if (await store.create({ owner, at: new Date(now()).toISOString() })) break;
      // Creato da un altro ciclo nel frattempo: si rilegge dopo una breve pausa.
      await pause(Math.min(delay, 2000));
      continue;
    }
    if (!(now() - Date.parse(held.at) <= ttl)) {
      console.log(`Blocco di ${held.owner} scaduto: rimosso.`);
      await store.remove(held.sha);
      continue;
    }
    if (!notified) console.log(`In attesa che il ciclo ${held.owner} concluda il merge.`);
    notified = true;
    await pause(delay);
  }
  try {
    return await work();
  } finally {
    const held = await store.read();
    if (held?.owner === owner) await store.remove(held.sha);
  }
}

/**
 * Blocco come riferimento `refs/locks/<nome>`: GitHub crea un riferimento una sola volta e
 * risponde 422 a chi arriva dopo. Il commit del riferimento, sul tree di `develop`, porta titolare
 * e ora; `git fetch` non scarica questi riferimenti. La rimozione è un push con lease sullo SHA
 * letto, che il server applica soltanto se il riferimento non è cambiato.
 */
export function remoteLockStore(
  repository,
  name,
  run = gh,
  push = (...args) =>
    execute(
      "git",
      [
        "-c",
        "credential.helper=",
        "-c",
        "credential.helper=!gh auth git-credential",
        "push",
        "--quiet",
        ...args,
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    ),
) {
  // L'indirizzo HTTPS con le credenziali di `gh` vale sul runner e sul Mac, anche quando
  // `origin` usa SSH.
  const remote = `https://github.com/${repository}.git`;
  const read = () => {
    let sha;
    try {
      sha = JSON.parse(run("api", `repos/${repository}/git/ref/locks/${name}`)).object.sha;
    } catch (error) {
      if (/HTTP 404/u.test(String(error.stderr ?? error.message))) return null;
      throw error;
    }
    const { message } = JSON.parse(run("api", `repos/${repository}/git/commits/${sha}`));
    try {
      return { sha, ...JSON.parse(message) };
    } catch {
      return { sha, owner: "sconosciuto", at: "" };
    }
  };
  return {
    read,
    create(entry) {
      const head = JSON.parse(run("api", `repos/${repository}/git/ref/heads/develop`)).object.sha;
      const tree = JSON.parse(run("api", `repos/${repository}/git/commits/${head}`)).tree.sha;
      const sha = JSON.parse(
        run(
          "api",
          "-X",
          "POST",
          `repos/${repository}/git/commits`,
          "-f",
          `message=${JSON.stringify(entry)}`,
          "-f",
          `tree=${tree}`,
        ),
      ).sha;
      try {
        run(
          "api",
          "-X",
          "POST",
          `repos/${repository}/git/refs`,
          "-f",
          `ref=refs/locks/${name}`,
          "-f",
          `sha=${sha}`,
        );
        return true;
      } catch (error) {
        if (/Reference already exists/u.test(String(error.stderr ?? error.message))) return false;
        throw error;
      }
    },
    remove(sha) {
      try {
        push(`--force-with-lease=refs/locks/${name}:${sha}`, remote, `:refs/locks/${name}`);
      } catch (error) {
        // Riferimento già rimosso o sostituito da un altro ciclo: resta il suo.
        if (
          !/stale info|rejected|does not exist|unable to delete/iu.test(
            String(error.stderr ?? error.message),
          )
        )
          throw error;
      }
    },
  };
}

/** Titolare del blocco: la run del coordinatore o il processo locale, con un suffisso casuale. */
const lockOwner = () =>
  `${process.env.GITHUB_RUN_ID ? `run ${process.env.GITHUB_RUN_ID}` : `pid ${process.pid}`} ${randomUUID().slice(0, 8)}`;

export function assertBase(expected, current) {
  if (!/^[0-9a-f]{40}$/u.test(expected ?? "") || current !== expected)
    throw new Error("La base della PR è avanzata: aggiornarla prima della qualifica finale.");
}

/** La promozione resta sullo SHA autorizzato: i merge entrati dopo aspettano il lotto successivo. */
export function assertContained(expected, status) {
  if (!/^[0-9a-f]{40}$/u.test(expected ?? "") || !["ahead", "identical"].includes(status))
    throw new Error("La testa di develop non contiene il commit autorizzato.");
}

const compareStatus = (repository, base, head) =>
  ghJson("api", `repos/${repository}/compare/${base}...${head}`).status;

// File che valgono per tutto il prodotto o per la procedura di qualifica: se cambiano da una
// delle due parti, la PR si riqualifica sulla base attuale.
const globalFile =
  /^(?:package\.json|pnpm-(?:lock|workspace)\.yaml|tsconfig[^/]*\.json|[^/]+\.config\.ts|\.github\/|scripts\/(?:classify-changes\.mjs|release\/|lib\/)|e2e\/(?![^/]+\.spec\.ts$))/u;

// Quasi ogni PR aggiorna piano e changelog: due modifiche di questi file si uniscono nel testo,
// o GitHub segnala il conflitto, e il gate sul tree integrato le rilegge.
const sharedText = /^(?:CHANGELOG\.md|docs\/.+\.md)$/u;

/**
 * Vero se i commit entrati nella base non richiedono di riqualificare la PR: file disgiunti,
 * documenti esclusi, nessun file globale da una delle due parti e migration nuove da una parte
 * sola. Il push su `develop` riesegue comunque il gate sul tree integrato prima del deploy test.
 */
export function independentBase(prFiles, baseFiles) {
  if (!baseFiles.length) return true;
  const own = new Set(prFiles);
  const migrations = (files) => files.some((file) => file.startsWith("migrations/"));
  return !(
    baseFiles.some((file) => own.has(file) && !sharedText.test(file)) ||
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

/** Controllo della CI sulla PR: una base avanzata deve restare compatibile con quella provata. */
export function assertQualificationBase(tested, current, head, run = git) {
  if (!/^[0-9a-f]{40}$/u.test(tested ?? "") || !compatibleBase(tested, current, head, run))
    throw new Error(
      "La base della PR è avanzata su file comuni o globali: aggiornarla e riqualificarla.",
    );
}

function qualificationBase({ base, head }) {
  git("fetch", "--quiet", "origin", "develop");
  assertQualificationBase(base, git("rev-parse", "FETCH_HEAD"), head);
  console.log("Base della qualifica valida verso develop.");
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

/** Se il commit integrato di una PR richiede il deploy test, rispetto al commit precedente. */
export const mergeDeploys = (merge, deploys = needsDeploy) => deploys(`${merge}^`, merge);

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
  production: [
    "Conferma pubblicazione attiva",
    "Confirm expected version after day",
    // La ripresa può ancora leggere una run avviata con il workflow precedente.
    "Confirm expected version after guard and day",
  ],
};

export function assertConfirmed(jobs, environment) {
  const [jobName, ...stepNames] = confirmation[environment];
  const job = jobs.find((item) => item.name === jobName);
  if (!job?.steps?.some((step) => stepNames.includes(step.name) && step.conclusion === "success"))
    throw new Error(`Readback provider non confermato nella run: ${environment}.`);
}

/**
 * Deploy test superato da un merge successivo: il job ha trovato `develop` già avanzato e ha
 * lasciato il deploy al commit nuovo, oppure la run è stata sostituita in coda.
 */
export function deploySuperseded(run, jobs) {
  if (run.conclusion === "cancelled") return true;
  const deploy = jobs.find((job) => job.name === "Deploy test");
  const step = (name) => deploy?.steps?.find((item) => item.name === name)?.conclusion;
  return (
    deploy?.conclusion === "success" &&
    step("Check commit still on develop") === "success" &&
    step("Deploy verified artifact") === "skipped"
  );
}

/**
 * Run che chiude il ciclo del commit integrato. Se il deploy è stato lasciato a un merge
 * successivo, segue la run della nuova testa di `develop`, che deve contenere il commit e avere
 * deploy test e readback confermati; fino a tre merge successivi. Ogni altro esito si ferma.
 */
export async function settleMergeRun(merge, deployRequired, io) {
  const now = io.now ?? Date.now;
  const deadline = now() + 60 * 60_000;
  let run = await io.wait(merge);
  let jobs = await io.jobs(run);
  let required = deployRequired;
  for (let hop = 0; deploySuperseded(run, jobs); hop++) {
    const head = await io.head();
    if (now() >= deadline || head === run.head_sha || !(await io.contains(merge, head)))
      throw new Error(`Run ${run.id} non riuscita: riconciliare prima della ripresa.`);
    console.log("Deploy lasciato a un merge successivo: si segue la run della nuova testa.");
    run = await io.wait(head);
    jobs = await io.jobs(run);
    // La nuova testa distribuisce anche il commit integrato: il deploy confermato è richiesto.
    required = true;
  }
  if (run.conclusion !== "success")
    throw new Error(`Run ${run.id} non riuscita: riconciliare prima della ripresa.`);
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
    // Deploy di sole modifiche interne: la versione resta quella pubblicata su un commit precedente.
    if (
      version &&
      commit !== sha &&
      !found.draft &&
      ghJson("api", `repos/${repository}/compare/${commit}...${sha}`).status === "ahead"
    ) {
      console.log(`Deploy senza nuova release: ${found.html_url} resta su ${commit.slice(0, 12)}.`);
      return;
    }
    const details = { tagName: found.tag_name, isDraft: found.draft, url: found.html_url };
    assertPublishedRelease(details, commit, sha, version ?? release.tagName.slice(1));
    console.log(`Release verificata: ${details.url}.`);
    return;
  }
  throw new Error("Release sul candidato non osservata.");
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
    if (
      verifiedBuildOrigin(
        artifact,
        run,
        jobs,
        repositoryId,
        tree,
        "candidate",
        (sha) => ghJson("api", `repos/${repository}/git/commits/${sha}`).tree.sha,
      )
    )
      return true;
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
export function expectedRun(runs, sha, events, since, cancelled = new Set(), only) {
  return runs
    .filter(
      (item) =>
        (only === undefined || item.databaseId === only) &&
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
  only,
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
    const run = expectedRun(runs, sha, events, since, cancelled, only);
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
      if (result.conclusion === "cancelled" && !accepted.includes("cancelled")) {
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
  if (["main", "develop"].includes(branch) || /(?:^|\/)rollback(?:\/|$)/u.test(branch))
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
  "metrics",
  "preflight",
  "pr",
  "production",
  "cleanup",
  "candidate",
  "candidate-ready",
  "promote",
  "resume",
  "rollback",
  "qualification-base",
];

/** Comando e argomento posizionale; il formato dell'argomento si controlla nel comando. */
export function cycleCommand([command, number]) {
  if (!cycleCommands.includes(command))
    throw new Error(
      "Uso: release:cycle status <run> | metrics | preflight --sha <sha> [--version <versione>] | pr <numero> | production <numero> | cleanup | candidate | promote [--version <versione>] [--urgente] [--testa] | resume <run> | rollback | qualification-base --base <sha> --head <sha>.",
    );
  return { command, number };
}

/** Oggetto del blocco locale: cicli su oggetti diversi procedono insieme. */
export const lockObject = (command, number) =>
  ["pr", "production"].includes(command)
    ? `pr-${number}`
    : command === "resume"
      ? `run-${number}`
      : command;

function assertRun(number) {
  if (!/^\d+$/u.test(number ?? "")) throw new Error("Run non valida.");
}

/** Il ciclo PR accetta soltanto feature branch dello stesso repository verso develop. */
export function assertCyclePullRequest(pr, repository) {
  if (pr.baseRefName !== "develop" || pr.headRepository?.nameWithOwner !== repository)
    throw new Error("Il ciclo PR gestisce soltanto branch dello stesso repository verso develop.");
  if (["main", "develop"].includes(pr.headRefName))
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
    ![
      ".github/workflows/ci.yml",
      ".github/workflows/candidate.yml",
      ".github/workflows/publish.yml",
    ].includes(run.path) ||
    !["develop", "main"].includes(run.head_branch) ||
    !["push", "workflow_dispatch"].includes(run.event)
  )
    throw new Error("Run fuori dal ciclo supportato.");
}

/** Ambiente distribuito dalla run riuscita, `null` se il job di distribuzione non è riuscito. */
export function deployedEnvironment(run, jobs) {
  if (run.path.endsWith("candidate.yml")) return null;
  const environment = run.path.endsWith("publish.yml") ? "production" : "test";
  const deploy = environment === "test" ? "Deploy test" : "Distribuisci e verifica";
  if (deploySuperseded(run, jobs)) return null;
  return jobs.some((job) => job.name === deploy && job.conclusion === "success")
    ? environment
    : null;
}

/** Pubblicazione già presente sul commit: si riconcilia con resume, senza un nuovo dispatch. */
export function existingPublication(existing, jobs) {
  const publish = jobs.find((job) => job.name === "Distribuisci e verifica");
  if (
    existing.status !== "completed" ||
    existing.conclusion !== "success" ||
    publish?.conclusion !== "success"
  )
    throw new Error(
      `Pubblicazione già presente: riconciliare con release:cycle resume ${existing.databaseId}, senza un nuovo dispatch.`,
    );
}

/**
 * Migration non additive del lotto: ogni PR che le aggiunge deve averle approvate con il proprio
 * digest, che il corpo della PR dichiara e che si ricalcola dal commit integrato. Il digest del
 * lotto si ricava da lì, senza una seconda approvazione al momento di `Promuovi`.
 */
export function lotReview(added, commits, reviewed = "") {
  const required = requiredReview(added);
  if (!required) return "";
  if (reviewed === required.digest) return reviewed;
  const approved = commits.flatMap((commit) => {
    const own = requiredReview(commit.added);
    return own && declaredReview(commit.body) === own.digest ? own.names : [];
  });
  const missing = required.names.filter((name) => !approved.includes(name));
  if (missing.length)
    throw new Error(
      `Migration da approvare: ${missing.join(", ")}. ` +
        `Dopo l'esame ripetere con --reviewed-migrations ${required.digest}`,
    );
  return required.digest;
}

/** Versione del lotto: quella in cima al changelog, nuova di un passo o già pubblicata. */
export function assertPromotable(changelog, version, tags) {
  const top = topVersion(changelog);
  if (top !== version)
    throw new Error(`In cima al changelog c'è la ${top ?? "nessuna versione"}, non la ${version}.`);
  releaseNotes(changelog, version);
  const released = latestReleased(tags);
  if (version !== released && !nextVersions(released).includes(version))
    throw new Error(`La ${version} non è un passo dalla ${released ?? "prima pubblicazione"}.`);
}

/** Durata e riuscita al primo tentativo delle ultime pubblicazioni, dalla più recente. */
export function promotionMetrics(runs, receipts = [], jobs = new Map()) {
  const duration = (from, to) =>
    Number.isFinite(Date.parse(from)) && Number.isFinite(Date.parse(to))
      ? Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 1000))
      : null;
  const attempts = new Map();
  for (const run of runs)
    attempts.set(run.head_sha, (attempts.get(run.head_sha) ?? 0) + (run.run_attempt ?? 1));
  const rows = runs.map((run) => ({
    commit: run.head_sha.slice(0, 12),
    day: run.created_at.slice(0, 10),
    minutes: Math.round((Date.parse(run.updated_at) - Date.parse(run.created_at)) / 60_000),
    attempts: run.run_attempt,
    conclusion: run.conclusion,
    candidateAttempts: attempts.get(run.head_sha),
    ...(() => {
      const receipt = receipts.find((entry) => entry.run === run.id);
      if (!receipt) return { evidence: "assente" };
      const confirmed = receipt.active
        ? receipt.candidateActive === true && Boolean(receipt.completedAt) && !receipt.rolledBack
        : receipt.readback === true && Boolean(receipt.version) && !receipt.rolledBack;
      return {
        evidence: "ricevuta",
        confirmed,
        active: receipt.active?.version ?? receipt.version,
        withdrawn: receipt.rolledBack === true,
        falseGreen: run.conclusion === "success" && !confirmed,
        candidateSeconds: duration(receipt.requestedAt, receipt.certifiedAt),
        activationSeconds: duration(receipt.requestedAt, receipt.activatedAt),
        preparationSeconds: duration(receipt.certifiedAt, receipt.activatedAt),
        completionSeconds: duration(receipt.activatedAt, receipt.completedAt),
        totalSeconds: duration(receipt.requestedAt, receipt.completedAt),
        rollbackSeconds: duration(receipt.startedAt, receipt.rolledBackAt),
        runnerWaitingSeconds: jobs.has(run.id)
          ? runTimings(run, jobs.get(run.id)).waitingSeconds
          : null,
      };
    })(),
  }));
  const successful = rows.filter(({ conclusion }) => conclusion === "success");
  const done = successful.filter((row) => row.confirmed);
  const sorted = successful.map(({ minutes }) => minutes).sort((a, b) => a - b);
  return {
    rows,
    runs: rows.length,
    successfulRuns: successful.length,
    published: done.length,
    firstAttempt: done.filter(
      ({ attempts, candidateAttempts }) => attempts === 1 && candidateAttempts === 1,
    ).length,
    falseGreen: rows.filter((row) => row.falseGreen).length,
    withdrawn: rows.filter((row) => row.withdrawn).length,
    medianRunMinutes: sorted[Math.floor(sorted.length / 2)] ?? null,
  };
}

/**
 * Fasi di una qualifica del candidato: attesa in coda dopo la pianificazione, durata delle prove
 * browser e della mutation, dal primo inizio all'ultima fine, e minuti di runner sommati su tutti
 * i job. `null` per una fase che non è girata.
 */
export function candidatePhases(jobs) {
  const ran = jobs.filter(
    (job) => job.conclusion !== "skipped" && job.started_at && job.completed_at,
  );
  const span = (selected) =>
    selected.length
      ? Math.round(
          (Math.max(...selected.map((job) => Date.parse(job.completed_at))) -
            Math.min(...selected.map((job) => Date.parse(job.started_at)))) /
            1000,
        )
      : null;
  const plan = ran.find((job) => job.name === "Pianifica");
  const qualify = ran.filter((job) => job.name.startsWith("Qualifica candidato /"));
  const start = Math.min(...qualify.map((job) => Date.parse(job.started_at)));
  return {
    queueSeconds:
      plan && qualify.length
        ? Math.max(0, Math.round((start - Date.parse(plan.completed_at)) / 1000))
        : null,
    browserSeconds: span(qualify.filter((job) => / \/ browser /u.test(job.name))),
    mutationSeconds: span(
      qualify.filter(
        (job) => / \/ Mutation \/ /u.test(job.name) && !job.name.endsWith("Select modules"),
      ),
    ),
    runnerMinutes: Math.round(
      ran.reduce(
        (total, job) => total + (Date.parse(job.completed_at) - Date.parse(job.started_at)),
        0,
      ) / 60_000,
    ),
  };
}

function statusCycle({ repository, number }) {
  assertRun(number);
  summary(repository, number);
}

function cleanupCycle({ repository }) {
  cleanupIntegrated(repository);
}

/** Prefisso delle ricevute di deploy di una run riprendibile; `null` se la run non distribuisce. */
export function receiptPrefix(run) {
  if (run.path.endsWith("/ci.yml")) return "deployed";
  if (run.path.endsWith("/publish.yml")) return "release-receipt";
  return null;
}

/**
 * Ambiente del gruppo di una ripresa: la ripresa di un deploy test o di una qualifica non aspetta
 * una promozione Production, quella di `publish.yml` sì.
 */
export const resumeEnvironment = (run) =>
  run.path.endsWith("/publish.yml") ? "production" : "test";

/**
 * Una ricevuta ritirata non torna verde ripetendo i job: la ripresa si ferma prima di avviarli,
 * con lo stesso errore che il deploy darebbe dopo l'attesa dei runner.
 */
export function assertNotWithdrawn(receipt) {
  if (receipt?.rolledBack)
    throw new Error("Candidato ritirato: serve una nuova correzione, non una ripresa del deploy.");
}

/** Ultima ricevuta di deploy della run, fra tutti i tentativi; `null` se non ce n'è. */
function lastReceipt(repository, run) {
  const prefix = receiptPrefix(run);
  if (!prefix) return null;
  const artifacts = ghJson(
    "api",
    "--paginate",
    "--slurp",
    `repos/${repository}/actions/runs/${run.id}/artifacts?per_page=100`,
  ).flatMap((page) => page.artifacts);
  const artifact = receiptArtifact(artifacts, prefix, run.id, (run.run_attempt ?? 1) + 1);
  return artifact
    ? downloadRecord(repository, { ...artifact, workflow_run: { id: run.id } })
    : null;
}

async function resumeCycle({ repository, number, values }) {
  assertRun(number);
  let run = ghJson("api", `repos/${repository}/actions/runs/${number}`);
  if (values.sha) assertBase(values.sha, run.head_sha);
  assertResumableRun(run);
  assertBase(run.head_sha, headOf(repository, run.head_branch));
  if (run.status === "completed" && run.conclusion !== "success") {
    assertNotWithdrawn(lastReceipt(repository, run));
    gh("run", "rerun", number, "--repo", repository, "--failed");
  }
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
      await confirmProduction(repository, jobs, run.head_sha, values.version);
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

/** ID delle decisioni nelle righe di tabella aggiunte da un diff `-U0`. */
/**
 * ID delle decisioni nuove: righe di tabella aggiunte da un diff `-U0` con un ID assente dalla
 * base. Una riga esistente modificata, per esempio con «Superato da», compare come aggiunta ma
 * non è una decisione nuova.
 */
export const addedDecisions = (diff, existing = []) =>
  [...diff.matchAll(/^\+\|\s*(D\d+)\s*\|/gmu)]
    .map((match) => match[1])
    .filter((id) => !existing.includes(id));

/** Numeri delle righe aggiunte da un diff `-U0` di un solo file. */
export function addedLineNumbers(diff) {
  const numbers = new Set();
  let line = 0;
  for (const text of diff.split("\n")) {
    const hunk = /^@@ -\S+ \+(\d+)(?:,\d+)? @@/u.exec(text);
    if (hunk) line = Number(hunk[1]);
    else if (text.startsWith("+") && !text.startsWith("+++ ")) numbers.add(line++);
  }
  return numbers;
}

/**
 * Numeri delle decisioni nuove della PR che un'altra PR ha già portato sulla base: si spostano
 * dopo l'ultima decisione, così due PR aperte insieme non pubblicano lo stesso numero.
 */
export function decisionRenumbering(added, taken) {
  const used = new Set(taken);
  let last = Math.max(0, ...[...taken, ...added].map((id) => Number(id.slice(1))));
  const mapping = {};
  for (const id of added)
    if (used.has(id) && !mapping[id]) mapping[id] = `D${String(++last).padStart(3, "0")}`;
  return mapping;
}

/** Riferimenti alle decisioni rinumerate; con `lines`, soltanto in quelle righe (da 1). */
export const renumberDecisions = (text, mapping, lines) =>
  text
    .split("\n")
    .map((line, index) =>
      !lines || lines.has(index + 1)
        ? line.replace(/\bD\d{3,}\b/gu, (id) => mapping[id] ?? id)
        : line,
    )
    .join("\n");

/**
 * Rinumera sul branch della PR le decisioni prese nel frattempo da un'altra PR, in un worktree
 * temporaneo, e restituisce la nuova testa. I file della PR non possono riferirsi a quei numeri
 * per altro: sulla sua base non esistevano.
 */
function renumberPullRequest(pr, mapping) {
  return localGit(() => {
    const directory = mkdtempSync(path.join(tmpdir(), "decisions-"));
    try {
      git("worktree", "add", "--quiet", "--detach", directory, pr.headRefOid);
      const inside = (...args) => execute("git", args, { cwd: directory });
      const base = inside("merge-base", "origin/develop", "HEAD");
      // Soltanto le righe Markdown aggiunte dalla PR: dopo un aggiornamento della base gli
      // stessi file possono già citare la decisione dell'altra PR con quel numero.
      for (const file of inside(
        "diff",
        "--name-only",
        "--diff-filter=AM",
        base,
        "HEAD",
        "--",
        "*.md",
      )
        .split("\n")
        .filter(Boolean)) {
        const target = path.join(directory, file);
        const text = readFileSync(target, "utf8");
        const lines = addedLineNumbers(inside("diff", "-U0", base, "HEAD", "--", file));
        const next = renumberDecisions(text, mapping, lines);
        if (next !== text) writeFileSync(target, next);
      }
      const names = Object.entries(mapping)
        .map(([from, to]) => `${from} in ${to}`)
        .join(", ");
      inside(
        "-c",
        "user.name=github-actions",
        "-c",
        "user.email=github-actions@users.noreply.github.com",
        "commit",
        "--quiet",
        "-am",
        `docs: rinumera le decisioni ${names}`,
      );
      inside(
        "push",
        "--quiet",
        `--force-with-lease=refs/heads/${pr.headRefName}:${pr.headRefOid}`,
        "origin",
        `HEAD:refs/heads/${pr.headRefName}`,
      );
      return inside("rev-parse", "HEAD");
    } finally {
      git("worktree", "remove", "--force", directory);
      rmSync(directory, { recursive: true, force: true });
    }
  });
}

/** Rinumerazione delle decisioni della PR rispetto alla base attuale; vuota se non serve. */
/**
 * Le voci dei frammenti della PR vanno in una versione non ancora pubblicata della base attuale,
 * o in quella che la PR stessa apre sopra: se nel frattempo la versione in cima ha ricevuto tag o
 * giorno, la PR apre la successiva prima del merge. La qualifica l'ha controllato sulla base di allora, e il changelog è fuori dalla
 * compatibilità delle basi.
 */
function assertPullRequestChanges(pr) {
  assertMergedChangesVersion(...pullRequestChanges(pr));
}

/** Changelog di `develop` e della PR, frammenti della PR e tag pubblicati. */
function pullRequestChanges(pr) {
  localGit(() => git("fetch", "--quiet", "--tags", "origin"));
  const base = git("merge-base", "origin/develop", pr.headRefOid);
  const fragments = git(
    "diff",
    "--name-only",
    "--diff-filter=AM",
    base,
    pr.headRefOid,
    "--",
    "changes/",
  )
    .split("\n")
    .filter((file) => changeFile.test(file))
    .map((file) => git("show", `${pr.headRefOid}:${file}`));
  return [
    git("show", "origin/develop:CHANGELOG.md"),
    git("show", `${pr.headRefOid}:CHANGELOG.md`),
    fragments,
    git("tag", "--list", "v2.*").split("\n"),
  ];
}

/**
 * Unisce `develop` al branch della PR e apre `version` in cima al changelog, in un worktree
 * temporaneo e in un solo push: la qualifica parte già sulla versione giusta invece di fallire
 * sul merge di GitHub con la versione in cima appena pubblicata. Restituisce la nuova testa, o
 * null se il merge ha conflitti: allora resta l'aggiornamento di GitHub.
 */
function openVersionOnPullRequest(pr, version) {
  return localGit(() => {
    const directory = mkdtempSync(path.join(tmpdir(), "version-"));
    try {
      git("worktree", "add", "--quiet", "--detach", directory, pr.headRefOid);
      const inside = (...args) =>
        execute(
          "git",
          [
            "-c",
            "user.name=github-actions",
            "-c",
            "user.email=github-actions@users.noreply.github.com",
            ...args,
          ],
          { cwd: directory },
        );
      try {
        inside("merge", "--quiet", "--no-edit", "origin/develop");
      } catch {
        // Conflitti: il worktree temporaneo si elimina comunque.
        return null;
      }
      const file = path.join(directory, "CHANGELOG.md");
      writeFileSync(file, openedChangelog(readFileSync(file, "utf8"), version));
      inside("commit", "--quiet", "-am", `chore: apre la ${version} per le voci della PR`);
      inside(
        "push",
        "--quiet",
        `--force-with-lease=refs/heads/${pr.headRefName}:${pr.headRefOid}`,
        "origin",
        `HEAD:refs/heads/${pr.headRefName}`,
      );
      return inside("rev-parse", "HEAD");
    } finally {
      git("worktree", "remove", "--force", directory);
      rmSync(directory, { recursive: true, force: true });
    }
  });
}

/** Testa della PR con la versione aperta, se le sue voci la richiedono sulla base attuale. */
function openPendingVersion(pr) {
  const version = versionToOpen(...pullRequestChanges(pr));
  if (!version) return null;
  const head = openVersionOnPullRequest(pr, version);
  if (head) console.log(`Versione ${version} aperta sul branch della PR: qualifica di ${head}.`);
  return head;
}

/** ID delle decisioni nelle tabelle Markdown di un commit. */
function decisionIds(ref) {
  try {
    return [
      ...git("grep", "-h", "-o", "-E", "^[|] *D[0-9]+ *[|]", ref, "--", "*.md").matchAll(/D\d+/gu),
    ].map((match) => match[0]);
  } catch {
    // Nessuna riga trovata: nessun numero.
    return [];
  }
}

function decisionCollisions(pr) {
  const base = git("merge-base", "origin/develop", pr.headRefOid);
  const added = addedDecisions(
    git("diff", "-U0", base, pr.headRefOid, "--", "*.md"),
    decisionIds(base),
  );
  if (!added.length) return {};
  return decisionRenumbering(added, decisionIds("origin/develop"));
}

/** Qualifica e merge di una PR aperta; restituisce la PR riletta dopo l'esito. */
async function mergeOpenPullRequest(repository, number, pr) {
  // Il merge automatico resta sospeso finché la testa non è qualificata sulla base attuale.
  if (pr.autoMergeRequest)
    gh(...pullRequestAction("disable-auto", repository, number, pr.headRefOid));
  const read = () => readPullRequest(repository, number);
  const develop = () => headOf(repository, "develop");
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
      const opened = !independent(base) && openPendingVersion(pr);
      if (opened) {
        since = Date.now() - 1000;
        pr = await waitUpdatedHead(read, pr.headRefOid, (head) => head === opened);
      } else if (!independent(base)) {
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
  // Un merge alla volta fra tutti i cicli, anche su runner diversi: le qualifiche delle altre PR
  // proseguono intanto, e la PR entra soltanto se la base attuale resta compatibile con la sua
  // testa, altrimenti si riqualifica.
  const store = remoteLockStore(repository, "merge");
  const owner = lockOwner();
  for (let round = 1; pr.state === "OPEN"; round++) {
    await qualify();
    const expectedHead = pr.headRefOid;
    const requalify = await withRemoteLock(
      store,
      async () => {
        fetchHead("develop");
        pr = read();
        if (pr.headRefOid !== expectedHead) throw new Error("PR modificata durante la qualifica.");
        if (mergeDecision(round, independent(develop())) === "requalify") {
          console.log("Base avanzata su file comuni in attesa del merge: nuova qualifica.");
          return true;
        }
        // Un'altra PR ha già portato sulla base i numeri delle decisioni nuove: si rinumerano.
        const opened = openPendingVersion(pr);
        if (opened) {
          pr = await waitUpdatedHead(read, expectedHead, (sha) => sha === opened);
          return true;
        }
        assertPullRequestChanges(pr);
        const mapping = decisionCollisions(pr);
        if (Object.keys(mapping).length) {
          const head = renumberPullRequest(pr, mapping);
          console.log(`Decisioni rinumerate sul branch della PR: nuova qualifica di ${head}.`);
          pr = await waitUpdatedHead(read, expectedHead, (sha) => sha === head);
          return true;
        }
        // Tutti i controlli prima del merge: `Node 26` è il solo richiesto da GitHub.
        await waitChecks(repository, pr.headRefOid, 15 * 60_000);
        await enableAutoMerge(repository, number, pr.headRefOid);
        // Il blocco del merge ferma le altre PR: l'esito si rilegge ogni dieci secondi.
        for (let attempt = 0; attempt < 180; attempt++) {
          pr = read();
          if (pr.state !== "OPEN") break;
          if (pr.headRefOid !== expectedHead) throw new Error("PR modificata durante il ciclo.");
          await pause(10_000);
        }
        return false;
      },
      { owner },
    );
    if (!requalify) break;
  }
  return pr;
}

/** Run del commit integrato, deploy test confermato e pulizia del branch della PR unita. */
async function settleMergedPullRequest(repository, number, pr) {
  const merge = pr.mergeCommit.oid;
  // Lo stesso piano della CI sul commit integrato, con il contenuto dei file: un frammento di
  // sole decisioni non distribuisce nulla e il push di `develop` non avvia il deploy test.
  const required = await localGit(() => {
    git("fetch", "origin", "develop");
    return mergeDeploys(merge);
  });
  const { jobs, deployRequired } = await settleMergeRun(merge, required, {
    wait: (sha) =>
      waitRun(repository, "ci.yml", sha, "develop", undefined, undefined, [
        "success",
        "failure",
        "cancelled",
      ]),
    jobs: (run) => runJobs(repository, run.id),
    head: () => headOf(repository, "develop"),
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

async function pullRequestCycle({ repository, number, values }) {
  if (!/^\d+$/u.test(number ?? "")) throw new Error("Numero PR non valido.");
  let pr = readPullRequest(repository, number);
  assertCyclePullRequest(pr, repository);
  if (values?.sha) assertBase(values.sha, pr.headRefOid);
  if (pr.state === "OPEN") pr = await mergeOpenPullRequest(repository, number, pr);
  if (pr.state !== "MERGED")
    throw new Error("Merge non confermato: ciclo riprendibile dalla stessa PR.");
  await settleMergedPullRequest(repository, number, pr);
}

const headOf = (repository, branch) =>
  gh("api", `repos/${repository}/git/ref/heads/${branch}`, "--jq", ".object.sha");

/** Commit che aggiungono migration fra base e testa, con il corpo della loro PR. */
function migrationCommits(repository, base, head) {
  return git("log", "--first-parent", "--format=%H", `${base}..${head}`, "--", "migrations")
    .split("\n")
    .filter(Boolean)
    .map((sha) => ({
      added: addedMigrations(`${sha}^`, sha),
      body: gh("api", `repos/${repository}/commits/${sha}/pulls`, "--jq", '.[0].body // ""'),
    }));
}

/**
 * Controlli che non richiedono provider né browser, prima di ogni attesa: versione, cambiamenti
 * da distribuire e approvazione delle migration. `Promuovi` li ripete nel job iniziale.
 */
async function lotPreflight({ repository, sha, version, reviewed = "" }) {
  localGit(() => {
    git("fetch", "--quiet", "--tags", "origin", "develop");
    completeHistory();
  });
  const base = await publishedCommit(repository, (url) => ghJson("api", url));
  if (!base) throw new Error("Commit attivo in Production non identificato.");
  const files = git("diff", "--name-only", base, sha).split("\n").filter(Boolean);
  const lot = {
    base,
    deploy: distributes(base, sha),
    // Senza deploy si attende la qualifica soltanto se cambia la procedura che gira da `main`.
    qualify: mainProcessChange(files),
    reviewed: "",
  };
  if (!lot.deploy) return { ...lot, version };
  const changelog = fullChangelog(sha);
  const target = version ?? topVersion(changelog);
  assertPromotable(changelog, target, git("tag", "--list", "v2.*").split("\n"));
  const added = addedMigrations(base, sha);
  return {
    ...lot,
    version: target,
    reviewed: lotReview(added, migrationCommits(repository, base, sha), reviewed),
  };
}

async function preflightCycle({ repository, values }) {
  if (!/^[0-9a-f]{40}$/u.test(values.sha ?? "")) throw new Error("SHA completo richiesto.");
  const lot = await lotPreflight({
    repository,
    sha: values.sha,
    version: values.version,
    reviewed: values["reviewed-migrations"],
  });
  console.log(JSON.stringify(lot));
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `base=${lot.base}\ndeploy=${lot.deploy}\nreviewed=${lot.reviewed}\nversion=${lot.version ?? ""}\n`,
    );
}

/**
 * Run del candidato richiesto: il titolo porta il commit qualificato, mentre `headSha` è la testa
 * di `develop` all'avvio e può essere già avanzata da un merge.
 */
export function candidateRun(runs, sha, since) {
  return runs
    .filter(
      (run) =>
        run.displayTitle === `Candidato ${sha}` &&
        run.event === "workflow_dispatch" &&
        Date.parse(run.createdAt) >= since,
    )
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
}

/** Qualifica completa di un commit di `develop`, senza effetti su `main` né sui provider. */
async function ensureCandidate(repository, sha) {
  const tree = ghJson("api", `repos/${repository}/git/commits/${sha}`).tree.sha;
  if (candidateAvailable(repository, tree)) return console.log("Candidato già qualificato.");
  const runs = () =>
    ghJson(
      "run",
      "list",
      "--repo",
      repository,
      "--workflow",
      "candidate.yml",
      "--branch",
      "develop",
      "--limit",
      "100",
      "--json",
      "databaseId,displayTitle,headSha,status,event,createdAt",
    );
  let active = runs().find(
    (run) =>
      run.displayTitle === `Candidato ${sha}` &&
      run.status !== "completed" &&
      runJobs(repository, run.databaseId).some(
        (job) => job.name.startsWith("Qualifica candidato /") && job.conclusion !== "skipped",
      ),
  );
  if (!active) {
    const since = Date.now() - 1000;
    gh(
      "workflow",
      "run",
      "candidate.yml",
      "--repo",
      repository,
      "--ref",
      "develop",
      "-f",
      `expected_sha=${sha}`,
    );
    for (let attempt = 0; attempt < 24 && !active; attempt++) {
      await pause(5000);
      active = candidateRun(runs(), sha, since);
    }
    if (!active) throw new Error("Run del candidato non trovata.");
  }
  await waitRun(
    repository,
    "candidate.yml",
    active.headSha,
    "develop",
    [active.event],
    0,
    undefined,
    // Una run pianificata successiva sullo stesso commit non qualifica: si segue quella attiva.
    active.databaseId,
  );
  if (!candidateAvailable(repository, tree)) throw new Error("Candidato non certificato.");
}

function candidateCycle({ repository }) {
  return ensureCandidate(repository, headOf(repository, "develop"));
}

export function candidateReadiness({ passed, certified, manual, weekly, qualifying = false }) {
  return Boolean(manual || (passed && !qualifying && (weekly || !certified)));
}

function candidateReady({ repository, values }) {
  const sha = git("rev-parse", "HEAD");
  if (values.sha !== sha) throw new Error("SHA del candidato diverso dal checkout.");
  const current = headOf(repository, "develop");
  const tree = git("rev-parse", "HEAD^{tree}");
  const checks = ghJson(
    "api",
    "--paginate",
    "--slurp",
    `repos/${repository}/commits/${sha}/check-runs?per_page=100`,
  ).flatMap((page) => page.check_runs);
  const passed =
    checks.filter((check) => check.name === "Node 26").sort((a, b) => b.id - a.id)[0]
      ?.conclusion === "success";
  const running = values.manual
    ? false
    : ghJson(
        "api",
        `repos/${repository}/actions/workflows/candidate.yml/runs?branch=develop&per_page=100`,
      ).workflow_runs.some(
        (run) =>
          run.head_sha === sha &&
          run.status === "in_progress" &&
          Number(run.id) < Number(process.env.GITHUB_RUN_ID),
      );
  // La qualifica richiesta da `Promuovi` riguarda il commit autorizzato, anche se poi entrano PR.
  const pinned =
    values.manual &&
    current !== sha &&
    ["ahead", "identical"].includes(compareStatus(repository, sha, current));
  const ready =
    (current === sha || pinned) &&
    candidateReadiness({
      passed,
      certified: values.manual || values.weekly ? false : candidateAvailable(repository, tree),
      manual: values.manual,
      weekly: values.weekly,
      qualifying: running,
    });
  if (!ready && values.manual)
    throw new Error("La testa di develop non contiene il candidato richiesto.");
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(process.env.GITHUB_OUTPUT, `ready=${ready}\nsha=${sha}\n`);
  console.log(
    ready
      ? "Candidato pronto per la qualifica."
      : "Nessuna qualifica necessaria o CI ancora da completare.",
  );
}

/** `main` è la testa di `develop` promossa: avanza soltanto in fast-forward. */
function advanceMain(repository, sha) {
  gh(
    "api",
    "-X",
    "PATCH",
    `repos/${repository}/git/refs/heads/main`,
    "-f",
    `sha=${sha}`,
    "-F",
    "force=false",
    "--silent",
  );
  console.log(`main avanzato a ${sha}.`);
}

async function confirmProduction(repository, jobs, sha, version) {
  assertConfirmed(jobs, "production");
  const active = await publicVersion("https://fiscalbay.it");
  const receipt = publicationRecord(repository, active);
  if (receipt.active.sha !== sha || receipt.rolledBack || !receipt.completedAt)
    throw new Error("Pubblicazione finale non riconciliata con il provider.");
  publishedRelease(repository, sha, version);
  cleanupIntegrated(repository);
}

/**
 * Promuovi: il commit di `develop` già certificato, il più recente, o quello indicato, diventa
 * `main` e si distribuisce. Senza modifiche da distribuire basta avanzare `main`. `--urgente` non attende la
 * produzione di nuove prove: riusa soltanto una certificazione già valida sul tree.
 */
async function promoteCycle({ repository, values }) {
  const requestedAt = values["requested-at"] || new Date().toISOString();
  const head = headOf(repository, "develop");
  // Pubblica in Production: il commit integrato della PR appena pubblicata, con il lotto che la
  // precede su `develop`.
  const merged = values.pr ? mergedCommit(readPullRequest(repository, values.pr)) : undefined;
  const sha = merged ? chooseTarget(repository, values, merged) : (values.sha ?? head);
  if (merged || values.sha) assertContained(sha, compareStatus(repository, sha, head));
  const lot = await lotPreflight({
    repository,
    sha,
    version: values.version,
    reviewed: values["reviewed-migrations"],
  });
  await waitChecks(repository, sha);
  if (!lot.deploy) {
    if (lot.qualify) await ensureCandidate(repository, sha);
    advanceMain(repository, sha);
    cleanupIntegrated(repository);
    return console.log("Nessuna modifica da distribuire: main allineato, nessun deploy.");
  }
  const existing = ghJson(
    "run",
    "list",
    "--repo",
    repository,
    "--workflow",
    "publish.yml",
    "--branch",
    "main",
    "--limit",
    "50",
    "--json",
    "databaseId,headSha,status,conclusion",
  ).find((run) => run.headSha === sha);
  if (existing) {
    const jobs = runJobs(repository, existing.databaseId);
    existingPublication(existing, jobs);
    summary(repository, existing.databaseId);
    return await confirmProduction(repository, jobs, sha, lot.version);
  }
  if (values.urgente) {
    const tree = ghJson("api", `repos/${repository}/git/commits/${sha}`).tree.sha;
    if (!candidateAvailable(repository, tree))
      throw new Error(
        "Urgenza senza prove valide sul candidato: eseguire release:cycle candidate.",
      );
  } else await ensureCandidate(repository, sha);
  advanceMain(repository, sha);
  const since = Date.now() - 1000;
  gh(
    "workflow",
    "run",
    "publish.yml",
    "--repo",
    repository,
    "--ref",
    "main",
    "-f",
    `expected_sha=${sha}`,
    "-f",
    `version=${lot.version}`,
    "-f",
    `day=${romeDay()}`,
    "-f",
    `reviewed_migrations=${lot.reviewed}`,
    "-f",
    `urgente=${Boolean(values.urgente)}`,
    "-f",
    `requested_at=${requestedAt}`,
    "-f",
    `certified_at=${new Date().toISOString()}`,
  );
  const run = await waitRun(repository, "publish.yml", sha, "main", ["workflow_dispatch"], since);
  await confirmProduction(repository, runJobs(repository, run.id), run.head_sha, lot.version);
  console.log("Pubblicazione conclusa; ricevuta e release disponibili nella run.");
}

/** Commit integrato di una PR unita in `develop`. */
export function mergedCommit(pr) {
  if (pr.state !== "MERGED" || pr.baseRefName !== "develop" || !pr.mergeCommit?.oid)
    throw new Error("PR non integrata in develop: nessun commit da promuovere.");
  return pr.mergeCommit.oid;
}

/**
 * Commit da promuovere: il più recente di `develop` dopo `main` con il tree già certificato, così
 * `Promuovi` non aspetta la qualifica dei merge appena entrati, che passano al lotto successivo.
 * Con una versione indicata vale il più recente che la porta in cima al changelog. `commits` va
 * dalla testa all'indietro; senza un commit certificato vale la testa, e il ciclo ne attende la
 * qualifica.
 */
export function promotionTarget(commits, certified, version, topOf = () => version) {
  const index = commits.findIndex(
    (commit) => certified(commit.tree) && (!version || topOf(commit.sha) === version),
  );
  return index < 0
    ? { sha: commits[0]?.sha, later: 0, certified: false }
    : { sha: commits[index].sha, later: index, certified: true };
}

/**
 * Destinazione di `Promuovi` sulla storia di `develop` dopo `main`, al più cinquanta commit; con
 * `floor` soltanto quel commit e i suoi discendenti, come il commit integrato di «Pubblica in
 * Production», la cui CI un merge successivo può aver annullato.
 */
function chooseTarget(repository, values, floor) {
  const head = headOf(repository, "develop");
  if (values.testa) return head;
  localGit(() => git("fetch", "--quiet", "origin", "develop", "main"));
  const commits = git(
    "log",
    "--first-parent",
    "--max-count=50",
    "--format=%H %T",
    floor ? `${floor}^..${head}` : `origin/main..${head}`,
  )
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [sha, tree] = line.split(" ");
      return { sha, tree };
    });
  if (!commits.length) return head;
  const target = promotionTarget(
    commits,
    (tree) => candidateAvailable(repository, tree),
    values.version,
    (sha) => topVersion(git("show", `${sha}:CHANGELOG.md`)),
  );
  if (!target.certified)
    console.log("Nessun commit certificato dopo main: si promuove la testa dopo la sua qualifica.");
  else if (target.later)
    console.log(
      `Si promuove ${target.sha.slice(0, 12)}, già certificato: ${target.later} merge successivi restano al lotto seguente.`,
    );
  return target.sha;
}

/** Ritiro d'incidente della versione attiva: non ricostruisce e non tocca i dati. */
async function rollbackCycle({ repository, values }) {
  const sha = headOf(repository, "main");
  if (values?.sha) assertBase(values.sha, sha);
  const since = Date.now() - 1000;
  gh("workflow", "run", "rollback.yml", "--repo", repository, "--ref", "main");
  await waitRun(repository, "rollback.yml", sha, "main", ["workflow_dispatch"], since);
  console.log("Versione precedente attiva: serve una correzione prima della prossima promozione.");
}

function metricsCycle({ repository }) {
  const { workflow_runs: runs } = ghJson(
    "api",
    `repos/${repository}/actions/workflows/publish.yml/runs?branch=main&status=completed&per_page=20`,
  );
  const receipts = [];
  const jobs = new Map();
  for (const run of runs) {
    const { artifacts } = ghJson(
      "api",
      `repos/${repository}/actions/runs/${run.id}/artifacts?per_page=100`,
    );
    const ordered = artifacts.filter((entry) => !entry.expired).sort((a, b) => b.id - a.id);
    const artifact =
      ordered.find((entry) => entry.name.startsWith("production-state-")) ??
      ordered.find((entry) => entry.name.startsWith("release-receipt-"));
    if (artifact)
      receipts.push({
        ...downloadRecord(repository, { ...artifact, workflow_run: { id: run.id } }),
        run: run.id,
      });
    const attempts = [];
    for (let attempt = 1; attempt <= (run.run_attempt ?? 1); attempt++)
      attempts.push(...runJobs(repository, run.id, attempt));
    jobs.set(run.id, attempts);
  }
  // Le qualifiche del candidato sono il grosso dell'attesa di `Promuovi`: coda, browser e mutation.
  const { workflow_runs: qualifications } = ghJson(
    "api",
    `repos/${repository}/actions/workflows/candidate.yml/runs?branch=develop&status=success&per_page=10`,
  );
  const candidates = qualifications.map((run) => ({
    commit: (run.display_title ?? "").split(" ").at(-1)?.slice(0, 12) ?? run.head_sha.slice(0, 12),
    day: run.created_at.slice(0, 10),
    ...candidatePhases(runJobs(repository, run.id)),
  }));
  console.log(JSON.stringify({ ...promotionMetrics(runs, receipts, jobs), candidates }, null, 2));
}

/** Oggetto del ciclo nel titolo della run: il comando riaggancia quella attiva. */
export const coordinatorTitle = (operation, object, sha) => `Ciclo ${operation} ${object} ${sha}`;

const pendingFile = () => git("rev-parse", "--git-path", "publication-pending.json");

/** Il runner non può pulire il Mac. La ricevuta resta nel worktree fino alla riconciliazione locale. */
function pendingPublications() {
  return existsSync(pendingFile()) ? JSON.parse(readFileSync(pendingFile(), "utf8")) : [];
}

function rememberPublication(entry) {
  const entries = pendingPublications().filter((item) => item.number !== entry.number);
  writeFileSync(pendingFile(), JSON.stringify([...entries, entry]));
}

function reconcileLocalPublications(repository) {
  const retained = [];
  for (const entry of pendingPublications()) {
    if (
      entry.repository !== repository ||
      !entry.run ||
      ghJson("api", `repos/${repository}/actions/runs/${entry.run}`).conclusion !== "success"
    ) {
      retained.push(entry);
      continue;
    }
    const pr = readPullRequest(repository, entry.number);
    try {
      if (pr.state !== "MERGED") throw new Error("Merge non confermato.");
      localGit(() => {
        git("fetch", "origin", "develop", `refs/pull/${entry.number}/head`);
        if (!contains(entry.sha, pr.headRefOid))
          throw new Error("Testa della PR non riconciliata.");
        cleanup(pr);
      });
      console.log(`Pulizia locale della PR ${entry.number} riconciliata.`);
    } catch (error) {
      retained.push(entry);
      console.log(`Pulizia locale PR ${entry.number} conservata per la ripresa: ${error.message}`);
    }
  }
  writeFileSync(pendingFile(), JSON.stringify(retained));
}

/** Il ciclo gira in Actions se l'environment ha il token; altrimenti in questa sessione. */
function coordinatorAvailable(repository) {
  try {
    gh("api", `repos/${repository}/environments/publication/secrets/PUBLISH_TOKEN`, "--silent");
    return true;
  } catch {
    return false;
  }
}

/**
 * Avvia il ciclo nel workflow e lo segue: chiudere la sessione non lo ferma, e rilanciare lo stesso
 * comando riaggancia la run attiva.
 */
async function coordinate({ repository, command, number, values }) {
  const requestedAt = new Date().toISOString();
  const object = ["pr", "production", "resume"].includes(command)
    ? number
    : (values.version ?? "lotto");
  const resumed =
    command === "resume" ? ghJson("api", `repos/${repository}/actions/runs/${number}`) : undefined;
  const sha = ["pr", "production"].includes(command)
    ? readPullRequest(repository, number).headRefOid
    : resumed
      ? resumed.head_sha
      : command === "rollback"
        ? headOf(repository, "main")
        : chooseTarget(repository, values);
  const title = coordinatorTitle(command, object, sha);
  const list = () =>
    ghJson(
      "run",
      "list",
      "--repo",
      repository,
      "--workflow",
      "cycle.yml",
      "--limit",
      "30",
      "--json",
      "databaseId,displayTitle,status,createdAt",
    ).filter((run) => run.displayTitle === title);
  let run = list().find((item) => item.status !== "completed");
  if (!run) {
    const since = Date.now() - 1000;
    gh(
      "workflow",
      "run",
      "cycle.yml",
      "--repo",
      repository,
      "--ref",
      "develop",
      "-f",
      `operation=${command}`,
      "-f",
      `object=${object}`,
      // Soltanto la ripresa sceglie il gruppo dall'ambiente: gli altri cicli restano avviabili anche
      // con un `cycle.yml` che non conosce l'input, come quello della PR che lo introduce.
      ...(resumed ? ["-f", `environment=${resumeEnvironment(resumed)}`] : []),
      "-f",
      `sha=${sha}`,
      "-f",
      `requested_at=${requestedAt}`,
      "-f",
      `urgente=${Boolean(values.urgente)}`,
      "-f",
      `reviewed_migrations=${values["reviewed-migrations"]}`,
    );
    for (let attempt = 0; attempt < 24 && !run; attempt++) {
      await pause(5000);
      run = list().find((item) => Date.parse(item.createdAt) >= since);
    }
    if (!run) throw new Error("Workflow del ciclo non osservato.");
  }
  console.log(`Ciclo in Actions: run ${run.databaseId}.`);
  if (["pr", "production"].includes(command))
    rememberPublication({ repository, number, sha, run: run.databaseId });
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
  summary(repository, run.databaseId);
  if (["pr", "production"].includes(command)) reconcileLocalPublications(repository);
}

/** Pubblica in Production: nel workflow i due passi girano in job distinti, ciascuno nel suo gruppo. */
async function productionCycle(context) {
  await pullRequestCycle(context);
  await promoteCycle({
    ...context,
    values: { ...context.values, sha: undefined, pr: context.number },
  });
}

const cycles = {
  cleanup: cleanupCycle,
  resume: resumeCycle,
  pr: pullRequestCycle,
  production: productionCycle,
  promote: promoteCycle,
  candidate: candidateCycle,
  rollback: rollbackCycle,
};

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      sha: { type: "string" },
      base: { type: "string" },
      head: { type: "string" },
      version: { type: "string" },
      urgente: { type: "boolean", default: false },
      qui: { type: "boolean", default: false },
      manual: { type: "boolean", default: false },
      weekly: { type: "boolean", default: false },
      testa: { type: "boolean", default: false },
      pr: { type: "string" },
      "requested-at": { type: "string" },
      "reviewed-migrations": { type: "string", default: "" },
    },
  });
  const { command, number } = cycleCommand(positionals);
  // Gira nei job della CI senza token: nessuna lettura del repository remoto con gh.
  if (command === "qualification-base") return qualificationBase(values);
  const repository = ghJson("api", "repos/{owner}/{repo}").full_name;
  // status legge soltanto: nessun checkout pulito né blocco.
  if (command === "status") return statusCycle({ repository, number });
  if (command === "metrics") return metricsCycle({ repository });
  if (command === "preflight") return preflightCycle({ repository, values });
  if (command === "candidate-ready") return candidateReady({ repository, values });
  if (
    !process.env.GITHUB_ACTIONS &&
    ["pr", "production", "promote", "rollback", "resume", "cleanup"].includes(command)
  )
    reconcileLocalPublications(repository);
  // Il ciclo dura decine di minuti: in Actions sopravvive alla sessione e al Mac spento.
  if (
    ["pr", "production", "promote", "rollback", "resume"].includes(command) &&
    !process.env.GITHUB_ACTIONS &&
    (!values.qui || command !== "pr")
  ) {
    if (coordinatorAvailable(repository))
      return coordinate({ repository, command, number, values });
    if (command !== "pr")
      throw new Error(
        "Coordinatore remoto non disponibile: riconciliare publication prima di operazioni Production.",
      );
  }
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
