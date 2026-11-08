import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  affectedModules,
  affectingSources,
  lineMutationJob,
  moduleOutcomes,
  mutationJob,
  previousRuns,
  planLayout,
  proofStands,
  proofUnaffected,
  pullRequestParts,
  pullRequestOutcome,
  pullRequestProof,
  reusePlan,
} from "./mutation-reuse.mjs";
import { execFileSync } from "node:child_process";

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

  it("riusa un modulo critico cambiato soltanto se provato nella sua PR", async () => {
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
    const job = (name, conclusion = "success") => ({ name, conclusion });
    const target = "app/auth.server.ts";
    const both = [job(`Mutation ${target} 1/2`), job(`Mutation ${target} 2/2`)];
    assert.equal(pullRequestOutcome(both, target), "passed");
    assert.equal(pullRequestOutcome([job(`Mutation ${target} 1/1`)], target), "passed");
    assert.equal(pullRequestOutcome([job(`Mutation ${target}`)], target), "passed");
    // Una parte non ancora partita manca dall'elenco: nessun esito.
    assert.equal(pullRequestOutcome([both[0]], target), null);
    assert.equal(
      pullRequestOutcome([both[0], job(`Mutation ${target} 2/2`, "cancelled")], target),
      null,
    );
    assert.equal(
      pullRequestOutcome([both[0], job(`Mutation ${target} 2/2`, "failure")], target),
      "failed",
    );
    assert.equal(
      pullRequestOutcome([both[0], job(`Mutation ${target} 2/2`, "timed_out")], target),
      "failed",
    );
    // Parti di una divisione diversa non si sommano.
    assert.equal(pullRequestOutcome([both[0], job(`Mutation ${target} 2/3`)], target), null);
    assert.equal(pullRequestOutcome([job("Mutation app/sealed.server.ts 1/1")], target), null);
  });

  it("una prova della PR resta valida soltanto se nulla di ciò che usa il modulo è cambiato", () => {
    const graph = new Map([
      ["app/domain/billing.server.ts", new Set(["app/domain/grants.server.ts"])],
      ["app/domain/grants.server.ts", new Set()],
      ["app/domain/other.server.ts", new Set()],
      ["test/billing.spec.ts", new Set(["app/domain/billing.server.ts"])],
      ["test/other.spec.ts", new Set(["app/domain/other.server.ts"])],
    ]);
    const target = "app/domain/billing.server.ts";
    const valid = (...changed) => proofUnaffected(changed, target, graph);
    assert.ok(valid());
    assert.ok(valid("docs/ROADMAP.md", "changes/x.md", "e2e/a.spec.ts", "app/app.css"));
    assert.ok(valid("app/domain/other.server.ts", "test/other.spec.ts"));
    assert.ok(valid("scripts/indexnow.mjs", ".github/workflows/security.yml", "public/a.png"));
    // Strumenti della mutation e dipendenze restano alla campagna settimanale.
    assert.ok(
      valid(
        "package.json",
        "pnpm-lock.yaml",
        "stryker.config.json",
        "vitest.mutation.config.ts",
        "scripts/mutation.mjs",
        ".github/workflows/ci.yml",
        ".github/workflows/mutation.yml",
      ),
    );
    for (const changed of [
      target,
      "app/domain/grants.server.ts",
      "test/billing.spec.ts",
      "test/fixtures/database-fixtures.ts",
      "migrations/0080_x.sql",
      "app/request-limits.json",
    ])
      assert.ok(!valid(changed), changed);
  });

  it("riusa la prova di una run precedente della stessa PR dopo un'unione che non tocca il modulo", async () => {
    const target = "app/domain/billing.server.ts";
    const graph = new Map([
      [target, new Set()],
      ["app/domain/other.server.ts", new Set()],
    ]);
    const passed = [{ name: `Mutation ${target} 1/1`, conclusion: "success" }];
    const fake = ({ runs, jobs, compare = {} }) => {
      const calls = [];
      const api = async (url) => {
        calls.push(url);
        if (url.includes("/workflows/ci.yml/runs")) return { workflow_runs: runs };
        const id = /runs\/(\d+)\/jobs/u.exec(url)?.[1];
        if (id) return { jobs: jobs[id] ?? [], total_count: (jobs[id] ?? []).length };
        const pair = /compare\/(\w+)\.\.\.(\w+)/u.exec(url);
        return compare[pair[1]] ?? { status: "diverged", files: [] };
      };
      return { api, calls };
    };
    const run = (id, sha, created, repo = 1) => ({
      id,
      head_sha: sha,
      created_at: created,
      head_repository: { id: repo },
    });
    const ask = (api, extra = {}) =>
      pullRequestProof(
        {
          repository: "o/r",
          repositoryId: 1,
          branch: "feat/x",
          head: "h3",
          target,
          graph,
          exclude: 9,
          ...extra,
        },
        api,
        async () => null,
      );
    const runs = [
      run(9, "h3", "2026-11-07T22:20:00Z"),
      run(8, "h2", "2026-11-07T21:09:00Z"),
      run(7, "h1", "2026-11-07T19:00:00Z"),
    ];
    // La run più recente con un esito, su un antenato, senza cambi del modulo: riusata.
    const merge = { status: "ahead", files: [{ filename: "app/domain/other.server.ts" }] };
    const reused = fake({ runs, jobs: { 8: passed }, compare: { h2: merge } });
    assert.deepEqual(await ask(reused.api), { run: 8, commit: "h2", runs: [8] });
    assert.ok(!reused.calls.some((url) => url.includes("/runs/9/jobs")));
    // La stessa testa non richiede il confronto.
    assert.deepEqual(await ask(fake({ runs, jobs: { 9: passed } }).api, { exclude: 0 }), {
      run: 9,
      commit: "h3",
      runs: [9],
    });
    // Run 8 senza esito del modulo, annullata o in corso: decide la 7.
    const older = fake({
      runs,
      jobs: { 8: [{ name: `Mutation ${target} 1/2`, conclusion: "success" }], 7: passed },
      compare: { h1: merge },
    });
    assert.deepEqual(await ask(older.api), { run: 7, commit: "h1", runs: [7] });
    // Un fallimento recente non si copre con un successo più vecchio.
    const failed = fake({
      runs,
      jobs: { 8: [{ name: `Mutation ${target} 1/1`, conclusion: "failure" }], 7: passed },
      compare: { h1: merge },
    });
    assert.equal(await ask(failed.api), null);
    // Il modulo cambiato, un commit non antenato, troppi file o un altro repository: nessun riuso.
    const touched = { status: "ahead", files: [{ filename: target }] };
    assert.equal(
      await ask(fake({ runs, jobs: { 8: passed }, compare: { h2: touched } }).api),
      null,
    );
    const diverged = { status: "diverged", files: [] };
    assert.equal(
      await ask(fake({ runs, jobs: { 8: passed }, compare: { h2: diverged } }).api),
      null,
    );
    const many = {
      status: "ahead",
      files: Array.from({ length: 300 }, (_, index) => ({ filename: `docs/${index}.md` })),
    };
    assert.equal(await ask(fake({ runs, jobs: { 8: passed }, compare: { h2: many } }).api), null);
    const foreign = [run(8, "h2", "2026-11-07T21:09:00Z", 2)];
    assert.equal(await ask(fake({ runs: foreign, jobs: { 8: passed } }).api), null);
    assert.equal(await ask(fake({ runs: [], jobs: {} }).api), null);
  });
});

