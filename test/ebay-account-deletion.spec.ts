import { env } from "cloudflare:workers";
import { beforeEach, expect, it, vi } from "vitest";

import { listAnomalies } from "../app/domain/admin-operations.server";
import { reconcileOwnerIncidents } from "../app/domain/owner-incidents.server";
import {
  consumeEbayAccountDeletion,
  recordEbayAccountDeletion,
  resumeEbayAccountDeletions,
  runEbayAccountDeletion,
} from "../app/domain/ebay-account-deletion.server";
import {
  publishExportFile,
  openExportFile,
  exportRevision,
} from "../app/domain/export-files.server";
import { exportOrderPages } from "../app/domain/order-export.server";
import { orderSuggestions } from "../app/domain/order-suggestions.server";
import {
  listVisibleOrders,
  searchVisibleOrders,
  visibleOrderState,
} from "../app/domain/orders.server";
import { indexOrderSearch, purgeExpiredRecords } from "../app/domain/maintenance.server";
import { storeIdentityHash } from "../app/domain/store-marks.server";
import {
  insertCredentials,
  insertEntitlement,
  insertOrder,
  insertWorkspace,
  later,
  now,
  resetDatabase,
} from "./fixtures/database-fixtures";
import { fakeQueue, queueMessage, queued } from "./fixtures/queue-fixture";

const at = new Date(now);
const send = vi.fn<Queue["send"]>();
const environment: Env = { ...env, WORK_QUEUE: fakeQueue({ send }) };

const seller = {
  environment: "production" as const,
  userId: "seller-x",
  eiasToken: "eias-seller",
  username: "seller-name",
  eventAt: now,
};
const buyer = {
  environment: "production" as const,
  userId: "buyer-x",
  eiasToken: "eias-buyer",
  username: "buyer-name",
  eventAt: now,
};

/**
 * Ordine con acquirente nel negozio indicato; `mergedInto` per un ordine combinato. Il trigger
 * che revoca i file confronta la conservazione con l'orologio di D1.
 */
const buyerOrder = (
  id: string,
  storeId: string,
  buyer: { eias: string | null; username: string },
  mergedInto: string | null = null,
) => insertOrder(id, { storeId, buyer, mergedInto, retentionUntil: "2099-01-01T00:00:00.000Z" });

