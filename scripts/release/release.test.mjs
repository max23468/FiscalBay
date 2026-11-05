import assert from "node:assert/strict";
import { spawnSync, execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, cpSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
  declaredReview,
  migrationEntry,
  migrationPlan,
  requiredReview,
  reviewAdded,
  publish,
  activate,
  incidentTarget,
  versionOverride,
  assertResume,
  digestDirectory,
  assertAppliedMigrations,
  appliedMigrationHistory,
  receiptArtifact,
  readReceipt,
  releaseIdentity,
  retryReadback,
  assertTestEvidence,
  assertProductionApproval,
  firstAttempt,
  rollbackRequired,
  assertConfirmable,
  deployReport,
  assertChangesVersion,
  assertMergedChangesVersion,
  openedChangelog,
  versionToOpen,
  assertVersionStep,
  deployTag,
  fragmentDecisions,
  laterPart,
  publicationDay,
  rebaseLinks,
  withDecisions,
  datedChangelog,
  romeDay,
  topVersion,
  rollbackRelease,
  reconcileReceipt,
} from "./release.mjs";
import { releaseNotes } from "./release-notes.mjs";

describe("ciclo reale con provider simulati", () => {
  it("riconcilia risposte perse, conferma senza attesa, ritiro, ripresa e giorno fallito senza rete", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "publication-cli-"));
    const git = (...args) =>
      execFileSync("git", args, {
        cwd: directory,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }).trim();
    const write = (file, content) => {
      mkdirSync(path.dirname(path.join(directory, file)), { recursive: true });
      writeFileSync(path.join(directory, file), content);
    };
    try {
      for (const file of ["release/release.mjs", "release/records.mjs", "lib/provider.mjs"]) {
        mkdirSync(path.dirname(path.join(directory, "scripts", file)), { recursive: true });
        cpSync(path.join("scripts", file), path.join(directory, "scripts", file));
      }
      // Gli script leggono il changelog con i frammenti tramite il modulo dell'app.
      write("app/changelog-fragments.mjs", readFileSync("app/changelog-fragments.mjs", "utf8"));
      write(".gitignore", ".cloudflare/\nreports/\n");
      write("package.json", JSON.stringify({ type: "module", packageManager: "pnpm@12.15.0" }));
      write("pnpm-lock.yaml", "lockfileVersion: '9.0'\n");
      write("cloudflare.config.ts", "export default {};\n");
      write("migrations/0001_schema.sql", "CREATE TABLE example (id TEXT);\n");
      write("CHANGELOG.md", "# Changelog\n\n## [2.0.0]\n\n- Voce.\n");
      git("init", "-q", "--initial-branch", "main");
      git("config", "user.name", "Test");
      git("config", "user.email", "test@example.invalid");
      git("add", ".");
      git("commit", "-qm", "base");
      const previousSha = git("rev-parse", "HEAD");
      write("value.txt", "candidate\n");
      git("add", ".");
      git("commit", "-qm", "candidate");
      const sha = git("rev-parse", "HEAD");
      git("remote", "add", "origin", directory);
      write(
        ".cloudflare/output/v0/config.json",
        JSON.stringify({ buildContext: { mode: "live" } }),
      );
      write(
        ".cloudflare/output/v0/workers/default/worker.config.json",
        JSON.stringify({
          name: "fiscalbay",
          env: { APP_ORIGIN: { value: "https://fiscalbay.it" }, DB: { id: "database" } },
        }),
      );
      const old = "11111111-1111-1111-1111-111111111111";
      const next = "22222222-2222-2222-2222-222222222222";
      const store = path.join(directory, ".git/provider.json");
      const state = () => JSON.parse(readFileSync(store, "utf8"));
      const save = (value) => writeFileSync(store, JSON.stringify(value));
      save({
        current: { versions: [{ version_id: old, percentage: 100 }] },
        history: [],
        calls: [],
        loss: "upload",
        versions: {
          [old]: {
            id: old,
            annotations: { "workers/message": `${previousSha}:${"f".repeat(32)}` },
            bindings: [{ name: "DB", id: "database" }],
          },
        },
      });
      write(
        ".git/bin/pnpm",
        `#!${process.execPath}\nimport fs from 'node:fs';
const file=process.env.PROVIDER_STATE; const state=JSON.parse(fs.readFileSync(file,'utf8'));
const args=process.argv.slice(4); const key=args.slice(0,3).join(' '); const value=(name)=>args[args.indexOf(name)+1];
const persist=()=>fs.writeFileSync(file,JSON.stringify(state)); const out=(value)=>process.stdout.write(JSON.stringify(value));
state.calls.push(key); let lost=false;
if(key==='workers deployments list') out({deployments:[state.current,...state.history]});
else if(key==='workers versions get') out(state.versions[args[3]]);
else if(key==='workers secrets list') out([]);
else if(key==='workers versions list') out(Object.values(state.versions).reverse());
else if(key==='workers versions create') {
 state.versions['${next}']={id:'${next}',annotations:{'workers/message':value('--message')},bindings:[{name:'DB',id:'database'}]};
 if(state.loss==='upload'){delete state.loss;lost=true;}
} else if(key==='workers deployments create') {
 const body=JSON.parse(value('--body'));state.history.unshift(state.current);state.current={versions:body.versions};
 if(state.loss==='activation' && body.versions.length===1 && body.versions[0].version_id==='${next}'){delete state.loss;lost=true;}
} else {throw new Error('Unexpected provider command '+args.join(' '));}
persist(); if(lost){process.stderr.write('Provider response lost');process.exit(1);}
`,
      );
      execFileSync("chmod", ["700", path.join(directory, ".git/bin/pnpm")]);
      write(
        ".git/fetch.mjs",
        `import fs from 'node:fs';
globalThis.fetch=async(input,options={})=>{
 const url=new URL(String(input));const state=JSON.parse(fs.readFileSync(process.env.PROVIDER_STATE,'utf8'));
 if(url.hostname==='api.cloudflare.com'){
  const sql=JSON.parse(options.body).sql;
  const rows=sql.includes('sqlite_master')?[{name:'d1_migrations'}]:[{name:'0001_schema.sql'}];
  return Response.json({success:true,result:[{success:true,results:rows}]});
 }
 if(url.hostname!=='fiscalbay.it') throw new Error('Network disabled');
 const override=options.headers?.['cloudflare-workers-version-overrides']?.match(/="([^"]+)"/)?.[1];
 const version=override ?? state.current.versions.find(v=>v.percentage===100)?.version_id;
 return new Response(url.pathname.includes('get-session')?'null':'ok',{headers:{'x-fiscalbay-version':version}});
};`,
      );
      const call = (script, args) =>
        spawnSync(
          process.execPath,
          [
            "--import",
            path.join(directory, ".git/fetch.mjs"),
            `scripts/release/${script}.mjs`,
            ...args,
          ],
          {
            cwd: directory,
            encoding: "utf8",
            timeout: 15_000,
            env: {
              ...process.env,
              PATH: `${path.join(directory, ".git/bin")}${path.delimiter}${process.env.PATH}`,
              PROVIDER_STATE: store,
              CLOUDFLARE_API_TOKEN: "synthetic",
              CLOUDFLARE_ACCOUNT_ID: "synthetic",
              PRODUCTION_PUBLISH_ENABLED: "true",
              VERSION: "2.0.0",
              RELEASE_DAY: "2026-11-02",
              GITHUB_OUTPUT: "",
              GITHUB_STEP_SUMMARY: "",
            },
          },
        );
      const release = (command, extra = []) =>
        call("release", [command, "--environment", "production", "--expected-sha", sha, ...extra]);
      const success = (result) => assert.equal(result.status, 0, result.stderr);
      success(release("manifest"));
      success(release("deploy"));
      assert.equal(
        state().calls.filter((command) => command === "workers versions create").length,
        1,
      );
      success(release("deploy"));
      assert.equal(
        state().calls.filter((command) => command === "workers versions create").length,
        1,
      );
      success(release("staged-check"));
      save({ ...state(), loss: "activation" });
      success(release("activate"));
      assert.equal(state().current.versions[0].version_id, next);
      const badDay = call("release", ["date", "--version", "2.0.1", "--day", "2026-11-02"]);
      assert.notEqual(badDay.status, 0);
      success(release("record"));
      assert.equal(
        JSON.parse(readFileSync(path.join(directory, "reports/release.json"))).active.sha,
        sha,
      );
      success(release("finalize"));
      const confirmed = JSON.parse(readFileSync(path.join(directory, "reports/release.json")));
      assert.ok(confirmed.completedAt);
      assert.equal(confirmed.candidateActive, true);
      assert.equal(confirmed.guardPassed, undefined);
      // Il ritiro esplicito rimane vincolante anche dopo una conferma riuscita.
      success(release("incident-rollback"));
      success(release("record"));
      assert.equal(state().current.versions[0].version_id, old);
      assert.notEqual(release("finalize").status, 0);
      success(release("incident-rollback"));
      assert.equal(state().current.versions[0].version_id, old);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe("pubblicazione riprendibile", () => {
  const manifest = { sha: "a".repeat(40), tree: "tree", digest: "artifact", environment: "test" };
  const harness = () => {
    let current = { version: "old", identity: "old" };
    const calls = [];
    const receipts = [];
    const io = {
      assertCurrent: async () => calls.push("current"),
      preflight: async () => calls.push("preflight"),
      migrations: async () => ({ pending: [], rollbackCompatible: true }),
      migrate: async () => calls.push("migration"),
      schema: async () => [],
      current: async () => current,
      canRollback: async () => true,
      canStage: async () => false,
      deploy: async (identity) => {
        calls.push("deploy");
        current = { version: "new", identity };
      },
      readback: async () => calls.push("readback"),
      save: async (state) => receipts.push(structuredClone(state)),
    };
    return { io, calls, receipts };
  };

  it("il giorno arriva dopo la pubblicazione, le note restano in italiano", () => {
    const develop = [
      "# Changelog",
      "",
      "## [2.0.1]",
      "",
      "### Novità",
      "",
      "- **Esportazione.** Testo.",
      "",
      "### What's new",
      "",
      "- **Export.** Text.",
      "",
      "### Altre modifiche",
      "",
      "- Prove nuove.",
      "",
      "## [2.0.0] - 2026-10-31",
      "",
      "- Prima versione.",
      "",
    ].join("\n");
    const head = datedChangelog(develop, "2.0.1", "2026-11-05");
    assert.equal(head, develop.replace("## [2.0.1]\n", "## [2.0.1] - 2026-11-05\n"));
    assert.equal(topVersion(head), "2.0.1");
    // La ripresa non cambia il giorno; una versione aperta dopo non sposta quella pubblicata.
    assert.equal(datedChangelog(head, "2.0.1", "2026-11-06"), head);
    const later = develop.replace("## [2.0.1]\n", "## [2.0.2]\n\n- Altra.\n\n## [2.0.1]\n");
    assert.equal(
      datedChangelog(later, "2.0.1", "2026-11-05"),
      later.replace("## [2.0.1]\n", "## [2.0.1] - 2026-11-05\n"),
    );
    assert.throws(() => datedChangelog(develop, "2.0.2", "2026-11-05"), /non è nel changelog/u);
    assert.throws(() => datedChangelog(develop, "2.0.1", "5 novembre"), /Giorno non valido/u);
    // Il giorno è quello italiano, anche quando in UTC è ancora il precedente.
    assert.equal(romeDay(new Date("2026-11-04T23:30:00.000Z")), "2026-11-05");

    assert.equal(
      releaseNotes(head, "2.0.1"),
      "### Novità\n\n- **Esportazione.** Testo.\n\n### Altre modifiche\n\n- Prove nuove.",
    );
    assert.equal(releaseNotes(head, "2.0.0"), "- Prima versione.");
  });

  it("non ridistribuisce dopo un'interruzione successiva al deploy", async () => {
    const { io, calls, receipts } = harness();
    const readback = io.readback;
    io.readback = async () => {
      throw new Error("interruzione");
    };
    await assert.rejects(publish(manifest, io), /interruzione/u);
    io.readback = readback;
    const result = await publish(manifest, io, receipts.at(-1));
    assert.equal(calls.filter((call) => call === "deploy").length, 1);
    assert.equal(result.readback, true);
    assert.equal(result.previous, "old");
  });

  it("rifiuta candidato superato e ricevuta di un altro artefatto prima degli effetti", async () => {
    const { io, calls } = harness();
    io.assertCurrent = async () => {
      throw new Error("superato");
    };
    await assert.rejects(publish(manifest, io), /superato/u);
    assert.deepEqual(calls, []);
    assert.throws(() => assertResume({ ...manifest, digest: "other" }, manifest), /diverso/u);
  });

  it("conserva il blocco del rollback dopo una migration e una ripresa", async () => {
    const { io, receipts } = harness();
    let applied = false;
    io.migrations = async () => ({
      pending: applied ? [] : [{ name: "new.sql" }],
      rollbackCompatible: applied,
    });
    io.migrate = async () => {
      applied = true;
      throw new Error("interruzione dopo schema");
    };
    await assert.rejects(publish(manifest, io), /interruzione/u);
    const result = await publish(manifest, io, receipts.at(-1));
    assert.equal(result.readback, true);
    assert.equal(result.rollbackCompatible, false);
  });

  it("attende la propagazione della versione entro una finestra limitata", async () => {
    let calls = 0;
    await retryReadback(
      async () => {
        if (++calls < 3) throw new Error("Readback della versione non riuscito: /.");
      },
      5,
      0,
    );
    assert.equal(calls, 3);
    calls = 0;
    await assert.rejects(
      retryReadback(
        async () => {
          calls++;
          throw new Error("Readback della versione non riuscito: /en.");
        },
        4,
        0,
      ),
      /\/en/u,
    );
    assert.equal(calls, 4);
  });

  it("non dichiara readback riuscito se il provider distribuisce un'altra identità", async () => {
    const { io, receipts } = harness();
    io.deploy = async () => {};
    await assert.rejects(publish(manifest, io), /diversa/u);
    assert.notEqual(receipts.at(-1).readback, true);
  });

  it("riconcilia un deploy riuscito sul provider anche se la CLI perde la risposta", async () => {
    const { io, receipts, calls } = harness();
    const deploy = io.deploy;
    io.deploy = async (identity) => {
      await deploy(identity);
      throw new Error("risposta persa");
    };
    await assert.rejects(publish(manifest, io), /risposta persa/u);
    assert.equal(receipts.at(-1).deployed, true);
    assert.equal(receipts.at(-1).version, "new");
    assert.equal(receipts.at(-1).readback, false);
    io.deploy = deploy;
    await publish(manifest, io, receipts.at(-1));
    assert.equal(calls.filter((call) => call === "deploy").length, 1);
  });

  it("rifiuta una ricostruzione diversa di un commit già distribuito", async () => {
    const { io, calls } = harness();
    io.current = async () => ({ version: "new", identity: `${manifest.sha}:different` });
    io.migrations = async () => ({ pending: [{ name: "change.sql" }], rollbackCompatible: false });
    await assert.rejects(publish(manifest, io), /artefatto diverso/u);
    assert.equal(calls.includes("deploy"), false);
    assert.equal(calls.includes("migration"), false);
  });

  it("ricontrolla il candidato prima delle migration e rifiuta un deploy esterno durante il preflight", async () => {
    const { io, calls } = harness();
    let checks = 0;
    io.assertCurrent = async () => {
      if (++checks > 1) throw new Error("superato");
    };
    io.migrations = async () => ({ pending: [{ name: "change.sql" }], rollbackCompatible: false });
    await assert.rejects(publish(manifest, io), /superato/u);
    assert.equal(calls.includes("migration"), false);
    const next = harness();
    let reads = 0;
    next.io.current = async () => ({
      version: ++reads === 1 ? "old" : "external",
      identity: "old",
    });
    await assert.rejects(publish(manifest, next.io), /Stato remoto cambiato/u);
    assert.equal(next.calls.includes("deploy"), false);
  });

  it("riprende un piano approvato parzialmente applicato senza autorizzare SQL diverso", () => {
    const entries = ["a.sql", "b.sql"].map((name) => ({
      name,
      digest: name,
      sql: "DROP TABLE example;",
    }));
    let digest;
    try {
      migrationPlan(entries, []);
    } catch (error) {
      digest = error.message.split("Digest ")[1];
    }
    const approved = { digest, pending: entries.map(({ name, digest }) => ({ name, digest })) };
    assert.equal(migrationPlan(entries, ["a.sql"], digest, approved).pending.length, 1);
    assert.throws(
      () =>
        migrationPlan(
          [{ ...entries[1], digest: "changed" }, entries[0]],
          ["a.sql"],
          digest,
          approved,
        ),
      /approvare/u,
    );
    assert.throws(() => migrationPlan(entries, ["a.sql"], "unapproved", approved), /approvare/u);
  });

  it("chiede nella PR il digest delle migration non additive aggiunte", () => {
    const additive = { name: "a.sql", digest: "a", sql: "CREATE TABLE example (id TEXT);" };
    const unsafe = { name: "b.sql", digest: "b", sql: "UPDATE example SET id = 1;" };
    assert.equal(reviewAdded([additive], ""), "");
    let digest;
    try {
      reviewAdded([additive, unsafe], "");
    } catch (error) {
      assert.match(error.message, /b\.sql/u);
      digest = error.message.match(/reviewed-migrations: ([0-9a-f]{64})/u)[1];
    }
    // Lo stesso digest sblocca il deploy test quando restano pendenti le sole migration della PR.
    assert.throws(() => migrationPlan([additive, unsafe], []), new RegExp(`Digest ${digest}`, "u"));
    const body = `Descrizione\n\nreviewed-migrations: ${digest}\n`;
    assert.equal(declaredReview(body), digest);
    assert.equal(reviewAdded([additive, unsafe], body), digest);
    assert.equal(migrationPlan([additive, unsafe], [], declaredReview(body)).pending.length, 2);
    assert.throws(
      () => reviewAdded([additive, { ...unsafe, digest: "changed" }], body),
      /approvare prima del merge/u,
    );
    assert.equal(declaredReview(undefined), "");
    assert.equal(declaredReview(`testo reviewed-migrations: ${digest}`), "");
    // La verifica locale mostra la stessa riga prima dell'apertura della PR.
    assert.deepEqual(requiredReview([additive, unsafe]), { names: ["b.sql"], digest });
    assert.equal(requiredReview([additive]), undefined);
    const entry = migrationEntry("migrations/0041_c.sql", Buffer.from(unsafe.sql));
    assert.deepEqual([entry.name, entry.sql], ["0041_c.sql", unsafe.sql]);
    assert.match(entry.digest, /^[0-9a-f]{64}$/u);
  });

  it("recupera solo la ricevuta non scaduta del tentativo precedente della stessa run", () => {
    const artifacts = [
      { name: "deployed-123-1", expired: false },
      { name: "deployed-123-2", expired: false },
      { name: "deployed-123-3", expired: false },
      { name: "deployed-124-2", expired: false },
      { name: "deployed-123-4", expired: true },
    ];
    assert.equal(receiptArtifact(artifacts, "deployed", "123", 3).name, "deployed-123-2");
    assert.equal(receiptArtifact(artifacts, "release-receipt", "123", 3), undefined);
  });

  it("verifica la ricevuta estratta dall'artefatto prima di ripristinare lo stato", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "receipt-"));
    assert.equal(readReceipt(directory, manifest), null);
    mkdirSync(path.join(directory, "reports"));
    const file = path.join(directory, "reports/release.json");
    const receipt = { ...manifest, previous: "old", schemaChanged: true };
    writeFileSync(file, JSON.stringify(receipt));
    assert.deepEqual(readReceipt(directory, manifest), receipt);
    writeFileSync(file, JSON.stringify({ ...receipt, digest: "other" }));
    assert.throws(() => readReceipt(directory, manifest), /diverso/u);
  });

  it("blocca migration distruttive non approvate e schema remoto estraneo", () => {
    const migrations = [{ name: "change.sql", digest: "hash", sql: "DROP TABLE orders;" }];
    assert.throws(() => migrationPlan(migrations, []), /Digest/u);
    assert.throws(() => migrationPlan(migrations, ["unknown.sql"]), /assenti/u);
    assert.equal(migrationPlan(migrations, ["change.sql"]).pending.length, 0);
    const additive = [
      "ALTER TABLE ebay_stores ADD COLUMN paused_at TEXT;",
      'ALTER TABLE "session" ADD "passkeyVerified" INTEGER;',
      "CREATE TABLE child (id TEXT REFERENCES parent(id) ON DELETE CASCADE ON UPDATE CASCADE);",
    ];
    for (const sql of additive)
      assert.equal(migrationPlan([{ ...migrations[0], sql }], []).pending.length, 1);
    for (const sql of [
      "ALTER TABLE orders RENAME TO archived;",
      "ALTER TABLE orders DROP COLUMN status;",
      "ALTER TABLE orders ADD COLUMN status TEXT; UPDATE orders SET status = 'open';",
    ])
      assert.throws(() => migrationPlan([{ ...migrations[0], sql }], []), /Digest/u);
    assert.equal(
      migrationPlan([{ ...migrations[0], sql: "CREATE TABLE example (id TEXT);" }], [])
        .rollbackCompatible,
      false,
    );
  });

  it("rifiuta una modifica SQL di una migration già applicata", () => {
    const current = [{ name: "schema.sql", digest: "new" }];
    const previous = [{ name: "schema.sql", digest: "old" }];
    assert.throws(() => assertAppliedMigrations(current, previous, ["schema.sql"]), /modificata/u);
    assert.doesNotThrow(() => assertAppliedMigrations(current, current, ["schema.sql"]));
    assert.doesNotThrow(() => assertAppliedMigrations(current, previous, []));
  });

  it("riconosce le migration applicate dal tentativo interrotto senza accettare SQL diverso", () => {
    const old = migrationEntry("schema.sql", Buffer.from("CREATE TABLE example (id TEXT);"));
    const added = migrationEntry(
      "new.sql",
      Buffer.from("ALTER TABLE example ADD COLUMN value TEXT;"),
    );
    const plan = migrationPlan([old, added], [old.name]);
    const receipt = {
      schemaChanged: true,
      migrationPlan: {
        digest: plan.digest,
        pending: plan.pending.map(({ name, digest }) => ({ name, digest })),
      },
    };
    const names = [old.name, added.name];
    const read = (name) => (name === old.name ? Buffer.from(old.sql) : undefined);
    const history = appliedMigrationHistory(names, read, receipt);
    assert.doesNotThrow(() => assertAppliedMigrations([old, added], history, names));
    assert.throws(
      () => assertAppliedMigrations([old, { ...added, digest: "changed" }], history, names),
      /modificata/u,
    );
    assert.throws(() => appliedMigrationHistory(names, read, {}), /senza storia/u);
    assert.throws(
      () =>
        appliedMigrationHistory(names, read, {
          ...receipt,
          migrationPlan: { ...receipt.migrationPlan, digest: "changed" },
        }),
      /senza storia/u,
    );
  });

  it("registra un'identità di versione entro il limite del messaggio Cloudflare", () => {
    const identity = releaseIdentity({ sha: "a".repeat(40), digest: "b".repeat(64) });
    assert.ok(identity.length <= 100);
    assert.ok(identity.startsWith(`${"a".repeat(40)}:`));
  });

  it("conferma il test soltanto con un collaudo remoto completo dello stesso commit", () => {
    const report = {
      status: "passed",
      partial: false,
      dirty: false,
      sha: "commit",
      environment: "test",
      baseURL: "https://test.fiscalbay.it",
      counts: { passed: 1 },
    };
    assert.doesNotThrow(() => assertTestEvidence(report, "commit"));
    for (const change of [
      { status: "failed" },
      { partial: true },
      { dirty: true },
      { sha: "other" },
      { counts: { passed: 0 } },
      { environment: "local" },
      { baseURL: "https://fiscalbay.it" },
    ])
      assert.throws(() => assertTestEvidence({ ...report, ...change }, "commit"));
  });

  it("rileva la manomissione dell'artefatto", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "release-"));
    writeFileSync(path.join(directory, "worker.js"), "original");
    const original = digestDirectory(directory);
    writeFileSync(path.join(directory, "worker.js"), "modified");
    assert.notEqual(digestDirectory(directory), original);
  });

  it("ricava le note dalla versione dichiarata", () => {
    assert.equal(
      releaseNotes(
        "## [2.0.0-rc.1]\n\nCorrezione verificata.\n\n## 2.0.0-alpha.1\nPrima versione.",
        "2.0.0-rc.1",
      ),
      "Correzione verificata.",
    );
    assert.throws(() => releaseNotes("## 2.0.0\n", "2.0.0"), /vuota/u);
  });
});

