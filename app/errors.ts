import { languageFromPath, translate, type Language } from "./i18n";

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
  return translate(language, `error_${code}`);
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
  request: Request;
  code: ErrorCode;
  operation: "route" | "render" | "store_link" | "stripe_webhook";
  status?: number;
}): void {
  if (input.request.signal.aborted) return;
  console.error(
    JSON.stringify({
      event: "application_error",
      code: input.code,
      operation: input.operation,
      correlationId: correlationId(input.request),
      ...(input.status ? { status: input.status } : {}),
    }),
  );
}
