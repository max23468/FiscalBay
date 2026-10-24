import { env } from "cloudflare:workers";
import { data, isRouteErrorResponse, redirect } from "react-router";

import { AccountShell } from "~/components/account-shell";
import { NotFoundState } from "~/components/not-found";
import { SettingsPage, type SettingsPageData } from "~/components/settings/page";
import { accessNotice } from "../access-notice";
import { areaPage, assertSameOrigin, requireAccountArea, shellData } from "../account-area.server";
import { appCopy, pageTitle } from "../app-copy";
import { appBase, type AppLinks } from "../app-links";
import { checkoutReturn } from "../catalog";
import {
  checkoutConfigured,
  checkoutOffers,
  isCheckoutOffer,
  prepaidConfigured,
  purchaseState,
  startCheckout,
} from "../domain/checkout.server";
import { pendingEmailChange } from "../domain/email-change.server";
import {
  accountCoverage,
  orderAllowance,
  setUnlockConfirmation,
  startTrial,
  unlockConfirmation,
} from "../domain/grants.server";
import { completeRegistration, parseProfile } from "../domain/registration.server";
import {
  marketingConsent,
  messageTemplates,
  parsePreference,
  parseTemplates,
  recordMarketingConsent,
  savePreference,
  saveTemplates,
} from "../domain/preferences.server";
import {
  listActiveSessions,
  passkeyChangeBlock,
  recentSignIn,
  type AuthSession,
} from "../domain/sessions.server";
import { listSignInMethods } from "../domain/sign-in-methods.server";
import { logFailure } from "../errors";
import { languageFromPath } from "../i18n";
import { measure } from "../observability.server";
import { securityAction } from "../security-actions.server";
import { settingsSections, type ActionResult, type SettingsSection } from "../view-models";
import type { Route } from "./+types/settings";

/**
 * Categorie con un servizio reale. L'esportazione arriva con il file degli ordini; Telegram,
 * esportazione e cancellazione dell'account e modulo di assistenza compaiono nelle rispettive
 * categorie insieme ai loro servizi. L'acquisto compare con la configurazione Stripe.
 */
const sections = settingsSections.filter((section) => section !== "esportazione");
const services = (): SettingsPageData["services"] => ({
  billing: checkoutConfigured(env),
  telegram: false,
  accountData: false,
  support: false,
});

function isSection(value: string | undefined): value is SettingsSection {
  return (sections as readonly string[]).includes(value ?? "");
}

export function meta({ location, params }: Route.MetaArgs): Route.MetaDescriptors {
  const t = appCopy[languageFromPath(location.pathname)];
  const title = isSection(params.sezione)
    ? `${t.settings.sections[params.sezione].title} | ${t.settings.title}`
    : t.settings.title;
  return [{ title: pageTitle(title) }, { name: "robots", content: "noindex" }];
}

export function headers(): HeadersInit {
  return { "cache-control": "no-store" };
}

export function loader(args: Route.LoaderArgs) {
  return areaPage(args.request, () => readSettings(args));
}

/**
 * Impostazioni dell'account, per chi ha confermato l'email: ogni preferenza viene dalla sua
 * fonte salvata, Sicurezza dai metodi di accesso e dalle sessioni reali.
 */
async function readSettings({ request, params }: Route.LoaderArgs) {
  const area = await requireAccountArea(request);
  const { language, session, account, profile, preferences } = area;
  if (params.sezione !== undefined && !isSection(params.sezione)) {
    return data(
      {
        notFound: true as const,
        language,
        userId: session.user.id,
        account,
        shell: await shellData(area),
      },
      { status: 404 },
    );
  }
  const userId = session.user.id;
  const now = new Date();
  const auth = session as AuthSession;
  const [shell, [allowance, purchase, confirmUnlock, marketing, methods, sessions, pendingEmail]] =
    await Promise.all([
      shellData(area, undefined, now),
      measure("d1", "settings", () =>
        Promise.all([
          orderAllowance(env.DB, userId, now),
          purchaseState(env.DB, userId, now),
          unlockConfirmation(env.DB, userId),
          marketingConsent(env.DB, userId),
          listSignInMethods(env.DB, userId),
          listActiveSessions(env.DB, userId, session.session.id, language, now),
          pendingEmailChange(env.DB, userId, session.user.email),
        ]),
      ),
    ]);
  const cycle = allowance?.cycle;
  const page: SettingsPageData = {
    confirmUnlock,
    section: params.sezione ?? null,
    sections,
    services: services(),
    preview: false,
    account: {
      ...account,
      profile,
      plan: allowance?.premium ? "premium" : "free",
      trialAvailable: allowance?.trialAvailable ?? false,
      ...accountCoverage(allowance),
      // Prima del primo collegamento nessun ciclo è avviato e non c'è una quota da mostrare.
      quota:
        !allowance?.premium && cycle
          ? {
              used: cycle.used,
              limit: cycle.quota,
              cycleEndsAt: cycle.ends_at,
              ...(cycle.next_quota !== cycle.quota ? { nextLimit: cycle.next_quota } : {}),
            }
          : undefined,
    },
    purchase: {
      // Senza i prezzi del primo periodo la prova non offre l'acquisto, che ne perderebbe i giorni.
      state:
        purchase?.trialEndsAt && !prepaidConfigured(env)
          ? "covered"
          : (purchase?.state ?? "needs-sync"),
      offers: checkoutOffers,
      checkout: checkoutReturn(new URL(request.url).searchParams),
    },
    stores: [],
    security: {
      methods,
      sessions,
      recent: recentSignIn(auth, now),
      passkeyRestriction: passkeyChangeBlock(auth, now),
      // Avviso da mostrare se la registrazione di una passkey viene rifiutata.
      passkeyBlock: passkeyChangeBlock(auth, now) ?? "nuovo-accesso",
      pendingEmail,
      notice: accessNotice(new URL(request.url).searchParams, language),
    },
    preferences: {
      theme: preferences.theme,
      timeZone: preferences.timeZone,
      detectedTimeZone: area.detectedTimeZone,
      marketing,
      templates: messageTemplates(preferences),
    },
    diagnostics: null,
    telegramChat: null,
    exportEstimate: { orders: 0, locked: 0 },
    exportContext: null,
    now: now.toISOString(),
  };
  return {
    notFound: false as const,
    language,
    userId,
    account,
    page,
    shell,
  };
}

