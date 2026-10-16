import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [],
    benchmark: { include: ["benchmarks/**/*.bench.ts"] },
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 120_000,
    coverage: { enabled: false },
  },
});
