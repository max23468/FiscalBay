import { logFailure } from "../errors";
import type { Language } from "../i18n";
import { displayTimeZone, formatDate } from "../format";
import { purchasesOpenSql, waitingSql, waitlistOnSql } from "./admission-state.server";
import { activeEntitlementSql } from "./grants.server";
import { unpausedStore } from "./store-state.server";

/**
 * Ammissione al servizio e inattività del Free (§5, Q569).
 *
 * Due interruttori in `admission_settings`, decisi dall'owner sulla capacità disponibile: la
 * lista d'attesa per i nuovi Free e gli acquisti aperti. La lista d'attesa vale per chi
 * completa la registrazione mentre è attiva e non tocca gli account esistenti. Chi è in attesa
 * può collegare un negozio e ottenere la prima lettura soltanto se gli acquisti sono aperti, per
 * scegliere Premium o la prova; nessuna lettura periodica o a richiesta e nessuno sblocco del
 * Free finché non viene ammesso. Spegnere la lista d'attesa ammette tutti.
 *
 * Inattività: l'attività umana verificata è una pagina dell'area aperta con una sessione; la
 * sincronizzazione automatica non conta. Dopo 30 giorni senza attività lo spazio Free riceve un
 * preavviso via email e dopo altri 7 le letture dei suoi negozi entrano in pausa `inactivity`.
 * Una copertura in corso, pagata, lifetime, concessa o di prova, non va mai in pausa per sola
 * inattività. La ripresa è self-service da Negozi e non tocca quota, ciclo, prova o promozione.
 */

/**
 * Letture periodiche, a richiesta e per evento ammesse: una copertura in corso, oppure uno
 * spazio fuori dalla lista d'attesa. La prima lettura al collegamento segue `linkReadAdmitted`.
 */
export function servedSql(workspace: string, at: string) {
  return `(${activeEntitlementSql(workspace, at)} OR NOT ${waitingSql(workspace)})`;
}

/**
 * Lettura al collegamento: sempre per uno spazio servito; in lista d'attesa soltanto la prima,
 * cioè finché il negozio non ha una lettura riuscita in questo spazio. Uno storico eliminato
 * conta come già letto: scollegare, eliminare i dati e ricollegare non ripete la prima lettura.
 */
export async function linkReadAdmitted(db: D1Database, storeId: string, now: Date) {
  const row = await db
    .prepare(`SELECT ${servedSql("s.workspace_id", "?2")} OR (s.orders_deleted_through IS NULL
        AND NOT EXISTS (SELECT 1 FROM sync_state ss WHERE ss.store_id = s.id
          AND ss.last_success_at IS NOT NULL)) AS admitted
      FROM ebay_stores s WHERE s.id = ?1`)
    .bind(storeId, now.toISOString())
    .first<{ admitted: number }>();
  return row?.admitted === 1;
}

type Admission = {
  /** L'utente è in lista d'attesa per il Free. */
  waiting: boolean;
  /** Acquisti e prove aperti. */
  purchasesOpen: boolean;
};

export async function admission(db: D1Database, userId: string): Promise<Admission> {
  const row = await db
    .prepare(`SELECT EXISTS (SELECT 1 FROM user_profiles WHERE user_id = ?1
        AND waitlisted_at IS NOT NULL) AS waiting, ${purchasesOpenSql} AS purchases_open`)
    .bind(userId)
    .first<{ waiting: number; purchases_open: number }>();
  return { waiting: row?.waiting === 1, purchasesOpen: row?.purchases_open !== 0 };
}

/**
 * Collegamento di un negozio ammesso: account fuori dalla lista d'attesa, acquisti aperti per
 * il percorso verso Premium, oppure una copertura già in corso.
 */
export async function storeLinkAdmitted(db: D1Database, userId: string, now = new Date()) {
  const row = await db
    .prepare(`SELECT NOT EXISTS (SELECT 1 FROM user_profiles WHERE user_id = ?1
        AND waitlisted_at IS NOT NULL) OR ${purchasesOpenSql}
      OR EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.user_id = ?1
        AND ${activeEntitlementSql("wm.workspace_id", "?2")}) AS admitted`)
    .bind(userId, now.toISOString())
    .first<{ admitted: number }>();
  return row?.admitted === 1;
}

