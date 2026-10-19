import { env } from "cloudflare:workers";
import { redirect } from "react-router";

import { createAuth } from "./auth.server";
import { registrationStatus, type Profile } from "./domain/registration.server";
import { accessPath, ordersPath } from "./app-links";
import { errorResponse } from "./error-response";
import { tracePhase } from "./errors";
import { languageFromPath, localizedPath, type Language } from "./i18n";
import { measure } from "./observability.server";

export type AccountArea = {
  language: Language;
  session: NonNullable<Awaited<ReturnType<ReturnType<typeof createAuth>["api"]["getSession"]>>>;
  profile: Profile;
  /** Nome ed email per la shell. */
  account: { name: string; email: string };
};

/** Sessione corrente, misurata nella fase Auth. */
export async function currentSession(request: Request) {
  return measure("auth", "session", async () => {
    const auth = createAuth(env);
    await auth.$context;
    tracePhase(request, "auth-context");
    const session = await auth.api.getSession({ headers: request.headers });
    tracePhase(request, "session");
    return session;
  });
}

/**
 * Area riservata: richiede sessione e registrazione completa, altrimenti l'accesso mostra il
 * passo che manca. Le pagine oltre agli Ordini richiedono anche l'email confermata; senza, gli
 * Ordini spiegano come proseguire. L'esito eventualmente arrivato nell'indirizzo resta.
 */
export async function requireAccountArea(
  request: Request,
  options: { unverified?: boolean } = {},
): Promise<AccountArea> {
  const url = new URL(request.url);
  const language = languageFromPath(url.pathname);
  const session = await currentSession(request);
  const status = session
    ? await measure("d1", "registration", () => registrationStatus(env.DB, session.user.id))
    : null;
  tracePhase(request, "registration");
  const complete = !!status?.profile && status.termsAccepted;
  if (!session || !complete || (!session.user.emailVerified && !options.unverified)) {
    throw redirect(
      `${localizedPath(language, session && complete ? ordersPath : accessPath)}${url.search}`,
      { headers: { "cache-control": "no-store" } },
    );
  }
  const { firstName, lastName } = status!.profile!;
  return {
    language,
    session,
    profile: status!.profile!,
    account: { name: `${firstName} ${lastName}`, email: session.user.email },
  };
}

/** Le azioni dell'area riservata accettano solo richieste partite dalla propria origine. */
export function assertSameOrigin(request: Request) {
  if (request.headers.get("origin") !== new URL(env.APP_ORIGIN).origin) {
    throw errorResponse(request, "FORBIDDEN");
  }
}
