import { activeEntitlementSql } from "./grants.server";
import { planPausedStore, storeNameSql } from "./store-state.server";
import {
  chatLabel,
  deepLink,
  linkToken,
  sendText,
  tokenHash,
  type TelegramStart,
} from "../integrations/telegram.server";
import { UpstreamError } from "../integrations/http.server";
import { isProduction } from "../app-links";
import { languages, localizedPath, type Language } from "../i18n";
import { telegramDigestTimes, telegramLinkMinutes } from "../preferences";
import type { TelegramView } from "../view-models";
import { dayMilliseconds } from "../time";

// Le richieste consumate restano un giorno oltre la scadenza: un nuovo tentativo della stessa
// ricevuta riconosce ancora il proprio collegamento.
const consumedRetention = dayMilliseconds;

type TelegramFilter = TelegramView["filter"];
type TelegramMode = TelegramView["mode"];

const defaults = {
  enabled: true,
  filter: "fiscal" as TelegramFilter,
  mode: "each" as TelegramMode,
  digestTime: "18:00",
};

/**
 * Preferenze della chat con i predefiniti dello schema per uno spazio senza riga, come
 * `enabled`, `filter`, `mode`, `digestTime` e `timeZone`. Argomento: alias di
 * `telegram_preferences`.
 */
export const telegramPreferencesSql = (preferences: string) =>
  `COALESCE(${preferences}.enabled, 1) AS enabled,
   COALESCE(${preferences}.filter, '${defaults.filter}') AS filter,
   COALESCE(${preferences}.mode, '${defaults.mode}') AS mode,
   COALESCE(${preferences}.digest_time, '${defaults.digestTime}') AS digestTime,
   COALESCE(${preferences}.time_zone, 'Europe/Rome') AS timeZone`;

/**
 * Nuovo deep link per lo spazio dell'utente, legato alla sessione che lo chiede. Sostituisce
 * quelli non ancora usati: vale soltanto l'ultimo. Le notifiche sono di Premium, prova e
 * lifetime: senza copertura nessun link.
 */