/** Intervallo minimo fra due registrazioni dell'attività: basta una scrittura l'ora. */
const activityStep = 60 * 60_000;

/**
 * Registra l'attività umana dell'utente a ogni pagina dell'area e, con la lista d'attesa
 * spenta, lo ammette se era in attesa. Nessun effetto senza spazio o senza cambiamenti.
 */
export async function recordActivity(db: D1Database, userId: string, now = new Date()) {
  const at = now.toISOString();
  await db.batch([
    db
      .prepare(`UPDATE workspaces SET active_at = ?1
        WHERE id IN (SELECT workspace_id FROM workspace_members WHERE user_id = ?2)
          AND (active_at IS NULL OR active_at <= ?3)`)
      .bind(at, userId, new Date(now.getTime() - activityStep).toISOString()),
    db
      .prepare(`UPDATE user_profiles SET waitlisted_at = NULL
        WHERE user_id = ?1 AND waitlisted_at IS NOT NULL AND NOT ${waitlistOnSql}`)
      .bind(userId),
  ]);
}

/**
 * Ripresa dopo la pausa per inattività, confermata dall'utente: toglie la pausa a tutti i
 * negozi dello spazio, registra l'attività e chiede subito una lettura, che recupera quanto è
 * ancora disponibile nella finestra del piano. Quota, ciclo, prova e promozione restano come
 * erano.
 */
export async function resumeAfterInactivity(db: D1Database, userId: string, now = new Date()) {
  const at = now.toISOString();
  const stores = `SELECT s.id FROM ebay_stores s JOIN workspace_members wm
      ON wm.workspace_id = s.workspace_id WHERE wm.user_id = ?2`;
  await db.batch([
    db
      .prepare(`UPDATE workspaces SET active_at = ?1
        WHERE id IN (SELECT workspace_id FROM workspace_members WHERE user_id = ?2)`)
      .bind(at, userId),
    db
      .prepare(`UPDATE sync_state SET requested_at = COALESCE(requested_at, ?1), updated_at = ?1
        WHERE store_id IN (SELECT store_id FROM ebay_store_pauses WHERE reason = 'inactivity'
          AND store_id IN (${stores}))`)
      .bind(at, userId),
    db
      .prepare(
        `DELETE FROM ebay_store_pauses WHERE reason = 'inactivity' AND store_id IN (${stores})`,
      )
      .bind(at, userId),
  ]);
}

/** Giorni senza attività umana prima del preavviso, poi giorni di preavviso prima della pausa. */
const inactivityDays = 30;
const inactivityNoticeDays = 7;

/** Preavvisi inviati per esecuzione: gli altri restano all'esecuzione seguente. */
const noticeBatch = 50;

/** Spazio Free, ammesso, con almeno un negozio che oggi legge eBay. */
const readingFreeSql = (workspace: string) => `NOT ${activeEntitlementSql(workspace, "?1")}
  AND NOT ${waitingSql(workspace)}
  AND EXISTS (SELECT 1 FROM ebay_stores s WHERE s.workspace_id = ${workspace}
    AND s.disconnected_at IS NULL AND s.data_deleted_at IS NULL AND ${unpausedStore("s.id")})`;

type NoticeRow = {
  id: string;
  active_at: string;
  email: string;
  language: Language | null;
  time_zone: string | null;
};

/**
 * Invia i preavvisi e registra soltanto quelli riusciti; gli altri li riprova l'esecuzione
 * seguente. Il modulo email porta con sé i testi dell'interfaccia: si carica soltanto qui,
 * fuori dall'avvio di cron, coda e webhook.
 */
