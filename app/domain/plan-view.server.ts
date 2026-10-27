import { lapsedStatuses, pricePromiseMs } from "./billing.server";
import { openSubscriptionStatuses } from "./grants.server";
import { sqlList } from "./sql.server";
import { stripeEnvironment } from "../integrations/stripe.server";
import type { AccountView } from "../view-models";

/**
 * Stato del pagamento mostrato nel piano. Il lifetime prevale su tutto, senza rinnovi. Con una
 * copertura pagata, o concessa a un abbonamento che si rinnova: periodicità, rinnovo o fine
 * dopo la disdetta. Una concessione senza abbonamento indica la sua fine. Senza copertura, o con
 * la sola prova: pagamento in attesa di conferma, rinnovo non riuscito, con il prezzo protetto
 * fino a sette giorni dall'inizio del periodo non pagato, oppure pagamento rimborsato.
 */
export async function subscriptionView(
  db: D1Database,
  env: Env,
  workspaceId: string,
  coverage: { source: string; endsAt: string | null } | null,
  now = new Date(),
): Promise<Pick<AccountView, "premium" | "payment" | "grant">> {
  if (coverage?.source === "lifetime") {
    // Concesso senza pagamento: un omaggio, anche sul posto di un lifetime rimborsato (D209).
    const lifetime = await db
      .prepare(`SELECT stripe_checkout_session_id IS NULL AS granted FROM workspace_entitlements
        WHERE workspace_id = ? AND source = 'lifetime' AND revoked_at IS NULL`)
      .bind(workspaceId)
      .first<{ granted: number }>();
    return {
      premium: {
        period: "lifetime",
        renewsAt: null,
        ...(lifetime?.granted ? { granted: true as const } : {}),
      },
    };
  }
  const grant =
    coverage?.source === "admin" && coverage.endsAt ? { grant: { endsAt: coverage.endsAt } } : {};
  // Lifetime completato su Stripe con il pagamento ancora da confermare: senza copertura è
  // l'attivazione in corso, con un abbonamento il passaggio a vita in conferma.
  const pending = (await db
    .prepare(`SELECT 1 FROM lifetime_allocations WHERE workspace_id = ? AND status = 'reserved'
      AND completed_at IS NOT NULL`)
    .bind(workspaceId)
    .first())
    ? { payment: { state: "pending" as const, lifetime: true as const } }
    : {};
  if (pending.payment && (!coverage || coverage.source === "trial")) return pending;
  const row = await db
    .prepare(`SELECT offer, renewal_offer, status, current_period_start, current_period_end,
        cancel_at_period_end
      FROM stripe_subscriptions WHERE workspace_id = ? AND environment = ?
        AND unavailable_at IS NULL AND status IN (${sqlList(openSubscriptionStatuses)})
      ORDER BY julianday(current_period_start) DESC LIMIT 1`)
    .bind(workspaceId, stripeEnvironment(env))
    .first<{
      offer: "monthly" | "annual";
      renewal_offer: "monthly" | "annual" | null;
      status: string;
      current_period_start: string;
      current_period_end: string;
      cancel_at_period_end: number;
    }>();
  // Senza copertura, un pagamento rimborsato o con la disputa persa spiega il ritorno al Free:
  // il lifetime, che non torna in vendita perché il posto resta occupato, oppure il periodo in
  // corso, con il rinnovo se l'abbonamento continua. Un nuovo abbonamento da confermare o da
  // regolarizzare prevale.
  const refunded = coverage
    ? null
    : await db
        .prepare(`SELECT source FROM workspace_entitlements WHERE workspace_id = ?1
          AND revocation IS NOT NULL AND (source = 'lifetime'
            OR julianday(starts_at) <= julianday(?2) AND julianday(?2) < julianday(ends_at))
          ORDER BY source = 'lifetime' LIMIT 1`)
        .bind(workspaceId, now.toISOString())
        .first<{ source: string }>();
  const renewing = !!row && ["active", "trialing"].includes(row.status);
  if (refunded && (!row || (renewing && refunded.source !== "lifetime")))
    return {
      payment: {
        state: "refunded",
        ...(refunded.source === "lifetime"
          ? { lifetime: true as const }
          : row && !row.cancel_at_period_end
            ? { renewsAt: row.current_period_end }
            : {}),
      },
    };
  if (!row) return { ...grant, ...pending };
  // Una concessione a un abbonamento che si rinnova ne ha rinviato il rinnovo alla sua fine.
  if (
    coverage?.source === "premium" ||
    (coverage?.source === "admin" && ["active", "trialing"].includes(row.status))
  ) {
    if (!row.cancel_at_period_end)
      return {
        ...pending,
        premium: {
          period: row.offer,
          renewsAt: row.current_period_end,
          // Cambio di periodicità programmato: vale dal rinnovo.
          ...(row.renewal_offer && row.renewal_offer !== row.offer
            ? { nextPeriod: row.renewal_offer }
            : {}),
        },
      };
    // Dopo la disdetta Premium dura fino all'ultima copertura, concessioni comprese.
    const last = await db
      .prepare(`SELECT MAX(ends_at) AS ends_at FROM workspace_entitlements WHERE workspace_id = ?1
        AND revoked_at IS NULL AND julianday(ends_at) > julianday(?2)`)
      .bind(workspaceId, now.toISOString())
      .first<{ ends_at: string | null }>();
    return {
      ...pending,
      // L'aggregato restituisce sempre una riga, anche senza coperture future.
      premium: { period: row.offer, renewsAt: null, endsAt: last!.ends_at ?? coverage.endsAt },
    };
  }
  // Durante la prova un acquisto ancora da confermare resta visibile; un'altra copertura,
  // come una concessione, prevale.
  if (coverage && coverage.source !== "trial") return { ...grant, ...pending };
  // Scelto durante la prova: nessun incasso finché la prova non finisce; disdetto, nessuno.
  if (coverage?.source === "trial" && row.status === "trialing")
    return {
      payment: {
        state: "scheduled",
        period: row.offer,
        chargeAt: row.current_period_end,
        ...(row.cancel_at_period_end ? { cancelled: true as const } : {}),
      },
    };
  if ((lapsedStatuses as readonly string[]).includes(row.status)) {
    const protectedUntil = Date.parse(row.current_period_start) + pricePromiseMs;
    return protectedUntil > now.getTime()
      ? {
          payment: {
            state: "renewal-failed",
            protectedUntil: new Date(protectedUntil).toISOString(),
          },
        }
      : {};
  }
  return row.status === "paused" ? {} : { payment: { state: "pending" } };
}
