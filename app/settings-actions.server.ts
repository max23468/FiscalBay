import { env } from "cloudflare:workers";
import { redirect } from "react-router";

import type { SettingsPageData } from "./components/settings/page";
import { requestedEbayEnvironment, type AccountArea } from "./account-area.server";
import { sendEmail } from "./account-email.server";
import { planDiagnostics } from "./support";
import { listStores } from "./domain/stores.server";
import {
  appVersion,
  parseSupportRequest,
  supportDiagnostics,
  supportEmailMessage,
} from "./domain/support.server";
import { releaseSupportRequest, reserveSupportRequest } from "./domain/support-requests.server";
import { appCopy } from "./app-copy";
import { isCheckoutOffer, startCheckout } from "./domain/checkout.server";
import { changeSubscriptionPeriod, openBillingPortal } from "./domain/billing.server";
import { admission } from "./domain/admission.server";
import { chooseFreeStore } from "./domain/free-store.server";
import { orderAllowance, setUnlockConfirmation } from "./domain/grants.server";
import { completeRegistration, parseProfile } from "./domain/registration.server";
import {
  parsePreference,
  parseTemplates,
  recordMarketingConsent,
  savePreference,
  saveTemplates,
} from "./domain/preferences.server";
import {
  parseTelegramChange,
  saveTelegramChange,
  startTelegramLink,
} from "./domain/telegram.server";
import { telegramConfigured } from "./integrations/telegram.server";
import { appUrl, exportFilePath, ordersPath, planPath } from "./app-links";
import { correlationId, logFailure } from "./errors";
import { localizedPath } from "./i18n";
import { measure } from "./observability.server";
import { requestAccountDeletion } from "./security-actions.server";
import {
  orderPeriods,
  orderPeriodStart,
  type ActionResult,
  type DiagnosticsView,
  type OrderPeriod,
} from "./view-models";
import { listVisibleOrders, visibleOrderTallies, type OrderTally } from "./domain/orders.server";
import {
  deleteExportConfiguration,
  maxExportConfigurations,
  parseConfigurationName,
  parseExportLayout,
  saveExportConfiguration,
} from "./domain/export-configurations.server";
import { exportContext } from "./orders/export-scope";
import { exportRevision, publishExportFile } from "./domain/export-files.server";
import { accountArchive, accountArchiveName, accountData } from "./domain/account-export.server";
import { accountExportScope, onlyAvailable, type ExportFilter } from "./orders/export-scope.server";
import { exportSampleOrders } from "./domain/order-export.server";
import type { ExportSample } from "./orders/export-columns";
import { formatDate } from "./format";
import { turnstileActions } from "./turnstile";
import { turnstileFailure } from "./turnstile.server";
import { planView, subscriptionView } from "./domain/plan-view.server";
import {
  actionFailure,
  trialAction,
  type AreaAction,
  type AreaActionContext,
} from "./area-actions.server";

type Allowance = Awaited<ReturnType<typeof orderAllowance>>;

/** Periodo dell'abbonamento, pagamento da confermare o rinnovo non riuscito. */
export function subscriptionState(allowance: Allowance, now: Date) {
  return allowance
    ? subscriptionView(env.DB, env, allowance.workspaceId, allowance.coverage, now)
    : Promise.resolve({});
}

/**
 * Riepilogo diagnostico dell'assistenza, dai soli negozi dello spazio dell'utente. Una lettura
 * che non riesce lascia il modulo senza riepilogo: la richiesta si invia lo stesso. Il
 * riferimento è il correlation ID della pagina, oppure quello già mostrato all'utente.
 */
export async function readDiagnostics(
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
  const check = await turnstileFailure(env, request, form, turnstileActions.support);
  if (check) {
    const notice = appCopy[area.language].access.signInNotices[check];
    return actionFailure(check === "verifica-non-disponibile" ? 503 : 400, notice);
  }
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
export async function exportSection(
  request: Request,
  area: AccountArea,
  section: boolean,
  premium: boolean,
  now: Date,
): Promise<Pick<SettingsPageData, "exportContext" | "exportPeriods" | "exportSample">> {
  const userId = area.session.user.id;
  const query = new URL(request.url).searchParams;
  const environment = requestedEbayEnvironment(request);
  // Soltanto la sezione Esportazione riceve l'ambito degli Ordini e legge le prime righe.
  const fromOrders = section
    ? await accountExportScope(area, query, environment, premium, now)
    : null;
  const sample = async (filter: ExportFilter): Promise<ExportSample | null> => {
    if (!section) return null;
    const read = (scoped: ExportFilter | null) =>
      exportSampleOrders(
        env.DB,
        userId,
        environment,
        now,
        scoped,
        appCopy[area.language],
        area.timeZone,
      );
    const [all, available] = await Promise.all([read(filter), read(onlyAvailable(filter))]);
    return { all, available };
  };
  if (!fromOrders) {
    const starts = orderPeriods.map((period) => orderPeriodStart(period, now).toISOString());
    const filter = { criteria: { listedBefore: now.toISOString() } };
    const [tallies, exportSample] = await Promise.all([
      visibleOrderTallies(env.DB, userId, environment, now, filter, starts),
      sample(filter),
    ]);
    return {
      exportContext: null,
      exportPeriods: Object.fromEntries(
        orderPeriods.map((period, index) => [period, tallies[index]!]),
      ) as Record<OrderPeriod, OrderTally>,
      exportSample,
    };
  }
  const { scope, filter } = fromOrders;
  const single = scope.kind === "orders" && scope.ids.length === 1;
  const [[estimate], listed, exportSample] = await Promise.all([
    visibleOrderTallies(env.DB, userId, environment, now, filter),
    single
      ? listVisibleOrders(env.DB, userId, 1, environment, now, { ...filter, suggestions: false })
      : [],
    sample(filter),
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
    exportSample,
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
export const settingsActions: Record<string, AreaAction> = {
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
    limit: "emails",
  },
  "account-export": {
    run: exportAccount,
    failureNotice: (t) => t.settings.privacy.accountExportFailed,
    limit: "work",
  },
  // La versione corrente dei Termini si accetta quando l'utente vuole: nulla la richiede prima.
  "accept-terms": {
    run: async ({ area }) => {
      await completeRegistration(env.DB, {
        userId: area.session.user.id,
        language: area.language,
        now: new Date(),
        agreement: {},
      });
      return {
        ok: true,
        notice: appCopy[area.language].settings.privacy.termsAccepted,
      } satisfies ActionResult;
    },
    failureNotice: (t) => t.settings.privacy.termsAcceptFailed,
  },
  "account-delete": {
    // Il filtro per IP di `/delete-user` l'ha già applicato l'action, prima della sessione.
    run: ({ request, area, form }) =>
      requestAccountDeletion(request, area, String(form.get("confirmation") ?? ""), true),
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