describe("versione provata prima del traffico", () => {
  const manifest = { sha: "a".repeat(40), tree: "tree", digest: "artifact", environment: "test" };
  const harness = () => {
    const identity = releaseIdentity(manifest);
    let current = { version: "old", identity: `${"b".repeat(40)}:x` };
    const calls = [];
    const receipts = [];
    const io = {
      assertCurrent: async () => {},
      preflight: async () => {},
      migrations: async () => ({ pending: [], rollbackCompatible: true }),
      migrate: async () => {},
      schema: async () => [],
      current: async () => current,
      canRollback: async () => true,
      canStage: async () => true,
      stage: async (message, previous) => {
        calls.push(["stage", message, previous]);
        return "new";
      },
      deploy: async () => calls.push(["deploy"]),
      activate: async (version) => {
        calls.push(["activate", version]);
        current = { version, identity };
      },
      readback: async (version) => calls.push(["readback", version]),
      save: async (state) => receipts.push(structuredClone(state)),
    };
    return { io, calls, receipts, moved: () => (current = { version: "altra", identity: "x" }) };
  };

  it("carica al 0% senza distribuire, poi attiva e rilegge", async () => {
    const { io, calls } = harness();
    const staged = await publish(manifest, io);
    assert.deepEqual(calls, [["stage", releaseIdentity(manifest), "old"]]);
    assert.deepEqual(
      [staged.staged, staged.stagedVersion, staged.deployed, staged.readback, staged.previous],
      [true, "new", false, false, "old"],
    );
    const active = await activate(manifest, io, staged);
    assert.deepEqual(calls.slice(1), [
      ["activate", "new"],
      ["readback", "new"],
    ]);
    assert.deepEqual([active.deployed, active.readback, active.version], [true, true, "new"]);
  });

  it("con una configurazione diversa il traffico passa subito", async () => {
    const { io, calls } = harness();
    io.canStage = async () => false;
    await assert.rejects(publish(manifest, io), /diversa/u);
    assert.deepEqual(calls, [["deploy"]]);
  });

  it("non attiva se nel frattempo è cambiata la versione attiva", async () => {
    const { io, calls, moved } = harness();
    const staged = await publish(manifest, io);
    moved();
    await assert.rejects(activate(manifest, io, staged), /Stato remoto cambiato/u);
    assert.equal(
      calls.some(([name]) => name === "activate"),
      false,
    );
  });

  it("una ripresa dopo l'attivazione non attiva due volte", async () => {
    const { io, calls } = harness();
    const staged = await publish(manifest, io);
    await activate(manifest, io, staged);
    await activate(manifest, io, staged);
    assert.equal(calls.filter(([name]) => name === "activate").length, 1);
  });

  it("senza caricamento l'attivazione non fa nulla e rifiuta un altro candidato", async () => {
    const { io, calls } = harness();
    const receipt = { tree: "tree", digest: "artifact", environment: "test", staged: false };
    assert.equal(await activate(manifest, io, receipt), receipt);
    assert.deepEqual(calls, []);
    await assert.rejects(activate(manifest, io, { ...receipt, tree: "altro" }), /diverso/u);
  });

  it("l'header indica il Worker e la versione", () => {
    assert.equal(versionOverride("fiscalbay", "abc"), 'fiscalbay="abc"');
  });
});

