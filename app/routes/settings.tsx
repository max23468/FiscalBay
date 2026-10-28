import { env } from "cloudflare:workers";
import { data, redirect } from "react-router";

import { NotFoundState } from "~/components/not-found";
import { SettingsPage, type SettingsPageData } from "~/components/settings/page";
import { accessNotice } from "../access-notice";
import { unconfirmedOnFailure } from "../client-action";
import {
  areaPage,
  assertSameOrigin,
  requestedEbayEnvironment,
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
import { orderAllowance, setUnlockConfirmation, unlockConfirmation } from "../domain/grants.server";
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
import { appUrl, exportFilePath, ordersPath, planPath } from "../app-links";
import { deletionReauthenticated } from "../domain/account-deletion.server";
import { correlationId, logFailure } from "../errors";
import { hasWhatsNew } from "../whats-new.server";
import { languageFromPath, localizedPath } from "../i18n";
import { measure } from "../observability.server";
import { requestAccountDeletion, securityAction } from "../security-actions.server";
import {
  orderPeriods,
  orderPeriodStart,
  settingsSections,
  type ActionResult,
  type DiagnosticsView,
  type OrderPeriod,
  type SettingsSection,
} from "../view-models";
import { listVisibleOrders, visibleOrderTallies, type OrderTally } from "../domain/orders.server";
import {
  deleteExportConfiguration,
  listExportConfigurations,
  maxExportConfigurations,
  parseConfigurationName,
  parseExportLayout,
  saveExportConfiguration,
} from "../domain/export-configurations.server";
import { exportContext } from "../orders/export-scope";
import { listExportFiles } from "../domain/export-jobs.server";
import { exportRevision, publishExportFile } from "../domain/export-files.server";
import { accountArchive, accountArchiveName, accountData } from "../domain/account-export.server";
import { accountExportScope } from "../orders/export-scope.server";
import { formatDate } from "../format";
import type { Route } from "./+types/settings";
import { planView, subscriptionView } from "../domain/plan-view.server";
import {
  actionFailure,
  areaAction,
  runAreaAction,
  trialAction,
  type AreaAction,
  type AreaActionContext,
} from "../area-actions.server";

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
      telegramConfigured(env) ? telegramSettings(env.DB, userId, timeZone) : null,
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

type Allowance = Awaited<ReturnType<typeof orderAllowance>>;

/** Periodo dell'abbonamento, pagamento da confermare o rinnovo non riuscito. */
function subscriptionState(allowance: Allowance, now: Date) {
  return allowance
    ? subscriptionView(env.DB, env, allowance.workspaceId, allowance.coverage, now)
    : Promise.resolve({});
}

/**
 * Riepilogo diagnostico dell'assistenza, dai soli negozi dello spazio dell'utente. Una lettura
 * che non riesce lascia il modulo senza riepilogo: la richiesta si invia lo stesso. Il
 * riferimento è il correlation ID della pagina, oppure quello già mostrato all'utente.
 */
async function readDiagnostics(
  request: Request,
  area: AccountArea,
  account: Parameters<typeof planDiagnostics>[0],
  now: Date,
  reference = correlationId(request),
): Promise<DiagnosticsView | null> {
  try {
    const stores = await measure("d1", "settings", () =>
      listStores(env.DB, area.session.user.id, now),
    );
    return supportDiagnostics({
      stores,
      plan: planDiagnostics(account, appCopy[area.language]),
      version: appVersion(env),
      correlationId: reference,
      language: area.language,
      timeZone: area.timeZone,
    });
  } catch (error) {
    logFailure({ request, error, operation: "support" });
    return null;
  }
}

/**
 * Riepilogo allegato all'invio, riletto con il piano corrente; null se non si legge. Porta il
 * correlation ID mostrato nel modulo, così l'assistenza cerca lo stesso riferimento dell'utente.
 */
async function attachedDiagnostics(
  request: Request,
  area: AccountArea,
  now: Date,
  reference: string | null,
) {
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
      { ...planView(allowance, "plan", admissionState.waiting), ...subscription },
      now,
      reference ?? correlationId(request),
    );
  } catch (error) {
    logFailure({ request, error, operation: "support" });
    return null;
  }
}

