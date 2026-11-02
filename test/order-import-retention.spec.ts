import { env } from "cloudflare:workers";

import { expect, it, vi } from "vitest";

import { readDetail } from "../app/domain/order-acquisition-details.server";

import { purgeExpiredRecords } from "../app/domain/maintenance.server";

import { unlockOrders } from "../app/domain/grants.server";

import { listVisibleOrders } from "../app/domain/orders.server";

import { recordOrderObservation } from "../app/domain/order-import.server";

import { deleteStoreData, listStores } from "../app/domain/stores.server";

import { ebayConfiguration } from "../app/integrations/ebay/environment.server";

import { insertCredentials, now } from "./fixtures/database-fixtures";

import {
  grantedAt,
  target,
  line,
  observation,
  provisional,
  orders,
  setupScenarios,
} from "./fixtures/order-import-scenarios";

setupScenarios();

it("nega l'accesso alla scadenza anche senza pulizia e non rinnova il grant", async () => {
  const result = await recordOrderObservation(
    env.DB,
    target(),
    observation({
      taxIdentifiers: {
        source: "ebay_fulfillment",
        complete: false,
        values: [{ type: "CODICE_FISCALE", value: "RSSMRA80A01H501U" }],
      },
    }),
  );
  const id = (result as { orderId: string }).orderId;
  await unlockOrders(env.DB, "u-a", [id]);
  const expiry = new Date("2026-10-10T10:00:00.000Z");
  for (const offset of [-1, 0, 1]) {
    const at = new Date(expiry.getTime() + offset);
    const visible = await listVisibleOrders(env.DB, "u-a", 50, "production", at);
    expect(visible).toHaveLength(offset < 0 ? 1 : 0);
    expect((await listStores(env.DB, "u-a", at))[0]!.importedOrders).toBe(offset < 0 ? 1 : 0);
    if (offset >= 0)
      await expect(unlockOrders(env.DB, "u-a", [id], false, "production", at)).rejects.toThrow(
        "order_not_available",
      );
  }
  expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM tax_identifiers").first()).toEqual({
    n: 1,
  });
  expect(await env.DB.prepare("SELECT used FROM free_cycles WHERE id = 'c-a'").first()).toEqual({
    used: 1,
  });
});

it.each(["expires_at", "revoked_at"])(
  "un grant con %s non espone valori e non consuma altra quota",
  async (column) => {
    // Un posto libero dopo lo sblocco: il rifiuto successivo non dipende dalla quota.
    await env.DB.batch([
      env.DB.prepare("DELETE FROM free_cycles WHERE id = 'c-a'"),
      env.DB.prepare(`INSERT INTO free_cycles (id, workspace_id, starts_at, ends_at, quota)
          VALUES ('c-a', 'w-a', '2026-09-01T00:00:00Z', '2026-10-01T00:00:00Z', 2)`),
    ]);
    const result = await recordOrderObservation(
      env.DB,
      target(),
      observation({
        taxIdentifiers: {
          source: "ebay_fulfillment",
          complete: false,
          values: [{ type: "CODICE_FISCALE", value: "RSSMRA80A01H501U" }],
        },
      }),
    );
    const orderId = (result as { orderId: string }).orderId;
    await unlockOrders(env.DB, "u-a", [orderId]);
    const expiry = new Date(Date.parse(now) + 1000);
    await env.DB.prepare(`UPDATE order_grants SET ${column} = ?`).bind(expiry.toISOString()).run();
    if (column === "expires_at") {
      expect(
        (
          await listVisibleOrders(env.DB, "u-a", 50, "production", new Date(expiry.getTime() - 1))
        )[0]!.taxIdentifiers,
      ).toHaveLength(1);
    }
    for (const offset of [0, 1]) {
      const at = new Date(expiry.getTime() + offset);
      const visible = await listVisibleOrders(env.DB, "u-a", 50, "production", at);
      expect(visible[0]!.taxIdentifiers).toEqual([]);
      expect(JSON.stringify(visible)).not.toContain("RSSMRA80A01H501U");
      await expect(
        unlockOrders(env.DB, "u-a", [orderId], false, "production", at),
      ).rejects.toMatchObject({ code: "order_already_granted" });
    }
    expect(await env.DB.prepare("SELECT used FROM free_cycles WHERE id = 'c-a'").first()).toEqual({
      used: 1,
    });
  },
);

