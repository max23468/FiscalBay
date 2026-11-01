import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { targetOf } from "./go-live.mjs";
import {
  area,
  backlogWarning,
  checkData,
  checkInvocations,
  checkQueues,
  checkQuotas,
  databaseWarningBytes,
  statements,
} from "./surveillance.mjs";

const now = new Date("2026-11-02T10:05:00.000Z");
const failing = (results) => results.filter(({ ok }) => ok === false).map(({ item }) => item);

/** Righe D1 di una finestra tranquilla, nell'ordine di `statements`. */
function rows(change = {}) {
  const base = {
    incidents: [],
    task: [{ slot: "2026-11-02T10:00:00.000Z", done_at: "2026-11-02T10:00:40.000Z" }],
    accounts: [{ accounts: 2, verified: 1 }],
    events: [{ kind: "registered", status: "sent", count: 2 }],
    steps: [{ step: "store_linked", count: 1 }],
    sync: [{ attempts: 10, failures: 1 }],
    receipts: [{ provider: "ebay", pending: 3 }],
    support: [{ requests: 1 }],
  };
  return Object.values({ ...base, ...change });
}

describe("istruzioni D1", () => {
  it("sono una per ogni voce e non leggono email, nomi o dati dei buyer", () => {
    const sql = statements(new Date("2026-11-01T10:05:00.000Z"), now);
    assert.equal(sql.length, 8);
    assert.ok(sql.every((text) => text.startsWith("SELECT ")));
    assert.ok(!/"email"|"name"|buyer|detail/u.test(sql.join("\n")));
    assert.ok(sql[2].includes("'2026-11-01T10:05:00.000Z'"));
  });
});

describe("dati dell'ambiente", () => {
  it("passa con una finestra tranquilla e riporta i conteggi", () => {
    const results = checkData(rows(), now);
    assert.deepEqual(failing(results), []);
    const detail = (item) => results.find((entry) => entry.item === item).detail;
    assert.equal(detail("account creati"), "2, verificati 1");
    assert.equal(detail("fatti degli account"), "registered 2");
    assert.equal(detail("letture dei negozi"), "10 tentativi, 1 falliti");
    assert.equal(detail("ricevute in attesa"), "stripe 0, ebay 3, telegram 0");
  });

  it("segnala gli incidenti aperti con gravità e tipo", () => {
    const results = checkData(
      rows({ incidents: [{ severity: "p1", kind: "receipts_stalled" }] }),
      now,
    );
    assert.deepEqual(failing(results), ["nessun incidente P1 o P2 aperto"]);
    assert.equal(results[0].detail, "p1 receipts_stalled");
  });

  it("non si fida degli incidenti se il compito che li valuta è fermo o mai partito", () => {
    const stale = [{ slot: "2026-11-02T09:40:00.000Z", done_at: "2026-11-02T09:40:40.000Z" }];
    for (const task of [stale, [], [{ slot: "2026-11-02T10:00:00.000Z", done_at: null }]])
      assert.deepEqual(failing(checkData(rows({ task }), now)), [
        "valutazione degli incidenti in corso",
      ]);
  });

  it("accetta il compito all'ultimo istante del secondo periodo", () => {
    const task = [{ slot: "2026-11-02T09:45:00.000Z", done_at: "2026-11-02T09:45:30.000Z" }];
    assert.deepEqual(failing(checkData(rows({ task }), now)), []);
  });

  it("somma lo stesso fatto fra gli stati e segnala gli avvisi non consegnati", () => {
    const events = [
      { kind: "refund", status: "sent", count: 2 },
      { kind: "refund", status: "failed", count: 1 },
    ];
    const results = checkData(rows({ events }), now);
    assert.deepEqual(failing(results), ["avvisi commerciali consegnati"]);
    assert.equal(
      results.find(({ item }) => item === "eventi ed esiti commerciali").detail,
      "refund 3",
    );
  });

  it("chiede di rileggere Stripe soltanto dopo una vendita", () => {
    const owner = (results) => results.filter(({ ok }) => ok === null).length;
    assert.equal(owner(checkData(rows(), now)), 0);
    const events = [{ kind: "purchase", status: "sent", count: 1 }];
    assert.equal(owner(checkData(rows({ events }), now)), 1);
  });
});

describe("invocazioni", () => {
  const row = (invocation, outcome, count) => ({ invocation, outcome, count: String(count) });

  it("conta le stime e riporta i rinvii senza segnalarli", () => {
    const results = checkInvocations([
      row("http", "2xx", 90),
      row("http", "4xx", 10),
      row("queue", "ok", 5),
      row("queue", "retry", 2),
    ]);
    assert.deepEqual(failing(results), []);
    assert.equal(results[0].detail, "0 su circa 100 richieste");
    assert.equal(results[1].detail, "0, messaggi rimessi in coda 2");
  });

  it("segnala le risposte 5xx e le invocazioni fallite", () => {
    assert.deepEqual(failing(checkInvocations([row("http", "5xx", 1), row("cron", "error", 1)])), [
      "risposte 5xx",
      "invocazioni di coda e cron fallite",
    ]);
  });
});

describe("code", () => {
  const target = targetOf("live");

  it("ammette un turno di arretrato e nessun messaggio fra i falliti", () => {
    const metrics = { work: { backlog_count: backlogWarning }, failed: { backlog_count: 0 } };
    assert.deepEqual(failing(checkQueues(target, metrics)), []);
  });

  it("segnala l'arretrato oltre un turno e i messaggi falliti", () => {
    const metrics = { work: { backlog_count: backlogWarning + 1 }, failed: { backlog_count: 1 } };
    assert.equal(failing(checkQueues(target, metrics)).length, 2);
  });

  it("non considera vuota una coda non letta", () => {
    assert.equal(failing(checkQueues(target, {})).length, 2);
  });
});

describe("quote", () => {
  const usage = (requests) => ({
    totals: {
      requests: { value: requests, quota: 100 },
      cpuMs: { value: 1, quota: 100 },
      d1RowsRead: { value: 1, quota: 100 },
      d1RowsWritten: { value: 1, quota: 100 },
      queueOperations: { value: 1, quota: 100 },
    },
  });

  it("riporta la quota più alta e passa sotto la soglia", () => {
    const results = checkQuotas(usage(79), { file_size: 4_700_000 });
    assert.deepEqual(failing(results), []);
    assert.equal(results[0].detail, "la più alta: richieste 79.0%");
    assert.equal(results[1].detail, "4.7 MB");
  });

  it("segnala l'80% di una quota e il database dalla soglia, o non letto", () => {
    assert.equal(failing(checkQuotas(usage(80), { file_size: databaseWarningBytes })).length, 2);
    assert.equal(failing(checkQuotas(usage(1), null)).length, 1);
  });
});

describe("lettura di un'area", () => {
  it("una lettura fallita resta una voce da guardare, con la sola prima riga dell'errore", async () => {
    const results = await area("Code", "code", () => {
      throw new Error("rifiutato\nriga con dettagli");
    });
    assert.deepEqual(results, [
      { area: "Code", item: "code", ok: false, detail: "non letto: rifiutato" },
    ]);
  });
});
