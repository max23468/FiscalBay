import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { orderCount, referenceShape } from "../benchmarks/capacity-dataset.ts";
import {
  accountUsage,
  capacitySummary,
  included,
  leftoverSql,
  monthlyProjection,
  parseCosts,
  quantile,
  referenceModel,
  serverTiming,
} from "./capacity.mjs";

/** Costi sintetici per operazione, con numeri tondi per verificare la proiezione a mano. */
const page = { queries: 1, rowsRead: 100, rowsWritten: 0 };
const costs = {
  ...Object.fromEntries(
    ["large", "premium", "free"].flatMap((kind) =>
      ["orders-page", "search-suggestions", "orders-search", "order-detail"].map((name) => [
        `${name}-${kind}`,
        page,
      ]),
    ),
  ),
  "cron-due": { queries: 1, rowsRead: 1000, rowsWritten: 10, stores: 100, tasks: 10 },
  "store-sync-idle": {
    queries: 1,
    rowsRead: 30,
    rowsWritten: 10,
    ebayCalls: { "fulfillment-list": 1 },
    turns: 1,
  },
  "store-sync-new-orders": {
    queries: 1,
    rowsRead: 1060,
    rowsWritten: 120,
    ebayCalls: { "fulfillment-list": 2, "fulfillment-detail": 10, GetItem: 30, GetOrders: 10 },
    fresh: 10,
    turns: 2,
  },
  database: { bytes: 100_000_000, orders: 1, order_items: 1, tax_identifiers: 1 },
};

describe("misure di capacità", () => {
  it("il dataset di riferimento supera i 70.000 ordini del §36", () => {
    assert.equal(orderCount(referenceShape), 78_802);
    assert.equal(referenceModel.premiumStores + referenceModel.freeStores, 152);
  });

  it("raccoglie le righe della suite anche dentro l'output di Vitest", () => {
    assert.deepEqual(
      parseCosts(
        [
          "stdout | benchmarks/capacity.spec.ts > cron",
          'CAPACITY {"name":"cron-due","rowsRead":5,"stores":1}',
          "altro",
          '  CAPACITY {"name":"purge","rowsRead":7}',
        ].join("\n"),
      ),
      { "cron-due": { rowsRead: 5, stores: 1 }, purge: { rowsRead: 7 } },
    );
  });

  it("calcola i quantili per rango e legge le fasi del Server-Timing", () => {
    assert.equal(quantile([], 0.5), null);
    assert.equal(quantile([5, 1, 3, 2, 4], 0.5), 3);
    assert.equal(quantile([5, 1, 3, 2, 4], 0.95), 5);
    assert.equal(quantile([10, 20], 0.5), 10);
    assert.deepEqual(serverTiming("auth;dur=1.5, d1;dur=12, ebay;desc=x"), { auth: 1.5, d1: 12 });
    assert.deepEqual(serverTiming(null), {});
  });

  it("proietta il mese con cadenze dei piani, ordini nuovi, cron e visite", () => {
    const projection = monthlyProjection(costs);
    const turns = (52 * 144 + 100 * 48) * 30;
    assert.equal(projection.turns, turns);
    assert.equal(projection.newOrders, 152 * 100);
    // Un ordine nuovo costa le righe oltre ai due turni senza novità: (1060 - 2 * 30) / 10.
    const visits = (49 + 1 + 100) * (10 + 2 + 2 + 5) * 30;
    const rowsRead = 4320 * 1000 + turns * 30 + 15_200 * 100 + visits * 100;
    assert.equal(projection.rows.find(({ name }) => name === "Righe D1 lette").value, rowsRead);
    // Nove gruppi da dieci negozi per turno del cron; compiti: quattro ogni dieci minuti, quattro
    // ogni ora e due al giorno; una notifica eBay per ordine nuovo.
    assert.equal(projection.groupMessages, 4320 * 9);
    assert.equal(projection.taskMessages, 4 * 4320 + 4 * 720 + 2 * 30);
    assert.equal(projection.messages, 4320 * 9 + 20_220 + 15_200);
    assert.equal(projection.invocations, 4320 + projection.messages + visits);
    assert.equal(
      projection.rows.find(({ name }) => name === "Tempo CPU (ms)").value,
      (projection.invocations - 4320 * 9 + turns) * 16,
    );
    const queue = projection.rows.find(({ name }) => name === "Operazioni della coda");
    assert.deepEqual(queue, {
      name: "Operazioni della coda",
      value: projection.messages * 3,
      quota: included.queueOperations,
      share: (projection.messages * 3) / included.queueOperations,
    });
    assert.equal(projection.dispatch.perTurn, 52 + 100 / 3);
    // Trading: dodici passate dei modificati al giorno per negozio e una lettura fiscale per ordine.
    assert.equal(projection.ebayDaily.getOrders.calls, 152 * 12 + 15_200 / 30);
    assert.equal(projection.ebayDaily.getItem.calls, (15_200 / 30) * 3);
    assert.equal(projection.ebayDaily.fulfillment.calls, turns / 30 + (15_200 / 30) * (1 + 0));
  });

  it("riassume costi, proiezione e tempi in Markdown", () => {
    const summary = capacitySummary({
      costs,
      latency: [
        {
          name: "orders-free",
          mode: "a freddo",
          samples: 1,
          p50: 20,
          p95: 20,
          max: 20,
          phases: { auth: 1, d1: 8 },
          errors: 0,
        },
      ],
    });
    assert.match(summary, /^# Capacità e costi$/mu);
    assert.match(summary, /\| cron-due \| 1 \| 1000 \| 10 \| stores: 100, tasks: 10 \|/u);
    assert.match(summary, /Negozi accodati per turno del cron: 85,3 su 300 \(28,44%\)\./u);
    assert.match(summary, /\| orders-free \| a freddo \| 1 \| 20 \| 20 \| 20 \| 1 \| 8 \| 0 \|/u);
    assert.doesNotMatch(summary, /heaviest/u);
  });

  it("somma il consumo dell'account per Worker, database e coda", () => {
    const usage = accountUsage({
      viewer: {
        accounts: [
          {
            workers: [
              { dimensions: { scriptName: "a" }, sum: { requests: 10, cpuTimeUs: 5000 } },
              { dimensions: { scriptName: "b" }, sum: { requests: 5, cpuTimeUs: 1000 } },
            ],
            d1: [{ dimensions: { databaseId: "d" }, sum: { rowsRead: 7, rowsWritten: 3 } }],
            storage: [],
            queues: [{ dimensions: { queueId: "q" }, sum: { billableOperations: 9 } }],
          },
        ],
      },
    });
    assert.deepEqual(usage.totals, {
      requests: { value: 15, quota: included.requests },
      cpuMs: { value: 6, quota: included.cpuMs },
      d1RowsRead: { value: 7, quota: included.d1RowsRead },
      d1RowsWritten: { value: 3, quota: included.d1RowsWritten },
      queueOperations: { value: 9, quota: included.queueOperations },
    });
    assert.deepEqual(usage.workers[1], { script: "b", requests: 5, cpuTimeUs: 1000 });
  });

  it("verifica la pulizia del test in ogni colonna di spazio, negozio, utente e ordine", () => {
    const columns = Array.from({ length: 21 }, (_, index) => ({ t: `t${index}`, c: "store_id" }));
    const blocks = leftoverSql(columns);
    assert.equal(blocks.length, 2);
    assert.equal(blocks[0].split(";\n").length, 20);
    assert.equal(
      blocks[1],
      `SELECT 't20.store_id' AS place, count(*) AS n FROM "t20" WHERE "store_id" LIKE 'cap-%'`,
    );
  });
});
