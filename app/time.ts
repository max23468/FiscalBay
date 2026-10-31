/** Durata di un giorno in millisecondi. */
export const dayMilliseconds = 86_400_000;

/** Millisecondi trascorsi dall'istante `since` a `now`. */
export function elapsedMs(since: Date | string, now: Date): number {
  return now.getTime() - new Date(since).getTime();
}

/**
 * Formattatore di un fuso, creato una volta: crearlo per ogni data occupa la maggior parte del
 * tempo di un file grande.
 */
const formats = new Map<string, Intl.DateTimeFormat>();

function dateTimeFormat(timeZone: string) {
  let format = formats.get(timeZone);
  // Stryker disable next-line ConditionalExpression: un formattatore nuovo a ogni data dà lo stesso testo, soltanto più lentamente.
  if (!format) {
    format = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    // Stryker disable next-line CallExpression: senza memoria il testo resta lo stesso, soltanto più lento.
    formats.set(timeZone, format);
  }
  return format;
}

type WallClock = Record<"year" | "month" | "day" | "hour" | "minute" | "second", string>;

/** Data e ora del muro nel fuso indicato, a due cifre tranne l'anno. */
export function wallClock(at: Date | number, timeZone: string): WallClock {
  return Object.fromEntries(
    dateTimeFormat(timeZone)
      .formatToParts(at)
      .map((part) => [part.type, part.value]),
  ) as WallClock;
}

/** Data e ora locali nel fuso indicato, al minuto. */
export function localClock(timeZone: string, now: Date): { day: string; time: string } {
  const parts = wallClock(now, timeZone);
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

/**
 * Istante in cui il fuso indicato segna l'ora del muro `wall`, espressa in millisecondi come se
 * fosse UTC.
 */
export function wallInstant(wall: number, timeZone: string): Date {
  const offset = (instant: number) => {
    const parts = wallClock(instant, timeZone);
    return (
      Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute) -
      Math.floor(instant / 60_000) * 60_000
    );
  };
  // La seconda correzione usa la differenza valida all'istante trovato, anche vicino a un cambio
  // di ora legale.
  return new Date(wall - offset(wall - offset(wall)));
}

/** Istante dell'ora locale `time` del giorno `day` nel fuso indicato. */
export function zonedInstant(timeZone: string, day: string, time: string): Date {
  return wallInstant(Date.parse(`${day}T${time}:00Z`), timeZone);
}
