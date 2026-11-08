import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  browserOutcome,
  browserProof,
  shardTests,
  listedTestIds,
  browserShards,
} from "./browser-tests.mjs";
import { assertCandidateReports } from "./browser-evidence.mjs";

describe("coordinamento e provenienza della pubblicazione", () => {
  it("certifica tutte le partizioni browser solo con prove coerenti e complete", () => {
    const shards = { source: [1, 2, 3, 4, 5, 6, 7, 8], production: [1] };
    const parts = ["source", "production"].flatMap((kind) =>
      shards[kind].map((shard) => ({
        kind,
        shard,
        attempt: 1,
        report: {
          sha: "commit",
          status: "passed",
          partial: false,
          dirty: false,
          environment: kind === "source" ? "local" : "production",
          baseURL: "locale",
          counts: { passed: 1 },
          rows: [{ id: `${kind}-${shard}`, status: "passed" }],
        },
      })),
    );
    const expected = Object.fromEntries(
      ["source", "production"].map((kind) => [
        kind,
        shards[kind].map((shard) => `${kind}-${shard}`),
      ]),
    );
    assert.doesNotThrow(() => assertCandidateReports(parts, "commit", expected));
    assert.throws(
      () =>
        assertCandidateReports(parts, "commit", {
          ...expected,
          source: [...expected.source, "source-omitted"],
        }),
      /inventario/u,
    );
    assert.throws(
      () =>
        assertCandidateReports(parts, "commit", {
          ...expected,
          production: expected.production.slice(1),
        }),
      /inventario/u,
    );
    assert.throws(
      () =>
        assertCandidateReports(parts, "commit", {
          ...expected,
          production: ["production-unknown", ...expected.production.slice(1)],
        }),
      /inventario/u,
    );
    assert.throws(() => assertCandidateReports(parts, "commit"), /inventario/u);
    assert.throws(() => assertCandidateReports(parts.slice(1), "commit", expected));
    for (const change of [
      { sha: "other" },
      { partial: true },
      { dirty: true },
      { status: "failed" },
      { counts: { passed: 0 } },
      { rows: [] },
      { counts: { passed: 2 } },
      { rows: [{ id: "failed-row", status: "failed" }] },
      { partial: undefined },
    ]) {
      const invalid = [
        ...parts.slice(0, 7),
        { ...parts[7], report: { ...parts[7].report, ...change } },
      ];
      assert.throws(() => assertCandidateReports(invalid, "commit", expected));
    }
    assert.throws(() =>
      assertCandidateReports(
        [...parts, { ...parts[0], attempt: 2, report: { ...parts[0].report, status: "failed" } }],
        "commit",
        expected,
      ),
    );
    assert.throws(() =>
      assertCandidateReports(
        parts.map((part) =>
          part.kind === "source"
            ? { ...part, report: { ...part.report, rows: [{ id: "duplicate", status: "passed" }] } }
            : part,
        ),
        "commit",
        expected,
      ),
    );
  });
});

