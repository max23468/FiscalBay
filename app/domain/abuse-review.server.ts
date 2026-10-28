import { sha256Hex } from "../sealed.server";
import { inSequence } from "../sequence";
import { applyWorkspacePlan } from "./free-store.server";
import { paidCoverageSql } from "./grants.server";
import { storeNameSql } from "./store-state.server";

/**
 * Revisione antiabuso (§15): più spazi che sembrano la stessa attività, per ottenere più
 * volte prova e beneficio Free. I segnali usano soltanto dati già presenti: ragione sociale del
 * profilo, nome del negozio eBay e cliente Stripe condivisi fra spazi diversi. L'admin registra
 * «nessun abuso» oppure sospende il beneficio Free di uno degli spazi. I segnali mostrano il
 * valore condiviso soltanto all'admin e la chiave della revisione ne conserva l'impronta, non il
 * valore.
 *
 * La sospensione vale per lo spazio finché resta l'esito: il riallineamento del piano mette la
 * pausa dell'assistenza su ogni suo negozio reale, anche collegato o scelto come attivo dopo, e
 * la toglie con l'esito «nessun abuso» o mentre una copertura pagata o concessa è in corso. La
 * pausa resta distinta da quella manuale della console, che non la toglie.
 */

export type AbuseSignalKind = "company" | "store_name" | "customer";

export type AbuseSignal = {
  key: string;
  kind: AbuseSignalKind;
  /** Valore condiviso; vuoto per una sospensione la cui segnalazione non è più corrente. */
  value: string;
  /** False per una sospensione rimasta dopo un cambio del gruppo: si toglie con «nessun abuso». */
  current: boolean;
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

/** Chiave stabile della segnalazione: tipo, impronta del valore e spazi coinvolti. */
async function signalKey(kind: AbuseSignalKind, value: string, workspaces: string[]) {
  return `${kind}:${(await sha256Hex(`${kind}\n${value}\n${[...workspaces].sort().join(",")}`)).slice(0, 48)}`;
}

/**
 * Segnalazioni correnti, prima quelle da rivedere, poi le sospensioni la cui segnalazione non è
 * più corrente, come dopo l'ingresso di un nuovo spazio nel gruppo: restano finché l'admin non
 * registra «nessun abuso».
 */
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
  const current = await Promise.all(
    shared.map(async ([id, group]) => ({
      key: await signalKey(group.kind, id, [...group.ids]),
      group,
      current: true,
    })),
  );
  const { results: stale } = await db
    .prepare(`SELECT signal, workspace_id FROM abuse_reviews WHERE outcome = 'suspended'
      AND signal NOT IN (SELECT value FROM json_each(?))`)
    .bind(JSON.stringify(current.map(({ key }) => key)))
    .all<{ signal: string; workspace_id: string }>();
  const signals = [
    ...current,
    ...stale.map((row) => ({
      key: row.signal,
      group: {
        kind: row.signal.split(":", 1)[0] as AbuseSignalKind,
        value: "",
        ids: new Set([row.workspace_id]),
      },
      current: false,
    })),
  ];
  if (signals.length === 0) return [];
  const [{ results: details }, { results: reviews }] = await db.batch<Record<string, unknown>>([
    db
      .prepare(`SELECT w.id,
          (SELECT u.email FROM workspace_members wm JOIN "user" u ON u.id = wm.user_id
            WHERE wm.workspace_id = w.id AND wm.role = 'owner' LIMIT 1) AS email,
          ${paidCoverageSql("w.id", "?1")} AS premium
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
    .map(({ key, group, current: live }): AbuseSignal => {
      const review = reviewed.get(key);
      return {
        key,
        kind: group.kind,
        value: group.value,
        current: live,
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
      (a, b) =>
        Number(!a.current) - Number(!b.current) ||
        Number(a.review !== null) - Number(b.review !== null) ||
        a.key.localeCompare(b.key),
    );
}

export type AbuseReviewResult = "done" | "not_found" | "invalid" | "covered";

/**
 * Esito della revisione di una segnalazione elencata. La sospensione riguarda lo spazio
 * indicato, che deve far parte della segnalazione; «nessun abuso» la toglie. Una revisione
 * ripetuta sostituisce la precedente. Gli spazi coinvolti si riallineano subito; il piano li
 * tiene allineati anche dopo, a ogni visita, collegamento e giro del cron.
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
  await inSequence(signal.workspaces, (workspace) => applyWorkspacePlan(db, workspace.id, now));
  return "done";
}
