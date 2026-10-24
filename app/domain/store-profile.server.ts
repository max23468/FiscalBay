import { limitKey, rateLimitWait, recordRateLimit } from "./order-acquisition-context.server";
import type { Context } from "./order-acquisition-context.server";
import { dayMilliseconds } from "../time";
import { UpstreamError } from "../integrations/http.server";
import { readSellerStanding, readStoreProfile } from "../integrations/ebay/trading.server";

/** Profilo e feedback cambiano di rado: una lettura a settimana li tiene aggiornati. */
export const storeProfileRefreshMilliseconds = 7 * dayMilliseconds;

/**
 * Chiamata Trading del profilo: null se la sua quota è sospesa o la lettura non riesce. Il
 * limite della quota sospende soltanto quella chiamata.
 */
async function profileCall<T>(ctx: Context, call: string, read: () => Promise<T>) {
  const now = new Date(ctx.at);
  const key = limitKey(ctx.access.configuration.apiOrigin, call);
  if ((await rateLimitWait(ctx.db, key, now)) > 0) return null;
  try {
    return await read();
  } catch (error) {
    if (error instanceof UpstreamError && error.details.limit !== undefined)
      await recordRateLimit(ctx.db, key, error, now);
    return null;
  }
}

/**
 * Rilegge il profilo pubblico del negozio eBay (nome, logo e indirizzo con `GetStore`, feedback
 * e stato Top Rated con `GetUser`) quando l'ultima lettura è più vecchia di una settimana, anche
 * per i negozi collegati prima di questa lettura. È un dato accessorio: una chiamata non riuscita
 * lascia i suoi valori precedenti e la settimana successiva li rilegge. Due chiamate a settimana
 * non scalano il budget delle passate sugli ordini, così non ne spostano l'ordine.
 */
export async function refreshStoreProfile(ctx: Context): Promise<void> {
  const stale = await ctx.db
    .prepare(
      `SELECT 1 AS stale FROM ebay_stores
        WHERE id = ? AND (store_profile_read_at IS NULL OR store_profile_read_at <= ?)`,
    )
    .bind(ctx.storeId, new Date(Date.parse(ctx.at) - storeProfileRefreshMilliseconds).toISOString())
    .first();
  if (!stale) return;
  const profile = await profileCall(ctx, "GetStore", () => readStoreProfile(ctx.access));
  const standing = await profileCall(ctx, "GetUser", () => readSellerStanding(ctx.access));
  if (!profile && !standing) return;
  const statements = [
    ctx.db
      .prepare(
        "UPDATE ebay_stores SET store_profile_read_at = ? WHERE id = ? AND disconnected_at IS NULL",
      )
      .bind(ctx.at, ctx.storeId),
  ];
  if (profile)
    statements.push(
      ctx.db
        .prepare(
          `UPDATE ebay_stores SET store_name = ?, store_logo_url = ?, store_url = ?
            WHERE id = ? AND disconnected_at IS NULL`,
        )
        .bind(profile.name, profile.logoUrl, profile.url, ctx.storeId),
    );
  if (standing)
    statements.push(
      ctx.db
        .prepare(
          `UPDATE ebay_stores SET feedback_score = ?, feedback_positive_percent = ?,
             top_rated_seller = ? WHERE id = ? AND disconnected_at IS NULL`,
        )
        .bind(
          standing.feedbackScore,
          standing.positivePercent,
          standing.topRated ? 1 : 0,
          ctx.storeId,
        ),
    );
  await ctx.db.batch(statements);
}
