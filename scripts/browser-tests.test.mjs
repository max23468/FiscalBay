import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
  shardTests,
  listedTestIds,
  assertCandidateReports,
  prepareBrowserSystem,
  installBrowserSystem,
} from "./browser-tests.mjs";

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
  it("usa l'archivio Ubuntu per APT e conserva gli altri repository", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "browser-system-"));
    try {
      const fragments = path.join(directory, "sources.list.d");
      mkdirSync(fragments);
      const legacy = path.join(directory, "sources.list");
      const ubuntu = path.join(fragments, "ubuntu.sources");
      const other = path.join(fragments, "other.list");
      writeFileSync(legacy, "deb http://azure.archive.ubuntu.com/ubuntu resolute main\n");
      writeFileSync(
        ubuntu,
        "Types: deb\nURIs: https://azure.archive.ubuntu.com/ubuntu/\nSuites: resolute-updates\nComponents: main\nSigned-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg\n",
      );
      const mirrors = path.join(directory, "apt-mirrors.txt");
      writeFileSync(
        mirrors,
        "http://azure.archive.ubuntu.com/ubuntu/\tpriority:1\nhttps://security.ubuntu.com/ubuntu/\tpriority:3\n",
      );
      const unrelated = "deb https://packages.example.invalid/repository stable main\n";
      writeFileSync(other, unrelated);
      assert.equal(prepareBrowserSystem(directory), 3);
      assert.equal(
        readFileSync(mirrors, "utf8"),
        "https://archive.ubuntu.com/ubuntu/\tpriority:1\nhttps://security.ubuntu.com/ubuntu/\tpriority:3\n",
      );
      assert.equal(
        readFileSync(legacy, "utf8"),
        "deb https://archive.ubuntu.com/ubuntu resolute main\n",
      );
      assert.equal(
        readFileSync(ubuntu, "utf8"),
        "Types: deb\nURIs: https://archive.ubuntu.com/ubuntu/\nSuites: resolute-updates\nComponents: main\nSigned-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg\n",
      );
      assert.equal(readFileSync(other, "utf8"), unrelated);
      assert.equal(prepareBrowserSystem(directory), 0);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it("installa i pacchetti dei browser dalla cache e conserva quelli scaricati", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "browser-packages-"));
    try {
      const cache = path.join(directory, "cache");
      const archives = path.join(directory, "archives");
      mkdirSync(cache);
      mkdirSync(archives);
      writeFileSync(path.join(cache, "cached.deb"), "");
      writeFileSync(path.join(cache, "notes.txt"), "");
      const calls = [];
      const run = (command, args) => {
        calls.push([command, ...args]);
        if (args[1] === "playwright") writeFileSync(path.join(archives, "new.deb"), "");
      };
      installBrowserSystem(["chromium", "webkit"], { cache, archives, run });
      assert.deepEqual(calls[0], ["sudo", "dpkg", "--configure", "-a"]);
      assert.deepEqual(calls[2], ["sudo", "cp", path.join(cache, "cached.deb"), archives]);
      assert.deepEqual(calls[3], [
        "pnpm",
        "exec",
        "playwright",
        "install-deps",
        "chromium",
        "webkit",
      ]);
      assert.deepEqual(calls[4], ["cp", path.join(archives, "new.deb"), cache]);
      calls.length = 0;
      rmSync(cache, { recursive: true });
      installBrowserSystem(["chromium"], { withBrowsers: true, cache, archives, run });
      assert.equal(
        calls.some(([command, verb]) => command === "sudo" && verb === "cp"),
        false,
      );
      assert.ok(
        calls.some(
          (call) => call.join(" ") === "pnpm exec playwright install --with-deps chromium",
        ),
      );
      assert.ok(existsSync(cache));
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
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
