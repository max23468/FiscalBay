import config from "../../cloudflare.config.ts";

/** Worker dell'ambiente letto da `cloudflare.config.ts` con la stessa modalità della build. */
export const workerOf = (mode) => config({ mode: mode === "live" ? "live" : "development" }).worker;
