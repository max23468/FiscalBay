import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [],
    benchmark: { include: ["benchmarks/**/*.bench.ts"] },
    fileParallelism: false,
    testTimeout: 120_000,
  },
});
