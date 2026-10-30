import { z } from "zod";

import { acquireOrders, storeAccess, type ActiveStore } from "./order-acquisition.server";
import { defaultRateLimitSeconds, rateLimitWait } from "./order-acquisition-context.server";
import { servedSql } from "./admission.server";
import { switchOnSql } from "./service-settings.server";
import { activeEntitlementSql } from "./grants.server";
import { historyStartSql, storeWorkspaceSql } from "./history-window.server";
import { activeStore, renewableConsent, writableStore } from "./store-state.server";
import { deliverTelegram } from "./telegram-deliveries.server";
import { logFailure } from "../errors";
import { UpstreamError } from "../integrations/http.server";
import type { EbayEnvironment } from "../view-models";
import { ebayConfiguration } from "../integrations/ebay/environment.server";
import { visibleOrderState } from "./orders.server";

/**
 * Lettura periodica dei negozi e richieste manuali. Il cron parte ogni dieci minuti, sceglie i
 * negozi dovuti e ne accoda la lettura a gruppi di dieci; «Sincronizza» e «Reimporta» la
 * accodano subito per il solo negozio. Ogni messaggio porta soltanto i riferimenti ai negozi e il
 * consumer ne legge uno alla volta. La richiesta resta in D1 finché una lettura partita dopo non la serve: richieste
 * ripetute confluiscono nella stessa e il cron riaccoda quelle che la coda non ha consegnato.
 * Gli eventi eBay seguono l'ingresso dei webhook e non dipendono dal piano.
 */

export type SyncPlan = "free" | "premium";

/** Cadenza della lettura dei recenti per piano, in minuti: obiettivo, non garanzia. */
export const syncMinutes: Record<SyncPlan, number> = { premium: 10, free: 30 };

// Il cron parte ogni dieci minuti; il margine assorbe un avvio in ritardo rispetto al turno.
const toleranceMilliseconds = 60_000;
// Ritardo massimo di un nuovo tentativo ammesso dalla coda.
const maxRetryDelaySeconds = 43_200;
/** Budget di una lettura del negozio, cioè di un'invocazione del consumer. */
const storeBudget = { calls: 12, pages: 3 };
// Negozi valutati e accodati per esecuzione del cron, dai letti meno di recente. Con Premium
// ogni dieci minuti e Free ogni trenta, un turno serve i Premium più un terzo dei Free: il caso
// di riferimento ne chiede circa 85. Con gruppi da dieci i messaggi di un turno restano entro i
// cento di un invio a gruppi della coda.
const dispatchLimit = 300;
/**
 * Negozi di un messaggio del cron, letti in sequenza dalla stessa invocazione: ogni messaggio
 * costa tre operazioni della coda, e un messaggio per negozio supererebbe le operazioni incluse
 * nel piano. Le richieste manuali e i webhook restano a un negozio per messaggio.
 */
const syncGroupSize = 10;
// Un turno accodato senza esito entro questo tempo si considera perso e si ripropone.
const dispatchStaleMilliseconds = 60 * 60_000;
const tokenMarginMilliseconds = 5 * 60_000;

export type SyncCandidate = {
  plan: SyncPlan;
  polledAt: string | null;
  requestedAt: string | null;
  /** Storico, passata dei recenti o dettagli ancora da leggere dopo una lettura riuscita. */
  backlog: boolean;
};

/**
 * Ordine della lettura periodica sotto carico: prima i negozi dovuti per cadenza o per una
 * richiesta manuale (Premium, poi Free), poi quelli con lavoro arretrato (Premium, poi Free).
 * Un negozio la cui ultima lettura è fallita non anticipa l'arretrato: riprova con la cadenza.
 * A parità, prima la richiesta manuale e poi il negozio letto meno di recente: anche chi
 * fallisce passa il turno, così nessun negozio resta indietro per sempre.
 */
export function syncOrder<T extends SyncCandidate>(candidates: T[], now: Date): T[] {
  const rank = (candidate: T) => {
    const plan = candidate.plan === "premium" ? 0 : 1;
    const due =
      candidate.requestedAt !== null ||
      candidate.polledAt === null ||
      Date.parse(candidate.polledAt) <=
        now.getTime() - syncMinutes[candidate.plan] * 60_000 + toleranceMilliseconds;
    if (due) return plan;
    return candidate.backlog ? 2 + plan : null;
  };
  return candidates
    .flatMap((candidate) => {
      const position = rank(candidate);
      return position === null ? [] : [{ candidate, position }];
    })
    .sort(
      (a, b) =>
        a.position - b.position ||
        Number(a.candidate.requestedAt === null) - Number(b.candidate.requestedAt === null) ||
        (a.candidate.polledAt ?? "").localeCompare(b.candidate.polledAt ?? ""),
    )
    .map(({ candidate }) => candidate);
}

