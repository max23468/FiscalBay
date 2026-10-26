import { activeEntitlementSql } from "./grants.server";
import { lockMilliseconds } from "./order-acquisition.server";
import { listVisibleOrders } from "./orders.server";
import { consultableStore, listedOrder, storeLabelSql } from "./store-state.server";
import { telegramPreferencesSql, telegramRecipient, telegramRecipientSql } from "./telegram.server";
import {
  digestMessage,
  emptyFiscalKey,
  fiscalDigest,
  fiscalKey,
  importMessage,
  localClock,
  orderMessage,
  orderNotice,
  type OrderChange,
  type OrderNotice,
} from "./telegram-messages.server";
import { logFailure } from "../errors";
import { UpstreamError } from "../integrations/http.server";
import { sendMessage, telegramConfigured, type BotMessage } from "../integrations/telegram.server";
import type { Language } from "../i18n";
import type { EbayEnvironment } from "../view-models";
import { inSequence } from "../sequence";
import { dayMilliseconds } from "../time";

/**
 * Consegne Telegram degli ordini, in tre passi che si possono interrompere e riprendere:
 *
 * 1. valutazione: lo stato fiscale corrente di ogni ordine si confronta con quello registrato in
 *    `telegram_order_notices`; la variazione e il nuovo stato si scrivono nello stesso commit,
 *    con la condizione che lo stato registrato sia ancora quello letto. Una valutazione ripetuta
 *    o concorrente non prepara due volte lo stesso evento;
 * 2. riepilogo e importazione: il turno del giorno nel fuso del riepilogo e il completamento di
 *    un'importazione hanno un'identità propria, unica per collegamento;
 * 3. invio: ogni consegna si prende con un lease, rilegge il destinatario e compone il testo dai
 *    dati correnti. Le parti già consegnate di un messaggio suddiviso non si ripetono.
 *
 * Telegram non conferma l'esito di una richiesta interrotta: un timeout o una rete caduta
 * lasciano la consegna incerta e la ritentano, quindi un messaggio può arrivare due volte. Un
 * rifiuto certo non si ritenta.
 */

/** Tentativi di una consegna prima di segnare la chat come irraggiungibile. */
export const maxDeliveryAttempts = 5;
/** Consegne per chat in un'esecuzione: Telegram ammette circa un messaggio al secondo. */
const deliveriesPerRun = 20;
/** Ordini valutati per spazio in un'esecuzione: il resto alla successiva. */
const ordersPerRun = 100;
/** Spazi serviti in un'esecuzione. */
const workspacesPerRun = 200;
const leaseMilliseconds = 5 * 60_000;

type Workspace = {
  workspaceId: string;
  linkId: string;
  userId: string;
  language: Language;
  enabled: number;
  filter: "fiscal" | "all";
  mode: "each" | "digest";
  digestTime: string;
  timeZone: string;
};

/**
 * Valuta e consegna le notifiche degli spazi con una chat collegata e Premium in corso, o del
 * solo spazio del negozio indicato. Un errore di uno spazio non ferma gli altri.
 */
export async function deliverTelegram(
  env: Env,
  fetcher: typeof fetch = fetch,
  now = new Date(),
  scope: { storeId?: string } = {},
): Promise<void> {
  if (!telegramConfigured(env)) return;
  // Senza Premium le consegne in attesa si chiudono: un rinnovo non porta l'arretrato.
  if (!scope.storeId) await closeUncovered(env.DB, now);
  const { results } = await env.DB.prepare(`SELECT l.workspace_id AS workspaceId, l.id AS linkId,
      l.language, ${telegramPreferencesSql("p")},
      (SELECT wm.user_id FROM workspace_members wm WHERE wm.workspace_id = l.workspace_id)
        AS userId
    FROM telegram_links l LEFT JOIN telegram_preferences p ON p.workspace_id = l.workspace_id
    WHERE (?1 IS NULL OR l.workspace_id = (SELECT workspace_id FROM ebay_stores WHERE id = ?1))
      AND l.delivery_failure IS NOT 'blocked' AND ${activeEntitlementSql("l.workspace_id", "?2")}
    ORDER BY l.linked_at LIMIT ?3`)
    .bind(scope.storeId ?? null, now.toISOString(), workspacesPerRun)
    .all<Workspace>();
  // Uno spazio alla volta. Il bot non più valido ferma l'esecuzione: nessun altro spazio può
  // ricevere messaggi.
  await untilStopped(results, async (workspace) => {
    try {
      if (workspace.enabled === 1 && workspace.userId) {
        await prepareOrderEvents(env.DB, workspace, now);
        await prepareImportEvents(env.DB, workspace, now);
      }
      await prepareDigest(env.DB, workspace, now);
      return await sendPending(env, workspace, fetcher, now);
    } catch (error) {
      logFailure({ error, operation: "telegram" });
      return "continue";
    }
  });
}