describe("rollback d'incidente", () => {
  it("riconosce un ritiro già applicato e conserva il rifiuto di versioni estranee", async () => {
    const manifest = {
      sha: "a".repeat(40),
      tree: "tree",
      digest: "d".repeat(64),
      environment: "test",
    };
    const receipt = {
      ...manifest,
      staged: true,
      stagedVersion: "new",
      previous: "old",
      deployed: false,
    };
    let saved;
    const remote = {
      activeDeployment: () => ({ versions: [{ version_id: "old", percentage: 100 }] }),
      deployment: () => assert.fail("Non deve ridistribuire"),
      liveReadback: async () => {},
    };
    await rollbackRelease(manifest, {}, remote, receipt, (state) => (saved = state));
    assert.equal(saved.rolledBack, true);
    await rollbackRelease(manifest, {}, remote, saved, (state) => (saved = state));
    assert.equal(saved.readback, false);
    await assert.rejects(
      rollbackRelease(
        manifest,
        {},
        {
          ...remote,
          activeDeployment: () => ({ versions: [{ version_id: "foreign", percentage: 100 }] }),
        },
        receipt,
      ),
      /Stato remoto cambiato/u,
    );
    const exposed = {
      ...receipt,
      activationAttempted: true,
      version: "new",
      schemaChanged: true,
      rollbackCompatible: false,
    };
    await assert.rejects(
      rollbackRelease(
        manifest,
        {},
        {
          ...remote,
          activeDeployment: () => ({ versions: [{ version_id: "new", percentage: 100 }] }),
        },
        exposed,
      ),
      /schema modificato/u,
    );
  });

  it("rilegge l'identità alla conferma finale e salva lo stato attivo anche nel ritiro", async () => {
    const receipt = {
      sha: "a".repeat(40),
      digest: "d".repeat(64),
      environment: "production",
      version: "new",
      rolledBack: true,
    };
    const current = { version: "old", identity: `${"b".repeat(40)}:${"f".repeat(32)}` };
    let saved;
    const io = {
      current: async () => current,
      readback: async () => {},
      schema: async () => [{ name: "schema.sql" }],
      save: async (state) => (saved = state),
    };
    await assert.rejects(reconcileReceipt(receipt, io), /non è attivo/u);
    assert.equal(saved.active.sha, "b".repeat(40));
    assert.equal(saved.candidateActive, false);
    const result = await reconcileReceipt(saved, io, false);
    assert.deepEqual(result.active.schema, [{ name: "schema.sql" }]);
    const candidate = { ...receipt, rolledBack: false };
    await reconcileReceipt(candidate, {
      ...io,
      current: async () => ({ version: "new", identity: releaseIdentity(candidate) }),
    });
    assert.equal(saved.candidateActive, true);
  });
  const sha = (letter) => letter.repeat(40);
  const version = (version_id, percentage = 100) => ({
    versions: [{ version_id, percentage }],
  });
  const identity = { new: `${sha("a")}:x`, old: `${sha("b")}:y`, older: `${sha("c")}:z` };
  const identityOf = (id) => identity[id];

  it("torna alla prima versione diversa interamente assegnata", () => {
    const seen = [];
    const target = incidentTarget(
      [
        version("new"),
        version("new"),
        { versions: [version("new", 0).versions[0], version("old").versions[0]] },
        version("old"),
        version("older"),
      ],
      identityOf,
      (...pair) => seen.push(pair) > 0,
    );
    assert.deepEqual(target, { active: "new", previous: "old" });
    assert.deepEqual(seen, [[sha("b"), sha("a")]]);
  });

  it("rifiuta versioni incompatibili, sconosciute o assenti", () => {
    const list = [version("new"), version("old")];
    assert.throws(() => incidentTarget(list, identityOf, () => false), /correzione in avanti/u);
    assert.throws(
      () =>
        incidentTarget(
          list,
          (id) => (id === "old" ? "manuale" : identity.new),
          () => true,
        ),
      /correzione in avanti/u,
    );
    assert.throws(() => incidentTarget([version("new")], identityOf, () => true), /precedente/u);
    assert.throws(
      () => incidentTarget([version("new", 50)], identityOf, () => true),
      /non interamente/u,
    );
  });
});