type CandidateRow = ActiveStore & {
  polled_at: string | null;
  requested_at: string | null;
  backlog: number;
  premium: number;
};

/**
 * Smistamento periodico: sceglie in ordine di priorità i negozi attivi con un token valido e
 * ne accoda la lettura, che il consumer esegue con il budget di un negozio. Il claim in D1
 * precede l'invio: trigger ripetuti o sovrapposti non accodano due volte lo stesso negozio,
 * mentre un turno accodato e mai servito si ripropone dopo `dispatchStaleMilliseconds`. I
 * negozi di un'origine API in attesa per un limite di eBay non si accodano, nessuno con le
 * chiamate eBay spente dalla console.
 */
export async function dispatchStoreSyncs(env: Env, now = new Date()): Promise<string[]> {
  const at = now.toISOString();
  const stale = new Date(now.getTime() - dispatchStaleMilliseconds).toISOString();
  const [{ results: rows }, { results: limits }] = await env.DB.batch<
    CandidateRow | { api_origin: string }
  >([
    env.DB.prepare(
      `SELECT c.store_id, c.access_token, c.granted_at, s.ebay_environment,
              ss.polled_at, ss.requested_at,
              -- Dopo una lettura non riuscita l'arretrato attende la cadenza del piano.
              (EXISTS (SELECT 1 FROM sync_runs sr WHERE sr.store_id = c.store_id
                          AND sr.started_at = ss.polled_at AND sr.ok = 1)
               AND (ss.history_done_at IS NULL OR ss.recent_next IS NOT NULL
                    OR ss.trading_end IS NOT NULL OR EXISTS (
                 SELECT 1 FROM order_source_refs r
                  WHERE r.store_id = c.store_id AND r.source = 'fulfillment'
                    AND r.detail_for IS NOT r.last_modified_time
                    AND (r.detail_retry_at IS NULL OR r.detail_retry_at <= ?1)))) AS backlog,
              ${activeEntitlementSql("s.workspace_id", "?1")} AS premium
         FROM ebay_store_credentials c
         JOIN ebay_stores s ON s.id = c.store_id
         LEFT JOIN sync_state ss ON ss.store_id = c.store_id
        WHERE ${activeStore("c", "s")} AND c.access_expires_at > ?2
          AND ${servedSql("s.workspace_id", "?1")} AND ${switchOnSql("ebay_calls")}
          AND (ss.polled_at IS NULL OR ss.requested_at IS NOT NULL OR ss.polled_at <= ?3)
          AND (ss.dispatched_at IS NULL OR ss.dispatched_at <= ?5)
        ORDER BY ss.polled_at IS NOT NULL, ss.polled_at, c.store_id
        LIMIT ?4`,
    ).bind(
      at,
      new Date(now.getTime() + tokenMarginMilliseconds).toISOString(),
      // Nessun piano legge più spesso della cadenza più breve.
      new Date(
        now.getTime() - Math.min(...Object.values(syncMinutes)) * 60_000 + toleranceMilliseconds,
      ).toISOString(),
      dispatchLimit,
      stale,
    ),
    // Solo le attese dell'origine API: una quota Trading esaurita non ferma le letture.
    env.DB.prepare(
      "SELECT api_origin FROM ebay_rate_limits WHERE until > ? AND instr(api_origin, '#') = 0",
    ).bind(at),
  ]);
  // Origini API in attesa. Un ambiente non configurato (undefined) si accoda comunque: il
  // consumer registra l'errore e il negozio passa il turno.
  const limited = new Set<string | undefined>(
    (limits as { api_origin: string }[]).map((row) => row.api_origin),
  );
  const selected = syncOrder(
    (rows as CandidateRow[]).map((row) => ({
      storeId: row.store_id,
      grantedAt: row.granted_at,
      apiOrigin: apiOriginOf(env, row.ebay_environment),
      // Una copertura in corso, anche la prova, legge con la cadenza Premium.
      plan: (row.premium === 1 ? "premium" : "free") as SyncPlan,
      polledAt: row.polled_at,
      requestedAt: row.requested_at,
      backlog: row.backlog === 1,
    })),
    now,
  ).filter((store) => !limited.has(store.apiOrigin));
  if (selected.length === 0) return [];

  const claims = await env.DB.batch<{ store_id: string }>(
    selected.map((store) =>
      env.DB.prepare(
        `INSERT INTO sync_state (store_id, dispatched_at, updated_at)
         SELECT ?1, ?3, ?3 WHERE ${writableStore}
         ON CONFLICT(store_id) DO UPDATE SET dispatched_at = excluded.dispatched_at,
                                             updated_at = excluded.updated_at
         WHERE sync_state.dispatched_at IS NULL OR sync_state.dispatched_at <= ?4
         RETURNING store_id`,
      ).bind(store.storeId, store.grantedAt, at, stale),
    ),
  );
  // Nell'ordine di priorità: la coda consegna prima i negozi accodati prima.
  const claimed = claims.flatMap(({ results }) => results.map((row) => row.store_id));
  if (claimed.length === 0) return [];
  const groups = Array.from({ length: Math.ceil(claimed.length / syncGroupSize) }, (_, index) =>
    claimed.slice(index * syncGroupSize, (index + 1) * syncGroupSize),
  );
  try {
    await env.WORK_QUEUE.sendBatch(groups.map((syncStores) => ({ body: { syncStores } })));
  } catch (error) {
    // I turni tornano liberi e il prossimo trigger li riprova.
    await env.DB.prepare(
      `UPDATE sync_state SET dispatched_at = NULL
        WHERE store_id IN (SELECT value FROM json_each(?1)) AND dispatched_at = ?2`,
    )
      .bind(JSON.stringify(claimed), at)
      .run();
    throw error;
  }
  return claimed;
}

