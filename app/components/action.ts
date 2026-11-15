import { createContext, useContext, useEffect, useEffectEvent, useRef } from "react";
import { useFetcher } from "react-router";

import type { ActionResult } from "../view-models";

/** Funzione degli avvisi della shell, fornita da `AppShell`. */
export const NoticeContext = createContext<(message: string) => void>(() => {});

/**
 * Conferma breve di un'azione, annunciata anche ai lettori di schermo. Sparisce da sola: un
 * errore va invece mostrato accanto all'azione, finché non si riprova.
 */
export function useNotice() {
  return useContext(NoticeContext);
}

/**
 * Reazione a un nuovo esito del fetcher, una sola volta e a richiesta conclusa: una
 * rilettura della pagina o un nuovo rendering non ripropongono l'esito già gestito.
 */
export function useFetcherResult<T>(
  fetcher: { state: string; data: T | undefined },
  onResult: (result: T) => void,
) {
  const handled = useRef<T | undefined>(undefined);
  const handle = useEffectEvent(onResult);
  useEffect(() => {
    const result = fetcher.data;
    if (fetcher.state !== "idle" || result === undefined || handled.current === result) return;
    handled.current = result;
    handle(result);
  }, [fetcher.state, fetcher.data]);
}

/**
 * Azione sulla route corrente, o su quella indicata da `action`, distinta da `intent`: esito e
 * avviso li decide il server. L'anteprima risponde con una simulazione, le route reali
 * eseguono. `onResult` riceve ogni nuovo esito, dopo l'avviso. Con `inlineErrors` l'avviso
 * a tempo resta per gli esiti riusciti: un errore lo mostra il chiamante accanto all'azione.
 */
export function useAction(
  onResult?: (result: ActionResult) => void,
  action?: string,
  { inlineErrors = false }: { inlineErrors?: boolean } = {},
) {
  const notify = useNotice();
  const fetcher = useFetcher<ActionResult>();
  useFetcherResult(fetcher, (result) => {
    if (result.notice && (result.ok || !inlineErrors)) notify(result.notice);
    onResult?.(result);
  });
  return {
    run: (intent: string, fields: Record<string, string> = {}) =>
      void fetcher.submit({ ...fields, intent }, { method: "post", ...(action ? { action } : {}) }),
    pending: fetcher.state !== "idle",
    /** Ultimo esito, disponibile a richiesta conclusa. */
    result: fetcher.state === "idle" ? fetcher.data : undefined,
  };
}
