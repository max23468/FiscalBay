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
