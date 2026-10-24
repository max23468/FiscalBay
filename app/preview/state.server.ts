import { env } from "cloudflare:workers";
import { createCookie, data } from "react-router";

import { appCopy, type AppCopy } from "../app-copy";
import { isProduction } from "../app-links";
import { languageFromPath } from "../i18n";
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
  retry: (t) => t.orders.retried,
  profile: (t) => t.profile.saved,
  template: () => undefined,
  support: () => undefined,
};

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
    if (scenario.notices.some((notice) => notice.kind === "ebay-down"))
      return data<ActionResult>({ ok: false, notice: t.stores.ebayDown }, { status: 409 });
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
  const notice = notices[intent] ? notices[intent](t) : t.preview.simulated;
  return { ok: true, notice } satisfies ActionResult;
}
