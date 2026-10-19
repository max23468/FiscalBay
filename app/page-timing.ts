import { useEffect } from "react";

/** Pagine misurate e fasi del server lette da `Server-Timing`: elenchi chiusi. */
export const timedPages = ["orders", "stores"] as const;
export type TimedPage = (typeof timedPages)[number];
export const serverPhases = ["auth", "d1", "ebay", "render"] as const;

export const pageTimingPath = "/api/v1/page-timing";

/** Durata massima accettata, in millisecondi: oltre non è una misura utile. */
export const maxTimingMs = 120_000;

// Un solo report per documento: le navigazioni successive non hanno un caricamento da misurare.
let reported = false;

/**
 * Invia una volta, quando la pagina viene nascosta o lasciata o dopo dieci secondi, le misure del
 * caricamento in cui la pagina è stata resa.
 */
export function usePageTiming(page: TimedPage) {
  useEffect(() => {
    if (reported) return;
    reported = true;
    const ready = performance.now();
    const [navigation] = performance.getEntriesByType(
      "navigation",
    ) as PerformanceNavigationTiming[];
    if (!navigation || typeof navigator.sendBeacon !== "function") return;
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
      // Solo durate plausibili, arrotondate al millisecondo: un valore non finito resta fuori.
      const round = (value: number | undefined) =>
        value === undefined || !Number.isFinite(value) || value < 0 || value > maxTimingMs
          ? undefined
          : Math.round(value);
      const server = Object.fromEntries(
        (navigation.serverTiming ?? []).flatMap((entry) => {
          const value = round(entry.duration);
          return (serverPhases as readonly string[]).includes(entry.name) && value !== undefined
            ? [[entry.name, value]]
            : [];
        }),
      );
      const ttfb = round(navigation.responseStart);
      if (ttfb === undefined) return;
      navigator.sendBeacon(
        pageTimingPath,
        new Blob(
          [
            JSON.stringify({
              page,
              ttfb,
              fcp: round(performance.getEntriesByName("first-contentful-paint")[0]?.startTime),
              lcp: round(lcp),
              ready: round(ready) ?? maxTimingMs,
              server,
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
    };
  }, [page]);
}