type Next = "continue" | "wait" | "stop";

/** Un passo alla volta, nell'ordine dato, finché un passo non chiede di fermarsi. */
function untilStopped<T>(items: readonly T[], step: (item: T) => Promise<Next>): Promise<Next> {
  return items.reduce<Promise<Next>>(
    (previous, item) => previous.then((next) => (next === "continue" ? step(item) : next)),
    Promise.resolve("continue"),
  );
}

function closeUncovered(db: D1Database, now: Date) {
  return db
    .prepare(`UPDATE telegram_deliveries SET failed_at = ?1
      WHERE sent_at IS NULL AND failed_at IS NULL
        AND NOT ${activeEntitlementSql("telegram_deliveries.workspace_id", "?1")}`)
    .bind(now.toISOString())
    .run();
}

type Candidate = {
  id: string;
  environment: EbayEnvironment;
  listedAt: string | null;
  noticeLink: string | null;
  fiscalKey: string | null;
  notified: number | null;
  /** Il destinatario riceve ora un evento di questo negozio e l'avrebbe ricevuto quando è avvenuto. */
  live: number;
};

/**
 * Variazioni fiscali dell'ordine, anche dei suoi acquisti confluiti, dopo la valutazione. Una
 * lettura registra l'istante in cui è partita e scrive fino a `lockMilliseconds` dopo: una
 * valutazione nel frattempo non l'ha vista, quindi il confronto la include. Rivalutare un
 * ordine senza variazioni non prepara eventi, perché l'impronta resta la stessa.
 */
const writtenSince = (column: string) =>
  `julianday(${column}) > julianday(n.evaluated_at) - ${lockMilliseconds / dayMilliseconds}`;
const changedSinceSql = `(EXISTS (SELECT 1 FROM tax_identifiers t JOIN orders original ON original.id = t.order_id
      WHERE (original.id = o.id OR original.merged_into = o.id)
        AND (${writtenSince("t.observed_at")} OR ${writtenSince("t.removed_at")}))
    OR EXISTS (SELECT 1 FROM order_tax_checks tc JOIN orders original ON original.id = tc.order_id
      WHERE (original.id = o.id OR original.merged_into = o.id) AND ${writtenSince("tc.observed_at")}))`;

/**
 * Istante dell'ultima variazione dei valori fiscali dell'ordine, anche dei suoi acquisti
 * confluiti: l'arrivo o la rimozione di un identificativo. Le verifiche ripetute senza
 * variazioni non lo spostano.
 */
const changedAtSql = `(SELECT MAX(max(t.observed_at, COALESCE(t.removed_at, t.observed_at)))
      FROM tax_identifiers t JOIN orders original ON original.id = t.order_id
      WHERE original.id = o.id OR original.merged_into = o.id)`;

/** Ordini consultabili dello spazio con le loro viste, letti come nel sito dall'utente dello spazio. */
async function noticesOf(
  db: D1Database,
  userId: string,
  orders: Array<{ id: string; environment: EbayEnvironment }>,
  now: Date,
): Promise<Map<string, OrderNotice>> {
  const read = (["production", "sandbox"] as const).map(async (environment) => {
    const ids = orders.filter((order) => order.environment === environment).map(({ id }) => id);
    if (ids.length === 0) return [];
    const visible = await listVisibleOrders(db, userId, ids.length, environment, now, { ids });
    return visible.map((order) => [order.id, orderNotice(order, environment)] as const);
  });
  return new Map((await Promise.all(read)).flat());
}

