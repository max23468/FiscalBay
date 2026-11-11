import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { flakyHistory, flakyTests, repeatedFlaky } from "./browser-evidence.mjs";

describe("prove instabili della qualifica", () => {
  const row = (page, retry, status = "passed", project = "chromium") => ({
    project,
    page,
    retry,
    status,
  });

  it("elenca una volta, in ordine, le prove riuscite soltanto alla ripetizione", () => {
    const parts = [
      { report: { rows: [row("ordini", 1), row("negozi", 0), row("prezzi", 1, "failed")] } },
      { report: { rows: [row("ordini", 2), row("accesso", 1, "passed", "webkit")] } },
      { report: null },
      {},
    ];
    assert.deepEqual(flakyTests(parts), ["chromium: ordini", "webkit: accesso"]);
    assert.deepEqual(flakyTests([]), []);
  });

  it("ferma soltanto le prove instabili ora e in almeno due qualifiche recenti", () => {
    const history = [["a", "b"], ["a"], ["b", "c"], ["c"]];
    assert.deepEqual(repeatedFlaky(["a", "c", "d"], history), ["a", "c"]);
    // Una prova instabile in passato ma non ora non ferma nulla.
    assert.deepEqual(repeatedFlaky(["d"], history), []);
    assert.deepEqual(repeatedFlaky(["a", "b"], history, 3), []);
    assert.deepEqual(repeatedFlaky(["a"], []), []);
  });
});

describe("storia delle prove instabili", () => {
  const artifact = (run, extra = {}) => ({
    expired: false,
    workflow_run: { id: run, repository_id: 1, head_repository_id: 1 },
    ...extra,
  });
  const fake = (artifacts, origins = {}) => {
    const calls = [];
    const api = (url) => {
      calls.push(url);
      if (url.includes("/actions/artifacts")) return { artifacts };
      const run = /actions\/runs\/(\d+)$/u.exec(url)?.[1];
      if (run)
        return origins[run] ?? { path: ".github/workflows/candidate.yml", conclusion: "success" };
      return { id: 1 };
    };
    return { api, calls, runs: () => calls.filter((url) => /actions\/runs\/\d+$/u.test(url)) };
  };

  it("si ferma alle prime cinque qualifiche riuscite senza leggere le altre run", () => {
    const { api, runs } = fake(Array.from({ length: 30 }, (_, index) => artifact(index + 1)));
    const read = (_repository, run) => [`prova ${run}`];
    assert.deepEqual(flakyHistory("o/r", { api, read, exclude: undefined }), [
      ["prova 1"],
      ["prova 2"],
      ["prova 3"],
      ["prova 4"],
      ["prova 5"],
    ]);
    assert.equal(runs().length, 5);
  });

  it("salta run estranee, scadute, ripetute, non riuscite e artefatti non scaricabili", () => {
    const { api, runs } = fake(
      [
        artifact(1, { expired: true }),
        artifact(2, { workflow_run: { id: 2, repository_id: 2, head_repository_id: 2 } }),
        artifact(3, { workflow_run: { id: 3, repository_id: 1, head_repository_id: 2 } }),
        artifact(4),
        artifact(5),
        artifact(5),
        artifact(6),
        artifact(7),
        artifact(8),
        { expired: false },
      ],
      {
        5: { path: ".github/workflows/candidate.yml", conclusion: "failure" },
        6: { path: ".github/workflows/ci.yml", conclusion: "success" },
      },
    );
    const read = (_repository, run) => (run === 7 ? null : [`prova ${run}`]);
    assert.deepEqual(flakyHistory("o/r", { api, read, exclude: "4" }), [["prova 8"]]);
    assert.deepEqual(
      runs().map((url) => url.split("/").at(-1)),
      ["5", "6", "7", "8"],
    );
  });

  it("senza repository non legge nulla", () => {
    const { api, calls } = fake([]);
    assert.deepEqual(flakyHistory(undefined, { api }), []);
    assert.equal(calls.length, 0);
  });
});
