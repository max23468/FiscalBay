import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { plan } from "./classify-changes.mjs";
import {
  lastFullQualification,
  reusableAreas,
  skippedPages,
  pageCoverage,
  coveredAreas,
} from "./pages-reuse.mjs";

describe("riuso delle visite del catalogo", () => {
  const sources = [
    { path: "app/routes/stores.tsx", text: "" },
    { path: "app/domain/scheduled-work.server.ts", text: "" },
  ];

  it("riusa le aree non toccate", () => {
    const areas = reusableAreas(plan(["app/routes/stores.tsx"], sources));
    assert.ok(areas.includes("orders"));
    assert.equal(areas.includes("stores"), false);
  });

  it("riusa tutte le aree se cambia ciò che nessuna pagina mostra o soltanto documenti", () => {
    for (const file of ["app/domain/scheduled-work.server.ts", "docs/MASTER_PLAN.md"])
      assert.equal(reusableAreas(plan([file], sources)).length, 6, file);
  });

  it("non riusa nulla se il cambiamento non ha un'area", () => {
    for (const file of ["app/root.tsx", "e2e/fixtures.ts", "e2e/pages.spec.ts", "pnpm-lock.yaml"])
      assert.deepEqual(reusableAreas(plan([file], sources)), [], file);
  });

  it("compone il filtro sui tag delle visite", () => {
    assert.equal(skippedPages([]), "");
    const filter = new RegExp(skippedPages(["orders", "public"]));
    assert.ok(filter.test("x @pages @pages-orders"));
    assert.equal(filter.test("x @pages @pages-orders @remote"), false);
    assert.equal(filter.test("x @pages @pages-stores"), false);
  });

  it("parte dall'ultima qualifica completa antenata, del repository e non scaduta", () => {
    const artifact = (name, head_sha, overrides = {}) => ({
      name,
      expired: false,
      workflow_run: { head_sha, repository_id: 1, head_repository_id: 1 },
      ...overrides,
    });
    const artifacts = [
      artifact("pages-full", "b", { expired: true }),
      artifact("pages-full", "c"),
      artifact("pages-full", "d", {
        workflow_run: { head_sha: "d", repository_id: 1, head_repository_id: 2 },
      }),
      artifact("pages-full", "e"),
    ];
    assert.equal(
      lastFullQualification(
        artifacts,
        1,
        (sha) => sha !== "c",
        () => true,
      ),
      "e",
    );
    assert.equal(
      lastFullQualification(
        artifacts,
        1,
        () => false,
        () => true,
      ),
      undefined,
    );
    assert.equal(
      lastFullQualification(
        artifacts,
        1,
        () => true,
        () => false,
      ),
      undefined,
    );
  });

  it("conserva route, file e digest e invalida il riuso seguendo gli import reali", () => {
    const files = [
      { path: "app/routes/stores.tsx", text: 'import "../domain/scheduled-work.server";' },
      { path: "app/routes/settings.tsx", text: 'import "../domain/scheduled-work.server";' },
      { path: "app/domain/scheduled-work.server.ts", text: "export const value = 1;" },
    ];
    const before = pageCoverage(files);
    assert.ok(before.areas.stores.files.includes("app/domain/scheduled-work.server.ts"));
    const after = pageCoverage(
      files.map((entry) =>
        entry.path.includes("scheduled-work")
          ? { ...entry, text: "export const value = 2;" }
          : entry,
      ),
    );
    const reused = coveredAreas(before, after);
    assert.equal(reused.includes("stores"), false);
    assert.equal(reused.includes("settings"), false);
    assert.ok(reused.includes("orders"));
    assert.equal(
      coveredAreas(before, pageCoverage(files, [{ path: "playwright.config.ts", text: "changed" }]))
        .length,
      0,
    );
    assert.throws(
      () => pageCoverage([{ path: "app/unclassified.ts", text: "" }]),
      /senza copertura/u,
    );
  });
});
