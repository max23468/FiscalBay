import { env } from "cloudflare:workers";
import { data } from "react-router";

import type { AccountArea } from "./account-area.server";
import { appCopy, type AppCopy } from "./app-copy";
import { startTrial } from "./domain/grants.server";
import { serviceSetting } from "./domain/service-settings.server";
import { ebayOutages, listStores } from "./domain/stores.server";
import { logFailure } from "./errors";
import { languageFromPath } from "./i18n";
import type { RequestLimit } from "./request-limits";
import { limitedHeaders, requestLimitWait } from "./request-limits.server";
import type { ActionResult, EbayEnvironment } from "./view-models";

/** Esito negativo di un'azione dell'area, con lo stato HTTP e l'avviso da mostrare. */
export function actionFailure(status: number, notice: string) {
  return data<ActionResult>({ ok: false, notice }, { status });
}

export interface AreaActionContext {
  request: Request;
  area: AccountArea;
  form: FormData;
}

/**
 * Azione dell'area scelta da `intent`, con l'avviso di un errore imprevisto. Un'azione costosa
 * o che invia un'email dichiara il filtro per IP che la precede.
 */
export interface AreaAction {
  run: (
    context: AreaActionContext,
  ) => Promise<ActionResult | Response | ReturnType<typeof actionFailure>>;
  failureNotice: (copy: AppCopy) => string;
  limit?: RequestLimit;
}

/**
 * Rifiuto 429 del filtro per IP di un'azione, prima della sessione e di ogni dato: l'avviso
 * segue la lingua dell'indirizzo. Null se la richiesta è ammessa.
 */
export async function limitedAction(request: Request, limit: RequestLimit, operation: string) {
  const wait = await requestLimitWait(env, request, limit, operation);
  if (wait === null) return null;
  const t = appCopy[languageFromPath(new URL(request.url).pathname)];
  return data<ActionResult>(
    { ok: false, notice: t.access.signInNotices["troppi-tentativi"] },
    { status: 429, headers: limitedHeaders(wait) },
  );
}

/** L'azione di `intent` fra quelle della pagina, se esiste. */
export function areaAction(actions: Record<string, AreaAction>, intent: string) {
  return Object.hasOwn(actions, intent) ? actions[intent] : undefined;
}

/**
 * Un errore imprevisto diventa l'avviso dell'azione, mai la pagina d'errore; una risposta
 * lanciata, come un rifiuto dell'ambiente richiesto, passa invariata.
 */
export async function runAreaAction(action: AreaAction, context: AreaActionContext) {
  try {
    return await action.run(context);
  } catch (error) {
    if (error instanceof Response) throw error;
    logFailure({ request: context.request, error, operation: "route" });
    return actionFailure(500, action.failureNotice(appCopy[context.area.language]));
  }
}

/** Prova Premium, da Ordini e dal Piano: una prova già usata, anche da un'altra scheda, non riparte. */
export const trialAction: AreaAction = {
  run: async ({ area }) => {
    const t = appCopy[area.language].settings.plan;
    if (!(await startTrial(env.DB, area.session.user.id)))
      return actionFailure(409, t.trialUnavailable);
    return { ok: true, notice: t.trialStarted } satisfies ActionResult;
  },
  failureNotice: (copy) => copy.errors.unexpected,
};

/**
 * Una lettura richiesta da Ordini o Negozi resta sospesa con le chiamate eBay spente dalla
 * console, oppure con eBay che non risponde nell'ambiente richiesto o in quello del negozio.
 */
export async function suspendedEbayRead(
  userId: string,
  target: { environment: EbayEnvironment } | { storeId: string },
): Promise<"ebayPaused" | "ebayDown" | null> {
  if (!(await serviceSetting(env.DB, "ebay_calls"))) return "ebayPaused";
  const stores = await listStores(env.DB, userId);
  const environment =
    "environment" in target
      ? target.environment
      : stores.find((store) => store.id === target.storeId)?.ebayEnvironment;
  return environment && ebayOutages(stores).has(environment) ? "ebayDown" : null;
}
