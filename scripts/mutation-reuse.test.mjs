import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  affectedModules,
  affectingSources,
  lineMutationJob,
  linesProved,
  moduleOutcomes,
  mutationJob,
  reusePlan,
} from "./mutation-reuse.mjs";

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
    const job = (name, conclusion = "success") => ({
      name: `Mutation / ${name}`,
      conclusion,
      steps: [{}],
    });
    const outcomes = moduleOutcomes([
      job("app/a.server.ts 1/2"),
      job("app/a.server.ts 2/2"),
      job("app/b.server.ts 1/2"),
      job("app/b.server.ts 2/2", "failure"),
      job("app/c.server.ts 1/2"),
      job("app/d.server.ts 1/1", "cancelled"),
      job("app/e.server.ts 1/1"),
      job("app/e.server.ts 1/1"),
      { name: "Mutation / app/f.server.ts 1/1", conclusion: "cancelled", steps: [] },
      { name: "Mutation / app/g.server.ts 1/1", conclusion: "cancelled", steps: [{}] },
    ]);
    assert.deepEqual(Object.fromEntries(outcomes), {
      "app/a.server.ts": "passed",
      "app/b.server.ts": "failed",
      "app/c.server.ts": "failed",
      "app/d.server.ts": "failed",
      "app/e.server.ts": "failed",
      "app/g.server.ts": "failed",
    });
  });

  it("in una run annullata ignora i moduli interrotti, non li conta come falliti", () => {
    const job = (name, conclusion = "success") => ({
      name: `Mutation / ${name}`,
      conclusion,
      steps: [{}],
    });
    const jobs = [
      job("app/a.server.ts 1/2"),
      job("app/a.server.ts 2/2", "cancelled"),
      job("app/b.server.ts 1/1"),
      job("app/c.server.ts 1/1", "failure"),
    ];
    assert.deepEqual(Object.fromEntries(moduleOutcomes(jobs, true)), {
      "app/b.server.ts": "passed",
      "app/c.server.ts": "failed",
    });
    assert.equal(moduleOutcomes(jobs).get("app/a.server.ts"), "failed");
  });

  it("un testo cambiato conta per sé, non per chi lo importa", () => {
    const graph = new Map([
      ["app/domain/telegram.server.ts", new Set(["app/copy/copy-it.ts"])],
      ["app/copy/copy-it.ts", new Set()],
    ]);
    assert.deepEqual([...affectedModules(["app/copy/copy-it.ts"], graph)], []);
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

  it("riusa solo l'ultimo esito riuscito e non toccato", async () => {
    const outcomes = (entries) => new Map(Object.entries(entries));
    const runs = [
      { id: 3, commit: "c3", outcomes: outcomes({ "app/a.ts": "failed", "app/b.ts": "passed" }) },
      { id: 2, commit: "c2", outcomes: outcomes({ "app/a.ts": "passed", "app/c.ts": "passed" }) },
      { id: 1, commit: "c1", outcomes: outcomes({ "app/d.ts": "passed", "app/e.ts": "passed" }) },
    ];
    const affected = {
      c3: new Map([["app/b.ts", new Set(["app/b.ts"])]]),
      c2: new Map(),
      c1: new Map(),
    };
    const plan = await reusePlan(
      ["app/a.ts", "app/b.ts", "app/c.ts", "app/d.ts", "app/f.ts"],
      runs,
      (commit) => affected[commit],
    );
    // Fallito di recente, toccato dal diff o mai provato: si ripete.
    assert.deepEqual(plan.run, ["app/a.ts", "app/b.ts", "app/f.ts"]);
    assert.deepEqual(plan.reused, [
      { target: "app/c.ts", run: 2, commit: "c2" },
      { target: "app/d.ts", run: 1, commit: "c1" },
    ]);
  });

  it("riusa un modulo critico cambiato soltanto con le righe provate nella sua PR", async () => {
    const orders = "app/domain/orders.server.ts";
    const exports = "app/domain/export-jobs.server.ts";
    const sql = "app/domain/sql.server.ts";
    const runs = [
      {
        id: 5,
        commit: "c5",
        outcomes: new Map([
          [orders, "passed"],
          [exports, "passed"],
        ]),
      },
    ];
    const graph = new Map([
      [orders, new Set([sql])],
      [exports, new Set([orders])],
      [sql, new Set()],
    ]);
    const calls = [];
    const covered = async (source, commit) => {
      calls.push(`${source} ${commit}`);
      return source === orders;
    };
    // Il modulo cambiato e il suo consumatore critico si riusano con la prova della PR.
    const proved = await reusePlan(
      [orders, exports],
      runs,
      () => affectingSources([orders], graph),
      covered,
    );
    assert.deepEqual(proved.run, []);
    assert.deepEqual(
      proved.reused.map(({ target, lines }) => [target, lines]),
      [
        [orders, [orders]],
        [exports, [orders]],
      ],
    );
    // Un sorgente non critico cambiato non ha una prova delle righe: si ripete chi lo importa.
    const support = await reusePlan(
      [orders, exports],
      runs,
      () => affectingSources([sql], graph),
      covered,
    );
    assert.deepEqual(support.run, [orders, exports]);
    assert.ok(!calls.includes(`${sql} c5`));
    // Senza la prova della PR il modulo si ripete.
    const missing = await reusePlan(
      [orders],
      runs,
      () => affectingSources([orders], graph),
      async () => false,
    );
    assert.deepEqual(missing.run, [orders]);
  });

  it("legge la prova delle righe dalla CI della PR, parti comprese", () => {
    assert.equal(lineMutationJob("Mutation app/auth.server.ts"), "app/auth.server.ts");
    assert.equal(lineMutationJob("Mutation app/auth.server.ts 2/3"), "app/auth.server.ts");
    for (const name of ["Mutation", "Browser 1/8", "Gate", "Mutation docs/x.md"])
      assert.equal(lineMutationJob(name), null);
    const run = { conclusion: "success" };
    const job = (name, conclusion = "success") => ({ name, conclusion });
    const target = "app/auth.server.ts";
    assert.ok(
      linesProved(run, [job(`Mutation ${target} 1/2`), job(`Mutation ${target} 2/2`)], target),
    );
    assert.ok(
      !linesProved(
        run,
        [job(`Mutation ${target} 1/2`), job(`Mutation ${target} 2/2`, "failure")],
        target,
      ),
    );
    assert.ok(!linesProved(run, [job("Mutation app/sealed.server.ts")], target));
    assert.ok(!linesProved({ conclusion: "failure" }, [job(`Mutation ${target}`)], target));
  });
});