/** Origine API dell'ambiente del negozio; undefined se l'ambiente non è configurato. */
function apiOriginOf(env: Env, ebayEnvironment: ActiveStore["ebay_environment"]) {
  let origin: string | undefined;
  try {
    origin = ebayConfiguration(env, ebayEnvironment).apiOrigin;
  } catch {}
  return origin;
}

export type SyncRequestResult =
  /** Richiesta registrata e consegnata alla coda, o affidata al cron se la coda non risponde. */
  | "queued"
  /** Una richiesta uguale è già in attesa: questa confluisce nella stessa lettura. */
  | "merged"
  /** Reimportazione chiesta mentre lo storico si sta ancora importando. */
  | "importing"
  /** eBay chiede di attendere: la richiesta resta e parte alla scadenza dell'attesa. */
  | "limited"
  /** Chiamate eBay spente dalla console: la richiesta resta e parte alla riaccensione. */
  | "suspended"
  | "not_found"
  /** Negozio scollegato, in pausa, da ricollegare o di uno spazio in lista d'attesa. */
  | "invalid";

const storeIdSchema = z.string().min(1).max(64);
/** Un negozio, da una richiesta o da un webhook, oppure un gruppo accodato dal cron. */
const syncMessageSchema = z.union([
  z.object({ syncStore: storeIdSchema }),
  z.object({ syncStores: z.array(storeIdSchema).min(1).max(syncGroupSize) }),
]);

export function isSyncMessage(body: unknown): body is z.infer<typeof syncMessageSchema> {
  return syncMessageSchema.safeParse(body).success;
}

/**
 * «Sincronizza» o «Reimporta» dalla schermata Negozi, solo su un negozio attivo dello spazio
 * dell'utente, oppure dalla console amministrativa con `userId` null. La reimportazione riparte
 * dalla finestra dello storico del piano soltanto quando l'importazione precedente è conclusa;
 * poi entrambe chiedono una lettura del negozio.
 */
