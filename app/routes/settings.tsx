import { env } from "cloudflare:workers";
import { data, redirect } from "react-router";

import { NotFoundState } from "~/components/not-found";
import { SettingsPage, type SettingsPageData } from "~/components/settings/page";
import { accessNotice } from "../access-notice";
import { unconfirmedOnFailure } from "../client-action";
import { areaPage, assertSameOrigin, requireAccountArea } from "../account-area.server";
import { appCopy, pageTitle } from "../app-copy";
import { checkoutReturn, purchaseStateFrom } from "../catalog";
import { checkoutConfigured, checkoutOffers, purchaseState } from "../domain/checkout.server";
import { admission } from "../domain/admission.server";
import { pendingEmailChange } from "../domain/email-change.server";
import { lifetimeContext } from "../domain/lifetime.server";
import { freeStoreState } from "../domain/free-store.server";
import { orderAllowance, unlockConfirmation } from "../domain/grants.server";
import { marketingConsent, messageTemplates } from "../domain/preferences.server";
import {
  listActiveSessions,
  passkeyChangeBlock,
  recentSignIn,
  type AuthSession,
} from "../domain/sessions.server";
import { listSignInMethods } from "../domain/sign-in-methods.server";
import { telegramSettings } from "../domain/telegram.server";
import { stripeSecretKey } from "../integrations/stripe.server";
import { botUrl, telegramConfigured } from "../integrations/telegram.server";
import { deletionReauthenticated } from "../domain/account-deletion.server";
import { hasWhatsNew } from "../whats-new.server";
import { languageFromPath } from "../i18n";
import { measure } from "../observability.server";
import { securityAction, securityAuthPath } from "../security-actions.server";
import { mergedSettingsSections, settingsSections, type SettingsSection } from "../view-models";
import { listExportConfigurations } from "../domain/export-configurations.server";
import { listExportFiles } from "../domain/export-jobs.server";
import type { Route } from "./+types/settings";
import { planView } from "../domain/plan-view.server";
import { areaAction, limitedAction, tooManyRequests, runAreaAction } from "../area-actions.server";
import { pageHeaders } from "../request-limits.server";
import { authLimitWait } from "../auth-route.server";
import {
  exportSection,
  readDiagnostics,
  settingsActions,
  subscriptionState,
} from "../settings-actions.server";

/**
 * Servizi reali delle categorie. L'acquisto compare con la configurazione Stripe, la gestione
 * dell'abbonamento con il portale di Stripe, le notifiche Telegram con il bot dell'ambiente.
 */
const services = (): SettingsPageData["services"] => ({
  billing: checkoutConfigured(env),
  billingPortal: !!stripeSecretKey(env),
  telegram: telegramConfigured(env),
  accountExport: true,
  accountDeletion: true,
  support: true,
});

function isSection(value: string | undefined): value is SettingsSection {
  return (settingsSections as readonly string[]).includes(value ?? "");
}

export function meta({ location, params }: Route.MetaArgs): Route.MetaDescriptors {
  const t = appCopy[languageFromPath(location.pathname)];
  const title = isSection(params.sezione)
    ? `${t.settings.sections[params.sezione].title} | ${t.settings.title}`
    : t.settings.title;
  return [{ title: pageTitle(title) }, { name: "robots", content: "noindex" }];
}

export const headers = pageHeaders;

export function loader(args: Route.LoaderArgs) {
  // Profilo e Sicurezza stanno in Account: i vecchi indirizzi, anche delle email, portano lì.
  const merged = mergedSettingsSections[args.params.sezione ?? ""];
  if (merged) {
    const url = new URL(args.request.url);
    throw redirect(`${url.pathname.replace(/[^/]+$/u, merged)}${url.search}`, 301);
  }
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
  const { timeZone } = area;
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
    exportConfigurations,
    exportFiles,
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
      telegramConfigured(env)
        ? telegramSettings(env.DB, userId, timeZone).then(
            (view) => view && { ...view, botUrl: botUrl(env) },
          )
        : null,
      admission(env.DB, userId),
      listExportConfigurations(env.DB, userId),
      listExportFiles(env.DB, userId, now),
    ]),
  );
  const [exportData, subscription] = await Promise.all([
    measure("d1", "settings", () =>
      exportSection(request, area, params.sezione === "esportazione", !!allowance?.premium, now),
    ),
    measure("d1", "settings", () => subscriptionState(allowance, now)),
  ]);
  const accountView = {
    ...account,
    profile,
    ...planView(allowance, "plan", admissionState.waiting),
    ...subscription,
  };
  const page: SettingsPageData = {
    confirmUnlock,
    section: params.sezione ?? null,
    sections: settingsSections,
    services: services(),
    account: accountView,
    termsUpdate: area.termsUpdate,
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
      deletionReady: deletionReauthenticated(auth.session.createdAt, now),
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
    whatsNew: hasWhatsNew(now),
    telegram,
    ...exportData,
    exportConfigurations,
    exportFiles,
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

/**
 * Le azioni delle Impostazioni; le altre sono della Sicurezza. Il filtro per IP di assistenza,
 * archivio dell'account e invii ad Auth precede la sessione.
 */
export async function action({ request }: Route.ActionArgs) {
  assertSameOrigin(request);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  const chosen = areaAction(settingsActions, intent);
  const limited = chosen?.limit ? await limitedAction(request, chosen.limit, intent) : null;
  if (limited) return limited;
  const authPath = securityAuthPath(intent, form);
  const wait = authPath ? await authLimitWait(env, request, authPath) : null;
  if (wait !== null) return tooManyRequests(request, wait);
  const area = await requireAccountArea(request);
  return chosen
    ? runAreaAction(chosen, { request, area, form })
    : securityAction(request, area, form, authPath !== null);
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
