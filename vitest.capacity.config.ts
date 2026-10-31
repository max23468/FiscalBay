import { defineConfig } from "vitest/config";

import cloudflare from "./vitest.cloudflare.config";

// Stessa D1 e stessi binding della suite Workers, soltanto con il dataset di capacità e fuori dal
// gate: `node scripts/capacity.mjs` la esegue a richiesta.
export default defineConfig({
  ...cloudflare,
  test: {
    ...cloudflare.test,
    name: "capacity",
    // `capacity.mjs` legge le righe `CAPACITY` dalla console: dichiarato, impedisce al reporter
    // usato nelle sessioni degli agenti di tacere i log delle prove riuscite.
    silent: false,
    include: ["benchmarks/capacity.spec.ts"],
    testTimeout: 600_000,
    hookTimeout: 600_000,
  },
});
