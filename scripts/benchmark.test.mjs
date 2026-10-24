import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { benchmarkSummary } from "./benchmark.mjs";

describe("benchmark a richiesta", () => {
  it("riassume mediana e intervallo e rifiuta raccolte mancanti o non valide", () => {
    assert.match(
      benchmarkSummary({ csv: [2, 3, 1] }),
      /\| csv \| 2\.0000 \| 1\.0000 - 3\.0000 \|/u,
    );
    for (const samples of [{}, { csv: [] }, { csv: [NaN] }, { csv: [0] }, { csv: [Infinity] }])
      assert.throws(() => benchmarkSummary(samples), /Misure benchmark/u);
  });
});
