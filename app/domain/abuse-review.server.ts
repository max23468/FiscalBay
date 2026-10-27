import { storeNameSql } from "./store-state.server";

/**
 * Revisione antiabuso (§15): più spazi che sembrano la stessa attività, per ottenere più
 * volte prova e beneficio Free. I segnali usano soltanto dati già presenti: ragione sociale del
 * profilo, nome del negozio eBay e cliente Stripe condivisi fra spazi diversi. L'admin registra
 * «nessun abuso» oppure sospende il beneficio Free di uno degli spazi con la pausa
 * dell'assistenza sui suoi negozi. I segnali mostrano il valore condiviso soltanto all'admin e
 * la chiave della revisione ne conserva l'impronta, non il valore.
 */

export type AbuseSignalKind = "company" | "store_name" | "customer";

export type AbuseSignal = {
  key: string;
  kind: AbuseSignalKind;
  value: string;
  workspaces: { id: string; email: string | null; premium: boolean }[];
  review: { outcome: "clear" | "suspended"; workspaceId: string | null; at: string } | null;
};

/** Forma confrontabile di un nome: minuscole, senza spazi, punteggiatura e forma societaria. */
export function normalizedName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\b(s\.?r\.?l\.?s?|s\.?p\.?a\.?|s\.?n\.?c\.?|s\.?a\.?s\.?|ltd|llc|gmbh)\b/gu, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

