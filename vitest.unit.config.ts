import { defineConfig } from "vitest/config";

// Le prove del confine HTTP sostituiscono i servizi, non il modulo sotto test.
// Better Auth e D1 restano qualificati dalla suite Cloudflare in `pnpm test`.
export default defineConfig({
  resolve: {
    alias: { "cloudflare:workers": new URL("./test/worker-context.ts", import.meta.url).pathname },
  },
  test: { name: "unit", include: ["test/**/*.unit.ts"] },
});
