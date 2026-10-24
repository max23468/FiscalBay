import { env } from "cloudflare:workers";
import { data, redirect } from "react-router";

import { createAuth } from "./auth.server";
import { listNotifications } from "./domain/notifications.server";
import { readPreferences, type Preferences } from "./domain/preferences.server";
import { registrationStatus, type Profile } from "./domain/registration.server";
import { listStores, type StoreStatus } from "./domain/stores.server";
import { accessPath, ordersPath } from "./app-links";
import { errorResponse } from "./error-response";
import { sandboxAvailable, type EbayEnvironment } from "./integrations/ebay/environment.server";
import { logFailure, tracePhase } from "./errors";
import { languageFromPath, localizedPath, type Language } from "./i18n";
import { measure } from "./observability.server";
import { detectedTimeZone, effectiveTimeZone, type ShellData } from "./preferences";

export type AccountArea = {
  language: Language;
  session: NonNullable<Awaited<ReturnType<ReturnType<typeof createAuth>["api"]["getSession"]>>>;
  profile: Profile;
  /** Nome ed email per la shell. */
  account: { name: string; email: string };
  preferences: Preferences;
  /** Fuso del dispositivo comunicato dal browser, se noto. */
  detectedTimeZone: string | null;
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
 * Sessione, registrazione e preferenze. Se Auth o il database non rispondono la pagina non
 * promette dati che non ha letto: risponde 503 con la sola indicazione di riprovare.
 */
async function readAccount(request: Request) {
  try {
    const session = await currentSession(request);
    const [status, preferences] = session
      ? await measure("d1", "registration", () =>
          Promise.all([
            registrationStatus(env.DB, session.user.id),
            readPreferences(env.DB, session.user.id),
          ]),
        )
      : [null, null];
    return { session, status, preferences };
  } catch (error) {
    throw unavailable(request, error);
  }
}

/** Servizio non disponibile: 503 senza dati, con la sola indicazione di riprovare. */
function unavailable(request: Request, error: unknown) {
  logFailure({ request, code: "UPSTREAM_UNAVAILABLE", error, operation: "route" });
  return data(null, {
    status: 503,
    headers: { "cache-control": "no-store", "retry-after": "60" },
  });
}

/**
 * Pagina dell'area: una lettura che non riesce dopo quella dell'account vale come Auth o
 * database non disponibili, con lo stesso 503 senza dati. Reindirizzamenti e risposte
 * previste dalla pagina (404, 503) passano invariati.
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
    throw response ? error : unavailable(request, error);
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
    const bare = url.pathname.replace(/^\/en(?=\/|$)/u, "") || "/";
    throw redirect(`${localizedPath(preferences!.language, bare)}${url.search}`, {
      headers: { "cache-control": "no-store" },
    });
  }
  const { firstName, lastName } = status!.profile!;
  return {
    language,
    session,
    profile: status!.profile!,
    account: { name: `${firstName} ${lastName}`, email: session.user.email },
    preferences: preferences!,
    detectedTimeZone: detectedTimeZone(request.headers.get("cookie")),
  };
}

/** I negozi già letti dalla pagina evitano una seconda lettura. */
export async function shellData(
  area: AccountArea,
  stores?: StoreStatus[],
  now = new Date(),
): Promise<ShellData> {
  const { session, preferences, language } = area;
  const display = {
    theme: preferences.theme,
    timeZone: effectiveTimeZone(preferences.timeZone, area.detectedTimeZone),
  };
  if (!session.user.emailVerified) return { display, notifications: null, now: now.toISOString() };
  const notifications = await measure("d1", "notifications", async () =>
    listNotifications(
      env.DB,
      session.user.id,
      stores ?? (await listStores(env.DB, session.user.id, now)),
      language,
      display.timeZone,
      now,
    ),
  );
  return { display, notifications, now: now.toISOString() };
}

/** Le azioni dell'area riservata accettano solo richieste partite dalla propria origine. */
export function assertSameOrigin(request: Request) {
  if (request.headers.get("origin") !== new URL(env.APP_ORIGIN).origin) {
    throw errorResponse(request, "FORBIDDEN");
  }
}

/** Ambiente eBay richiesto dall'indirizzo; la Sandbox esiste soltanto dove è abilitata. */
export function requestedEbayEnvironment(request: Request): EbayEnvironment {
  const environment =
    new URL(request.url).searchParams.get("environment") === "sandbox" ? "sandbox" : "production";
  if (environment === "sandbox" && !sandboxAvailable(env))
    throw errorResponse(request, "FORBIDDEN");
  return environment;
}
