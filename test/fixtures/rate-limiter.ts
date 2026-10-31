import { vi } from "vitest";

import { requestLimitRules, type RequestLimit } from "../../app/request-limits";

/**
 * Binding Rate Limiting simulato a finestre fisse sull'orologio di `Date.now`, con le soglie
 * dichiarate nella configurazione; registra le chiavi ricevute.
 */
export function fakeRateLimiter(limit: RequestLimit) {
  const { limit: max, period } = requestLimitRules[limit];
  const windows = new Map<string, { start: number; count: number }>();
  const keys: string[] = [];
  return {
    keys,
    async limit({ key }: { key: string }) {
      keys.push(key);
      const now = Date.now();
      const current = windows.get(key);
      const window =
        current && now - current.start < period * 1000 ? current : { start: now, count: 0 };
      window.count++;
      windows.set(key, window);
      return { success: window.count <= max };
    },
  };
}

/** I tre binding dell'ambiente, da aggiungere a un `Env` simulato. */
export function fakeRateLimiters() {
  return {
    REQUEST_LIMIT_ATTEMPTS: fakeRateLimiter("attempts"),
    REQUEST_LIMIT_EMAILS: fakeRateLimiter("emails"),
    REQUEST_LIMIT_WORK: fakeRateLimiter("work"),
  };
}

/** Tempo che una serie di richieste di prova deve trovare ancora libero nella finestra. */
const windowMargin = 2_000;

/**
 * Il binding nativo simulato da Miniflare allinea le finestre all'orologio: una serie a cavallo
 * del confine troverebbe il contatore azzerato a metà. Se la finestra corrente sta per finire, si
 * attende l'inizio della successiva. Le finestre di 60 secondi finiscono sempre insieme a una di
 * 10, quindi basta la più breve.
 */
export async function withinOneLimitWindow() {
  const period = Math.min(...Object.values(requestLimitRules).map((rule) => rule.period)) * 1000;
  // Il binding conta sull'ora reale, anche quando la prova fissa quella di `Date`.
  const left = period - (vi.getRealSystemTime() % period);
  if (left < windowMargin) await new Promise((resolve) => setTimeout(resolve, left + 50));
}
