import { env } from "cloudflare:workers";
import { redirect } from "react-router";

import { accessNotice } from "./access-notice";
import { currentSession } from "./account-area.server";
import { ordersPath, securityReturnPath } from "./app-links";
import { registrationStatus } from "./domain/registration.server";
import { listSignInMethods } from "./domain/sign-in-methods.server";
import { languageFromPath, localizedPath } from "./i18n";

const noStore = { "cache-control": "no-store" };

/**
 * Pagina di accesso: login, registrazione, recupero della password, passkey e completamento del
 * profilo. Con la sessione e la registrazione completa rimanda agli Ordini (o alla Sicurezza
 * da cui si è partiti), conservando l'esito nell'indirizzo; il link per la nuova password resta
 * qui anche con la sessione.
 */
export async function accessLoader(request: Request) {
  const url = new URL(request.url);
  const language = languageFromPath(url.pathname);
  const search = url.searchParams;
  const notice = accessNotice(search, language);
  const session = await currentSession(request);
  if (!session || search.has("token")) {
    return {
      authenticated: false as const,
      registrationRestricted: env.REGISTRATION_MODE !== "open",
      language,
      notice,
      resetToken: search.get("token") || null,
      // «Inizia gratis» del sito apre direttamente la registrazione.
      tab: search.has("registrati") ? "registrati" : "accedi",
    };
  }
  const status = await registrationStatus(env.DB, session.user.id);
  if (status.termsAccepted && status.profile) {
    const target = securityReturnPath(language, search.get("returnTo"));
    throw redirect(target ?? `${localizedPath(language, ordersPath)}${url.search}`, {
      headers: noStore,
    });
  }
  // eBay fornisce uno username, non il nome della persona. Vale anche per gli utenti
  // già registrati: né lo username né un indirizzo email devono precompilare il profilo.
  const ebayLinked = (await listSignInMethods(env.DB, session.user.id)).accounts.ebay;
  const providerName =
    status.profile || ebayLinked || session.user.name.includes("@") ? "" : session.user.name;
  const [firstName = "", ...lastName] = providerName.trim().split(/\s+/u).filter(Boolean);
  return {
    authenticated: true as const,
    language,
    notice,
    email: session.user.email,
    emailVerified: session.user.emailVerified,
    needsProfile: !status.profile,
    needsAgreement: !status.termsAccepted,
    suggestedName: { firstName, lastName: lastName.join(" ") },
  };
}