/**
 * Primo passo: per ogni ordine nuovo o con una variazione fiscale dopo l'ultima valutazione,
 * l'evento da notificare. Nuovo ordine soltanto se definitivo, entrato negli elenchi dopo il
 * collegamento e le riattivazioni, creato dopo l'inizio dell'importazione del negozio: lo
 * storico ha un solo riepilogo. Con «solo fiscali» un ordine senza dato, anche in verifica,
 * non si notifica, ma resta valutato e si notifica quando il dato arriva; le correzioni e le
 * rimozioni di un ordine già notificato arrivano con qualunque filtro.
 *
 * Una variazione si notifica se il destinatario l'avrebbe ricevuta all'istante in cui è
 * avvenuta: quelle del periodo con le notifiche spente, il negozio escluso, la chat bloccata o
 * senza Premium aggiornano soltanto lo stato, così la ripresa non porta l'arretrato. Quelle
 * rimaste indietro per un'interruzione del compito arrivano.
 *
 * Prima gli ordini mai valutati per il collegamento, poi quelli valutati da più tempo: gli
 * ordini rivalutati in un'esecuzione passano in fondo e non tolgono il turno agli altri.
 */
async function prepareOrderEvents(db: D1Database, workspace: Workspace, now: Date) {
  const at = now.toISOString();
  const eventAt = `CASE WHEN n.link_id IS l.id THEN COALESCE(${changedAtSql}, ?2) ELSE ?2 END`;
  const { results: candidates } = await db
    .prepare(`SELECT o.id, s.ebay_environment AS environment, o.listed_at AS listedAt,
        n.link_id AS noticeLink, n.fiscal_key AS fiscalKey, n.notified,
        (${telegramRecipientSql(eventAt, "?2")}) AS live
      FROM ebay_stores s
      JOIN telegram_links l ON l.workspace_id = s.workspace_id
      LEFT JOIN telegram_preferences p ON p.workspace_id = s.workspace_id
      LEFT JOIN telegram_store_preferences sp ON sp.store_id = s.id
      LEFT JOIN sync_state ss ON ss.store_id = s.id
      JOIN orders o ON o.store_id = s.id
      LEFT JOIN telegram_order_notices n ON n.order_id = o.id
      WHERE s.workspace_id = ?1 AND l.id = ?3 AND +o.merged_into IS NULL AND o.is_provisional = 0
        AND o.retention_until > ?2 AND ${consultableStore("s")}
        AND CASE WHEN n.link_id IS l.id THEN ${changedSinceSql}
          ELSE o.listed_at IS NOT NULL AND o.creation_time >= ss.history_until
            AND ${telegramRecipientSql("o.listed_at", "?2")} END
      ORDER BY n.link_id IS l.id, n.evaluated_at, o.listed_at, o.id LIMIT ?4`)
    .bind(workspace.workspaceId, at, workspace.linkId, ordersPerRun)
    .all<Candidate>();
  if (candidates.length === 0) return;
  const notices = await noticesOf(db, workspace.userId, candidates, now);
  // Impronte correnti e registrate di tutti i candidati, calcolate insieme prima del confronto.
  const keys = await Promise.all(
    candidates.map(async (candidate) => {
      const notice = notices.get(candidate.id);
      return {
        key: notice ? await fiscalKey(notice) : null,
        stored: candidate.fiscalKey?.startsWith("[")
          ? await fiscalDigest(candidate.fiscalKey)
          : candidate.fiscalKey,
      };
    }),
  );
  const statements: D1PreparedStatement[] = [];
  for (const [index, candidate] of candidates.entries()) {
    const notice = notices.get(candidate.id);
    if (!notice) continue;
    const { key, stored } = keys[index]!;
    const withValues = notice.values.length > 0;
    const first = candidate.noticeLink !== workspace.linkId;
    let change: OrderChange | null = null;
    let notified: 0 | 1 = 1;
    if (first || candidate.notified === 0) {
      if (candidate.live === 1 && (withValues || (first && workspace.filter === "all")))
        change = "new";
      // Anche una verifica in corso resta valutata: il dato in arrivo è una variazione.
      else notified = 0;
    } else if (key !== stored && candidate.live === 1) {
      change = stored === emptyFiscalKey ? "available" : withValues ? "changed" : "removed";
    }
    // Lo stato registrato è ancora quello letto: altrimenti un'altra valutazione l'ha già fatta.
    const unchanged =
      candidate.noticeLink === null
        ? "NOT EXISTS (SELECT 1 FROM telegram_order_notices WHERE order_id = ?1)"
        : `EXISTS (SELECT 1 FROM telegram_order_notices WHERE order_id = ?1 AND link_id = ?2
            AND fiscal_key = ?3 AND notified = ?4)`;
    const previous = [
      candidate.id,
      candidate.noticeLink,
      candidate.fiscalKey,
      candidate.notified,
    ] as const;
    if (change)
      statements.push(
        db
          .prepare(`INSERT INTO telegram_deliveries
            (id, workspace_id, link_id, kind, order_id, store_id, change, event_key, event_at, created_at)
          SELECT ?5, ?6, ?7, 'order', ?1, (SELECT store_id FROM orders WHERE id = ?1), ?8, ?9, ?10, ?11
          WHERE ${unchanged} ON CONFLICT DO NOTHING`)
          .bind(
            ...previous,
            crypto.randomUUID(),
            workspace.workspaceId,
            workspace.linkId,
            change,
            `order:${candidate.id}:${at}`,
            first ? candidate.listedAt : at,
            at,
          ),
      );
    statements.push(
      db
        .prepare(`INSERT INTO telegram_order_notices (order_id, link_id, fiscal_key, notified, evaluated_at)
        SELECT ?1, ?5, ?6, ?7, ?8 WHERE ${unchanged}
        ON CONFLICT(order_id) DO UPDATE SET link_id = excluded.link_id,
          fiscal_key = excluded.fiscal_key, notified = excluded.notified,
          evaluated_at = excluded.evaluated_at`)
        .bind(...previous, workspace.linkId, key, notified, at),
    );
  }
  if (statements.length > 0) await db.batch(statements);
}