async function sendNotices(env: Env, rows: NoticeRow[], now: Date) {
  const { sendInactivityNotice } = await import("../account-email.server");
  const at = now.toISOString();
  const deadline = new Date(now.getTime() + inactivityNoticeDays * 24 * 60 * 60_000).toISOString();
  const sent = await Promise.allSettled(
    rows.map((row) => {
      const language = row.language === "en" ? "en" : "it";
      return sendInactivityNotice(env, {
        to: row.email,
        language,
        deadline: formatDate(deadline, language, "date", row.time_zone ?? displayTimeZone),
      });
    }),
  );
  const noticed = rows.filter((_, index) => {
    const outcome = sent[index]!;
    if (outcome.status === "rejected")
      logFailure({ error: outcome.reason, operation: "inactivity" });
    return outcome.status === "fulfilled";
  });
  const failed = rows.filter((_, index) => sent[index]!.status === "rejected");
  // Un accesso arrivato nel frattempo ha già spostato l'attività: il preavviso non vale. Un
  // invio non riuscito passa dopo gli spazi ancora da tentare.
  await env.DB.batch([
    ...noticed.map((row) =>
      env.DB.prepare(`UPDATE workspaces SET inactivity_notice_at = ?1, inactivity_attempt_at = NULL
          WHERE id = ?2 AND active_at = ?3`).bind(at, row.id, row.active_at),
    ),
    ...(failed.length
      ? [
          env.DB.prepare(
            "UPDATE workspaces SET inactivity_attempt_at = ?1 WHERE id IN (SELECT value FROM json_each(?2))",
          ).bind(at, JSON.stringify(failed.map((row) => row.id))),
        ]
      : []),
  ]);
}

/**
 * Compito orario dell'inattività. Nell'ordine: uno spazio senza attività registrata la riceve
 * adesso; gli spazi Free ammessi senza attività da 30 giorni e senza un preavviso per questo
 * periodo ricevono l'email e il preavviso si registra soltanto se l'invio riesce, a lotti in cui
 * gli invii non riusciti passano dopo quelli ancora da tentare; dopo 7 giorni dal preavviso
 * senza nuova attività le letture dei negozi entrano in pausa. Con la lista
 * d'attesa spenta chi era in attesa viene ammesso.
 */
export async function applyInactivity(env: Env, now = new Date()) {
  const db = env.DB;
  const at = now.toISOString();
  await db.batch([
    db.prepare("UPDATE workspaces SET active_at = ?1 WHERE active_at IS NULL").bind(at),
    db.prepare(
      `UPDATE user_profiles SET waitlisted_at = NULL WHERE waitlisted_at IS NOT NULL AND NOT ${waitlistOnSql}`,
    ),
  ]);
  const { results } = await db
    .prepare(`SELECT w.id, w.active_at, u."email" AS email,
        (SELECT t.language FROM terms_acceptances t WHERE t.user_id = u."id"
          ORDER BY t.accepted_at DESC LIMIT 1) AS language,
        (SELECT p.time_zone FROM user_preferences p WHERE p.user_id = u."id") AS time_zone
      FROM workspaces w
      JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.role = 'owner'
      JOIN "user" u ON u."id" = wm.user_id
      WHERE julianday(w.active_at) <= julianday(?1, '-${inactivityDays} days')
        AND (w.inactivity_notice_at IS NULL
          OR julianday(w.inactivity_notice_at) <= julianday(w.active_at))
        AND ${readingFreeSql("w.id")}
      ORDER BY w.inactivity_attempt_at IS NOT NULL, julianday(w.inactivity_attempt_at),
        w.active_at, w.id LIMIT ?2`)
    .bind(at, noticeBatch)
    .all<NoticeRow>();
  if (results.length > 0) await sendNotices(env, results, now);
  await db
    .prepare(`INSERT OR IGNORE INTO ebay_store_pauses (store_id, reason, paused_at)
      SELECT s.id, 'inactivity', ?1 FROM ebay_stores s JOIN workspaces w ON w.id = s.workspace_id
      WHERE julianday(w.inactivity_notice_at) > julianday(w.active_at)
        AND julianday(w.inactivity_notice_at) <= julianday(?1, '-${inactivityNoticeDays} days')
        AND NOT ${activeEntitlementSql("w.id", "?1")}
        AND s.disconnected_at IS NULL AND s.data_deleted_at IS NULL`)
    .bind(at)
    .run();
}