export async function startTelegramLink(
  db: D1Database,
  env: Env,
  input: { userId: string; sessionId: string; language: Language; timeZone: string },
  now = new Date(),
): Promise<{ url: string } | { reason: "premium_required" }> {
  const at = now.toISOString();
  const workspace = await db
    .prepare(`SELECT wm.workspace_id AS id FROM workspace_members wm
    WHERE wm.user_id = ?1 AND ${activeEntitlementSql("wm.workspace_id", "?2")}`)
    .bind(input.userId, at)
    .first<{ id: string }>();
  if (!workspace) return { reason: "premium_required" };
  const token = linkToken();
  await db.batch([
    db
      .prepare("DELETE FROM telegram_link_requests WHERE workspace_id = ? AND consumed_at IS NULL")
      .bind(workspace.id),
    db
      .prepare(`INSERT INTO telegram_link_requests
      (token_hash, workspace_id, user_id, session_id, language, time_zone, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(
        tokenHash(token),
        workspace.id,
        input.userId,
        input.sessionId,
        input.language,
        input.timeZone,
        at,
        new Date(now.getTime() + telegramLinkMinutes * 60_000).toISOString(),
      ),
  ]);
  return { url: deepLink(env, token) };
}

const settingsPath = "/app/impostazioni/notifiche";

/** Risposte del bot, in testo semplice. Senza una richiesta riconosciuta, in entrambe le lingue. */
const replies = {
  it: {
    linked:
      "Chat collegata a FiscalBay. Qui riceverai le notifiche degli ordini secondo le preferenze delle Impostazioni.",
    invalid: (url: string) =>
      `Questo link non è più valido. Creane uno nuovo da FiscalBay, in Impostazioni › Notifiche:\n${url}`,
    help: (url: string) =>
      `Per ricevere qui le notifiche degli ordini, collega questa chat da FiscalBay, in Impostazioni › Notifiche:\n${url}`,
  },
  en: {
    linked:
      "Chat linked to FiscalBay. Order notifications will arrive here according to your Settings.",
    invalid: (url: string) =>
      `This link is no longer valid. Create a new one in FiscalBay, under Settings › Notifications:\n${url}`,
    help: (url: string) =>
      `To receive order notifications here, link this chat in FiscalBay, under Settings › Notifications:\n${url}`,
  },
} satisfies Record<Language, unknown>;

function settingsUrl(env: Env, language: Language) {
  return `${new URL(env.APP_ORIGIN).origin}${localizedPath(language, settingsPath)}`;
}

/**
 * Risposta a una chat senza collegamento, in entrambe le lingue: in Production il rimando alle
 * Impostazioni. Sul test il bot parla soltanto con chi arriva da un link di un suo account: a
 * una chat sconosciuta non risponde, così il bot di prova non si presenta a chi lo trova per caso.
 */
export async function unknownChatReply(
  env: Env,
  chatId: string,
  kind: "help" | "invalid",
  fetcher: typeof fetch = fetch,
): Promise<void> {
  if (!isProduction(env)) return;
  await confirm(
    env,
    chatId,
    languages.map((language) => replies[language][kind](settingsUrl(env, language))).join("\n\n"),
    fetcher,
  );
}

type LinkRequest = {
  workspace_id: string;
  language: Language;
  consumed_by: string | null;
};

/**
 * Effetto del comando `/start` ricevuto dal webhook. Il token si consuma una volta sola, entro la
 * scadenza all'istante del messaggio, con la sessione che l'ha creato ancora aperta e l'utente
 * ancora nello spazio. La chat nuova sostituisce la precedente nello stesso commit: da allora la
 * precedente non è più il destinatario di nessuna consegna. Il collegamento fissa il fuso del
 * riepilogo a quello dell'account nella richiesta. Lo stesso aggiornamento riprovato non scrive
 * nulla: ripete la conferma soltanto se lo spazio è ancora collegato a quella chat, con la
 * stessa generazione.
 */
export async function consumeTelegramStart(
  env: Env,
  start: Pick<TelegramStart, "chatId" | "tokenHash" | "eventAt"> & { receiptId: string },
  fetcher: typeof fetch = fetch,
  now = new Date(),
): Promise<void> {
  const db = env.DB;
  const url = (language: Language) => settingsUrl(env, language);
  const reply = (text: string) => confirm(env, start.chatId, text, fetcher);
  const both = (kind: "help" | "invalid") => unknownChatReply(env, start.chatId, kind, fetcher);
  if (!start.tokenHash) return both("help");
  const request = await db
    .prepare(
      "SELECT workspace_id, language, consumed_by FROM telegram_link_requests WHERE token_hash = ?",
    )
    .bind(start.tokenHash)
    .first<LinkRequest>();
  if (!request) return both("invalid");
  const text = replies[request.language];
  if (request.consumed_by !== null && request.consumed_by !== start.receiptId)
    return reply(text.invalid(url(request.language)));
  if (request.consumed_by !== null) {
    // Un collegamento successivo, anche di nuovo con questa chat, ha una data più recente.
    const current = await db
      .prepare(`SELECT 1 FROM telegram_link_requests r
        JOIN telegram_links l ON l.workspace_id = r.workspace_id
        WHERE r.token_hash = ?1 AND l.chat_id = ?2
          AND julianday(l.linked_at) <= julianday(r.consumed_at)`)
      .bind(start.tokenHash, start.chatId)
      .first();
    return reply(current ? text.linked : text.invalid(url(request.language)));
  }
  const label = await chatLabel(env, start.chatId, fetcher).catch((error: unknown) => {
    // Un rifiuto non impedisce il collegamento: la chat resta senza nome.
    if (error instanceof UpstreamError && error.failure === "rejected") return null;
    throw error;
  });
  const at = now.toISOString();
  const consumed = `SELECT workspace_id, language, time_zone FROM telegram_link_requests
    WHERE token_hash = ?1 AND consumed_by = ?2`;
  await db.batch([
    db
      .prepare(`UPDATE telegram_link_requests SET consumed_at = ?3, consumed_by = ?2
      WHERE token_hash = ?1 AND consumed_at IS NULL
        AND julianday(expires_at) > julianday(?4)
        AND EXISTS (SELECT 1 FROM "session" s WHERE s.id = session_id AND s."expiresAt" > ?3)
        AND EXISTS (SELECT 1 FROM workspace_members wm
          WHERE wm.workspace_id = telegram_link_requests.workspace_id
            AND wm.user_id = telegram_link_requests.user_id)`)
      .bind(start.tokenHash, start.receiptId, at, start.eventAt),
    // La stessa chat resta lo stesso collegamento: cambia soltanto il nome mostrato.
    db
      .prepare(`UPDATE telegram_links SET chat_label = ?3
      WHERE workspace_id = (SELECT workspace_id FROM (${consumed})) AND chat_id = ?4`)
      .bind(start.tokenHash, start.receiptId, label, start.chatId),
    db
      .prepare(`INSERT INTO telegram_links (workspace_id, id, chat_id, chat_label, language, linked_at)
      SELECT workspace_id, ?3, ?4, ?5, language, ?6 FROM (${consumed}) WHERE true
      ON CONFLICT(workspace_id) DO UPDATE SET id = excluded.id, chat_id = excluded.chat_id,
        chat_label = excluded.chat_label, language = excluded.language,
        linked_at = excluded.linked_at, delivery_failure = NULL, delivery_failed_at = NULL,
        resumed_at = NULL, last_delivery_at = NULL
      WHERE telegram_links.chat_id <> excluded.chat_id`)
      .bind(start.tokenHash, start.receiptId, crypto.randomUUID(), start.chatId, label, at),
    db
      .prepare(`INSERT INTO telegram_preferences (workspace_id, time_zone, updated_at)
      SELECT workspace_id, time_zone, ?3 FROM (${consumed}) WHERE true
      ON CONFLICT(workspace_id) DO UPDATE SET time_zone = excluded.time_zone,
        updated_at = excluded.updated_at`)
      .bind(start.tokenHash, start.receiptId, at),
  ]);
  const linked = await db
    .prepare("SELECT 1 FROM telegram_link_requests WHERE token_hash = ? AND consumed_by = ?")
    .bind(start.tokenHash, start.receiptId)
    .first();
  return reply(linked ? text.linked : text.invalid(url(request.language)));
}

/**
 * Risposta del bot alla chat che ha scritto. Un rifiuto definitivo, come il bot bloccato subito
 * dopo «Avvia», chiude l'aggiornamento; un errore temporaneo lo fa riprovare.
 */
async function confirm(env: Env, chatId: string, text: string, fetcher: typeof fetch) {
  try {
    await sendText(env, chatId, text, fetcher);
  } catch (error) {
    if (error instanceof UpstreamError && error.failure === "rejected") return;
    throw error;
  }
}

/**
 * Stato delle notifiche dello spazio dell'utente, con i predefiniti dove non c'è una scelta. Il
 * fuso del riepilogo è quello dell'account al collegamento o all'ultima scelta di frequenza o
 * orario; senza nessuno dei due, `timeZone`, quello dell'account ora.
 */
export async function telegramSettings(
  db: D1Database,
  userId: string,
  timeZone: string,
): Promise<TelegramView> {
  const [{ results: workspaces }, { results: stores }] = await db.batch<Record<string, unknown>>([
    db
      .prepare(`SELECT l.chat_label, l.linked_at, l.delivery_failure, p.enabled, p.filter, p.mode,
        p.digest_time, p.time_zone
      FROM workspace_members wm
      LEFT JOIN telegram_links l ON l.workspace_id = wm.workspace_id
      LEFT JOIN telegram_preferences p ON p.workspace_id = wm.workspace_id
      WHERE wm.user_id = ?`)
      .bind(userId),
    db
      .prepare(`SELECT s.id, ${storeNameSql("s")} AS name, COALESCE(sp.enabled, 1) AS enabled,
        ${planPausedStore("s.id")} AS paused
      FROM workspace_members wm JOIN ebay_stores s ON s.workspace_id = wm.workspace_id
      LEFT JOIN telegram_store_preferences sp ON sp.store_id = s.id
      WHERE wm.user_id = ? AND s.data_deleted_at IS NULL ORDER BY s.linked_at, s.id`)
      .bind(userId),
  ]);
  const row = workspaces[0] as
    | {
        chat_label: string | null;
        linked_at: string | null;
        delivery_failure: "blocked" | "unreachable" | null;
        enabled: number | null;
        filter: TelegramFilter | null;
        mode: TelegramMode | null;
        digest_time: string | null;
        time_zone: string | null;
      }
    | undefined;
  // Prima del primo negozio non c'è uno spazio: nessuna chat e i predefiniti.
  if (!row) return { chat: null, ...defaults, timeZone, stores: [] };
  return {
    chat: row.linked_at
      ? {
          label: row.chat_label,
          linkedAt: row.linked_at,
          ...(row.delivery_failure ? { failure: row.delivery_failure } : {}),
        }
      : null,
    enabled: row.enabled === null ? defaults.enabled : row.enabled === 1,
    filter: row.filter ?? defaults.filter,
    mode: row.mode ?? defaults.mode,
    digestTime: row.digest_time ?? defaults.digestTime,
    timeZone: row.time_zone ?? timeZone,
    stores: (stores as Array<{ id: string; name: string; enabled: number; paused: number }>).map(
      (store) => ({
        id: store.id,
        name: store.name,
        enabled: store.enabled === 1,
        paused: store.paused === 1,
      }),
    ),
  };
}

/**
 * Notifiche dei negozi dello spazio per la pagina Negozi: attive con una chat collegata, le
 * notifiche accese e il negozio incluso. Null senza Premium, che le comprende.
 */
export async function storeNotifications(
  db: D1Database,
  userId: string,
  now = new Date(),
): Promise<Map<string, boolean> | null> {
  const { results } = await db
    .prepare(`SELECT s.id, ${activeEntitlementSql("s.workspace_id", "?2")} AS premium,
      (l.workspace_id IS NOT NULL AND COALESCE(p.enabled, 1) = 1 AND COALESCE(sp.enabled, 1) = 1)
        AS active
    FROM workspace_members wm JOIN ebay_stores s ON s.workspace_id = wm.workspace_id
    LEFT JOIN telegram_links l ON l.workspace_id = s.workspace_id
    LEFT JOIN telegram_preferences p ON p.workspace_id = s.workspace_id
    LEFT JOIN telegram_store_preferences sp ON sp.store_id = s.id
    WHERE wm.user_id = ?1 AND s.data_deleted_at IS NULL`)
    .bind(userId, now.toISOString())
    .all<{ id: string; premium: number; active: number }>();
  if (!results[0]?.premium) return null;
  return new Map(results.map((row) => [row.id, row.active === 1]));
}

export type TelegramChange =
  | { name: "enabled"; value: boolean }
  | { name: "filter"; value: TelegramFilter }
  | { name: "mode"; value: TelegramMode }
  | { name: "digestTime"; value: string }
  | { name: "store"; storeId: string; value: boolean };

/** Scelta salvata a ogni modifica dalle Impostazioni; null se nome o valore non sono ammessi. */
export function parseTelegramChange(name: string, value: string): TelegramChange | null {
  const flag = value === "true" ? true : value === "false" ? false : null;
  if (name === "telegram") return flag === null ? null : { name: "enabled", value: flag };
  if (name === "telegram-filter")
    return value === "fiscal" || value === "all" ? { name: "filter", value } : null;
  if (name === "telegram-mode")
    return value === "each" || value === "digest" ? { name: "mode", value } : null;
  if (name === "telegram-digest-time")
    return (telegramDigestTimes as readonly string[]).includes(value)
      ? { name: "digestTime", value }
      : null;
  const store = /^store-notifications:(.{1,128})$/u.exec(name)?.[1];
  if (store && flag !== null) return { name: "store", storeId: store, value: flag };
  return null;
}

const columns = { enabled: "enabled", filter: "filter", mode: "mode", digestTime: "digest_time" };

/**
 * Salva una scelta dello spazio dell'utente. La riattivazione, dello spazio o di un negozio,
 * vale per gli eventi successivi: quelli del periodo disattivato non arrivano più. Frequenza e
 * orario fissano anche il fuso del riepilogo, quello dell'account in quel momento. False se lo
 * spazio o il negozio non sono dell'utente.
 */
export async function saveTelegramChange(
  db: D1Database,
  userId: string,
  change: TelegramChange,
  timeZone: string,
  now = new Date(),
): Promise<boolean> {
  const at = now.toISOString();
  if (change.name === "store") {
    const saved = await db
      .prepare(`INSERT INTO telegram_store_preferences (store_id, enabled, updated_at)
      SELECT s.id, ?1, ?2 FROM ebay_stores s JOIN workspace_members wm ON wm.workspace_id = s.workspace_id
      WHERE s.id = ?3 AND wm.user_id = ?4 AND s.data_deleted_at IS NULL
      ON CONFLICT(store_id) DO UPDATE SET enabled = excluded.enabled, updated_at = excluded.updated_at,
        events_from = CASE WHEN telegram_store_preferences.enabled = 0 AND excluded.enabled = 1
          THEN excluded.updated_at ELSE telegram_store_preferences.events_from END`)
      .bind(change.value ? 1 : 0, at, change.storeId, userId)
      .run();
    return saved.meta.changes > 0;
  }
  const column = columns[change.name];
  const zone = change.name === "mode" || change.name === "digestTime";
  const saved = await db
    .prepare(`INSERT INTO telegram_preferences (workspace_id, ${column}, time_zone, updated_at)
    SELECT workspace_id, ?1, ?2, ?3 FROM workspace_members WHERE user_id = ?4
    ON CONFLICT(workspace_id) DO UPDATE SET ${column} = excluded.${column},
      updated_at = excluded.updated_at,
      ${zone ? "time_zone = excluded.time_zone," : ""}
      events_from = CASE WHEN ${
        // Stryker disable next-line ConditionalExpression: per le altre scelte `excluded.enabled` vale il predefinito 1, quindi a notifiche spente la condizione sposterebbe soltanto un inizio che la riattivazione riscrive.
        change.name === "enabled"
          ? "telegram_preferences.enabled = 0 AND excluded.enabled = 1"
          : "false"
      }
        THEN excluded.updated_at ELSE telegram_preferences.events_from END`)
    // D1 registra un booleano come 1 o 0.
    .bind(change.value, timeZone, at, userId)
    .run();
  return saved.meta.changes > 0;
}

export type TelegramRecipient = {
  linkId: string;
  chatId: string;
  language: Language;
  filter: TelegramFilter;
  mode: TelegramMode;
  digestTime: string;
  timeZone: string;
};

/**
 * Condizioni del destinatario di un evento del negozio all'istante `eventAt`, rilette a `at`:
 * Premium in corso ora e all'evento, notifiche attive per lo spazio e per il negozio, chat non
 * bloccata, evento successivo al collegamento, alle riattivazioni e alla ripresa dopo un blocco.
 * Alias attesi: `s` negozio, `l` collegamento, `p` e `sp` preferenze dello spazio e del negozio.
 */
export function telegramRecipientSql(eventAt: string, at: string) {
  return `s.data_deleted_at IS NULL
      AND ${activeEntitlementSql("s.workspace_id", at)}
      AND ${activeEntitlementSql("s.workspace_id", eventAt)}
      AND COALESCE(p.enabled, 1) = 1 AND COALESCE(sp.enabled, 1) = 1
      AND l.delivery_failure IS NOT 'blocked'
      AND julianday(${eventAt}) >= julianday(l.linked_at)
      AND (l.resumed_at IS NULL OR julianday(${eventAt}) >= julianday(l.resumed_at))
      AND (p.events_from IS NULL OR julianday(${eventAt}) >= julianday(p.events_from))
      AND (sp.events_from IS NULL OR julianday(${eventAt}) >= julianday(sp.events_from))`;
}

/**
 * Destinatario di un evento di un negozio, riletto al momento dell'invio secondo
 * `telegramRecipientSql`. Con `linkId` la consegna è stata preparata per quel collegamento: dopo
 * un cambio di chat non ha più destinatario. Null se non va inviato.
 */
export async function telegramRecipient(
  db: D1Database,
  event: { storeId: string; eventAt: string; linkId?: string },
  now = new Date(),
): Promise<TelegramRecipient | null> {
  const row = await db
    .prepare(`SELECT l.id AS linkId, l.chat_id AS chatId, l.language, ${telegramPreferencesSql("p")}
    FROM ebay_stores s
    JOIN telegram_links l ON l.workspace_id = s.workspace_id
    LEFT JOIN telegram_preferences p ON p.workspace_id = s.workspace_id
    LEFT JOIN telegram_store_preferences sp ON sp.store_id = s.id
    WHERE s.id = ?1 AND (?4 IS NULL OR l.id = ?4) AND ${telegramRecipientSql("?2", "?3")}`)
    .bind(event.storeId, event.eventAt, now.toISOString(), event.linkId ?? null)
    .first<TelegramRecipient>();
  return row ?? null;
}

/** Richieste scadute: quelle consumate restano un giorno per i nuovi tentativi. */
export function purgeTelegramLinks(db: D1Database, now: Date) {
  return db
    .prepare("DELETE FROM telegram_link_requests WHERE expires_at <= ?")
    .bind(new Date(now.getTime() - consumedRetention).toISOString());
}
