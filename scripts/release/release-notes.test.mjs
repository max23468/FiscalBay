import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertBrowserEvidence, releaseStep } from "./release-notes.mjs";

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

  it("riprende dopo un tag riuscito senza ripeterlo né spostarlo", () => {
    const tag = "v2.0.0-rc.1";
    const published = [{ tag_name: tag, draft: false }];
    assert.equal(releaseStep(undefined, [], tag, manifest.sha), "create");
    // Tag creato da un tentativo interrotto prima della release, o release rimasta in bozza.
    assert.equal(releaseStep(manifest.sha, [], tag, manifest.sha), "create");
    assert.equal(
      releaseStep(manifest.sha, [{ tag_name: tag, draft: true }], tag, manifest.sha),
      "create",
    );
    assert.equal(releaseStep(manifest.sha, published, tag, manifest.sha), "done");
    assert.throws(() => releaseStep("b".repeat(40), published, tag, manifest.sha), /altro commit/u);
  });
});
