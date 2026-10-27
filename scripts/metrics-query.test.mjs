import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  compareSample,
  sampleReadyBase,
  sampleReports,
  sampleSql,
  targetOf,
} from "./metrics-query.mjs";

describe("query delle metriche tecniche", () => {
  it("legge dataset e origine dell'ambiente dalla configurazione", () => {
    assert.deepEqual(targetOf(), {
      dataset: "fiscalbay_test_metrics",
      origin: "https://test.fiscalbay.it",
    });
    assert.deepEqual(targetOf("live"), {
      dataset: "fiscalbay_metrics",
      origin: "https://fiscalbay.it",
    });
  });

  it("invia report sintetici validi e riconoscibili dalla pronta", () => {
    const reports = sampleReports(3);
    assert.deepEqual(
      reports.map((report) => [report.ttfb, report.ready]),
      [
        [1, sampleReadyBase + 1],
        [2, sampleReadyBase + 2],
        [3, sampleReadyBase + 3],
      ],
    );
    // Entro il massimo di 120 s accettato dal report del browser.
    assert.ok(reports.every((report) => report.ready <= 120_000));
  });

  it("interroga soltanto la finestra del campione con pesi del campionamento", () => {
    const sql = sampleSql(
      "fiscalbay_test_metrics",
      new Date("2026-10-27T20:00:00.400Z"),
      new Date("2026-10-27T20:01:00.900Z"),
    );
    assert.match(sql, /SUM\(_sample_interval\) AS reports/u);
    assert.match(sql, /quantileExactWeighted\(0\.5\)\(double1, _sample_interval\)/u);
    assert.match(sql, /timestamp >= toDateTime\('2026-10-27 20:00:00'\)/u);
    assert.match(sql, /double4 > 119000/u);
    assert.throws(() => sampleSql("dati; DROP", new Date(), new Date()), /INVALID_DATASET/u);
  });

  it("confronta conteggio e mediana stimati con quelli attesi", () => {
    assert.deepEqual(compareSample(40, { reports: "40", rows: "40", ttfb_p50_ms: 20 }), {
      expected: { reports: 40, ttfbP50: 20 },
      observed: { reports: 40, rows: 40, ttfbP50: 20 },
      sampled: false,
      ok: true,
    });
    assert.equal(compareSample(40, { reports: "38", rows: "38", ttfb_p50_ms: 20 }).ok, false);
    assert.equal(compareSample(40, { reports: "40", rows: "10", ttfb_p50_ms: 25 }).ok, false);
    assert.equal(compareSample(40, { reports: "40", rows: "10", ttfb_p50_ms: 21 }).sampled, true);
    assert.equal(compareSample(40, undefined).ok, false);
  });
});
