/** Pausa dopo l'ultimo evento `scroll` oltre la quale, senza `scrollend`, lo scorrimento è finito. */
export const scrollSettle = 250;

/**
 * Chiama `onEnd` quando lo scorrimento di `target` si ferma: con `scrollend` dove il browser lo
 * offre, altrimenti dopo una pausa senza eventi `scroll`. Restituisce la funzione che smette di
 * ascoltare.
 */
export function onScrollEnd(
  target: EventTarget,
  onEnd: () => void,
  supported = "onscrollend" in target,
): () => void {
  if (supported) {
    target.addEventListener("scrollend", onEnd);
    return () => target.removeEventListener("scrollend", onEnd);
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const scrolled = () => {
    clearTimeout(timer);
    timer = setTimeout(onEnd, scrollSettle);
  };
  target.addEventListener("scroll", scrolled, { passive: true });
  return () => {
    clearTimeout(timer);
    target.removeEventListener("scroll", scrolled);
  };
}
