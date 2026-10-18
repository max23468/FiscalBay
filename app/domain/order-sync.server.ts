import { z } from "zod";

import {
  acquireOrders,
  historyDays,
  storeAccess,
  type ActiveStore,
} from "./order-acquisition.server";
import { defaultRateLimitSeconds, rateLimitWait } from "./order-acquisition-context.server";
import { writableStore } from "./order-import.server";
import { logFailure } from "../errors";
import { UpstreamError } from "../integrations/http.server";
import { ebayConfiguration } from "../integrations/ebay/environment.server";

/**
 * Lettura periodica dei negozi e richieste manuali. Il cron parte ogni dieci minuti, sceglie i
 * negozi dovuti e ne accoda la lettura; «Sincronizza» e «Reimporta» la accodano subito. Ogni
 * messaggio porta soltanto il riferimento al negozio e il consumer legge un negozio per
 * invocazione. La richiesta resta in D1 finché una lettura partita dopo non la serve: richieste
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
// Negozi valutati e accodati per esecuzione del cron, dai letti meno di recente: è anche il
// massimo di messaggi di un invio a gruppi della coda.
const dispatchLimit = 100;
// Un turno accodato senza esito entro questo tempo si considera perso e si ripropone.
const dispatchStaleMilliseconds = 60 * 60_000;
const tokenMarginMilliseconds = 5 * 60_000;
const dayMilliseconds = 86_400_000;

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
};

/**
 * Smistamento periodico: sceglie in ordine di priorità i negozi attivi con un token valido e
 * ne accoda la lettura, che il consumer esegue con il budget di un negozio. Il claim in D1
 * precede l'invio: trigger ripetuti o sovrapposti non accodano due volte lo stesso negozio,
 * mentre un turno accodato e mai servito si ripropone dopo `dispatchStaleMilliseconds`. I
 * negozi di un'origine API in attesa per un limite di eBay non si accodano.
 */
