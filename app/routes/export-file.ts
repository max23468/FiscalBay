import { env } from "cloudflare:workers";
import { redirect } from "react-router";

import { requireAccountArea, type AccountArea } from "../account-area.server";
import { appCopy } from "../app-copy";
import { settingsPath } from "../app-links";
import { openExportFile } from "../domain/export-files.server";
import { errorResponse } from "../error-response";
import { localizedPath } from "../i18n";
import { measure } from "../observability.server";
import type { ActionResult } from "../view-models";
import type { Route } from "./+types/export-file";

/**
 * Download di un file esportato. Il file non ha un indirizzo pubblico: a ogni richiesta si
 * rileggono sessione, proprietà, scadenza e revisione di accesso dello spazio, poi i byte passano
 * dal Worker in streaming. Un file scaduto o revocato non si scarica anche se l'oggetto esiste
 * ancora. Con `Accept: application/json` un rifiuto risponde con l'avviso; una navigazione torna
 * alla sezione Esportazione.
 */
export async function loader({ request, params }: Route.LoaderArgs) {
  const json = request.headers.get("accept")?.includes("application/json") ?? false;
  let area: AccountArea;
  try {
    area = await requireAccountArea(request);
  } catch (error) {
    if (json && error instanceof Response) return errorResponse(request, "AUTH_REQUIRED");
    throw error;
  }
  const file = await measure("d1", "exports", () =>
    openExportFile(env, area.session.user.id, params.file, new Date()),
  );
  if (!file) {
    return json
      ? Response.json(
          {
            ok: false,
            notice: appCopy[area.language].settings.export.exportGone,
          } satisfies ActionResult,
          { status: 410, headers: { "cache-control": "no-store" } },
        )
      : redirect(localizedPath(area.language, `${settingsPath}/esportazione`), 303);
  }
  return new Response(file.object.body, {
    headers: {
      "content-type": file.contentType,
      "content-length": String(file.object.size),
      "content-disposition": `attachment; filename="${file.fileName}"`,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "cross-origin-resource-policy": "same-origin",
    },
  });
}