it("la pulizia elimina tutte le copie dell'ordine e il replay non le ricrea", async () => {
  const value = observation({
    taxIdentifiers: {
      source: "ebay_fulfillment",
      complete: true,
      values: [{ type: "CODICE_FISCALE", value: "RSSMRA80A01H501U" }],
    },
  });
  const first = await recordOrderObservation(env.DB, target(), value);
  const id = (first as { orderId: string }).orderId;
  await unlockOrders(env.DB, "u-a", [id]);
  const expiry = new Date("2026-10-10T10:00:00.000Z");
  await purgeExpiredRecords(env.DB, new Date(expiry.getTime() - 1));
  expect(await orders()).toHaveLength(1);
  await purgeExpiredRecords(env.DB, expiry);
  await purgeExpiredRecords(env.DB, expiry);
  for (const table of [
    "orders",
    "order_items",
    "tax_identifiers",
    "order_tax_checks",
    "order_source_refs",
    "order_grants",
    "order_reconciliation_issues",
  ]) {
    expect(await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first(), table).toEqual({
      n: 0,
    });
  }
  // Anche una data successiva e un nuovo identificativo esterno non aggirano il marker.
  expect(await recordOrderObservation(env.DB, target(), value)).toEqual({ outcome: "stale" });
  expect(
    await recordOrderObservation(env.DB, target(), {
      ...value,
      externalOrderId: "nuovo-id",
      creationTime: now,
    }),
  ).toEqual({ outcome: "stale" });
  expect(await orders()).toEqual([]);
  expect((await recordOrderObservation(env.DB, target("s-b"), value)).outcome).toBe("created");
  expect(await env.DB.prepare("SELECT used FROM free_cycles WHERE id = 'c-a'").first()).toEqual({
    used: 1,
  });
});

it("una risposta iniziata prima della scadenza non aggiorna buyer e dati fiscali dopo", async () => {
  await recordOrderObservation(env.DB, target(), observation());
  vi.setSystemTime(new Date("2026-10-10T10:00:00.000Z"));
  expect(
    await recordOrderObservation(
      env.DB,
      target(),
      observation({
        buyer: { name: "Tardivo" },
        taxIdentifiers: {
          source: "ebay_fulfillment",
          complete: false,
          values: [{ type: "CODICE_FISCALE", value: "TARDIVO" }],
        },
      }),
    ),
  ).toEqual({ outcome: "stale" });
  expect((await orders())[0]!.buyer_json).toContain("Mario Rossi");
  expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM tax_identifiers").first()).toEqual({
    n: 0,
  });
});

it("una sovrapposizione parziale con un ordine scaduto non crea un nuovo alias consultabile", async () => {
  await recordOrderObservation(env.DB, target(), observation());
  await env.DB.prepare("UPDATE orders SET retention_until = ?1, purge_after = ?2")
    .bind(now, "2026-10-10T10:00:00.000Z")
    .run();
  expect(
    await recordOrderObservation(
      env.DB,
      target(),
      observation({
        externalOrderId: "alias-parziale",
        items: [line("k1"), line("k3")],
        taxIdentifiers: {
          source: "ebay_fulfillment",
          complete: false,
          values: [{ type: "CODICE_FISCALE", value: "NON-ESPORRE" }],
        },
      }),
    ),
  ).toEqual({ outcome: "stale" });
  expect(await orders()).toHaveLength(1);
  expect(await listVisibleOrders(env.DB, "u-a")).toEqual([]);
  expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM tax_identifiers").first()).toEqual({
    n: 0,
  });
});

it.each(["ordine nuovo", "fonte fiscale"])(
  "non legge articoli non necessari per %s",
  async (mode) => {
    if (mode === "fonte fiscale") await recordOrderObservation(env.DB, target(), observation());
    const prepared = vi.spyOn(env.DB, "prepare");
    try {
      const result = await recordOrderObservation(
        env.DB,
        target(),
        observation({
          source: mode === "fonte fiscale" ? "trading" : "fulfillment",
          taxIdentifiers: {
            source: "ebay_trading_get_orders",
            complete: false,
            values: [{ type: "CODICE_FISCALE", value: "SINTETICO" }],
          },
        }),
      );
      expect(result).toMatchObject({
        outcome: mode === "ordine nuovo" ? "created" : "unchanged",
        taxChanges: 1,
      });
      expect(
        prepared.mock.calls.some(([sql]) => /^\s*SELECT id, line_item_id, stable_key/u.test(sql)),
      ).toBe(false);
    } finally {
      prepared.mockRestore();
    }
  },
);