async function digest(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Chiave stabile della segnalazione: tipo, impronta del valore e spazi coinvolti. */
async function signalKey(kind: AbuseSignalKind, value: string, workspaces: string[]) {
  return `${kind}:${(await digest(`${kind}\n${value}\n${[...workspaces].sort().join(",")}`)).slice(0, 48)}`;
}

/** Segnalazioni correnti, prima quelle da rivedere. */
export async function listAbuseSignals(db: D1Database, now = new Date()): Promise<AbuseSignal[]> {
  const at = now.toISOString();
  const [{ results: names }, { results: customers }] = await db.batch<{
    kind: "company" | "store_name" | "customer";
    value: string;
    workspace_id: string;
  }>([
    db.prepare(`SELECT 'company' AS kind, p.company_name AS value, wm.workspace_id
        FROM user_profiles p JOIN workspace_members wm ON wm.user_id = p.user_id
        WHERE p.company_name IS NOT NULL
      UNION SELECT 'store_name', ${storeNameSql("s")}, s.workspace_id FROM ebay_stores s
        WHERE s.store_name IS NOT NULL AND s.data_deleted_at IS NULL
          AND s.ebay_environment = 'production'`),
    db.prepare(`SELECT 'customer' AS kind, customer_id AS value, workspace_id
        FROM stripe_subscriptions
      UNION SELECT 'customer', customer_id, workspace_id FROM lifetime_allocations
        WHERE customer_id IS NOT NULL AND workspace_id IS NOT NULL`),
  ]);
  const groups = new Map<string, { kind: AbuseSignalKind; value: string; ids: Set<string> }>();
  for (const row of [...names, ...customers]) {
    const normalized = row.kind === "customer" ? row.value : normalizedName(row.value);
    if (!normalized) continue;
    const id = `${row.kind}\n${normalized}`;
    const group = groups.get(id) ?? { kind: row.kind, value: row.value, ids: new Set<string>() };
    group.ids.add(row.workspace_id);
    groups.set(id, group);
  }
  const shared = [...groups.entries()].filter(([, group]) => group.ids.size > 1);
  if (shared.length === 0) return [];
  const signals = await Promise.all(
    shared.map(async ([id, group]) => ({
      key: await signalKey(group.kind, id, [...group.ids]),
      group,
    })),
  );
  const [{ results: details }, { results: reviews }] = await db.batch<Record<string, unknown>>([
    db
      .prepare(`SELECT w.id,
          (SELECT u.email FROM workspace_members wm JOIN "user" u ON u.id = wm.user_id
            WHERE wm.workspace_id = w.id AND wm.role = 'owner' LIMIT 1) AS email,
          EXISTS (SELECT 1 FROM workspace_entitlements e WHERE e.workspace_id = w.id
            AND e.revoked_at IS NULL AND e.source <> 'trial'
            AND julianday(e.starts_at) <= julianday(?1)
            AND (e.ends_at IS NULL OR julianday(?1) < julianday(e.ends_at))) AS premium
        FROM workspaces w WHERE w.id IN (SELECT value FROM json_each(?2))`)
      .bind(at, JSON.stringify(signals.flatMap(({ group }) => [...group.ids]))),
    db
      .prepare(`SELECT signal, outcome, workspace_id, reviewed_at FROM abuse_reviews
        WHERE signal IN (SELECT value FROM json_each(?))`)
      .bind(JSON.stringify(signals.map(({ key }) => key))),
  ]);
  const byId = new Map(
    (details as { id: string; email: string | null; premium: number }[]).map((row) => [
      row.id,
      row,
    ]),
  );
  const reviewed = new Map(
    (
      reviews as {
        signal: string;
        outcome: "clear" | "suspended";
        workspace_id: string | null;
        reviewed_at: string;
      }[]
    ).map((row) => [row.signal, row]),
  );
  return signals
    .map(({ key, group }): AbuseSignal => {
      const review = reviewed.get(key);
      return {
        key,
        kind: group.kind,
        value: group.value,
        workspaces: [...group.ids].sort().map((id) => ({
          id,
          email: byId.get(id)?.email ?? null,
          premium: byId.get(id)?.premium === 1,
        })),
        review: review
          ? { outcome: review.outcome, workspaceId: review.workspace_id, at: review.reviewed_at }
          : null,
      };
    })
    .sort(
      (a, b) => Number(a.review !== null) - Number(b.review !== null) || a.key.localeCompare(b.key),
    );
}

export type AbuseReviewResult = "done" | "not_found" | "invalid" | "covered";

/**
 * Esito della revisione di una segnalazione corrente. La sospensione mette in pausa
 * dell'assistenza i negozi reali dello spazio indicato, che deve far parte della segnalazione;
 * la pausa si toglie dalla scheda dello spazio. Una revisione ripetuta sostituisce la precedente.
 */
export async function reviewAbuseSignal(
  db: D1Database,
  input: {
    key: string;
    outcome: "clear" | "suspended";
    workspaceId?: string;
    actor: string;
    reason: string;
  },
  now = new Date(),
): Promise<AbuseReviewResult> {
  const signal = (await listAbuseSignals(db, now)).find((item) => item.key === input.key);
  if (!signal) return "not_found";
  const workspaceId = input.outcome === "suspended" ? input.workspaceId : undefined;
  const target = signal.workspaces.find((workspace) => workspace.id === workspaceId);
  if (input.outcome === "suspended" && !target) return "invalid";
  // Si sospende il beneficio Free: uno spazio con una copertura pagata o concessa resta attivo.
  if (target?.premium) return "covered";
  const at = now.toISOString();
  await db
    .prepare(`INSERT INTO abuse_reviews (signal, outcome, workspace_id, actor, reason, reviewed_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6)
      ON CONFLICT(signal) DO UPDATE SET outcome = excluded.outcome,
        workspace_id = excluded.workspace_id, actor = excluded.actor, reason = excluded.reason,
        reviewed_at = excluded.reviewed_at`)
    .bind(input.key, input.outcome, workspaceId ?? null, input.actor, input.reason, at)
    .run();
  // La sospensione è la pausa dell'assistenza sui negozi reali dello spazio, in una istruzione.
  if (workspaceId)
    await db
      .prepare(`INSERT OR IGNORE INTO ebay_store_pauses (store_id, reason, paused_at)
        SELECT id, 'admin', ?2 FROM ebay_stores WHERE workspace_id = ?1
          AND data_deleted_at IS NULL AND ebay_environment = 'production'`)
      .bind(workspaceId, at)
      .run();
  return "done";
}
