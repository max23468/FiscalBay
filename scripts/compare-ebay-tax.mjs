#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { z } from "zod";

const inputSchema = z.object({
  environment: z.enum(["production", "sandbox"]),
  orderIds: z
    .array(z.string().trim().min(1).max(100))
    .min(1)
    .max(50)
    .refine((ids) => new Set(ids).size === ids.length),
});
const metadataSchema = z.object({
  orderId: z.string(),
  creationDate: z.iso.datetime(),
  lastModifiedDate: z.iso.datetime(),
  lineItems: z
    .array(
      z.object({
        listingMarketplaceId: z
          .string()
          .regex(/^EBAY_[A-Z_]{2,20}$/u)
          .nullish(),
      }),
    )
    .default([]),
});
const failures = new Set([
  "credentials",
  "rate_limited",
  "unavailable",
  "invalid_response",
  "rejected",
]);
const stoppingFailures = new Set(["credentials", "rate_limited", "unavailable"]);
const day = 86_400_000;

function metadata(payload, orderId, at) {
  const order = metadataSchema.parse(payload);
  const age = (at - Date.parse(order.creationDate)) / day;
  if (order.orderId !== orderId || age < 0) throw new Error("invalid_response");
  const marketplaces = new Set(order.lineItems.map((item) => item.listingMarketplaceId ?? null));
  return {
    marketplace: marketplaces.size === 1 ? [...marketplaces][0] : null,
    age: age <= 14 ? "0-14" : age <= 90 ? "15-90" : age <= 365 ? "91-365" : ">365",
    revision: Date.parse(order.lastModifiedDate),
  };
}

/** Solo esiti e conteggi: nessun ID ordine, valore fiscale, hash o payload nel risultato. */
export async function compareEbayTax(input, access, client, at = Date.now()) {
  const { orderIds, environment } = inputSchema.parse(input);
  if (!Number.isFinite(at)) throw new Error("invalid_input");
  const origin =
    environment === "production" ? "https://api.ebay.com" : "https://api.sandbox.ebay.com";
  if (access.configuration.apiOrigin !== origin) throw new Error("environment_mismatch");
  const calls = { fulfillment: 0, trading: 0 };
  const measured = {
    ...access,
    fetcher: (url, init) => {
      if (new URL(url).pathname === "/ws/api.dll") calls.trading++;
      else calls.fulfillment++;
      return access.fetcher(url, init);
    },
  };
  const rows = [];
  let stopped = null;
  for (const [index, orderId] of orderIds.entries()) {
    const row = { sample: index + 1, marketplace: null, age: null, outcome: "error" };
    if (stopped) {
      rows.push({ ...row, outcome: "not_read" });
      continue;
    }
    try {
      // Stesso fieldGroups per isolare l'effetto dell'header. La prima lettura dà il marketplace.
      const baseline = await client.readFulfillmentOrder(measured, orderId, {});
      const first = metadata(baseline, orderId, at);
      row.marketplace = first.marketplace;
      row.age = first.age;
      if (!first.marketplace) {
        rows.push({ ...row, outcome: "marketplace_unresolved" });
        continue;
      }
      const qualified = await client.readFulfillmentOrder(measured, orderId, {
        marketplaceId: first.marketplace,
      });
      const second = metadata(qualified, orderId, at);
      if (
        second.marketplace !== first.marketplace ||
        second.age !== first.age ||
        second.revision !== first.revision
      )
        throw new Error("invalid_response");
      const withoutHeader = client.fulfillmentTaxIdentifiers(baseline);
      const fulfillment = client.fulfillmentTaxIdentifiers(qualified);
      const trading = await client.readTradingTaxObservation(measured, orderId);
      const unique = [
        ...new Map(
          trading.values.map((tax) => [
            JSON.stringify([tax.type, tax.issuingCountry, tax.value]),
            tax,
          ]),
        ).values(),
      ];
      const same =
        fulfillment.length === unique.length &&
        fulfillment.every((tax) =>
          unique.some(
            (other) =>
              other.type === tax.type &&
              other.value === tax.value &&
              (!other.issuingCountry ||
                !tax.issuingCountry ||
                other.issuingCountry === tax.issuingCountry),
          ),
        );
      rows.push({
        ...row,
        withoutHeader: withoutHeader.length,
        fulfillment: fulfillment.length,
        trading: unique.length,
        countryComplete: [...fulfillment, ...unique].every((tax) => tax.issuingCountry !== null),
        outcome: !trading.orderFound
          ? "trading_order_unavailable"
          : !fulfillment.length && !unique.length
            ? "both_absent"
            : same
              ? "equal"
              : "different",
      });
    } catch (error) {
      const failure = failures.has(error?.failure) ? error.failure : "invalid_response";
      rows.push({ ...row, outcome: "error", failure });
      if (stoppingFailures.has(failure)) stopped = failure;
    }
  }
  return {
    environment,
    rows,
    calls,
    stopped,
    // Una serie di assenze, errori o ordini non confrontabili non dimostra equivalenza.
    supportsReview: rows.every((row) => row.outcome === "equal"),
    budget: {
      comparisonMaximumPerOrder: { fulfillment: 2, trading: 1 },
      currentDetailPerOrder: { fulfillment: 1, trading: 1 },
      candidateAfterApprovalPerOrder: { fulfillment: 1, trading: 0 },
      recordedDailyLimits: { fulfillment: 100_000, trading: 5_000 },
      limitsReadbackDate: "2026-10-08",
    },
  };
}

export async function main() {
  let server;
  try {
    let text = "";
    for await (const chunk of process.stdin) {
      text += chunk;
      if (text.length > 16_384) throw new Error("invalid_input");
    }
    const input = inputSchema.parse(JSON.parse(text));
    const token = process.env.EBAY_ACCESS_TOKEN;
    if (!token?.trim()) throw new Error("missing_token");
    // Loader già disponibile nella toolchain, senza plugin applicativi né server in ascolto.
    const { createServer } = await import("vite");
    server = await createServer({
      configFile: false,
      logLevel: "silent",
      server: { middlewareMode: true, watch: null },
    });
    const client = await server.ssrLoadModule("/app/integrations/ebay/fulfillment.server.ts");
    const trading = await server.ssrLoadModule("/app/integrations/ebay/trading.server.ts");
    const { ebayConfiguration } = await server.ssrLoadModule(
      "/app/integrations/ebay/environment.server.ts",
    );
    const configuration = ebayConfiguration(
      {
        APP_ORIGIN: "http://localhost",
        EBAY_CLIENT_ID: "",
        EBAY_CLIENT_SECRET: "",
        EBAY_RUNAME: "",
        EBAY_SANDBOX_ENABLED: "true",
        EBAY_SANDBOX_CLIENT_ID: "unused",
        EBAY_SANDBOX_CLIENT_SECRET: "unused",
        EBAY_SANDBOX_RUNAME: "unused",
      },
      input.environment,
    );
    const report = await compareEbayTax(
      input,
      { fetcher: fetch, configuration, accessToken: token },
      { ...client, ...trading },
    );
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.rows.some((row) => ["error", "not_read"].includes(row.outcome)))
      process.exitCode = 1;
  } catch {
    // Non stampare Error/ZodError: possono contenere input privati o valori del provider.
    process.stderr.write(
      "Confronto non eseguito: verificare input, token e toolchain. Nessun dato privato stampato.\n",
    );
    process.exitCode = 1;
  } finally {
    await server?.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
