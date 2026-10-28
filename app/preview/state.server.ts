import { env } from "cloudflare:workers";
import { createCookie, data, redirect } from "react-router";

import { appCopy, type AppCopy } from "../app-copy";
import { isProduction, previewSettingsPath } from "../app-links";
import { languageFromPath, localizedPath } from "../i18n";
import type { ActionResult } from "../view-models";
import { isScenarioId, loadScenario, type ScenarioId } from "./scenarios.server";

/** Scenario scelto e ordini sbloccati per finta: niente dati personali, solo identificativi sintetici. */
const previewCookie = createCookie("fb_anteprima", {
  path: "/",
  httpOnly: true,
  sameSite: "lax",
  secure: true,
  maxAge: 60 * 60 * 24 * 30,
});

export interface PreviewState {
  scenario: ScenarioId;
  unlocked: string[];
  /** Il salvataggio che lo scenario fa fallire una volta è già fallito. */
  saveFailed: boolean;
  retried?: string[];
  confirmUnlock?: boolean;
  /** Prova attivata per finta nello scenario corrente. */
  trialStarted?: boolean;
  /** Letture in pausa per inattività riprese per finta nello scenario corrente. */
  resumed?: boolean;
  /** Risposta alla proposta del consenso: come nell'area reale, non torna. */
  marketingAnswered?: boolean;
}

/** L'anteprima esiste solo negli ambienti non Production. */
export function assertPreviewAvailable() {
  if (isProduction(env)) throw data(null, { status: 404 });
}

export async function readPreviewState(request: Request): Promise<PreviewState> {
  const value: unknown = await previewCookie.parse(request.headers.get("Cookie"));
  if (
    typeof value === "object" &&
    value !== null &&
    "scenario" in value &&
    isScenarioId(value.scenario) &&
    "unlocked" in value &&
    Array.isArray(value.unlocked)
  ) {
    return {
      scenario: value.scenario,
      unlocked: value.unlocked.filter((id): id is string => typeof id === "string").slice(0, 50),
      saveFailed: "saveFailed" in value && value.saveFailed === true,
      confirmUnlock: !("confirmUnlock" in value && value.confirmUnlock === false),
      trialStarted: "trialStarted" in value && value.trialStarted === true,
      resumed: "resumed" in value && value.resumed === true,
      marketingAnswered: "marketingAnswered" in value && value.marketingAnswered === true,
      retried:
        "retried" in value && Array.isArray(value.retried)
          ? value.retried.filter((id): id is string => typeof id === "string").slice(0, 50)
          : [],
    };
  }
  return { scenario: "ordinario", unlocked: [], saveFailed: false };
}

export function writePreviewState(state: PreviewState) {
  return previewCookie.serialize(state, { secure: env.APP_ORIGIN.startsWith("https:") });
}

/** Scenario corrente nella lingua della richiesta. */
export async function currentScenario(request: Request) {
  assertPreviewAvailable();
  const state = await readPreviewState(request);
  const language = languageFromPath(new URL(request.url).pathname);
  const scenario = loadScenario(state.scenario, language, new Set(state.unlocked), {
    trialStarted: state.trialStarted,
    resumed: state.resumed,
  });
  const retried = new Set(state.retried);
  for (const order of scenario.orders) {
    if (order.fiscal.state === "error" && retried.has(order.id))
      order.fiscal = { state: "checking" };
  }
  return {
    state,
    language,
    scenario,
  };
}

/**
 * Scenario di una pagina dell'anteprima. Con Auth o database non disponibili la pagina risponde
 * come quella reale, con un 503 senza dati.
 */
export async function pageScenario(request: Request) {
  const current = await currentScenario(request);
  if (current.scenario.unavailable)
    throw data(null, { status: 503, headers: { "cache-control": "no-store" } });
  return current;
}

/** Azioni senza effetto dell'anteprima: la risposta ha la forma di quelle reali. */
const notices: Record<string, (t: AppCopy) => string | undefined> = {
  "export-create": (t) => t.settings.export.exportCreated,
  "export-download": (t) => t.settings.export.exportCreated,
  "export-save": (t) => t.settings.export.exportConfigSimulated,
  "export-delete": (t) => t.settings.export.exportConfigSimulated,
  retry: (t) => t.orders.retried,
  profile: (t) => t.profile.saved,
  template: () => undefined,
  support: () => undefined,
  "free-store": (t) => t.settings.plan.freeStoreChanged,
  "change-period": (t) => t.settings.plan.periodChanged,
};

/** Esito della Sicurezza per ogni azione, lo stesso dell'area reale quando riesce. */
const securityNotices: Record<string, string | null> = {
  "collega-metodo": "metodo-collegato",
  "rimuovi-metodo": "metodo-rimosso",
  "passkey-add": "metodo-collegato",
  "passkey-remove": "passkey-rimossa",
  "passkey-rename": "passkey-rinominata",
  password: "password-link",
  "cambia-email": "email-richiesta",
  "reinvia-email": "email-richiesta",
  "esci-sessione": "sessione-chiusa",
  "esci-altri": "sessioni-chiuse",
  riautentica: null,
};

/**
 * Azioni della Sicurezza con le stesse risposte dell'area reale: l'esito torna nell'indirizzo
 * della categoria e la conferma dell'identità riesce sempre. Null per le altre azioni.
 */
