import { derivedKey, hex } from "../sealed.server";
import { dayMilliseconds } from "../time";
import { entitlementInForce, freeCycleStatement } from "./grants.server";

/**
 * Segni minimi dei negozi che lasciano uno spazio, per cancellazione dell'account o per
 * trasferimento assistito: impronta dell'identità eBay, prova già usata e ciclo Free in corso.
 * Il collegamento successivo dello stesso negozio li rilegge e li applica al nuovo spazio.
 */

/**
 * Il segno della prova usata dura due anni, scelta dell'owner (D220); quello
 * del ciclo Free soltanto fino alla fine del ciclo.
 */
export const trialMarkDays = 730;

// Stryker disable next-line StringLiteral: lo scopo deriva la chiave; un altro valore, uguale per scrittura e confronto, dà lo stesso esito.
const markPurpose = "store-identity-mark";

/** Chiave HMAC dei segni, derivata dal segreto del server con uno scopo dedicato. */
const markKey = (secret: string) =>
  derivedKey(secret, markPurpose, { name: "HMAC", hash: "SHA-256", length: 256 }, ["sign"]);

/**
 * Impronta dell'identità eBay di un negozio, come la conserva `ebay_stores.ebay_user_id`: HMAC
 * con una chiave del server, quindi chi conosce soltanto l'identificativo eBay non la ricalcola.
 */
export async function storeIdentityHash(secret: string, ebayUserId: string): Promise<string> {
  return hex(
    await crypto.subtle.sign("HMAC", await markKey(secret), new TextEncoder().encode(ebayUserId)),
  );
}

/** Fine del segno della prova già usata, registrato all'istante dato. */
export function trialMarkExpiry(now: Date): string {
  return new Date(now.getTime() + trialMarkDays * dayMilliseconds).toISOString();
}

/**
 * Segno minimo di un negozio con i dati del suo spazio: prova già usata e ciclo Free in corso
 * con almeno uno sblocco. Senza nessuno dei due il negozio non lascia nulla; ripetuto, conserva
 * il valore più ampio. Argomenti: espressioni SQL dell'impronta, del negozio, dell'istante e
 * della fine del segno della prova, più una condizione che deve valere per scriverlo. Lo
 * scrivono la cancellazione dell'account e il trasferimento assistito del negozio.
 */
export function storeMarkSql(
  input: { hash: string; store: string; at: string; trialExpires: string },
  condition = "1 = 1",
) {
  const { hash, store, at, trialExpires } = input;
  return `INSERT INTO store_identity_marks (identity_hash, trial_used, cycle_anchor_at,
      cycle_starts_at, cycle_ends_at, cycle_quota, cycle_used, recorded_at, expires_at)
    SELECT ${hash}, m.trial_used, CASE WHEN m.starts_at IS NOT NULL THEN m.anchor END,
      m.starts_at, m.ends_at, m.quota, m.used, ${at},
      CASE WHEN m.trial_used THEN ${trialExpires} ELSE m.ends_at END
    FROM (SELECT w.free_cycle_anchor_at AS anchor,
        (w.trial_used_at IS NOT NULL OR EXISTS (SELECT 1 FROM workspace_entitlements e
          WHERE e.workspace_id = w.id AND e.source = 'trial')) AS trial_used,
        c.starts_at, c.ends_at, c.quota, c.used
      FROM ebay_stores s JOIN workspaces w ON w.id = s.workspace_id
      LEFT JOIN free_cycles c ON c.workspace_id = w.id AND c.used > 0
        AND julianday(c.starts_at) <= julianday(${at}) AND julianday(${at}) < julianday(c.ends_at)
      WHERE s.id = ${store}) m
    WHERE (m.trial_used OR m.starts_at IS NOT NULL) AND ${condition}
    ON CONFLICT(identity_hash) DO UPDATE SET
      trial_used = MAX(trial_used, excluded.trial_used),
      cycle_anchor_at = COALESCE(excluded.cycle_anchor_at, cycle_anchor_at),
      cycle_starts_at = COALESCE(excluded.cycle_starts_at, cycle_starts_at),
      cycle_ends_at = COALESCE(excluded.cycle_ends_at, cycle_ends_at),
      cycle_quota = COALESCE(excluded.cycle_quota, cycle_quota),
      cycle_used = CASE WHEN excluded.cycle_starts_at IS NULL THEN cycle_used
        WHEN excluded.cycle_starts_at = cycle_starts_at THEN MAX(cycle_used, excluded.cycle_used)
        ELSE excluded.cycle_used END,
      expires_at = MAX(expires_at, excluded.expires_at)`;
}

/** Segno ancora valido di un negozio lasciato da uno spazio cancellato o da un trasferimento. */
export type StoreMark = {
  trialUsed: boolean;
  cycle: { anchor: string; startsAt: string; endsAt: string; quota: number; used: number } | null;
};

