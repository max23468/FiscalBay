import { env } from "cloudflare:workers";
import { redirect } from "react-router";

import {
  assertSameOrigin,
  requestedEbayEnvironment,
  requireAccountArea,
  type AccountArea,
} from "../account-area.server";
import { appCopy } from "../app-copy";
import { exportFilePath, settingsPath } from "../app-links";
import { exportRevision } from "../domain/export-files.server";
import {
  exportJobOrders,
  maxQueuedExports,
  publishOrderFile,
  queueOrderFile,
  type OrderFileRequest,
} from "../domain/export-jobs.server";
import { orderAllowance } from "../domain/grants.server";
import { exportFileName } from "../domain/order-export.server";
import { XlsxRowLimitError } from "../domain/xlsx.server";
import {
  customColumns,
  parseColumns,
  standardColumns,
  type ExportRows,
} from "../orders/export-columns";
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

/** Il percorso crea soltanto file: una lettura non ha contenuto. */
export function loader() {
  return new Response(null, { status: 405, headers: { allow: "POST" } });
}

/**
 * File degli ordini, creato soltanto dalla conferma «Crea file». L'ambito arriva
 * nell'indirizzo, uguale a quello della sezione Esportazione (filtri, ricerca cifrata,
 * istantanea e selezione); le opzioni nel corpo. XLSX e colonne scelte valgono soltanto con
 * Premium, riletto qui come gli altri diritti; colonne uguali allo schema standard non sono una
 * scelta Premium. Sessione, negozi, conservazione e diritti si rileggono qui, all'istante della
 * richiesta. Il file si salva nel bucket privato e la risposta
 * rimanda al suo download, che passa dal Worker senza URL bearer; il file vale al più 24 ore,
 * non oltre la fine della copertura Premium con cui è nato né oltre il primo termine dei dati
 * inclusi. Oltre `exportJobOrders` ordini il file si prepara dalla coda: la risposta 202 lo
 * annuncia e la campanella avvisa quando è pronto, con al più `maxQueuedExports` file in
 * preparazione per utente. Con `Accept: application/json` un rifiuto risponde con l'avviso; un
 * modulo inviato senza JavaScript torna alla sezione.
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
  const format = form.get("format") === "xlsx" ? "xlsx" : "csv";
  const chosen = form.get("columns");
  const now = new Date();
  const timeZone = effectiveTimeZone(area.preferences.timeZone, area.detectedTimeZone);
  try {
    // La revisione precede ogni lettura dei dati: una revoca arrivata durante la generazione
    // impedisce al file di diventare scaricabile.
    const revision = await measure("d1", "exports", () => exportRevision(env.DB, userId));
    const allowance = await measure("d1", "allowance", () => orderAllowance(env.DB, userId, now));
    const premium = !!allowance?.premium;
    const columns = chosen === null ? standardColumns(rows) : parseColumns(String(chosen), rows);
    const custom = columns ? customColumns(columns, rows) : null;
    // Senza Premium, anche se scaduto mentre la pagina era aperta, il file standard non parte
    // al posto di quello chiesto.
    if (!premium && (format === "xlsx" || custom || (chosen !== null && !columns)))
      return refused(403, t.settings.export.exportPremium);
    if (!columns) return refused(400, t.settings.export.exportColumnsInvalid);
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
    const fileRequest: OrderFileRequest = {
      environment,
      filter,
      rows,
      format,
      columns: custom,
      language,
      timeZone,
    };
    const fileName = exportFileName(t, now, timeZone, format);
    if (tally.orders > exportJobOrders) {
      const queued = await measure("d1", "exports", () =>
        queueOrderFile(env, { userId, revision, request: fileRequest, fileName, now }),
      );
      if (!queued) return refused(429, t.settings.export.exportBusy(maxQueuedExports));
      return json
        ? Response.json(
            { ok: true, notice: t.settings.export.exportQueued } satisfies ActionResult,
            {
              status: 202,
              headers: { "cache-control": "no-store" },
            },
          )
        : redirect(`${localizedPath(language, `${settingsPath}/esportazione`)}?${query}`, 303);
    }
    const id = await publishOrderFile(env, {
      userId,
      revision,
      request: fileRequest,
      fileName,
      now,
      coverageEndsAt: premium ? (allowance?.coverage?.endsAt ?? null) : null,
    });
    if (!id) return refused(409, t.settings.export.exportGone);
    // Il download segue il rimando anche dalla pagina, con le stesse intestazioni della richiesta.
    return redirect(localizedPath(language, exportFilePath(id)), 303);
  } catch (error) {
    if (error instanceof Response) throw error;
    if (error instanceof XlsxRowLimitError)
      return refused(413, t.settings.export.exportTooManyRows);
    logFailure({ request, error, operation: "route" });
    return refused(500, t.settings.export.exportFailed);
  }
}
