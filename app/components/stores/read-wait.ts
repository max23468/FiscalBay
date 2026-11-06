import { useEffect, useEffectEvent } from "react";
import { useRevalidator } from "react-router";

import type { StoreView } from "../../view-models";

/** Intervallo fra due riletture mentre una lettura dei negozi è in corso o in attesa. */
const readWaitMilliseconds = 4000;
/** Oltre questo tempo una lettura ferma non tiene più la pagina in rilettura. */
const readWaitLimitMilliseconds = 5 * 60_000;

/**
 * Nell'area reale, finché un negozio ha una lettura in corso o chiesta a mano, la pagina si
 * rilegge: ultima lettura e ultimi aggiornamenti mostrano l'esito senza ricaricare.
 */
export function useReadWait(stores: StoreView[]) {
  const revalidator = useRevalidator();
  const reading = stores.some((store) => store.syncing);
  const reload = useEffectEvent(() => {
    if (document.visibilityState === "visible" && revalidator.state === "idle")
      void revalidator.revalidate();
  });
  useEffect(() => {
    if (!reading) return;
    const timer = setInterval(reload, readWaitMilliseconds);
    const limit = setTimeout(() => clearInterval(timer), readWaitLimitMilliseconds);
    return () => {
      clearInterval(timer);
      clearTimeout(limit);
    };
  }, [reading]);
}
