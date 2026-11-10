import { env } from "cloudflare:workers";
import { redirect } from "react-router";

import { createAuth, readSession } from "./auth.server";
import { pendingVisitWrites, recordActivity } from "./domain/admission.server";
import { applyFreePlan } from "./domain/free-store.server";
import { listNotifications } from "./domain/notifications.server";
import { readPreferences, type Preferences } from "./domain/preferences.server";
import { registrationStatus, type Profile } from "./domain/registration.server";
import { listStores, type StoreStatus } from "./domain/stores.server";
import { accessPath, environmentOf, environmentParam, ordersPath } from "./app-links";
import { errorResponse, unavailablePage } from "./error-response";
import type { EbayEnvironment } from "./view-models";
import { sandboxAvailable } from "./integrations/ebay/environment.server";
import { tracePhase } from "./errors";
import { canonicalPath, languageFromPath, localizedPath, type Language } from "./i18n";
import { hasWhatsNew } from "./whats-new.server";
import { measure } from "./observability.server";
import { detectedTimeZone, effectiveTimeZone, type ShellData } from "./preferences";

export type AccountArea = {
  language: Language;
  session: NonNullable<Awaited<ReturnType<typeof readSession>>>;
  profile: Profile;
  /** Nome ed email per la shell. */
  account: { name: string; email: string };
  preferences: Preferences;
  /** Fuso del dispositivo comunicato dal browser, se noto. */
  detectedTimeZone: string | null;
  /** Fuso delle date mostrate: quello scelto, altrimenti quello del dispositivo. */
  timeZone: string;
  /** Versione corrente dei Termini ancora da accettare: un invito, mai un blocco (D232). */
  termsUpdate: boolean;
};

/** Sessione corrente, misurata nella fase Auth. */
export async function currentSession(request: Request) {
  return measure("auth", "session", async () => {
    const auth = createAuth(env);
    await auth.$context;
    tracePhase(request, "auth-context");
    const session = await readSession(env, request);
    tracePhase(request, "session");
    return session;
  });
}

/**
 * Sessione, registrazione e preferenze. Il piano dello spazio si riallinea prima di ogni
 * lettura della pagina se è cambiato qualcosa da cui dipende; la fine di una copertura per il
 * solo passare del tempo la raccoglie il cron. La pagina aperta con una sessione è l'attività
 * umana che conta per l'inattività del Free, scritta una volta l'ora. Se Auth o il database non
 * rispondono la pagina non promette dati che non ha letto: risponde 503 con la sola indicazione
 * di riprovare.
 */
function readAccount(request: Request) {
  // La shell dell'area e la pagina leggono l'account nella stessa richiesta: una sola lettura.
  let read = accountReads.get(request);
  if (!read) {
    read = loadAccount(request);
    accountReads.set(request, read);
  }
  return read;
}

const accountReads = new WeakMap<Request, ReturnType<typeof loadAccount>>();

async function loadAccount(request: Request) {
  try {
    const session = await currentSession(request);
    if (!session) return { session, status: null, preferences: null };
    const userId = session.user.id;
    const [status, preferences, pending] = await measure("d1", "registration", () =>
      Promise.all([
        registrationStatus(env.DB, userId),
        readPreferences(env.DB, userId),
        pendingVisitWrites(env.DB, userId),
      ]),
    );
    if (pending.plan || pending.activity)
      await measure("d1", "registration", () =>
        Promise.all([
          pending.plan ? applyFreePlan(env.DB, userId) : null,
          pending.activity ? recordActivity(env.DB, userId) : null,
        ]),
      );
    return { session, status, preferences };
  } catch (error) {
    throw unavailablePage(request, error);
  }
}

/**
 * Pagina dell'area, dell'accesso, della console o del sito che legge il database: una lettura
 * che non riesce vale come Auth o database non disponibili, con lo stesso 503 senza dati.
 * Reindirizzamenti e risposte previste dalla pagina (404, 503) passano invariati.
 */
export async function areaPage<T>(request: Request, read: () => Promise<T>): Promise<T> {
  try {
    return await read();
  } catch (error) {
    const response =
      error instanceof Response ||
      (typeof error === "object" &&
        error !== null &&
        "type" in error &&
        error.type === "DataWithResponseInit");
    throw response ? error : unavailablePage(request, error);
  }
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
  const { session, status, preferences } = await readAccount(request);
  tracePhase(request, "registration");
  const complete = !!status?.profile && status.termsAccepted;
  if (!session || !complete || (!session.user.emailVerified && !options.unverified)) {
    throw redirect(
      `${localizedPath(language, session && complete ? ordersPath : accessPath)}${url.search}`,
      { headers: { "cache-control": "no-store" } },
    );
  }
  // Una pagina aperta in un'altra lingua, da un nuovo accesso o da un collegamento, segue la
  // lingua scelta; le azioni rispondono nella lingua dell'indirizzo che le ha inviate.
  if (request.method === "GET" && preferences!.language && preferences!.language !== language) {
    const bare = canonicalPath(url.pathname);
    throw redirect(`${localizedPath(preferences!.language, bare)}${url.search}`, {
      headers: { "cache-control": "no-store" },
    });
  }
  const { firstName, lastName } = status!.profile!;
  const detected = detectedTimeZone(request.headers.get("cookie"));
  return {
    language,
    session,
    profile: status!.profile!,
    account: { name: `${firstName} ${lastName}`, email: session.user.email },
    preferences: preferences!,
    detectedTimeZone: detected,
    timeZone: effectiveTimeZone(preferences!.timeZone, detected),
    termsUpdate: !status!.termsCurrent,
  };
}

/** La sessione è la stessa per shell e pagina di una richiesta: i negozi si leggono una volta. */
const storeReads = new WeakMap<AccountArea["session"], Promise<StoreStatus[]>>();

/** Negozi dello spazio letti per la richiesta in corso, condivisi fra shell e pagina. */
export function areaStores(area: AccountArea, now = new Date()) {
  let read = storeReads.get(area.session);
  if (!read) {
    read = listStores(env.DB, area.session.user.id, now);
    storeReads.set(area.session, read);
  }
  return read;
}

export async function shellData(area: AccountArea, now = new Date()): Promise<ShellData> {
  const { session, preferences, language } = area;
  const display = { theme: preferences.theme, timeZone: area.timeZone };
  if (!session.user.emailVerified) return { display, notifications: null, now: now.toISOString() };
  const notifications = await measure("d1", "notifications", async () =>
    listNotifications(
      env.DB,
      session.user.id,
      await areaStores(area, now),
      language,
      display.timeZone,
      now,
      area.termsUpdate,
    ),
  );
  return {
    display,
    notifications,
    whatsNew: hasWhatsNew(now),
    admin: (session.user as { admin?: boolean }).admin === true,
    now: now.toISOString(),
  };
}

export const isSameOrigin = (request: Request) =>
  request.headers.get("origin") === new URL(env.APP_ORIGIN).origin;

/** Le azioni dell'area riservata accettano solo richieste partite dalla propria origine. */
export function assertSameOrigin(request: Request) {
  if (!isSameOrigin(request)) throw errorResponse(request, "FORBIDDEN");
}

/** Ambiente eBay richiesto dall'indirizzo; la Sandbox esiste soltanto dove è abilitata. */
export function requestedEbayEnvironment(request: Request): EbayEnvironment {
  const environment = environmentOf(new URL(request.url).searchParams.get(environmentParam));
  if (environment === "sandbox" && !sandboxAvailable(env))
    throw errorResponse(request, "FORBIDDEN");
  return environment;
}