describe("parti della mutation della PR riusate fra run", () => {
  const target = "app/domain/billing.server.ts";
  const graph = new Map([
    [target, new Set(["app/domain/grants.server.ts"])],
    ["app/domain/grants.server.ts", new Set()],
    ["app/domain/other.server.ts", new Set()],
  ]);
  const ranges = JSON.stringify([
    { start: 1, end: 40, mutants: 60 },
    { start: 41, end: 80, mutants: 70 },
    { start: 81, end: 120, mutants: 50 },
  ]);
  const plan = (digest = "d1", layout = ranges, total = 3) => ({
    include: Array.from({ length: total }, (_, index) => ({
      target,
      shard: `${index + 1}/${total}`,
      ranges: layout,
      digest,
    })),
  });
  const job = (part, conclusion = "success", total = 3) => ({
    name: `Mutation ${target} ${part}/${total}`,
    conclusion,
  });
  const run = (id, sha) => ({
    id,
    head_sha: sha,
    created_at: `2026-11-08T10:${String(id).padStart(2, "0")}:00Z`,
    head_repository: { id: 1 },
  });
  const parts = ({ runs, jobs, plans, compare = {}, excused, digest = "d1" }) =>
    pullRequestParts(
      {
        repository: "o/r",
        repositoryId: 1,
        branch: "feat/x",
        head: "m",
        target,
        graph,
        digest,
        exclude: 99,
        excused,
      },
      async (url) => {
        if (url.includes("/workflows/ci.yml/runs")) return { workflow_runs: runs };
        const id = /runs\/(\d+)\/jobs/u.exec(url)?.[1];
        if (id) return { jobs: jobs[id] ?? [], total_count: (jobs[id] ?? []).length };
        const sha = /compare\/(\w+)\.\.\./u.exec(url)[1];
        return compare[sha] ?? { status: "ahead", files: [{ filename: "docs/a.md" }] };
      },
      async (_, id) => plans[id] ?? null,
    );
  const runs = [run(3, "c3"), run(2, "c2"), run(1, "c1")];

  it("riconosce la divisione del modulo nel piano della run", () => {
    assert.deepEqual(planLayout(plan(), target), {
      total: 3,
      digest: "d1",
      ranges,
      key: "[[1,40],[41,80],[81,120]]",
    });
    // Le stime possono cambiare senza cambiare i tagli; una parte sola copre tutto il sorgente.
    const estimated = JSON.stringify(
      JSON.parse(ranges).map((range) => ({ ...range, estimatedMs: 9 })),
    );
    assert.equal(planLayout(plan("d1", estimated), target).key, planLayout(plan(), target).key);
    assert.equal(
      planLayout({ include: [{ target, shard: "1/1", digest: "d1" }] }, target).key,
      "whole",
    );
    assert.equal(planLayout({ include: [] }, target), null);
    assert.equal(planLayout(null, target), null);
  });

  it("somma le parti riuscite in run diverse con lo stesso piano", async () => {
    // La run 3, annullata dopo un push, ha provato la parte 2; la 2 le parti 1 e 3 prima di
    // un'unione di develop che non tocca il modulo.
    const result = await parts({
      runs,
      jobs: { 3: [job(1, "cancelled"), job(2)], 2: [job(1), job(2, "cancelled"), job(3)] },
      plans: { 3: plan(), 2: plan() },
    });
    assert.deepEqual(result, {
      total: 3,
      ranges,
      proved: [
        { part: 1, run: 2, commit: "c2" },
        { part: 2, run: 3, commit: "c3" },
        { part: 3, run: 2, commit: "c2" },
      ],
      missing: [],
    });
    // Una parte mai riuscita resta da provare, con gli intervalli del riferimento.
    const partial = await parts({
      runs,
      jobs: { 3: [job(2)], 2: [job(3)] },
      plans: { 3: plan(), 2: plan() },
    });
    assert.deepEqual(partial.missing, [1]);
    assert.equal(partial.ranges, ranges);
  });

  it("scarta le parti di un piano diverso o di un sorgente cambiato", async () => {
    const other = JSON.stringify([
      { start: 1, end: 60, mutants: 90 },
      { start: 61, end: 100, mutants: 60 },
      { start: 101, end: 120, mutants: 30 },
    ]);
    // Intervalli diversi nella run 2: contano soltanto le parti della run più recente.
    const moved = await parts({
      runs,
      jobs: { 3: [job(2)], 2: [job(1), job(3)], 1: [job(1), job(3)] },
      plans: { 3: plan(), 2: plan("d1", other), 1: plan() },
    });
    assert.deepEqual(moved.missing, [1, 3]);
    // Il riferimento con un'altra impronta del sorgente: nessuna parte vale.
    assert.equal(
      await parts({ runs, jobs: { 3: [job(1), job(2), job(3)] }, plans: { 3: plan("d0") } }),
      null,
    );
    // La run 2 ha un'altra impronta: le sue parti non si sommano a quelle della 3.
    const changed = await parts({
      runs,
      jobs: { 3: [job(2)], 2: [job(1), job(3)] },
      plans: { 3: plan(), 2: plan("d0") },
    });
    assert.deepEqual(changed.missing, [1, 3]);
  });

  it("non copre un fallimento recente della stessa parte con un successo più vecchio", async () => {
    const result = await parts({
      runs,
      jobs: { 3: [job(1, "failure"), job(2, "timed_out")], 2: [job(1), job(2), job(3)] },
      plans: { 3: plan(), 2: plan() },
    });
    assert.deepEqual(result.missing, [1, 2]);
    assert.deepEqual(result.proved, [{ part: 3, run: 2, commit: "c2" }]);
  });

  it("ripete le parti di una run il cui commit non è antenato o i cui cambi toccano il modulo", async () => {
    const jobs = { 3: [job(2)], 2: [job(1), job(3)] };
    const plans = { 3: plan(), 2: plan() };
    const diverged = await parts({
      runs,
      jobs,
      plans,
      compare: { c2: { status: "diverged", files: [] } },
    });
    assert.deepEqual(diverged.missing, [1, 3]);
    const touched = { status: "ahead", files: [{ filename: "app/domain/grants.server.ts" }] };
    const stale = await parts({ runs, jobs, plans, compare: { c2: touched } });
    assert.deepEqual(stale.missing, [1, 3]);
  });

  it("riusa la prova dopo una base avanzata su un modulo critico provato nella sua PR", async () => {
    const jobs = { 3: [job(1), job(2), job(3)] };
    const plans = { 3: plan() };
    const advanced = { status: "ahead", files: [{ filename: "app/domain/grants.server.ts" }] };
    const asked = [];
    const covered = await parts({
      runs,
      jobs,
      plans,
      compare: { c3: advanced },
      excused: async (source, commit) => {
        asked.push([source, commit]);
        return true;
      },
    });
    assert.deepEqual(covered.missing, []);
    assert.deepEqual(asked, [["app/domain/grants.server.ts", "c3"]]);
    // Senza la prova nella PR di develop la base avanzata ripete il modulo.
    const uncovered = await parts({
      runs,
      jobs,
      plans,
      compare: { c3: advanced },
      excused: async () => false,
    });
    assert.deepEqual(uncovered.missing, [1, 2, 3]);
  });

  it("scusa soltanto sorgenti critici diversi dal modulo, mai test o file non neutri", async () => {
    const tests = new Map([...graph, ["test/billing.spec.ts", new Set([target])]]);
    const yes = async () => true;
    assert.ok(await proofStands(["app/domain/grants.server.ts"], target, tests, yes));
    assert.ok(!(await proofStands(["app/domain/grants.server.ts"], target, tests)));
    assert.ok(!(await proofStands([target], target, tests, yes)));
    assert.ok(
      !(await proofStands(
        ["app/money.ts"],
        target,
        new Map([[target, new Set(["app/money.ts"])]]),
        yes,
      )),
    );
    assert.ok(!(await proofStands(["test/billing.spec.ts"], target, tests, yes)));
    assert.ok(!(await proofStands(["migrations/0099_x.sql"], target, tests, yes)));
  });
});

