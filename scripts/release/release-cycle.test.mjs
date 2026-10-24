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
  waitUpdatedHead,
  expectedRun,
  candidateRef,
  runTimings,
  assertCycleReceipt,
  checkCycleJobs,
  assertRemoteEvidence,
  assertPublishedRelease,
  squashIntegrated,
  cleanup,
  effectiveProductionVariable,
  acquireLock,
  withLock,
} from "./release-cycle.mjs";

describe("coordinamento e provenienza della pubblicazione", () => {
  it("rilegge le variabili effettive senza usare un fallback per errori di accesso", () => {
    const calls = [];
    const read = (endpoint) => {
      calls.push(endpoint);
      if (endpoint.includes("environments/"))
        throw Object.assign(new Error("not found"), { stderr: "HTTP 404" });
      return "approved";
    };
    assert.equal(
      effectiveProductionVariable(read, "example/project", "OWNER_APPROVED_SHA"),
      "approved",
    );
    assert.deepEqual(calls, [
      "repos/example/project/environments/production/variables/OWNER_APPROVED_SHA",
      "repos/example/project/actions/variables/OWNER_APPROVED_SHA",
    ]);
    assert.equal(
      effectiveProductionVariable(() => "environment", "example/project", "OWNER_APPROVED_SHA"),
      "environment",
    );
    let count = 0;
    assert.throws(() =>
      effectiveProductionVariable(
        () => {
          count++;
          throw new Error("HTTP 403");
        },
        "example/project",
        "OWNER_APPROVED_SHA",
      ),
    );
    assert.equal(count, 1);
  });

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
    const executable = `#!${process.execPath}\nconst fs = require("node:fs"); const args = process.argv.slice(2); fs.appendFileSync(process.env.CYCLE_CALLS, JSON.stringify(args) + "\\n"); if(args[0] === "repo") console.log(JSON.stringify({nameWithOwner:"example/project"})); else if(args.includes("--slurp")) console.log(${JSON.stringify(JSON.stringify([jobs]))}); else console.log(${JSON.stringify(JSON.stringify(run))});\n`;
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
          .every((line) => ["repo", "api"].includes(JSON.parse(line)[0])),
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
      const candidateGh = `#!${process.execPath}\nconst fs=require("node:fs");const a=process.argv.slice(2);fs.appendFileSync(process.env.CYCLE_CALLS,JSON.stringify(a)+"\\n");let value;if(a[0]==="repo")value={nameWithOwner:"example/project"};else if(a[0]==="run")value=[{databaseId:124,headSha:${JSON.stringify(sha)},status:"completed",conclusion:"success"}];else if(a[0]==="workflow")process.exit(99);else if(a.includes("--slurp"))value=${JSON.stringify([jobs])};else if(a[1].includes("git/ref/")){console.log(${JSON.stringify(sha)});process.exit(0);}else if(a[1].includes("git/commits/"))value={tree:{sha:${JSON.stringify(tree)}}};else if(a[1].includes("/artifacts?"))value={artifacts:[{...${JSON.stringify(proof)},expired:process.env.CANDIDATE_EXPIRED==="1"}]};else if(a[1].includes("/jobs?"))value=${JSON.stringify(cycleJobs)};else if(a[1].includes("/actions/runs/"))value={...${JSON.stringify(run)},path:".github/workflows/publish.yml"};else value={id:1};console.log(JSON.stringify(value));\n`;
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

  it("non chiude un ciclo con browser parziali o un tag di un altro commit", () => {
    const report = {
      status: "passed",
      partial: false,
      dirty: false,
      sha: "commit",
      environment: "test",
      baseURL: "https://test.fiscalbay.it",
      counts: { passed: 1 },
    };
    assert.doesNotThrow(() => assertRemoteEvidence(report, "commit", "test"));
    for (const change of [
      { partial: true },
      { dirty: true },
      { sha: "other" },
      { counts: { passed: 0 } },
      { environment: "local" },
    ])
      assert.throws(() => assertRemoteEvidence({ ...report, ...change }, "commit", "test"));
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

  it("richiede il deploy quando pertinente e rifiuta una ricevuta parziale o diversa", () => {
    const gate = { name: "Node 26", conclusion: "success" };
    const deploy = { name: "Deploy test", conclusion: "skipped" };
    assert.equal(checkCycleJobs([gate, deploy], false), false);
    assert.throws(() => checkCycleJobs([gate, deploy], true));
    assert.equal(checkCycleJobs([gate, { ...deploy, conclusion: "success" }], true), true);
    assert.throws(() => checkCycleJobs([{ ...gate, conclusion: "failure" }], false));
    const receipt = {
      sha: "commit",
      environment: "test",
      deployed: true,
      readback: true,
      digest: "digest",
      version: "version",
    };
    assert.doesNotThrow(() => assertCycleReceipt(receipt, "commit", "test"));
    for (const change of [
      { sha: "other" },
      { environment: "production" },
      { readback: false },
      { rolledBack: true },
      { deployed: false },
    ])
      assert.throws(() => assertCycleReceipt({ ...receipt, ...change }, "commit", "test"));
  });
});
