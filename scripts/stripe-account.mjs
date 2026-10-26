#!/usr/bin/env node
/**
 * Rilegge l'account Stripe di un ambiente e lo confronta con la configurazione del codice:
 * ambiente della chiave, profilo pubblico, impostazioni fiscali, prezzi del listino, endpoint del
 * webhook e portale clienti. Con `--apply` allinea ciò che l'API consente (impostazioni fiscali,
 * endpoint e portale), poi rilegge. Il profilo pubblico si cambia soltanto dalla dashboard.
 *
 * Le richieste passano dal profilo della CLI di Stripe, così nessuna chiave passa da qui. Il
 * resoconto riporta soltanto controlli e nomi dei campi diversi, mai valori dell'account; il
 * segreto di un endpoint creato si scrive soltanto in `--secret-file`, con permessi 600.
 *
 * Uso: node scripts/stripe-account.mjs [--mode live] [--project-name <profilo>]
 *        [--apply [--secret-file <percorso>]]
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { priceGeneration } from "../app/catalog.ts";
import {
  catalogMismatch,
  stripeAccountProfile,
  stripePortalConfiguration,
  stripeWebhookEvents,
} from "../app/integrations/stripe-account.server.ts";
import config from "../cloudflare.config.ts";

const offers = /** @type {const} */ (["monthly", "annual", "lifetime"]);
const priceVariable = {
  monthly: "STRIPE_PRICE_MONTHLY",
  annual: "STRIPE_PRICE_ANNUAL",
  lifetime: "STRIPE_PRICE_LIFETIME",
};

/** Ambiente letto da `cloudflare.config.ts` con la stessa modalità della build. */
export function targetOf(mode) {
  const { env } = config({ mode: mode === "live" ? "live" : "development" }).worker;
  return {
    live: mode === "live",
    origin: env.APP_ORIGIN.value,
    prices: Object.fromEntries(offers.map((offer) => [offer, env[priceVariable[offer]].value])),
  };
}

/** Parametri nella codifica dei form di Stripe: `a[b][0]=valore`. */
export function formParams(value, prefix = "") {
  if (Array.isArray(value))
    return value.flatMap((item, index) => formParams(item, `${prefix}[${index}]`));
  if (value && typeof value === "object")
    return Object.entries(value).flatMap(([key, item]) =>
      formParams(item, prefix ? `${prefix}[${key}]` : key),
    );
  return [[prefix, String(value)]];
}

/** Campi di `expected` che `actual` non ha uguali; gli elenchi valgono come insiemi. */
export function differences(expected, actual, prefix = "") {
  if (Array.isArray(expected)) {
    const same =
      Array.isArray(actual) &&
      actual.length === expected.length &&
      expected.every((item) => actual.includes(item));
    return same ? [] : [prefix];
  }
  if (expected && typeof expected === "object")
    return Object.entries(expected).flatMap(([key, item]) =>
      differences(item, actual?.[key], prefix ? `${prefix}.${key}` : key),
    );
  return expected === actual ? [] : [prefix];
}

class StripeRequestError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

/** Richiesta tramite la CLI di Stripe; un errore dell'API conserva soltanto il codice. */
export function cliRequest({ live, project }) {
  return (method, resource, params = {}) => {
    let output;
    try {
      output = execFileSync(
        "stripe",
        [
          method,
          resource,
          ...(project ? ["--project-name", project] : []),
          ...(live ? ["--live"] : []),
          ...(method === "post" ? ["--confirm"] : []),
          ...formParams(params).flatMap(([key, value]) => ["-d", `${key}=${value}`]),
        ],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      );
    } catch {
      // Profilo assente, chiave scaduta o modalità senza chiave: l'output può contenerla.
      throw new StripeRequestError("cli_failed");
    }
    const body = JSON.parse(output);
    if (body.error) throw new StripeRequestError(body.error.code ?? body.error.type ?? "error");
    return body;
  };
}

/** Codice dell'errore per il resoconto, senza messaggio né riferimenti della richiesta. */
const errorCode = (error) => (typeof error?.code === "string" ? error.code : "request_failed");

