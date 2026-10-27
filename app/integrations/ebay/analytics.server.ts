import { z } from "zod";

import { upstreamJson } from "../http.server";
import { ebayConfiguration } from "./environment.server";
import type { EbayEnvironment } from "../../view-models";

/**
 * Quote delle API eBay dell'applicazione (D188), lette da `getRateLimits` della Developer
 * Analytics API con il token dell'applicazione: nessun token di un venditore e nessuna chiamata
 * per conto dei negozi. Ogni lettura ha un'attesa propria, più breve di quella delle letture.
 */

const timeoutMs = 8_000;

/** API lette: Trading e Fulfillment, le sole che FiscalBay chiama per i negozi. */
export const quotaApis = [
  { context: "tradingapi", name: null },
  { context: "sell", name: "fulfillment" },
] as const;

const rateSchema = z.object({
  count: z.number().int().nonnegative().optional(),
  limit: z.number().int().nonnegative(),
  remaining: z.number().int().optional(),
  reset: z.string().max(64).optional(),
  timeWindow: z.number().int().positive(),
});

const responseSchema = z.object({
  rateLimits: z
    .array(
      z.object({
        apiContext: z.string().max(64),
        apiName: z.string().max(128),
        apiVersion: z.string().max(32).optional(),
        resources: z
          .array(
            z.object({ name: z.string().max(200), rates: z.array(rateSchema).max(10) }).loose(),
          )
          .max(500)
          .default([]),
      }),
    )
    .max(100)
    .default([]),
});

export type ApiRate = {
  limit: number;
  /** Chiamate fatte nella finestra corrente. */
  used: number;
  /**
   * Quota consumata nella finestra: con una quota condivisa fra più chiamate, come quella di
   * Trading, il residuo è comune e il consumo supera le chiamate della singola voce.
   */
  consumed: number;
  remaining: number;
  /** Azzeramento della finestra; null se eBay non lo indica. */
  resetAt: string | null;
  /** Durata della finestra, in secondi: 86400 per la quota giornaliera. */
  windowSeconds: number;
};

export type ApiQuota = {
  environment: EbayEnvironment;
  api: string;
  resource: string;
  rates: ApiRate[];
};

function rate(value: z.infer<typeof rateSchema>): ApiRate {
  const used = value.count ?? Math.max(0, value.limit - (value.remaining ?? value.limit));
  const reset = value.reset && !Number.isNaN(Date.parse(value.reset)) ? value.reset : null;
  return {
    limit: value.limit,
    used,
    consumed: Math.max(used, value.limit - (value.remaining ?? value.limit)),
    remaining: value.remaining ?? Math.max(0, value.limit - used),
    resetAt: reset ? new Date(reset).toISOString() : null,
    windowSeconds: value.timeWindow,
  };
}

function apiLabel(context: string, name: string) {
  if (context.toLowerCase() === "tradingapi") return "Trading";
  if (context.toLowerCase() === "sell" && name.toLowerCase() === "fulfillment")
    return "Fulfillment";
  return `${context}.${name}`;
}

/** Quote dell'ambiente indicato, una riga per API e chiamata. */
export async function readApiQuotas(
  env: Env,
  environment: EbayEnvironment,
  fetcher: typeof fetch,
): Promise<ApiQuota[]> {
  const configuration = ebayConfiguration(env, environment);
  const options = { timeoutMs, maxBytes: 262_144 };
  const token = await upstreamJson(
    fetcher,
    configuration.tokenUrl,
    z.object({ access_token: z.string().min(1).max(8192) }),
    {
      method: "POST",
      headers: {
        authorization: `Basic ${btoa(`${configuration.clientId}:${configuration.clientSecret}`)}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        scope: "https://api.ebay.com/oauth/api_scope",
      }),
    },
    { ...options, maxBytes: 16_384 },
  );
  const responses = await Promise.all(
    quotaApis.map((api) => {
      const url = new URL(`${configuration.apiOrigin}/developer/analytics/v1_beta/rate_limit/`);
      url.searchParams.set("api_context", api.context);
      if (api.name) url.searchParams.set("api_name", api.name);
      return upstreamJson(
        fetcher,
        url.toString(),
        responseSchema,
        { headers: { authorization: `Bearer ${token.access_token}` } },
        options,
      );
    }),
  );
  return responses.flatMap((response) =>
    response.rateLimits.flatMap((limit) =>
      limit.resources.map((resource) => ({
        environment,
        api: apiLabel(limit.apiContext, limit.apiName),
        resource: resource.name,
        rates: resource.rates.map(rate),
      })),
    ),
  );
}
