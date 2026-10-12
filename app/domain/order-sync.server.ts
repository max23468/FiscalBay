import { z } from "zod";

import {
  acquireOrders,
  defaultRateLimitSeconds,
  historyDays,
  rateLimitWait,
  storeAccess,
  type ActiveStore,
} from "./order-acquisition.server";
import { writableStore } from "./order-import.server";
import { logFailure } from "../errors";
import { UpstreamError } from "../integrations/http.server";
import { ebayConfiguration } from "../integrations/ebay/environment.server";

/**
 * Lettura periodica dei negozi e richieste manuali. Il cron parte ogni dieci minuti e sceglie
 * i negozi dovuti; «Sincronizza» e «Reimporta» passano dalla coda con un solo riferimento al
 * negozio. La richiesta resta in D1 finché una lettura partita dopo non la serve: richieste
 * ripetute confluiscono nella stessa e il cron riprende quelle che la coda non ha consegnato.
 * Gli eventi eBay seguono l'ingresso dei webhook e non dipendono dal piano.
 */

export type SyncPlan = "free" | "premium";

/** Cadenza della lettura dei recenti per piano, in minuti: obiettivo, non garanzia. */
export const syncMinutes: Record<SyncPlan, number> = { premium: 10, free: 30 };

// Il cron parte ogni dieci minuti; il margine assorbe un avvio in ritardo rispetto al turno.
const toleranceMilliseconds = 60_000;
/** Negozi letti da un'esecuzione del cron e budget di ciascuno. */
const storesPerRun = 3;
const storeBudget = { calls: 12, pages: 3 };
// Negozi valutati per esecuzione, dai letti meno di recente.
const candidateLimit = 100;
const tokenMarginMilliseconds = 5 * 60_000;
const dayMilliseconds = 86_400_000;

export type SyncCandidate = {
  plan: SyncPlan;
  polledAt: string | null;
  requestedAt: string | null;
  /** Storico, passata dei recenti o dettagli ancora da leggere. */
  backlog: boolean;
};

/**
 * Ordine della lettura periodica sotto carico: prima i negozi dovuti per cadenza o per una
 * richiesta manuale (Premium, poi Free), poi quelli con lavoro arretrato (Premium, poi Free).
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
 * Lavoro periodico: legge al massimo `storesPerRun` negozi attivi con un token valido, in
 * ordine di priorità. Un errore di un negozio non ferma gli altri; un limite di eBay ferma i
 * negozi della stessa origine API fino alla scadenza dell'attesa.
 */
