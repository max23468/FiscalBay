import { AsyncLocalStorage } from "node:async_hooks";
import { env as platformEnv, waitUntil as platformWaitUntil, withEnv } from "cloudflare:workers";

type Activity = { pending: Promise<unknown>[]; enter: () => Promise<void> };
const activity = new AsyncLocalStorage<Activity>();
const databases = new WeakMap<D1Database, D1Database>();

class ServiceFrozen extends Error {}

/** Il lavoro dopo la risposta appartiene ancora all'operazione che lo ha avviato. */
export function waitUntil(promise: Promise<unknown>) {
  activity.getStore()?.pending.push(promise);
  platformWaitUntil(promise);
}

/**
 * Registra l'ingresso insieme al controllo del blocco, in una sola istruzione D1. Il rilascio
 * attende anche le operazioni in background; nessuna scadenza presume concluso un lavoro.
 */
async function activityScope<T>(
  db: D1Database,
  run: (enter: () => Promise<void>) => Promise<T>,
  blocked: () => T | Promise<T>,
): Promise<T> {
  const id = crypto.randomUUID();
  let entering: Promise<void> | undefined;
  let registered = false;
  let refused = false;
  const enter = () =>
    (entering ??= (async () => {
      const result = await db
        .prepare(`INSERT INTO service_activity (id, started_at)
        SELECT ?1, ?2 WHERE NOT EXISTS (
          SELECT 1 FROM service_settings WHERE name = 'recovery_frozen' AND value = 'true')`)
        .bind(id, new Date().toISOString())
        .run();
      if (!result.meta.changes) {
        refused = true;
        throw new ServiceFrozen();
      }
      registered = true;
    })());
  const pending: Promise<unknown>[] = [];
  return activity.run({ pending, enter }, async () => {
    try {
      const value = await run(enter);
      return refused ? blocked() : value;
    } catch (error) {
      if (error instanceof ServiceFrozen) return blocked();
      throw error;
    } finally {
      const finish = async () => {
        // Anche un'attività in background può avviarne un'altra.
        while (pending.length) await Promise.allSettled(pending.splice(0));
        if (registered)
          await db.prepare("DELETE FROM service_activity WHERE id = ?").bind(id).run();
      };
      if (pending.length) platformWaitUntil(finish());
      else await finish();
    }
  });
}

export function duringServiceActivity<T>(
  db: D1Database,
  run: () => Promise<T>,
  blocked: () => T | Promise<T>,
) {
  return activityScope(
    db,
    async (enter) => {
      await enter();
      return run();
    },
    blocked,
  );
}

/** Registra le richieste soltanto al primo accesso D1, dopo i filtri nativi senza I/O. */
export function duringRequestActivity<T>(
  env: Env,
  run: (target: Env) => Promise<T>,
  blocked: () => T | Promise<T>,
) {
  return activityScope(
    env.DB,
    async () => {
      const target = { ...env, DB: guardedDatabase(env.DB) };
      let result!: Promise<T>;
      withEnv({ ...platformEnv, DB: target.DB }, () => {
        return (result = run(target));
      });
      return result;
    },
    blocked,
  );
}

/** Mantiene il binding nativo e le sue istruzioni; il contesto appartiene alla richiesta. */
function guardedDatabase(db: D1Database): D1Database {
  const cached = databases.get(db);
  if (cached) return cached;
  const originals = new WeakMap<D1PreparedStatement, D1PreparedStatement>();
  const enter = () => activity.getStore()?.enter() ?? Promise.resolve();
  const statement = (original: D1PreparedStatement): D1PreparedStatement => {
    const wrapped = new Proxy(original, {
      get(target, property) {
        if (property === "bind") return (...values: unknown[]) => statement(target.bind(...values));
        const value: unknown = Reflect.get(target, property, target);
        if (typeof value !== "function") return value;
        return async (...args: unknown[]) => {
          await enter();
          return (value as (...values: unknown[]) => unknown).apply(target, args);
        };
      },
    });
    originals.set(wrapped, original);
    return wrapped;
  };
  const wrapped = new Proxy(db, {
    get(target, property) {
      if (property === "prepare") return (sql: string) => statement(target.prepare(sql));
      if (property === "batch")
        return async (queries: D1PreparedStatement[]) => {
          await enter();
          return target.batch(queries.map((query) => originals.get(query) ?? query));
        };
      if (property === "exec")
        return async (sql: string) => {
          await enter();
          return target.exec(sql);
        };
      const value: unknown = Reflect.get(target, property, target);
      if (typeof value !== "function") return value;
      // Nuovi percorsi D1, come le sessioni, richiedono la stessa protezione prima dell'adozione.
      return () => {
        throw new Error("Metodo D1 non qualificato per la sospensione.");
      };
    },
  });
  databases.set(db, wrapped);
  return wrapped;
}
