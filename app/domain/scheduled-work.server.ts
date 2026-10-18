import { z } from "zod";

import { purgeExpiredRecords } from "./maintenance.server";
import { dispatchStoreSyncs } from "./order-sync.server";
import { logFailure } from "../errors";
import { refreshExpiringTokens } from "../integrations/ebay/seller-credentials.server";
import { recoverWebhookIngress } from "../integrations/webhooks.server";

/**
 * Smistamento del lavoro pianificato. Un solo Cron Trigger per ambiente parte ogni dieci minuti
 * e, in base a `scheduledTime`, accoda il lavoro dovuto: compiti periodici, ricevute webhook
 * da riprendere e letture dei negozi. Il cron non chiama eBay: il consumer esegue un messaggio
 * per invocazione con il proprio budget.
 *
 * Un compito periodico ha un turno per periodo, registrato in D1 prima dell'invio: trigger
 * ripetuti o sovrapposti dello stesso periodo non lo accodano di nuovo, un trigger saltato
 * lascia il turno al successivo, e un turno accodato ma mai concluso (messaggio scaduto o
 * finito nella DLQ) si riaccoda dopo `staleMilliseconds`. Un periodo successivo assorbe quello
 * non concluso: i compiti lavorano su tutto ciò che è scaduto o in scadenza, non su una finestra.
 */

const minute = 60_000;
const staleMilliseconds = 60 * minute;
const leaseMilliseconds = 15 * minute;

const tasks = {
  // Sessioni, link, ricevute e altri dati tecnici scaduti: la pulizia fisica resta entro un
  // giorno dalla scadenza, mentre le letture rifiutano già i dati scaduti.
  maintenance: {
    period: 24 * 60 * minute,
    run: (environment: Env, _fetcher: typeof fetch, now: Date) =>
      purgeExpiredRecords(environment.DB, now),
  },
  // Rinnovo anticipato dei token di accesso dei negozi, prima che servano a una lettura.
  token_refresh: {
    period: 10 * minute,
    run: (environment: Env, fetcher: typeof fetch, now: Date) =>
      refreshExpiringTokens(environment, fetcher, now),
  },
} satisfies Record<
  string,
  { period: number; run: (environment: Env, fetcher: typeof fetch, now: Date) => Promise<unknown> }
>;

export type ScheduledTask = keyof typeof tasks;

const taskMessageSchema = z.object({
  task: z.enum(Object.keys(tasks) as [ScheduledTask, ...ScheduledTask[]]),
  slot: z.iso.datetime(),
});

export function isTaskMessage(body: unknown): body is z.infer<typeof taskMessageSchema> {
  return taskMessageSchema.safeParse(body).success;
}

/** Inizio del periodo del compito che contiene l'istante. */
export function taskSlot(task: ScheduledTask, at: Date): string {
  const { period } = tasks[task];
  return new Date(Math.floor(at.getTime() / period) * period).toISOString();
}

/** Registra e accoda i compiti il cui turno è libero; restituisce quelli accodati. */
export async function dispatchTasks(environment: Env, now: Date): Promise<ScheduledTask[]> {
  const at = now.toISOString();
  const stale = new Date(now.getTime() - staleMilliseconds).toISOString();
  const names = Object.keys(tasks) as ScheduledTask[];
  const claims = await environment.DB.batch<{ task: ScheduledTask; slot: string }>(
    names.map((task) =>
      environment.DB.prepare(
        `INSERT INTO scheduled_tasks (task, slot, queued_at) VALUES (?1, ?2, ?3)
         ON CONFLICT(task) DO UPDATE SET slot = excluded.slot, queued_at = excluded.queued_at,
                                         done_at = NULL, lease = NULL, locked_until = NULL
         WHERE (scheduled_tasks.locked_until IS NULL OR scheduled_tasks.locked_until <= ?3)
           AND (scheduled_tasks.slot < excluded.slot
            OR (scheduled_tasks.slot = excluded.slot AND scheduled_tasks.done_at IS NULL
                AND (scheduled_tasks.queued_at IS NULL OR scheduled_tasks.queued_at <= ?4)))
         RETURNING task, slot`,
      ).bind(task, taskSlot(task, now), at, stale),
    ),
  );
  const claimed = claims.flatMap(({ results }) => results);
  if (claimed.length === 0) return [];
  try {
    await environment.WEBHOOK_QUEUE.sendBatch(claimed.map((body) => ({ body })));
  } catch (error) {
    // Il turno resta da accodare: lo riprende il prossimo trigger dello stesso periodo.
    await environment.DB.batch(
      claimed.map(({ task, slot }) =>
        environment.DB.prepare(
          "UPDATE scheduled_tasks SET queued_at = NULL WHERE task = ? AND slot = ? AND queued_at = ?",
        ).bind(task, slot, at),
      ),
    );
    throw error;
  }
  return claimed.map(({ task }) => task);
}

/**
 * Esegue un compito dalla coda. Una consegna ripetuta dopo la conclusione, o di un turno già
 * superato da un periodo successivo, non ripete il lavoro; un errore riprova con backoff.
 */
export async function consumeTask(
  message: Message<unknown>,
  environment: Env,
  fetcher: typeof fetch = fetch,
  now = new Date(),
): Promise<void> {
  const { task, slot } = taskMessageSchema.parse(message.body);
  const at = now.toISOString();
  const lease = crypto.randomUUID();
  const pending = await environment.DB.prepare(
    `UPDATE scheduled_tasks SET lease = ?3, locked_until = ?4
      WHERE task = ?1 AND slot = ?2 AND done_at IS NULL
        AND (locked_until IS NULL OR locked_until <= ?5) RETURNING task`,
  )
    .bind(task, slot, lease, new Date(now.getTime() + leaseMilliseconds).toISOString(), at)
    .first();
  if (!pending) {
    const busy = await environment.DB.prepare(
      "SELECT 1 FROM scheduled_tasks WHERE task = ? AND slot = ? AND done_at IS NULL",
    )
      .bind(task, slot)
      .first();
    if (busy) message.retry({ delaySeconds: 60 });
    else message.ack();
    return;
  }
  try {
    await tasks[task].run(environment, fetcher, now);
    await environment.DB.prepare(
      `UPDATE scheduled_tasks SET done_at = ?, lease = NULL, locked_until = NULL
        WHERE task = ? AND slot = ? AND lease = ? AND done_at IS NULL`,
    )
      .bind(at, task, slot, lease)
      .run();
    message.ack();
  } catch (error) {
    await environment.DB.prepare(
      "UPDATE scheduled_tasks SET lease = NULL, locked_until = NULL WHERE task = ? AND slot = ? AND lease = ?",
    )
      .bind(task, slot, lease)
      .run();
    logFailure({ error, operation: task });
    message.retry({ delaySeconds: Math.min(3600, 30 * 2 ** (message.attempts - 1)) });
  }
}

/**
 * Lavoro del Cron Trigger. Ogni passo accoda soltanto: un passo fallito non ferma i successivi
 * e il suo lavoro resta al trigger seguente.
 */
export async function dispatchScheduledWork(environment: Env, now: Date): Promise<void> {
  await dispatchTasks(environment, now).catch((error: unknown) =>
    logFailure({ error, operation: "scheduling" }),
  );
  await recoverWebhookIngress(environment, now).catch(() =>
    logFailure({ operation: "webhook_ingress" }),
  );
  await dispatchStoreSyncs(environment, now).catch((error: unknown) =>
    logFailure({ error, operation: "scheduling" }),
  );
}
