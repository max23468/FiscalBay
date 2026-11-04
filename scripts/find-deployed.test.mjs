import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { comparisonBase, lastDeployed, lastPublished } from "./find-deployed.mjs";
import { publicationRecord, publicVersion, receiptActive } from "./release/records.mjs";

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

describe("commit attivo in Production", () => {
  const a = "a".repeat(40);
  const b = "b".repeat(40);
  const active = (sha, version) => ({ sha, version, identity: `${sha}:${"c".repeat(32)}` });
  const receipt = (sha, version) => ({ environment: "production", active: active(sha, version) });

  it("sceglie la versione osservata, anche dopo rollback o errore nel giorno", () => {
    const records = [receipt(b, "new"), { ...receipt(a, "old"), rolledBack: true }];
    assert.equal(lastPublished(records, "old"), a);
    assert.equal(lastPublished(records, "new"), b);
    assert.equal(lastPublished(records, "unknown"), undefined);
    assert.throws(
      () => receiptActive({ ...receipt(a, "old"), active: { ...active(a, "old"), sha: b } }, "old"),
      /incoerente/u,
    );
  });

  it("legge ricevute di run fallite ma rifiuta workflow estranei e fork", () => {
    const artifact = {
      id: 2,
      expired: false,
      workflow_run: { id: 3, repository_id: 1, head_repository_id: 1 },
    };
    const api = (url) => {
      if (url === "repos/example/repo") return { id: 1 };
      if (url.includes("/artifacts?name=")) return { artifacts: [artifact] };
      if (url.endsWith("/runs/3"))
        return {
          id: 3,
          path: ".github/workflows/publish.yml",
          head_branch: "main",
          conclusion: "failure",
        };
      throw new Error(`Lettura inattesa: ${url}`);
    };
    assert.equal(
      publicationRecord("example/repo", "old", api, () => receipt(a, "old")).active.sha,
      a,
    );
    const untrusted = (url) =>
      url.includes("/artifacts?name=")
        ? {
            artifacts: [
              { ...artifact, workflow_run: { ...artifact.workflow_run, head_repository_id: 9 } },
            ],
          }
        : url.includes("/workflows/")
          ? { workflow_runs: [] }
          : api(url);
    assert.throws(
      () => publicationRecord("example/repo", "old", untrusted, () => receipt(a, "old")),
      /Nessuna ricevuta/u,
    );
    const other = (url) =>
      url.endsWith("/runs/3")
        ? { path: ".github/workflows/ci.yml", head_branch: "main" }
        : url.includes("/workflows/")
          ? { workflow_runs: [] }
          : api(url);
    assert.throws(
      () => publicationRecord("example/repo", "old", other, () => receipt(a, "old")),
      /Nessuna ricevuta/u,
    );
  });

  it("con una versione nata da un segreto usa per la base soltanto l'ultimo stato del ciclo", () => {
    const state = (id, run, version) => ({
      id,
      name: `production-state-${version}`,
      expired: false,
      workflow_run: { id: run, repository_id: 1, head_repository_id: 1 },
    });
    const receipts = { 10: receipt(a, "old"), 20: receipt(b, "new") };
    const reads =
      (latest, rolledBack = false) =>
      (url) => {
        if (url === "repos/example/repo") return { id: 1 };
        if (url.includes("/artifacts?name=")) return { artifacts: [] };
        if (url.includes("/workflows/publish.yml/"))
          return {
            workflow_runs: [
              { id: 1, created_at: "2026-11-03T10:00:00Z" },
              { id: 2, created_at: latest },
            ],
          };
        if (url.includes("/workflows/rollback.yml/")) return { workflow_runs: [] };
        if (url.includes("/runs/1/artifacts")) return { artifacts: [state(10, 1, "old")] };
        if (url.includes("/runs/2/artifacts"))
          return { artifacts: [{ ...state(20, 2, "new"), rolledBack }] };
        throw new Error(`Lettura inattesa: ${url}`);
      };
    const download = (_, artifact) =>
      artifact.rolledBack ? { ...receipts[artifact.id], rolledBack: true } : receipts[artifact.id];
    const options = { latestState: true };
    // La versione creata dal segreto non ha ricevuta: vale lo stato più recente, con il suo commit.
    const record = publicationRecord(
      "example/repo",
      "secret",
      reads("2026-11-03T20:00:00Z"),
      download,
      options,
    );
    assert.deepEqual(
      [record.active.sha, record.active.version, record.observed],
      [b, "new", "secret"],
    );
    // La conferma finale resta legata alla ricevuta della versione servita.
    assert.throws(
      () => publicationRecord("example/repo", "secret", reads("2026-11-03T20:00:00Z"), download),
      /Nessuna ricevuta/u,
    );
    // Uno stato più recente ritirato non fa ripiegare su uno più vecchio.
    assert.throws(
      () =>
        publicationRecord(
          "example/repo",
          "secret",
          reads("2026-11-03T20:00:00Z", true),
          download,
          options,
        ),
      /Nessuna ricevuta/u,
    );
    // Le run si ordinano per data, non per posizione nell'elenco.
    assert.equal(
      publicationRecord("example/repo", "secret", reads("2026-11-03T09:00:00Z"), download, options)
        .active.sha,
      a,
    );
  });

  it("richiede un readback reale e conserva soltanto la compatibilità delle ricevute già distribuite", async () => {
    const version = "11111111-1111-1111-1111-111111111111";
    assert.equal(
      await publicVersion(
        "https://example.invalid",
        async () => new Response("null", { headers: { "x-fiscalbay-version": version } }),
      ),
      version,
    );
    await assert.rejects(
      publicVersion("https://example.invalid", async () => new Response("null")),
      /non confermata/u,
    );
    const legacy = {
      environment: "production",
      version,
      sha: a,
      digest: "d".repeat(64),
      readback: true,
    };
    assert.equal(receiptActive(legacy, version).sha, a);
    assert.equal(receiptActive({ ...legacy, rolledBack: true }, version), undefined);
  });
});

describe("deploy superato", () => {
  it("non vale come base: il commit non è stato distribuito", () => {
    const run = (head_sha) => ({ head_sha, event: "push", conclusion: "success" });
    const step = (conclusion) => [{ name: "Deploy verified artifact", conclusion }];
    const jobs = {
      nuovo: [{ name: "Deploy test", conclusion: "success", steps: step("skipped") }],
      vecchio: [{ name: "Deploy test", conclusion: "success", steps: step("success") }],
    };
    assert.equal(
      lastDeployed(
        [run("nuovo"), run("vecchio")],
        ({ head_sha }) => jobs[head_sha],
        () => true,
      ),
      "vecchio",
    );
  });
});
