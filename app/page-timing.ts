import { useEffect, useRef } from "react";

/** Pagine misurate e fasi del server lette da `Server-Timing`: elenchi chiusi. */
export const timedPages = ["orders", "stores"] as const;
export type TimedPage = (typeof timedPages)[number];
export const serverPhases = ["auth", "d1", "ebay"] as const;

export const pageTimingPath = "/api/v1/page-timing";

/** Durata massima accettata, in millisecondi: oltre non è una misura utile. */
export const maxTimingMs = 120_000;

// Un solo report per documento: le navigazioni successive non hanno un caricamento da misurare.
let reported = false;

/**
 * Il documento è stato caricato sulla pagina resa: il percorso dell'entry di navigazione è quello
 * attuale. Una pagina aperta nel client da un documento di un'altra pagina non ha un caricamento
 * proprio, e le misure del documento non sono sue.
 */
export function loadedHere(navigationName: string, pathname: string) {
  try {
    return new URL(navigationName).pathname === pathname;
  } catch {
    return false;
  }
}

/** Durata plausibile arrotondata al millisecondo; fuori limite o non finita resta assente. */
export function timingValue(value: number | undefined) {
  return value === undefined || !Number.isFinite(value) || value < 0 || value > maxTimingMs
    ? undefined
    : Math.round(value);
}

/**
 * Invia una volta, quando la pagina viene nascosta o lasciata o dopo dieci secondi, le misure del
 * caricamento in cui la pagina è stata resa, con il biglietto del suo loader. Senza biglietto,
 * come nell'anteprima, non parte nessun report.
 */
export function usePageTiming(page: TimedPage, ticket: string | undefined) {
  // Il biglietto conta soltanto al primo caricamento: le rivalidazioni non lo rinnovano.
  const firstTicket = useRef(ticket);
  useEffect(() => {
    const ticket = firstTicket.current;
    if (reported || !ticket) return;
    reported = true;
    const ready = performance.now();
    const [navigation] = performance.getEntriesByType(
      "navigation",
    ) as PerformanceNavigationTiming[];
    if (!navigation || typeof navigator.sendBeacon !== "function") return;
    if (!loadedHere(navigation.name, location.pathname)) return;
    let lcp: number | undefined;
    const observer = PerformanceObserver.supportedEntryTypes?.includes("largest-contentful-paint")
      ? new PerformanceObserver((list) => {
          lcp = list.getEntries().at(-1)?.startTime;
        })
      : null;
    observer?.observe({ type: "largest-contentful-paint", buffered: true });
    let sent = false;
    const send = () => {
      if (sent) return;
      sent = true;
      observer?.disconnect();
      const server = Object.fromEntries(
        (navigation.serverTiming ?? []).flatMap((entry) => {
          const value = timingValue(entry.duration);
          return (serverPhases as readonly string[]).includes(entry.name) && value !== undefined
            ? [[entry.name, value]]
            : [];
        }),
      );
      const ttfb = timingValue(navigation.responseStart);
      if (ttfb === undefined) return;
      navigator.sendBeacon(
        pageTimingPath,
        new Blob(
          [
            JSON.stringify({
              page,
              ttfb,
              fcp: timingValue(
                performance.getEntriesByName("first-contentful-paint")[0]?.startTime,
              ),
              lcp: timingValue(lcp),
              ready: timingValue(ready),
              server,
              ticket,
            }),
          ],
          { type: "application/json" },
        ),
      );
    };
    const hidden = () => {
      if (document.visibilityState === "hidden") send();
    };
    const timer = setTimeout(send, 10_000);
    document.addEventListener("visibilitychange", hidden);
    // Lasciando la pagina prima della scadenza il report parte con le misure già raccolte.
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", hidden);
      send();
      observer?.disconnect();
    };
  }, [page]);
}
