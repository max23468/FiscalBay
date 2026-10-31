import { bindings, defineConfig } from "cf/config";

// Pagina provvisoria Production: cartella da rimuovere al primo Pubblica dell'app 2.0.
export default defineConfig({
  worker: {
    name: "fiscalbay",
    compatibilityDate: "2026-09-13",
    entrypoint: "./worker.js",
    workersDev: false,
    domains: ["fiscalbay.it"],
    env: {
      BETTER_AUTH_SECRET: bindings.secret(),
      GOOGLE_CLIENT_ID: bindings.secret(),
      GOOGLE_CLIENT_SECRET: bindings.secret(),
      EBAY_CLIENT_ID: bindings.secret(),
      EBAY_CLIENT_SECRET: bindings.secret(),
      EBAY_RUNAME: bindings.secret(),
    },
  },
});
