import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { purgeExpiredRecords } from "../app/domain/maintenance.server";
import { resetDatabase } from "./fixtures/database-fixtures";
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

    // La sessione creata da Better Auth usa lo stesso formato: oltre la scadenza se ne va.
    await purgeExpiredRecords(env.DB, new Date(at.getTime() + 8 * 24 * 60 * 60 * 1000));
    expect(await ids(`SELECT "id" FROM "session" WHERE "userId" = '${userId}'`)).toEqual([]);
  });
});