/**
 * Richiesta di assistenza verso `supporto@`, con Reply-To sull'indirizzo dell'account. Il
 * riepilogo si rilegge qui, mai dal browser, che fornisce soltanto il correlation ID già
 * mostrato; senza riepilogo la richiesta parte lo stesso.
 */
async function sendSupport(request: Request, area: AccountArea, form: FormData) {
  const t = appCopy[area.language].settings.support;
  const support = parseSupportRequest(form);
  if (!support) return actionFailure(400, t.invalid);
  const userId = area.session.user.id;
  const now = new Date();
  const reserved = await reserveSupportRequest(env.DB, userId, now);
  if (!reserved) return actionFailure(429, t.limited);
  const diagnostics = support.diagnostics
    ? await attachedDiagnostics(request, area, now, support.reference)
    : null;
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
    return actionFailure(503, t.sendFailed);
  }
  return { ok: true } satisfies ActionResult;
}

/**
 * Ordini dell'esportazione con il conteggio dell'elenco: l'ambito ricevuto dagli Ordini, con le
 * loro regole, oppure ogni periodo quando la sezione è aperta dalle Impostazioni.
 */
async function exportSection(
  request: Request,
  area: AccountArea,
  section: boolean,
  premium: boolean,
  now: Date,
): Promise<Pick<SettingsPageData, "exportContext" | "exportPeriods">> {
  const userId = area.session.user.id;
  const query = new URL(request.url).searchParams;
  const environment = requestedEbayEnvironment(request);
  // Soltanto la sezione Esportazione riceve l'ambito degli Ordini.
  const fromOrders = section
    ? await accountExportScope(area, query, environment, premium, now)
    : null;
  if (!fromOrders) {
    const starts = orderPeriods.map((period) => orderPeriodStart(period, now).toISOString());
    const tallies = await visibleOrderTallies(
      env.DB,
      userId,
      environment,
      now,
      { criteria: { listedBefore: now.toISOString() } },
      starts,
    );
    return {
      exportContext: null,
      exportPeriods: Object.fromEntries(
        orderPeriods.map((period, index) => [period, tallies[index]!]),
      ) as Record<OrderPeriod, OrderTally>,
    };
  }
  const { scope, filter } = fromOrders;
  const single = scope.kind === "orders" && scope.ids.length === 1;
  const [[estimate], listed] = await Promise.all([
    visibleOrderTallies(env.DB, userId, environment, now, filter),
    single
      ? listVisibleOrders(env.DB, userId, 1, environment, now, { ...filter, suggestions: false })
      : [],
  ]);
  return {
    exportContext: exportContext(
      scope,
      query,
      localizedPath(area.language, ordersPath),
      listed[0]?.ebayOrderId ?? null,
      estimate!,
    ),
    exportPeriods: null,
  };
}

/** Preferenze salvate a ogni modifica: consenso, conferma dello sblocco, Telegram e aspetto. */
async function savePreferenceChange({ area, form }: AreaActionContext) {
  const t = appCopy[area.language].settings;
  const userId = area.session.user.id;
  const name = String(form.get("name") ?? "");
  const value = String(form.get("value") ?? "");
  if (name === "marketing" && (value === "true" || value === "false")) {
    await recordMarketingConsent(env.DB, userId, value === "true", area.language, "settings");
    return { ok: true } satisfies ActionResult;
  }
  if (name === "unlock-confirmation" && (value === "true" || value === "false")) {
    await setUnlockConfirmation(env.DB, userId, value === "true");
    return { ok: true } satisfies ActionResult;
  }
  const telegram = parseTelegramChange(name, value);
  if (telegram) {
    if (!telegramConfigured(env)) return actionFailure(409, t.saveFailed);
    if (!(await saveTelegramChange(env.DB, userId, telegram, area.timeZone)))
      return actionFailure(404, t.saveFailed);
    return { ok: true } satisfies ActionResult;
  }
  const change = parsePreference(name, value);
  // La lingua cambia l'indirizzo della pagina: ha il proprio percorso.
  if (!change || change.name === "language") return actionFailure(400, t.saveFailed);
  await savePreference(env.DB, userId, change);
  return { ok: true } satisfies ActionResult;
}

