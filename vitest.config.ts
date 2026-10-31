import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["./vitest.cloudflare.config.ts", "./vitest.unit.config.ts"],
    coverage: {
      provider: "istanbul",
      include: ["app/**/*.{ts,tsx}", "workers/**/*.ts"],
      exclude: ["**/*.d.ts"],
      reportsDirectory: "reports/coverage",
      reporter: ["text", "html", "json", "json-summary", "lcov"],
      reportOnFailure: true,
    },
  },
});