it("rilegge il tempo dopo l'ultima lettura preparatoria, prima di autorizzare il batch", async () => {
  await recordOrderObservation(env.DB, target(), observation());
  const expiry = new Date("2026-10-10T10:00:00.000Z");
  vi.setSystemTime(new Date(expiry.getTime() - 1));
  const prepare = env.DB.prepare.bind(env.DB);
  const intercepted = vi.spyOn(env.DB, "prepare").mockImplementation((sql) => {
    const statement = prepare(sql);
    if (!sql.includes("FROM order_items WHERE order_id = ?")) return statement;
    statement.bind = (...values: unknown[]) => {
      const bound = prepare(sql).bind(...values);
      const all = bound.all.bind(bound);
      bound.all = async <T>() => {
        const rows = await all<T>();
        vi.setSystemTime(expiry);
        return rows;
      };
      return bound;
    };
    return statement;
  });
  try {
    expect(
      await recordOrderObservation(env.DB, target(), observation({ buyer: { name: "Tardivo" } })),
    ).toEqual({ outcome: "stale" });
    expect((await orders())[0]!.buyer_json).toContain("Mario Rossi");
  } finally {
    intercepted.mockRestore();
  }
});

it("un orologio arretrato non riapre un ordine già scaduto all'inizio dell'osservazione", async () => {
  await recordOrderObservation(env.DB, target(), observation());
  const expiry = "2026-10-10T10:00:00.000Z";
  vi.setSystemTime(new Date(Date.parse(expiry) - 1));
  expect(
    await recordOrderObservation(
      env.DB,
      target("s-a", expiry),
      observation({ buyer: { name: "Tardivo" } }),
    ),
  ).toEqual({ outcome: "stale" });
  expect((await orders())[0]!.buyer_json).toContain("Mario Rossi");
});

it("conserva la grace senza consultazione e la cancellazione richiesta prevale", async () => {
  const result = await recordOrderObservation(env.DB, target(), observation());
  const id = (result as { orderId: string }).orderId;
  // Scadenza Premium esplicita di un anno, separata dal grant e dalla pulizia fisica.
  await env.DB.prepare("UPDATE orders SET retention_until = ?1, purge_after = ?1 WHERE id = ?2")
    .bind("2027-09-10T10:00:00.000Z", id)
    .run();
  expect(
    await listVisibleOrders(env.DB, "u-a", 50, "production", new Date("2027-09-10T09:59:59.999Z")),
  ).toHaveLength(1);
  const downgrade = "2026-10-01T00:00:00.000Z";
  await env.DB.prepare("UPDATE orders SET retention_until = ?1, purge_after = ?2 WHERE id = ?3")
    .bind(downgrade, "2026-10-31T00:00:00.000Z", id)
    .run();
  const at = new Date(downgrade);
  expect(await listVisibleOrders(env.DB, "u-a", 50, "production", at)).toEqual([]);
  await purgeExpiredRecords(env.DB, at);
  expect(await orders()).toHaveLength(1);
  expect(await deleteStoreData(env.DB, "u-a", "s-a", "e-a", at)).toBe("done");
  expect(await orders()).toEqual([]);
  // Il ricollegamento conserva il limite di cancellazione anche per ordini mai importati.
  await env.DB.batch([
    env.DB.prepare("UPDATE ebay_stores SET disconnected_at = NULL, data_deleted_at = NULL"),
    insertCredentials({ accessExpiresAt: "2027-01-01T00:00:00.000Z", grantedAt }),
  ]);
  expect(
    await recordOrderObservation(
      env.DB,
      target(),
      observation({ externalOrderId: "mai-importato", items: [line("mai-vista")] }),
    ),
  ).toEqual({ outcome: "stale" });
  expect(
    (
      await recordOrderObservation(
        env.DB,
        target(),
        observation({
          externalOrderId: "nuovo",
          creationTime: "2026-10-01T00:00:00.001Z",
          items: [line("nuova")],
        }),
      )
    ).outcome,
  ).toBe("created");
});

it("una cancellazione tra lettura e batch vince anche su una risposta già pronta", async () => {
  await recordOrderObservation(env.DB, target(), observation());
  const execute = env.DB.batch.bind(env.DB);
  const batch = vi.spyOn(env.DB, "batch").mockImplementationOnce(async (statements) => {
    await execute([env.DB.prepare("DELETE FROM orders")]);
    return execute(statements);
  });
  try {
    expect(await recordOrderObservation(env.DB, target(), observation())).toEqual({
      outcome: "stale",
    });
    expect(await orders()).toEqual([]);
  } finally {
    batch.mockRestore();
  }
});

