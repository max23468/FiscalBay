import { z } from "zod";

import { storeLabelSql } from "./store-state.server";
import { maxAuditReason } from "../limits";

/**
 * Registro delle operazioni della console amministrativa (§15): ogni operazione eseguita da un
 * admin lascia autore, oggetto, motivo ed esito, anche quando lo stato riletto la rifiuta. Il
 * registro non contiene dati dei buyer né valori fiscali.
 */

/** Conservazione del registro: un anno dall'operazione. */
export const auditRetentionDays = 365;

/** Motivo obbligatorio delle operazioni che cambiano diritti, configurazioni o negozi. */
export const reasonSchema = z.string().trim().min(1).max(maxAuditReason);

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
  /** Spazio e negozio dell'oggetto, quando l'operazione li riguarda, con nomi leggibili. */
  workspace: { id: string; email: string | null } | null;
  store: { id: string; label: string | null } | null;
  actor: string;
  actorEmail: string | null;
  operation: string;
  target: string | null;
  reason: string | null;
  outcome: string;
  at: string;
};

/** Spazio e negozio indicati nell'oggetto del registro, come `workspace:<id>:store:<id>`. */
function targetParts(target: string | null) {
  const match = /^(?:workspace:([^:]+))?(?::?store:([^:]+))?$/u.exec(target ?? "");
  return { workspace: match?.[1] ?? null, store: match?.[2] ?? null };
}

/** Ultime operazioni, dalla più recente, eventualmente di un solo oggetto. */
export async function listAudit(
  db: D1Database,
  /** `changes`: soltanto le operazioni, senza le letture con l'accesso tecnico. */
  options: { target?: string; limit?: number; changes?: boolean } = {},
): Promise<AuditRow[]> {
  const { results } = await db
    .prepare(`SELECT a.id, a.actor, u.email AS actorEmail, a.operation, a.target, a.reason,
        a.outcome, a.at
      FROM admin_audit a LEFT JOIN "user" u ON u.id = a.actor
      WHERE (?1 IS NULL OR a.target = ?1 OR a.target LIKE ?1 || ':%')
        AND (?3 = 0 OR a.operation <> 'agent-read')
      ORDER BY a.at DESC, a.rowid DESC LIMIT ?2`)
    .bind(options.target ?? null, options.limit ?? 100, options.changes ? 1 : 0)
    .all<Omit<AuditRow, "workspace" | "store">>();
  const parts = results.map((row) => targetParts(row.target));
  const workspaces = [...new Set(parts.flatMap(({ workspace }) => workspace ?? []))];
  const stores = [...new Set(parts.flatMap(({ store }) => store ?? []))];
  const [{ results: owners }, { results: names }] = await db.batch<{
    id: string;
    name: string | null;
  }>([
    db
      .prepare(`SELECT w.id, (SELECT u.email FROM workspace_members wm
          JOIN "user" u ON u.id = wm.user_id WHERE wm.workspace_id = w.id
          ORDER BY wm.role = 'owner' DESC LIMIT 1) AS name
        FROM workspaces w WHERE w.id IN (SELECT value FROM json_each(?))`)
      .bind(JSON.stringify(workspaces)),
    db
      .prepare(`SELECT s.id, ${storeLabelSql("s")} AS name FROM ebay_stores s
        WHERE s.id IN (SELECT value FROM json_each(?))`)
      .bind(JSON.stringify(stores)),
  ]);
  const owner = new Map(owners.map((row) => [row.id, row.name]));
  const label = new Map(names.map((row) => [row.id, row.name]));
  return results.map((row, index) => {
    const { workspace, store } = parts[index]!;
    return {
      ...row,
      workspace: workspace ? { id: workspace, email: owner.get(workspace) ?? null } : null,
      store: store ? { id: store, label: label.get(store) ?? null } : null,
    };
  });
}
