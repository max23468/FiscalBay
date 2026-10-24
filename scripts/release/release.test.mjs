import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
  declaredReview,
  migrationPlan,
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