it.each(["scadenza", "cancellazione"])(
  "un dettaglio pendente si ferma prima di eBay dopo %s",
  async (mode) => {
    await recordOrderObservation(env.DB, target(), observation());
    if (mode === "scadenza") vi.setSystemTime(new Date("2026-10-10T10:00:00.000Z"));
    else await env.DB.prepare("DELETE FROM orders").run();
    const fetcher = vi.fn<typeof fetch>();
    const budget = { calls: 12, pages: 1 };
    expect(
      await readDetail(
        {
          db: env.DB,
          storeId: "s-a",
          grantedAt,
          access: {
            configuration: ebayConfiguration(env, "production"),
            fetcher,
            accessToken: "sintetico",
          },
          at: now,
          budget,
          created: 0,
        },
        {
          external_order_id: "D-1",
          last_modified_time: "2026-09-10T11:00:00.000Z",
          detail_attempts: 0,
          marketplace_id: null,
        },
      ),
    ).toBe(true);
    expect(fetcher).not.toHaveBeenCalled();
    expect(budget).toEqual({ calls: 12, pages: 1 });
  },
);

it("un errore arrivato dopo la scadenza non riapre il retry del dettaglio", async () => {
  await recordOrderObservation(env.DB, target(), observation());
  const expiry = new Date("2026-10-10T10:00:00.000Z");
  vi.setSystemTime(new Date(expiry.getTime() - 1));
  const fetcher = vi.fn<typeof fetch>(async () => {
    vi.setSystemTime(expiry);
    return new Response("non-json");
  });
  expect(
    await readDetail(
      {
        db: env.DB,
        storeId: "s-a",
        grantedAt,
        access: {
          configuration: ebayConfiguration(env, "production"),
          fetcher,
          accessToken: "sintetico",
        },
        at: now,
        budget: { calls: 12, pages: 1 },
        created: 0,
      },
      {
        external_order_id: "D-1",
        last_modified_time: "2026-09-10T11:00:00.000Z",
        detail_attempts: 0,
        marketplace_id: null,
      },
    ),
  ).toBe(true);
  expect(fetcher).toHaveBeenCalledOnce();
  expect(
    await env.DB.prepare(
      "SELECT detail_error, detail_attempts, detail_retry_at FROM order_source_refs",
    ).first(),
  ).toEqual({ detail_error: null, detail_attempts: 0, detail_retry_at: null });
});

it.each([true, false])(
  "gli originali del combinato seguono la retention corrente senza perdere il grant, primo più vecchio: %s",
  async (firstOlder) => {
    await recordOrderObservation(
      env.DB,
      target(),
      provisional({
        items: [line("k1")],
        creationTime: firstOlder ? "2026-09-09T10:00:00Z" : "2026-09-10T10:00:00Z",
      }),
    );
    const second = await recordOrderObservation(
      env.DB,
      target(),
      provisional({
        externalOrderId: "P-2",
        creationTime: firstOlder ? "2026-09-10T10:00:00Z" : "2026-09-09T10:00:00Z",
        items: [line("k2")],
        taxIdentifiers: {
          source: "ebay_trading_get_orders",
          complete: false,
          values: [{ type: "CODICE_FISCALE", value: "SINTETICO" }],
        },
      }),
    );
    await env.DB.prepare(
      "INSERT INTO order_grants (id, workspace_id, order_id, source, granted_at) VALUES ('merged-retention', 'w-a', ?, 'admin', ?)",
    )
      .bind((second as { orderId: string }).orderId, now)
      .run();
    const combined = await recordOrderObservation(env.DB, target(), observation());
    await env.DB.prepare("UPDATE orders SET retention_until = ?1, purge_after = ?1 WHERE id = ?2")
      .bind("2026-11-01T00:00:00.000Z", (combined as { orderId: string }).orderId)
      .run();
    const at = new Date("2026-10-11T00:00:00.000Z");
    await purgeExpiredRecords(env.DB, at);
    expect((await listVisibleOrders(env.DB, "u-a", 50, "production", at))[0]!.fiscalState).toBe(
      "available",
    );
    expect(await orders()).toHaveLength(2);
    await purgeExpiredRecords(env.DB, new Date("2026-11-01T00:00:00.000Z"));
    expect(await orders()).toEqual([]);
    expect(
      await recordOrderObservation(
        env.DB,
        target(),
        provisional({ externalOrderId: "P-2", items: [line("k2")] }),
      ),
    ).toEqual({ outcome: "stale" });
  },
);
