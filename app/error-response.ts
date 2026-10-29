import { data } from "react-router";

import { appCopy } from "./app-copy";
import {
  correlationHeader,
  correlationId,
  errorCatalog,
  logFailure,
  type ErrorCode,
} from "./errors";
import { languageFromPath, type Language } from "./i18n";

// Separato da `errors.ts`: cron, coda e webhook registrano errori senza valutare i testi
// dell'interfaccia, che servono solo alle risposte delle route.
function errorMessage(code: ErrorCode, language: Language): string {
  return appCopy[language].errors.codes[code];
}

export function errorResponse(request: Request, code: ErrorCode): Response {
  const definition = errorCatalog[code];
  const headers = new Headers({
    "cache-control": "no-store",
    [correlationHeader]: correlationId(request),
  });
  if ("retryAfter" in definition) headers.set("retry-after", String(definition.retryAfter));
  return Response.json(
    {
      code,
      message: errorMessage(code, languageFromPath(new URL(request.url).pathname)),
      correlationId: headers.get(correlationHeader),
      retryable: definition.retryable,
    },
    { status: definition.status, headers },
  );
}

/**
 * Auth o database non rispondono: 503 senza dati, con la sola indicazione di riprovare. La
 * pagina non promette una consultazione che non può servire (§20, §32).
 */
export function unavailablePage(request: Request, error: unknown) {
  logFailure({ request, code: "UPSTREAM_UNAVAILABLE", error, operation: "route" });
  return unavailableData();
}

/** La stessa risposta, per un errore già registrato da chi lo ha ricevuto. */
export function unavailableData() {
  return data(null, {
    status: 503,
    headers: { "cache-control": "no-store", "retry-after": "60" },
  });
}
