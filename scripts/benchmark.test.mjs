import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { benchmarkSummary, comparableDependencies, extractBenchmarkSources } from "./benchmark.mjs";

describe("report di qualità", () => {
  it("estrae i sorgenti benchmark oltre un MiB senza il buffer stdout", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "benchmark-sources-"));
    try {
      const repository = path.join(directory, "repository");
      const output = path.join(directory, "output");
      mkdirSync(path.join(repository, "app"), { recursive: true });
      mkdirSync(output);
      const source = "x".repeat(2 * 1024 * 1024);
      writeFileSync(path.join(repository, "app/source.txt"), source);
      const git = (...args) => {
        const result = spawnSync("git", args, { cwd: repository, encoding: "utf8" });
        assert.equal(result.status, 0, result.stderr);
        return result.stdout.trim();
      };
      git("init", "-q");
      git("add", "app");
      const tree = git("write-tree");
      extractBenchmarkSources(repository, tree, output);
      assert.equal(readFileSync(path.join(output, "app/source.txt"), "utf8"), source);
      assert.throws(() => readFileSync(path.join(output, "sources.tar")), { code: "ENOENT" });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("confronta misure valide e rifiuta raccolte mancanti o incompatibili", () => {
    assert.match(benchmarkSummary({ csv: [2, 3, 1] }, { csv: [1, 1, 1] }), /100\.0%/u);
    assert.match(
      benchmarkSummary({ csv: [1, 2, 3] }, undefined, "toolchain diversa"),
      /toolchain diversa/u,
    );
    for (const samples of [{}, { csv: [] }, { csv: [NaN] }, { csv: [0] }])
      assert.throws(() => benchmarkSummary(samples), /Misure benchmark/u);
    assert.throws(() => benchmarkSummary({ csv: [1] }, { zip: [1] }), /Misure benchmark/u);
    assert.throws(() => benchmarkSummary({ csv: [1] }, { csv: [Infinity] }), /Misure benchmark/u);
    const base = {
      dependencies: { a: "1", b: "2" },
      devDependencies: { vitest: "5" },
      engines: { node: "26" },
    };
    assert.equal(comparableDependencies(base, { ...base, dependencies: { b: "2", a: "1" } }), true);
    assert.equal(comparableDependencies(base, { ...base, dependencies: { a: "2" } }), false);
    assert.equal(
      comparableDependencies(base, { ...base, devDependencies: { vitest: "6" } }),
      false,
    );
    assert.equal(comparableDependencies(base, { ...base, engines: { node: "27" } }), false);
  });
});