export async function dispatchStoreSyncs(environment: Env, now = new Date()): Promise<string[]> {
  const at = now.toISOString();
  const stale = new Date(now.getTime() - dispatchStaleMilliseconds).toISOString();
  const [{ results: rows }, { results: limits }] = await environment.DB.batch<
    CandidateRow | { api_origin: string }
  >([
    environment.DB.prepare(
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
                    AND (r.detail_retry_at IS NULL OR r.detail_retry_at <= ?1)))) AS backlog
         FROM ebay_store_credentials c
         JOIN ebay_stores s ON s.id = c.store_id
         LEFT JOIN sync_state ss ON ss.store_id = c.store_id
        WHERE c.rejected_at IS NULL AND c.access_expires_at > ?2 AND s.disconnected_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM ebay_store_pauses p WHERE p.store_id = c.store_id)
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
    environment.DB.prepare(
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
      apiOrigin: apiOriginOf(environment, row.ebay_environment),
      // Finché non esistono gli abbonamenti ogni spazio usa il piano Free.
      plan: "free" as SyncPlan,
      polledAt: row.polled_at,
      requestedAt: row.requested_at,
      backlog: row.backlog === 1,
    })),
    now,
  ).filter((store) => !limited.has(store.apiOrigin));
  if (selected.length === 0) return [];

  const claims = await environment.DB.batch<{ store_id: string }>(
    selected.map((store) =>
      environment.DB.prepare(
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
  try {
    await environment.WEBHOOK_QUEUE.sendBatch(
      claimed.map((storeId) => ({ body: { syncStore: storeId } })),
    );
  } catch (error) {
    // Il turno torna libero e il prossimo trigger lo riprova.
    await environment.DB.prepare(
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
function apiOriginOf(environment: Env, ebayEnvironment: ActiveStore["ebay_environment"]) {
  let origin: string | undefined;
  try {
    origin = ebayConfiguration(environment, ebayEnvironment).apiOrigin;
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
  | "not_found"
  /** Negozio scollegato, in pausa o da ricollegare. */
  | "invalid";

const syncMessageSchema = z.object({ syncStore: z.string().min(1).max(64) });

export function isSyncMessage(body: unknown): body is z.infer<typeof syncMessageSchema> {
  return syncMessageSchema.safeParse(body).success;
}

/**
 * «Sincronizza» o «Reimporta» dalla schermata Negozi, solo su un negozio attivo dello spazio
 * dell'utente. La reimportazione riparte dalla finestra dello storico del piano soltanto quando
 * l'importazione precedente è conclusa; poi entrambe chiedono una lettura del negozio.
 */
export async function requestStoreSync(
  environment: Env,
  userId: string,
  storeId: string,
  options: { reimport?: boolean } = {},
  now = new Date(),
): Promise<SyncRequestResult> {
  const at = now.toISOString();
  const store = await environment.DB.prepare(
    `SELECT c.granted_at, s.ebay_environment, ss.store_id AS started, ss.history_done_at
       FROM ebay_stores s
       JOIN workspace_members wm ON wm.workspace_id = s.workspace_id
       LEFT JOIN ebay_store_credentials c
         ON c.store_id = s.id AND c.rejected_at IS NULL AND c.refresh_expires_at > ?3
       LEFT JOIN sync_state ss ON ss.store_id = s.id
      WHERE wm.user_id = ?1 AND s.id = ?2 AND s.data_deleted_at IS NULL`,
  )
    .bind(userId, storeId, at)
    .first<{
      granted_at: string | null;
      ebay_environment: ActiveStore["ebay_environment"];
      started: string | null;
      history_done_at: string | null;
    }>();
  if (!store) return "not_found";

  // Registrata soltanto con un consenso valido e senza pausa.
  const request = await environment.DB.prepare(
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
    await environment.DB.prepare(
      `UPDATE sync_state SET history_from = ?4, history_until = ?3, history_done_at = NULL,
              history_next = NULL, history_total = NULL, updated_at = ?3
        WHERE store_id = ?1 AND history_done_at IS NOT NULL AND ${writableStore}`,
    )
      .bind(
        storeId,
        store.granted_at,
        at,
        new Date(now.getTime() - historyDays * dayMilliseconds).toISOString(),
      )
      .run();
  }
  const apiOrigin = ebayConfiguration(environment, store.ebay_environment).apiOrigin;
  if ((await rateLimitWait(environment.DB, apiOrigin, now)) > 0) return "limited";
  if (request.requested_at !== at) return "merged";
  try {
    await environment.WEBHOOK_QUEUE.send({ syncStore: storeId });
  } catch (error) {
    // La richiesta è già registrata: il cron la riprende alla prossima esecuzione.
    logFailure({ error, operation: "order_acquisition" });
  }
  return "queued";
}

/**
 * Esegue dalla coda una richiesta manuale o un turno accodato dal cron. Una consegna ripetuta
 * dopo la lettura trova il lavoro già servito e non chiama eBay; un negozio occupato riprova
 * poco dopo, un limite di eBay alla scadenza dell'attesa. Gli altri errori restano fra gli
 * ultimi aggiornamenti e il negozio passa il turno: la lettura riprende con la cadenza del piano.
 */
export async function consumeStoreSync(
  message: Message<unknown>,
  environment: Env,
  fetcher: typeof fetch = fetch,
  now = new Date(),
): Promise<void> {
  const { syncStore } = syncMessageSchema.parse(message.body);
  const at = now.toISOString();
  const store = await environment.DB.prepare(
    `SELECT c.store_id, c.access_token, c.granted_at, s.ebay_environment
       FROM ebay_store_credentials c
       JOIN ebay_stores s ON s.id = c.store_id
       JOIN sync_state ss ON ss.store_id = c.store_id
      WHERE c.store_id = ?1 AND (ss.requested_at IS NOT NULL OR ss.dispatched_at IS NOT NULL)
        AND c.rejected_at IS NULL AND c.access_expires_at > ?2 AND s.disconnected_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM ebay_store_pauses p WHERE p.store_id = c.store_id)`,
  )
    .bind(syncStore, new Date(now.getTime() + tokenMarginMilliseconds).toISOString())
    .first<ActiveStore>();
  // Lavoro già servito o negozio non più attivo. Con il token in rinnovo la richiesta resta in
  // D1 e il cron la riaccoda.
  if (store) {
    try {
      const wait = await rateLimitWait(
        environment.DB,
        ebayConfiguration(environment, store.ebay_environment).apiOrigin,
        now,
      );
      // Attesa già nota: nessuna chiamata e nessun errore da registrare.
      if (wait > 0) {
        message.retry({ delaySeconds: Math.min(maxRetryDelaySeconds, wait) });
        return;
      }
      const result = await acquireOrders({
        db: environment.DB,
        storeId: store.store_id,
        grantedAt: store.granted_at,
        access: await storeAccess(environment, store, fetcher, now),
        now,
        budget: { ...storeBudget },
      });
      if (result === "busy") {
        message.retry({ delaySeconds: 60 });
        return;
      }
    } catch (error) {
      logFailure({ error, operation: "order_acquisition" });
      if (error instanceof UpstreamError && error.failure === "rate_limited") {
        message.retry({
          delaySeconds: Math.min(
            maxRetryDelaySeconds,
            error.details.retryAfter ?? defaultRateLimitSeconds,
          ),
        });
        return;
      }
      // Anche un tentativo fallito prima di iniziare, per esempio con un token che non si
      // apre, passa il turno e serve la richiesta: altrimenti il negozio resterebbe sempre il
      // primo della coda.
      await environment.DB.prepare(
        `UPDATE sync_state SET polled_at = ?3, updated_at = ?3,
                requested_at = CASE WHEN requested_at <= ?3 THEN NULL ELSE requested_at END
          WHERE store_id = ?1 AND ${writableStore}`,
      )
        .bind(store.store_id, store.granted_at, at)
        .run();
    }
  }
  // Il turno accodato è chiuso: il cron può accodarne un altro quando il negozio è dovuto.
  await environment.DB.prepare(
    "UPDATE sync_state SET dispatched_at = NULL WHERE store_id = ? AND dispatched_at <= ?",
  )
    .bind(syncStore, at)
    .run();
  message.ack();
}
