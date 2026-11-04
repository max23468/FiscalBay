import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { verifiedBuildOrigin } from "./find-build.mjs";

const tree = "a".repeat(40);
const sha = "b".repeat(40);
const artifact = {
  name: `build-${tree}`,
  expired: false,
  workflow_run: { id: 12, repository_id: 1, head_repository_id: 1, head_sha: sha },
};
const run = {
  id: 12,
  repository: { id: 1 },
  head_repository: { id: 1 },
  head_sha: sha,
  head_branch: "develop",
  event: "push",
  path: ".github/workflows/ci.yml",
  conclusion: "success",
};
const job = { name: "Qualifica candidato / Candidate qualified", conclusion: "success" };
const check = (
  candidate = artifact,
  producer = run,
  sourceTree = tree,
  kind = "build",
  jobs = [],
) =>
  verifiedBuildOrigin(candidate, producer, jobs, 1, tree, kind, (commit) => {
    assert.equal(commit, producer.head_sha);
    return sourceTree;
  });

describe("coordinamento e provenienza della pubblicazione", () => {
  it("rifiuta la PR interna anche con nome e manifest del tree richiesto", () => {
    const forged = { ...artifact, manifest: { tree, sha, digest: "forged" } };
    for (const head_branch of ["contributor", "develop"])
      assert.equal(check(forged, { ...run, event: "pull_request", head_branch }), false);
    assert.equal(check(forged, { ...run, event: "pull_request_target" }), false);
    assert.equal(
      check(forged, { ...run, event: "workflow_dispatch", head_branch: "contributor" }),
      false,
    );
  });

  it("lega il riuso al tree Git indipendente dal nome e dal manifest", () => {
    assert.equal(check(), true);
    assert.equal(check(artifact, { ...run, event: "workflow_dispatch" }), true);
    assert.equal(check(artifact, run, "c".repeat(40)), false);
    assert.equal(check(artifact, run, null), false);
    assert.equal(check({ ...artifact, name: `build-${"c".repeat(40)}` }), false);
  });

  it("accetta i commit di merge PR su develop e SHA diversi con lo stesso tree", () => {
    const merged = "d".repeat(40);
    assert.equal(
      check(
        { ...artifact, workflow_run: { ...artifact.workflow_run, head_sha: merged } },
        { ...run, head_sha: merged },
      ),
      true,
    );
    assert.equal(check(), true);
  });

  it("rifiuta origine incoerente, fork, metadati mancanti ed esiti non riusciti", () => {
    assert.equal(check({ ...artifact, expired: true }), false);
    for (const key of ["repository_id", "head_repository_id"])
      assert.equal(
        check({ ...artifact, workflow_run: { ...artifact.workflow_run, [key]: 2 } }),
        false,
      );
    for (const producer of [
      { ...run, id: 13 },
      { ...run, repository: { id: 2 } },
      { ...run, head_repository: { id: 2 } },
      { ...run, head_sha: "c".repeat(40) },
      { ...run, head_sha: "--invalid" },
      { ...run, path: ".github/workflows/other.yml" },
      { ...run, head_branch: "main" },
      { ...run, event: "schedule" },
      {},
      ...["failure", "cancelled", "skipped", null].map((conclusion) => ({ ...run, conclusion })),
    ])
      assert.equal(check(artifact, producer), false);
    assert.equal(check({}), false);
  });

  it("riusa una qualifica completa dopo un errore del deploy, mai un artefatto grezzo", () => {
    const candidate = { ...artifact, name: `candidate-${tree}` };
    const producer = {
      ...run,
      path: ".github/workflows/candidate.yml",
      event: "workflow_dispatch",
      conclusion: "failure",
    };
    const qualified = (changes = {}, jobs = [job], sourceTree = tree) =>
      check(candidate, { ...producer, ...changes }, sourceTree, "candidate", jobs);
    assert.equal(qualified(), true);
    assert.equal(qualified({ event: "schedule" }), true);
    assert.equal(qualified({ event: "push" }), false);
    assert.equal(qualified({ event: "pull_request" }), false);
    assert.equal(qualified({ head_branch: "contributor" }), false);
    assert.equal(qualified({ path: ".github/workflows/ci.yml" }), false);
    assert.equal(qualified({}, [job], "c".repeat(40)), false);
    for (const conclusion of ["failure", "cancelled", "skipped", "in_progress"])
      assert.equal(qualified({}, [{ ...job, conclusion }]), false);
    assert.equal(qualified({}, [{ ...job, name: "production" }]), false);
    assert.equal(qualified({}, []), false);
    assert.equal(check(candidate, producer, tree, "unknown", [job]), false);
  });

  it("il selettore scarta il falso, sceglie il producer fidato e ricompila senza prove valide", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "build-origin-"));
    const target = execFileSync("git", ["rev-parse", "HEAD^{tree}"], { encoding: "utf8" }).trim();
    try {
      writeFileSync(
        path.join(directory, "gh"),
        `#!${process.execPath}
const args = process.argv.slice(2);
const url = args.at(-1);
const input = JSON.parse(process.env.ORIGIN_FIXTURE);
require("node:fs").appendFileSync(process.env.ORIGIN_CALLS, url + "\\n");
let result;
if (url.includes("/artifacts?")) result = {artifacts: input.artifacts};
else if (url.includes("/git/commits/")) result = {tree: {sha: input.tree}};
else if (url.includes("/jobs?")) result = [{jobs: [input.job]}];
else result = input.runs[url.split("/").at(-1)];
console.log(JSON.stringify(result));
`,
        { mode: 0o700 },
      );
      for (const kind of ["build", "candidate"]) {
        const trusted = {
          ...run,
          path: `.github/workflows/${kind === "build" ? "ci" : "candidate"}.yml`,
          event: kind === "build" ? "push" : "workflow_dispatch",
        };
        const forged = { ...trusted, id: 13, event: "pull_request", head_branch: "contributor" };
        const proof = { ...artifact, name: `${kind}-${target}` };
        for (const valid of [true, false]) {
          const output = path.join(directory, "output");
          const calls = path.join(directory, "calls");
          writeFileSync(output, "");
          writeFileSync(calls, "");
          const result = spawnSync(
            process.execPath,
            ["scripts/find-build.mjs", ...(kind === "candidate" ? ["--candidate"] : [])],
            {
              encoding: "utf8",
              env: {
                ...process.env,
                PATH: `${directory}:${process.env.PATH}`,
                REPOSITORY: "example/project",
                REPOSITORY_ID: "1",
                GITHUB_OUTPUT: output,
                GITHUB_STEP_SUMMARY: "",
                ORIGIN_CALLS: calls,
                ORIGIN_FIXTURE: JSON.stringify({
                  artifacts: [
                    { ...proof, workflow_run: { ...proof.workflow_run, id: 13 } },
                    ...(valid ? [proof] : []),
                  ],
                  runs: { 12: trusted, 13: forged },
                  tree: target,
                  job,
                }),
              },
            },
          );
          assert.equal(result.status, 0, result.stderr);
          assert.equal(
            readFileSync(output, "utf8"),
            valid ? `run-id=12\nartifact=${kind}-${target}\n` : "",
          );
          assert.equal(readFileSync(calls, "utf8").includes(`/git/commits/${sha}`), valid);
        }
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
