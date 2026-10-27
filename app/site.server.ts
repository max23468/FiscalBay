import { env } from "cloudflare:workers";

import { createAuth } from "./auth.server";
import { readSession } from "./domain/sessions.server";
import { tracePhase } from "./errors";
import { languageFromPath } from "./i18n";

/**
 * Dati comuni delle pagine pubbliche: lingua, origine per canonical e Open Graph e sessione,
 * che porta `Apri l'app` nella barra al posto di `Accedi`. La pagina dipende quindi dalla
 * sessione e nessuna cache la conserva: il Worker risponde `no-store`.
 */
export async function publicPage(request: Request) {
  const auth = createAuth(env);
  await auth.$context;
  const session = await readSession(env, request);
  tracePhase(request, "session");
  return {
    language: languageFromPath(new URL(request.url).pathname),
    origin: new URL(env.APP_ORIGIN).origin,
    session,
  };
}
