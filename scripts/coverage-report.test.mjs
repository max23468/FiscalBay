import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { coverageSummary } from "./coverage-report.mjs";

describe("report di qualità", () => {
  it("rifiuta copertura vuota, conteggi incoerenti e sorgenti omessi", () => {
    const metric = { total: 10, covered: 4, pct: 40 };
    const total = Object.fromEntries(
      ["lines", "branches", "functions", "statements"].map((name) => [name, metric]),
    );
    assert.match(coverageSummary({ total }), /4 \/ 10/u);
    assert.throws(() => coverageSummary({}), /Copertura incompleta/u);
    assert.throws(
      () => coverageSummary({ total: { ...total, lines: { ...metric, covered: 11 } } }),
      /Copertura incompleta/u,
    );
    assert.throws(() => coverageSummary({ total }, ["app/missing.ts"]), /File assenti/u);
    assert.doesNotThrow(() =>
      coverageSummary({ total, [path.resolve("app/included.ts")]: {} }, ["app/included.ts"]),
    );
  });
});
