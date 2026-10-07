/**
 * Pulizia periodica dei dati tecnici scaduti, eseguita dal cron: sessioni, link e challenge
 * di verifica, finestre dei limiti dei tentativi e sessioni di collegamento eBay. Nessuno di
 * questi dati serve dopo la scadenza.
 */
export async function purgeExpiredRecords(db: D1Database, now = new Date()): Promise<void> {
  const at = now.toISOString();
  await db.batch([
    db.prepare('DELETE FROM "session" WHERE "expiresAt" <= ?').bind(at),
    db.prepare('DELETE FROM "verification" WHERE "expiresAt" <= ?').bind(at),
    // Le finestre più lunghe durano un'ora.
    db.prepare('DELETE FROM "rateLimit" WHERE "lastRequest" < ?').bind(now.getTime() - 3_600_000),
    db.prepare("DELETE FROM ebay_store_link_sessions WHERE expires_at <= ?").bind(at),
  ]);
}
