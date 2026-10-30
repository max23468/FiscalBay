import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { after, describe, it } from "node:test";

import {
  batched,
  capture,
  freezeState,
  literal,
  reapply,
  recoveryKey,
  replayStripe,
  restorePoint,
  schemaOf,
  seal,
  telegramResume,
  unseal,
} from "./recovery.mjs";

const point = "2026-10-20T10:00:00.000Z";
const before = "2026-10-15T10:00:00.000Z";
const later = "2026-10-22T10:00:00.000Z";
const directory = mkdtempSync(path.join(tmpdir(), "recovery-"));
after(() => rmSync(directory, { recursive: true, force: true }));

/** D1 locale: migration reali, registro delle migration e tabella interna del provider. */
function database() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  const names = readdirSync("migrations")
    .filter((name) => name.endsWith(".sql"))
    .sort();
  for (const name of names) db.exec(readFileSync(`migrations/${name}`, "utf8"));
  db.exec(`CREATE TABLE d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE);
    CREATE TABLE _cf_KV (key TEXT PRIMARY KEY, value BLOB);`);
  for (const name of names) db.prepare("INSERT INTO d1_migrations (name) VALUES (?)").run(name);
  return db;
}

const plain = (results) => results.map((row) => ({ ...row }));
const runner = (db) => async (statements) => statements.map((sql) => plain(db.prepare(sql).all()));

function user(db, id, at = before) {
  db.prepare(
    `INSERT INTO "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
      VALUES (?, 'Nome', ?, 1, ?, ?)`,
  ).run(id, `${id}@example.invalid`, at, at);
}

function credential(db, id, userId, password, at = before) {
  db.prepare(
    `INSERT INTO "account" ("id", "accountId", "providerId", "userId", "password", "createdAt",
      "updatedAt") VALUES (?, ?, 'credential', ?, ?, ?, ?)`,
  ).run(id, userId, userId, password, at, at);
}

function workspace(db, id, userId) {
  db.prepare("INSERT INTO workspaces (id, name, created_at) VALUES (?, 'Spazio', ?)").run(
    id,
    before,
  );
  db.prepare(
    "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, 'owner')",
  ).run(id, userId);
}

const rows = (db, sql, ...params) => plain(db.prepare(sql).all(...params));

/**
 * Stato al punto di ripristino, poi gli eventi successivi sul database corrente: il ripristino
 * parte da una copia del primo.
 */
