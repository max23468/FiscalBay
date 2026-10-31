import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";

import { testAccount } from "../e2e/test-account.ts";
import { resetStatements } from "./reset-test-account.mjs";

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
});
