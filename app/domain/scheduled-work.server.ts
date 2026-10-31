import { z } from "zod";

import { resumeAccountDeletions } from "./account-deletion.server";
import { resumeEbayAccountDeletions } from "./ebay-account-deletion.server";
import { applyInactivity } from "./admission.server";
import { reconcileBilling } from "./billing.server";
import { purgeExportFiles } from "./export-files.server";
import { resumeExportJobs } from "./export-jobs.server";
import { readEbayQuotas } from "./ebay-quotas.server";
import { applyFreePlans } from "./free-store.server";
import { indexOrderSearch, purgeExpiredRecords } from "./maintenance.server";
import { dispatchStoreSyncs } from "./order-sync.server";
import { configureOwnerCommands } from "./owner-control.server";
import { reconcileOwnerIncidents } from "./owner-incidents.server";
import { runOwnerNotifications } from "./owner-notifications.server";
import { configureBotCommands } from "./telegram-bot.server";
import { deliverTelegram } from "./telegram-deliveries.server";
import { logFailure } from "../errors";
import { refreshExpiringTokens } from "./token-refresh.server";
import { sendReconnectNotices } from "./reconnect-notices.server";
import { recoverWebhookIngress } from "../webhooks.server";
import { minute, queueRetryDelay, taskPeriods, type ScheduledTask } from "./work-timing";

export type { ScheduledTask };

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

const staleMilliseconds = 60 * minute;
const leaseMilliseconds = 15 * minute;

const tasks = {
  // Sessioni, link, ricevute e altri dati tecnici scaduti: la pulizia fisica resta entro un
  // giorno dalla scadenza, mentre le letture rifiutano già i dati scaduti. Poi il testo
  // cercabile degli ordini che non l'hanno ancora.
  maintenance: {
    period: taskPeriods.maintenance,
    run: async (env: Env, _fetcher: typeof fetch, now: Date) => {
      await purgeExpiredRecords(env.DB, now);
      await indexOrderSearch(env.DB);
    },
  },
  // Lavori di esportazione rimasti senza messaggio, ripresi o chiusi come non riusciti; poi i
  // file scaduti o revocati: il download li rifiuta già, la pulizia ne elimina i byte entro
  // un'ora dalla scadenza.
  export_files: {
    period: taskPeriods.export_files,
    run: async (env: Env, _fetcher: typeof fetch, now: Date) => {
      await resumeExportJobs(env, now);
      await purgeExportFiles(env, now);
    },
  },
  // Rinnovo anticipato dei token di accesso dei negozi, prima che servano a una lettura; poi
  // l'email dei negozi da ricollegare, compresi quelli il cui rinnovo è appena stato rifiutato.
  token_refresh: {
    period: taskPeriods.token_refresh,
    run: async (env: Env, fetcher: typeof fetch, now: Date) => {
      await refreshExpiringTokens(env, fetcher, now);
      await sendReconnectNotices(env, now);
    },
  },
  // Preavvisi e pause per inattività del Free, ammissione di chi era in lista d'attesa.
  inactivity: {
    period: taskPeriods.inactivity,
    run: (env: Env, _fetcher: typeof fetch, now: Date) => applyInactivity(env, now),
  },
  // Riconciliazione degli abbonamenti con Stripe, per i webhook mancati o tardivi.
  billing: {
    period: taskPeriods.billing,
    run: (env: Env, fetcher: typeof fetch, now: Date) => reconcileBilling(env, fetcher, now),
  },
  // Notifiche Telegram: valutazione degli ordini, riepiloghi dovuti, importazioni completate e
  // invii in attesa o da ritentare. La lettura di un negozio le anticipa per il suo spazio.
  telegram: {
    period: taskPeriods.telegram,
    run: (env: Env, fetcher: typeof fetch, now: Date) => deliverTelegram(env, fetcher, now),
  },
  // Menu dei comandi del bot, dei venditori e della chat dell'owner, riallineati ogni giorno:
  // ripeterlo non cambia nulla. I due menu sono indipendenti: un errore dell'uno non lascia
  // indietro l'altro e fa ripetere il compito.
  telegram_commands: {
    period: taskPeriods.telegram_commands,
    run: async (env: Env, fetcher: typeof fetch) => {
      const [sellers, owner] = await Promise.allSettled([
        configureBotCommands(env, fetcher),
        configureOwnerCommands(env, fetcher),
      ]);
      for (const result of [sellers, owner]) if (result.status === "rejected") throw result.reason;
    },
  },
  // Quote delle API eBay rilette ogni ora, come alla visita della console: l'anomalia oltre la
  // soglia si apre e si chiude anche senza visite.
  ebay_quotas: {
    period: taskPeriods.ebay_quotas,
    run: (env: Env, fetcher: typeof fetch, now: Date) => readEbayQuotas(env, fetcher, now),
  },
  // Avvisi all'owner: apertura, aggravamento e rientro delle anomalie P1 e P2, poi gli avvisi
  // commerciali. Un errore degli uni non ferma gli altri e fa ripetere il compito.
  owner_incidents: {
    period: taskPeriods.owner_incidents,
    run: async (env: Env, fetcher: typeof fetch, now: Date) => {
      const [incidents, notifications] = await Promise.allSettled([
        reconcileOwnerIncidents(env, fetcher, now),
        runOwnerNotifications(env, fetcher, now),
      ]);
      for (const result of [incidents, notifications])
        if (result.status === "rejected") throw result.reason;
    },
  },
  // Cancellazioni da riprendere, dell'account e richieste da eBay: messaggio perso, rinnovi non
  // ancora fermati, email da ritentare o dati ricomparsi dopo un restore. Un errore di una parte
  // non ferma l'altra.
  account_deletion: {
    period: taskPeriods.account_deletion,
    run: async (env: Env, fetcher: typeof fetch, now: Date) => {
      const [account, ebay] = await Promise.allSettled([
        resumeAccountDeletions(env, fetcher, now),
        resumeEbayAccountDeletions(env, now),
      ]);
      for (const result of [account, ebay]) if (result.status === "rejected") throw result.reason;
    },
  },
} satisfies Record<
  ScheduledTask,
  { period: number; run: (env: Env, fetcher: typeof fetch, now: Date) => Promise<unknown> }