function scenario() {
  const db = database();
  for (const id of ["u-keep", "u-gone", "u-pass"]) user(db, id);
  credential(db, "a-keep", "u-keep", "hash-keep");
  credential(db, "a-pass", "u-pass", "hash-old");
  workspace(db, "w-keep", "u-keep");
  workspace(db, "w-gone", "u-gone");
  db.exec(`INSERT INTO ebay_stores (id, workspace_id, ebay_user_id, linked_at, store_name)
      VALUES ('st-keep', 'w-keep', 'seller-keep', '${before}', 'Negozio K'),
        ('st-back', 'w-keep', 'seller-back', '${before}', 'Negozio B'),
        ('st-gone', 'w-gone', 'seller-gone', '${before}', NULL);
    INSERT INTO ebay_store_credentials (store_id, access_token, access_expires_at, refresh_token,
        refresh_expires_at, granted_at)
      VALUES ('st-keep', 'a', '${later}', 'r', '${later}', '${before}');
    INSERT INTO workspace_entitlements (id, workspace_id, source, starts_at, ends_at)
      VALUES ('e-keep', 'w-keep', 'admin', '${before}', '2026-11-30T00:00:00.000Z');
    INSERT INTO notification_reads (user_id, notification_id, read_at)
      VALUES ('u-keep', 'n-1', '${before}'), ('u-keep', 'n-2', '${before}');
    INSERT INTO "session" ("id", "expiresAt", "token", "createdAt", "updatedAt", "userId")
      VALUES ('s-old', '2026-12-01T00:00:00.000Z', 'token-old', '${before}', '${before}', 'u-keep');
    INSERT INTO "verification" ("id", "identifier", "value", "expiresAt", "createdAt", "updatedAt")
      VALUES ('v-old', 'reset', 'valore', '2026-12-01T00:00:00.000Z', '${before}', '${before}');
    INSERT INTO _cf_KV (key, value) VALUES ('interno', NULL);
    UPDATE "user" SET "admin" = 1 WHERE "id" IN ('u-keep', 'u-pass');
    INSERT INTO telegram_links (workspace_id, id, chat_id, language, linked_at)
      VALUES ('w-keep', 'l-old', 'chat-old', 'it', '${before}');
    INSERT INTO telegram_preferences (workspace_id, enabled, updated_at)
      VALUES ('w-keep', 1, '${before}');`);
  const snapshot = path.join(directory, `snapshot-${Math.random().toString(36).slice(2)}.sqlite`);
  db.exec(`VACUUM INTO '${snapshot}'`);
  // Dopo il punto: cancellazioni, revoche, una password cambiata e righe nuove.
  db.exec(`DELETE FROM "user" WHERE "id" = 'u-gone';
    DELETE FROM workspaces WHERE id = 'w-gone';
    DELETE FROM notification_reads WHERE notification_id = 'n-2';
    INSERT INTO account_deletions (id, user_id, workspace_id, requested_at, renewals_stopped_at,
      user_deleted_at, completed_at)
      VALUES ('ad-gone', 'u-gone', 'w-gone', '${later}', '${later}', '${later}', '${later}');
    INSERT INTO stripe_customer_erasures (customer_id, environment, source, received_at)
      VALUES ('cus_gone', 'test', 'webhook', '${later}');
    INSERT INTO deleted_order_keys (store_id, kind, external_key, deleted_at)
      VALUES ('st-keep', 'order', '12-00000-00001', '${later}');
    UPDATE workspace_entitlements SET revoked_at = '${later}' WHERE id = 'e-keep';
    UPDATE ebay_stores SET data_deleted_at = '${later}', store_name = NULL,
      orders_deleted_through = '${later}' WHERE id IN ('st-keep', 'st-back');
    UPDATE ebay_stores SET data_deleted_at = NULL WHERE id = 'st-back';
    UPDATE ebay_store_credentials SET rejected_at = '${later}' WHERE store_id = 'st-keep';
    UPDATE workspaces SET trial_used_at = '${later}' WHERE id = 'w-keep';
    UPDATE "account" SET "password" = 'hash-new', "updatedAt" = '${later}' WHERE "id" = 'a-pass';
    UPDATE "user" SET "admin" = 0 WHERE "id" = 'u-keep';
    UPDATE telegram_links SET id = 'l-new', chat_id = 'chat-new', linked_at = '${later}'
      WHERE workspace_id = 'w-keep';
    UPDATE telegram_preferences SET enabled = 0, updated_at = '${later}' WHERE workspace_id = 'w-keep';
    INSERT INTO telegram_store_preferences (store_id, enabled, updated_at)
      VALUES ('st-keep', 0, '${later}');
    INSERT INTO "session" ("id", "expiresAt", "token", "createdAt", "updatedAt", "userId")
      VALUES ('s-new', '2026-12-01T00:00:00.000Z', 'token-new', '${later}', '${later}', 'u-keep');`);
  user(db, "u-new", later);
  db.exec(`INSERT INTO marketing_consents (id, user_id, granted, text_version, language, recorded_at)
      VALUES ('mc-new', 'u-new', 1, '2026-10', 'it', '${later}')`);
  const restored = new DatabaseSync(snapshot);
  restored.exec("PRAGMA foreign_keys = ON");
  return { current: db, restored };
}

