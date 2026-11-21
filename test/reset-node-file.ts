import { afterAll, vi } from "vitest";

// Con `isolate: false` più file condividono lo stesso processo: ogni file lascia al successivo
// globali, timer, spy e moduli come in un processo nuovo. Le regole stanno in AGENTS.md.
afterAll(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});
