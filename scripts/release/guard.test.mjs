import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { failureLimit, newIncidents, siteHealthy, watch } from "./guard.mjs";

describe("guardia dopo il deploy", () => {
  const started = Date.parse("2026-11-02T10:00:00Z");
  const options = (overrides = {}) => {
    let time = started;
    return {
      deadline: started + 4 * 60_000,
      baseline: [],
      healthy: async () => true,
      incidents: async () => [],
      ...overrides,
      now: () => time,
      pause: async (ms) => {
        time += ms;
        await overrides.pause?.(ms);
      },
    };
  };

  it("rileva incidenti fra attivazione e guardia, aggravamenti e riaperture", () => {
    const rows = [
      { key: "old", kind: "vecchio", severity: "p1", opened_at: "2026-11-02T09:00:00Z" },
      { key: "mild", kind: "lieve", severity: "p2", opened_at: "2026-11-02T09:05:00Z" },
      { key: "new", kind: "nuovo", severity: "p1", opened_at: "2026-11-02T09:59:00Z" },
    ];
    assert.deepEqual(
      newIncidents(rows, rows.slice(0, 2)).map(({ kind }) => kind),
      ["nuovo"],
    );
    assert.equal(newIncidents([{ ...rows[1], severity: "p1" }], rows).length, 1);
    assert.equal(newIncidents([{ ...rows[0], opened_at: "2026-11-02T10:01:00Z" }], rows).length, 1);
  });

  it("si chiude senza allarmi quando il sito risponde", async () => {
    let pauses = 0;
    const pause = async () => pauses++;
    assert.equal(await watch(options({ pause })), undefined);
    assert.equal(pauses, 4);
  });

  it("ferma il periodo a un incidente nuovo", async () => {
    const incidents = async () => [
      { kind: "billing", severity: "p1", opened_at: "2026-11-02T10:01:00Z" },
    ];
    assert.match(await watch(options({ incidents })), /incidenti P1: billing/u);
  });

  it("una lettura isolata non basta, tre di fila sì", async () => {
    const sequence = (values) => {
      const queue = [...values];
      return async () => queue.shift() ?? true;
    };
    assert.equal(
      await watch(options({ healthy: sequence([false, true, false, false]) })),
      undefined,
    );
    assert.match(
      await watch(options({ healthy: async () => false })),
      new RegExp(`${failureLimit} letture`, "u"),
    );
  });

  it("legge pagina e sessione, e una risposta persa vale come non riuscita", async () => {
    const respond = (status) => async () => ({ ok: status < 400, json: async () => null });
    assert.equal(await siteHealthy("https://x.invalid", respond(200)), true);
    assert.equal(await siteHealthy("https://x.invalid", respond(503)), false);
    assert.equal(
      await siteHealthy("https://x.invalid", async () => {
        throw new Error("rete");
      }),
      false,
    );
  });

  it("osserva quindici minuti reali e rifiuta una versione o sessione diversa", async () => {
    let elapsed = 0;
    await watch(options({ deadline: started + 15 * 60_000, pause: async (ms) => (elapsed += ms) }));
    assert.equal(elapsed, 15 * 60_000);
    const read = async () => new Response("null", { headers: { "x-fiscalbay-version": "old" } });
    assert.equal(await siteHealthy("https://example.invalid", read, "new"), false);
    assert.equal(await siteHealthy("https://example.invalid", read, "old"), true);
    assert.equal(
      await siteHealthy("https://example.invalid", async () => new Response("{}")),
      false,
    );
  });
});
