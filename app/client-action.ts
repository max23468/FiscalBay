import { isRouteErrorResponse } from "react-router";

import { appCopy } from "./app-copy";
import { languageFromPath } from "./i18n";
import type { ActionResult } from "./view-models";

/**
 * Azione dell'area reale vista dal browser. Un'interruzione di rete non conferma l'esito
 * remoto: la pagina riceve un esito non confermato al posto della pagina d'errore, e la scelta
 * o la conferma aperta tornano com'erano. Reindirizzamenti, risposte del server e richieste
 * annullate passano invariati.
 */
export async function unconfirmedOnFailure<T, U = ActionResult>(
  { request, serverAction }: { request: Request; serverAction: () => Promise<T> },
  unconfirmed: (notice: string) => U = (notice) => ({ ok: false, notice }) as U,
): Promise<T | U> {
  try {
    return await serverAction();
  } catch (error) {
    if (error instanceof Response || isRouteErrorResponse(error) || request.signal.aborted)
      throw error;
    return unconfirmed(appCopy[languageFromPath(new URL(request.url).pathname)].errors.unconfirmed);
  }
}
