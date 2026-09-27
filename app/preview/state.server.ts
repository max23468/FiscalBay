import { env } from "cloudflare:workers";
import { createCookie, data } from "react-router";

import { languageFromPath } from "../i18n";
import { isScenarioId, loadScenario, type ScenarioId } from "./scenarios.server";

const productionOrigin = "https://fiscalbay.it";

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
}

/** L'anteprima esiste solo negli ambienti non Production. */
export function assertPreviewAvailable() {
  if (env.APP_ORIGIN === productionOrigin) throw data(null, { status: 404 });
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
    };
  }
  return { scenario: "ordinario", unlocked: [] };
}

export function writePreviewState(state: PreviewState) {
  return previewCookie.serialize(state);
}

/** Scenario corrente nella lingua della richiesta. */
export async function currentScenario(request: Request) {
  assertPreviewAvailable();
  const state = await readPreviewState(request);
  const language = languageFromPath(new URL(request.url).pathname);
  return {
    state,
    language,
    scenario: loadScenario(state.scenario, language, new Set(state.unlocked)),
  };
}
