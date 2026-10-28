import { defineConfig } from "vitest/config";

import cloudflare from "./vitest.cloudflare.config";

// Stessa D1 e stessi binding della suite Workers, soltanto con il dataset di capacità e fuori dal
// gate: `node scripts/capacity.mjs` la esegue a richiesta.
export default defineConfig({
  ...cloudflare,
  test: {
    ...cloudflare.test,
    name: "capacity",
    silent: false,
    include: ["benchmarks/capacity.spec.ts"],
    testTimeout: 600_000,
    hookTimeout: 600_000,
    coverage: { enabled: false },
  },
});
