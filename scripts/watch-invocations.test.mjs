import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { jsonObjects, summarize as summarizeInvocations } from "./watch-invocations.mjs";

describe("invocazioni osservate durante il collaudo remoto", () => {
  it("riporta solo percorso e tempi, e segnala le invocazioni lente o fallite", () => {
    const request = (url) => ({ url, method: "GET", headers: { cookie: "sessione" } });
    const summary = summarizeInvocations([
      {
        outcome: "ok",
        wallTime: 120,
        cpuTime: 4,
        event: { request: request("https://test.example/?token=x"), response: { status: 200 } },
      },
      {
        outcome: "ok",
        wallTime: 58_000,
        cpuTime: 6,
        event: { request: request("https://test.example/negozi"), response: { status: 200 } },
      },
      {
        outcome: "canceled",
        wallTime: 30,
        cpuTime: 1,
        logs: [{ message: ['{"event":"phase","phase":"start"}', "altro"] }],
        event: { request: request("https://test.example/profilo") },
      },
      { outcome: "ok", event: { scheduledTime: 1 } },
    ]);
    assert.equal(summary.total, 3);
    assert.deepEqual(
      summary.anomalies.map(({ path }) => path),
      ["/negozi", "/profilo"],
    );
    assert.deepEqual(summary.anomalies[1].phases, ["start"]);
    assert.equal(JSON.stringify(summary).includes("sessione"), false);
    assert.equal(JSON.stringify(summary).includes("token"), false);
  });
});

describe("eventi di wrangler tail", () => {
  it("separa gli oggetti JSON anche spezzati fra più blocchi", () => {
    const parse = jsonObjects();
    assert.deepEqual(parse('{"a":"}{"}\n{"b":'), [{ a: "}{" }]);
    assert.deepEqual(parse("{}}\n"), [{ b: {} }]);
  });
});