export async function requestStoreSync(
  env: Env,
  userId: string | null,
  storeId: string,
  options: { reimport?: boolean } = {},
  now = new Date(),
): Promise<SyncRequestResult> {
  const at = now.toISOString();
  const store = await env.DB.prepare(
    `SELECT c.granted_at, s.ebay_environment, ss.store_id AS started, ss.history_done_at,
            ${servedSql("s.workspace_id", "?3")} AS served, ${switchOnSql("ebay_calls")} AS calls
       FROM ebay_stores s
       LEFT JOIN ebay_store_credentials c
         ON c.store_id = s.id AND ${renewableConsent("c", "?3")}
       LEFT JOIN sync_state ss ON ss.store_id = s.id
      WHERE (?1 IS NULL OR s.workspace_id IN (
          SELECT workspace_id FROM workspace_members WHERE user_id = ?1))
        AND s.id = ?2 AND s.data_deleted_at IS NULL`,
  )
    .bind(userId, storeId, at)
    .first<{
      granted_at: string | null;
      ebay_environment: ActiveStore["ebay_environment"];
      started: string | null;
      history_done_at: string | null;
      served: number;
      calls: number;
    }>();
  if (!store) return "not_found";
  // In lista d'attesa basta la prima lettura del collegamento.
  if (!store.served) return "invalid";

  // Registrata soltanto con un consenso valido e senza pausa.
  const request = await env.DB.prepare(
    `INSERT INTO sync_state (store_id, requested_at, updated_at)
     SELECT ?1, ?3, ?3 WHERE ${writableStore}
     ON CONFLICT(store_id) DO UPDATE SET
       requested_at = COALESCE(sync_state.requested_at, excluded.requested_at)
     RETURNING requested_at`,
  )
    .bind(storeId, store.granted_at, at)
    .first<{ requested_at: string }>();
  if (!request) return "invalid";

  if (options.reimport) {
    // La lettura richiesta prosegue l'importazione in corso.
    if (store.started && !store.history_done_at) return "importing";
    await env.DB.prepare(
      `UPDATE sync_state SET history_from = ${historyStartSql(storeWorkspaceSql("?1"), "?3")},
              history_until = ?3, history_through = NULL, history_done_at = NULL,
              history_next = NULL, history_total = NULL, updated_at = ?3
        WHERE store_id = ?1 AND history_done_at IS NOT NULL AND ${writableStore}`,
    )
      .bind(storeId, store.granted_at, at)
      .run();
  }
  if (!store.calls) return "suspended";
  const apiOrigin = ebayConfiguration(env, store.ebay_environment).apiOrigin;
  if ((await rateLimitWait(env.DB, apiOrigin, now)) > 0) return "limited";
  if (request.requested_at !== at) return "merged";
  try {
    await env.WORK_QUEUE.send({ syncStore: storeId });
  } catch (error) {
    // La richiesta è già registrata: il cron la riprende alla prossima esecuzione.
    logFailure({ error, operation: "order_acquisition" });
  }
  return "queued";
}

/** Lettura rinviata: un negozio occupato riprova poco dopo, un limite di eBay a fine attesa. */
type Deferral = { delaySeconds: number; scope: "store" | "origin" };

/**
 * Esegue dalla coda una richiesta manuale, un webhook o un gruppo di turni accodato dal cron.
 * Una consegna ripetuta dopo la lettura trova il lavoro già servito e non chiama eBay; un
 * negozio occupato riprova poco dopo, un limite di eBay alla scadenza dell'attesa. Gli altri
 * errori restano fra gli ultimi aggiornamenti e il negozio passa il turno: la lettura riprende
 * con la cadenza del piano. In un gruppo i negozi rinviati tornano al cron, che non li accoda
 * prima della fine di un'attesa di eBay: il messaggio si chiude comunque.
 */
export async function consumeStoreSync(
  message: Message<unknown>,
  env: Env,
  fetcher: typeof fetch = fetch,
  now = new Date(),
): Promise<void> {
  const body = syncMessageSchema.parse(message.body);
  if ("syncStore" in body) {
    const deferral = await serveStore(body.syncStore, env, fetcher, now);
    if (deferral) message.retry({ delaySeconds: deferral.delaySeconds });
    else message.ack();
    return;
  }
  // In sequenza: un limite di eBay ferma anche i negozi che seguono.
  for (const [index, storeId] of body.syncStores.entries()) {
    const deferral = await serveStore(storeId, env, fetcher, now);
    if (!deferral) continue;
    // Stryker disable next-line MethodExpression: i negozi precedenti hanno già chiuso il turno, quindi liberare l'intero gruppo dà lo stesso esito.
    const released = deferral.scope === "origin" ? body.syncStores.slice(index) : [storeId];
    await env.DB.prepare(
      `UPDATE sync_state SET dispatched_at = NULL
        WHERE store_id IN (SELECT value FROM json_each(?1)) AND dispatched_at <= ?2`,
    )
      .bind(JSON.stringify(released), now.toISOString())
      .run();
    if (deferral.scope === "origin") break;
  }
  message.ack();
}