const webhookPath = "/webhooks/stripe";

/** Endpoint dell'ambiente e quelli di un altro ambiente FiscalBay nello stesso account. */
function endpointsOf(endpoints, origin) {
  const own = `${origin}${webhookPath}`;
  return {
    own: endpoints.filter((endpoint) => endpoint.url === own),
    foreign: endpoints.filter((endpoint) => {
      const url = new URL(endpoint.url);
      return (
        endpoint.url !== own &&
        url.pathname === webhookPath &&
        /(?:^|\.)fiscalbay\.it$/u.test(url.hostname)
      );
    }),
  };
}

/**
 * Controlli dell'account rispetto al target: ciascuno con esito ed eventuali campi diversi.
 * Se la chiave della CLI appartiene all'altro ambiente gli altri controlli non partono.
 */
export function checkAccount(request, target) {
  const results = [];
  const record = (item, problems) => results.push({ item, ok: !problems.length, problems });
  const attempt = (item, read) => {
    try {
      record(item, read());
    } catch (error) {
      record(item, [errorCode(error)]);
    }
  };

  let tax;
  try {
    tax = request("get", "/v1/tax/settings");
  } catch (error) {
    record("ambiente", [errorCode(error)]);
    return results;
  }
  if (tax.livemode !== target.live) {
    record("ambiente", [target.live ? "chiave_di_test" : "chiave_live"]);
    return results;
  }
  record("ambiente", []);

  attempt("profilo pubblico", () => {
    const { business_profile: profile } = request("get", "/v1/account");
    const expected = stripeAccountProfile(target.live, target.origin);
    return [
      ...(profile.name === expected.name ? [] : ["name"]),
      ...(profile.url === expected.url ? [] : ["url"]),
      ...(profile.support_email === expected.supportEmail ? [] : ["support_email"]),
      // Un indirizzo di assistenza diverso dal sito porterebbe i clienti altrove. La sandbox
      // conserva i valori di prova di Stripe, che nessun cliente vede.
      ...(!target.live ||
      !profile.support_url ||
      profile.support_url.startsWith(`${target.origin}/`)
        ? []
        : ["support_url"]),
    ];
  });

  const taxCodes = new Set();
  for (const offer of offers)
    attempt(`prezzo ${offer}`, () => {
      const id = target.prices[offer];
      if (!id) return ["non_configurato"];
      const price = request("get", `/v1/prices/${id}`, { expand: ["product"] });
      if (price.livemode !== target.live) return ["livemode"];
      if (price.product?.tax_code) taxCodes.add(price.product.tax_code);
      const mismatch = catalogMismatch(price, offer, priceGeneration.net[offer]);
      return mismatch ? [mismatch] : [];
    });

  record("impostazioni fiscali", [
    ...(tax.status === "active" ? [] : ["status"]),
    ...(tax.defaults?.tax_behavior === "exclusive" ? [] : ["defaults.tax_behavior"]),
    // Il codice predefinito è quello dei prodotti del listino.
    ...(taxCodes.size === 1 && tax.defaults?.tax_code === [...taxCodes][0]
      ? []
      : ["defaults.tax_code"]),
    ...(tax.head_office?.address?.country ? [] : ["head_office"]),
  ]);

  attempt("webhook", () => {
    const { own, foreign } = endpointsOf(
      request("get", "/v1/webhook_endpoints", { limit: 100 }).data,
      target.origin,
    );
    if (own.length !== 1) return [own.length ? "endpoint_duplicati" : "endpoint_assente"];
    const [endpoint] = own;
    return [
      ...(endpoint.status === "enabled" ? [] : ["status"]),
      ...differences([...stripeWebhookEvents], endpoint.enabled_events, "enabled_events"),
      ...(foreign.length ? ["endpoint_altro_ambiente"] : []),
    ];
  });

  attempt("portale", () => {
    const configuration = request("get", "/v1/billing_portal/configurations", {
      is_default: true,
      active: true,
      limit: 1,
    }).data[0];
    if (!configuration) return ["configurazione_assente"];
    return differences(stripePortalConfiguration(target.origin), configuration);
  });

  return results;
}