const count = async (sql: string, ...values: unknown[]) =>
  (await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${sql}`)
    .bind(...values)
    .first<{ n: number }>())!.n;

const orderIds = async () =>
  (await env.DB.prepare("SELECT id FROM orders ORDER BY id").all<{ id: string }>()).results.map(
    (row) => row.id,
  );

const requestId = async () =>
  (await env.DB.prepare("SELECT id FROM ebay_account_deletions").first<{ id: string }>())!.id;

beforeEach(async () => {
  await resetDatabase();
  vi.clearAllMocks();
  send.mockResolvedValue(queued);
  const markHash = await storeIdentityHash(env.BETTER_AUTH_SECRET, "seller-x");
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM "user" WHERE "id" IN ('u-erase-a', 'u-erase-b')`),
    env.DB.prepare(`INSERT INTO "user" ("id", "name", "email", "emailVerified", "createdAt",
        "updatedAt") VALUES ('u-erase-a', 'A', 'erase-a@example.invalid', 1, ?1, ?1),
        ('u-erase-b', 'B', 'erase-b@example.invalid', 1, ?1, ?1)`).bind(now),
    env.DB.prepare(`INSERT INTO "account" ("id", "accountId", "providerId", "userId", "createdAt",
        "updatedAt") VALUES ('acc-ebay', 'seller-x', 'ebay', 'u-erase-a', ?1, ?1),
        ('acc-password', 'u-erase-a', 'credential', 'u-erase-a', ?1, ?1)`).bind(now),
    ...insertWorkspace({ id: "w-a", userId: "u-erase-a" }),
    ...insertWorkspace({ id: "w-b", userId: "u-erase-b" }),
    env.DB.prepare(`INSERT INTO ebay_stores (id, workspace_id, ebay_user_id, ebay_account_id,
        display_name, store_name, linked_at, ebay_environment) VALUES
        ('s-seller', 'w-a', 'seller-x', 'seller-x', 'seller-name', 'Negozio X', ?1, 'production'),
        ('s-other', 'w-a', 'other-x', 'other-x', 'other-name', NULL, ?1, 'production'),
        ('s-buyerside', 'w-b', 'shop-b', 'shop-b', 'shop-name', NULL, ?1, 'production'),
        ('s-sandbox', 'w-b', '["sandbox","seller-x"]', 'seller-x', 'seller-name', NULL, ?1, 'sandbox')`).bind(
      now,
    ),
    ...buyerOrder("o-seller-1", "s-seller", { eias: "eias-1", username: "someone" }),
    ...buyerOrder("o-seller-2", "s-seller", { eias: "eias-2", username: "someone-else" }),
    ...buyerOrder("o-other", "s-other", { eias: "eias-3", username: "third" }),
    ...buyerOrder("o-sandbox", "s-sandbox", { eias: "eias-buyer", username: "buyer-name" }),
    ...buyerOrder("o-buyer", "s-buyerside", { eias: "eias-buyer", username: "buyer-name" }),
    ...buyerOrder(
      "o-buyer-merged",
      "s-buyerside",
      { eias: "eias-buyer", username: "buyer-name" },
      "o-buyer",
    ),
    ...buyerOrder("o-buyer-old", "s-buyerside", { eias: null, username: "buyer-name" }),
    // Lo stesso username con un token diverso è un altro acquirente.
    ...buyerOrder("o-namesake", "s-buyerside", { eias: "eias-other", username: "buyer-name" }),
    env.DB.prepare(`INSERT INTO free_cycles (id, workspace_id, starts_at, ends_at, quota, used)
        VALUES ('c-b', 'w-b', ?1, '2026-10-13T20:00:00.000Z', 30, 0)`).bind(now),
    env.DB.prepare(`INSERT INTO order_grants (id, workspace_id, order_id, cycle_id, source, granted_at)
        VALUES ('g-b', 'w-b', 'o-buyer', 'c-b', 'free_cycle', ?1)`).bind(now),
    env.DB.prepare(`INSERT INTO free_store_changes (id, workspace_id, store_id, kind, changed_at)
        VALUES ('fs-a', 'w-a', 's-seller', 'default', ?1)`).bind(now),
    env.DB.prepare(`INSERT INTO sync_state (store_id, last_success_at, updated_at)
        VALUES ('s-seller', ?1, ?1)`).bind(now),
    env.DB.prepare(`INSERT INTO sync_runs (store_id, started_at, ok, new_orders)
        VALUES ('s-seller', ?1, 1, 2)`).bind(now),
    env.DB.prepare(`INSERT INTO telegram_store_preferences (store_id, enabled, updated_at)
        VALUES ('s-seller', 0, ?1)`).bind(now),
    env.DB.prepare(`INSERT INTO ebay_store_pauses (store_id, reason, paused_at)
        VALUES ('s-seller', 'manual', ?1)`).bind(now),
    env.DB.prepare(`INSERT INTO webhook_receipts (id, provider, environment, provider_id, topic,
        object_id, store_id, consent_granted_at, event_at, expires_at)
        VALUES ('r-seller', 'ebay', 'production', 'n-1', 'ORDER_CONFIRMATION', 'ebay-o-seller-1',
          's-seller', ?1, ?1, '2026-09-20T20:00:00.000Z')`).bind(now),
    env.DB.prepare(`INSERT INTO store_transfers (id, store_id, from_workspace_id, to_workspace_id,
        actor, reason, prepared_at, expires_at)
        VALUES ('t-open', 's-seller', 'w-a', 'w-b', 'owner', 'Prova', ?1, '2026-09-14T20:00:00.000Z')`).bind(
      now,
    ),
    env.DB.prepare(`INSERT INTO store_identity_marks (identity_hash, trial_used, recorded_at,
        expires_at) VALUES (?1, 1, ?2, '2028-09-13T20:00:00.000Z')`).bind(markHash, now),
  ]);
  await insertCredentials({
    storeId: "s-seller",
    accessExpiresAt: "2026-09-14T20:00:00.000Z",
  }).run();
});

