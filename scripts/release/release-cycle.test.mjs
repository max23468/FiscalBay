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
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
  assertBase,
  assertQualificationBase,
  independentBase,
  waitUpdatedHead,
  expectedRun,
  candidateRef,
  runTimings,
  checkCycleJobs,
  readbackSuperseded,
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
  deployedEnvironment,
  existingCandidate,
  identifyCandidate,
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

  it("ammette develop soltanto per la qualifica senza deploy", () => {
    assert.equal(candidateRef("candidate", "develop"), "develop");
    assert.equal(candidateRef("candidate"), "main");
    assert.equal(candidateRef("production"), "main");
    assert.throws(() => candidateRef("production", "develop"), /Production richiede main/u);
    assert.throws(() => candidateRef("candidate", "feature"), /sola prova/u);
    const workflow = readFileSync(".github/workflows/publish.yml", "utf8");
    assert.match(workflow, /!inputs\.prova && github\.ref == 'refs\/heads\/main'/u);
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
        [path.resolve("scripts/release/release-cycle.mjs"), "pr", "123"],
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
        workflow_run: { id: 123, repository_id: 1, head_repository_id: 1 },
      };
      const cycleJobs = {
        jobs: [
          { name: "Distribuisci e verifica", conclusion: "skipped" },
          { name: "Qualifica candidato / Candidate qualified", conclusion: "success" },
        ],
      };
      const candidateGh = `#!${process.execPath}\nconst fs=require("node:fs");const a=process.argv.slice(2);fs.appendFileSync(process.env.CYCLE_CALLS,JSON.stringify(a)+"\\n");let value;if(a[1]==="repos/{owner}/{repo}")value={full_name:"example/project"};else if(a[0]==="run")value=[{databaseId:124,headSha:${JSON.stringify(sha)},status:"completed",conclusion:"success"}];else if(a[0]==="workflow")process.exit(99);else if(a.includes("--slurp"))value=a.at(-1).includes("/attempts/")?${JSON.stringify([jobs])}:${JSON.stringify([cycleJobs])};else if(a[1].includes("git/ref/")){console.log(${JSON.stringify(sha)});process.exit(0);}else if(a[1].includes("git/commits/"))value={tree:{sha:${JSON.stringify(tree)}}};else if(a[1].includes("/artifacts?"))value={artifacts:[{...${JSON.stringify(proof)},expired:process.env.CANDIDATE_EXPIRED==="1"}]};else if(a[1].includes("/actions/runs/"))value={...${JSON.stringify(run)},path:".github/workflows/publish.yml"};else value={id:1};console.log(JSON.stringify(value));\n`;
      writeFileSync(path.join(directory, "gh"), candidateGh, { mode: 0o700 });
      writeFileSync(calls, "");
      const candidate = (expired) =>
        spawnSync(
          process.execPath,
          [path.resolve("scripts/release/release-cycle.mjs"), "candidate", "--sha", sha],
          {
            encoding: "utf8",
            cwd: checkout,
            env: { ...env, CANDIDATE_EXPIRED: expired ? "1" : "0" },
          },
        );
      const reused = candidate(false);
      assert.equal(reused.status, 0, reused.stderr);
      assert.match(reused.stdout, /nessun nuovo dispatch/u);
      assert.equal(readFileSync(calls, "utf8").includes('"workflow"'), false);
      assert.equal(candidate(true).status, 1);
      assert.ok(readFileSync(calls, "utf8").includes('"workflow","run","publish.yml"'));
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

  it("ammette verso develop una base attuale compatibile, verso main soltanto quella provata", () => {
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
      assert.doesNotThrow(() => assertQualificationBase("develop", tested, tested, head, run));
      assert.doesNotThrow(() => assertQualificationBase("develop", tested, disjoint, head, run));
      assert.throws(
        () => assertQualificationBase("develop", tested, disjoint, overlap, run),
        /file comuni/u,
      );
      assert.doesNotThrow(() => assertQualificationBase("develop", disjoint, shared, head, run));
      assert.throws(() => assertQualificationBase("develop", "", tested, head, run), /base/u);
      assert.throws(() => assertQualificationBase("main", tested, disjoint, head, run), /base/u);
      assert.throws(() => assertQualificationBase("main", disjoint, disjoint, head, run), /base/u);
      assert.doesNotThrow(() => assertQualificationBase("main", tested, tested, head, run));
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

  /** Job di una run di `develop`: gate, browser e deploy test con l'esito dei suoi passi. */
  const developJobs = (readback, overrides = {}) => [
    { name: "Node 26", conclusion: "success" },
    { name: "Browser 1/8", conclusion: "success" },
    {
      name: "Deploy test",
      conclusion: readback === "success" ? "success" : "failure",
      steps: [
        { name: "Deploy verified artifact", conclusion: "success" },
        { name: "Check deployed browser interactions", conclusion: "success" },
        { name: "Check deployed pages", conclusion: "success" },
        { name: "Roll back test deploy", conclusion: "skipped" },
        { name: "Confirm provider readback", conclusion: readback },
        ...(overrides.steps ?? []),
      ].map((step) => ({ ...step, ...overrides[step.name] })),
    },
  ];

  it("riconosce un readback superato da un merge successivo e nessun altro fallimento", () => {
    assert.equal(readbackSuperseded(developJobs("failure")), true);
    assert.equal(readbackSuperseded(developJobs("success")), false);
    for (const name of [
      "Deploy verified artifact",
      "Check deployed browser interactions",
      "Check deployed pages",
    ])
      assert.equal(
        readbackSuperseded(developJobs("failure", { [name]: { conclusion: "failure" } })),
        false,
        name,
      );
    // Un rollback eseguito o un altro job fallito non sono un readback superato.
    assert.equal(
      readbackSuperseded(
        developJobs("failure", { "Roll back test deploy": { conclusion: "success" } }),
      ),
      false,
    );
    const [gate, ...rest] = developJobs("failure");
    assert.equal(readbackSuperseded([{ ...gate, conclusion: "failure" }, ...rest]), false);
    assert.equal(readbackSuperseded([gate]), false);
  });

  it("chiude il ciclo con la run della nuova testa che contiene il merge e ne conferma il deploy", async () => {
    const merge = "a".repeat(40);
    const later = "b".repeat(40);
    const runs = {
      [merge]: { id: 1, head_sha: merge, conclusion: "failure", jobs: developJobs("failure") },
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
        jobs: developJobs("success", {
          "Check deployed pages": { conclusion: "failure" },
        }),
      };
      await assert.rejects(settleMergeRun(merge, false, io()), /Run 2/u);
      // Un altro fallimento della run del merge non segue nessuna run successiva.
      runs[merge] = {
        ...runs[merge],
        jobs: developJobs("failure", {
          "Check deployed pages": { conclusion: "failure" },
        }),
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

  it("segue al più tre merge successivi", async () => {
    const shas = ["1", "2", "3", "4", "5"].map((digit) => digit.repeat(40));
    let current = 0;
    const io = {
      wait: async (sha) => ({
        id: shas.indexOf(sha) + 1,
        head_sha: sha,
        conclusion: "failure",
        jobs: developJobs("failure"),
      }),
      jobs: (run) => run.jobs,
      head: () => shas[++current],
      contains: () => true,
    };
    const log = console.log;
    console.log = () => {};
    try {
      await assert.rejects(settleMergeRun(shas[0], true, io), /Run 4/u);
      assert.equal(current, 3);
    } finally {
      console.log = log;
    }
  });

  it("legge la conferma Production dal passo che precede il tag", () => {
    const job = (conclusion) => ({
      name: "Distribuisci e verifica",
      conclusion: "success",
      steps: [{ name: "Create immutable tag and release", conclusion }],
    });
    assert.doesNotThrow(() => assertConfirmed([job("success")], "production"));
    assert.throws(() => assertConfirmed([job("failure")], "production"), /production/u);
    assert.throws(() => assertConfirmed([job("success")], "test"), /test/u);
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
  it("accetta soltanto i comandi noti e blocca per oggetto", () => {
    assert.deepEqual(cycleCommand(["pr", "12"]), { command: "pr", number: "12" });
    assert.deepEqual(cycleCommand(["cleanup"]), { command: "cleanup", number: undefined });
    for (const positionals of [[], ["deploy"], ["toString"]])
      assert.throws(() => cycleCommand(positionals), /^Error: Uso: release:cycle/u);
    assert.equal(lockObject("pr", "12"), "pr-12");
    assert.equal(lockObject("resume", "34"), "run-34");
    assert.equal(lockObject("production", undefined), "production");
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
    const check = (ref, base, head) =>
      spawnSync(
        process.execPath,
        [
          new URL("./release-cycle.mjs", import.meta.url).pathname,
          "qualification-base",
          "--ref",
          ref,
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
      assert.equal(check("develop", tested, head).status, 0);
      commit(upstream, "b.ts", "b2\n");
      const advanced = check("develop", tested, head);
      assert.equal(advanced.status, 1);
      assert.match(advanced.stderr, /file comuni/u);
      assert.match(check("legacy/1.x", tested, head).stderr, /--ref develop o main/u);
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
      () => assertCyclePullRequest({ ...pr, headRefName: "legacy/1.x" }, "example/project"),
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
    const publish = { ...run, path: ".github/workflows/publish.yml" };
    assert.equal(
      deployedEnvironment(publish, [job("Distribuisci e verifica", "success")]),
      "production",
    );
  });

  it("non ripete il dispatch di un candidato già presente", () => {
    const existing = { databaseId: 9, status: "completed", conclusion: "success" };
    const jobs = (conclusion) => [{ name: "Distribuisci e verifica", conclusion }];
    assert.equal(existingCandidate("production", existing, jobs("success")), "published");
    assert.equal(existingCandidate("production", existing, jobs("skipped")), "qualified");
    assert.equal(existingCandidate("candidate", existing, jobs("success")), "qualified");
    assert.equal(existingCandidate("candidate", existing, jobs("skipped")), "qualified");
    for (const [run, list] of [
      [{ ...existing, status: "in_progress" }, jobs("success")],
      [{ ...existing, conclusion: "failure" }, jobs("skipped")],
      [existing, jobs("failure")],
      [existing, []],
    ])
      assert.throws(
        () => existingCandidate("candidate", run, list),
        /release:cycle resume 9, senza un nuovo dispatch/u,
      );
  });

  describe("identità della release candidate", () => {
    const deployed = {
      run: { id: 7, run_attempt: 1, head_sha: "deploy", html_url: "https://example.invalid/run/7" },
      jobs: [
        { name: "Node 26", conclusion: "success" },
        {
          name: "Deploy test",
          conclusion: "success",
          steps: [{ name: "Confirm provider readback", conclusion: "success" }],
        },
      ],
    };
    const receipt = {
      sha: "deploy",
      tree: "deploy-tree",
      digest: "artifact",
      version: "worker-v1",
      readback: true,
      schema: [{ name: "0001_init.sql" }, { name: "0002_orders.sql" }],
    };
    // Testa con soli documenti dopo il deploy, che contiene anche la sezione della RC.
    const io = (overrides = {}) => ({
      head: () => "head",
      changelog: () => "## [2.0.0-rc.1]\n\nRC.\n",
      introduced: () => "deploy",
      needsDeploy: () => false,
      lastDeploy: () => deployed,
      receipt: () => receipt,
      liveVersion: async () => "worker-v1",
      tree: () => "head-tree",
      certified: () => true,
      config: () => "config-hash",
      ...overrides,
    });

    it("lega versione, testa, artefatto distribuito, schema e configurazione", async () => {
      assert.deepEqual(await identifyCandidate(io()), {
        version: "2.0.0-rc.1",
        commit: "head",
        tree: "head-tree",
        deployedCommit: "deploy",
        artifact: "artifact",
        workerVersion: "worker-v1",
        run: "https://example.invalid/run/7",
        migrations: 2,
        lastMigration: "0002_orders.sql",
        config: "config-hash",
        qualified: true,
      });
      // La qualifica completa assente si riporta, senza rifiutare l'identità.
      assert.equal((await identifyCandidate(io({ certified: () => false }))).qualified, false);
      // Lo stesso commit come testa, deploy e sezione: un confronto vuoto non è una modifica.
      const same = await identifyCandidate(
        io({ head: () => "deploy", introduced: () => "deploy", needsDeploy: () => true }),
      );
      assert.equal(same.commit, "deploy");
    });

    it("rifiuta un candidato non congelato, non distribuito o cambiato dopo la RC", async () => {
      const rejects = (overrides, pattern) =>
        assert.rejects(identifyCandidate(io(overrides)), pattern);
      await rejects({ changelog: () => "## [2.0.0]\n" }, /Nessuna release candidate/u);
      await rejects({ lastDeploy: () => undefined }, /Nessun deploy test/u);
      await rejects(
        { lastDeploy: () => ({ ...deployed, jobs: [{ name: "Node 26", conclusion: "failure" }] }) },
        /Gate/u,
      );
      await rejects(
        { needsDeploy: (base) => base === "deploy", introduced: () => "section" },
        /attendere il deploy/u,
      );
      // Una correzione distribuita dopo la sezione della RC richiede la RC successiva.
      await rejects(
        { introduced: () => "section", needsDeploy: (base) => base === "section" },
        /aggiungere la RC successiva/u,
      );
      await rejects({ receipt: () => ({ ...receipt, rolledBack: true }) }, /Ricevuta/u);
      await rejects({ receipt: () => ({ ...receipt, sha: "other" }) }, /Ricevuta/u);
      await rejects({ liveVersion: async () => "worker-v2" }, /versione attiva/u);
    });
  });
});