export async function readStoreMark(
  db: D1Database,
  secret: string,
  ebayUserId: string,
  now: Date,
): Promise<StoreMark | null> {
  const row = await db
    .prepare(`SELECT trial_used, cycle_anchor_at, cycle_starts_at, cycle_ends_at, cycle_quota,
        cycle_used FROM store_identity_marks WHERE identity_hash = ?1 AND expires_at > ?2`)
    .bind(await storeIdentityHash(secret, ebayUserId), now.toISOString())
    .first<{
      trial_used: number;
      cycle_anchor_at: string | null;
      cycle_starts_at: string | null;
      cycle_ends_at: string | null;
      cycle_quota: number | null;
      cycle_used: number | null;
    }>();
  if (!row) return null;
  return {
    trialUsed: !!row.trial_used,
    cycle:
      row.cycle_anchor_at && row.cycle_starts_at && Date.parse(row.cycle_ends_at!) > now.getTime()
        ? {
            anchor: row.cycle_anchor_at,
            startsAt: row.cycle_starts_at,
            endsAt: row.cycle_ends_at!,
            quota: row.cycle_quota!,
            used: row.cycle_used!,
          }
        : null,
  };
}

/**
 * Prima del collegamento di un negozio con un segno: uno spazio ancora senza cicli adotta
 * l'ancoraggio del ciclo in corso, così il ciclo prosegue con i suoi confini e il trigger del
 * collegamento non ne fissa uno nuovo. Non se il negozio è già di un altro spazio, perché il
 * collegamento non riuscirebbe.
 */
export function markAnchorStatement(
  db: D1Database,
  workspaceId: string,
  ebayUserId: string,
  mark: StoreMark | null,
) {
  return mark?.cycle
    ? [
        db
          .prepare(`UPDATE workspaces SET free_cycle_anchor_at = ?2
            WHERE id = ?1 AND free_cycle_anchor_at IS NULL AND NOT EXISTS (
              SELECT 1 FROM ebay_stores WHERE ebay_user_id = ?3 AND workspace_id <> ?1)`)
          .bind(workspaceId, mark.cycle.anchor, ebayUserId),
      ]
    : [];
}

/**
 * Dopo il collegamento riuscito, la stessa regola per un segno lasciato da una cancellazione o
 * da un trasferimento. Con la prova già usata lo spazio non può più averla e una prova in corso
 * termina subito: lo spazio torna al Free. Gli sblocchi del ciclo del segno si aggiungono al
 * ciclo Free in corso dello spazio, fino alla sua quota; uno spazio che ha adottato l'ancoraggio
 * del segno riprende proprio quel ciclo, con la sua quota. Gli sblocchi già arrivati dallo
 * stesso ciclo di partenza, con un altro negozio o un collegamento precedente, non si sommano di
 * nuovo: ripetuto, il collegamento non cambia nulla.
 */
export async function applyStoreMark(
  db: D1Database,
  workspaceId: string,
  mark: StoreMark,
  now: Date,
) {
  const at = now.toISOString();
  const { cycle } = mark;
  const anchor = cycle
    ? await db
        .prepare("SELECT free_cycle_anchor_at FROM workspaces WHERE id = ?")
        .bind(workspaceId)
        .first<string>("free_cycle_anchor_at")
    : null;
  const current = cycle ? freeCycleStatement(db, workspaceId, anchor, now) : null;
  // Ciclo in corso dello spazio, nelle istruzioni seguenti: ?1 spazio, ?2 istante.
  const currentCycle = `workspace_id = ?1 AND julianday(starts_at) <= julianday(?2)
    AND julianday(?2) < julianday(ends_at)`;
  await db.batch([
    ...(mark.trialUsed
      ? [
          db
            .prepare(
              "UPDATE workspaces SET trial_used_at = COALESCE(trial_used_at, ?2) WHERE id = ?1",
            )
            .bind(workspaceId, at),
          db
            .prepare(`UPDATE workspace_entitlements SET revoked_at = ?2
              WHERE workspace_id = ?1 AND source = 'trial'
                AND ${entitlementInForce("workspace_entitlements", "?2")}`)
            .bind(workspaceId, at),
        ]
      : []),
    ...(cycle
      ? [
          db
            .prepare(`INSERT INTO free_cycles (id, workspace_id, starts_at, ends_at, quota)
              SELECT ?1, w.id, ?3, ?4, ?5 FROM workspaces w
               WHERE w.id = ?2 AND w.free_cycle_anchor_at = ?6
              ON CONFLICT(workspace_id, starts_at) DO NOTHING`)
            .bind(
              crypto.randomUUID(),
              workspaceId,
              cycle.startsAt,
              cycle.endsAt,
              cycle.quota,
              cycle.anchor,
            ),
          ...(current ? [current] : []),
          db
            .prepare(`UPDATE free_cycles SET used = MIN(quota, used + MAX(0, ?3 - COALESCE(
                (SELECT i.used FROM free_cycle_imports i WHERE i.cycle_id = free_cycles.id
                  AND i.origin_anchor_at = ?4 AND i.origin_starts_at = ?5), 0)))
              WHERE ${currentCycle}`)
            .bind(workspaceId, at, cycle.used, cycle.anchor, cycle.startsAt),
          db
            .prepare(`INSERT INTO free_cycle_imports (cycle_id, origin_anchor_at, origin_starts_at,
                used) SELECT id, ?4, ?5, ?3 FROM free_cycles WHERE ${currentCycle}
              ON CONFLICT DO UPDATE SET used = MAX(used, excluded.used)`)
            .bind(workspaceId, at, cycle.used, cycle.anchor, cycle.startsAt),
        ]
      : []),
  ]);
}