it("la cancellazione di un venditore elimina negozio, ordini, consenso, segno e accesso con eBay", async () => {
  const revisions = await env.DB.prepare(
    "SELECT id, access_revision FROM workspaces ORDER BY id",
  ).all();
  expect(await recordEbayAccountDeletion(environment, seller, at)).toBe(true);
  const id = await requestId();
  expect(send).toHaveBeenCalledExactlyOnceWith({ ebayAccountDeletion: id });
  expect(await runEbayAccountDeletion(environment, id, at)).toBe("done");

  expect(
    await env.DB.prepare(`SELECT ebay_user_id, ebay_account_id, display_name, store_name,
        disconnected_at, data_deleted_at FROM ebay_stores WHERE id = 's-seller'`).first(),
  ).toEqual({
    ebay_user_id: "s-seller",
    ebay_account_id: null,
    display_name: null,
    store_name: null,
    disconnected_at: now,
    data_deleted_at: now,
  });
  expect(await orderIds()).toEqual([
    "o-buyer",
    "o-buyer-merged",
    "o-buyer-old",
    "o-namesake",
    "o-other",
    "o-sandbox",
  ]);
  for (const [table, filter] of [
    ["order_items", "order_id LIKE 'o-seller%'"],
    ["tax_identifiers", "order_id LIKE 'o-seller%'"],
    ["ebay_store_credentials", "store_id = 's-seller'"],
    ["ebay_store_pauses", "store_id = 's-seller'"],
    ["sync_state", "store_id = 's-seller'"],
    ["sync_runs", "store_id = 's-seller'"],
    ["telegram_store_preferences", "store_id = 's-seller'"],
    ["webhook_receipts", "store_id = 's-seller'"],
    ["deleted_order_keys", "store_id = 's-seller'"],
    ["store_transfers", "store_id = 's-seller'"],
    ["store_identity_marks", "1 = 1"],
    ['"account"', `"providerId" = 'ebay'`],
  ])
    expect(await count(`${table} WHERE ${filter}`), table).toBe(0);
  // Restano l'utente con gli altri accessi, la scelta del negozio Free e l'altro negozio.
  expect(await count(`"account" WHERE "userId" = 'u-erase-a'`)).toBe(1);
  expect(await count(`"user" WHERE "id" = 'u-erase-a'`)).toBe(1);
  expect(await count("free_store_changes WHERE store_id = 's-seller'")).toBe(1);
  expect(
    await count("ebay_stores WHERE ebay_account_id = 'other-x' AND data_deleted_at IS NULL"),
  ).toBe(1);
  // La Sandbox è un altro ambiente: il suo negozio con lo stesso identificativo resta.
  expect(
    await env.DB.prepare(
      "SELECT ebay_account_id, data_deleted_at FROM ebay_stores WHERE id = 's-sandbox'",
    ).first(),
  ).toEqual({ ebay_account_id: "seller-x", data_deleted_at: null });
  // I file delle esportazioni dello spazio non valgono più.
  const after = await env.DB.prepare("SELECT id, access_revision FROM workspaces ORDER BY id").all<{
    access_revision: number;
  }>();
  expect(after.results[0]!.access_revision).toBeGreaterThan(
    (revisions.results[0] as { access_revision: number }).access_revision,
  );
  expect(
    await env.DB.prepare("SELECT completed_at, locked_until FROM ebay_account_deletions").first(),
  ).toEqual({ completed_at: now, locked_until: null });

  // Ripetuta, non cambia nulla; una notifica successiva non trova più dati.
  expect(await runEbayAccountDeletion(environment, id, later(1))).toBe("done");
  expect(await recordEbayAccountDeletion(environment, seller, later(1))).toBe(false);
  expect(send).toHaveBeenCalledOnce();
});