describe("comandi della pubblicazione", () => {
  const manifest = { sha: "a".repeat(40), digest: "b".repeat(64) };
  const run = (...args) =>
    spawnSync(process.execPath, [new URL("./release.mjs", import.meta.url).pathname, ...args], {
      encoding: "utf8",
    });

  it("rifiuta ambiente e base mancanti prima di leggere sorgenti o provider", () => {
    const environment = run("review", "--environment", "staging");
    assert.equal(environment.status, 1);
    assert.match(environment.stderr, /Ambiente non supportato/u);
    const base = run("review", "--base", "develop");
    assert.equal(base.status, 1);
    assert.match(base.stderr, /Base della PR richiesta/u);
  });

  it("richiede interruttore e SHA atteso uguale a quello dell'artefatto", () => {
    const env = { PRODUCTION_PUBLISH_ENABLED: "true" };
    assert.doesNotThrow(() => assertProductionApproval(manifest, manifest.sha, env));
    for (const [expected, changed] of [
      [manifest.sha, { PRODUCTION_PUBLISH_ENABLED: "false" }],
      ["c".repeat(40), {}],
      [undefined, {}],
    ])
      assert.throws(
        () => assertProductionApproval(manifest, expected, { ...env, ...changed }),
        /via Production/u,
      );
  });

  it("ripristina la ricevuta soltanto dai tentativi successivi di una run identificata", () => {
    assert.equal(firstAttempt("12", 1, "deployed"), true);
    assert.equal(firstAttempt("12", 2, "release-receipt"), false);
    for (const [runId, prefix] of [
      [undefined, "deployed"],
      ["run", "deployed"],
      ["12", "other"],
      ["12", undefined],
    ])
      assert.throws(() => firstAttempt(runId, 2, prefix), /Run o ricevuta/u);
  });

  it("torna indietro soltanto da un deploy riuscito e compatibile", () => {
    assert.equal(rollbackRequired({}), false);
    assert.equal(rollbackRequired({ deployed: true }), false);
    assert.equal(rollbackRequired({ deployed: false, previous: "old" }), false);
    assert.equal(
      rollbackRequired({ deployed: true, previous: "old", rollbackCompatible: true }),
      true,
    );
    assert.throws(
      () => rollbackRequired({ deployed: true, previous: "old", schemaChanged: true }),
      /schema modificato/u,
    );
    assert.throws(
      () => rollbackRequired({ deployed: true, previous: "old", rollbackCompatible: false }),
      /senza provenienza attestata/u,
    );
  });

  it("conferma soltanto il candidato valido sul branch, distribuito e non ritirato", () => {
    const receipt = { readback: true, version: "v2" };
    const current = { version: "v2", identity: releaseIdentity(manifest) };
    assert.doesNotThrow(() => assertConfirmable(manifest, receipt, true, current));
    for (const [changedReceipt, valid, changedCurrent] of [
      [{}, false, {}],
      [{ readback: false }, true, {}],
      [{ rolledBack: true }, true, {}],
      [{}, true, { version: "v1" }],
      [{}, true, { identity: `${manifest.sha}:other` }],
    ])
      assert.throws(
        () =>
          assertConfirmable(manifest, { ...receipt, ...changedReceipt }, valid, {
            ...current,
            ...changedCurrent,
          }),
        /release rifiutata/u,
      );
  });

  it("scrive gli output del deploy nel formato del workflow", () => {
    const state = { sha: "s", tree: "t", digest: "d", version: "v2", schema: [{}, {}] };
    assert.equal(
      deployReport({ ...state, rollbackCompatible: true, previous: "v1" }, "w").output,
      "deployed=true\nversion=v2\nrollback-compatible=true\nprevious=v1\noverride=\n",
    );
    assert.equal(
      deployReport(state, "w").output,
      "deployed=true\nversion=v2\nrollback-compatible=false\nprevious=\noverride=\n",
    );
    assert.match(
      deployReport(state, "w").summary,
      /Commit s; tree t; SHA256 d; versione v2; schema 2/u,
    );
    const staged = { ...state, staged: true, stagedVersion: "v3" };
    assert.match(deployReport(staged, "w").output, /version=v3\n[\s\S]*override=w="v3"\n/u);
    assert.match(deployReport(staged, "w").summary, /versione v3 al 0% del traffico/u);
  });

  it("la versione del lotto sale di un solo passo dall'ultima pubblicata", () => {
    const section = (version) => `# Changelog\n\n## [${version}]\n\nVoce.\n`;
    const ok = [
      // La prima modifica visibile apre la versione successiva; le altre la alzano.
      ["2.0.0", "2.0.1", ["v2.0.0", "v1.14.0"]],
      ["2.0.0", "2.1.0", ["v2.0.0"]],
      ["2.0.1", "2.1.0", ["v2.0.0"]],
      ["2.1.0", "2.1.1", ["v2.0.0", "v2.1.0"]],
    ];
    for (const [base, head, tags] of ok)
      assert.doesNotThrow(() => assertVersionStep(section(head), section(base), tags), head);
    const rejected = [
      ["2.0.0", "2.0.1", [], /non è un passo dalla prima pubblicazione/u],
      ["2.0.0", "Novità", [], /serve una versione/u],
      ["2.0.0", "2.0.2", ["v2.0.0"], /ammesse 2\.0\.1, 2\.1\.0, 3\.0\.0/u],
      ["2.0.0", "2.0.1-rc.1", ["v2.0.0"], /serve una versione/u],
      ["2.1.0", "2.0.1", ["v2.0.0"], /scende da 2\.1\.0 a 2\.0\.1/u],
      ["2.0.1", "2.0.0", ["v2.0.0"], /non è un passo dalla 2\.0\.0/u],
    ];
    for (const [base, head, tags, message] of rejected)
      assert.throws(() => assertVersionStep(section(head), section(base), tags), message);
    const dated = (version) => `## [${version}] - 2026-11-02\n`;
    assert.doesNotThrow(() => assertVersionStep(section("2.0.1"), dated("2.0.2"), ["v2.0.1"]));
    assert.throws(
      () => assertVersionStep(section("2.0.1"), dated("2.0.2"), ["v2.0.1", "v2.0.2"]),
      /non è un passo dalla 2\.0\.2/u,
    );
    // Una sezione invariata in cima non chiede nulla.
    assert.doesNotThrow(() => assertVersionStep(section("2.0.0"), section("2.0.0"), ["v2.0.0"]));
    // Una versione aperta senza Novità si richiude tornando all'ultima pubblicata.
    const open = (version) => `# Changelog\n\n## [${version}]\n\n## [2.0.1] - 2026-11-02\n`;
    assert.doesNotThrow(() => assertVersionStep(dated("2.0.1"), open("2.0.2"), ["v2.0.1"]));
    assert.throws(
      () => assertVersionStep(dated("2.0.1"), open("2.0.2"), ["v2.0.1", "v2.0.2"]),
      /non è un passo dalla 2\.0\.2/u,
    );
  });

  it("l'etichetta del deploy porta la versione soltanto dopo la prima 2.x pubblicata", () => {
    const tag = (version, environment, releasedTags, expected, day = "2026-11-05", input) =>
      deployTag({
        changelog: `# Changelog\n\n## [${version}]${day ? ` - ${day}` : ""}\n`,
        environment,
        sha: "a".repeat(40),
        tree: "b".repeat(40),
        releasedTags,
        expected,
        day: input,
      });
    assert.equal(tag("2.0.0", "test", ["v1.14.0", ""]), "a".repeat(12));
    assert.equal(tag("2.0.0", "production", [], "2.0.0"), "a".repeat(12));
    assert.equal(tag("2.0.1", "test", ["v2.0.0"]), `2.0.1-dev.${"b".repeat(12)}`);
    assert.equal(tag("2.0.1", "production", ["v2.0.0"], "2.0.1"), "2.0.1");
    // Sole modifiche interne dopo la 2.0.0: la versione resta, con il commit distribuito.
    assert.equal(tag("2.0.0", "production", ["v2.0.0"], "2.0.0"), `2.0.0+${"a".repeat(12)}`);
    assert.throws(() => tag("2.0.1", "production", ["v2.0.0"], "2.0.2"), /versione 2\.0\.2/u);
    // In Production la versione entra nella build con il giorno; sul test no.
    assert.throws(() => tag("2.0.1", "production", ["v2.0.0"], "2.0.1", ""), /non ha il giorno/u);
    assert.equal(tag("2.0.1", "production", ["v2.0.0"], "2.0.1", "", "2026-11-05"), "2.0.1");
    assert.equal(tag("2.0.1", "test", ["v2.0.0"], undefined, ""), `2.0.1-dev.${"b".repeat(12)}`);
  });
});

