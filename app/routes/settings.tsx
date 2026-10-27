import { env } from "cloudflare:workers";
import { data, redirect } from "react-router";

import { NotFoundState } from "~/components/not-found";
import { SettingsPage, type SettingsPageData } from "~/components/settings/page";
import { accessNotice } from "../access-notice";
import { unconfirmedOnFailure } from "../client-action";
import {
  areaPage,
  assertSameOrigin,
  requireAccountArea,
  type AccountArea,
} from "../account-area.server";
import { sendEmail } from "../account-email.server";
import { planDiagnostics } from "../support";
import { listStores } from "../domain/stores.server";
import {
  appVersion,
  parseSupportRequest,
  supportDiagnostics,
  supportEmailMessage,
} from "../domain/support.server";
import { releaseSupportRequest, reserveSupportRequest } from "../domain/support-requests.server";
import { appCopy, pageTitle } from "../app-copy";
import { checkoutReturn, purchaseStateFrom } from "../catalog";
import {
  checkoutConfigured,
  checkoutOffers,
  isCheckoutOffer,
  purchaseState,
  startCheckout,
} from "../domain/checkout.server";
import { changeSubscriptionPeriod, openBillingPortal } from "../domain/billing.server";
import { admission } from "../domain/admission.server";
import { pendingEmailChange } from "../domain/email-change.server";
import { lifetimeContext } from "../domain/lifetime.server";
import { chooseFreeStore, freeStoreState } from "../domain/free-store.server";
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
import {
  parseTelegramChange,
  saveTelegramChange,
  startTelegramLink,
  telegramSettings,
} from "../domain/telegram.server";
import { stripeSecretKey } from "../integrations/stripe.server";
import { telegramConfigured } from "../integrations/telegram.server";
import { appUrl, planPath } from "../app-links";
import { correlationId, logFailure } from "../errors";
import { whatsNew } from "../whats-new.server";
import { languageFromPath } from "../i18n";
import { measure } from "../observability.server";
import { securityAction } from "../security-actions.server";
import { effectiveTimeZone } from "../preferences";
import {
  settingsSections,
  type ActionResult,
  type DiagnosticsView,
  type SettingsSection,
} from "../view-models";
import { formatDate } from "../format";
import type { Route } from "./+types/settings";
import { subscriptionView } from "../domain/plan-view.server";

/**
 * Categorie con un servizio reale. L'esportazione arriva con il file degli ordini; esportazione e
 * cancellazione dell'account compaiono in Dati e privacy insieme ai loro servizi. L'acquisto compare con la configurazione Stripe, la gestione dell'abbonamento
 * con il portale di Stripe, le notifiche Telegram con il bot dell'ambiente.
 */
const sections = settingsSections.filter((section) => section !== "esportazione");
const services = (): SettingsPageData["services"] => ({
  billing: checkoutConfigured(env),
  billingPortal: !!stripeSecretKey(env),
  telegram: telegramConfigured(env),
  accountData: false,
  support: true,
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
      },
      { status: 404 },
    );
  }
  const userId = session.user.id;
  const now = new Date();
  const auth = session as AuthSession;
  const timeZone = effectiveTimeZone(preferences.timeZone, area.detectedTimeZone);
  const [
    allowance,
    purchase,
    lifetime,
    freeStore,
    confirmUnlock,
    marketing,
    methods,
    sessions,
    pendingEmail,
    telegram,
    admissionState,
  ] = await measure("d1", "settings", () =>
    Promise.all([
      orderAllowance(env.DB, userId, now),
      purchaseState(env.DB, userId, now),
      lifetimeContext(env.DB, env, userId, now),
      freeStoreState(env.DB, userId, now),
      unlockConfirmation(env.DB, userId),
      marketingConsent(env.DB, userId),
      listSignInMethods(env.DB, userId),
      listActiveSessions(env.DB, userId, session.session.id, language, now),
      pendingEmailChange(env.DB, userId, session.user.email),
      telegramConfigured(env) ? telegramSettings(env.DB, userId, timeZone) : null,
      admission(env.DB, userId),
    ]),
  );
  const subscription = await measure("d1", "settings", () => subscriptionState(allowance, now));
  const accountView = {
    ...account,
    profile,
    ...planFields(allowance, admissionState.waiting, subscription),
  };
  const page: SettingsPageData = {
    confirmUnlock,
    section: params.sezione ?? null,
    sections,
    services: services(),
    account: accountView,
    purchase: {
      // Senza spazio nessun negozio è collegato: l'acquisto attende la prima lettura.
      state:
        purchase?.state ??
        purchaseStateFrom({ covered: false, open: admissionState.purchasesOpen, synced: false }),
      offers: checkoutOffers,
      lifetime: lifetime?.offer ?? null,
      checkout: checkoutReturn(new URL(request.url).searchParams),
    },
    freeStore,
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
    diagnostics: await readDiagnostics(request, area, accountView, now),
    whatsNew: whatsNew.length > 0,
    telegram,
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
  };
}