it("la cancellazione di un acquirente elimina i suoi ordini in ogni negozio dell'ambiente", async () => {
  const revision = async () =>
    (await env.DB.prepare("SELECT access_revision FROM workspaces WHERE id = 'w-b'").first<{
      access_revision: number;
    }>())!.access_revision;
  const before = await revision();
  expect(await recordEbayAccountDeletion(environment, buyer, at)).toBe(true);
  expect(await runEbayAccountDeletion(environment, await requestId(), at)).toBe("done");
  expect(await orderIds()).toEqual([
    "o-namesake",
    "o-other",
    "o-sandbox",
    "o-seller-1",
    "o-seller-2",
  ]);
  expect(await count("tax_identifiers WHERE order_id LIKE 'o-buyer%'")).toBe(0);
  expect(await count("order_grants")).toBe(0);
  // Il negozio del venditore resta collegato; gli ordini eliminati non si importano di nuovo.
  expect(
    (
      await env.DB.prepare(
        "SELECT external_key FROM deleted_order_keys WHERE store_id = 's-buyerside' AND kind = 'order' ORDER BY external_key",
      ).all()
    ).results,
  ).toEqual([
    { external_key: "ebay-o-buyer" },
    { external_key: "ebay-o-buyer-merged" },
    { external_key: "ebay-o-buyer-old" },
  ]);
  expect(await count("ebay_stores WHERE data_deleted_at IS NOT NULL")).toBe(0);
  expect(await revision()).toBeGreaterThan(before);
  // La quota già usata resta: è un diritto commerciale minimo, senza dati dell'acquirente.
  expect(await env.DB.prepare("SELECT used FROM free_cycles WHERE id = 'c-b'").first()).toEqual({
    used: 1,
  });
});

it("una notifica senza token né username elimina soltanto ciò che riguarda l'identificativo", async () => {
  expect(
    await recordEbayAccountDeletion(
      environment,
      { ...buyer, eiasToken: null, username: null, userId: "seller-x" },
      at,
    ),
  ).toBe(true);
  expect(await runEbayAccountDeletion(environment, await requestId(), at)).toBe("done");
  expect(await orderIds()).toEqual([
    "o-buyer",
    "o-buyer-merged",
    "o-buyer-old",
    "o-namesake",
    "o-other",
    "o-sandbox",
  ]);
  // Un acquirente noto soltanto per username non si registra senza i suoi ordini.
  expect(
    await recordEbayAccountDeletion(
      environment,
      { ...buyer, userId: "nobody", eiasToken: null, username: "unknown" },
      at,
    ),
  ).toBe(false);
});

