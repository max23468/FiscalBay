import { AsyncLocalStorage } from "node:async_hooks";
import { waitUntil as platformWaitUntil } from "cloudflare:workers";

type Activity = { pending: Promise<unknown>[] };
const activity = new AsyncLocalStorage<Activity>();

/** Il lavoro dopo la risposta appartiene ancora all'operazione che lo ha avviato. */
export function waitUntil(promise: Promise<unknown>) {
  activity.getStore()?.pending.push(promise);
  platformWaitUntil(promise);
}

/**
 * Registra coda e cron insieme al controllo del blocco, in una sola istruzione D1. Il rilascio
 * attende anche le operazioni in background; nessuna scadenza presume concluso un lavoro. Le
 * richieste HTTP non si registrano: le ferma il segreto `SERVICE_FROZEN`.
 */
export async function duringServiceActivity<T>(
  db: D1Database,
  run: () => Promise<T>,
  blocked: () => T | Promise<T>,
): Promise<T> {
  const id = crypto.randomUUID();
  const entered = await db
    .prepare(`INSERT INTO service_activity (id, started_at)
      SELECT ?1, ?2 WHERE NOT EXISTS (
        SELECT 1 FROM service_settings WHERE name = 'recovery_frozen' AND value = 'true')`)
    .bind(id, new Date().toISOString())
    .run();
  if (!entered.meta.changes) return blocked();
  const pending: Promise<unknown>[] = [];
  return activity.run({ pending }, async () => {
    try {
      return await run();
    } finally {
      const finish = async () => {
        // Anche un'attività in background può avviarne un'altra.
        while (pending.length) await Promise.allSettled(pending.splice(0));
        await db.prepare("DELETE FROM service_activity WHERE id = ?").bind(id).run();
      };
      if (pending.length) platformWaitUntil(finish());
      else await finish();
    }
  });
}