describe("prove browser divise fra macchine", () => {
  it("dimensiona i runner sulla selezione senza shard vuoti", () => {
    assert.deepEqual(browserShards(4), { include: [{ shard: 1, total: 1 }] });
    assert.equal(browserShards(164).include.length, 2);
    assert.equal(browserShards(1136).include.length, 8);
    assert.throws(() => browserShards(0), /vuoto/u);
  });
  it("raccoglie ogni scenario funzionale in Chromium e WebKit", () => {
    const result = spawnSync(
      "pnpm",
      ["exec", "playwright", "test", "--list", "--reporter", "json"],
      {
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
        env: { ...process.env, E2E_BASE_URL: "", E2E_PRODUCTION: "", E2E_MATRIX: "single" },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    const scenarios = new Map();
    const visit = (suite) => {
      for (const spec of suite.specs ?? []) {
        const key = `${spec.file}:${spec.line}:${spec.column}:${spec.title}`;
        const projects = scenarios.get(key) ?? new Set();
        for (const test of spec.tests) projects.add(test.projectName);
        scenarios.set(key, projects);
      }
      for (const child of suite.suites ?? []) visit(child);
    };
    visit(JSON.parse(result.stdout));
    assert.ok(scenarios.size > 0);
    for (const [scenario, projects] of scenarios)
      assert.deepEqual([...projects].sort(), ["chromium", "webkit"], scenario);
  });

  it("motiva come non applicabili le esclusioni possibili nella qualifica locale", () => {
    // Il report segna parziale la partizione con un'esclusione d'altro tipo, e la qualifica
    // del candidato la rifiuta: soltanto il collaudo remoto può restare parziale.
    const skips = readdirSync("e2e").flatMap((file) =>
      [
        ...readFileSync(`e2e/${file}`, "utf8").matchAll(
          /test\.skip\(\s*([\s\S]*?),\s*"([^"]*)",?\s*\)/g,
        ),
      ].map(([, condition, reason]) => ({ file, condition, reason })),
    );
    assert.ok(skips.length > 0);
    for (const skip of skips)
      if (!/^(remote|Boolean\(process\.env\.E2E_BASE_URL\))(\s*&&|$)/.test(skip.condition))
        assert.match(skip.reason, /^Non applicabile: /, `${skip.file}: ${skip.condition}`);
  });

  const listing = {
    suites: [
      {
        file: "lente.spec.ts",
        specs: ["a", "b", "c"].map((title) => ({ title, tests: [{ projectName: "chromium" }] })),
        suites: [
          {
            title: "gruppo",
            specs: [{ title: "d", tests: [{ projectName: "webkit" }] }],
          },
        ],
      },
      {
        file: "rapide.spec.ts",
        specs: ["e", "f"].map((title) => ({ title, tests: [{ projectName: "chromium" }] })),
      },
    ],
  };

  it("assegna ogni prova a un solo shard, in modo stabile e senza seguire l'elenco", () => {
    const parts = [1, 2].map((shard) => shardTests(listing, shard, 2));
    assert.equal(new Set(parts.flat()).size, 6);
    assert.equal(parts.flat().length, 6);
    assert.deepEqual(shardTests(listing, 1, 2), parts[0]);
    assert.ok(parts.every((part) => part.length === 3));
  });

  it("ricava le identità dall'inventario JSON Playwright anche nei gruppi annidati", () => {
    assert.deepEqual(
      listedTestIds({
        suites: [
          {
            specs: [{ id: "chromium-a", tests: [{ projectName: "chromium" }] }],
            suites: [{ specs: [{ id: "webkit-b", tests: [{ projectName: "webkit" }] }] }],
          },
        ],
      }),
      ["chromium-a", "webkit-b"],
    );
  });
});

describe("prove browser riusate nella PR", () => {
  const job = (name, conclusion = "success") => ({ name, conclusion });
  const all = (total) =>
    Array.from({ length: total }, (_, index) => job(`Browser ${index + 1}/${total}`));

  it("considera concluse le prove soltanto con ogni parte riuscita", () => {
    assert.equal(browserOutcome(all(8)), "passed");
    assert.equal(browserOutcome([job("Gate"), job("Mutation app/a.server.ts 1/1")]), null);
    assert.equal(browserOutcome(all(8).slice(1)), null);
    assert.equal(browserOutcome([...all(7).slice(0, 6), job("Browser 7/8", "cancelled")]), null);
    assert.equal(browserOutcome([...all(8).slice(1), job("Browser 1/8", "failure")]), "failed");
    assert.equal(browserOutcome([...all(8).slice(1), job("Browser 1/8", "timed_out")]), "failed");
    assert.equal(browserOutcome([job("Browser 1/2"), job("Browser 2/3")]), null);
  });

  it("riusa l'ultima run conclusa con lo stesso inventario e senza cambi rilevanti", async () => {
    const run = (id, sha, created, repo = 1) => ({
      id,
      head_sha: sha,
      created_at: created,
      head_repository: { id: repo },
    });
    const runs = [
      run(9, "m3", "2026-11-07T22:20:00Z"),
      run(8, "m2", "2026-11-07T21:09:00Z"),
      run(7, "m1", "2026-11-07T19:00:00Z"),
    ];
    const ask = ({ jobs, keys = {}, unchanged = () => ({ reuse: true }), list = runs }) => {
      const calls = [];
      const api = async (url) => {
        calls.push(url);
        if (url.includes("/workflows/ci.yml/runs")) return { workflow_runs: list };
        const id = /runs\/(\d+)\/jobs/u.exec(url)[1];
        return { jobs: jobs[id] ?? [], total_count: (jobs[id] ?? []).length };
      };
      return browserProof(
        { repository: "o/r", repositoryId: 1, branch: "feat/x", exclude: 9, key: "k" },
        { api, planKey: async (id) => keys[id] ?? null, narrowing: async (sha) => unchanged(sha) },
      ).then((result) => ({ result, calls }));
    };
    const reused = await ask({ jobs: { 8: all(8) }, keys: { 8: "k" } });
    assert.deepEqual(reused.result, { run: 8, commit: "m2", reuse: true });
    assert.ok(!reused.calls.some((url) => url.includes("/runs/9/jobs")));
    // Una run senza prove browser concluse non decide: vale la precedente.
    assert.deepEqual(
      (await ask({ jobs: { 8: all(8).slice(2), 7: all(4) }, keys: { 7: "k" } })).result,
      { run: 7, commit: "m1", reuse: true },
    );
    // Fallimento recente, inventario diverso o assente, cambi rilevanti, altro repository.
    assert.equal(
      (await ask({ jobs: { 8: [job("Browser 1/1", "failure")], 7: all(1) }, keys: { 7: "k" } }))
        .result,
      null,
    );
    assert.equal((await ask({ jobs: { 8: all(8) }, keys: { 8: "altro" } })).result, null);
    assert.equal((await ask({ jobs: { 8: all(8) } })).result, null);
    assert.equal(
      (await ask({ jobs: { 8: all(8) }, keys: { 8: "k" }, unchanged: () => null })).result,
      null,
    );
    // Dopo un'unione con la base si ripete soltanto la selezione ridotta.
    assert.deepEqual(
      (await ask({ jobs: { 8: all(8) }, keys: { 8: "k" }, unchanged: () => ({ grep: "@smoke" }) }))
        .result,
      { run: 8, commit: "m2", grep: "@smoke" },
    );
    assert.equal(
      (
        await ask({
          jobs: { 8: all(8) },
          keys: { 8: "k" },
          list: [run(8, "m2", "2026-11-07T21:09:00Z", 2)],
        })
      ).result,
      null,
    );
  });
});