it("lavora a lotti, ripartendo dalla coda, e una richiesta occupata non si esegue due volte", async () => {
  await recordEbayAccountDeletion(environment, seller, at);
  const id = await requestId();
  const budget = { batch: 1, batches: 1 };
  expect(await runEbayAccountDeletion(environment, id, at, budget)).toBe("more");
  // Il consenso è già eliminato: nessuna lettura riparte mentre gli ordini restano.
  expect(await count("ebay_store_credentials")).toBe(0);
  expect(await count("orders WHERE store_id = 's-seller'")).toBe(1);
  expect(await runEbayAccountDeletion(environment, id, at, budget)).toBe("more");
  expect(await runEbayAccountDeletion(environment, id, at, budget)).toBe("done");
  expect(await count("orders WHERE store_id = 's-seller'")).toBe(0);

  await env.DB.prepare("UPDATE ebay_account_deletions SET completed_at = NULL, locked_until = ?")
    .bind(later(15).toISOString())
    .run();
  expect(await runEbayAccountDeletion(environment, id, at)).toBe("busy");
  expect(await runEbayAccountDeletion(environment, "missing-request", at)).toBe("missing");

  // Dalla coda: «more» si riaccoda, un errore riprova e dopo tre consegne passa al compito.
  await env.DB.prepare("UPDATE ebay_account_deletions SET locked_until = NULL").run();
  const message = queueMessage({ ebayAccountDeletion: id });
  await consumeEbayAccountDeletion(message, environment, at);
  expect(message.ack).toHaveBeenCalledOnce();
  const failing: Env = {
    ...environment,
    DB: {
      prepare: () => {
        throw new Error("d1_unavailable");
      },
    } as unknown as D1Database,
  };
  const first = queueMessage({ ebayAccountDeletion: id }, 1);
  await consumeEbayAccountDeletion(first, failing, at);
  expect(first.retry).toHaveBeenCalledWith({ delaySeconds: 30 });
  const last = queueMessage({ ebayAccountDeletion: id }, 4);
  await consumeEbayAccountDeletion(last, failing, at);
  expect(last.ack).toHaveBeenCalledOnce();
});

it("il consumer riaccoda il lavoro che supera il budget", async () => {
  await env.DB.batch(
    Array.from(
      { length: 201 },
      (_, index) => buyerOrder(`o-bulk-${index}`, "s-seller", { eias: null, username: "bulk" })[0]!,
    ),
  );
  await recordEbayAccountDeletion(environment, seller, at);
  send.mockClear();
  const id = await requestId();
  const message = queueMessage({ ebayAccountDeletion: id });
  // Un giro elimina fino a 5.000 ordini: qui il negozio ne ha 203 e il lavoro si conclude.
  await consumeEbayAccountDeletion(message, environment, at);
  expect(send).not.toHaveBeenCalled();
  expect(await count("orders WHERE store_id = 's-seller'")).toBe(0);
});

it("dopo un restore il compito ripete la cancellazione dei dati ricomparsi", async () => {
  await recordEbayAccountDeletion(environment, seller, at);
  await recordEbayAccountDeletion(environment, buyer, at);
  await resumeEbayAccountDeletions(environment, at);
  expect(await count("ebay_account_deletions WHERE completed_at IS NOT NULL")).toBe(2);

  // Il restore riporta negozio, accesso con eBay e un ordine dell'acquirente.
  await env.DB.batch([
    env.DB.prepare(`UPDATE ebay_stores SET ebay_user_id = 'seller-x', ebay_account_id = 'seller-x',
        data_deleted_at = NULL WHERE id = 's-seller'`),
    ...buyerOrder("o-seller-restored", "s-seller", { eias: "eias-9", username: "nine" }),
    ...buyerOrder("o-buyer-restored", "s-other", { eias: "eias-buyer", username: "buyer-name" }),
    env.DB.prepare(`INSERT INTO "account" ("id", "accountId", "providerId", "userId", "createdAt",
        "updatedAt") VALUES ('acc-ebay', 'seller-x', 'ebay', 'u-erase-a', ?1, ?1)`).bind(now),
  ]);
  await resumeEbayAccountDeletions(environment, later(10));
  expect(await orderIds()).toEqual(["o-namesake", "o-other", "o-sandbox"]);
  expect(await count(`"account" WHERE "providerId" = 'ebay'`)).toBe(0);
  expect(
    await count(
      "ebay_stores WHERE ebay_account_id = 'seller-x' AND ebay_environment = 'production'",
    ),
  ).toBe(0);
  expect(
    await count("ebay_account_deletions WHERE completed_at = ?", later(10).toISOString()),
  ).toBe(2);
  // Una richiesta conclusa senza dati ricomparsi non si riapre.
  await resumeEbayAccountDeletions(environment, later(20));
  expect(
    await count("ebay_account_deletions WHERE completed_at = ?", later(10).toISOString()),
  ).toBe(2);
});

