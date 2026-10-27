import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { compareSample, samplePath, sampleSql, targetOf } from "./metrics-query.mjs";

describe("query delle metriche tecniche", () => {
  it("legge dataset e origine dell'ambiente dalla configurazione", () => {
    assert.deepEqual(targetOf(), {
      dataset: "fiscalbay_test_metrics",
      service: "fiscalbay-test",
      origin: "https://test.fiscalbay.it",
    });
    assert.deepEqual(targetOf("live"), {
      dataset: "fiscalbay_metrics",
      service: "fiscalbay",
      origin: "https://fiscalbay.it",
    });
  });

  it("usa una richiesta anonima senza effetti sul report del browser", () => {
    assert.equal(samplePath, "/api/v1/page-timing");
  });

  it("interroga soltanto la finestra del campione con pesi del campionamento", () => {
    const sql = sampleSql(
      "fiscalbay_test_metrics",
      new Date("2026-10-27T20:00:00.400Z"),
      new Date("2026-10-27T20:01:00.900Z"),
    );
    assert.match(sql, /SUM\(_sample_interval \* double1\) AS requests/u);
    assert.match(sql, /blob3 = 'api' AND blob4 = 'HEAD'/u);
    assert.match(sql, /blob5 = '4xx'/u);
    assert.match(sql, /timestamp >= toDateTime\('2026-10-27 20:00:00'\)/u);
    assert.throws(() => sampleSql("dati; DROP", new Date(), new Date()), /INVALID_DATASET/u);
  });

  it("confronta il conteggio stimato con quello atteso", () => {
    assert.deepEqual(compareSample(40, { requests: "40", rows: "40" }), {
      expected: { requests: 40 },
      observed: { requests: 40, rows: 40 },
      sampled: false,
      ok: true,
    });
    assert.equal(compareSample(40, { requests: "38", rows: "38" }).ok, false);
    assert.deepEqual(compareSample(40, { requests: "40", rows: "10" }), {
      expected: { requests: 40 },
      observed: { requests: 40, rows: 10 },
      sampled: true,
      ok: true,
    });
    assert.equal(compareSample(40, undefined).ok, false);
  });
});
