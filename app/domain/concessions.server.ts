import { z } from "zod";

import { logFailure } from "../errors";
import {
  createStripeClient,
  stripeCall,
  stripeEnvironment,
  stripeSecretKey,
} from "../integrations/stripe.server";
import { reconcileSubscription } from "./billing.server";
import { applyWorkspacePlan } from "./free-store.server";
import { grantLifetime, type LifetimeGrant } from "./lifetime.server";
import { dayMilliseconds } from "../time";
import { lifetimeInForceSql } from "./grants.server";

/**
 * Concessioni della console amministrativa (§6.3): Premium temporaneo, estensione gratuita di
 * un abbonamento, lifetime in omaggio ed estensione dello storico. Ogni concessione registra
 * autore e motivo, non figura come incasso e non tocca quota, prova o ciclo.
 */

const concession = z.object({
  workspaceId: z.string().min(1).max(128),
  author: z.string().trim().min(1).max(128),
  reason: z.string().trim().min(1).max(500),
});

/** Giorni concessi in una volta: oltre l'anno serve una valutazione separata. */
const maxGrantDays = 366;

export type PremiumGrant =
  | { result: "done"; startsAt: string; endsAt: string }
  | { result: "invalid" | "not_found" | "lifetime" | "unavailable" };

/** Fine dell'ultima copertura in corso dello spazio, pagata, di prova o concessa. */
const coveredUntilSql = `(SELECT MAX(e.ends_at) FROM workspace_entitlements e
  WHERE e.workspace_id = ?1 AND e.revoked_at IS NULL AND julianday(e.ends_at) > julianday(?2))`;

/** Concessioni concorrenti dello stesso spazio: ciascuna rilegge la copertura e riparte. */
const grantAttempts = 3;

/**
 * Premium concesso per un numero di giorni. Parte dalla fine dell'ultima copertura in corso,
 * pagata, di prova o concessa, così non consuma il periodo già pagato; con un abbonamento che
 * si rinnova ne rinvia il rinnovo, o il primo addebito scelto durante la prova, alla fine della
 * concessione, senza conguaglio. Un rinnovo già disdetto non si riattiva: la concessione
 * prolunga soltanto il diritto. Stripe si aggiorna prima della copertura: ripetuta dopo un
 * errore, la concessione calcola gli stessi istanti. La copertura si registra soltanto se
 * l'ultima copertura è ancora quella letta: due concessioni contemporanee si sommano, perché la
 * seconda rilegge la fine della prima e riparte da lì, rinvio su Stripe compreso.
 */
export async function grantPremium(
  env: Env,
  input: { workspaceId: string; author: string; reason: string; days: number },
  now = new Date(),
): Promise<PremiumGrant> {
  const parsed = concession.safeParse(input);
  if (
    !parsed.success ||
    !Number.isInteger(input.days) ||
    input.days < 1 ||
    input.days > maxGrantDays
  )
    return { result: "invalid" };
  const at = now.toISOString();
  for (let attempt = 0; attempt < grantAttempts; attempt++) {
    const workspace = await env.DB.prepare(`SELECT ${lifetimeInForceSql("w.id")} AS lifetime,
        ${coveredUntilSql} AS covered_until,
        (SELECT s.id FROM stripe_subscriptions s WHERE s.workspace_id = w.id AND s.environment = ?3
          AND s.unavailable_at IS NULL AND s.status IN ('active', 'trialing')
          AND s.cancel_at_period_end = 0
          ORDER BY julianday(s.current_period_start) DESC LIMIT 1) AS subscription,
        (SELECT s.current_period_end FROM stripe_subscriptions s WHERE s.workspace_id = w.id
          AND s.environment = ?3 AND s.unavailable_at IS NULL AND s.status IN ('active', 'trialing')
          AND s.cancel_at_period_end = 0
          ORDER BY julianday(s.current_period_start) DESC LIMIT 1) AS renews_at
      FROM workspaces w WHERE w.id = ?1`)
      .bind(parsed.data.workspaceId, at, stripeEnvironment(env))
      .first<{
        lifetime: number;
        covered_until: string | null;
        subscription: string | null;
        renews_at: string | null;
      }>();
    if (!workspace) return { result: "not_found" };
    if (workspace.lifetime) return { result: "lifetime" };
    const start = Math.max(
      now.getTime(),
      workspace.covered_until ? Date.parse(workspace.covered_until) : 0,
    );
    const end = start + input.days * dayMilliseconds;
    const startsAt = new Date(start).toISOString();
    const endsAt = new Date(end).toISOString();
    const postpone =
      workspace.subscription && workspace.renews_at && Date.parse(workspace.renews_at) < end
        ? workspace.subscription
        : null;
    let stripe = null;
    if (postpone) {
      const key = stripeSecretKey(env);
      if (!key) return { result: "unavailable" };
      try {
        stripe = await createStripeClient(key);
        await stripeCall(() =>
          stripe!.subscriptions.update(postpone, {
            trial_end: Math.floor(end / 1000),
            proration_behavior: "none",
          }),
        );
      } catch (error) {
        logFailure({ error, operation: "billing" });
        return { result: "unavailable" };
      }
    }
    const granted = await env.DB.prepare(`INSERT INTO workspace_entitlements (id, workspace_id,
        source, starts_at, ends_at, granted_by, grant_reason)
      SELECT ?3, ?1, 'admin', ?4, ?5, ?6, ?7
      WHERE NOT ${lifetimeInForceSql("?1")} AND ${coveredUntilSql} IS ?8`)
      .bind(
        parsed.data.workspaceId,
        at,
        crypto.randomUUID(),
        startsAt,
        endsAt,
        parsed.data.author,
        parsed.data.reason,
        workspace.covered_until,
      )
      .run();
    // Un'altra concessione o un lifetime sono arrivati dopo la lettura: si ricalcola.
    if (!granted.meta.changes) continue;
    if (stripe && postpone)
      // Il webhook e il cron rileggono comunque l'abbonamento: un errore qui non annulla nulla.
      await reconcileSubscription(env, stripe, postpone, now).catch((error: unknown) =>
        logFailure({ error, operation: "billing" }),
      );
    return { result: "done", startsAt, endsAt };
  }
  return { result: "unavailable" };
}

