#!/usr/bin/env node
/**
 * Rilegge le notifiche eBay dell'applicazione sul keyset Production e le confronta con il codice:
 * email di avviso configurata, destinazione abilitata su `APP_ORIGIN` più `/webhooks/ebay` e una
 * sottoscrizione abilitata, su quella destinazione, per ogni topic dell'applicazione gestito
 * dall'ingresso (D215). Con `--apply` crea le sottoscrizioni mancanti, abilita quelle disattivate
 * e sposta sulla destinazione dell'ambiente quelle che puntano altrove: il keyset è condiviso fra
 * test e Production ed eBay ammette una sola sottoscrizione per topic, quindi al cutover la
 * stessa chiamata con `--mode live` le porta su `fiscalbay.it`. Senza destinazione la crea, se il
 * processo ha `EBAY_NOTIFICATION_VERIFICATION_TOKEN`, ed eBay la verifica con il challenge del
 * Worker. Con `--test` chiede a eBay una consegna di prova per ogni topic.
 *
 * Il keyset arriva dal Portachiavi; il resoconto riporta soltanto l'esito di ogni controllo,
 * senza email, token o identificativi.
 *
 * Uso: node scripts/ebay-notifications.mjs [--mode live] [--apply] [--test]
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import config from "../cloudflare.config.ts";
import { keychainItems } from "./ebay-mcp.mjs";
import { keychain } from "./lib/provider.mjs";

const api = "https://api.ebay.com";
const notificationApi = `${api}/commerce/notification/v1`;

/**
 * Topic dell'applicazione e versione dello schema letta dall'ingresso. `ORDER_CONFIRMATION` è un
 * topic del venditore: si sottoscrive con il suo token, non da qui.
 */
export const applicationTopics = {
  MARKETPLACE_ACCOUNT_DELETION: "1.0",
  AUTHORIZATION_REVOCATION: "1.0",
  BULK_DATA_TRANSFER_THRESHOLD: "1.0",
};

const payload = (schemaVersion) => ({ format: "JSON", schemaVersion, deliveryProtocol: "HTTPS" });

/** Ingresso eBay Production dell'ambiente, da `cloudflare.config.ts` con la modalità della build. */
export function endpointOf(mode) {
  const { env } = config({ mode: mode === "live" ? "live" : "development" }).worker;
  return `${new URL(env.APP_ORIGIN.value).origin}/webhooks/ebay`;
}

/** Token dell'applicazione: le notifiche dell'applicazione non chiedono altri scope. */
export async function applicationToken({ clientId, clientSecret }, fetcher = fetch) {
  const response = await fetcher(`${api}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: `${api}/oauth/api_scope`,
    }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || typeof body?.access_token !== "string")
    throw new Error("token dell'applicazione: rifiutato");
  return body.access_token;
}

/**
 * Chiamata alla Notification API; l'errore porta soltanto metodo, percorso e codice eBay, mai
 * il token o il corpo della risposta.
 */
export function notificationRequest(token, fetcher = fetch) {
  return async (method, resource, body) => {
    const response = await fetcher(`${notificationApi}/${resource}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body ? { "content-type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) {
      const errorId = (await response.json().catch(() => null))?.errors?.[0]?.errorId;
      const route = resource.replace(/^(subscription|destination)\/[^/?]+/u, "$1/…");
      throw new Error(`${method} ${route}: ${response.status}${errorId ? ` (${errorId})` : ""}`);
    }
    return response.status === 204 || response.status === 201 || response.status === 202
      ? null
      : response.json();
  };
}

/** Elenco completo di una risorsa paginata della Notification API. */
async function all(request, resource, field) {
  const items = [];
  let next = `${resource}?limit=100`;
  while (next) {
    const page = await request("GET", next);
    items.push(...(page?.[field] ?? []));
    next = page?.next ? page.next.slice(page.next.indexOf(resource)) : null;
  }
  return items;
}

/** Configurazione, destinazione dell'ambiente e sottoscrizioni dell'applicazione. */
export async function readNotifications(request, endpoint) {
  const [configuration, destinations, subscriptions] = await Promise.all([
    request("GET", "config").catch(() => null),
    all(request, "destination", "destinations"),
    all(request, "subscription", "subscriptions"),
  ]);
  const destination =
    destinations.find(({ deliveryConfig }) => deliveryConfig?.endpoint === endpoint) ?? null;
  return { alertEmail: Boolean(configuration?.alertEmail), destination, subscriptions };
}

