import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { comparisonBase, lastDeployed } from "./find-deployed.mjs";

describe("base del confronto sui push", () => {
  it("parte dall'ultimo deploy test riuscito, saltando run annullate, fallite e senza deploy", () => {
    const jobs = {
      docs: [{ name: "Deploy test", conclusion: "skipped" }],
      cancelled: [{ name: "Deploy test", conclusion: "cancelled" }],
      failed: [{ name: "Deploy test", conclusion: "failure" }],
      foreign: [{ name: "Deploy test", conclusion: "success" }],
      deployed: [{ name: "Deploy test", conclusion: "success" }],
    };
    const runs = [
      { event: "pull_request", head_sha: "pr" },
      ...Object.keys(jobs).map((sha) => ({ event: "push", head_sha: sha })),
    ];
    const visited = [];
    const sha = lastDeployed(
      runs,
      (run) => (visited.push(run.head_sha), jobs[run.head_sha]),
      (commit) => commit !== "foreign",
    );
    assert.equal(sha, "deployed");
    assert.equal(visited.includes("pr"), false);
    assert.equal(
      lastDeployed(
        runs.slice(0, 4),
        (run) => jobs[run.head_sha] ?? [],
        () => true,
      ),
      undefined,
    );
  });

  it("avanza all'ultima run verde senza modifiche da distribuire dopo il deploy", () => {
    const jobs = {
      cancelled: [{ name: "Deploy test", conclusion: "skipped" }],
      app: [{ name: "Deploy test", conclusion: "skipped" }],
      docs: [{ name: "Deploy test", conclusion: "skipped" }],
      tests: [{ name: "Deploy test", conclusion: "skipped" }],
      deployed: [{ name: "Deploy test", conclusion: "success" }],
      older: [{ name: "Deploy test", conclusion: "skipped" }],
    };
    const runs = [
      { event: "push", head_sha: "cancelled", conclusion: "cancelled" },
      { event: "push", head_sha: "app", conclusion: "success" },
      { event: "pull_request", head_sha: "pr", conclusion: "success" },
      { event: "push", head_sha: "docs", conclusion: "success" },
      { event: "push", head_sha: "tests", conclusion: "success" },
      { event: "push", head_sha: "deployed", conclusion: "success" },
      { event: "push", head_sha: "older", conclusion: "success" },
    ];
    const compared = [];
    const base = (deployable, ancestor = () => true) =>
      comparisonBase(
        runs,
        (run) => jobs[run.head_sha] ?? [],
        ancestor,
        (from, head) => (compared.push([from, head]), deployable.includes(head)),
      );

    // Il deploy disattivato lascia `app` verde senza deploy: resta nel diff.
    assert.equal(base(["app"]), "docs");
    assert.deepEqual(compared, [
      ["deployed", "app"],
      ["deployed", "docs"],
    ]);
    assert.equal(base(["app", "docs", "tests"]), "deployed");
    assert.equal(
      base([], (commit) => commit !== "app"),
      "docs",
    );
    assert.equal(
      comparisonBase(
        runs.slice(0, 5),
        (run) => jobs[run.head_sha] ?? [],
        () => true,
        () => false,
      ),
      undefined,
    );
  });
});
