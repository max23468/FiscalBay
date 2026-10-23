import { useSyncExternalStore } from "react";

const subscribeNever = () => () => {};

/**
 * Pagina idratata: prima i controlli non reagirebbero al clic e i campi controllati
 * perderebbero il testo scritto, quindi restano inattivi.
 */
export function useHydrated() {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
}
