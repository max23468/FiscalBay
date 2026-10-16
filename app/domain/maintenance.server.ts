/**
 * Pulizia periodica degli ordini e dei dati tecnici scaduti, eseguita dal consumer
 * del compito giornaliero. L'accesso è già negato prima della cancellazione fisica.
 */
export async function purgeExpiredRecords(db: D1Database, now = new Date()): Promise<void> {
  const at = now.toISOString();
  await db.batch([
    // Le FK eliminano anche buyer, articoli, fonti, verifiche, versioni e grant.
    // Il trigger registra prima i riferimenti necessari a impedire il reimport.
    db.prepare("DELETE FROM orders WHERE merged_into IS NULL AND purge_after <= ?").bind(at),
    db.prepare("DELETE FROM webhook_receipts WHERE expires_at <= ?").bind(at),
    db.prepare('DELETE FROM "session" WHERE "expiresAt" <= ?').bind(at),
    db.prepare('DELETE FROM "verification" WHERE "expiresAt" <= ?').bind(at),
    // Le finestre più lunghe durano un'ora.
    db.prepare('DELETE FROM "rateLimit" WHERE "lastRequest" < ?').bind(now.getTime() - 3_600_000),
    db.prepare("DELETE FROM ebay_store_link_sessions WHERE expires_at <= ?").bind(at),
    db.prepare("DELETE FROM account_email_changes WHERE expires_at <= ?").bind(at),
  ]);
}
