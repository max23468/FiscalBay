import { z } from "zod";

/**
 * Registro delle operazioni della console amministrativa (§15): ogni operazione eseguita da un
 * admin lascia autore, oggetto, motivo ed esito, anche quando lo stato riletto la rifiuta. Il
 * registro non contiene dati dei buyer né valori fiscali.
 */

/** Conservazione del registro: un anno dall'operazione. */
export const auditRetentionDays = 365;

/** Motivo obbligatorio delle operazioni che cambiano diritti, configurazioni o negozi. */
export const reasonSchema = z.string().trim().min(1).max(500);

export type AuditEntry = {
  actor: string;
  operation: string;
  target?: string | null;
  reason?: string | null;
  outcome: string;
};

/** Riga del registro, da eseguire nello stesso batch dell'operazione quando è possibile. */
export function auditStatement(db: D1Database, entry: AuditEntry, at: string) {
  return db
    .prepare(`INSERT INTO admin_audit (id, actor, operation, target, reason, outcome, at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(
      crypto.randomUUID(),
      entry.actor,
      entry.operation,
      entry.target ?? null,
      entry.reason?.trim() || null,
      entry.outcome,
      at,
    );
}

export async function recordAudit(db: D1Database, entry: AuditEntry, now = new Date()) {
  await auditStatement(db, entry, now.toISOString()).run();
}

export type AuditRow = {
  id: string;
  actor: string;
  actorEmail: string | null;
  operation: string;
  target: string | null;
  reason: string | null;
  outcome: string;
  at: string;
};

/** Ultime operazioni, dalla più recente, eventualmente di un solo oggetto. */
export async function listAudit(
  db: D1Database,
  options: { target?: string; limit?: number } = {},
): Promise<AuditRow[]> {
  const { results } = await db
    .prepare(`SELECT a.id, a.actor, u.email AS actorEmail, a.operation, a.target, a.reason,
        a.outcome, a.at
      FROM admin_audit a LEFT JOIN "user" u ON u.id = a.actor
      WHERE ?1 IS NULL OR a.target = ?1 OR a.target LIKE ?1 || ':%'
      ORDER BY a.at DESC, a.rowid DESC LIMIT ?2`)
    .bind(options.target ?? null, options.limit ?? 100)
    .all<AuditRow>();
  return results;
}
