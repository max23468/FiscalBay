import { limitKey, rateLimitWait, recordRateLimit } from "./order-acquisition-context.server";
import type { Context } from "./order-acquisition-context.server";
import { dayMilliseconds } from "../time";
import { UpstreamError } from "../integrations/http.server";
import { readStoreProfile } from "../integrations/ebay/trading.server";

/** Nome e logo cambiano di rado: una lettura a settimana li tiene aggiornati. */
export const storeProfileRefreshMilliseconds = 7 * dayMilliseconds;

/**
 * Rilegge nome e logo del negozio eBay quando l'ultima lettura è più vecchia di una settimana,
 * anche per i negozi collegati prima di questa lettura. È un dato accessorio: un errore lascia
 * il profilo precedente e si riprova alla sincronizzazione successiva, il limite della quota
 * `GetStore` sospende soltanto questa chiamata. Una chiamata a settimana non scala il budget
 * delle passate sugli ordini, così non ne sposta l'ordine.
 */
export async function refreshStoreProfile(ctx: Context): Promise<void> {
  const now = new Date(ctx.at);
  const stale = await ctx.db
    .prepare(
      `SELECT 1 AS stale FROM ebay_stores
        WHERE id = ? AND (store_profile_read_at IS NULL OR store_profile_read_at <= ?)`,
    )
    .bind(ctx.storeId, new Date(now.getTime() - storeProfileRefreshMilliseconds).toISOString())
    .first();
  const key = limitKey(ctx.access.configuration.apiOrigin, "GetStore");
  if (!stale || (await rateLimitWait(ctx.db, key, now)) > 0) return;
  try {
    const profile = await readStoreProfile(ctx.access);
    await ctx.db
      .prepare(
        `UPDATE ebay_stores SET store_name = ?, store_logo_url = ?, store_profile_read_at = ?
          WHERE id = ? AND disconnected_at IS NULL`,
      )
      .bind(profile.name, profile.logoUrl, ctx.at, ctx.storeId)
      .run();
  } catch (error) {
    if (error instanceof UpstreamError && error.details.limit !== undefined)
      await recordRateLimit(ctx.db, key, error, now);
  }
}