>;

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
export async function dispatchTasks(env: Env, now: Date): Promise<ScheduledTask[]> {
  const at = now.toISOString();
  const stale = new Date(now.getTime() - staleMilliseconds).toISOString();
  const names = Object.keys(tasks) as ScheduledTask[];
  const claims = await env.DB.batch<{ task: ScheduledTask; slot: string }>(
    names.map((task) =>
      env.DB.prepare(
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
    await env.WORK_QUEUE.sendBatch(claimed.map((body) => ({ body })));
  } catch (error) {
    // Il turno resta da accodare: lo riprende il prossimo trigger dello stesso periodo.
    await env.DB.batch(
      claimed.map(({ task, slot }) =>
        env.DB.prepare(
          "UPDATE scheduled_tasks SET queued_at = NULL WHERE task = ? AND slot = ? AND queued_at = ?",
        ).bind(task, slot, at),
      ),
    );
    throw error;
  }
  return claimed.map(({ task }) => task);
}

export function isScheduledTask(value: string): value is ScheduledTask {
  return Object.hasOwn(tasks, value);
}

/**
 * Riaccoda dalla console un compito non preso da un consumer, senza attendere l'ora di
 * `staleMilliseconds`: il turno non concluso si riaccoda, quello concluso di un periodo passato
 * cede il posto al turno corrente, come farebbe il cron. Il turno corrente già concluso o in
 * esecuzione resta com'è.
 */
export async function requeueTask(env: Env, task: ScheduledTask, now = new Date()) {
  const at = now.toISOString();
  const claimed = await env.DB.prepare(
    `INSERT INTO scheduled_tasks (task, slot, queued_at) VALUES (?1, ?2, ?3)
     ON CONFLICT(task) DO UPDATE SET
       slot = MAX(scheduled_tasks.slot, excluded.slot),
       done_at = CASE WHEN scheduled_tasks.slot < excluded.slot THEN NULL ELSE scheduled_tasks.done_at END,
       queued_at = excluded.queued_at, lease = NULL, locked_until = NULL
     WHERE (scheduled_tasks.done_at IS NULL OR scheduled_tasks.slot < excluded.slot)
       AND (scheduled_tasks.locked_until IS NULL OR scheduled_tasks.locked_until <= ?3)
     RETURNING task, slot`,
  )
    .bind(task, taskSlot(task, now), at)
    .first<{ task: ScheduledTask; slot: string }>();
  if (!claimed) return "busy";
  await env.WORK_QUEUE.send(claimed);
  return "queued";
}

/**
 * Esegue un compito dalla coda. Una consegna ripetuta dopo la conclusione, o di un turno già
 * superato da un periodo successivo, non ripete il lavoro; un errore riprova con backoff.
 */
export async function consumeTask(
  message: Message<unknown>,
  env: Env,
  fetcher: typeof fetch = fetch,
  now = new Date(),
): Promise<void> {
  const { task, slot } = taskMessageSchema.parse(message.body);
  const at = now.toISOString();
  const lease = crypto.randomUUID();
  const pending = await env.DB.prepare(
    `UPDATE scheduled_tasks SET lease = ?3, locked_until = ?4
      WHERE task = ?1 AND slot = ?2 AND done_at IS NULL
        AND (locked_until IS NULL OR locked_until <= ?5) RETURNING task`,
  )
    .bind(task, slot, lease, new Date(now.getTime() + leaseMilliseconds).toISOString(), at)
    .first();
  if (!pending) {
    const busy = await env.DB.prepare(
      "SELECT 1 FROM scheduled_tasks WHERE task = ? AND slot = ? AND done_at IS NULL",
    )
      .bind(task, slot)
      .first();
    if (busy) message.retry({ delaySeconds: 60 });
    else message.ack();
    return;
  }
  try {
    await tasks[task].run(env, fetcher, now);
    await env.DB.prepare(
      `UPDATE scheduled_tasks SET done_at = ?, lease = NULL, locked_until = NULL
        WHERE task = ? AND slot = ? AND lease = ? AND done_at IS NULL`,
    )
      .bind(at, task, slot, lease)
      .run();
    message.ack();
  } catch (error) {
    // Una pulizia non riuscita lascia scadere il blocco: l'errore resta quello del compito.
    await env.DB.prepare(
      "UPDATE scheduled_tasks SET lease = NULL, locked_until = NULL WHERE task = ? AND slot = ? AND lease = ?",
    )
      .bind(task, slot, lease)
      .run()
      .catch((cleanup: unknown) => logFailure({ error: cleanup, operation: task }));
    logFailure({ error, operation: task });
    message.retry({ delaySeconds: queueRetryDelay(message.attempts) });
  }
}

/**
 * Lavoro del Cron Trigger. Ogni passo accoda soltanto, salvo il riallineamento del piano, che
 * resta su D1 e precede le letture: un negozio uscito dal piano non viene più smistato. Un
 * passo fallito non ferma i successivi e il suo lavoro resta al trigger seguente.
 */
export async function dispatchScheduledWork(env: Env, now: Date): Promise<void> {
  await dispatchTasks(env, now).catch((error: unknown) =>
    logFailure({ error, operation: "scheduling" }),
  );
  await recoverWebhookIngress(env, now).catch((error: unknown) =>
    logFailure({ error, operation: "webhook_ingress" }),
  );
  await applyFreePlans(env.DB, now).catch((error: unknown) =>
    logFailure({ error, operation: "scheduling" }),
  );
  await dispatchStoreSyncs(env, now).catch((error: unknown) =>
    logFailure({ error, operation: "scheduling" }),
  );
}
