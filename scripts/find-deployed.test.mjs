import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lastDeployed } from "./find-deployed.mjs";

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
});