export async function syncStores(
  environment: Env,
  fetcher: typeof fetch,
  now = new Date(),
): Promise<void> {
  const at = now.toISOString();
  const [{ results: rows }, { results: limits }] = await environment.DB.batch<
    CandidateRow | { api_origin: string }
  >([
    environment.DB.prepare(
      `SELECT c.store_id, c.access_token, c.granted_at, s.ebay_environment,
              ss.polled_at, ss.requested_at,
              (ss.history_done_at IS NULL OR ss.recent_next IS NOT NULL OR EXISTS (
                 SELECT 1 FROM order_source_refs r
                  WHERE r.store_id = c.store_id AND r.source = 'fulfillment'
                    AND r.detail_for IS NOT r.last_modified_time
                    AND (r.detail_retry_at IS NULL OR r.detail_retry_at <= ?1))) AS backlog
         FROM ebay_store_credentials c
         JOIN ebay_stores s ON s.id = c.store_id
         LEFT JOIN sync_state ss ON ss.store_id = c.store_id
        WHERE c.rejected_at IS NULL AND c.access_expires_at > ?2 AND s.disconnected_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM ebay_store_pauses p WHERE p.store_id = c.store_id)
          AND (ss.polled_at IS NULL OR ss.requested_at IS NOT NULL OR ss.polled_at <= ?3)
        ORDER BY ss.polled_at IS NOT NULL, ss.polled_at, c.store_id
        LIMIT ?4`,
    ).bind(
      at,
      new Date(now.getTime() + tokenMarginMilliseconds).toISOString(),
      // Nessun piano legge più spesso della cadenza più breve.
      new Date(
        now.getTime() - Math.min(...Object.values(syncMinutes)) * 60_000 + toleranceMilliseconds,
      ).toISOString(),
      candidateLimit,
    ),
    environment.DB.prepare("SELECT api_origin FROM ebay_rate_limits WHERE until > ?").bind(at),
  ]);
  // Origini API in attesa; un ambiente non configurato (null) non vi entra mai.
  const limited = new Set<string | null>(
    (limits as { api_origin: string }[]).map((row) => row.api_origin),
  );
  const candidates = (rows as CandidateRow[]).map((row) => {
    let apiOrigin: string | null = null;
    try {
      apiOrigin = ebayConfiguration(environment, row.ebay_environment).apiOrigin;
    } catch {
      // Ambiente non disponibile: il tentativo fallisce sotto e passa il turno.
    }
    return {
      ...row,
      apiOrigin,
      // Finché non esistono gli abbonamenti ogni spazio usa il piano Free.
      plan: "free" as SyncPlan,
      polledAt: row.polled_at,
      requestedAt: row.requested_at,
      backlog: row.backlog === 1,
    };
  });
  const selected = syncOrder(candidates, now)
    .filter((store) => !limited.has(store.apiOrigin))
    .slice(0, storesPerRun);

  const read = async (store: (typeof selected)[number]) => {
    // Un limite incontrato da un negozio precedente vale anche per questo.
    if (limited.has(store.apiOrigin)) return;
    try {
      await acquireOrders({
        db: environment.DB,
        storeId: store.store_id,
        grantedAt: store.granted_at,
        access: await storeAccess(environment, store, fetcher),
        now,
        budget: { ...storeBudget },
      });
    } catch (error) {
      logFailure({ error, operation: "order_acquisition" });
      if (error instanceof UpstreamError && error.failure === "rate_limited") {
        limited.add(store.apiOrigin);
        return;
      }
      // Anche un tentativo fallito prima di iniziare, per esempio con un token che non si
      // apre, passa il turno: altrimenti il negozio resterebbe sempre il primo della coda.
      await environment.DB.prepare(
        `INSERT INTO sync_state (store_id, polled_at, updated_at)
         SELECT ?1, ?3, ?3 WHERE ${writableStore}
         ON CONFLICT(store_id) DO UPDATE SET polled_at = excluded.polled_at,
                                             updated_at = excluded.updated_at`,
      )
        .bind(store.store_id, store.granted_at, at)
        .run();
    }
  };
  // In sequenza: le scritture di un negozio e i limiti di eBay non si sovrappongono.
  await selected.reduce<Promise<void>>(
    (previous, store) => previous.then(() => read(store)),
    Promise.resolve(),
  );
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
 * Esegue una richiesta manuale dalla coda. Una consegna ripetuta dopo la lettura trova la
 * richiesta già servita e non chiama eBay; un negozio occupato riprova poco dopo, un limite di
 * eBay alla scadenza dell'attesa. Gli altri errori restano fra gli ultimi aggiornamenti e la
 * lettura riprende con la cadenza del piano.
 */
export async function consumeStoreSync(
  message: Message<unknown>,
  environment: Env,
  fetcher: typeof fetch = fetch,
  now = new Date(),
): Promise<void> {
  const { syncStore } = syncMessageSchema.parse(message.body);
  const store = await environment.DB.prepare(
    `SELECT c.store_id, c.access_token, c.granted_at, s.ebay_environment
       FROM ebay_store_credentials c
       JOIN ebay_stores s ON s.id = c.store_id
       JOIN sync_state ss ON ss.store_id = c.store_id
      WHERE c.store_id = ?1 AND ss.requested_at IS NOT NULL AND c.rejected_at IS NULL
        AND c.access_expires_at > ?2 AND s.disconnected_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM ebay_store_pauses p WHERE p.store_id = c.store_id)`,
  )
    .bind(syncStore, new Date(now.getTime() + tokenMarginMilliseconds).toISOString())
    .first<ActiveStore>();
  // Richiesta già servita o negozio non più attivo. Con il token in rinnovo la richiesta
  // resta in D1 e la riprende il cron.
  if (!store) {
    message.ack();
    return;
  }
  try {
    const result = await acquireOrders({
      db: environment.DB,
      storeId: store.store_id,
      grantedAt: store.granted_at,
      access: await storeAccess(environment, store, fetcher),
      now,
      budget: { ...storeBudget },
    });
    if (result === "busy") message.retry({ delaySeconds: 60 });
    else message.ack();
  } catch (error) {
    logFailure({ error, operation: "order_acquisition" });
    if (error instanceof UpstreamError && error.failure === "rate_limited")
      message.retry({
        delaySeconds: Math.min(43_200, error.details.retryAfter ?? defaultRateLimitSeconds),
      });
    else message.ack();
  }
}
