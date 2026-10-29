import { z } from "zod";

import { logFailure } from "./errors";
import { readUpstream, UpstreamError } from "./integrations/http.server";
import { turnstileField, type TurnstileAction } from "./turnstile";

const siteverifyUrl = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Lunghezza massima di un token secondo Cloudflare: oltre, non si chiama Siteverify. */
const maxTokenLength = 2048;

const siteverifySchema = z.object({
  success: z.boolean(),
  "error-codes": z.array(z.string()).optional(),
  hostname: z.string().optional(),
  action: z.string().optional(),
  metadata: z.object({ result_with_testing_key: z.boolean().optional() }).optional(),
});

// Errori del token, che una nuova verifica supera; gli altri dipendono da chiave o provider.
const tokenErrors = new Set([
  "missing-input-response",
  "invalid-input-response",
  "timeout-or-duplicate",
]);

/**
 * Esito della verifica: `invalid` per un token assente, scaduto, riusato o di un altro modulo o
 * hostname; `unavailable` quando Siteverify o la chiave non permettono di decidere. In entrambi
 * i casi la richiesta si rifiuta e l'utente può riprovare.
 */
export type TurnstileOutcome = "valid" | "invalid" | "unavailable";

/**
 * Verifica lato server del token Turnstile di un modulo (§29). Siteverify accetta un token una
 * sola volta entro cinque minuti; qui si confrontano anche l'hostname dell'ambiente e l'azione
 * del modulo. Le chiavi di prova di Cloudflare rispondono con un hostname fisso e senza azione:
 * il loro esito vale soltanto fuori dai domini HTTPS, quindi mai sul test o in Production.
 */
export async function verifyTurnstile(
  env: Pick<Env, "APP_ORIGIN" | "TURNSTILE_SECRET_KEY">,
  request: Request,
  token: string,
  action: TurnstileAction,
  fetcher: typeof fetch = fetch,
): Promise<TurnstileOutcome> {
  if (!token || token.length > maxTokenLength) return "invalid";
  const unavailable = (error: UpstreamError) => {
    logFailure({ request, error, operation: "turnstile", status: error.details.status });
    return "unavailable" as const;
  };
  const remoteip = request.headers.get("cf-connecting-ip");
  let result: z.infer<typeof siteverifySchema>;
  try {
    const { text } = await readUpstream(
      fetcher,
      siteverifyUrl,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          secret: env.TURNSTILE_SECRET_KEY,
          response: token,
          ...(remoteip ? { remoteip } : {}),
        }),
      },
      { timeoutMs: 10_000, maxBytes: 16_384 },
    );
    result = siteverifySchema.parse(JSON.parse(text));
  } catch (error) {
    return unavailable(
      error instanceof UpstreamError ? error : new UpstreamError("invalid_response"),
    );
  }
  if (!result.success) {
    const codes = result["error-codes"] ?? [];
    return codes.length > 0 && codes.every((code) => tokenErrors.has(code))
      ? "invalid"
      : unavailable(new UpstreamError("credentials"));
  }
  if (result.metadata?.result_with_testing_key) {
    return env.APP_ORIGIN.startsWith("https:")
      ? unavailable(new UpstreamError("credentials"))
      : "valid";
  }
  return result.hostname === new URL(env.APP_ORIGIN).hostname && result.action === action
    ? "valid"
    : "invalid";
}

/** Token del modulo inviato, vuoto se manca. */
export function turnstileToken(form: FormData): string {
  const value = form.get(turnstileField);
  return typeof value === "string" ? value : "";
}

/**
 * Avviso da mostrare quando la verifica del modulo non è riuscita; null se la richiesta può
 * proseguire.
 */
export async function turnstileFailure(
  env: Pick<Env, "APP_ORIGIN" | "TURNSTILE_SECRET_KEY">,
  request: Request,
  form: FormData,
  action: TurnstileAction,
): Promise<"verifica-non-riuscita" | "verifica-non-disponibile" | null> {
  const outcome = await verifyTurnstile(env, request, turnstileToken(form), action);
  if (outcome === "valid") return null;
  return outcome === "invalid" ? "verifica-non-riuscita" : "verifica-non-disponibile";
}