export function simulateSecurity(request: Request, form: FormData) {
  assertPreviewAvailable();
  const intent = String(form.get("intent") ?? "");
  if (intent === "conferma-accesso") return data<ActionResult>({ ok: true });
  if (!Object.hasOwn(securityNotices, intent)) return null;
  const language = languageFromPath(new URL(request.url).pathname);
  const security = localizedPath(language, `${previewSettingsPath}/sicurezza`);
  // Uscita e nuovo accesso simulati: si torna alla categoria da cui sono partiti, come dopo
  // il nuovo accesso reale (Sicurezza o Dati e privacy).
  if (intent === "riautentica") {
    const privacy = localizedPath(language, `${previewSettingsPath}/privacy`);
    return redirect(form.get("returnTo") === privacy ? privacy : security, 303);
  }
  const notice = securityNotices[intent];
  return redirect(notice ? `${security}?accesso=${notice}` : security, 303);
}

/**
 * Risposta simulata a un'azione dei componenti. Il primo salvataggio dello
 * scenario che lo prevede fallisce, per mostrare il ripristino del valore.
 */
export async function simulateAction(request: Request, form: FormData) {
  const { state, language, scenario } = await currentScenario(request);
  const t = appCopy[language];
  const intent = String(form.get("intent") ?? "");
  if (intent === "unlock-confirmation")
    return data<ActionResult>(
      { ok: true },
      { headers: { "Set-Cookie": await writePreviewState({ ...state, confirmUnlock: true }) } },
    );
  if (intent === "retry") {
    const id = String(form.get("order") ?? "");
    if (!scenario.orders.some((order) => order.id === id && order.fiscal.state === "error"))
      return data<ActionResult>({ ok: false, notice: t.stores.failed }, { status: 409 });
    const down = scenario.notices.find((notice) => notice.kind === "ebay-down");
    if (down)
      return data<ActionResult>(
        { ok: false, notice: down.maintenance ? t.stores.ebayPaused : t.stores.ebayDown },
        { status: 409 },
      );
    return data<ActionResult>(
      { ok: true, notice: t.orders.retried },
      {
        headers: {
          "Set-Cookie": await writePreviewState({
            ...state,
            retried: [...new Set([...(state.retried ?? []), id])],
          }),
        },
      },
    );
  }
  // Come nell'area reale la prova parte una volta sola e soltanto se disponibile.
  if (intent === "start-trial") {
    if (!scenario.account.trialAvailable)
      return data<ActionResult>(
        { ok: false, notice: t.settings.plan.trialUnavailable },
        { status: 409 },
      );
    return data<ActionResult>(
      { ok: true, notice: t.settings.plan.trialStarted },
      { headers: { "Set-Cookie": await writePreviewState({ ...state, trialStarted: true }) } },
    );
  }
  // La ripresa di un negozio in pausa per inattività riprende tutti quelli dello spazio.
  if (
    intent === "store-resume" &&
    scenario.stores.some((store) => store.pauseReason === "inactivity")
  )
    return data<ActionResult>(
      { ok: true, notice: t.stores.done["store-resume"] },
      { headers: { "Set-Cookie": await writePreviewState({ ...state, resumed: true }) } },
    );
  // Proposta del consenso: la risposta ha l'esito dell'area reale e la proposta non torna.
  if (intent === "marketing") {
    const value = form.get("value");
    if (value !== "true" && value !== "false")
      return data<ActionResult>({ ok: false, notice: t.settings.saveFailed }, { status: 400 });
    return data<ActionResult>(
      {
        ok: true,
        notice:
          value === "true"
            ? t.orders.marketingProposal.accepted
            : t.orders.marketingProposal.declined,
      },
      {
        headers: {
          "Set-Cookie": await writePreviewState({ ...state, marketingAnswered: true }),
        },
      },
    );
  }
  if (intent === "save" && scenario.saveFailsOnce && !state.saveFailed) {
    return data<ActionResult>(
      { ok: false },
      {
        status: 503,
        headers: { "Set-Cookie": await writePreviewState({ ...state, saveFailed: true }) },
      },
    );
  }
  if (intent === "save") return { ok: true } satisfies ActionResult;
  // Al posto di Stripe, il ritorno con il pagamento in verifica.
  if (intent === "buy" && scenario.stripeDown)
    return data<ActionResult>(
      { ok: false, notice: t.settings.plan.checkoutUnavailable },
      { status: 503 },
    );
  if (intent === "buy")
    return redirect(
      `${localizedPath(language, `${previewSettingsPath}/piano`)}?checkout=${form.get("plan") === "lifetime" ? "lifetime" : "processing"}`,
    );
  // Come nell'area reale serve l'indirizzo dell'account; il link non parte.
  if (intent === "account-delete") {
    const email = scenario.account.email;
    if (
      String(form.get("confirmation") ?? "")
        .trim()
        .toLowerCase() !== email.toLowerCase()
    )
      return data<ActionResult>(
        { ok: false, notice: t.settings.privacy.deleteAccountMismatch },
        { status: 400 },
      );
    return { ok: true, notice: t.settings.privacy.deleteAccountSent(email) } satisfies ActionResult;
  }
  const notice = notices[intent] ? notices[intent](t) : t.preview.simulated;
  return { ok: true, notice } satisfies ActionResult;
}