/**
 * Lifetime in omaggio: occupa uno dei venti posti e chiude l'abbonamento dello spazio. Con un
 * posto indicato lo spazio riprende quello lasciato dalla cancellazione dell'account.
 */
export async function grantLifetimeConcession(
  env: Env,
  input: { workspaceId: string; author: string; reason: string; slot?: number },
  now = new Date(),
): Promise<LifetimeGrant | "invalid"> {
  const parsed = concession.safeParse(input);
  if (
    !parsed.success ||
    (input.slot !== undefined && (!Number.isInteger(input.slot) || input.slot < 1))
  )
    return "invalid";
  const key = stripeSecretKey(env);
  const stripe = key ? await createStripeClient(key) : null;
  return grantLifetime(env, stripe, { ...parsed.data, slot: input.slot }, now);
}

export type HistoryExtensionResult = "done" | "invalid" | "not_found";

/**
 * Storico oltre l'anno (§11), concesso dopo la verifica del periodo recuperabile, il
 * consenso e l'eventuale costo una tantum concordati con l'assistenza. Vale con una copertura
 * in corso e al massimo per i due anni che eBay restituisce; i termini degli ordini dello spazio
 * si riallineano subito.
 */
export async function grantHistoryExtension(
  db: D1Database,
  input: { workspaceId: string; months: number; author: string; reason: string },
  now = new Date(),
): Promise<HistoryExtensionResult> {
  const parsed = concession.safeParse(input);
  if (!parsed.success || !Number.isInteger(input.months) || input.months < 13 || input.months > 24)
    return "invalid";
  const at = now.toISOString();
  const granted = await db
    .prepare(`INSERT INTO history_extensions (id, workspace_id, months, reason, actor, granted_at)
      SELECT ?1, id, ?2, ?3, ?4, ?5 FROM workspaces WHERE id = ?6`)
    .bind(
      crypto.randomUUID(),
      input.months,
      parsed.data.reason,
      parsed.data.author,
      at,
      parsed.data.workspaceId,
    )
    .run();
  if (!granted.meta.changes) return "not_found";
  await applyWorkspacePlan(db, parsed.data.workspaceId, now);
  return "done";
}

/** Revoca un'estensione dello storico: la finestra torna all'estensione più lunga rimasta. */
export async function revokeHistoryExtension(
  db: D1Database,
  input: { workspaceId: string; extensionId: string },
  now = new Date(),
): Promise<"done" | "not_found"> {
  const revoked = await db
    .prepare(`UPDATE history_extensions SET revoked_at = ?1
      WHERE id = ?2 AND workspace_id = ?3 AND revoked_at IS NULL`)
    .bind(now.toISOString(), input.extensionId, input.workspaceId)
    .run();
  if (!revoked.meta.changes) return "not_found";
  await applyWorkspacePlan(db, input.workspaceId, now);
  return "done";
}