describe("ripristino senza dati o diritti revocati", () => {
  it("ordina le tabelle dalle figlie alle madri ed esclude quelle interne", async () => {
    const tables = (await schemaOf(runner(database()))).map(({ name }) => name);
    const position = (name) => tables.indexOf(name);
    for (const [child, parent] of [
      ["session", "user"],
      ["ebay_stores", "workspaces"],
      ["orders", "ebay_stores"],
      ["order_grants", "free_cycles"],
      ["telegram_link_requests", "session"],
    ])
      assert.ok(position(child) < position(parent), `${child} prima di ${parent}`);
    for (const name of ["d1_migrations", "_cf_KV", "sqlite_sequence"])
      assert.ok(!tables.includes(name));
  });

  it("riapplica cancellazioni, marker, revoche e credenziali sul database ripristinato", async () => {
    const { current, restored } = scenario();
    const captured = await capture(runner(current), "2026-10-20T10:30:00.000Z");
    assert.equal(captured.since, "2026-10-20T09:30:00.000Z");
    assert.deepEqual(captured.credentials, ["a-pass"]);
    assert.equal(captured.telegramSends, null);
    const result = await reapply(runner(restored), captured, new Date(later));
    assert.deepEqual(result.deleted, {
      ebay_stores: 1,
      notification_reads: 1,
      user: 1,
      workspace_members: 1,
      workspaces: 1,
    });
    assert.equal(result.stamps, 6);
    assert.deepEqual(rows(restored, "SELECT rejected_at FROM ebay_store_credentials"), [
      { rejected_at: later },
    ]);
    assert.equal(result.credentials, 1);
    assert.deepEqual(rows(restored, `SELECT "id" FROM "user" ORDER BY "id"`), [
      { id: "u-keep" },
      { id: "u-pass" },
    ]);
    assert.deepEqual(rows(restored, "SELECT notification_id FROM notification_reads"), [
      { notification_id: "n-1" },
    ]);
    // Profilo eliminato e limite degli ordini eliminati, anche dopo un nuovo collegamento.
    assert.deepEqual(
      rows(
        restored,
        `SELECT id, data_deleted_at, store_name, orders_deleted_through FROM ebay_stores
          ORDER BY id`,
      ),
      [
        {
          id: "st-back",
          data_deleted_at: null,
          store_name: "Negozio B",
          orders_deleted_through: later,
        },
        { id: "st-keep", data_deleted_at: later, store_name: null, orders_deleted_through: later },
      ],
    );
    // Nessuna sessione o verifica torna valida, nemmeno quelle esistenti al punto.
    assert.deepEqual(rows(restored, `SELECT "id" FROM "session"`), []);
    assert.deepEqual(rows(restored, `SELECT "id" FROM "verification"`), []);
    assert.deepEqual(
      rows(restored, "SELECT id, completed_at FROM account_deletions").map(({ id }) => id),
      ["ad-gone"],
    );
    assert.equal(rows(restored, "SELECT * FROM stripe_customer_erasures").length, 1);
    assert.deepEqual(rows(restored, "SELECT external_key FROM deleted_order_keys"), [
      { external_key: "12-00000-00001" },
    ]);
    // Il consenso di un utente nato dopo il punto non ha più l'utente: resta fuori.
    assert.deepEqual(rows(restored, "SELECT id FROM marketing_consents"), []);
    assert.deepEqual(rows(restored, "SELECT revoked_at FROM workspace_entitlements"), [
      { revoked_at: later },
    ]);
    assert.deepEqual(rows(restored, "SELECT trial_used_at FROM workspaces"), [
      { trial_used_at: later },
    ]);
    assert.deepEqual(rows(restored, `SELECT "id", "password" FROM "account" ORDER BY "id"`), [
      { id: "a-keep", password: "hash-keep" },
      { id: "a-pass", password: null },
    ]);
    assert.deepEqual(rows(restored, "SELECT name, value FROM service_settings"), [
      { name: "telegram_sends", value: "false" },
    ]);
    assert.deepEqual(rows(restored, "SELECT key FROM _cf_KV"), [{ key: "interno" }]);
    // Un ruolo admin revocato non torna; quello ancora valido resta.
    assert.deepEqual(rows(restored, `SELECT "id", "admin" FROM "user" ORDER BY "id"`), [
      { id: "u-keep", admin: 0 },
      { id: "u-pass", admin: 1 },
    ]);
    // La chat sostituita non torna destinataria e le notifiche disattivate restano spente.
    assert.deepEqual(rows(restored, "SELECT workspace_id, id, chat_id FROM telegram_links"), [
      { workspace_id: "w-keep", id: "l-new", chat_id: "chat-new" },
    ]);
    assert.deepEqual(rows(restored, "SELECT enabled FROM telegram_preferences"), [{ enabled: 0 }]);
    assert.deepEqual(rows(restored, "SELECT store_id, enabled FROM telegram_store_preferences"), [
      { store_id: "st-keep", enabled: 0 },
    ]);
    // Ripetibile: la seconda esecuzione non trova altro da eliminare né da riportare.
    const again = await reapply(runner(restored), captured, new Date(later));
    assert.deepEqual(again.deleted, {});
    assert.deepEqual(rows(restored, `SELECT "id" FROM "user" ORDER BY "id"`).length, 2);
  });

  it("rifiuta un database ripristinato con migration o schema diversi", async () => {
    const { current, restored } = scenario();
    const captured = await capture(runner(current), "2026-10-20T10:30:00.000Z");
    await assert.rejects(
      reapply(runner(restored), { ...captured, migrations: captured.migrations.slice(0, -1) }),
      /Migration del database ripristinato diverse/u,
    );
    await assert.rejects(
      reapply(runner(restored), { ...captured, tables: captured.tables.slice(1) }),
      /Schema del database ripristinato diverso/u,
    );
    assert.deepEqual(rows(restored, `SELECT "id" FROM "session"`), [{ id: "s-old" }]);
  });

  it("riprende Telegram senza gli eventi precedenti e con l'interruttore di prima", async () => {
    const db = database();
    const run = runner(db);
    db.exec(`INSERT INTO service_settings (name, value, updated_at)
      VALUES ('telegram_sends', 'false', '${point}')`);
    await run(telegramResume({ telegramSends: "true" }, new Date(later)));
    assert.deepEqual(rows(db, "SELECT value, updated_at FROM service_settings"), [
      { value: "true", updated_at: later },
    ]);
    await run(telegramResume({ telegramSends: null }, new Date(later)));
    assert.deepEqual(rows(db, "SELECT * FROM service_settings"), []);
    assert.match(telegramResume({ telegramSends: null }, new Date(later))[0], /resumed_at = '/u);
  });
});

describe("file e controlli del ripristino", () => {
  const key = recoveryKey(Buffer.alloc(32, 7).toString("base64"));
  const header = { format: 1, live: false, database: "db", bookmark: "b", undo: "u" };

  it("cifra il contenuto e autentica l'intestazione", () => {
    const text = seal(header, { keys: { user: [["u-1"]] } }, key);
    assert.ok(!text.includes("u-1"));
    assert.deepEqual(unseal(text, key), { header, payload: { keys: { user: [["u-1"]] } } });
    const altered = JSON.parse(text);
    altered.header.bookmark = "altro";
    assert.throws(() => unseal(JSON.stringify(altered), key), /alterato o chiave errata/u);
    assert.throws(
      () => unseal(text, recoveryKey(Buffer.alloc(32, 8).toString("base64"))),
      /alterato o chiave errata/u,
    );
    assert.throws(() => recoveryKey(Buffer.alloc(16).toString("base64")), /32 byte/u);
    assert.throws(() => recoveryKey(undefined), /32 byte/u);
  });

  it("ammette soltanto un istante passato entro la finestra di Time Travel", () => {
    const now = new Date(later);
    assert.equal(restorePoint("2026-10-20T10:00:00Z", now), point);
    for (const value of [undefined, "ieri", later, "2026-09-21T09:59:59.000Z"])
      assert.throws(() => restorePoint(value, now), /entro 30 giorni/u);
  });

  it("riconosce la sospensione soltanto quando le tre fonti concordano", () => {
    const frozen = { secret: true, paused: true, status: 503, marked: true };
    assert.equal(freezeState(frozen), "frozen");
    assert.equal(freezeState({ secret: false, paused: false, status: 200, marked: false }), "open");
    for (const change of [{ secret: false }, { paused: false }, { status: 200 }, { marked: false }])
      assert.equal(freezeState({ ...frozen, ...change }), "partial");
    assert.equal(
      freezeState({ secret: false, paused: false, status: 503, marked: false }),
      "partial",
    );
  });

  it("divide le istruzioni entro il limite e protegge i valori", () => {
    const statements = batched(["aa", "bb", "cc"], "X(", (item) => literal(item), ")", 14);
    assert.deepEqual(statements, ["X('aa', 'bb')", "X('cc')"]);
    assert.deepEqual(batched([], "X(", literal), []);
    assert.equal(literal("l'ordine"), "'l''ordine'");
    assert.equal(literal(null), "NULL");
    assert.equal(literal(3), "3");
    assert.throws(() => literal(Number.NaN), /non rappresentabile/u);
    assert.throws(() => literal(true), /non previsto/u);
  });

  it("reinvia all'endpoint dell'ambiente gli eventi Stripe dal punto, dal più vecchio", () => {
    const calls = [];
    const pages = [
      { data: [{ id: "evt_3" }, { id: "evt_2" }], has_more: true },
      { data: [{ id: "evt_1" }], has_more: false },
    ];
    const request = (method, resource, params) => {
      calls.push([method, resource, params]);
      if (resource === "/v1/webhook_endpoints")
        return {
          data: [
            { id: "we_altro", url: "https://fiscalbay.it/webhooks/stripe" },
            { id: "we_test", url: "https://test.fiscalbay.it/webhooks/stripe" },
          ],
        };
      if (resource === "/v1/events") return pages.shift();
      return {};
    };
    assert.equal(replayStripe(request, "https://test.fiscalbay.it", point), 3);
    const listed = calls.filter(([, resource]) => resource === "/v1/events");
    assert.equal(listed[0][2]["created[gte]"], Date.parse(point) / 1000);
    assert.ok(listed[0][2].types.includes("invoice.paid"));
    assert.equal(listed[0][2].starting_after, undefined);
    assert.equal(listed[1][2].starting_after, "evt_2");
    assert.deepEqual(
      calls.filter(([method]) => method === "post"),
      ["evt_1", "evt_2", "evt_3"].map((id) => [
        "post",
        `/v1/events/${id}/retry`,
        { webhook_endpoint: "we_test" },
      ]),
    );
    assert.throws(
      () => replayStripe(() => ({ data: [] }), "https://test.fiscalbay.it", point),
      /Endpoint Stripe dell'ambiente assente/u,
    );
  });
});