describe("lettura delle run precedenti", () => {
  const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const run = (id, created) => ({
    id,
    path: ".github/workflows/candidate.yml",
    event: "workflow_dispatch",
    repository: { id: 1 },
    head_repository: { id: 1 },
    head_sha: head,
    created_at: created,
    conclusion: "success",
  });
  const job = (target) => ({
    name: `Qualifica candidato / Mutation / ${target} 1/1`,
    conclusion: "success",
    steps: [{}],
  });
  const fake = (jobsOf) => {
    const calls = [];
    const api = async (url) => {
      calls.push(url);
      if (url.includes("/workflows/candidate.yml/runs"))
        return {
          workflow_runs: [
            run(3, "2026-11-07T03:00:00Z"),
            run(2, "2026-11-07T02:00:00Z"),
            run(1, "2026-11-07T01:00:00Z"),
          ],
        };
      if (url.includes("/workflows/")) return { workflow_runs: [] };
      const id = Number(/runs\/(\d+)\/jobs/u.exec(url)[1]);
      const jobs = jobsOf[id] ?? [];
      return { jobs, total_count: jobs.length };
    };
    return { api, calls };
  };

  it("si ferma quando ogni modulo richiesto ha l'esito più recente", async () => {
    const { api, calls } = fake({
      3: [job("app/a.server.ts")],
      2: [job("app/b.server.ts")],
      1: [job("app/c.server.ts")],
    });
    const runs = await previousRuns("o/r", 1, ["app/a.server.ts", "app/b.server.ts"], api);
    assert.deepEqual(
      runs.map(({ id }) => id),
      [3, 2],
    );
    assert.equal(
      calls.some((url) => url.includes("/runs/1/jobs")),
      false,
    );
  });

  it("legge tutte le run se un modulo non ha esiti e nessuna senza moduli", async () => {
    const { api, calls } = fake({ 3: [job("app/a.server.ts")] });
    assert.equal((await previousRuns("o/r", 1, ["app/z.server.ts"], api)).length, 3);
    const empty = fake({});
    assert.deepEqual(await previousRuns("o/r", 1, [], empty.api), []);
    assert.equal(empty.calls.length, 0);
    assert.ok(calls.length > 0);
  });
});
