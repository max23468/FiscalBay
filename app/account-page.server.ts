import { env } from "cloudflare:workers";
import { redirect } from "react-router";

import { accessNotice } from "./access-notice";
import { accessPath, ordersPath } from "./app-links";
import { createAuth } from "./auth.server";
import { registrationStatus } from "./domain/registration.server";
import { listSignInMethods } from "./domain/sign-in-methods.server";
import { listVisibleOrders } from "./domain/orders.server";
import { listStores } from "./domain/stores.server";
import { errorResponse, tracePhase } from "./errors";
import { sandboxAvailable } from "./integrations/ebay/environment.server";
import { languageFromPath, localizedPath } from "./i18n";

const noStore = { "cache-control": "no-store" };

/**
 * Accesso (`/accesso`) e Ordini (`/app/ordini`) condividono pagina e dati: senza sessione gli
 * Ordini rimandano all'accesso, con la sessione l'accesso rimanda agli Ordini, conservando
 * l'esito nell'indirizzo. Il link per la nuova password resta sull'accesso anche con la sessione.
 */
export async function accountLoader(request: Request, place: "access" | "app") {
  const url = new URL(request.url);
  const language = languageFromPath(url.pathname);
  const auth = createAuth(env);
  await auth.$context;
  tracePhase(request, "auth-context");
  const session = await auth.api.getSession({ headers: request.headers });
  tracePhase(request, "session");
  const search = url.searchParams;
  const notice = accessNotice(search, language);
  if (place === "app" && !session) {
    throw redirect(`${localizedPath(language, accessPath)}${url.search}`, { headers: noStore });
  }
  if (place === "access" && session && !search.has("token")) {
    throw redirect(`${localizedPath(language, ordersPath)}${url.search}`, { headers: noStore });
  }
  if (place === "access" || !session) {
    return {
      authenticated: false as const,
      language,
      notice,
      orders: [],
      resetToken: search.get("token") || null,
      // «Inizia gratis» del sito apre direttamente la registrazione.
      tab: search.has("registrati") ? "registrati" : "accedi",
    };
  }
  // Finché mancano profilo o Termini correnti l'utente vede solo il passaggio per completarli.
  const status = await registrationStatus(env.DB, session.user.id);
  const complete = status.termsAccepted && status.profile !== null;
  const ebayLinked = (await listSignInMethods(env.DB, session.user.id)).accounts.ebay;
  // eBay fornisce uno username, non il nome della persona. Vale anche per gli utenti
  // già registrati: né lo username né un indirizzo email devono precompilare il profilo.
  const providerName =
    status.profile || ebayLinked || session.user.name.includes("@") ? "" : session.user.name;
  const [firstName = "", ...lastName] = providerName.trim().split(/\s+/u).filter(Boolean);
  const stores = complete ? await listStores(env.DB, session.user.id) : [];
  const ebayEnvironment: "production" | "sandbox" =
    search.get("environment") === "sandbox" ? "sandbox" : "production";
  if (ebayEnvironment === "sandbox" && !sandboxAvailable(env)) {
    throw errorResponse(request, "FORBIDDEN");
  }
  return {
    authenticated: true as const,
    language,
    notice,
    email: session.user.email,
    name: status.profile ? `${status.profile.firstName} ${status.profile.lastName}` : "",
    emailVerified: session.user.emailVerified,
    needsProfile: !status.profile,
    needsAgreement: !status.termsAccepted,
    canLinkStore: session.user.emailVerified && complete,
    suggestedName: { firstName, lastName: lastName.join(" ") },
    orders: complete ? await listVisibleOrders(env.DB, session.user.id, 50, ebayEnvironment) : [],
    sandbox: sandboxAvailable(env),
    ebayEnvironment,
    // Senza ordini, un negozio già collegato cambia il messaggio: non va ricollegato.
    storeLinked: stores.some(
      (store) => store.ebayEnvironment === ebayEnvironment && store.connection !== "disconnected",
    ),
    // Prima i collegamenti già scaduti, poi quelli in scadenza.
    reminders: stores
      .filter((store) => store.ebayEnvironment === ebayEnvironment)
      .flatMap(({ id, name, ebayEnvironment, reminder }) =>
        reminder ? [{ id, name, ebayEnvironment, ...reminder }] : [],
      )
      .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "expired" ? -1 : 1)),
  };
}
