import { logFailure } from "../errors";
import type { Language } from "../i18n";
import { servedSql } from "./admission.server";
import { storeLabelSql, unpausedStore } from "./store-state.server";

/** Email inviate per esecuzione: le altre restano all'esecuzione seguente. */
const noticeBatch = 50;

/** Interruzioni più vecchie non ricevono più l'email, come i promemoria della campanella. */
const noticeWindowDays = 30;

type NoticeRow = {
  store_id: string;
  event_at: string;
  name: string;
  email: string;
  language: Language | null;
};

/**
 * Email operativa del negozio da ricollegare (§14), a tutti i piani: una sola per interruzione
 * del consenso e per negozio. L'interruzione è il rifiuto o la revoca di eBay oppure la scadenza
 * nota, lo stesso istante del promemoria della campanella; l'email va al titolare dello spazio
 * nella lingua scelta, altrimenti in quella dei Termini. Restano fuori i negozi scollegati, in
 * pausa o di uno spazio in attesa, che comunque non leggono, gli account in cancellazione e le
 * interruzioni oltre i trenta giorni. L'invio riuscito, o verso un indirizzo soppresso, si
 * registra sul consenso; gli altri li riprova l'esecuzione seguente.
 */
export async function sendReconnectNotices(env: Env, now = new Date()): Promise<void> {
  const at = now.toISOString();
  const { results } = await env.DB.prepare(
    `SELECT n.store_id, n.event_at, ${storeLabelSql("s")} AS name, u."email" AS email,
        COALESCE(
          (SELECT p.language FROM user_preferences p WHERE p.user_id = u."id"),
          (SELECT t.language FROM terms_acceptances t WHERE t.user_id = u."id"
            ORDER BY t.accepted_at DESC LIMIT 1)) AS language
       FROM (SELECT store_id, reconnect_notice_at, COALESCE(rejected_at,
               CASE WHEN refresh_expires_at <= ?1 THEN refresh_expires_at END) AS event_at
               FROM ebay_store_credentials) n
       JOIN ebay_stores s ON s.id = n.store_id
       JOIN workspace_members wm ON wm.workspace_id = s.workspace_id AND wm.role = 'owner'
       JOIN "user" u ON u."id" = wm.user_id
      WHERE n.event_at IS NOT NULL
        AND julianday(n.event_at) > julianday(?1, '-${noticeWindowDays} days')
        AND n.reconnect_notice_at IS NOT n.event_at
        AND s.disconnected_at IS NULL AND s.data_deleted_at IS NULL
        AND ${unpausedStore("s.id")} AND ${servedSql("s.workspace_id", "?1")}
        AND NOT EXISTS (SELECT 1 FROM account_deletions d WHERE d.user_id = u."id")
      ORDER BY n.event_at, n.store_id LIMIT ?2`,
  )
    .bind(at, noticeBatch)
    .all<NoticeRow>();
  if (results.length === 0) return;
  // Il modulo email porta con sé i testi dell'interfaccia: si carica soltanto qui.
  const { EmailError, sendReconnectNotice } = await import("../account-email.server");
  const sent = await Promise.allSettled(
    results.map((row) =>
      sendReconnectNotice(env, {
        to: row.email,
        language: row.language === "en" ? "en" : "it",
        storeName: row.name,
      }),
    ),
  );
  // Un indirizzo nella lista di soppressione non la riceverà nemmeno dopo: vale come inviata.
  const noticed = results.filter((_, index) => {
    const outcome = sent[index]!;
    if (outcome.status === "fulfilled") return true;
    logFailure({ error: outcome.reason, operation: "account_email" });
    return outcome.reason instanceof EmailError && outcome.reason.undeliverable;
  });
  if (noticed.length === 0) return;
  await env.DB.batch(
    noticed.map((row) =>
      env.DB.prepare(
        "UPDATE ebay_store_credentials SET reconnect_notice_at = ? WHERE store_id = ?",
      ).bind(row.event_at, row.store_id),
    ),
  );
}