/**
 * Un solo messaggio per importazione completata, con l'identità dell'importazione: le riprese
 * tecniche dello stesso import non ne preparano altri, una nuova importazione richiesta sì.
 */
async function prepareImportEvents(db: D1Database, workspace: Workspace, now: Date) {
  await db
    .prepare(`INSERT INTO telegram_deliveries
      (id, workspace_id, link_id, kind, store_id, event_key, event_at, created_at)
    SELECT lower(hex(randomblob(16))), s.workspace_id, l.id, 'import', s.id,
      'import:' || s.id || ':' || ss.history_until, ss.history_done_at, ?2
    FROM ebay_stores s
    JOIN sync_state ss ON ss.store_id = s.id
    JOIN telegram_links l ON l.workspace_id = s.workspace_id
    LEFT JOIN telegram_preferences p ON p.workspace_id = s.workspace_id
    LEFT JOIN telegram_store_preferences sp ON sp.store_id = s.id
    WHERE s.workspace_id = ?1 AND l.id = ?3 AND ss.history_done_at IS NOT NULL
      AND ${telegramRecipientSql("ss.history_done_at", "?2")}
    ON CONFLICT DO NOTHING`)
    .bind(workspace.workspaceId, now.toISOString(), workspace.linkId)
    .run();
}