it("la console segnala una richiesta ferma da oltre un'ora e la pulizia la elimina dopo 30 giorni", async () => {
  await recordEbayAccountDeletion(environment, seller, at);
  const stalled = async (when: Date) =>
    (await listAnomalies(env.DB, when)).filter((anomaly) => anomaly.kind === "account_deletion");
  expect(await stalled(later(60))).toEqual([]);
  expect(await stalled(later(61))).toMatchObject([
    {
      severity: "p2",
      count: 1,
      subjects: [{ id: await requestId(), label: "eBay production", href: "lavori" }],
    },
  ]);
  await runEbayAccountDeletion(environment, await requestId(), at);
  expect(await stalled(later(61))).toEqual([]);
  await purgeExpiredRecords(env.DB, later(30 * 24 * 60));
  expect(await count("ebay_account_deletions")).toBe(1);
  await purgeExpiredRecords(env.DB, later(30 * 24 * 60 + 1));
  expect(await count("ebay_account_deletions")).toBe(0);
});

it("con la pulizia sospesa elenco, ricerca, dettaglio, suggerimenti ed export negano subito scadenza e cancellazione", async () => {
  await env.DB.batch([
    insertEntitlement({
      workspaceId: "w-b",
      source: "premium",
      endsAt: "2099-01-01T00:00:00.000Z",
    }),
    // Acquisto precedente dello stesso acquirente: la fonte del suggerimento.
    env.DB.prepare(`INSERT INTO orders (id, store_id, ebay_order_id, creation_time,
        last_modified_time, currency, total_minor, buyer_json, buyer_eias_token, retention_until,
        purge_after) VALUES ('o-buyer-first', 's-buyerside', 'ebay-o-buyer-first', ?1, ?1, 'EUR',
        990, '{"username":"buyer-name","name":"Mario Rossi"}', 'eias-buyer', ?2, ?2)`).bind(
      "2026-09-01T10:00:00.000Z",
      "2099-01-01T00:00:00.000Z",
    ),
    env.DB.prepare(`INSERT INTO tax_identifiers (id, order_id, identifier_type, issuing_country,
        value, source, observed_at) VALUES ('t-first', 'o-buyer-first', 'CODICE_FISCALE', 'IT',
        'RSSMRA80A01H501U', 'ebay_fulfillment', ?1)`).bind(now),
    env.DB.prepare(
      "UPDATE orders SET retention_until = ?1, purge_after = ?1 WHERE id = 'o-namesake'",
    ).bind(later(5).toISOString()),
  ]);
  await indexOrderSearch(env.DB);
  const user = "u-erase-b";
  const surfaces = async (when: Date) => {
    const exported: string[] = [];
    for await (const page of exportOrderPages(env.DB, user, "production", when, { criteria: {} }))
      exported.push(...page.map((order) => order.id));
    return {
      list: (await listVisibleOrders(env.DB, user, 50, "production", when)).map((o) => o.id).sort(),
      search: (await searchVisibleOrders(env.DB, user, "production", when, ["mario"])).items
        .map((o) => o.id)
        .sort(),
      detail: [
        (await visibleOrderState(env.DB, user, "production", "o-buyer", when)) !== null,
        (await visibleOrderState(env.DB, user, "production", "o-namesake", when)) !== null,
      ],
      suggestions:
        (await orderSuggestions(env.DB, user, ["o-buyer"], "production", when))
          .get("o-buyer")
          ?.suggestions.map((suggestion) => suggestion.sourceOrder) ?? [],
      exported: exported.sort(),
    };
  };
  const all = ["o-buyer", "o-buyer-first", "o-buyer-old", "o-namesake"];
  expect(await surfaces(at)).toEqual({
    list: all,
    search: all,
    detail: [true, true],
    suggestions: ["ebay-o-buyer-first"],
    exported: all,
  });
  // Scadenza: l'ultimo istante vale ancora, il termine no, senza alcuna pulizia.
  const kept = all.filter((id) => id !== "o-namesake");
  expect((await surfaces(new Date(later(5).getTime() - 1))).list).toEqual(all);
  expect(await surfaces(later(5))).toEqual({
    list: kept,
    search: kept,
    detail: [true, false],
    suggestions: ["ebay-o-buyer-first"],
    exported: kept,
  });

  // Cancellazione richiesta da eBay: un file pubblicato prima non si scarica più.
  const file = await publishExportFile(env, {
    userId: user,
    revision: await exportRevision(env.DB, user),
    fileName: "ordini.csv",
    contentType: "text/csv",
    body: new Blob(["ordini"]).stream(),
    now: at,
  });
  expect(await openExportFile(env, user, file!, at)).not.toBeNull();
  await recordEbayAccountDeletion(environment, buyer, at);
  await runEbayAccountDeletion(environment, await requestId(), at);
  expect(await surfaces(at)).toEqual({
    list: ["o-namesake"],
    search: ["o-namesake"],
    detail: [false, true],
    suggestions: [],
    exported: ["o-namesake"],
  });
  expect(await openExportFile(env, user, file!, at)).toBeNull();
});

