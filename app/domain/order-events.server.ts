import { storeAccess, type ActiveStore } from "./order-acquisition.server";
import { switchOnSql } from "./service-settings.server";
import { logFailure } from "../errors";
import type { EbayAccess } from "../integrations/ebay/environment.server";
import {
  orderEventsDestination,
  subscribeOrderEvents,
  unsubscribeOrderEvents,
} from "../integrations/ebay/order-events.server";

// Un tentativo non concluso, o una sottoscrizione rimasta all'altro ambiente, si riprova dopo un
// giorno: la lettura periodica resta la fonte degli ordini nel frattempo.
const retryMilliseconds = 24 * 60 * 60_000;

/**
 * Dopo una lettura riuscita, sottoscrive il negozio a `ORDER_CONFIRMATION` una volta per
 * consenso (D235). Il tentativo si prenota in D1 prima delle chiamate, così letture concorrenti
 * non lo ripetono; esito ed errori non fermano la lettura. Un consenso senza lo scope delle
 * notifiche resta senza eventi fino al ricollegamento.
 */
export async function ensureOrderEvents(
  env: Env,
  store: ActiveStore,
  access: EbayAccess,
  now: Date,
): Promise<void> {
  const claimed = await env.DB.prepare(
    `UPDATE ebay_store_credentials SET order_events_checked_at = ?3
      WHERE store_id = ?1 AND granted_at = ?2 AND rejected_at IS NULL
        AND (order_events IS NULL OR order_events = 'elsewhere')
        AND (order_events_checked_at IS NULL OR order_events_checked_at <= ?4)`,
  )
    .bind(
      store.store_id,
      store.granted_at,
      now.toISOString(),
      new Date(now.getTime() - retryMilliseconds).toISOString(),
    )
    .run();
  if (claimed.meta.changes !== 1) return;
  try {
    const destination = await orderEventsDestination(
      env,
      store.ebay_environment,
      access.configuration,
      access.fetcher,
    );
    // Senza destinazione registrata sull'ingresso dell'ambiente si riprova il giorno dopo.
    if (!destination) return;
    const outcome = await subscribeOrderEvents(env, access, destination);
    await env.DB.prepare(
      `UPDATE ebay_store_credentials SET order_events = ?3
        WHERE store_id = ?1 AND granted_at = ?2`,
    )
      .bind(store.store_id, store.granted_at, outcome)
      .run();
  } catch (error) {
    logFailure({ error, operation: "order_events" });
  }
}

/**
 * Prima dello scollegamento o dell'eliminazione del negozio, finché il token esiste, toglie la
 * sottoscrizione che punta all'ingresso dell'ambiente: eBay smette di inviare gli ordini del
 * venditore, anche per un negozio in pausa. Con le chiamate eBay spente dalla console, un token
 * scaduto o un errore lo scollegamento prosegue: le consegne rimaste non hanno effetti.
 */
export async function releaseOrderEvents(
  env: Env,
  userId: string,
  storeId: string,
  fetcher: typeof fetch,
  now = new Date(),
): Promise<void> {
  const store = await env.DB.prepare(
    `SELECT c.store_id, c.access_token, c.granted_at, s.ebay_environment
       FROM ebay_store_credentials c
       JOIN ebay_stores s ON s.id = c.store_id
       JOIN workspace_members wm ON wm.workspace_id = s.workspace_id
      WHERE c.store_id = ?1 AND wm.user_id = ?2 AND c.order_events = 'subscribed'
        AND c.access_expires_at > ?3 AND c.rejected_at IS NULL AND s.disconnected_at IS NULL
        AND ${switchOnSql("ebay_calls")}`,
  )
    .bind(storeId, userId, now.toISOString())
    .first<ActiveStore>();
  if (!store) return;
  try {
    const access = await storeAccess(env, store, fetcher, now);
    const destination = await orderEventsDestination(
      env,
      store.ebay_environment,
      access.configuration,
      fetcher,
    );
    if (destination) await unsubscribeOrderEvents(access, destination);
  } catch (error) {
    logFailure({ error, operation: "order_events" });
  }
}
