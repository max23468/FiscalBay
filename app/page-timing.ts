import { useEffect, useRef } from "react";

/** Pagine misurate e fasi del server lette da `Server-Timing`: elenchi chiusi. */
export const timedPages = ["orders", "stores"] as const;
export type TimedPage = (typeof timedPages)[number];
export const serverPhases = ["auth", "d1", "ebay"] as const;

/**
 * Parti dell'interazione che dà l'INP: attesa prima dei gestori, gestori, disegno successivo e
 * script dei frame lunghi che la attraversano, dove il browser li espone.
 */
export const interactionParts = [
  "inpInput",
  "inpProcessing",
  "inpPresentation",
  "inpScript",
] as const;
export type InteractionParts = Partial<Record<(typeof interactionParts)[number], number>>;

export const pageTimingPath = "/api/v1/page-timing";

/** Durata massima accettata, in millisecondi: oltre non è una misura utile. */
export const maxTimingMs = 120_000;

// Un solo report per documento: le navigazioni successive non hanno un caricamento da misurare.
let reported = false;

/**
 * Ripiego per i browser senza le voci `visibility-state`: il primo momento in cui la pagina è
 * risultata nascosta da quando questo modulo è stato valutato, 0 se lo era già.
 */
let hiddenSince =
  typeof document === "undefined" || document.visibilityState !== "hidden" ? Infinity : 0;
if (typeof document !== "undefined")
  document.addEventListener("visibilitychange", (event) => {
    if (document.visibilityState === "hidden") hiddenSince = Math.min(hiddenSince, event.timeStamp);
  });

/**
 * Primo momento in cui la pagina è stata nascosta: dalle voci `visibility-state`, che partono
 * dall'apertura del documento, o dal ripiego. FCP e LCP disegnati dopo, come in una scheda aperta
 * in background, non misurano il caricamento visto dall'utente.
 */
export function firstHiddenTime(
  entries: ReadonlyArray<{ name: string; startTime: number }> | null,
  fallback: number,
) {
  if (!entries) return fallback;
  return entries.find((entry) => entry.name === "hidden")?.startTime ?? Infinity;
}

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

/** Ultimo invio del report di una scheda rimasta aperta, entro la validità del biglietto. */
const reportDelay = 14 * 60_000;

/** Attesa prima di aggiornare il report dopo nuove misure: più voci ravvicinate, un solo invio. */
const updateDelay = 1_000;

/** Frame lunghi conservati per attribuire l'INP: i più vecchi escono per primi. */
const maxFrames = 200;

/**
 * INP della pagina: l'interazione più lenta, scartandone una ogni cinquanta come fa il 98°
 * percentile della definizione di Core Web Vitals. Senza interazioni resta assente.
 */
export function interactionToNextPaint(durations: Iterable<number>) {
  return inpInteraction([...durations].map((duration) => ({ duration })))?.duration;
}

/** Interazione che dà l'INP, con la stessa regola di `interactionToNextPaint`. */
export function inpInteraction<T extends { duration: number }>(entries: Iterable<T>) {
  const slowest = [...entries].toSorted((a, b) => b.duration - a.duration);
  return slowest[Math.min(Math.floor(slowest.length / 50), slowest.length - 1)];
}

/** Voce di Event Timing dell'interazione e frame lunghi con i loro script. */
export interface InteractionTiming {
  startTime: number;
  duration: number;
  processingStart: number;
  processingEnd: number;
}
export interface FrameTiming {
  startTime: number;
  duration: number;
  scripts: ReadonlyArray<{ startTime: number; duration: number }>;
}

/**
 * Parti dell'interazione dell'INP. La durata è arrotondata a 8 ms dal browser: il disegno non
 * scende sotto zero. Lo script somma il tempo degli script dei frame lunghi dentro l'interazione;
 * senza Long Animation Frames resta assente.
 */
