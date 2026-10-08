import { appCopy } from "./app-copy";
import { languageFromPath, type Language } from "./i18n";

export const errorCatalog = {
  AUTH_REQUIRED: { status: 401, retryable: false },
  FORBIDDEN: { status: 403, retryable: false },
  INVALID_REQUEST: { status: 400, retryable: false },
  STORE_RECONNECT_REQUIRED: { status: 409, retryable: false },
  UPSTREAM_UNAVAILABLE: { status: 503, retryable: true, retryAfter: 60 },
  CHECKOUT_PENDING: { status: 503, retryable: true, retryAfter: 60 },
  INTERNAL_ERROR: { status: 500, retryable: false },
} as const;

export type ErrorCode = keyof typeof errorCatalog;
export const correlationHeader = "x-correlation-id";
export const traceHeader = "x-fiscalbay-trace";

/**
 * Fasi raggiunte dalle richieste marcate dal collaudo remoto: solo il nome della fase, mai
 * dati. Una richiesta rimasta in attesa mostra nei log del Worker l'ultima fase superata.
 */
export function tracePhase(request: Request, phase: string): void {
  if (request.headers.get(traceHeader) === "1")
    console.log(JSON.stringify({ event: "phase", phase }));
}

export function correlateResponse(response: Response, id: string): Response {
  const headers = new Headers(response.headers);
  headers.set(correlationHeader, id);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export class ApplicationError extends Error {
  constructor(readonly code: ErrorCode) {
    super(code);
    this.name = "ApplicationError";
  }
}

export function classifyFailure(error: unknown): ErrorCode {
  return error instanceof ApplicationError ? error.code : "INTERNAL_ERROR";
}

export function correlationId(request: Request): string {
  const value = request.headers.get(correlationHeader);
  return value && /^[0-9a-f-]{36}$/u.test(value) ? value : crypto.randomUUID();
}

export function errorMessage(code: ErrorCode, language: Language): string {
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

// Only enumerated fields are logged. Never serialize Error, request, headers or provider payloads.
export function logFailure(input: {
  request?: Request;
  code?: ErrorCode;
  error?: unknown;
  operation:
    | "route"
    | "render"
    | "sign_in"
    | "store_link"
    | "stripe_webhook"
    | "token_refresh"
    | "order_acquisition"
    | "account_email"
    | "maintenance";
  status?: number;
}): void {
  if (input.request?.signal.aborted) return;
  const { error } = input;
  // Il tipo di errore del provider (UpstreamError) è un'etichetta fissa, mai il suo contenuto.
  const failure =
    error instanceof ApplicationError && "failure" in error ? String(error.failure) : undefined;
  console.error(
    JSON.stringify({
      event: "application_error",
      code: input.code ?? classifyFailure(error),
      operation: input.operation,
      ...(input.request ? { correlationId: correlationId(input.request) } : {}),
      ...(failure ? { failure } : {}),
      ...(input.status ? { status: input.status } : {}),
    }),
  );
}