type Allowance = Awaited<ReturnType<typeof orderAllowance>>;

/** Periodo dell'abbonamento, pagamento da confermare o rinnovo non riuscito. */
function subscriptionState(allowance: Allowance, now: Date) {
  return allowance
    ? subscriptionView(env.DB, env, allowance.workspaceId, allowance.coverage, now)
    : Promise.resolve({});
}

/** Piano, prova, lista d'attesa, sblocchi e abbonamento dell'account. */
function planFields(
  allowance: Allowance,
  waiting: boolean,
  subscription: Awaited<ReturnType<typeof subscriptionState>>,
) {
  const cycle = allowance?.cycle;
  return {
    plan: allowance?.premium ? ("premium" as const) : ("free" as const),
    trialAvailable: allowance?.trialAvailable ?? false,
    ...(waiting && !allowance?.premium ? { waitlisted: true } : {}),
    ...accountCoverage(allowance),
    ...subscription,
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
  };
}

/**
 * Riepilogo diagnostico dell'assistenza, dai soli negozi dello spazio dell'utente. Una lettura
 * che non riesce lascia il modulo senza riepilogo: la richiesta si invia lo stesso.
 */
async function readDiagnostics(
  request: Request,
  area: AccountArea,
  account: Parameters<typeof planDiagnostics>[0],
  now: Date,
): Promise<DiagnosticsView | null> {
  try {
    const stores = await measure("d1", "settings", () =>
      listStores(env.DB, area.session.user.id, now),
    );
    return supportDiagnostics({
      stores,
      plan: planDiagnostics(account, appCopy[area.language]),
      version: appVersion(env),
      correlationId: correlationId(request),
      language: area.language,
      timeZone: effectiveTimeZone(area.preferences.timeZone, area.detectedTimeZone),
    });
  } catch (error) {
    logFailure({ request, error, operation: "support" });
    return null;
  }
}

/** Riepilogo allegato all'invio, riletto con il piano corrente; null se non si legge. */
async function attachedDiagnostics(request: Request, area: AccountArea, now: Date) {
  const userId = area.session.user.id;
  try {
    const [allowance, admissionState] = await Promise.all([
      orderAllowance(env.DB, userId, now),
      admission(env.DB, userId),
    ]);
    const subscription = await subscriptionState(allowance, now);
    return await readDiagnostics(
      request,
      area,
      planFields(allowance, admissionState.waiting, subscription),
      now,
    );
  } catch (error) {
    logFailure({ request, error, operation: "support" });
    return null;
  }
}

/**
 * Richiesta di assistenza verso `supporto@`, con Reply-To sull'indirizzo dell'account. Il
 * riepilogo si rilegge qui, mai dal browser; senza riepilogo la richiesta parte lo stesso.
 */
