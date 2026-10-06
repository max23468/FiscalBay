import { env } from "cloudflare:workers";
import { redirect } from "react-router";

import { createAuth } from "./auth.server";
import { registrationStatus, type Profile } from "./domain/registration.server";
import { accessPath, ordersPath } from "./app-links";
import { errorResponse, tracePhase } from "./errors";
import { languageFromPath, localizedPath, type Language } from "./i18n";

export type AccountArea = {
  language: Language;
  session: NonNullable<Awaited<ReturnType<ReturnType<typeof createAuth>["api"]["getSession"]>>>;
  profile: Profile;
  /** Nome ed email per la shell. */
  account: { name: string; email: string };
};

/**
 * Pagine dell'area riservata oltre agli ordini: richiedono sessione, email confermata e
 * registrazione completa. Altrimenti l'accesso o gli Ordini mostrano il passo che manca,
 * conservando l'esito eventualmente arrivato nell'indirizzo.
 */
export async function requireAccountArea(request: Request): Promise<AccountArea> {
  const url = new URL(request.url);
  const language = languageFromPath(url.pathname);
  const auth = createAuth(env);
  await auth.$context;
  tracePhase(request, "auth-context");
  const session = await auth.api.getSession({ headers: request.headers });
  tracePhase(request, "session");
  const status = session ? await registrationStatus(env.DB, session.user.id) : null;
  tracePhase(request, "registration");
  if (!session?.user.emailVerified || !status?.profile || !status.termsAccepted) {
    throw redirect(`${localizedPath(language, session ? ordersPath : accessPath)}${url.search}`, {
      headers: { "cache-control": "no-store" },
    });
  }
  const { firstName, lastName } = status.profile;
  return {
    language,
    session,
    profile: status.profile,
    account: { name: `${firstName} ${lastName}`, email: session.user.email },
  };
}

/** Le azioni dell'area riservata accettano solo richieste partite dalla propria origine. */
export function assertSameOrigin(request: Request) {
  if (request.headers.get("origin") !== new URL(env.APP_ORIGIN).origin) {
    throw errorResponse(request, "FORBIDDEN");
  }
}