export function interactionAttribution(
  entry: InteractionTiming,
  frames: ReadonlyArray<FrameTiming> | null,
): InteractionParts {
  const end = entry.startTime + entry.duration;
  const overlap = (start: number, duration: number) =>
    Math.max(0, Math.min(start + duration, end) - Math.max(start, entry.startTime));
  return {
    inpInput: timingValue(entry.processingStart - entry.startTime),
    inpProcessing: timingValue(entry.processingEnd - entry.processingStart),
    inpPresentation: timingValue(Math.max(0, end - entry.processingEnd)),
    inpScript: frames
      ? timingValue(
          frames
            .filter((frame) => overlap(frame.startTime, frame.duration) > 0)
            .flatMap((frame) => frame.scripts)
            .reduce((total, script) => total + overlap(script.startTime, script.duration), 0),
        )
      : undefined,
  };
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

type DeferredInit = RequestInit & { activateAfter?: number };
type DeferredFetch = (url: string, init: DeferredInit) => { readonly activated: boolean };

/**
 * Ripiego di `fetchLater` per i browser che non lo hanno: invia con `keepalive` e priorità bassa
 * quando la pagina viene nascosta o alla scadenza. Dopo l'invio `activated` è vero, e il report non
 * si aggiorna più: il biglietto vale una volta sola.
 */
const fetchLaterFallback: DeferredFetch = (url, { activateAfter, ...init }) => {
  let activated = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const destroy = () => {
    document.removeEventListener("visibilitychange", sendNow);
    clearTimeout(timer);
  };
  function sendNow() {
    if (!init.signal?.aborted) {
      void fetch(url, { ...init, keepalive: true, priority: "low" }).catch(() => {});
      activated = true;
    }
    destroy();
  }
  if (document.visibilityState === "hidden") queueMicrotask(sendNow);
  else {
    document.addEventListener("visibilitychange", sendNow);
    if (activateAfter !== undefined) timer = setTimeout(sendNow, activateAfter);
  }
  init.signal?.addEventListener("abort", destroy);
  return {
    get activated() {
      return activated;
    },
  };
};

/**
 * Misure del caricamento in cui la pagina è stata resa, con il biglietto del suo loader, per tutta
 * la permanenza sulla pagina: il report è affidato al browser con `fetchLater`, aggiornato a ogni
 * nuova misura, e parte quando il documento si chiude o poco prima che il biglietto scada. INP e
 * CLS maturano mentre la si usa; FCP e LCP restano fuori se la pagina era nascosta prima di
 * disegnarli. Senza biglietto, come nell'anteprima, non parte nessun report.
 */
export function usePageTiming(page: TimedPage, ticket: string | undefined) {
  // Il biglietto conta soltanto al primo caricamento: le rivalidazioni non lo rinnovano.
  const firstTicket = useRef(ticket);
  useEffect(() => {
    const ticket = firstTicket.current;
    if (reported || !ticket) return;
    reported = true;
    const ready = performance.now();
    const deadline = ready + reportDelay;
    const [navigation] = performance.getEntriesByType(
      "navigation",
    ) as PerformanceNavigationTiming[];
    if (!navigation || typeof fetch !== "function") return;
    if (!loadedHere(navigation.name, location.pathname)) return;
    const deferredFetch =
      (globalThis as { fetchLater?: DeferredFetch }).fetchLater ?? fetchLaterFallback;
    const visibility = PerformanceObserver.supportedEntryTypes?.includes("visibility-state")
      ? performance.getEntriesByType("visibility-state")
      : null;
    // Le voci successive al caricamento non spostano il momento: conta il primo.
    const hiddenAt = () => firstHiddenTime(visibility, hiddenSince);
    let lcp: number | undefined;
    let shifts: LayoutShifts = { worst: 0, current: 0, start: 0, last: 0 };
    const interactions = new Map<number, PerformanceEventTiming>();
    const frames: FrameTiming[] = [];
    let updateTimer: ReturnType<typeof setTimeout> | undefined;
    const changed = () => {
      clearTimeout(updateTimer);
      updateTimer = setTimeout(schedule, updateDelay);
    };
    const observers = [
      observeEntries({ type: "largest-contentful-paint" }, (entries) => {
        const visible = entries.filter((entry) => entry.startTime < hiddenAt());
        lcp = visible.at(-1)?.startTime ?? lcp;
        changed();
      }),
      observeEntries<PerformanceEventTiming>(
        { type: "event", durationThreshold: 40 },
        (entries) => {
          for (const entry of entries)
            if (
              entry.interactionId
              && entry.duration > (interactions.get(entry.interactionId)?.duration ?? -1)
            )
              interactions.set(entry.interactionId, entry);
          changed();
        },
      ),
      observeEntries<PerformanceEntry & { value: number; hadRecentInput: boolean }>(
        { type: "layout-shift" },
        (entries) => {
          for (const entry of entries)
            if (!entry.hadRecentInput)
              shifts = addLayoutShift(shifts, entry.value, entry.startTime);
          changed();
        },
      ),
      observeEntries<PerformanceEntry & { scripts?: FrameTiming["scripts"] }>(
        { type: "long-animation-frame" },
        (entries) => {
          for (const { startTime, duration, scripts } of entries)
            frames.push({ startTime, duration, scripts: scripts ?? [] });
          frames.splice(0, Math.max(0, frames.length - maxFrames));
        },
      ),
    ];
    const measuresLayout = observers[2] !== null;
    const measuresFrames = observers[3] !== null;
    const stop = () => observers.forEach((observer) => observer?.disconnect());
    const server = Object.fromEntries(
      (navigation.serverTiming ?? []).flatMap((entry) => {
        const value = timingValue(entry.duration);
        return (serverPhases as readonly string[]).includes(entry.name) && value !== undefined
          ? [[entry.name, value]]
          : [];
      }),
    );
    const ttfb = timingValue(navigation.responseStart);
    const report = () => {
      const paint = performance.getEntriesByName("first-contentful-paint")[0]?.startTime;
      const interaction = inpInteraction(interactions.values());
      return JSON.stringify({
        page,
        ttfb,
        fcp: paint !== undefined && paint < hiddenAt() ? timingValue(paint) : undefined,
        lcp: timingValue(lcp),
        inp: timingValue(interaction?.duration),
        ...(interaction ? interactionAttribution(interaction, measuresFrames ? frames : null) : {}),
        cls: measuresLayout ? layoutShiftValue(shifts.worst) : undefined,
        ready: timingValue(ready),
        server,
        ticket,
      });
    };
    let controller: AbortController | undefined;
    let pending: { readonly activated: boolean } | undefined;
    let finished = false;
    // Il report in attesa prende il posto del precedente; partito una volta, non si rinnova.
    function schedule() {
      clearTimeout(updateTimer);
      if (finished || ttfb === undefined) return;
      if (pending?.activated) {
        finished = true;
        stop();
        return;
      }
      controller?.abort();
      controller = new AbortController();
      try {
        pending = deferredFetch(pageTimingPath, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: report(),
          signal: controller.signal,
          activateAfter: Math.max(0, deadline - performance.now()),
        });
      } catch {
        // Quota dei report differiti esaurita: la pagina resta senza misure.
      }
    }
    const hidden = () => {
      if (document.visibilityState === "hidden") schedule();
    };
    document.addEventListener("visibilitychange", hidden);
    schedule();
    // Lasciando la pagina nel client il report resta affidato al browser con le misure raccolte.
    return () => {
      document.removeEventListener("visibilitychange", hidden);
      schedule();
      finished = true;
      stop();
    };
  }, [page]);
}
