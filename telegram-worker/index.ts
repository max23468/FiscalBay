import { forward } from "./forward";

/**
 * Worker del bot Telegram: l'unico che conosce il token, raggiungibile soltanto dal Service
 * binding del Worker principale, senza domini né `workers.dev`. Così le tracce del Worker
 * principale non registrano mai un indirizzo con il token.
 */
export default {
  fetch: (request, env) => forward(request, env.TELEGRAM_BOT_TOKEN),
} satisfies ExportedHandler<{ TELEGRAM_BOT_TOKEN: string }>;