/** Istante dell'ora locale `time` del giorno `day` nel fuso indicato. */
export function zonedInstant(timeZone: string, day: string, time: string): Date {
  const wall = Date.parse(`${day}T${time}:00Z`);
  const offset = (instant: number) => {
    const clock = localClock(timeZone, new Date(instant));
    return Date.parse(`${clock.day}T${clock.time}:00Z`) - Math.floor(instant / 60_000) * 60_000;
  };
  // La seconda correzione usa la differenza valida all'istante trovato, anche vicino a un cambio
  // di ora legale.
  return new Date(wall - offset(wall - offset(wall)));
}

/**
 * Riepilogo del giorno locale all'orario scelto, con gli eventi in attesa fino a quell'istante:
 * uno al giorno anche nei cambi di ora legale, perché l'identità è la data nel fuso. Gli eventi
 * successivi, anche senza un riepilogo nel giorno, vanno al giorno dopo; quelli precedenti
 * rimasti indietro per un'interruzione entrano nel primo riepilogo che parte.
 */
async function prepareDigest(db: D1Database, workspace: Workspace, now: Date) {
  if (workspace.mode !== "digest") return;
  const clock = localClock(workspace.timeZone, now);
  if (clock.time < workspace.digestTime) return;
  const key = `digest:${clock.day}`;
  const at = now.toISOString();
  const cutoff = zonedInstant(workspace.timeZone, clock.day, workspace.digestTime).toISOString();
  const pending = `link_id = ?2 AND kind = 'order' AND digest_id IS NULL AND sent_at IS NULL
    AND failed_at IS NULL AND julianday(event_at) <= julianday(?4)`;
  await db.batch([
    db
      .prepare(`INSERT INTO telegram_deliveries (id, workspace_id, link_id, kind, event_key, event_at, created_at)
      SELECT ?5, ?1, ?2, 'digest', ?3, ?6, ?6
      WHERE EXISTS (SELECT 1 FROM telegram_deliveries WHERE ${pending}) ON CONFLICT DO NOTHING`)
      .bind(workspace.workspaceId, workspace.linkId, key, cutoff, crypto.randomUUID(), at),
    db
      .prepare(`UPDATE telegram_deliveries SET digest_id = (SELECT id FROM telegram_deliveries
        WHERE link_id = ?2 AND event_key = ?3)
      WHERE ${pending} AND workspace_id = ?1 AND EXISTS (SELECT 1 FROM telegram_deliveries g
        WHERE g.link_id = ?2 AND g.event_key = ?3 AND g.sent_at IS NULL AND g.failed_at IS NULL
          AND g.attempts = 0 AND g.parts_sent = 0)`)
      .bind(workspace.workspaceId, workspace.linkId, key, cutoff),
  ]);
}

type Delivery = {
  id: string;
  kind: "order" | "digest" | "import";
  link_id: string;
  order_id: string | null;
  store_id: string | null;
  change: OrderChange | null;
  event_at: string;
  attempts: number;
  parts_sent: number;
};

type Outcome = "sent" | "waiting" | "dropped";

/** Gli eventi di un riepilogo che non parte si chiudono con lui: non tornano singoli. */
function closeMembers(db: D1Database, digestId: string, at: string) {
  return db
    .prepare(`UPDATE telegram_deliveries SET failed_at = ?2
      WHERE digest_id = ?1 AND sent_at IS NULL AND failed_at IS NULL`)
    .bind(digestId, at);
}

/**
 * Terzo passo: invia le consegne dovute dello spazio, in ordine di preparazione. Si ferma alla
 * prima che non riesce, così la chat non riceve un messaggio successivo prima di uno precedente
 * ancora in attesa. Restituisce `stop` se il token del bot non è più valido.
 */
async function sendPending(
  env: Env,
  workspace: Workspace,
  fetcher: typeof fetch,
  now: Date,
): Promise<Next> {
  const at = now.toISOString();
  const { results } = await env.DB.prepare(`SELECT id, kind, link_id, order_id, store_id, change,
        event_at, attempts, parts_sent
      FROM telegram_deliveries
      WHERE workspace_id = ?1 AND sent_at IS NULL AND failed_at IS NULL
        AND (retry_at IS NULL OR retry_at <= ?2) AND (kind <> 'order' OR digest_id IS NULL)
      ORDER BY created_at, id LIMIT ?3`)
    .bind(workspace.workspaceId, at, deliveriesPerRun)
    .all<Delivery>();
  const next = await untilStopped(results, (delivery) =>
    sendOne(env, workspace, delivery, fetcher, now),
  );
  // L'attesa di una chat non ferma gli altri spazi.
  return next === "stop" ? "stop" : "continue";
}

