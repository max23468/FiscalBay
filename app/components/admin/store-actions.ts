/** Le azioni operative richiedono un negozio collegato con consenso valido e senza pause. */
export function storeActions(active: boolean, pauses: readonly string[], detailErrors: number) {
  const ready = active && pauses.length === 0;
  return { sync: ready, retryDetails: ready && detailErrors > 0 };
}
