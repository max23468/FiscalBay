import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  realpathSync,
  readFileSync,
  existsSync,
  utimesSync,
  cpSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { requiredReview } from "./release.mjs";
import {
  assertBase,
  assertContained,
  candidateRun,
  assertQualificationBase,
  independentBase,
  waitUpdatedHead,
  expectedRun,
  runTimings,
  checkCycleJobs,
  deploySuperseded,
  settleMergeRun,
  assertConfirmed,
  assertPublishedRelease,
  squashIntegrated,
  completeHistory,
  cleanup,
  acquireLock,
  withLock,
  pullRequestView,
  pullRequestAction,
  checksOutcome,
  pullRequestFiles,
  cycleCommand,
  lockObject,
  assertCyclePullRequest,
  migrationReviewBlocked,
  retryQualification,
  mergeDecision,
  assertResumableRun,
  assertPromotable,
  coordinatorTitle,
  deployedEnvironment,
  existingPublication,
  lotReview,
  promotionMetrics,
  candidateReadiness,
  addedDecisions,
  addedLineNumbers,
  assertNotWithdrawn,
  candidatePhases,
  decisionRenumbering,
  mergedCommit,
  promotionTarget,
  receiptPrefix,
  remoteLockStore,
  renumberDecisions,
  resumeEnvironment,
  withRemoteLock,
} from "./release-cycle.mjs";