/** Prende la consegna con un lease e la invia; `wait` ferma le successive della chat. */
async function sendOne(
  env: Env,
  workspace: Workspace,
  delivery: Delivery,
  fetcher: typeof fetch,
  now: Date,
): Promise<Next> {
  const db = env.DB;
  const at = now.toISOString();
  const lease = crypto.randomUUID();
  const claimed = await db
    .prepare(`UPDATE telegram_deliveries SET lease = ?2, locked_until = ?3
      WHERE id = ?1 AND sent_at IS NULL AND failed_at IS NULL
        AND (locked_until IS NULL OR locked_until <= ?4) RETURNING parts_sent`)
    .bind(delivery.id, lease, new Date(now.getTime() + leaseMilliseconds).toISOString(), at)
    .first<{ parts_sent: number }>();
  if (!claimed) return "continue";
  const release = releaser(db, delivery.id, lease);
  try {
    const outcome = await deliver(
      env,
      workspace,
      delivery,
      claimed.parts_sent,
      lease,
      fetcher,
      now,
    );
    if (outcome === "waiting") await release("retry_at = NULL").run();
    else if (outcome === "dropped")
      await db.batch([release("failed_at = ?3", at), closeMembers(db, delivery.id, at)]);
    else
      await db.batch([
        release("sent_at = ?3", at),
        db
          .prepare("UPDATE telegram_deliveries SET sent_at = ?2 WHERE digest_id = ?1")
          .bind(delivery.id, at),
        db
          .prepare(`UPDATE telegram_links SET last_delivery_at = ?2,
            delivery_failure = CASE WHEN delivery_failure = 'unreachable' THEN NULL ELSE delivery_failure END,
            delivery_failed_at = CASE WHEN delivery_failure = 'unreachable' THEN NULL ELSE delivery_failed_at END
          WHERE id = ?1`)
          .bind(delivery.link_id, at),
      ]);
  } catch (error) {
    const failure = await recordFailure(db, delivery, lease, error, now);
    return failure === "skip" ? "continue" : failure;
  }
  return "continue";
}

/** Fine del turno di una consegna, soltanto se il lease è ancora quello preso. */
function releaser(db: D1Database, id: string, lease: string) {
  return (assignments: string, ...values: unknown[]) =>
    db
      .prepare(`UPDATE telegram_deliveries SET ${assignments}, lease = NULL, locked_until = NULL
        WHERE id = ?1 AND lease = ?2`)
      .bind(id, lease, ...values);
}

/**
 * Esito di un errore della Bot API: `skip` passa alla consegna successiva, `wait` ferma la chat
 * fino al prossimo turno, `stop` ferma l'esecuzione.
 */
