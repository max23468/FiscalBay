import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { verifiedBuildOrigin } from "./find-build.mjs";

describe("coordinamento e provenienza della pubblicazione", () => {
  it("riusa una qualifica completa anche dopo un errore del deploy, mai un artefatto grezzo", () => {
    const artifact = { expired: false, workflow_run: { repository_id: 1, head_repository_id: 1 } };
    const run = { path: ".github/workflows/publish.yml", conclusion: "failure" };
    const job = { name: "Qualifica candidato / Candidate qualified", conclusion: "success" };
    assert.equal(verifiedBuildOrigin(artifact, run, [job], 1, "candidate"), true);
    for (const conclusion of ["failure", "cancelled", "skipped", "in_progress"])
      assert.equal(
        verifiedBuildOrigin(artifact, run, [{ ...job, conclusion }], 1, "candidate"),
        false,
      );
    assert.equal(
      verifiedBuildOrigin(artifact, run, [{ ...job, name: "production" }], 1, "candidate"),
      false,
    );
    assert.equal(
      verifiedBuildOrigin({ ...artifact, expired: true }, run, [job], 1, "candidate"),
      false,
    );
    assert.equal(
      verifiedBuildOrigin(
        { ...artifact, workflow_run: { repository_id: 1, head_repository_id: 2 } },
        run,
        [job],
        1,
        "candidate",
      ),
      false,
    );
    assert.equal(
      verifiedBuildOrigin(
        artifact,
        { ...run, path: ".github/workflows/ci.yml" },
        [job],
        1,
        "candidate",
      ),
      false,
    );
    assert.equal(
      verifiedBuildOrigin(
        artifact,
        { path: ".github/workflows/ci.yml", conclusion: "success" },
        [],
        1,
      ),
      true,
    );
  });
});
