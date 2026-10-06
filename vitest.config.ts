import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { projects: ["./vitest.cloudflare.config.ts", "./vitest.unit.config.ts"] },
});