async function sendSupport(request: Request, area: AccountArea, form: FormData) {
  const t = appCopy[area.language].settings.support;
  const failed = (status: number, notice: string) =>
    data<ActionResult>({ ok: false, notice }, { status });
  const support = parseSupportRequest(form);
  if (!support) return failed(400, t.invalid);
  const userId = area.session.user.id;
  const now = new Date();
  const reserved = await reserveSupportRequest(env.DB, userId, now);
  if (!reserved) return failed(429, t.limited);
  const diagnostics = support.diagnostics ? await attachedDiagnostics(request, area, now) : null;
  try {
    await sendEmail(
      env,
      supportEmailMessage(env, {
        request: support,
        userId,
        email: area.session.user.email,
        language: area.language,
        diagnostics,
      }),
    );
  } catch (error) {
    logFailure({ request, error, operation: "support" });
    await releaseSupportRequest(env.DB, reserved);
    return failed(503, t.sendFailed);
  }
  return { ok: true } satisfies ActionResult;
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
      const telegram = parseTelegramChange(name, value);
      if (telegram) {
        if (!telegramConfigured(env)) return failed(409, t.saveFailed);
        const zone = effectiveTimeZone(area.preferences.timeZone, area.detectedTimeZone);
        if (!(await saveTelegramChange(env.DB, userId, telegram, zone)))
          return failed(404, t.saveFailed);
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
    if (intent === "telegram-link") {
      // Il modulo apre una nuova scheda: il link porta al bot dell'ambiente.
      if (!telegramConfigured(env)) return failed(409, t.notifications.telegramUnavailable);
      const link = await startTelegramLink(env.DB, env, {
        userId,
        sessionId: session.session.id,
        language,
        timeZone: effectiveTimeZone(area.preferences.timeZone, area.detectedTimeZone),
      });
      if ("url" in link) return redirect(link.url);
      return failed(409, t.notifications.telegramPremium);
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
      const notices = {
        covered: t.plan.checkoutCovered,
        "needs-sync": t.plan.purchaseNeedsSync,
        closed: t.plan.purchaseClosed,
        "sold-out": t.plan.lifetimeUnavailable,
        renewing: t.plan.lifetimeRenewing,
        unavailable: t.plan.checkoutUnavailable,
      } satisfies Record<typeof checkout.reason, string>;
      return failed(checkout.reason === "unavailable" ? 503 : 409, notices[checkout.reason]);
    }
    if (intent === "manage-billing") {
      const plan = appUrl(env, language, planPath);
      const url = await openBillingPortal(env, userId, plan, language);
      if (!url) return failed(409, t.plan.billingUnavailable);
      return redirect(url);
    }
    if (intent === "change-period") {
      const period = String(form.get("period") ?? "");
      if (period !== "monthly" && period !== "annual") return failed(400, t.plan.periodUnavailable);
      const change = await changeSubscriptionPeriod(env, userId, period);
      if (change === "done" || change === "unchanged")
        return { ok: true, notice: t.plan.periodChanged } satisfies ActionResult;
      return failed(change === "not_allowed" ? 409 : 503, t.plan.periodUnavailable);
    }
    if (intent === "free-store") {
      // La scelta e le pause sono un unico commit; un rifiuto lascia il negozio attivo com'era.
      const choice = await chooseFreeStore(env.DB, userId, String(form.get("store") ?? ""));
      if (choice.result === "done")
        return { ok: true, notice: t.plan.freeStoreChanged } satisfies ActionResult;
      if (choice.result === "locked")
        return failed(
          409,
          t.plan.freeStoreLocked(
            formatDate(
              choice.changeFrom,
              language,
              "date",
              effectiveTimeZone(area.preferences.timeZone, area.detectedTimeZone),
            ),
          ),
        );
      return failed(choice.result === "not_found" ? 404 : 409, t.plan.freeStoreUnavailable);
    }
    if (intent === "support") return await sendSupport(request, area, form);
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
          : intent === "manage-billing"
            ? t.plan.billingUnavailable
            : t.saveFailed,
    );
  }
  return securityAction(request, area, form);
}

export function clientAction(args: Route.ClientActionArgs) {
  return unconfirmedOnFailure(args);
}

export default function Settings({ loaderData }: Route.ComponentProps) {
  return loaderData.notFound ? (
    <NotFoundState kind="page" />
  ) : (
    <SettingsPage data={loaderData.page} />
  );
}