it("dopo le cancellazioni nessuna tabella conserva l'identità eBay, salvo la richiesta", async () => {
  // Fuori dalla prova: lo stesso identificativo nella Sandbox e un omonimo con un altro token.
  await env.DB.batch([
    env.DB.prepare("DELETE FROM ebay_stores WHERE id = 's-sandbox'"),
    env.DB.prepare("DELETE FROM orders WHERE id = 'o-namesake'"),
    // Un avviso all'owner aperto sulle letture del negozio, con il suo nome fra gli oggetti.
    env.DB.prepare(`INSERT INTO owner_incidents (key, kind, severity, detail, opened_at)
      VALUES ('store_reads:production', 'store_reads', 'p2', ?, ?)`).bind(
      JSON.stringify({ count: 1, total: 1, subjects: ["Negozio X"], href: "negozi" }),
      at.toISOString(),
    ),
  ]);
  await recordEbayAccountDeletion(environment, seller, at);
  await recordEbayAccountDeletion(environment, buyer, at);
  await resumeEbayAccountDeletions(environment, at);
  // Senza chat dell'owner: soltanto l'allineamento, nessun invio.
  const offline = { ...environment, TELEGRAM_OWNER_ID: "" } as unknown as Env;
  await reconcileOwnerIncidents(offline, vi.fn<typeof fetch>(), at);
  const { results: tables } = await env.DB.prepare(
    `SELECT name FROM sqlite_master WHERE type = 'table'
       AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\' AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\'
       AND name NOT IN ('d1_migrations', 'ebay_account_deletions')`,
  ).all<{ name: string }>();
  const identity = ["seller-x", "seller-name", "eias-buyer", "buyer-name", "Negozio X"];
  const found: string[] = [];
  for (const { name } of tables) {
    const { results: columns } = await env.DB.prepare(`SELECT name FROM pragma_table_info(?)`)
      .bind(name)
      .all<{ name: string }>();
    for (const column of columns)
      for (const value of identity)
        if (
          await env.DB.prepare(
            `SELECT 1 FROM "${name}" WHERE instr(CAST("${column.name}" AS TEXT), ?) > 0 LIMIT 1`,
          )
            .bind(value)
            .first()
        )
          found.push(`${name}.${column.name}: ${value}`);
  }
  expect(found).toEqual([]);
  // Il segno era un'impronta: anche quella è eliminata.
  expect(await count("store_identity_marks")).toBe(0);
});
