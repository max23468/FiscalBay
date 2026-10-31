import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
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
  productionReadiness,
  assertResume,
  digestDirectory,
  assertAppliedMigrations,
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
  candidateVersion,
  assertFreeze,
  assertVersionStep,
  deployTag,
  datedChangelog,
  assertPromotionSource,
  promotionBranch,
  romeDay,
  topVersion,
} from "./release.mjs";
import { releaseNotes } from "./release-notes.mjs";

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
      deploy: async (identity) => {
        calls.push("deploy");
        current = { version: "new", identity };
      },
      readback: async () => calls.push("readback"),
      save: async (state) => receipts.push(structuredClone(state)),
    };
    return { io, calls, receipts };
  };

  it("la promozione scrive il giorno della versione e le note restano in italiano", () => {
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
    assert.throws(() => datedChangelog(head, "2.0.1", "2026-11-06"), /già il giorno 2026-11-05/u);
    assert.throws(() => datedChangelog(develop, "2.0.2", "2026-11-05"), /non la 2\.0\.2/u);
    assert.throws(() => datedChangelog(develop, "2.0.1", "5 novembre"), /Giorno non valido/u);
    // Il giorno è quello italiano, anche quando in UTC è ancora il precedente.
    assert.equal(romeDay(new Date("2026-11-04T23:30:00.000Z")), "2026-11-05");
    assert.equal(promotionBranch("2.0.1"), "promuovi/2.0.1");

    const source = { headRef: "promuovi/2.0.1", files: ["CHANGELOG.md"], develop, head };
    assert.doesNotThrow(() => assertPromotionSource(source));
    assert.doesNotThrow(() => assertPromotionSource({ ...source, headRef: "develop", files: [] }));
    for (const change of [
      { headRef: "feat/novita" },
      { headRef: "promuovi/2.0.2" },
      { files: ["CHANGELOG.md", "app/root.tsx"] },
      { head: head.replace("Testo.", "Altro.") },
      { head: develop },
    ])
      assert.throws(
        () => assertPromotionSource({ ...source, ...change }),
        /promuovi\/<versione>|soltanto per il giorno|non la 2\.0\.2/u,
      );

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

  it("non anticipa i checkpoint e ricava le note dalla versione dichiarata", () => {
    assert.throws(() => productionReadiness(""), /Checkpoint/u);
    assert.equal(
      releaseNotes(
        "## [2.0.0-rc.1]\n\nCorrezione verificata.\n\n## 2.0.0-alpha.1\nPrima versione.",
        "2.0.0-rc.1",
      ),
      "Correzione verificata.",
    );
    assert.throws(() => releaseNotes("## 2.0.0\n", "2.0.0"), /vuota/u);
  });

  it("richiede tutti i gate Production del piano, senza duplicati e con prove", () => {
    const heading = "### Gate per la pubblicazione Production\n\n";
    const rows = ["commerciale", "ripristino", "operativita"].map(
      (gate) => `| ${gate} | COMPLETATO | [Prova](https://example.invalid/prova) |`,
    );
    const complete = heading + rows.join("\n") + "\n";
    assert.doesNotThrow(() => productionReadiness(complete));
    const pending = complete
      .replaceAll("COMPLETATO", "DA COMPLETARE")
      .replaceAll("[Prova](https://example.invalid/prova)", "-");
    assert.doesNotThrow(() => productionReadiness(pending, false));
    assert.throws(() => productionReadiness(pending), /Checkpoint/u);
    for (const invalid of [
      pending + rows[0],
      pending.replace("DA COMPLETARE", "SCONOSCIUTO"),
      complete.replace("[Prova](https://example.invalid/prova)", "-"),
    ])
      assert.throws(() => productionReadiness(invalid, false), /Checkpoint/u);
    for (const row of rows) {
      for (const invalid of [
        complete.replace(row, ""),
        complete.replace(row, row.replace("COMPLETATO", "DA COMPLETARE")),
        complete.replace(row, row.replace("COMPLETATO", "COMPLETATO PARZIALMENTE")),
        complete.replace(row, row.replace("[Prova](https://example.invalid/prova)", "")),
        complete.replace(row, row.replace("[Prova](https://example.invalid/prova)", "-")),
        complete + row,
        complete.replace(row, row.slice(0, -1)),
      ])
        assert.throws(() => productionReadiness(invalid), /Checkpoint/u);
    }
    assert.throws(() => productionReadiness(complete + complete), /Checkpoint/u);
    assert.throws(() => productionReadiness(rows.join("\n")), /Checkpoint/u);
    assert.throws(
      () => productionReadiness(heading + "### Altra sezione\n" + rows.join("\n")),
      /Checkpoint/u,
    );
    assert.throws(
      () => productionReadiness(heading + '<a id="altro"></a>\n' + rows.join("\n")),
      /Checkpoint/u,
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

  it("richiede interruttore, approvazione dell'owner e SHA atteso sullo stesso commit", () => {
    const env = { PRODUCTION_PUBLISH_ENABLED: "true", OWNER_APPROVED_SHA: manifest.sha };
    assert.doesNotThrow(() => assertProductionApproval(manifest, manifest.sha, env));
    for (const [expected, changed] of [
      [manifest.sha, { PRODUCTION_PUBLISH_ENABLED: "false" }],
      [manifest.sha, { OWNER_APPROVED_SHA: "c".repeat(40) }],
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

  it("conferma soltanto il candidato in testa, distribuito e non ritirato", () => {
    const receipt = { readback: true, version: "v2" };
    const current = { version: "v2", identity: releaseIdentity(manifest) };
    assert.doesNotThrow(() => assertConfirmable(manifest, receipt, manifest.sha, current));
    for (const [changedReceipt, remote, changedCurrent] of [
      [{}, "c".repeat(40), {}],
      [{ readback: false }, manifest.sha, {}],
      [{ rolledBack: true }, manifest.sha, {}],
      [{}, manifest.sha, { version: "v1" }],
      [{}, manifest.sha, { identity: `${manifest.sha}:other` }],
    ])
      assert.throws(
        () =>
          assertConfirmable(manifest, { ...receipt, ...changedReceipt }, remote, {
            ...current,
            ...changedCurrent,
          }),
        /release rifiutata/u,
      );
  });

  it("scrive gli output del deploy nel formato del workflow", () => {
    const state = { sha: "s", tree: "t", digest: "d", version: "v2", schema: [{}, {}] };
    assert.equal(
      deployReport({ ...state, rollbackCompatible: true, previous: "v1" }).output,
      "deployed=true\nversion=v2\nrollback-compatible=true\nprevious=v1\n",
    );
    assert.equal(
      deployReport(state).output,
      "deployed=true\nversion=v2\nrollback-compatible=false\nprevious=\n",
    );
    assert.match(deployReport(state).summary, /Commit s; tree t; SHA256 d; versione v2; schema 2/u);
  });

  it("con una RC in cima al changelog ammette soltanto correzioni su develop", () => {
    const frozen = "# Changelog\n\n## [2.0.0-rc.2]\n\nCorrezione.\n\n## [2.0.0-rc.1]\n\nRC.\n";
    assert.equal(candidateVersion(frozen), "2.0.0-rc.2");
    assert.equal(candidateVersion("## 2.0.0-rc.1 - 2026-10-30\n"), "2.0.0-rc.1");
    // Una versione stabile o alpha in cima non congela, e nemmeno un changelog senza versioni.
    for (const open of ["## [2.0.0]\n", "## [2.0.0-alpha.3]\n", "# Changelog\n"])
      assert.equal(candidateVersion(open), undefined);
    for (const title of [
      "fix: corregge il filtro",
      "fix(ordini): corregge il filtro",
      "docs: aggiorna il piano",
      "chore(deps): aggiorna vitest",
      "ci: rilegge il titolo",
    ])
      assert.equal(assertFreeze(frozen, title), "2.0.0-rc.2");
    for (const title of [
      "feat: nuova esportazione",
      "feat(export)!: nuovo formato",
      "  feat(ordini): filtri",
      "fix!: cambia il contratto",
      "refactor(api)!: rinomina",
    ])
      assert.throws(() => assertFreeze(frozen, title), /2\.0\.0-rc\.2 congelata/u);
    assert.equal(assertFreeze("## [2.0.0-alpha.1]\n", "feat: nuova funzione"), undefined);
  });

  it("una correzione da distribuire porta la RC successiva alla base", () => {
    const base = "# Changelog\n\n## [2.0.0-rc.2]\n\nCorrezione.\n";
    const next = `# Changelog\n\n## [2.0.0-rc.3]\n\nAltra.\n\n${base.slice(13)}`;
    assert.throws(
      () => assertFreeze(base, "fix: copy", { baseChangelog: base, deploy: true }),
      /RC successiva alla 2\.0\.0-rc\.2/u,
    );
    assert.equal(
      assertFreeze(next, "fix: copy", { baseChangelog: base, deploy: true }),
      "2.0.0-rc.3",
    );
    // Documenti e prove non cambiano la RC; senza RC nella base non c'è congelamento da seguire.
    assert.equal(
      assertFreeze(base, "docs: piano", { baseChangelog: base, deploy: false }),
      "2.0.0-rc.2",
    );
    assert.equal(
      assertFreeze("## [2.0.0]\n", "fix: copy", { baseChangelog: "## [2.0.0]\n", deploy: true }),
      undefined,
    );
  });

  it("la versione del lotto sale di un solo passo dall'ultima pubblicata", () => {
    const section = (version) => `# Changelog\n\n## [${version}]\n\nVoce.\n`;
    const ok = [
      // Fino alla 2.0.0 la RC prosegue e la versione finale segue la propria RC.
      ["2.0.0-rc.12", "2.0.0-rc.13", []],
      ["2.0.0-rc.12", "2.0.0", []],
      // Dopo, la prima modifica visibile apre la versione successiva; le altre la alzano.
      ["2.0.0", "2.0.1", ["v2.0.0", "v1.14.0"]],
      ["2.0.0", "2.1.0", ["v2.0.0"]],
      ["2.0.1", "2.1.0", ["v2.0.0"]],
      ["2.1.0", "2.1.1", ["v2.0.0", "v2.1.0"]],
    ];
    for (const [base, head, tags] of ok)
      assert.doesNotThrow(() => assertVersionStep(section(head), section(base), tags), head);
    const rejected = [
      ["2.0.0-rc.12", "2.0.0-rc.14", [], /RC sale di uno/u],
      ["2.0.0-rc.12", "2.0.1", [], /non è un passo dalla prima pubblicazione/u],
      ["2.0.0-rc.12", "Novità", [], /serve una versione/u],
      ["2.0.0", "2.0.2", ["v2.0.0"], /ammesse 2\.0\.1, 2\.1\.0, 3\.0\.0/u],
      ["2.0.0", "2.0.1-rc.1", ["v2.0.0"], /senza RC/u],
      ["2.1.0", "2.0.1", ["v2.0.0"], /scende da 2\.1\.0 a 2\.0\.1/u],
      ["2.0.1", "2.0.0", ["v2.0.0"], /non è un passo dalla 2\.0\.0/u],
    ];
    for (const [base, head, tags, message] of rejected)
      assert.throws(() => assertVersionStep(section(head), section(base), tags), message);
    // Una sezione invariata in cima non chiede nulla.
    assert.doesNotThrow(() => assertVersionStep(section("2.0.0"), section("2.0.0"), ["v2.0.0"]));
  });

  it("l'etichetta del deploy porta la versione soltanto dopo la prima 2.x pubblicata", () => {
    const tag = (version, environment, releasedTags, expected, day = "2026-11-05") =>
      deployTag({
        changelog: `# Changelog\n\n## [${version}]${day ? ` - ${day}` : ""}\n`,
        environment,
        sha: "a".repeat(40),
        tree: "b".repeat(40),
        releasedTags,
        expected,
      });
    assert.equal(tag("2.0.0-rc.12", "test", ["v1.14.0", ""]), "a".repeat(12));
    assert.equal(tag("2.0.0", "production", [], "2.0.0"), "a".repeat(12));
    assert.equal(tag("2.0.1", "test", ["v2.0.0"]), `2.0.1-dev.${"b".repeat(12)}`);
    assert.equal(tag("2.0.1", "production", ["v2.0.0"], "2.0.1"), "2.0.1");
    assert.throws(() => tag("2.0.1", "production", ["v2.0.0"], "2.0.2"), /versione 2\.0\.2/u);
    assert.throws(() => tag("2.0.1-rc.1", "production", ["v2.0.0"], "2.0.1-rc.1"), /non la/u);
    // In Production la versione porta il giorno scritto dalla promozione; sul test no.
    assert.throws(() => tag("2.0.1", "production", ["v2.0.0"], "2.0.1", ""), /non ha il giorno/u);
    assert.equal(tag("2.0.1", "test", ["v2.0.0"], undefined, ""), `2.0.1-dev.${"b".repeat(12)}`);
  });
});