/** Esito di Stripe per ogni acquisto rifiutato, con lo stato HTTP. */
async function buy({ request, area, form }: AreaActionContext) {
  const t = appCopy[area.language].settings.plan;
  const offer = String(form.get("plan") ?? "");
  if (!isCheckoutOffer(offer)) return actionFailure(400, t.checkoutUnavailable);
  const checkout = await startCheckout(env, {
    request,
    userId: area.session.user.id,
    email: area.session.user.email,
    offer,
    language: area.language,
  });
  if (checkout.ok) return redirect(checkout.url);
  const notices = {
    covered: t.checkoutCovered,
    "needs-sync": t.purchaseNeedsSync,
    closed: t.purchaseClosed,
    "sold-out": t.lifetimeUnavailable,
    renewing: t.lifetimeRenewing,
    unavailable: t.checkoutUnavailable,
  } satisfies Record<typeof checkout.reason, string>;
  return actionFailure(checkout.reason === "unavailable" ? 503 : 409, notices[checkout.reason]);
}

/** Il file nasce soltanto se nessuna revoca dello spazio arriva durante la lettura. */
async function exportAccount({ area }: AreaActionContext) {
  const { language, timeZone } = area;
  const userId = area.session.user.id;
  const now = new Date();
  const revision = await exportRevision(env.DB, userId);
  const archive = accountArchive(await accountData(env.DB, userId), language, timeZone, now);
  const id = await publishExportFile(env, {
    userId,
    revision,
    fileName: accountArchiveName(language, now, timeZone),
    contentType: "application/zip",
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(archive);
        controller.close();
      },
    }),
    now,
  });
  if (!id) return actionFailure(409, appCopy[language].settings.privacy.accountExportFailed);
  return {
    ok: true,
    download: localizedPath(language, exportFilePath(id)),
  } satisfies ActionResult;
}

/**
 * Scelte semplici salvate a ogni modifica, modello di messaggio con Salva, piano, esportazione,
 * assistenza e privacy. Un rifiuto o un errore non è mai presentato come salvataggio riuscito.
 */