/**
 * Allinea impostazioni fiscali, endpoint e portale. Un endpoint nuovo restituisce il segreto
 * una sola volta: si scrive in `secretFile` senza sovrascrivere un file esistente. Endpoint
 * duplicati o di un altro ambiente non si toccano: li decide l'owner dalla dashboard.
 */
export function applyAccount(request, target, { secretFile, writeSecret = writeSecretFile }) {
  const actions = [];
  const tax = request("get", "/v1/tax/settings");
  if (tax.livemode !== target.live) return actions;

  const taxCodes = new Set();
  for (const offer of offers) {
    const id = target.prices[offer];
    if (!id) continue;
    const price = request("get", `/v1/prices/${id}`, { expand: ["product"] });
    if (price.product?.tax_code) taxCodes.add(price.product.tax_code);
  }
  const taxCode = taxCodes.size === 1 ? [...taxCodes][0] : null;
  if (
    taxCode &&
    (tax.defaults?.tax_behavior !== "exclusive" || tax.defaults?.tax_code !== taxCode)
  ) {
    request("post", "/v1/tax/settings", {
      defaults: { tax_behavior: "exclusive", tax_code: taxCode },
    });
    actions.push("impostazioni fiscali aggiornate");
  }

  const { own } = endpointsOf(
    request("get", "/v1/webhook_endpoints", { limit: 100 }).data,
    target.origin,
  );
  const events = { enabled_events: [...stripeWebhookEvents] };
  if (!own.length) {
    if (!secretFile) throw new Error("Serve --secret-file per custodire il segreto del webhook.");
    const created = request("post", "/v1/webhook_endpoints", {
      url: `${target.origin}${webhookPath}`,
      ...events,
    });
    writeSecret(secretFile, created.secret);
    actions.push("endpoint creato, segreto nel file indicato");
  } else if (own.length === 1) {
    const [endpoint] = own;
    if (
      endpoint.status !== "enabled" ||
      differences(events.enabled_events, endpoint.enabled_events).length
    ) {
      request("post", `/v1/webhook_endpoints/${endpoint.id}`, { ...events, disabled: false });
      actions.push("endpoint aggiornato");
    }
  }

  const configuration = request("get", "/v1/billing_portal/configurations", {
    is_default: true,
    active: true,
    limit: 1,
  }).data[0];
  const portal = stripePortalConfiguration(target.origin);
  if (configuration && differences(portal, configuration).length) {
    request("post", `/v1/billing_portal/configurations/${configuration.id}`, portal);
    actions.push("portale aggiornato");
  }
  return actions;
}

function writeSecretFile(file, secret) {
  writeFileSync(file, secret, { flag: "wx", mode: 0o600 });
}

/** Resoconto senza valori dell'account: esito di ogni controllo e campi diversi. */
export function report(results) {
  return results
    .map(({ item, ok, problems }) => (ok ? `✓ ${item}` : `✗ ${item}: ${problems.join(", ")}`))
    .join("\n");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const { values } = parseArgs({
    options: {
      mode: { type: "string", default: "test" },
      "project-name": { type: "string" },
      apply: { type: "boolean", default: false },
      "secret-file": { type: "string" },
    },
  });
  if (!["test", "live"].includes(values.mode)) throw new Error("--mode accetta test o live.");
  const target = targetOf(values.mode);
  const request = cliRequest({ live: target.live, project: values["project-name"] });
  if (values.apply)
    try {
      for (const action of applyAccount(request, target, { secretFile: values["secret-file"] }))
        console.log(`→ ${action}`);
    } catch (error) {
      console.error(
        `✗ allineamento: ${error instanceof StripeRequestError ? error.code : error.message}`,
      );
      process.exitCode = 1;
    }
  const results = checkAccount(request, target);
  console.log(report(results));
  if (results.some(({ ok }) => !ok)) process.exitCode = 1;
}
