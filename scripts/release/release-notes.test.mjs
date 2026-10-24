import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertBrowserEvidence } from "./release-notes.mjs";

describe("pubblicazione riprendibile", () => {
  const manifest = { sha: "a".repeat(40), tree: "tree", digest: "artifact", environment: "test" };

  it("la release richiede un collaudo eseguito sul candidato e sull'ambiente Production", () => {
    const evidence = {
      status: "passed",
      partial: false,
      counts: { passed: 1 },
      sha: manifest.sha,
      environment: "production",
      dirty: false,
      baseURL: "https://fiscalbay.it",
    };
    assert.doesNotThrow(() => assertBrowserEvidence(evidence, manifest.sha));
    for (const change of [
      { counts: { passed: 0 } },
      { partial: true },
      { dirty: true },
      { sha: "other" },
      { baseURL: "https://test.fiscalbay.it" },
      { environment: "local" },
    ])
      assert.throws(
        () => assertBrowserEvidence({ ...evidence, ...change }, manifest.sha),
        /Collaudo/u,
      );
  });
});
