import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { affectedModules, moduleOutcomes, mutationJob, reusePlan } from "./mutation-reuse.mjs";

describe("mutation incrementale della prova del candidato", () => {
  it("riconosce i job di mutation della qualifica e della campagna", () => {
    assert.deepEqual(
      mutationJob("Qualifica candidato / Mutation / app/domain/orders.server.ts 2/3"),
      {
        target: "app/domain/orders.server.ts",
        part: 2,
        parts: 3,
      },
    );
    assert.deepEqual(mutationJob("app/markup.ts 1/1"), {
      target: "app/markup.ts",
      part: 1,
      parts: 1,
    });
    for (const name of ["Qualifica candidato / browser (source, 1)", "Mutation / Select modules"])
      assert.equal(mutationJob(name), null);
  });

  it("considera superato un modulo soltanto con ogni parte riuscita", () => {
    const job = (name, conclusion = "success") => ({ name: `Mutation / ${name}`, conclusion });
    const outcomes = moduleOutcomes([
      job("app/a.server.ts 1/2"),
      job("app/a.server.ts 2/2"),
      job("app/b.server.ts 1/2"),
      job("app/b.server.ts 2/2", "failure"),
      job("app/c.server.ts 1/2"),
      job("app/d.server.ts 1/1", "cancelled"),
      job("app/e.server.ts 1/1"),
      job("app/e.server.ts 1/1"),
    ]);
    assert.deepEqual(Object.fromEntries(outcomes), {
      "app/a.server.ts": "passed",
      "app/b.server.ts": "failed",
      "app/c.server.ts": "failed",
      "app/d.server.ts": "failed",
      "app/e.server.ts": "failed",
    });
  });

  it("ripete i moduli critici che importano un sorgente modificato, anche di supporto", () => {
    const graph = new Map([
      ["app/domain/orders.server.ts", new Set(["app/domain/sql.server.ts"])],
      ["app/domain/export-jobs.server.ts", new Set(["app/domain/orders.server.ts"])],
      ["app/domain/billing.server.ts", new Set()],
      ["app/domain/sql.server.ts", new Set()],
    ]);
    assert.deepEqual(
      [...affectedModules(["app/domain/sql.server.ts", "test/orders.spec.ts", "docs/x.md"], graph)],
      ["app/domain/orders.server.ts", "app/domain/export-jobs.server.ts"],
    );
    assert.deepEqual([...affectedModules(["test/orders.spec.ts"], graph)], []);
  });

  it("riusa solo l'ultimo esito riuscito e non toccato, mai con strumenti cambiati", () => {
    const outcomes = (entries) => new Map(Object.entries(entries));
    const runs = [
      { id: 3, commit: "c3", outcomes: outcomes({ "app/a.ts": "failed", "app/b.ts": "passed" }) },
      { id: 2, commit: "c2", outcomes: outcomes({ "app/a.ts": "passed", "app/c.ts": "passed" }) },
      { id: 1, commit: "c1", outcomes: outcomes({ "app/d.ts": "passed", "app/e.ts": "passed" }) },
    ];
    const affected = { c3: new Set(["app/b.ts"]), c2: new Set(), c1: null };
    const plan = reusePlan(
      ["app/a.ts", "app/b.ts", "app/c.ts", "app/d.ts", "app/f.ts"],
      runs,
      (commit) => affected[commit],
    );
    // Fallito di recente, toccato dal diff, strumenti cambiati o mai provato: si ripete.
    assert.deepEqual(plan.run, ["app/a.ts", "app/b.ts", "app/d.ts", "app/f.ts"]);
    assert.deepEqual(plan.reused, [{ target: "app/c.ts", run: 2, commit: "c2" }]);
  });
});
