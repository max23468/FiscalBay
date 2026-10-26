import { loader as loadHome } from "../../app/routes/orders";
import { action as signIn, loader as loadAccess } from "../../app/routes/sign-in";
import { action as securityAction } from "../../app/routes/settings";
import { routeData, routePage, routeResponse } from "./route-fixtures";

export function accessForm(path: string, fields: Record<string, string>, cookie?: string) {
  return routeResponse(signIn, path, { fields, cookie });
}

/** Errore di un modulo d'accesso: resta sulla pagina con l'avviso e i valori inviati. */
export async function accessError(response: Response) {
  const body = await response.json<{
    notice: { key: string };
    remembered: { tab: string; values: Record<string, string> };
  }>();
  return { status: response.status, key: body.notice.key, ...body.remembered };
}

/** Azione della pagina Sicurezza; chi non può vederla riceve il redirect lanciato. */
export function securityForm(path: string, fields: Record<string, string>, cookie?: string) {
  return routeResponse(securityAction, path, { fields, cookie });
}

export function homeFor(cookie: string, path = "/app/ordini") {
  return routePage(loadHome, path, { cookie });
}

/** Pagina di accesso con la sessione: completamento del profilo, oppure il redirect lanciato. */
export function accessFor(cookie: string) {
  return routeData(loadAccess, "/accesso", { cookie });
}
