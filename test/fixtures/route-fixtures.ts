import { loader as loadArea } from "../../app/routes/account";

export const testOrigin = "http://localhost:5173";

type RouteOptions = {
  cookie?: string | null;
  /** Campi del modulo: con i campi, o con `body`, la richiesta diventa un POST. */
  fields?: Record<string, string> | URLSearchParams | FormData;
  /** Corpo già pronto, per esempio JSON, al posto dei campi del modulo. */
  body?: string;
  /** Origine del POST; `null` la omette. */
  origin?: string | null;
  headers?: Record<string, string>;
  params?: Record<string, string | undefined>;
  signal?: AbortSignal;
};

/** Richiesta del browser verso un percorso dell'app, GET oppure POST di un modulo. */
export function routeRequest(path: string, options: RouteOptions = {}) {
  const { cookie, fields, body, origin = testOrigin, headers, signal } = options;
  const common = { ...(cookie ? { cookie } : {}), ...headers };
  if (!fields && body === undefined)
    return new Request(`${testOrigin}${path}`, { headers: common, signal });
  return new Request(`${testOrigin}${path}`, {
    method: "POST",
    headers: { ...(origin ? { origin } : {}), ...common },
    body: body ?? (fields instanceof FormData ? fields : new URLSearchParams(fields)),
    signal,
  });
}

type Unwrapped<T> = T extends { type: string; data: infer D; init: ResponseInit | null } ? D : T;

function isWrapped(value: unknown): value is { data: unknown; init: ResponseInit | null } {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: unknown }).type === "DataWithResponseInit"
  );
}

/** Esito grezzo di un loader o di un'action: `data()`, dati o Response, come li restituisce. */
export async function callRoute<A extends { request: Request }, R>(
  handler: (args: A) => R,
  path: string,
  options: RouteOptions = {},
): Promise<Awaited<R>> {
  const request = routeRequest(path, options);
  return await handler({ request, params: options.params ?? {} } as never);
}

/**
 * Dati di un loader o di un'action come li riceve il componente: `data()` aperto, mentre una
 * Response restituita o lanciata fa fallire la prova.
 */
export async function routeData<A extends { request: Request }, R>(
  handler: (args: A) => R,
  path: string,
  options: RouteOptions = {},
): Promise<Exclude<Unwrapped<Awaited<R>>, Response>> {
  const result: unknown = await callRoute(handler, path, options);
  if (result instanceof Response) throw new Error(`Risposta ${result.status} al posto dei dati`);
  return (isWrapped(result) ? result.data : result) as Exclude<Unwrapped<Awaited<R>>, Response>;
}

/** Response di un loader o di un'action, restituita oppure lanciata come un redirect. */
export async function routeResponse<A extends { request: Request }, R>(
  handler: (args: A) => R,
  path: string,
  options: RouteOptions = {},
): Promise<Response> {
  const result: unknown = await callRoute(handler, path, options).catch((thrown: unknown) => {
    if (thrown instanceof Response) return thrown;
    throw thrown;
  });
  if (result instanceof Response) return result;
  if (isWrapped(result))
    return Response.json(result.data, { ...result.init, status: result.init?.status ?? 200 });
  throw new Error("Dati al posto di una risposta");
}

/** Dati di una pagina trovata: una risposta `notFound` fa fallire la prova. */
export async function routePage<A extends { request: Request }, R>(
  handler: (args: A) => R,
  path: string,
  options: RouteOptions = {},
) {
  const result = await routeData(handler, path, options);
  if ((result as { notFound?: boolean }).notFound) throw new Error(`Pagina non trovata: ${path}`);
  return result as Extract<typeof result, { notFound: false }>;
}

/** Shell dell'area reale, dal loader della layout route di Ordini, Negozi e Impostazioni. */
export async function areaShell(cookie: string, path = "/app/impostazioni") {
  return (await routeData(loadArea, path, { cookie })).shell;
}