const settingsActions: Record<string, AreaAction> = {
  save: { run: savePreferenceChange, failureNotice: (t) => t.settings.saveFailed },
  template: {
    run: async ({ area, form }) => {
      const templates = parseTemplates(form);
      if (!templates)
        return actionFailure(400, appCopy[area.language].settings.template.templateInvalid);
      await saveTemplates(env.DB, area.session.user.id, templates);
      return { ok: true } satisfies ActionResult;
    },
    failureNotice: (t) => t.settings.template.templateFailed,
  },
  "export-save": {
    run: async ({ area, form }) => {
      const t = appCopy[area.language].settings.export;
      const userId = area.session.user.id;
      // Le configurazioni si salvano soltanto con Premium, riletto all'istante della richiesta.
      const layout = parseExportLayout(form);
      const name = parseConfigurationName(form);
      if (!layout || !name) return actionFailure(400, t.exportConfigInvalid);
      if (!(await orderAllowance(env.DB, userId, new Date()))?.premium)
        return actionFailure(403, t.exportPremium);
      if (!(await saveExportConfiguration(env.DB, userId, name, layout, new Date())))
        return actionFailure(409, t.exportConfigFull(maxExportConfigurations));
      return { ok: true, notice: t.exportConfigSaved } satisfies ActionResult;
    },
    failureNotice: (t) => t.settings.export.exportConfigFailed,
  },
  "export-delete": {
    run: async ({ area, form }) => {
      const t = appCopy[area.language].settings.export;
      const id = String(form.get("id") ?? "");
      if (!(await deleteExportConfiguration(env.DB, area.session.user.id, id)))
        return actionFailure(404, t.exportConfigInvalid);
      return { ok: true, notice: t.exportConfigDeleted } satisfies ActionResult;
    },
    failureNotice: (t) => t.settings.saveFailed,
  },
  "telegram-link": {
    run: async ({ area }) => {
      const t = appCopy[area.language].settings.notifications;
      // Il modulo apre una nuova scheda: il link porta al bot dell'ambiente.
      if (!telegramConfigured(env)) return actionFailure(409, t.telegramUnavailable);
      const link = await startTelegramLink(env.DB, env, {
        userId: area.session.user.id,
        sessionId: area.session.session.id,
        language: area.language,
        timeZone: area.timeZone,
      });
      if ("url" in link) return redirect(link.url);
      return actionFailure(409, t.telegramPremium);
    },
    failureNotice: (t) => t.settings.saveFailed,
  },
  "start-trial": trialAction,
  buy: { run: buy, failureNotice: (t) => t.settings.saveFailed },
  "manage-billing": {
    run: async ({ area }) => {
      const plan = appUrl(env, area.language, planPath);
      const url = await openBillingPortal(env, area.session.user.id, plan, area.language);
      if (!url) return actionFailure(409, appCopy[area.language].settings.plan.billingUnavailable);
      return redirect(url);
    },
    failureNotice: (t) => t.settings.plan.billingUnavailable,
  },
  "change-period": {
    run: async ({ area, form }) => {
      const t = appCopy[area.language].settings.plan;
      const period = String(form.get("period") ?? "");
      if (period !== "monthly" && period !== "annual")
        return actionFailure(400, t.periodUnavailable);
      const change = await changeSubscriptionPeriod(env, area.session.user.id, period);
      if (change === "done" || change === "unchanged")
        return { ok: true, notice: t.periodChanged } satisfies ActionResult;
      return actionFailure(change === "not_allowed" ? 409 : 503, t.periodUnavailable);
    },
    failureNotice: (t) => t.settings.saveFailed,
  },
  "free-store": {
    run: async ({ area, form }) => {
      const t = appCopy[area.language].settings.plan;
      // La scelta e le pause sono un unico commit; un rifiuto lascia il negozio attivo com'era.
      const store = String(form.get("store") ?? "");
      const choice = await chooseFreeStore(env.DB, area.session.user.id, store);
      if (choice.result === "done")
        return { ok: true, notice: t.freeStoreChanged } satisfies ActionResult;
      if (choice.result === "locked")
        return actionFailure(
          409,
          t.freeStoreLocked(formatDate(choice.changeFrom, area.language, "date", area.timeZone)),
        );
      return actionFailure(choice.result === "not_found" ? 404 : 409, t.freeStoreUnavailable);
    },
    failureNotice: (t) => t.settings.saveFailed,
  },
  support: {
    run: ({ request, area, form }) => sendSupport(request, area, form),
    failureNotice: (t) => t.settings.saveFailed,
  },
  "account-export": {
    run: exportAccount,
    failureNotice: (t) => t.settings.privacy.accountExportFailed,
  },
  "account-delete": {
    run: ({ request, area, form }) =>
      requestAccountDeletion(request, area, String(form.get("confirmation") ?? "")),
    failureNotice: (t) => t.settings.privacy.deleteAccountFailed,
  },
  profile: {
    run: async ({ area, form }) => {
      const t = appCopy[area.language].profile;
      // Nome, cognome e ragione sociale; il tipo di account resta quello registrato.
      form.set("tipo", area.profile.accountType === "business" ? "azienda" : "privato");
      const profile = parseProfile(form);
      if (!profile) return actionFailure(400, t.invalid);
      await completeRegistration(env.DB, {
        userId: area.session.user.id,
        language: area.language,
        now: new Date(),
        profile,
      });
      return { ok: true, notice: t.updated } satisfies ActionResult;
    },
    failureNotice: (t) => t.errors.unexpected,
  },
};

/** Le azioni delle Impostazioni; le altre sono della Sicurezza. */
export async function action({ request }: Route.ActionArgs) {
  assertSameOrigin(request);
  const area = await requireAccountArea(request);
  const form = await request.formData();
  const chosen = areaAction(settingsActions, String(form.get("intent") ?? ""));
  return chosen
    ? runAreaAction(chosen, { request, area, form })
    : securityAction(request, area, form);
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