/** Legge un negozio dovuto e chiude il suo turno; restituisce il rinvio se la lettura attende. */
async function serveStore(
  storeId: string,
  env: Env,
  fetcher: typeof fetch,
  now: Date,
): Promise<Deferral | null> {
  const at = now.toISOString();
  const store = await env.DB.prepare(
    `SELECT c.store_id, c.access_token, c.granted_at, s.ebay_environment
       FROM ebay_store_credentials c
       JOIN ebay_stores s ON s.id = c.store_id
       JOIN sync_state ss ON ss.store_id = c.store_id
      WHERE c.store_id = ?1 AND (ss.requested_at IS NOT NULL OR ss.dispatched_at IS NOT NULL)
        AND ${activeStore("c", "s")} AND c.access_expires_at > ?2
        AND ${servedSql("s.workspace_id", "?3")} AND ${switchOnSql("ebay_calls")}`,
  )
    .bind(storeId, new Date(now.getTime() + tokenMarginMilliseconds).toISOString(), at)
    .first<ActiveStore>();
  // Lavoro già servito o negozio non più attivo. Con il token in rinnovo o le chiamate eBay
  // spente la richiesta resta in D1 e il cron la riaccoda.
  if (store) {
    try {
      const wait = await rateLimitWait(
        env.DB,
        ebayConfiguration(env, store.ebay_environment).apiOrigin,
        now,
      );
      // Attesa già nota: nessuna chiamata e nessun errore da registrare.
      if (wait > 0) return { delaySeconds: Math.min(maxRetryDelaySeconds, wait), scope: "origin" };
      const result = await acquireOrders({
        db: env.DB,
        storeId: store.store_id,
        grantedAt: store.granted_at,
        access: await storeAccess(env, store, fetcher, now),
        now,
        budget: { ...storeBudget },
      });
      if (result === "busy")
        // Stryker disable next-line StringLiteral: lo scopo conta soltanto nel confronto con «origin».
        return { delaySeconds: 60, scope: "store" };
      // Le notifiche dello spazio partono appena la lettura ha scritto gli ordini; il compito
      // periodico riprende quelle rimaste.
      await deliverTelegram(env, fetcher, now, { storeId: store.store_id }).catch(
        (error: unknown) => logFailure({ error, operation: "telegram" }),
      );
    } catch (error) {
      logFailure({ error, operation: "order_acquisition" });
      if (error instanceof UpstreamError && error.failure === "rate_limited")
        return {
          delaySeconds: Math.min(
            maxRetryDelaySeconds,
            error.details.retryAfter ?? defaultRateLimitSeconds,
          ),
          scope: "origin",
        };
      // Anche un tentativo fallito prima di iniziare, per esempio con un token che non si
      // apre, passa il turno e serve la richiesta: altrimenti il negozio resterebbe sempre il
      // primo della coda.
      await env.DB.prepare(
        `UPDATE sync_state SET polled_at = ?3, updated_at = ?3,
                requested_at = CASE WHEN requested_at <= ?3 THEN NULL ELSE requested_at END
          WHERE store_id = ?1 AND ${writableStore}`,
      )
        .bind(store.store_id, store.granted_at, at)
        .run();
    }
  }
  // Il turno accodato è chiuso: il cron può accodarne un altro quando il negozio è dovuto.
  await env.DB.prepare(
    "UPDATE sync_state SET dispatched_at = NULL WHERE store_id = ? AND dispatched_at <= ?",
  )
    .bind(storeId, at)
    .run();
  return null;
}

/**
 * «Riprova» di un ordine la cui lettura fiscale non è riuscita: soltanto un ordine che l'utente
 * può consultare nell'ambiente, e soltanto se la lettura del negozio si può richiedere. Il
 * dettaglio Fulfillment torna da leggere; un ordine noto solo a Trading si rilegge con la
 * passata Trading del negozio.
 */
export async function requestOrderRead(
  env: Env,
  userId: string,
  orderId: string,
  ebayEnvironment: EbayEnvironment,
  now = new Date(),
): Promise<SyncRequestResult> {
  const state = await visibleOrderState(env.DB, userId, ebayEnvironment, orderId, now);
  if (!state) return "not_found";
  if (state.fiscalState !== "error") return "invalid";
  const order = { id: orderId, storeId: state.storeId };
  const requested = await requestStoreSync(env, userId, order.storeId, {}, now);
  if (requested === "not_found" || requested === "invalid") return requested;
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE order_source_refs SET detail_for = NULL, detail_attempts = 0,
              detail_retry_at = NULL, detail_error = NULL
        WHERE order_id = ?1 AND store_id = ?2 AND source = 'fulfillment'`,
    ).bind(order.id, order.storeId),
    env.DB.prepare(
      `UPDATE sync_state SET trading_cursor = NULL, trading_end = NULL, trading_page = NULL,
              trading_total = NULL
        WHERE store_id = ?2 AND history_from IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM order_source_refs
                           WHERE order_id = ?1 AND source = 'fulfillment')`,
    ).bind(order.id, order.storeId),
  ]);
  return requested;
}