async function recordFailure(
  db: D1Database,
  delivery: Delivery,
  lease: string,
  error: unknown,
  now: Date,
): Promise<"skip" | "wait" | "stop"> {
  const at = now.toISOString();
  const release = releaser(db, delivery.id, lease);
  const upstream = error instanceof UpstreamError ? error : null;
  if (upstream?.failure === "rate_limited") {
    const seconds = upstream.details.retryAfter ?? 30;
    await release("retry_at = ?3", new Date(now.getTime() + seconds * 1000).toISOString()).run();
    return "wait";
  }
  if (upstream?.failure === "rejected" && upstream.details.status === 403) {
    // Bot bloccato o chat chiusa: le consegne in attesa non partono più e la chat resta
    // ferma finché non scrive di nuovo al bot.
    await db.batch([
      release("failed_at = ?3", at),
      db
        .prepare(`UPDATE telegram_links SET delivery_failure = 'blocked', delivery_failed_at = ?2
          WHERE id = ?1`)
        .bind(delivery.link_id, at),
      db
        .prepare(`UPDATE telegram_deliveries SET failed_at = ?2
          WHERE link_id = ?1 AND sent_at IS NULL AND failed_at IS NULL`)
        .bind(delivery.link_id, at),
    ]);
    return "wait";
  }
  if (upstream?.failure === "rejected") {
    // Rifiuto certo del solo messaggio: ritentarlo darebbe lo stesso esito.
    logFailure({ error, operation: "telegram" });
    await db.batch([release("failed_at = ?3", at), closeMembers(db, delivery.id, at)]);
    return "skip";
  }
  if (upstream?.failure === "credentials") {
    logFailure({ error, operation: "telegram" });
    await release("retry_at = NULL").run();
    return "stop";
  }
  logFailure({ error, operation: "telegram" });
  const attempts = delivery.attempts + 1;
  // Senza una risposta di Telegram il messaggio può essere arrivato comunque.
  const uncertain = upstream?.failure === "unavailable" && upstream.details.status === undefined;
  if (attempts >= maxDeliveryAttempts) {
    await db.batch([
      release(
        `attempts = ?3, failed_at = ?4, uncertain_at = CASE WHEN ?5 THEN ?4 ELSE uncertain_at END`,
        attempts,
        at,
        uncertain ? 1 : 0,
      ),
      closeMembers(db, delivery.id, at),
      db
        .prepare(`UPDATE telegram_links SET delivery_failure = 'unreachable', delivery_failed_at = ?2
          WHERE id = ?1 AND delivery_failure IS NULL`)
        .bind(delivery.link_id, at),
    ]);
    return "wait";
  }
  const delay = Math.min(3_600_000, 60_000 * 2 ** (attempts - 1));
  await release(
    `attempts = ?3, retry_at = ?4, uncertain_at = CASE WHEN ?5 THEN ?6 ELSE uncertain_at END`,
    attempts,
    new Date(now.getTime() + delay).toISOString(),
    uncertain ? 1 : 0,
    at,
  ).run();
  return "wait";
}

/** Compone e invia una consegna dalla parte indicata; ogni parte riuscita si registra subito. */
async function deliver(
  env: Env,
  workspace: Workspace,
  delivery: Delivery,
  from: number,
  lease: string,
  fetcher: typeof fetch,
  now: Date,
): Promise<Outcome> {
  const messages = await compose(env, workspace, delivery, now);
  if (messages === "waiting" || messages === "dropped") return messages;
  const recipient = await env.DB.prepare("SELECT chat_id FROM telegram_links WHERE id = ?")
    .bind(delivery.link_id)
    .first<{ chat_id: string }>();
  if (!recipient) return "dropped";
  // Le parti nell'ordine del testo, una alla volta.
  await inSequence(messages.slice(from), async (message, index) => {
    await sendMessage(env, recipient.chat_id, message, fetcher);
    await env.DB.prepare(
      "UPDATE telegram_deliveries SET parts_sent = ?3 WHERE id = ?1 AND lease = ?2",
    )
      .bind(delivery.id, lease, from + index + 1)
      .run();
  });
  return "sent";
}

/**
 * Testo della consegna dai dati correnti, dopo aver riletto il destinatario: null o un
 * collegamento diverso scartano la consegna; un ordine singolo con il riepilogo scelto aspetta.
 */