describe("frammenti delle PR", () => {
  const changelog = [
    "# Changelog",
    "",
    "## [2.0.3]",
    "",
    "### Novità",
    "",
    "#### Correzioni",
    "",
    "- **Uno.** Primo.",
    "",
    "### What's new",
    "",
    "#### Fixes",
    "",
    "- **One.** First.",
    "",
    "## [2.0.2] - 2026-11-03",
    "",
  ].join("\n");
  const register =
    "| ID | A | B |\n|---|---|---|\n| D001 | a | [R](../product/PRODUCT.md) |\n\nNota.\n";
  const fragment = (title, decision = "") =>
    [
      "# Frammento",
      "",
      "## Changelog",
      "",
      "### Novità",
      "",
      "#### Correzioni",
      "",
      `- **${title}.** Testo.`,
      "",
      "### What's new",
      "",
      "#### Fixes",
      "",
      `- **${title}.** Text.`,
      ...(decision ? ["", "## Decisioni", "", "| ID | A | B |", "|---|---|---|", decision] : []),
      "",
    ].join("\n");

  const other = (line) =>
    ["# Frammento", "", "## Changelog", "", "### Altre modifiche", "", `- ${line}.`, ""].join("\n");

  it("il giorno riunisce i frammenti pubblicati e lascia gli altri alla versione seguente", () => {
    const day = publicationDay(
      {
        changelog,
        register,
        published: [fragment("Due", "| D002 | b | [R](../docs/product/PRODUCT.md#s01) |")],
        later: [fragment("Tre")],
      },
      "2.0.3",
      "2026-11-05",
    );
    assert.ok(day.changelog.includes("## [2.0.4]\n\n## [2.0.3] - 2026-11-05"));
    assert.ok(day.changelog.includes("- **Uno.** Primo.\n- **Due.** Testo."));
    assert.ok(!day.changelog.includes("Tre"));
    // Le righe arrivano dopo l'ultima decisione, con i link ricalcolati dal registro.
    assert.equal(
      day.register,
      "| ID | A | B |\n|---|---|---|\n| D001 | a | [R](../product/PRODUCT.md) |\n| D002 | b | [R](../product/PRODUCT.md#s01) |\n\nNota.\n",
    );
    // Senza frammenti successivi non si apre nessuna versione.
    const alone = publicationDay(
      { changelog, register, published: [], later: [] },
      "2.0.3",
      "2026-11-05",
    );
    assert.ok(alone.changelog.startsWith("# Changelog\n\n## [2.0.3] - 2026-11-05"));
    assert.equal(alone.register, register);
  });

  it("con una versione già aperta sopra, il giorno riunisce i frammenti in quella pubblicata", () => {
    const open = changelog.replace("## [2.0.3]", "## [2.0.4]\n\n## [2.0.3]");
    const day = publicationDay(
      { changelog: open, register, published: [fragment("Due")], later: [] },
      "2.0.3",
      "2026-11-05",
    );
    const top = day.changelog.slice(0, day.changelog.indexOf("## [2.0.3]"));
    assert.ok(!top.includes("Due"));
    assert.ok(day.changelog.includes("## [2.0.3] - 2026-11-05"));
    assert.ok(day.changelog.includes("- **Uno.** Primo.\n- **Due.** Testo."));
    // Righe aggiunte dopo allo stesso frammento restano; senza novità il frammento sparisce.
    const later = laterPart(`${fragment("Due")}\n- **Tre.** Altro.\n`, fragment("Due"));
    assert.ok(later.includes("- **Tre.** Altro.") && !later.includes("- **Due.** Testo."));
    assert.equal(laterPart(fragment("Due"), fragment("Due")), "");
  });

  it("legge le decisioni del frammento e ricalcola i link relativi", () => {
    assert.deepEqual(fragmentDecisions(fragment("Due", "| D002 | b | c |")), ["| D002 | b | c |"]);
    assert.deepEqual(fragmentDecisions("# Solo changelog\n"), []);
    assert.throws(() => withDecisions("nessuna tabella", ["| D002 | b | c |"]), /Tabella/u);
    assert.equal(
      rebaseLinks("[a](../docs/x.md#y) [b](https://x.it) [c](#z)", "changes", "."),
      "[a](docs/x.md#y) [b](https://x.it) [c](#z)",
    );
  });

  it("le Novità di un frammento richiedono una versione in preparazione", () => {
    assert.doesNotThrow(() => assertChangesVersion(changelog, [fragment("Due")], ["v2.0.2"]));
    const released = changelog.replace("## [2.0.3]", "## [2.0.3] - 2026-11-05");
    assert.throws(
      () => assertChangesVersion(released, [fragment("Due")], ["v2.0.3"]),
      /Novità di changes\/ richiedono una versione in preparazione/u,
    );
    // Decisioni o sole altre modifiche, come i cambi del sito, non chiedono una versione.
    assert.doesNotThrow(() =>
      assertChangesVersion(released, ["# D\n\n## Decisioni\n\n| D002 | b | c |\n"], ["v2.0.3"]),
    );
    assert.doesNotThrow(() => assertChangesVersion(released, [other("Sito")], ["v2.0.3"]));
    assert.equal(versionToOpen(released, released, [other("Sito")], ["v2.0.3"]), null);
  });

  it("un lotto senza Novità aggiunge le altre modifiche alla versione già pubblicata", () => {
    const released = changelog.replace("## [2.0.3]", "## [2.0.3] - 2026-11-05");
    const day = publicationDay(
      { changelog: released, register, published: [other("Sito")], later: [other("Console")] },
      "2.0.3",
      "2026-11-06",
    );
    assert.ok(day.changelog.startsWith("# Changelog\n\n## [2.0.3] - 2026-11-05"));
    assert.ok(day.changelog.includes("### Altre modifiche\n\n- Sito."));
    assert.ok(!day.changelog.includes("Console"));
  });

  it("al merge ammette la PR che apre la versione successiva a quella pubblicata su develop", () => {
    const released = changelog.replace("## [2.0.3]", "## [2.0.3] - 2026-11-05");
    const opened = released.replace(
      "## [2.0.3] - 2026-11-05",
      "## [2.0.4]\n\n## [2.0.3] - 2026-11-05",
    );
    assert.doesNotThrow(() =>
      assertMergedChangesVersion(released, opened, [fragment("Due")], ["v2.0.3"]),
    );
    // Senza aprirla, o con la stessa versione già pubblicata nel frattempo, il merge si ferma.
    for (const head of [released, changelog])
      assert.throws(
        () => assertMergedChangesVersion(released, head, [fragment("Due")], ["v2.0.3"]),
        /versione in preparazione/u,
      );
  });

  it("il ciclo apre la patch successiva quando develop ha pubblicato la versione della PR", () => {
    const released = changelog.replace("## [2.0.3]", "## [2.0.3] - 2026-11-05");
    // La PR teneva la 2.0.3 aperta, che develop ha pubblicato nel frattempo.
    assert.equal(versionToOpen(released, changelog, [fragment("Due")], ["v2.0.3"]), "2.0.4");
    const opened = openedChangelog(released, "2.0.4");
    assert.ok(opened.includes("## [2.0.4]\n\n## [2.0.3] - 2026-11-05"));
    assert.doesNotThrow(() =>
      assertMergedChangesVersion(released, opened, [fragment("Due")], ["v2.0.3"]),
    );
    // Versione ancora aperta, PR che ne apre già una o senza voci: nulla da aprire.
    assert.equal(versionToOpen(changelog, changelog, [fragment("Due")], ["v2.0.2"]), null);
    assert.equal(versionToOpen(released, opened, [fragment("Due")], ["v2.0.3"]), null);
    const decisions = "# D\n\n## Decisioni\n\n| D002 | b | c |\n";
    assert.equal(versionToOpen(released, changelog, [decisions], ["v2.0.3"]), null);
    assert.throws(() => openedChangelog("# Changelog\n", "2.0.4"), /Nessuna versione/u);
  });
});
