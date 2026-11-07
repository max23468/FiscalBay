import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { purgeExpiredRecords } from "../app/domain/maintenance.server";
import { insertOrder, now, resetDatabase, seed } from "./fixtures/database-fixtures";
import { verifiedSession } from "./fixtures/account-fixtures";

beforeEach(resetDatabase);
afterEach(() => vi.useRealTimers());

describe("pulizia dei dati tecnici scaduti", () => {
  it("elimina solo sessioni, verifiche, limiti e collegamenti scaduti", async () => {
    const { userId } = await verifiedSession("pulizia@example.invalid");
    const at = new Date();
    const past = new Date(at.getTime() - 60_000).toISOString();
    const future = new Date(at.getTime() + 60_000).toISOString();
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO "session" ("id", "expiresAt", "token", "createdAt", "updatedAt", "userId")
         VALUES ('sessione-scaduta', ?1, 'token-scaduto', ?1, ?1, ?2)`,
      ).bind(past, userId),
      env.DB.prepare(
        `INSERT INTO "verification" ("id", "identifier", "value", "expiresAt", "createdAt", "updatedAt")
         VALUES ('scaduta', 'pulizia', 'x', ?1, ?1, ?1), ('valida', 'pulizia', 'x', ?2, ?1, ?1)`,
      ).bind(past, future),
      env.DB.prepare(
        `INSERT INTO "rateLimit" ("id", "key", "count", "lastRequest")
         VALUES ('vecchio', 'vecchio', 1, ?1), ('recente', 'recente', 1, ?2)`,
      ).bind(at.getTime() - 3_600_001, at.getTime() - 3_599_000),
      env.DB.prepare(
        `INSERT INTO ebay_store_link_sessions (state, user_id, code_verifier, expires_at)
         VALUES ('scaduto', ?1, 'v', ?2), ('valido', ?1, 'v', ?3)`,
      ).bind(userId, past, future),
      env.DB.prepare(
        `INSERT INTO ebay_call_counts (day, api_origin, call, count)
         VALUES (date(?1, '-8 days'), 'https://api.ebay.com', 'GetOrders', 1),
                (date(?1, '-7 days'), 'https://api.ebay.com', 'GetOrders', 1)`,
      ).bind(at.toISOString()),
    ]);

    await purgeExpiredRecords(env.DB, at);

    const ids = async (sql: string) =>
      (await env.DB.prepare(sql).all<{ id: string }>()).results.map((row) => row.id);
    expect(await ids('SELECT "id" FROM "session" WHERE "userId" = \'' + userId + "'")).toHaveLength(
      1,
    );
    expect(await ids('SELECT "id" FROM "verification" WHERE "identifier" = \'pulizia\'')).toEqual([
      "valida",
    ]);
    expect(
      await ids('SELECT "id" FROM "rateLimit" WHERE "id" IN (\'vecchio\', \'recente\')'),
    ).toEqual(["recente"]);
    expect(
      await ids(
        "SELECT state AS id FROM ebay_store_link_sessions WHERE state IN ('scaduto', 'valido')",
      ),
    ).toEqual(["valido"]);
    // Dei conteggi delle chiamate eBay resta l'ultima settimana.
    expect(await ids("SELECT day AS id FROM ebay_call_counts").then((days) => days.length)).toBe(1);

    // La sessione creata da Better Auth usa lo stesso formato: oltre la scadenza se ne va.
    await purgeExpiredRecords(env.DB, new Date(at.getTime() + 8 * 24 * 60 * 60 * 1000));
    expect(await ids(`SELECT "id" FROM "session" WHERE "userId" = '${userId}'`)).toEqual([]);
  });
});

describe("pulizia degli ordini scaduti", () => {
  const day = 86_400_000;
  const at = new Date(Date.parse(now) + 400 * day);
  const iso = (time: number) => new Date(time).toISOString();
  const markers = async () =>
    (
      await env.DB.prepare(
        "SELECT external_key FROM deleted_order_keys WHERE kind = 'order' ORDER BY external_key",
      ).all<{ external_key: string }>()
    ).results.map((row) => row.external_key);
  const count = async (sql: string) =>
    (await env.DB.prepare(sql).first<{ total: number }>())!.total;

  beforeEach(seed);

  it("elimina gli ordini scaduti a blocchi senza bloccarne il reimport", async () => {
    const expired = iso(at.getTime() - day);
    await env.DB.batch(
      Array.from({ length: 450 }, (_, index) =>
        insertOrder(`scaduto-${index}`, { retentionUntil: expired, withTax: false }),
      ).flat(),
    );
    await purgeExpiredRecords(env.DB, at);
    expect(await count("SELECT COUNT(*) AS total FROM orders WHERE id LIKE 'scaduto-%'")).toBe(0);
    expect(await markers()).toEqual([]);
    // Il segno della pulizia esiste soltanto dentro il suo batch.
    expect(await count("SELECT COUNT(*) AS total FROM order_expiry_purges")).toBe(0);

    // Una cancellazione voluta resta bloccata.
    await env.DB.batch(insertOrder("voluto"));
    await env.DB.prepare("DELETE FROM orders WHERE id = 'voluto'").run();
    expect(await markers()).toEqual(["ebay-voluto"]);
  });

  it("elimina le chiavi anti-reimport dopo due anni", async () => {
    await env.DB.prepare(
      `INSERT INTO deleted_order_keys (store_id, kind, external_key, deleted_at)
       VALUES ('s-a', 'order', 'vecchio', ?1), ('s-a', 'order', 'recente', ?2)`,
    )
      .bind(iso(at.getTime() - 731 * day), iso(at.getTime() - 729 * day))
      .run();
    await purgeExpiredRecords(env.DB, at);
    expect(await markers()).toEqual(["recente"]);
  });

  it("ricostruisce soltanto i blocchi nati da una scadenza dimostrabile", async () => {
    // La migration usa l'orologio di SQLite, non quello simulato dei test.
    const recent = new Date(vi.getRealSystemTime());
    const time = (days: number) => iso(recent.getTime() - days * day);
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE ebay_stores SET ebay_environment = 'production', orders_deleted_through = ?2 WHERE id = ?1",
      ).bind("s-b", time(5)),
      env.DB.prepare(
        `INSERT INTO ebay_account_deletions (id, ebay_environment, ebay_user_id, notified_at,
           requested_at, completed_at)
         VALUES ('acquirente', 'production', 'buyer', ?1, ?1, ?2)`,
      ).bind(time(10), time(9)),
      env.DB.prepare(
        `INSERT INTO deleted_order_keys (store_id, kind, external_key, deleted_at) VALUES
           ('s-a', 'order', 'scadenza', ?1),
           ('s-a', 'line', 'riga-scadenza', ?1),
           ('s-a', 'order', 'cancellazione-ebay', ?2),
           ('s-b', 'order', 'negozio-eliminato', ?3),
           ('s-a', 'order', 'oltre-trenta-giorni', ?4)`,
      ).bind(
        time(3),
        iso(recent.getTime() - 9.5 * day),
        iso(recent.getTime() - 5 * day + 1_000),
        time(40),
      ),
    ]);
    const migration = env.TEST_MIGRATIONS.find(({ name }) => name === "0074_expiry_purge.sql")!;
    const rebuild = migration.queries.filter((query) =>
      query.includes("DELETE FROM deleted_order_keys"),
    );
    await env.DB.batch(rebuild.map((query) => env.DB.prepare(query)));
    expect(
      (
        await env.DB.prepare(
          "SELECT external_key FROM deleted_order_keys ORDER BY external_key",
        ).all<{ external_key: string }>()
      ).results.map((row) => row.external_key),
    ).toEqual(["cancellazione-ebay", "negozio-eliminato", "oltre-trenta-giorni"]);
  });
});
