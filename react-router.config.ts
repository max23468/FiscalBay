import type { Config } from "@react-router/dev/config";

export default {
  ssr: true,
  // Le route sono poche: il manifest iniziale evita richieste concorrenti con la navigazione.
  routeDiscovery: { mode: "initial" },
} satisfies Config;
