import config from "../../cloudflare.config.ts";

/**
 * Worker dell'ambiente letto da `cloudflare.config.ts`. Il live ha la modalità della build; il
 * test si legge in modalità `development`, cioè come lo serve lo sviluppo locale: stessi nomi,
 * risorse e variabili del Worker distribuito, senza il binding `TELEGRAM` verso il Worker del bot.
 */
export const workerOf = (mode) => config({ mode: mode === "live" ? "live" : "development" }).worker;
