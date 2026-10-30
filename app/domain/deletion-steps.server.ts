import { logFailure } from "../errors";
import { queueRetryDelay } from "./work-timing";

/**
 * Lavoro a passi delle cancellazioni, dell'account e chieste da eBay: ogni passo prende il
 * blocco della richiesta, elimina gli ordini entro un budget e restituisce «more» quando ne
 * restano, così la coda o il compito periodico lo ripetono.
 */

/** Durata del blocco di una richiesta in esecuzione: un consumer interrotto la cede allo scadere. */
const lockMilliseconds = 15 * 60_000;

/**
 * Termine del blocco preso all'istante `now`. Il valore scritto è anche il segno di chi tiene
 * il blocco: rilascio e proroga lo confrontano, così chi l'ha perso allo scadere non tocca
 * quello preso dopo da un altro consumer.
 */
export const lockUntil = (now: Date) => new Date(now.getTime() + lockMilliseconds).toISOString();

/** Ordini eliminati per istruzione e istruzioni per giro, poi il lavoro riparte dalla coda. */
export const orderBudget = { batch: 200, batches: 25 };

export type OrderBudget = typeof orderBudget;

/**
 * Ordini a lotti fra quelli scelti da `select`: le chiavi esterne eliminano articoli,
 * identificativi, versioni, verifiche, riferimenti e sblocchi. True quando non ne resta nessuno.
 */
export async function deleteOrders(
  db: D1Database,
  select: string,
  bindings: unknown[],
  budget: OrderBudget,
): Promise<boolean> {
  for (let batch = 0; batch < budget.batches; batch++) {
    const { meta } = await db
      .prepare(`DELETE FROM orders WHERE id IN (${select} LIMIT ${budget.batch})`)
      .bind(...bindings)
      .run();
    if (meta.changes === 0) return true;
  }
  return false;
}

/** Consegne riprovate dalla coda dopo un errore; poi la richiesta resta al compito periodico. */
const queueRetries = 3;

/**
 * Esegue un passo dalla coda. Con «more» il lavoro riparte con un nuovo messaggio; ogni altro
 * esito chiude la consegna. Un errore riprova con backoff per poche consegne, entro il limite
 * della coda, poi la richiesta passa al compito periodico.
 */
export async function consumeStepJob(
  message: Message<unknown>,
  run: () => Promise<string>,
  requeue: () => Promise<unknown>,
  operation: "account_deletion" | "ebay_account_deletion",
): Promise<void> {
  try {
    if ((await run()) === "more") await requeue();
    message.ack();
  } catch (error) {
    logFailure({ error, operation });
    if (message.attempts > queueRetries) message.ack();
    else message.retry({ delaySeconds: queueRetryDelay(message.attempts) });
  }
}

/** Richieste riprese per giro del compito periodico. */
export const resumeBatch = 10;

/** Ripete il passo nello stesso compito finché restano ordini oltre il budget. */
export async function runToEnd(run: () => Promise<string>): Promise<void> {
  // Stryker disable next-line ConditionalExpression: «more» ripetuto senza fine è un Timeout per Stryker; le prove contano gli ordini eliminati.
  while ((await run()) === "more");
}