async function compose(
  env: Env,
  workspace: Workspace,
  delivery: Delivery,
  now: Date,
): Promise<BotMessage[] | Exclude<Outcome, "sent">> {
  const db = env.DB;
  if (delivery.kind === "digest") {
    if (delivery.link_id !== workspace.linkId || workspace.enabled !== 1) return "dropped";
    // Restano gli eventi che il destinatario riceverebbe ancora, come per un ordine singolo.
    const { results: kept } = await db
      .prepare(`SELECT d.order_id AS orderId, d.change, s.ebay_environment AS environment
        FROM telegram_deliveries d JOIN ebay_stores s ON s.id = d.store_id
        JOIN telegram_links l ON l.id = d.link_id AND l.workspace_id = s.workspace_id
        LEFT JOIN telegram_preferences p ON p.workspace_id = s.workspace_id
        LEFT JOIN telegram_store_preferences sp ON sp.store_id = s.id
        WHERE d.digest_id = ?1 AND ${telegramRecipientSql("d.event_at", "?2")}
        ORDER BY d.event_at, d.id`)
      .bind(delivery.id, now.toISOString())
      .all<{ orderId: string; change: OrderChange; environment: EbayEnvironment }>();
    // Più eventi dello stesso ordine diventano una voce, con i dati correnti.
    const changes = new Map<string, OrderChange>();
    for (const member of kept)
      changes.set(member.orderId, changes.get(member.orderId) === "new" ? "new" : member.change);
    const notices = await noticesOf(
      db,
      workspace.userId,
      [...new Map(kept.map((member) => [member.orderId, member])).values()].map((member) => ({
        id: member.orderId,
        environment: member.environment,
      })),
      now,
    );
    const entries = [...changes].flatMap(([orderId, change]) => {
      const notice = notices.get(orderId);
      return notice ? [{ notice, change }] : [];
    });
    if (entries.length === 0) return "dropped";
    return digestMessage(
      env,
      workspace.language,
      workspace.timeZone,
      delivery.event_at,
      entries,
      now,
    );
  }
  const recipient = await telegramRecipient(
    db,
    { storeId: delivery.store_id!, eventAt: delivery.event_at, linkId: delivery.link_id },
    now,
  );
  if (!recipient) return "dropped";
  if (delivery.kind === "import") {
    const summary = await db
      .prepare(`SELECT s.id AS storeId, ${storeLabelSql("s")} AS storeName,
          s.ebay_environment AS environment, ss.history_from AS "from", ss.history_until AS until,
          (SELECT count(*) FROM orders o WHERE o.store_id = s.id AND ${listedOrder("o", "?2")}
            AND o.creation_time >= ss.history_from AND o.creation_time < ss.history_until) AS orders,
          (SELECT count(*) FROM orders o WHERE o.store_id = s.id AND ${listedOrder("o", "?2")}
            AND o.creation_time >= ss.history_from AND o.creation_time < ss.history_until
            AND EXISTS (SELECT 1 FROM tax_identifiers t JOIN orders original ON original.id = t.order_id
              WHERE (original.id = o.id OR original.merged_into = o.id) AND t.removed_at IS NULL)) AS fiscal
        FROM ebay_stores s JOIN sync_state ss ON ss.store_id = s.id
        WHERE s.id = ?1 AND ss.history_done_at IS NOT NULL`)
      .bind(delivery.store_id, now.toISOString())
      .first<Parameters<typeof importMessage>[3]>();
    if (!summary) return "dropped";
    return [importMessage(env, recipient.language, recipient.timeZone, summary, now)];
  }
  if (recipient.mode === "digest") return "waiting";
  const environment = await db
    .prepare("SELECT ebay_environment FROM ebay_stores WHERE id = ?")
    .bind(delivery.store_id)
    .first<{ ebay_environment: EbayEnvironment }>();
  const notice = (
    await noticesOf(
      db,
      workspace.userId,
      [{ id: delivery.order_id!, environment: environment!.ebay_environment }],
      now,
    )
  ).get(delivery.order_id!);
  if (!notice) return "dropped";
  return orderMessage(env, recipient.language, recipient.timeZone, notice, delivery.change!, now);
}

/** Consegne chiuse da più di sette giorni: restano per diagnosi, poi si eliminano. */
export function purgeTelegramDeliveries(db: D1Database, now: Date) {
  return db
    .prepare(`DELETE FROM telegram_deliveries WHERE created_at <= ?1
      AND (sent_at IS NOT NULL OR failed_at IS NOT NULL OR created_at <= ?2)`)
    .bind(
      new Date(now.getTime() - 7 * dayMilliseconds).toISOString(),
      new Date(now.getTime() - 30 * dayMilliseconds).toISOString(),
    );
}
