import { appCopy } from "./app-copy";
import { correlationHeader, correlationId, errorCatalog, type ErrorCode } from "./errors";
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
