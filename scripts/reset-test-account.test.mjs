import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";

import { testAccount } from "../e2e/test-account.ts";
import { resetStatements, sessionStatements } from "./reset-test-account.mjs";

/** Schema reale: tutte le migration, nell'ordine in cui le applica D1. */
function migrated() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  for (const file of readdirSync("migrations")
    .filter((name) => name.endsWith(".sql"))
    .sort())
    db.exec(readFileSync(`migrations/${file}`, "utf8"));
  return db;
}

describe("ripristino dell'account di collaudo", () => {
  it("non lascia avvisi all'owner per lo spazio ricreato, anche ripetuto", async () => {
    const db = migrated();
    const statements = await resetStatements("x".repeat(32));
    for (let run = 0; run < 2; run++) db.exec(statements.join("\n"));
    const count = (sql, ...params) => db.prepare(sql).get(...params).n;
    assert.equal(
      count(
        "SELECT COUNT(*) AS n FROM ebay_stores WHERE workspace_id = ?",
        testAccount.workspaceId,
      ),
      Object.keys(testAccount.stores).length,
    );
    // Il trigger del primo negozio scatta davvero: l'avviso nasce e il ripristino lo toglie.
    assert.equal(
      count(
        "SELECT COUNT(*) AS n FROM workspace_funnel_steps WHERE workspace_id = ? AND step = 'store_linked'",
        testAccount.workspaceId,
      ),
      1,
    );
    assert.equal(
      count(
        "SELECT COUNT(*) AS n FROM owner_notifications WHERE workspace_id = ?",
        testAccount.workspaceId,
      ),
      0,
    );
  });

  it("le sessioni sintetiche producono sempre lo stesso SQL e valgono sullo schema reale", async (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: Date.UTC(2026, 10, 11, 9, 30, 15, 123) });
    const statements = sessionStatements();
    // Impronta dell'elenco completo: una riscrittura che non cambia le fixture la lascia uguale;
    // dopo una modifica voluta delle fixture si aggiorna qui.
    assert.equal(statements.length, 146);
    assert.equal(
      createHash("sha256").update(statements.join("\n")).digest("hex"),
      "be78f70f4862bcaeb0ff7c79e125771c62591177a969f0ade73a9b596ccbbc3f",
    );
    const db = migrated();
    const sql = [...(await resetStatements("x".repeat(32))), ...statements].join("\n");
    for (let run = 0; run < 2; run++) db.exec(sql);
    const sessions = db
      .prepare(`SELECT COUNT(*) AS n FROM session WHERE "userId" <> ?`)
      .get(testAccount.userId).n;
    assert.ok(sessions > 100);
  });
});
