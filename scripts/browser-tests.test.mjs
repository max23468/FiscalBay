import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { shardTests, listedTestIds, assertCandidateReports } from "./browser-tests.mjs";

describe("coordinamento e provenienza della pubblicazione", () => {
  it("certifica tutte le partizioni browser solo con prove coerenti e complete", () => {
    const parts = ["source", "production"].flatMap((kind) =>
      [1, 2, 3, 4].map((shard) => ({
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
        [1, 2, 3, 4].map((shard) => `${kind}-${shard}`),
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

  it("assegna le prove a turno, ciascuna a un solo shard", () => {
    assert.deepEqual(shardTests(listing, 1, 2), [
      "[chromium] › lente.spec.ts › a",
      "[chromium] › lente.spec.ts › c",
      "[chromium] › rapide.spec.ts › e",
    ]);
    assert.deepEqual(shardTests(listing, 2, 2), [
      "[chromium] › lente.spec.ts › b",
      "[webkit] › lente.spec.ts › gruppo › d",
      "[chromium] › rapide.spec.ts › f",
    ]);
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