/**
 * Scelte semplici salvate a ogni modifica, modello di messaggio con Salva e azioni della
 * Sicurezza. Un rifiuto o un errore non è mai presentato come salvataggio riuscito.
 */
export async function action({ request }: Route.ActionArgs) {
  assertSameOrigin(request);
  const area = await requireAccountArea(request);
  const { language, session } = area;
  const t = appCopy[language].settings;
  const userId = session.user.id;
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  const failed = (status: number, notice: string) =>
    data<ActionResult>({ ok: false, notice }, { status });
  try {
    if (intent === "save") {
      const name = String(form.get("name") ?? "");
      const value = String(form.get("value") ?? "");
      if (name === "marketing" && (value === "true" || value === "false")) {
        await recordMarketingConsent(env.DB, userId, value === "true", language);
        return { ok: true } satisfies ActionResult;
      }
      if (name === "unlock-confirmation" && (value === "true" || value === "false")) {
        await setUnlockConfirmation(env.DB, userId, value === "true");
        return { ok: true } satisfies ActionResult;
      }
      const change = parsePreference(name, value);
      // La lingua cambia l'indirizzo della pagina: ha il proprio percorso.
      if (!change || change.name === "language") return failed(400, t.saveFailed);
      await savePreference(env.DB, userId, change);
      return { ok: true } satisfies ActionResult;
    }
    if (intent === "template") {
      const templates = parseTemplates(form);
      if (!templates) return failed(400, t.template.templateInvalid);
      await saveTemplates(env.DB, userId, templates);
      return { ok: true } satisfies ActionResult;
    }
    if (intent === "start-trial") {
      // Una prova già usata, anche da un'altra scheda, non riparte: lo stato si rilegge.
      if (!(await startTrial(env.DB, userId))) return failed(409, t.plan.trialUnavailable);
      return { ok: true, notice: t.plan.trialStarted } satisfies ActionResult;
    }
    if (intent === "buy") {
      const offer = String(form.get("plan") ?? "");
      if (!isCheckoutOffer(offer)) return failed(400, t.plan.checkoutUnavailable);
      const checkout = await startCheckout(env, {
        request,
        userId,
        email: session.user.email,
        offer,
        language,
      });
      if (checkout.ok) return redirect(checkout.url);
      return failed(
        checkout.reason === "unavailable" ? 503 : 409,
        checkout.reason === "covered"
          ? t.plan.checkoutCovered
          : checkout.reason === "needs-sync"
            ? t.plan.purchaseNeedsSync
            : t.plan.checkoutUnavailable,
      );
    }
    if (intent === "profile") {
      // Nome, cognome e ragione sociale; il tipo di account resta quello registrato.
      form.set("tipo", area.profile.accountType === "business" ? "azienda" : "privato");
      const profile = parseProfile(form);
      if (!profile) return failed(400, appCopy[language].profile.invalid);
      await completeRegistration(env.DB, { userId, language, now: new Date(), profile });
      return { ok: true, notice: appCopy[language].profile.updated } satisfies ActionResult;
    }
  } catch (error) {
    logFailure({ request, error, operation: "route" });
    return failed(
      500,
      intent === "template"
        ? t.template.templateFailed
        : intent === "profile"
          ? appCopy[language].errors.unexpected
          : t.saveFailed,
    );
  }
  return securityAction(request, area, form);
}

/** Un'interruzione di rete non conferma l'esito remoto: la scelta torna com'era. */
export async function clientAction({ request, serverAction }: Route.ClientActionArgs) {
  try {
    return await serverAction();
  } catch (error) {
    if (error instanceof Response || isRouteErrorResponse(error) || request.signal.aborted)
      throw error;
    const language = languageFromPath(new URL(request.url).pathname);
    return { ok: false, notice: appCopy[language].errors.unconfirmed } satisfies ActionResult;
  }
}

export default function Settings({ loaderData }: Route.ComponentProps) {
  const { language, account, shell } = loaderData;
  const t = appCopy[language];
  const links: AppLinks = { language, base: appBase };
  return (
    <AccountShell
      key={loaderData.userId}
      language={language}
      account={account}
      shell={shell}
      security
    >
      {loaderData.notFound ? (
        <NotFoundState kind="page" t={t} links={links} />
      ) : (
        <SettingsPage data={loaderData.page} t={t} links={links} />
      )}
    </AccountShell>
  );
}
