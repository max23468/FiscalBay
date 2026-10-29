import { beforeEach } from "vitest";

import { turnstileField } from "../../app/turnstile";

/** Token prodotto dalle chiavi di prova del sito di Cloudflare. */
export const testToken = "XXXX.DUMMY.TOKEN.XXXX";

export const siteverifyUrl = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Risposta reale di Siteverify con la chiave segreta di prova che accetta sempre. */
export const testingKeyResult = {
  success: true,
  "error-codes": [],
  challenge_ts: "2026-10-29T14:17:50.523Z",
  hostname: "example.com",
  metadata: { result_with_testing_key: true },
};

/** Campi di un modulo con il token di prova, se la prova non ne indica uno. */
export function withTurnstileToken(
  fields: Record<string, string> | URLSearchParams,
): URLSearchParams;
export function withTurnstileToken(fields: FormData): FormData;
export function withTurnstileToken(fields: Record<string, string> | URLSearchParams | FormData) {
  const copy = fields instanceof FormData ? new FormData() : new URLSearchParams();
  const entries = fields instanceof URLSearchParams || fields instanceof FormData;
  for (const [name, value] of entries ? fields : Object.entries(fields))
    copy.append(name, value as string);
  if (!copy.has(turnstileField)) copy.set(turnstileField, testToken);
  return copy;
}

/**
 * Siteverify simulato: richieste ricevute e risposta, che una prova può sostituire. Ogni prova
 * riparte dalla risposta della chiave di prova e da un elenco vuoto.
 */
export const siteverify = {
  requests: [] as Array<{ secret: string; response: string; remoteip?: string }>,
  answer: (): Response => Response.json(testingKeyResult),
};

beforeEach(() => {
  siteverify.requests.length = 0;
  siteverify.answer = () => Response.json(testingKeyResult);
});

// Le prove non raggiungono Cloudflare; ogni altra richiesta resta a `fetch`, anche quando una
// prova lo sostituisce con un proprio mock.
const upstream = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = input instanceof Request ? input.url : String(input);
  if (url !== siteverifyUrl) return upstream(input, init);
  siteverify.requests.push(JSON.parse(String(init?.body)));
  return siteverify.answer();
};