describe("coordinamento e provenienza della pubblicazione", () => {
  it("blocca soltanto lo stesso oggetto del ciclo e recupera i blocchi rimasti", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "cycle-lock-"));
    const lock = (name) => path.join(directory, name);
    try {
      // Due PR diverse procedono insieme; la stessa PR resta a un solo ciclo.
      assert.equal(acquireLock(lock("pr-1")), true);
      assert.equal(acquireLock(lock("pr-2")), true);
      assert.equal(acquireLock(lock("pr-1")), false);
      // Il titolare terminato lascia il blocco al ciclo successivo.
      const ended = spawnSync(
        process.execPath,
        ["-e", "process.stdout.write(String(process.pid))"],
        {
          encoding: "utf8",
        },
      );
      writeFileSync(
        path.join(lock("pr-1"), "owner.json"),
        JSON.stringify({ pid: Number(ended.stdout) }),
      );
      assert.equal(acquireLock(lock("pr-1")), true);
      // Una cartella senza titolare è appena nata altrove, se non è rimasta da più di un minuto.
      mkdirSync(lock("pr-3"));
      assert.equal(acquireLock(lock("pr-3")), false);
      const old = new Date(Date.now() - 120_000);
      utimesSync(lock("pr-3"), old, old);
      assert.equal(acquireLock(lock("pr-3")), true);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("attende il titolare vivo e rilascia il blocco anche con lavoro asincrono o fallito", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "cycle-lock-"));
    const lock = path.join(directory, "merge");
    try {
      // Il titolare è un processo vivo per circa mezzo secondo.
      const started = Date.now();
      // Come nel ciclo reale il titolare è un processo indipendente, non un figlio di questo.
      const sleeper = spawnSync(
        process.execPath,
        [
          "-e",
          'const c=require("node:child_process").spawn(process.execPath,["-e","setTimeout(()=>{},500)"],{detached:true,stdio:"ignore"});c.unref();process.stdout.write(String(c.pid))',
        ],
        { encoding: "utf8" },
      );
      mkdirSync(lock);
      writeFileSync(path.join(lock, "owner.json"), JSON.stringify({ pid: Number(sleeper.stdout) }));
      assert.equal(
        withLock(lock, "la prova", () => existsSync(path.join(lock, "owner.json")), 50),
        true,
      );
      assert.ok(Date.now() - started >= 400, "Il blocco non ha atteso il titolare vivo.");
      assert.equal(existsSync(lock), false);
      assert.equal(await withLock(lock, "la prova", async () => "fatto", 50), "fatto");
      assert.equal(existsSync(lock), false);
      await assert.rejects(
        withLock(lock, "la prova", async () => {
          throw new Error("errore della prova");
        }),
        /errore della prova/u,
      );
      assert.throws(
        () =>
          withLock(lock, "la prova", () => {
            throw new Error("errore sincrono");
          }),
        /errore sincrono/u,
      );
      assert.equal(existsSync(lock), false);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("prova l'integrazione squash sul tree completo preservando differenze e lavoro aggiunto", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "cycle-git-"));
    const run = (...args) => {
      const result = spawnSync("git", args, { cwd: directory, encoding: "utf8" });
      assert.equal(result.status, 0, result.stderr);
      return result.stdout.trim();
    };
    try {
      run("init", "-q", "--initial-branch=develop");
      run("config", "user.name", "Synthetic test");
      run("config", "user.email", "test@example.invalid");
      writeFileSync(path.join(directory, "value.js"), "export const value=false;\n");
      run("add", ".");
      run("commit", "-qm", "base");
      run("switch", "-c", "codex/feature");
      writeFileSync(path.join(directory, "value.js"), "export const value=true;\n");
      run("add", ".");
      run("commit", "-qm", "feature");
      const head = run("rev-parse", "HEAD");
      run("switch", "develop");
      writeFileSync(path.join(directory, "concurrent.js"), "export const other=true;\n");
      run("add", ".");
      run("commit", "-qm", "independent change");
      run("merge", "--squash", "codex/feature");
      run("commit", "-qm", "squash");
      const merged = run("rev-parse", "HEAD");
      assert.equal(squashIntegrated(head, merged, directory), true);
      run("switch", "codex/feature");
      writeFileSync(path.join(directory, "pending.js"), "export const pending=true;\n");
      run("add", ".");
      run("commit", "-qm", "not integrated");
      assert.equal(squashIntegrated(run("rev-parse", "HEAD"), merged, directory), false);
      run("switch", "develop");
      writeFileSync(path.join(directory, "value.js"), "export const value = true;\n");
      run("add", ".");
      run("commit", "--amend", "--no-edit", "-q");
      assert.equal(squashIntegrated(head, run("rev-parse", "HEAD"), directory), false);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("completa un clone superficiale prima di provare l'integrazione squash", () => {
    const directory = realpathSync(mkdtempSync(path.join(tmpdir(), "cycle-shallow-")));
    const origin = path.join(directory, "origin");
    const shallow = path.join(directory, "shallow");
    const run = (cwd, ...args) => {
      const result = spawnSync("git", args, { cwd, encoding: "utf8" });
      assert.equal(result.status, 0, result.stderr);
      return result.stdout.trim();
    };
    try {
      run(directory, "init", "-q", "--initial-branch=develop", origin);
      run(origin, "config", "user.name", "Synthetic test");
      run(origin, "config", "user.email", "test@example.invalid");
      writeFileSync(path.join(origin, "value.js"), "export const value=false;\n");
      run(origin, "add", ".");
      run(origin, "commit", "-qm", "base");
      run(origin, "switch", "-qc", "codex/feature");
      writeFileSync(path.join(origin, "value.js"), "export const value=true;\n");
      run(origin, "commit", "-qam", "feature");
      const head = run(origin, "rev-parse", "HEAD");
      run(origin, "switch", "-q", "develop");
      run(origin, "merge", "--squash", "codex/feature");
      run(origin, "commit", "-qm", "squash");
      const merged = run(origin, "rev-parse", "HEAD");
      run(directory, "clone", "-q", "--depth=1", `file://${origin}`, shallow);
      run(shallow, "fetch", "-q", "--depth=1", "origin", "codex/feature");
      assert.equal(squashIntegrated(head, merged, shallow), false);
      completeHistory(shallow);
      assert.equal(run(shallow, "rev-parse", "--is-shallow-repository"), "false");
      assert.equal(squashIntegrated(head, merged, shallow), true);
      completeHistory(shallow);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("pulisce da un worktree dedicato mentre la base è attiva nel checkout principale", () => {
    const directory = realpathSync(mkdtempSync(path.join(tmpdir(), "cycle-worktree-")));
    const origin = path.join(directory, "origin.git");
    const main = path.join(directory, "main");
    const dedicated = path.join(directory, "dedicated");
    const run = (cwd, ...args) => {
      const result = spawnSync("git", args, { cwd, encoding: "utf8" });
      assert.equal(result.status, 0, result.stderr);
      return result.stdout.trim();
    };
    try {
      run(directory, "init", "-q", "--bare", "--initial-branch=develop", origin);
      run(directory, "clone", "-q", origin, main);
      run(main, "config", "user.name", "Synthetic test");
      run(main, "config", "user.email", "test@example.invalid");
      writeFileSync(path.join(main, "value.js"), "export const value=false;\n");
      run(main, "add", ".");
      run(main, "commit", "-qm", "base");
      run(main, "push", "-q", "origin", "develop");
      run(main, "worktree", "add", "-q", "-b", "codex/feature", dedicated);
      writeFileSync(path.join(dedicated, "value.js"), "export const value=true;\n");
      run(dedicated, "add", ".");
      run(dedicated, "commit", "-qm", "feature");
      run(dedicated, "push", "-q", "origin", "codex/feature");
      const head = run(dedicated, "rev-parse", "HEAD");
      run(main, "merge", "--squash", "codex/feature");
      run(main, "commit", "-qm", "squash");
      run(main, "push", "-q", "origin", "develop");
      const merged = run(main, "rev-parse", "HEAD");
      run(dedicated, "fetch", "-q", "origin", "develop");
      const pr = {
        headRefName: "codex/feature",
        headRefOid: head,
        baseRefName: "develop",
        mergeCommit: { oid: merged },
      };
      writeFileSync(path.join(dedicated, "pending.js"), "export const pending=true;\n");
      assert.throws(() => cleanup(pr, dedicated), /Checkout modificato/u);
      assert.equal(run(dedicated, "branch", "--show-current"), "codex/feature");
      rmSync(path.join(dedicated, "pending.js"));
      cleanup(pr, dedicated);
      assert.equal(run(dedicated, "branch", "--show-current"), "");
      assert.equal(run(dedicated, "rev-parse", "HEAD"), merged);
      assert.equal(run(main, "branch", "--show-current"), "develop");
      assert.equal(run(main, "for-each-ref", "refs/heads/codex/feature"), "");
      assert.equal(run(main, "ls-remote", "origin", "refs/heads/codex/feature"), "");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("elimina un branch locale rimasto indietro e conserva quello con commit propri", () => {
    const directory = realpathSync(mkdtempSync(path.join(tmpdir(), "cycle-behind-")));
    const origin = path.join(directory, "origin.git");
    const main = path.join(directory, "main");
    const run = (cwd, ...args) => {
      const result = spawnSync("git", args, { cwd, encoding: "utf8" });
      assert.equal(result.status, 0, result.stderr);
      return result.stdout.trim();
    };
    try {
      run(directory, "init", "-q", "--bare", "--initial-branch=develop", origin);
      run(directory, "clone", "-q", origin, main);
      run(main, "config", "user.name", "Synthetic test");
      run(main, "config", "user.email", "test@example.invalid");
      writeFileSync(path.join(main, "value.js"), "export const value=false;\n");
      run(main, "add", ".");
      run(main, "commit", "-qm", "base");
      run(main, "push", "-q", "origin", "develop");
      run(main, "switch", "-qc", "codex/feature");
      writeFileSync(path.join(main, "value.js"), "export const value=true;\n");
      run(main, "commit", "-qam", "feature");
      const stale = run(main, "rev-parse", "HEAD");
      // Il ciclo aggiorna la testa sul remoto; il checkout locale passa a un altro lavoro.
      writeFileSync(path.join(main, "other.js"), "export const other=true;\n");
      run(main, "add", ".");
      run(main, "commit", "-qm", "base aggiornata");
      run(main, "push", "-q", "origin", "codex/feature");
      const head = run(main, "rev-parse", "HEAD");
      run(main, "switch", "-q", "develop");
      run(main, "merge", "--squash", "codex/feature");
      run(main, "commit", "-qm", "squash");
      run(main, "push", "-q", "origin", "develop");
      const merged = run(main, "rev-parse", "HEAD");
      run(main, "switch", "-qc", "altro-lavoro");
      const pr = {
        headRefName: "codex/feature",
        headRefOid: head,
        baseRefName: "develop",
        mergeCommit: { oid: merged },
      };
      run(main, "branch", "-f", "codex/feature", stale);
      run(main, "switch", "-q", "codex/feature");
      writeFileSync(path.join(main, "own.js"), "export const own=true;\n");
      run(main, "add", ".");
      run(main, "commit", "-qm", "lavoro locale");
      run(main, "switch", "-q", "altro-lavoro");
      assert.throws(() => cleanup(pr, main), /non riconciliato/u);
      run(main, "branch", "-f", "codex/feature", stale);
      cleanup(pr, main);
      assert.equal(run(main, "branch", "--show-current"), "altro-lavoro");
      assert.equal(run(main, "for-each-ref", "refs/heads/codex/feature"), "");
      assert.equal(run(main, "ls-remote", "origin", "refs/heads/codex/feature"), "");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("legge soltanto i nomi dei file della PR, su tutte le pagine", () => {
    const calls = [];
    const files = pullRequestFiles("example/project", 462, (...args) => {
      calls.push(args);
      return "app/root.tsx\ndocs/README.md\n";
    });
    assert.deepEqual(files, ["app/root.tsx", "docs/README.md"]);
    assert.deepEqual(calls, [
      [
        "api",
        "--paginate",
        "--jq",
        ".[].filename",
        "repos/example/project/pulls/462/files?per_page=100",
      ],
    ]);
  });

  it("esegue status in sola lettura, conserva modifiche e riconcilia una qualifica riusata", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "cycle-cli-"));
    const calls = path.join(directory, "calls");
    const at = (seconds) => new Date(seconds * 1000).toISOString();
    const run = {
      created_at: at(0),
      updated_at: at(100),
      run_attempt: 2,
      status: "completed",
      conclusion: "success",
      html_url: "https://github.com/example/project/actions/runs/123",
    };
    const jobs = {
      jobs: [
        { conclusion: "success", started_at: at(5), completed_at: at(25) },
        { conclusion: "success", started_at: at(10), completed_at: at(30) },
      ],
    };
    const executable = `#!${process.execPath}\nconst fs = require("node:fs"); const args = process.argv.slice(2); fs.appendFileSync(process.env.CYCLE_CALLS, JSON.stringify(args) + "\\n"); if(args[1] === "repos/{owner}/{repo}") console.log(JSON.stringify({full_name:"example/project"})); else if(args.includes("--slurp")) console.log(${JSON.stringify(JSON.stringify([jobs]))}); else console.log(${JSON.stringify(JSON.stringify(run))});\n`;
    try {
      writeFileSync(path.join(directory, "gh"), executable, { mode: 0o700 });
      const env = { ...process.env, PATH: `${directory}:${process.env.PATH}`, CYCLE_CALLS: calls };
      const status = spawnSync(
        process.execPath,
        ["scripts/release/release-cycle.mjs", "status", "123"],
        {
          encoding: "utf8",
          env,
        },
      );
      assert.equal(status.status, 0, status.stderr);
      const output = JSON.parse(status.stdout);
      assert.equal(output.activeSeconds, 25);
      assert.equal(output.waitingSeconds, 75);
      assert.ok(
        readFileSync(calls, "utf8")
          .split("\n")
          .filter(Boolean)
          .every((line) => JSON.parse(line)[0] === "api"),
      );
      const checkout = path.join(directory, "checkout");
      mkdirSync(checkout);
      assert.equal(spawnSync("git", ["init", "-q", checkout]).status, 0);
      writeFileSync(path.join(checkout, "pending"), "owner work");
      const pr = spawnSync(
        process.execPath,
        [path.resolve("scripts/release/release-cycle.mjs"), "pr", "123", "--qui"],
        { encoding: "utf8", env, cwd: checkout },
      );
      assert.notEqual(pr.status, 0);
      assert.match(pr.stderr, /checkout pulito/u);
      assert.equal(readFileSync(path.join(checkout, "pending"), "utf8"), "owner work");
      assert.equal(readFileSync(calls, "utf8").includes('"merge"'), false);
      const runGit = (...args) => {
        const result = spawnSync("git", args, { cwd: checkout, encoding: "utf8" });
        assert.equal(result.status, 0, result.stderr);
      };
      runGit("config", "user.name", "Synthetic test");
      runGit("config", "user.email", "test@example.invalid");
      runGit("add", ".");
      runGit("commit", "-qm", "local source");
      const sha = "a".repeat(40);
      const tree = "b".repeat(40);
      const proof = {
        name: `candidate-${tree}`,
        expired: false,
        workflow_run: { id: 123, repository_id: 1, head_repository_id: 1, head_sha: sha },
      };
      const cycleJobs = {
        jobs: [
          { name: "Distribuisci e verifica", conclusion: "skipped" },
          { name: "Qualifica candidato / Candidate qualified", conclusion: "success" },
        ],
      };
      Object.assign(run, {
        id: 123,
        repository: { id: 1 },
        head_repository: { id: 1 },
        head_sha: sha,
        head_branch: "develop",
        event: "workflow_dispatch",
      });
      const candidateGh = `#!${process.execPath}\nconst fs=require("node:fs");const a=process.argv.slice(2);fs.appendFileSync(process.env.CYCLE_CALLS,JSON.stringify(a)+"\\n");let value;if(a[1]==="repos/{owner}/{repo}")value={full_name:"example/project"};else if(a[0]==="run")value=[{databaseId:124,headSha:${JSON.stringify(sha)},status:"completed",conclusion:"success"}];else if(a[0]==="workflow")process.exit(99);else if(a.includes("--slurp"))value=a.at(-1).includes("/attempts/")?${JSON.stringify([jobs])}:${JSON.stringify([cycleJobs])};else if(a[1].includes("git/ref/")){console.log(${JSON.stringify(sha)});process.exit(0);}else if(a[1].includes("git/commits/"))value={tree:{sha:${JSON.stringify(tree)}}};else if(a[1].includes("/artifacts?"))value={artifacts:[{...${JSON.stringify(proof)},expired:process.env.CANDIDATE_EXPIRED==="1"}]};else if(a[1].includes("/actions/runs/"))value={...${JSON.stringify(run)},path:".github/workflows/candidate.yml"};else value={id:1};console.log(JSON.stringify(value));\n`;
      writeFileSync(path.join(directory, "gh"), candidateGh, { mode: 0o700 });
      writeFileSync(calls, "");
      const candidate = (expired) =>
        spawnSync(
          process.execPath,
          [path.resolve("scripts/release/release-cycle.mjs"), "candidate"],
          {
            encoding: "utf8",
            cwd: checkout,
            env: { ...env, CANDIDATE_EXPIRED: expired ? "1" : "0" },
          },
        );
      const reused = candidate(false);
      assert.equal(reused.status, 0, reused.stderr);
      assert.match(reused.stdout, /Candidato già qualificato/u);
      assert.equal(readFileSync(calls, "utf8").includes('"workflow"'), false);
      assert.equal(candidate(true).status, 1);
      assert.ok(readFileSync(calls, "utf8").includes('"workflow","run","candidate.yml"'));
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("rifiuta qualifiche su una base superata", () => {
    const sha = "a".repeat(40);
    assert.doesNotThrow(() => assertBase(sha, sha));
    assert.throws(() => assertBase(sha, "b".repeat(40)), /base/u);
    assert.throws(() => assertBase("", ""), /base/u);
  });

  it("promuove il commit autorizzato anche se develop avanza, mai uno estraneo", () => {
    const sha = "a".repeat(40);
    assert.doesNotThrow(() => assertContained(sha, "identical"));
    assert.doesNotThrow(() => assertContained(sha, "ahead"));
    assert.throws(() => assertContained(sha, "diverged"), /autorizzato/u);
    assert.throws(() => assertContained(sha, "behind"), /autorizzato/u);
    assert.throws(() => assertContained("", "ahead"), /autorizzato/u);
  });

  it("segue il candidato dal titolo quando develop è già avanzato", () => {
    const sha = "a".repeat(40);
    const since = Date.parse("2026-11-02T10:00:00Z");
    const run = (databaseId, displayTitle, createdAt, event = "workflow_dispatch") => ({
      databaseId,
      displayTitle,
      createdAt,
      event,
      headSha: "b".repeat(40),
    });
    const runs = [
      run(1, `Candidato ${sha}`, "2026-11-02T09:00:00Z"),
      run(2, `Candidato ${sha}`, "2026-11-02T10:01:00Z"),
      run(3, `Candidato ${sha}`, "2026-11-02T10:02:00Z", "schedule"),
      run(4, `Candidato ${"c".repeat(40)}`, "2026-11-02T10:03:00Z"),
    ];
    assert.equal(candidateRun(runs, sha, since)?.databaseId, 2);
    assert.equal(candidateRun(runs.slice(2), sha, since), undefined);
  });

  it("non riqualifica per una base avanzata su file disgiunti e non globali", () => {
    assert.equal(independentBase(["app/routes/stores.tsx"], []), true);
    assert.equal(independentBase(["app/routes/stores.tsx"], ["app/routes/orders.tsx"]), true);
    assert.equal(independentBase(["migrations/0041_a.sql"], ["app/routes/orders.tsx"]), true);
    for (const [own, base] of [
      [["app/copy/copy-it.ts"], ["app/copy/copy-it.ts", "README.md"]],
      [["migrations/0041_a.sql"], ["migrations/0041_b.sql"]],
      [["app/routes/stores.tsx"], ["pnpm-lock.yaml"]],
      [["package.json"], ["app/routes/orders.tsx"]],
      [["app/routes/stores.tsx"], [".github/workflows/ci.yml"]],
      [["app/routes/stores.tsx"], ["scripts/release/release.mjs"]],
      [["app/routes/stores.tsx"], ["vite.config.ts"]],
      [["app/routes/stores.tsx"], ["e2e/fixtures.ts"]],
    ])
      assert.equal(independentBase(own, base), false, `${own} ${base}`);
    assert.equal(independentBase(["e2e/stores.spec.ts"], ["e2e/orders.spec.ts"]), true);
  });

  it("non considera sovrapposti roadmap, registro e changelog", () => {
    const shared = ["docs/ROADMAP.md", "docs/decisions/DECISION_REGISTER.md", "CHANGELOG.md"];
    assert.equal(independentBase(["app/a.ts", ...shared], ["app/b.ts", ...shared]), true);
    assert.equal(independentBase(["app/a.ts", ...shared], ["app/a.ts", ...shared]), false);
    assert.equal(independentBase(["AGENTS.md"], ["AGENTS.md"]), false);
  });

  it("ammette una base attuale compatibile con quella provata", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "qualification-base-"));
    const git = (...args) =>
      (spawnSync("git", args, { cwd: directory, encoding: "utf8" }).stdout ?? "").trim();
    const run = (...args) => {
      const result = spawnSync("git", args, { cwd: directory, encoding: "utf8" });
      if (result.status !== 0) throw new Error(result.stderr);
      return result.stdout.trim();
    };
    const commit = (file, text) => {
      mkdirSync(path.dirname(path.join(directory, file)), { recursive: true });
      writeFileSync(path.join(directory, file), text);
      git("add", "--all");
      git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "--quiet", "-m", file);
      return git("rev-parse", "HEAD");
    };
    try {
      git("init", "--quiet", "--initial-branch", "develop");
      const tested = commit("app/a.ts", "a\n");
      const disjoint = commit("app/b.ts", "b\n");
      const shared = commit("app/a.ts", "a2\n");
      git("switch", "--quiet", "-c", "feature", tested);
      const head = commit("app/c.ts", "c\n");
      git("switch", "--quiet", "-c", "overlap", tested);
      const overlap = commit("app/b.ts", "b2\n");
      assert.doesNotThrow(() => assertQualificationBase(tested, tested, head, run));
      assert.doesNotThrow(() => assertQualificationBase(tested, disjoint, head, run));
      assert.throws(() => assertQualificationBase(tested, disjoint, overlap, run), /file comuni/u);
      assert.doesNotThrow(() => assertQualificationBase(disjoint, shared, head, run));
      assert.throws(() => assertQualificationBase("", tested, head, run), /base/u);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("segue la run più recente sul commit atteso, non quella annullata", () => {
    const sha = "a".repeat(40);
    const run = (databaseId, createdAt, extra = {}) => ({
      databaseId,
      headSha: sha,
      event: "pull_request",
      createdAt,
      ...extra,
    });
    // L'aggiornamento della base e il ritorno da bozza avviano due run sullo stesso commit.
    const runs = [
      run(1, "2026-10-22T13:47:38Z"),
      run(2, "2026-10-22T13:47:41Z"),
      run(3, "2026-10-22T13:50:00Z", { headSha: "b".repeat(40) }),
      run(4, "2026-10-22T13:51:00Z", { event: "push" }),
      run(5, "2026-10-22T13:40:00Z"),
    ];
    const since = Date.parse("2026-10-22T13:47:30Z");
    assert.equal(expectedRun(runs, sha, ["pull_request"], since)?.databaseId, 2);
    assert.equal(expectedRun(runs, sha, ["pull_request"], since, new Set([2]))?.databaseId, 1);
    assert.equal(expectedRun(runs, sha, ["pull_request"], since, new Set([1, 2])), undefined);
    assert.equal(expectedRun(runs, sha, ["pull_request"], since, new Set(), 1)?.databaseId, 1);
  });

  it("dopo l'aggiornamento della base attende la nuova testa della PR", async () => {
    const [old, merged] = ["a".repeat(40), "c".repeat(40)];
    // GitHub risponde prima di creare il merge: le prime letture mostrano ancora la testa vecchia.
    const heads = [old, old, merged];
    const reads = [];
    const pr = await waitUpdatedHead(
      () => {
        const head = heads[Math.min(reads.length, heads.length - 1)];
        reads.push(head);
        return { headRefOid: head };
      },
      old,
      (head) => head === merged,
      5,
      0,
    );
    assert.equal(pr.headRefOid, merged);
    assert.deepEqual(reads, [old, old, merged]);
    // Una testa cambiata ma senza la base non basta; senza aggiornamento il ciclo si ferma.
    await assert.rejects(
      waitUpdatedHead(
        () => ({ headRefOid: merged }),
        old,
        () => false,
        3,
        0,
      ),
      /non aggiornata/u,
    );
  });

  it("non chiude un ciclo con un tag di un altro commit", () => {
    const release = {
      tagName: "v2.0.0",
      isDraft: false,
      url: "https://github.com/example/repo/releases/tag/v2.0.0",
    };
    assert.doesNotThrow(() => assertPublishedRelease(release, "commit", "commit", "2.0.0"));
    assert.throws(() => assertPublishedRelease(release, "other", "commit", "2.0.0"));
    assert.throws(() =>
      assertPublishedRelease({ ...release, isDraft: true }, "commit", "commit", "2.0.0"),
    );
  });

  it("misura una sola volta job paralleli e distingue la pausa fra tentativi", () => {
    const at = (seconds) => new Date(seconds * 1000).toISOString();
    const run = { created_at: at(0), updated_at: at(100), run_attempt: 2 };
    const jobs = [
      { conclusion: "success", started_at: at(5), completed_at: at(25) },
      { conclusion: "success", started_at: at(10), completed_at: at(30) },
      { conclusion: "success", started_at: at(80), completed_at: at(95) },
      { conclusion: "skipped", started_at: at(0), completed_at: at(100) },
      { conclusion: "success", started_at: at(90), completed_at: at(85) },
    ];
    assert.deepEqual(runTimings(run, jobs), {
      attempts: 2,
      elapsedSeconds: 100,
      activeSeconds: 40,
      waitingSeconds: 60,
    });
  });

  it("richiede il deploy quando pertinente e il readback confermato nella run", () => {
    const gate = { name: "Node 26", conclusion: "success" };
    const deploy = { name: "Deploy test", conclusion: "skipped", steps: [] };
    const confirmed = {
      ...deploy,
      conclusion: "success",
      steps: [{ name: "Confirm provider readback", conclusion: "success" }],
    };
    assert.equal(checkCycleJobs([gate, deploy], false), false);
    assert.throws(() => checkCycleJobs([gate, deploy], true));
    assert.equal(checkCycleJobs([gate, confirmed], true), true);
    assert.throws(() => checkCycleJobs([{ ...gate, conclusion: "failure" }], false));
    // Una run senza il passo di conferma, o con il passo saltato, non chiude il ciclo.
    assert.throws(() => checkCycleJobs([gate, { ...confirmed, steps: [] }], true), /Readback/u);
    assert.throws(
      () =>
        checkCycleJobs(
          [gate, { ...confirmed, steps: [{ ...confirmed.steps[0], conclusion: "skipped" }] }],
          false,
        ),
      /Readback/u,
    );
  });

  /** Job di una run di `develop`: gate e deploy test con l'esito dei suoi passi. */
  const developJobs = (deployed, conclusion = "success") => [
    { name: "Node 26", conclusion: "success" },
    {
      name: "Deploy test",
      conclusion,
      steps: [
        { name: "Check commit still on develop", conclusion: "success" },
        { name: "Deploy verified artifact", conclusion: deployed },
        { name: "Confirm provider readback", conclusion: deployed },
      ],
    },
  ];

  it("riconosce un deploy lasciato a un merge successivo e nessun altro esito", () => {
    const run = { conclusion: "success" };
    assert.equal(deploySuperseded(run, developJobs("skipped")), true);
    assert.equal(deploySuperseded({ conclusion: "cancelled" }, []), true);
    assert.equal(deploySuperseded(run, developJobs("success")), false);
    assert.equal(
      deploySuperseded({ conclusion: "failure" }, developJobs("failure", "failure")),
      false,
    );
    assert.equal(deploySuperseded(run, [{ name: "Node 26", conclusion: "success" }]), false);
  });

  it("chiude il ciclo con la run della nuova testa che contiene il merge e ne conferma il deploy", async () => {
    const merge = "a".repeat(40);
    const later = "b".repeat(40);
    const runs = {
      [merge]: { id: 1, head_sha: merge, conclusion: "success", jobs: developJobs("skipped") },
      [later]: { id: 2, head_sha: later, conclusion: "success", jobs: developJobs("success") },
    };
    const io = (overrides = {}) => ({
      wait: async (sha) => runs[sha],
      jobs: (run) => run.jobs,
      head: () => later,
      contains: (ancestor, head) => ancestor === merge && head === later,
      ...overrides,
    });
    const log = console.log;
    console.log = () => {};
    try {
      const settled = await settleMergeRun(merge, false, io());
      assert.equal(settled.run.id, 2);
      assert.equal(settled.deployRequired, true);
      assert.equal(checkCycleJobs(settled.jobs, settled.deployRequired), true);
      // La nuova testa deve contenere il merge, essere diversa e riuscita con il deploy.
      await assert.rejects(settleMergeRun(merge, false, io({ contains: () => false })), /Run 1/u);
      await assert.rejects(settleMergeRun(merge, false, io({ head: () => merge })), /Run 1/u);
      runs[later] = {
        ...runs[later],
        conclusion: "failure",
        jobs: developJobs("failure", "failure"),
      };
      await assert.rejects(settleMergeRun(merge, false, io()), /Run 2/u);
      // Un fallimento della run del merge non segue nessuna run successiva.
      runs[merge] = {
        ...runs[merge],
        conclusion: "failure",
        jobs: developJobs("failure", "failure"),
      };
      let followed = false;
      await assert.rejects(
        settleMergeRun(merge, false, io({ head: () => ((followed = true), later) })),
        /Run 1/u,
      );
      assert.equal(followed, false);
      // La run del merge riuscita chiude il ciclo con il deploy richiesto dal piano.
      runs[merge] = { ...runs[merge], conclusion: "success", jobs: developJobs("success") };
      assert.deepEqual(await settleMergeRun(merge, false, io()), {
        run: runs[merge],
        jobs: runs[merge].jobs,
        deployRequired: false,
      });
    } finally {
      console.log = log;
    }
  });

  it("segue i merge fino alla scadenza complessiva", async () => {
    const shas = ["1", "2", "3", "4", "5"].map((digit) => digit.repeat(40));
    let current = 0;
    let time = 0;
    const io = {
      now: () => time,
      wait: async (sha) => {
        time += 20 * 60_000;
        return {
          id: shas.indexOf(sha) + 1,
          head_sha: sha,
          conclusion: "cancelled",
          jobs: [],
        };
      },
      jobs: (run) => run.jobs,
      head: () => shas[++current],
      contains: () => true,
    };
    const log = console.log;
    console.log = () => {};
    try {
      await assert.rejects(settleMergeRun(shas[0], true, io), /Run 3/u);
      assert.equal(current, 3);
      current = 0;
      time = 0;
      const settled = await settleMergeRun(shas[0], true, {
        ...io,
        wait: async (sha) => ({
          id: shas.indexOf(sha) + 1,
          head_sha: sha,
          conclusion: sha === shas[4] ? "success" : "cancelled",
          jobs: [],
        }),
      });
      assert.equal(settled.run.id, 5);
    } finally {
      console.log = log;
    }
  });

  it("richiede la conferma Production successiva al giorno", () => {
    const job = (conclusion) => ({
      name: "Conferma pubblicazione attiva",
      conclusion: "success",
      steps: [{ name: "Confirm expected version after day", conclusion }],
    });
    assert.doesNotThrow(() => assertConfirmed([job("success")], "production"));
    assert.throws(() => assertConfirmed([job("failure")], "production"), /production/u);
    assert.throws(() => assertConfirmed([job("success")], "test"), /test/u);
    const previous = job("success");
    previous.steps[0].name = "Confirm expected version after guard and day";
    assert.doesNotThrow(() => assertConfirmed([previous], "production"));
  });
});

describe("PR tramite API REST", () => {
  const pull = {
    state: "closed",
    draft: false,
    auto_merge: null,
    merged_at: "2026-10-25T12:00:00Z",
    merge_commit_sha: "c".repeat(40),
    head: { ref: "feature", sha: "a".repeat(40), repo: { full_name: "example/project" } },
    base: { ref: "develop", sha: "b".repeat(40) },
    body: null,
  };

  it("converte la PR REST nei campi del ciclo", () => {
    assert.deepEqual(pullRequestView(pull), {
      state: "MERGED",
      isDraft: false,
      autoMergeRequest: null,
      headRefName: "feature",
      headRefOid: "a".repeat(40),
      baseRefName: "develop",
      baseRefOid: "b".repeat(40),
      mergeCommit: { oid: "c".repeat(40) },
      headRepository: { nameWithOwner: "example/project" },
      body: "",
    });
    const open = pullRequestView({
      ...pull,
      state: "open",
      merged_at: null,
      head: { ...pull.head, repo: null },
    });
    assert.equal(open.state, "OPEN");
    assert.equal(open.mergeCommit, null);
    assert.equal(open.headRepository, null);
  });

  it("usa le route del proxy soltanto nelle sessioni cloud", () => {
    const cloud = { CLAUDE_CODE_REMOTE: "true" };
    assert.deepEqual(pullRequestAction("enable-auto", "example/project", "7", "a", cloud), [
      "api",
      "-X",
      "PUT",
      "repos/example/project/pulls/7/ccr/auto_merge",
      "-f",
      "merge_method=squash",
    ]);
    assert.deepEqual(pullRequestAction("ready", "example/project", "7", "a", cloud), [
      "api",
      "-X",
      "POST",
      "repos/example/project/pulls/7/ccr/ready_for_review",
    ]);
    assert.deepEqual(pullRequestAction("enable-auto", "example/project", "7", "a", {}), [
      "pr",
      "merge",
      "7",
      "--repo",
      "example/project",
      "--auto",
      "--squash",
      "--match-head-commit",
      "a",
    ]);
    assert.deepEqual(pullRequestAction("disable-auto", "example/project", "7", "a", {}), [
      "pr",
      "merge",
      "7",
      "--disable-auto",
      "--repo",
      "example/project",
    ]);
  });

  it("attende i controlli in corso e conta solo l'ultima esecuzione di ognuno", () => {
    const check = (id, name, status, conclusion) => ({ id, name, status, conclusion });
    assert.equal(
      checksOutcome([check(1, "a", "completed", "success"), check(2, "b", "completed", "skipped")]),
      "passed",
    );
    assert.equal(
      checksOutcome([
        check(1, "a", "completed", "success"),
        check(2, "Coordinatore", "in_progress", null),
      ]),
      "passed",
    );
    assert.equal(
      checksOutcome([check(1, "a", "completed", "success"), check(2, "b", "in_progress", null)]),
      "pending",
    );
    assert.equal(
      checksOutcome([check(1, "a", "in_progress", null), check(2, "b", "completed", "failure")]),
      "failed",
    );
    assert.equal(
      checksOutcome([
        check(3, "Node 26", "completed", "success"),
        check(2, "Node 26", "completed", "cancelled"),
      ]),
      "passed",
    );
  });
});

describe("comandi del ciclo", () => {
  it("gli entrypoint con SHA diverso si fermano prima di merge, push o dispatch", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "cycle-cli-"));
    try {
      cpSync("scripts", path.join(directory, "scripts"), { recursive: true });
      // Gli script leggono il changelog con i frammenti tramite il modulo dell'app.
      mkdirSync(path.join(directory, "app"));
      cpSync("app/changelog-fragments.mjs", path.join(directory, "app/changelog-fragments.mjs"));
      const git = (...args) => {
        const result = spawnSync("git", args, { cwd: directory, encoding: "utf8" });
        assert.equal(result.status, 0, result.stderr);
      };
      git("init", "-q");
      git("add", ".");
      git(
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@example.invalid",
        "commit",
        "-qm",
        "fixture",
      );
      const bin = path.join(directory, ".git/bin");
      mkdirSync(bin);
      const log = path.join(directory, ".git/commands");
      writeFileSync(
        path.join(bin, "gh"),
        `#!${process.execPath}\nconst fs=require('node:fs');
const args=process.argv.slice(2);fs.appendFileSync(process.env.CYCLE_LOG,JSON.stringify(args)+'\\n');
const url=args[1];let result;
if(url==='repos/{owner}/{repo}') result={full_name:'example/project'};
else if(url.includes('/git/ref/heads/')) result={object:{sha:'${"b".repeat(40)}'}};
else if(url.includes('/compare/')) result={status:'diverged'};
else if(url==='repos/example/project/pulls/12') result={state:'open',draft:false,head:{ref:'feature',sha:'${"b".repeat(40)}',repo:{full_name:'example/project'}},base:{ref:'develop',sha:'${"c".repeat(40)}'}};
else throw new Error('Unexpected GitHub operation '+args.join(' '));
process.stdout.write(JSON.stringify(result));`,
        { mode: 0o700 },
      );
      for (const args of [["promote"], ["pr", "12"], ["rollback"]]) {
        writeFileSync(log, "");
        const result = spawnSync(
          process.execPath,
          ["scripts/release/release-cycle.mjs", ...args, "--sha", "a".repeat(40)],
          {
            cwd: directory,
            encoding: "utf8",
            timeout: 10_000,
            env: {
              ...process.env,
              PATH: `${bin}${path.delimiter}${process.env.PATH}`,
              GITHUB_ACTIONS: "true",
              CYCLE_LOG: log,
            },
          },
        );
        assert.equal(result.status, 1, result.stderr);
        assert.match(result.stderr, /base della PR è avanzata|non contiene il commit autorizzato/u);
        const calls = readFileSync(log, "utf8")
          .trim()
          .split("\n")
          .map((line) => JSON.parse(line));
        assert.ok(calls.every((call) => call[0] === "api" && !call.includes("-X")));
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it("accetta soltanto i comandi noti e blocca per oggetto", () => {
    assert.deepEqual(cycleCommand(["pr", "12"]), { command: "pr", number: "12" });
    assert.deepEqual(cycleCommand(["cleanup"]), { command: "cleanup", number: undefined });
    for (const positionals of [[], ["deploy"], ["toString"]])
      assert.throws(() => cycleCommand(positionals), /^Error: Uso: release:cycle/u);
    assert.equal(lockObject("pr", "12"), "pr-12");
    assert.equal(lockObject("resume", "34"), "run-34");
    assert.equal(lockObject("promote", undefined), "promote");
    // Pubblica in Production blocca la PR come il suo ciclo.
    assert.deepEqual(cycleCommand(["production", "12"]), { command: "production", number: "12" });
    assert.equal(lockObject("production", "12"), "pr-12");
    for (const command of ["rc", "promotion-source"])
      assert.throws(() => cycleCommand([command]), /^Error: Uso: release:cycle/u);
  });

  it("controlla dalla CLI la base della PR rispetto a quella attuale di origin", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "qualification-cli-"));
    const upstream = path.join(directory, "upstream");
    const clone = path.join(directory, "clone");
    const git = (cwd, ...args) =>
      (spawnSync("git", args, { cwd, encoding: "utf8" }).stdout ?? "").trim();
    const commit = (cwd, file, text) => {
      writeFileSync(path.join(cwd, file), text);
      git(cwd, "add", "--all");
      git(cwd, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "--quiet", "-m", file);
      return git(cwd, "rev-parse", "HEAD");
    };
    const check = (base, head) =>
      spawnSync(
        process.execPath,
        [
          new URL("./release-cycle.mjs", import.meta.url).pathname,
          "qualification-base",
          "--base",
          base,
          "--head",
          head,
        ],
        { cwd: clone, encoding: "utf8" },
      );
    try {
      mkdirSync(upstream);
      git(upstream, "init", "--quiet", "--initial-branch", "develop");
      const tested = commit(upstream, "a.ts", "a\n");
      git(directory, "clone", "--quiet", upstream, clone);
      git(clone, "switch", "--quiet", "-c", "feature");
      const head = commit(clone, "b.ts", "b\n");
      assert.equal(check(tested, head).status, 0);
      commit(upstream, "b.ts", "b2\n");
      const advanced = check(tested, head);
      assert.equal(advanced.status, 1);
      assert.match(advanced.stderr, /file comuni/u);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("rifiuta un comando sconosciuto prima di leggere il repository", () => {
    const result = spawnSync(
      process.execPath,
      [new URL("./release-cycle.mjs", import.meta.url).pathname, "deploy"],
      { encoding: "utf8", env: { ...process.env, PATH: "" } },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Uso: release:cycle status <run>/u);
  });

  it("gestisce soltanto feature branch dello stesso repository verso develop", () => {
    const pr = {
      state: "OPEN",
      baseRefName: "develop",
      headRefName: "feature",
      headRepository: { nameWithOwner: "example/project" },
    };
    assert.doesNotThrow(() => assertCyclePullRequest(pr, "example/project"));
    assert.doesNotThrow(() =>
      assertCyclePullRequest({ ...pr, state: "MERGED" }, "example/project"),
    );
    assert.throws(
      () => assertCyclePullRequest({ ...pr, baseRefName: "main" }, "example/project"),
      /verso develop/u,
    );
    assert.throws(
      () => assertCyclePullRequest({ ...pr, headRepository: null }, "example/project"),
      /stesso repository/u,
    );
    assert.throws(
      () => assertCyclePullRequest({ ...pr, headRefName: "main" }, "example/project"),
      /feature branch/u,
    );
    assert.throws(
      () => assertCyclePullRequest({ ...pr, state: "CLOSED" }, "example/project"),
      /chiusa senza merge/u,
    );
  });

  it("ripete il Verify soltanto se è fallito al controllo delle migration", () => {
    const read = [];
    const jobs = (conclusion) => (id) => {
      read.push(id);
      return [
        { steps: [{ name: "Install", conclusion: "success" }] },
        { steps: [{ name: "Check migration review", conclusion }] },
      ];
    };
    assert.equal(migrationReviewBlocked(undefined, jobs("failure")), false);
    assert.equal(
      migrationReviewBlocked({ databaseId: 1, conclusion: "success" }, jobs("failure")),
      false,
    );
    // I job si leggono soltanto per una run fallita.
    assert.deepEqual(read, []);
    assert.equal(
      migrationReviewBlocked({ databaseId: 2, conclusion: "failure" }, jobs("failure")),
      true,
    );
    assert.equal(
      migrationReviewBlocked({ databaseId: 3, conclusion: "failure" }, jobs("success")),
      false,
    );
    assert.deepEqual(read, [2, 3]);
  });

  it("riqualifica soltanto con la base avanzata su file comuni, fino al terzo giro", () => {
    let evaluated = 0;
    const compatible = (value) => () => {
      evaluated++;
      return value;
    };
    assert.equal(retryQualification(1, compatible(false)), true);
    assert.equal(retryQualification(2, compatible(true)), false);
    // Al terzo tentativo l'errore si propaga senza rileggere la base.
    assert.equal(retryQualification(3, compatible(false)), false);
    assert.equal(evaluated, 2);
    assert.equal(mergeDecision(1, true), "merge");
    assert.equal(mergeDecision(3, true), "merge");
    assert.equal(mergeDecision(2, false), "requalify");
    assert.throws(() => mergeDecision(3, false), /Base avanzata più volte/u);
  });

  it("riprende soltanto le run del ciclo e riconosce l'ambiente distribuito", () => {
    const run = { path: ".github/workflows/ci.yml", head_branch: "develop", event: "push" };
    assert.doesNotThrow(() => assertResumableRun(run));
    assert.doesNotThrow(() =>
      assertResumableRun({
        ...run,
        path: ".github/workflows/publish.yml",
        event: "workflow_dispatch",
      }),
    );
    assert.doesNotThrow(() =>
      assertResumableRun({ ...run, path: ".github/workflows/candidate.yml" }),
    );
    for (const other of [
      { path: ".github/workflows/qualify.yml" },
      { head_branch: "feature" },
      { event: "pull_request" },
    ])
      assert.throws(() => assertResumableRun({ ...run, ...other }), /fuori dal ciclo/u);
    const job = (name, conclusion) => ({ name, conclusion });
    assert.equal(deployedEnvironment(run, [job("Deploy test", "success")]), "test");
    assert.equal(deployedEnvironment(run, [job("Deploy test", "skipped")]), null);
    assert.equal(deployedEnvironment(run, [job("Distribuisci e verifica", "success")]), null);
    assert.equal(
      deployedEnvironment({ ...run, path: ".github/workflows/candidate.yml" }, []),
      null,
    );
    const publish = { ...run, path: ".github/workflows/publish.yml" };
    assert.equal(
      deployedEnvironment(publish, [job("Distribuisci e verifica", "success")]),
      "production",
    );
  });

  it("non ripete il dispatch di una pubblicazione già presente", () => {
    const existing = { databaseId: 9, status: "completed", conclusion: "success" };
    const jobs = (conclusion) => [{ name: "Distribuisci e verifica", conclusion }];
    assert.doesNotThrow(() => existingPublication(existing, jobs("success")));
    for (const [run, list] of [
      [{ ...existing, status: "in_progress" }, jobs("success")],
      [{ ...existing, conclusion: "failure" }, jobs("skipped")],
      [existing, jobs("failure")],
      [existing, []],
    ])
      assert.throws(
        () => existingPublication(run, list),
        /release:cycle resume 9, senza un nuovo dispatch/u,
      );
  });

  it("ricava il digest del lotto dalle approvazioni delle PR", () => {
    const entry = (name, sql) => ({ name, digest: name, sql });
    const safe = entry("0070_a.sql", "CREATE TABLE a (id TEXT);");
    const first = entry("0071_b.sql", "DROP TABLE b;");
    const second = entry("0072_c.sql", "UPDATE c SET a = 1;");
    const added = [safe, first, second];
    const lot = requiredReview(added).digest;
    const approval = (migrations) => `reviewed-migrations: ${requiredReview(migrations).digest}\n`;
    const commits = [
      { added: [safe], body: "" },
      { added: [first], body: approval([first]) },
      { added: [second], body: approval([second]) },
    ];
    assert.equal(lotReview([safe], [{ added: [safe], body: "" }]), "");
    assert.equal(lotReview(added, commits), lot);
    assert.throws(
      () => lotReview(added, commits.slice(0, 2)),
      new RegExp(`0072_c\\.sql.*--reviewed-migrations ${lot}`, "u"),
    );
    // Una PR con il digest di un'altra versione della migration non vale come approvazione.
    assert.throws(
      () =>
        lotReview(added, [commits[0], { added: [first], body: approval([second]) }, commits[2]]),
      /0071_b\.sql/u,
    );
    assert.equal(lotReview(added, [], lot), lot);
    assert.throws(() => lotReview(added, [], "b".repeat(64)), /Migration da approvare/u);
  });

  it("promuove la versione in cima al changelog, nuova di un passo o già pubblicata", () => {
    const changelog =
      "# Changelog\n\n## [2.0.2]\n\n- Voce.\n\n## [2.0.1] - 2026-11-01\n\n- Prima.\n";
    assert.doesNotThrow(() => assertPromotable(changelog, "2.0.2", ["v2.0.1"]));
    assert.doesNotThrow(() => assertPromotable(changelog, "2.0.2", ["v2.0.2", "v2.0.1"]));
    assert.throws(() => assertPromotable(changelog, "2.0.3", ["v2.0.1"]), /non la 2\.0\.3/u);
    assert.throws(() => assertPromotable(changelog, "2.0.2", ["v2.0.0"]), /non è un passo/u);
    assert.throws(() => assertPromotable("## [2.0.2]\n", "2.0.2", ["v2.0.1"]), /vuota/u);
  });

  it("misura durata e riuscita al primo tentativo delle pubblicazioni", () => {
    const run = (conclusion, run_attempt, minutes) => ({
      head_sha: "a".repeat(40),
      conclusion,
      run_attempt,
      created_at: "2026-11-02T10:00:00Z",
      updated_at: new Date(Date.parse("2026-11-02T10:00:00Z") + minutes * 60_000).toISOString(),
    });
    const metrics = promotionMetrics([
      run("success", 1, 12),
      run("failure", 1, 30),
      run("success", 2, 40),
      run("success", 1, 14),
    ]);
    assert.deepEqual(
      [
        metrics.runs,
        metrics.successfulRuns,
        metrics.published,
        metrics.firstAttempt,
        metrics.medianRunMinutes,
      ],
      [4, 3, 0, 0, 14],
    );
    assert.equal(metrics.rows[0].day, "2026-11-02");
    assert.equal(promotionMetrics([]).medianRunMinutes, null);
  });

  it("lega il comando alla run del ciclo con il titolo", () => {
    assert.equal(coordinatorTitle("pr", "12", "a".repeat(40)), `Ciclo pr 12 ${"a".repeat(40)}`);
    const workflow = readFileSync(".github/workflows/cycle.yml", "utf8");
    assert.match(
      workflow,
      /run-name: Ciclo \$\{\{ inputs\.operation \}\} \$\{\{ inputs\.object \}\}/u,
    );
  });

  it("qualifica dopo ogni merge verde e forza la campagna settimanale", () => {
    const base = { passed: true, certified: false };
    assert.equal(candidateReadiness(base), true);
    assert.equal(candidateReadiness({ ...base, passed: false }), false);
    assert.equal(candidateReadiness({ ...base, qualifying: true }), false);
    assert.equal(candidateReadiness({ ...base, certified: true }), false);
    assert.equal(candidateReadiness({ ...base, weekly: true, certified: true }), true);
    assert.equal(candidateReadiness({ ...base, passed: false, weekly: true }), false);
    assert.equal(candidateReadiness({ ...base, manual: true }), true);
  });

  it("misura le fasi, le nuove run sullo stesso candidato e i falsi verdi", () => {
    const at = (minutes) =>
      new Date(Date.parse("2026-11-02T10:00:00Z") + minutes * 60_000).toISOString();
    const runs = [
      {
        id: 2,
        head_sha: "a".repeat(40),
        conclusion: "success",
        run_attempt: 1,
        created_at: at(0),
        updated_at: at(30),
      },
      {
        id: 1,
        head_sha: "a".repeat(40),
        conclusion: "failure",
        run_attempt: 1,
        created_at: at(0),
        updated_at: at(10),
      },
    ];
    const receipt = {
      run: 2,
      requestedAt: at(0),
      certifiedAt: at(2),
      activatedAt: at(10),
      completedAt: at(27),
      candidateActive: false,
      rolledBack: true,
    };
    const metrics = promotionMetrics(runs, [receipt]);
    assert.equal(metrics.firstAttempt, 0);
    assert.equal(metrics.falseGreen, 1);
    assert.equal(metrics.published, 0);
    assert.equal(metrics.rows[0].activationSeconds, 600);
    assert.equal(metrics.rows[0].completionSeconds, 1020);
    const active = {
      ...receipt,
      active: { version: "provider-version" },
      candidateActive: true,
      rolledBack: false,
    };
    assert.equal(promotionMetrics(runs, [active]).published, 1);
    assert.equal(promotionMetrics(runs, [{ ...active, completedAt: undefined }]).published, 0);
  });
});

describe("pubblicazioni in parallelo", () => {
  /** Blocco in memoria con la stessa interfaccia di `remoteLockStore`. */
  const memoryStore = () => {
    let held = null;
    let count = 0;
    return {
      get held() {
        return held;
      },
      read: async () => held,
      create: async (entry) => {
        if (held) return false;
        held = { sha: `s${++count}`, ...entry };
        return true;
      },
      remove: async (sha) => {
        if (held?.sha === sha) held = null;
      },
    };
  };

  it("mette in fila i merge di cicli diversi e rilascia il blocco anche dopo un errore", async () => {
    const store = memoryStore();
    const order = [];
    let release;
    const first = withRemoteLock(
      store,
      () =>
        new Promise((resolve) => {
          order.push("primo");
          release = resolve;
        }),
      { owner: "a", delay: 1 },
    );
    await new Promise((resolve) => setImmediate(resolve));
    const second = withRemoteLock(store, async () => order.push("secondo"), {
      owner: "b",
      delay: 1,
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.deepEqual(order, ["primo"]);
    release();
    await Promise.all([first, second]);
    assert.deepEqual(order, ["primo", "secondo"]);
    assert.equal(store.held, null);
    await assert.rejects(
      withRemoteLock(
        store,
        async () => {
          throw new Error("merge fallito");
        },
        { owner: "c" },
      ),
      /merge fallito/u,
    );
    assert.equal(store.held, null);
  });

  it("rimuove un blocco scaduto, riconosce il proprio e non toglie quello di un altro", async () => {
    const store = memoryStore();
    await store.create({ owner: "vecchio", at: "2026-11-04T07:30:00.000Z" });
    const now = () => Date.parse("2026-11-04T09:00:00.000Z");
    assert.equal(
      await withRemoteLock(store, async () => "fatto", { owner: "nuovo", now }),
      "fatto",
    );
    assert.equal(store.held, null);
    // Una risposta persa dopo la creazione: il titolare ritrova il proprio blocco.
    await store.create({ owner: "io", at: new Date(now()).toISOString() });
    assert.equal(
      await withRemoteLock(store, async () => "ripreso", { owner: "io", now }),
      "ripreso",
    );
    // Durante il lavoro un altro ha preso il blocco scaduto: il titolare non lo toglie.
    await withRemoteLock(
      store,
      async () => {
        await store.remove(store.held.sha);
        await store.create({ owner: "altro", at: new Date(now()).toISOString() });
      },
      { owner: "io", now },
    );
    assert.equal(store.held.owner, "altro");
  });

  it("usa un riferimento Git creato una sola volta come blocco", () => {
    const calls = [];
    let ref = null;
    const run = (...args) => {
      calls.push(args);
      const url = args.find((arg) => arg.startsWith("repos/"));
      const error = (status) =>
        Object.assign(new Error(`HTTP ${status}`), { stderr: `gh: HTTP ${status}` });
      if (args.includes("POST") && url.endsWith("/git/commits"))
        return JSON.stringify({ sha: "c1" });
      if (args.includes("POST") && url.endsWith("/git/refs")) {
        if (ref) throw Object.assign(error(422), { stderr: "Reference already exists (HTTP 422)" });
        ref = "c1";
        return "{}";
      }
      if (url.endsWith("/git/ref/locks/merge")) {
        if (!ref) throw error(404);
        return JSON.stringify({ object: { sha: ref } });
      }
      if (url.endsWith("/git/ref/heads/develop")) return JSON.stringify({ object: { sha: "d1" } });
      if (url.endsWith("/git/commits/d1")) return JSON.stringify({ tree: { sha: "t1" } });
      if (url.endsWith("/git/commits/c1"))
        return JSON.stringify({
          message: JSON.stringify({ owner: "a", at: "2026-11-04T09:00:00Z" }),
        });
      throw new Error(`Chiamata inattesa ${args.join(" ")}`);
    };
    const pushes = [];
    // La rimozione è un push con lease: riesce soltanto se il riferimento è ancora quello letto.
    const push = (...args) => {
      pushes.push(args);
      if (ref !== args[0].split(":").at(-1))
        throw Object.assign(new Error("rejected"), { stderr: "! [rejected] (stale info)" });
      ref = null;
      return "";
    };
    const store = remoteLockStore("example/project", "merge", run, push);
    assert.equal(store.read(), null);
    assert.equal(store.create({ owner: "a", at: "2026-11-04T09:00:00Z" }), true);
    assert.equal(store.create({ owner: "b", at: "2026-11-04T09:00:00Z" }), false);
    assert.deepEqual(store.read(), { sha: "c1", owner: "a", at: "2026-11-04T09:00:00Z" });
    // Si rimuove soltanto il riferimento letto.
    store.remove("altro");
    assert.notEqual(store.read(), null);
    store.remove("c1");
    assert.equal(store.read(), null);
    assert.ok(calls.some((args) => args.includes("ref=refs/locks/merge")));
    assert.deepEqual(pushes.at(-1), [
      "--force-with-lease=refs/locks/merge:c1",
      "https://github.com/example/project.git",
      ":refs/locks/merge",
    ]);
  });

  it("promuove il commit certificato più recente, anche con la versione richiesta", () => {
    const commits = [
      { sha: "c3", tree: "t3" },
      { sha: "c2", tree: "t2" },
      { sha: "c1", tree: "t1" },
    ];
    const certified = (tree) => ["t2", "t1"].includes(tree);
    assert.deepEqual(promotionTarget(commits, certified), { sha: "c2", later: 1, certified: true });
    const versions = { c3: "2.0.4", c2: "2.0.3", c1: "2.0.3" };
    assert.deepEqual(
      promotionTarget(
        commits,
        () => true,
        "2.0.3",
        (sha) => versions[sha],
      ),
      { sha: "c2", later: 1, certified: true },
    );
    // Senza un commit certificato si promuove la testa, dopo la sua qualifica.
    assert.deepEqual(
      promotionTarget(commits, () => false),
      {
        sha: "c3",
        later: 0,
        certified: false,
      },
    );
  });

  it("promuove il commit integrato di Pubblica in Production", () => {
    const pr = { state: "MERGED", baseRefName: "develop", mergeCommit: { oid: "m1" } };
    assert.equal(mergedCommit(pr), "m1");
    for (const other of [{ state: "OPEN", mergeCommit: null }, { baseRefName: "main" }])
      assert.throws(() => mergedCommit({ ...pr, ...other }), /non integrata/u);
  });

  it("riprende il test senza aspettare Production e si ferma su una ricevuta ritirata", () => {
    const ci = { path: ".github/workflows/ci.yml" };
    const publish = { path: ".github/workflows/publish.yml" };
    const candidate = { path: ".github/workflows/candidate.yml" };
    assert.deepEqual([ci, publish, candidate].map(resumeEnvironment), [
      "test",
      "production",
      "test",
    ]);
    assert.deepEqual([ci, publish, candidate].map(receiptPrefix), [
      "deployed",
      "release-receipt",
      null,
    ]);
    assert.doesNotThrow(() => assertNotWithdrawn(null));
    assert.doesNotThrow(() => assertNotWithdrawn({ rolledBack: false }));
    assert.throws(() => assertNotWithdrawn({ rolledBack: true }), /Candidato ritirato/u);
    const workflow = readFileSync(".github/workflows/cycle.yml", "utf8");
    assert.match(workflow, /format\('pr-\{0\}', inputs\.object\)/u);
    assert.match(workflow, /inputs\.environment == 'test' && format\('run-\{0\}'/u);
  });

  it("non aspetta i coordinatori di altri cicli sulla stessa testa", () => {
    const check = (id, name, status, conclusion) => ({ id, name, status, conclusion });
    assert.equal(
      checksOutcome([
        check(1, "Node 26", "completed", "success"),
        check(2, "Coordinatore PR", "in_progress", null),
        check(3, "Coordinatore promozione", "queued", null),
      ]),
      "passed",
    );
  });

  it("misura coda, browser, mutation e minuti di runner della qualifica", () => {
    const job = (name, start, end, conclusion = "success") => ({
      name,
      conclusion,
      started_at: `2026-11-04T10:${String(start).padStart(2, "0")}:00Z`,
      completed_at: `2026-11-04T10:${String(end).padStart(2, "0")}:00Z`,
    });
    assert.deepEqual(
      candidatePhases([
        job("Pianifica", 0, 2),
        job("Qualifica candidato / select", 12, 13),
        job("Qualifica candidato / browser (source, 1)", 13, 25),
        job("Qualifica candidato / browser (source, 2)", 14, 24),
        job("Qualifica candidato / Mutation / Select modules", 13, 14),
        job("Qualifica candidato / Mutation / app/auth.server.ts 1/2", 14, 40),
        job("Qualifica candidato / Mutation / app/auth.server.ts 2/2", 15, 30),
        job("Qualifica candidato / production", 0, 0, "skipped"),
      ]),
      { queueSeconds: 600, browserSeconds: 720, mutationSeconds: 1560, runnerMinutes: 67 },
    );
    assert.deepEqual(candidatePhases([job("Pianifica", 0, 2)]), {
      queueSeconds: null,
      browserSeconds: null,
      mutationSeconds: null,
      runnerMinutes: 2,
    });
  });

  it("rinumera le decisioni nuove già prese sulla base da un'altra PR", () => {
    const diff =
      "+| D295 | Ambito | Sintesi |\n+| D296 | a | b |\n-| D010 | x | y |\n+| D010 | x | Superato |\n+testo D295\n";
    // Una riga esistente modificata non è una decisione nuova.
    assert.deepEqual(addedDecisions(diff, ["D010"]), ["D295", "D296"]);
    assert.deepEqual(addedDecisions(diff), ["D295", "D296", "D010"]);
    const mapping = decisionRenumbering(["D295", "D296"], ["D294", "D295"]);
    assert.deepEqual(mapping, { D295: "D297" });
    assert.deepEqual(decisionRenumbering(["D296"], ["D294", "D295"]), {});
    assert.equal(
      renumberDecisions("[D295](x) e D2950, D295.", mapping),
      "[D297](x) e D2950, D297.",
    );
    // Soltanto nelle righe aggiunte dalla PR: le altre citano la D295 dell'altra PR.
    const lines = addedLineNumbers("@@ -1,0 +2,1 @@\n+nuova D295\n@@ -5 +6,2 @@\n-x\n+a\n+b\n");
    assert.deepEqual([...lines], [2, 6, 7]);
    assert.equal(
      renumberDecisions("D295 altrui\nnuova D295\nD295", mapping, new Set([2])),
      "D295 altrui\nnuova D297\nD295",
    );
  });
});
