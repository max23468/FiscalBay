import { env } from "cloudflare:workers";
import { redirect } from "react-router";

import {
  assertSameOrigin,
  requestedEbayEnvironment,
  requireAccountArea,
  type AccountArea,
} from "../account-area.server";
import { appCopy } from "../app-copy";
import { settingsPath } from "../app-links";
import { orderAllowance } from "../domain/grants.server";
import {
  exportCsvStream,
  exportFileName,
  exportOrderPages,
  type ExportRows,
} from "../domain/order-export.server";
import { visibleOrderTallies } from "../domain/orders.server";
import { errorResponse } from "../error-response";
import { logFailure } from "../errors";
import { localizedPath } from "../i18n";
import { measure } from "../observability.server";
import {
  accountExportScope,
  onlyAvailable,
  periodExportFilter,
} from "../orders/export-scope.server";
import { effectiveTimeZone } from "../preferences";
import type { ActionResult } from "../view-models";
import type { Route } from "./+types/order-export";

/** Pagine del file con l'errore registrato: a risposta iniziata interrompe soltanto il flusso. */
async function* logged<T>(request: Request, pages: AsyncGenerator<T>) {
  try {
    yield* pages;
  } catch (error) {
    logFailure({ request, error, operation: "route" });
    throw error;
  }
}

/** Il percorso crea soltanto file: una lettura non ha contenuto. */
export function loader() {
  return new Response(null, { status: 405, headers: { allow: "POST" } });
}

/**
 * File CSV degli ordini, creato soltanto dalla conferma «Crea file». L'ambito arriva
 * nell'indirizzo, uguale a quello della sezione Esportazione (filtri, ricerca cifrata,
 * istantanea e selezione); le opzioni nel corpo. Sessione, negozi, conservazione e diritti si
 * rileggono qui, all'istante della richiesta, e il file passa dal Worker senza URL bearer.
 * Con `Accept: application/json` un rifiuto risponde con l'avviso; un modulo inviato senza
 * JavaScript torna alla sezione.
 */
export async function action({ request }: Route.ActionArgs) {
  assertSameOrigin(request);
  const json = request.headers.get("accept")?.includes("application/json") ?? false;
  let area: AccountArea;
  try {
    area = await requireAccountArea(request);
  } catch (error) {
    if (json && error instanceof Response) return errorResponse(request, "AUTH_REQUIRED");
    throw error;
  }
  const form = await request.formData();
  const language = form.get("language") === "en" ? "en" : "it";
  const t = appCopy[language];
  const query = new URL(request.url).searchParams;
  const refused = (status: number, notice: string) =>
    json
      ? Response.json({ ok: false, notice } satisfies ActionResult, {
          status,
          headers: { "cache-control": "no-store" },
        })
      : redirect(`${localizedPath(language, `${settingsPath}/esportazione`)}?${query}`, 303);
  const userId = area.session.user.id;
  const environment = requestedEbayEnvironment(request);
  const rows: ExportRows = form.get("rows") === "item" ? "item" : "order";
  const now = new Date();
  const timeZone = effectiveTimeZone(area.preferences.timeZone, area.detectedTimeZone);
  try {
    const allowance = await measure("d1", "allowance", () => orderAllowance(env.DB, userId, now));
    const premium = !!allowance?.premium;
    const fromOrders = await measure("d1", "orders", () =>
      accountExportScope(area, query, environment, premium, now),
    );
    const scoped =
      fromOrders?.filter ?? periodExportFilter(String(form.get("period") ?? ""), premium, now);
    const filter = form.get("fiscal") === "available" ? onlyAvailable(scoped) : scoped;
    // Un ambito senza ordini non produce un file con la sola intestazione.
    const [tally] = filter
      ? await measure("d1", "orders", () =>
          visibleOrderTallies(env.DB, userId, environment, now, filter),
        )
      : [];
    if (!filter || !tally?.orders) return refused(409, t.settings.export.exportEmpty);
    const pages = logged(request, exportOrderPages(env.DB, userId, environment, now, filter));
    return new Response(exportCsvStream(pages, rows, t, timeZone), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${exportFileName(t, now, timeZone)}"`,
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof Response) throw error;
    logFailure({ request, error, operation: "route" });
    return refused(500, t.settings.export.exportFailed);
  }
}
