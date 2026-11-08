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

/** Spostamento del layout massimo accettato, in millesimi: oltre è un valore anomalo. */
export const maxLayoutShift = 100_000;

/** Attesa del report di una scheda rimasta aperta, entro la validità del biglietto. */
const reportDelay = 14 * 60_000;

/**
 * INP della pagina: l'interazione più lenta, scartandone una ogni cinquanta come fa il
 * 98° percentile della definizione di Core Web Vitals. Senza interazioni resta assente.
 */
export function interactionToNextPaint(durations: Iterable<number>) {
  const slowest = [...durations].sort((a, b) => b - a);
  return slowest[Math.min(Math.floor(slowest.length / 50), slowest.length - 1)];
}

/** Sessione di spostamenti del layout: gruppo più pesante e gruppo in corso. */
export interface LayoutShifts {
  worst: number;
  current: number;
  start: number;
  last: number;
}

/**
 * Aggiunge uno spostamento al CLS: gli spostamenti a meno di un secondo l'uno dall'altro, entro
 * cinque secondi dal primo, formano un gruppo; il CLS è il gruppo più pesante.
 */
export function addLayoutShift(shifts: LayoutShifts, value: number, at: number): LayoutShifts {
  const joined = shifts.current > 0 && at - shifts.last < 1_000 && at - shifts.start < 5_000;
  const current = joined ? shifts.current + value : value;
  return {
    worst: Math.max(shifts.worst, current),
    current,
    start: joined ? shifts.start : at,
    last: at,
  };
}

/** CLS in millesimi, intero come le altre misure; fuori limite resta assente. */
export function layoutShiftValue(value: number) {
  const scaled = Math.round(value * 1000);
  return Number.isFinite(scaled) && scaled >= 0 && scaled <= maxLayoutShift ? scaled : undefined;
}

/** Osserva un tipo di voce di Performance se il browser lo espone, altrimenti nulla. */
function observeEntries<T extends PerformanceEntry>(
  options: PerformanceObserverInit & { type: string; durationThreshold?: number },
  record: (entries: T[]) => void,
) {
  if (!PerformanceObserver.supportedEntryTypes?.includes(options.type)) return null;
  const observer = new PerformanceObserver((list) => record(list.getEntries() as T[]));
  observer.observe({ ...options, buffered: true });
  return observer;
}

/**
 * Invia una volta, quando la pagina viene nascosta o lasciata, le misure del caricamento in cui
 * la pagina è stata resa, con il biglietto del suo loader: INP e CLS maturano mentre la si usa.
 * Una scheda che resta aperta invia poco prima che il biglietto scada. Senza biglietto, come
 * nell'anteprima, non parte nessun report.
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
    let shifts: LayoutShifts = { worst: 0, current: 0, start: 0, last: 0 };
    const interactions = new Map<number, number>();
    const observers = [
      observeEntries({ type: "largest-contentful-paint" }, (entries) => {
        lcp = entries.at(-1)?.startTime;
      }),
      observeEntries<PerformanceEventTiming>(
        { type: "event", durationThreshold: 40 },
        (entries) => {
          for (const { interactionId, duration } of entries)
            if (interactionId)
              interactions.set(
                interactionId,
                Math.max(interactions.get(interactionId) ?? 0, duration),
              );
        },
      ),
      observeEntries<PerformanceEntry & { value: number; hadRecentInput: boolean }>(
        { type: "layout-shift" },
        (entries) => {
          for (const entry of entries)
            if (!entry.hadRecentInput)
              shifts = addLayoutShift(shifts, entry.value, entry.startTime);
        },
      ),
    ];
    const measuresLayout = observers[2] !== null;
    const stop = () => observers.forEach((observer) => observer?.disconnect());
    let sent = false;
    const send = () => {
      if (sent) return;
      sent = true;
      stop();
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
              inp: timingValue(interactionToNextPaint(interactions.values())),
              cls: measuresLayout ? layoutShiftValue(shifts.worst) : undefined,
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
    const timer = setTimeout(send, reportDelay);
    document.addEventListener("visibilitychange", hidden);
    // Lasciando la pagina prima della scadenza il report parte con le misure già raccolte.
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", hidden);
      send();
      stop();
    };
  }, [page]);
}
