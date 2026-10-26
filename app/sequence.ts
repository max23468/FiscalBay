/**
 * Un passo alla volta, nell'ordine dato, con i risultati nello stesso ordine: ogni passo parte
 * alla fine del precedente e un errore ferma quelli successivi. Serve dove l'ordine conta o
 * dove un provider va chiamato una volta per volta.
 */
export function inSequence<T, R>(
  items: readonly T[],
  step: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  return items.reduce<Promise<R[]>>(
    (previous, item, index) =>
      previous.then(async (done) => {
        done.push(await step(item, index));
        return done;
      }),
    Promise.resolve([]),
  );
}