/** Esito di ogni controllo, senza valori del keyset. */
export function checkNotifications({ alertEmail, destination, subscriptions }) {
  return [
    { item: "email di avviso", ok: alertEmail },
    { item: "destinazione abilitata", ok: destination?.status === "ENABLED" },
    ...Object.entries(applicationTopics).map(([topic, schemaVersion]) => {
      const subscription = subscriptions.find(({ topicId }) => topicId === topic);
      return {
        item: `sottoscrizione ${topic}`,
        ok:
          Boolean(destination) &&
          subscription?.status === "ENABLED" &&
          subscription.destinationId === destination.destinationId &&
          subscription.payload?.schemaVersion === schemaVersion,
      };
    }),
  ];
}

/**
 * Crea la destinazione mancante e allinea le sottoscrizioni dell'applicazione; ripeterlo non
 * cambia nulla. Una destinazione disattivata o sospesa da eBay si sistema dal portale.
 */
export async function applyNotifications(request, endpoint, state, verificationToken) {
  let { destination } = state;
  if (!destination) {
    if (!/^[A-Za-z0-9_-]{32,80}$/u.test(verificationToken ?? ""))
      throw new Error("Destinazione assente: serve EBAY_NOTIFICATION_VERIFICATION_TOKEN.");
    await request("POST", "destination", {
      name: new URL(endpoint).hostname,
      status: "ENABLED",
      deliveryConfig: { endpoint, verificationToken },
    });
    destination = (await readNotifications(request, endpoint)).destination;
    if (!destination) throw new Error("Destinazione non riletta dopo la creazione.");
  }
  for (const [topic, schemaVersion] of Object.entries(applicationTopics)) {
    const subscription = state.subscriptions.find(({ topicId }) => topicId === topic);
    const wanted = {
      destinationId: destination.destinationId,
      payload: payload(schemaVersion),
      status: "ENABLED",
    };
    if (!subscription) await request("POST", "subscription", { topicId: topic, ...wanted });
    else if (
      subscription.status !== "ENABLED" ||
      subscription.destinationId !== destination.destinationId ||
      subscription.payload?.schemaVersion !== schemaVersion
    )
      await request("PUT", `subscription/${subscription.subscriptionId}`, wanted);
  }
}

/**
 * Consegna di prova di ogni topic dell'applicazione, soltanto verso la destinazione
 * dell'ambiente: una sottoscrizione che punta altrove non riceve prove da qui.
 */
export async function testNotifications(request, { destination, subscriptions }) {
  const results = [];
  for (const topic of Object.keys(applicationTopics)) {
    const subscription = subscriptions.find(
      ({ topicId, destinationId }) =>
        topicId === topic && destinationId === destination?.destinationId,
    );
    const ok =
      Boolean(subscription) &&
      (await request("POST", `subscription/${subscription.subscriptionId}/test`).then(
        () => true,
        () => false,
      ));
    results.push({ item: `consegna di prova ${topic} richiesta`, ok });
  }
  return results;
}

export function report(results) {
  return results.map(({ item, ok }) => `${ok ? "✓" : "✗"} ${item}`).join("\n");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const { values } = parseArgs({
    options: {
      mode: { type: "string", default: "test" },
      apply: { type: "boolean", default: false },
      test: { type: "boolean", default: false },
    },
  });
  if (!["test", "live"].includes(values.mode)) throw new Error("--mode accetta test o live.");
  const endpoint = endpointOf(values.mode);
  const request = notificationRequest(
    await applicationToken({
      clientId: keychain(keychainItems.clientId),
      clientSecret: keychain(keychainItems.clientSecret),
    }),
  );
  let state = await readNotifications(request, endpoint);
  if (values.apply) {
    await applyNotifications(
      request,
      endpoint,
      state,
      process.env.EBAY_NOTIFICATION_VERIFICATION_TOKEN?.trim(),
    );
    state = await readNotifications(request, endpoint);
  }
  const results = checkNotifications(state);
  if (values.test) results.push(...(await testNotifications(request, state)));
  console.log(report(results));
  if (results.some(({ ok }) => !ok)) process.exitCode = 1;
}
