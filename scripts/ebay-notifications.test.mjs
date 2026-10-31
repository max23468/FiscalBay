import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applicationToken,
  applicationTopics,
  applyNotifications,
  checkNotifications,
  endpointOf,
  notificationRequest,
  readNotifications,
  report,
  testNotifications,
} from "./ebay-notifications.mjs";

const endpoint = "https://test.fiscalbay.it/webhooks/ebay";
const token = "v".repeat(40);

/** Notification API simulata con lo stato del keyset; registra le chiamate senza il token. */
function ebay(state) {
  const calls = [];
  let ids = 0;
  const fetcher = async (url, init = {}) => {
    const { pathname, searchParams } = new URL(url);
    const resource = pathname.replace("/commerce/notification/v1/", "");
    const method = init.method ?? "GET";
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ method, resource, ...(body ? { body } : {}) });
    assert.equal(init.headers.authorization, "Bearer app-token");
    if (method === "GET" && resource === "config")
      return state.config ? Response.json(state.config) : new Response(null, { status: 404 });
    if (method === "GET" && resource === "destination")
      return Response.json({ destinations: state.destinations });
    if (method === "GET" && resource === "subscription") {
      // Due pagine: la seconda arriva dal link `next` con il token di continuazione.
      const second = searchParams.has("continuation_token");
      return Response.json({
        subscriptions: state.subscriptions.slice(second ? 1 : 0, second ? undefined : 1),
        ...(!second && state.subscriptions.length > 1
          ? {
              next: "https://api.ebay.com/commerce/notification/v1/subscription?limit=100&continuation_token=x",
            }
          : {}),
      });
    }
    if (method === "POST" && resource === "destination") {
      state.destinations.push({
        destinationId: `d${++ids}`,
        status: body.status,
        deliveryConfig: { endpoint: body.deliveryConfig.endpoint },
      });
      return new Response(null, { status: 201 });
    }
    if (method === "POST" && resource === "subscription") {
      state.subscriptions.push({ subscriptionId: `s${++ids}`, ...body });
      return new Response(null, { status: 201 });
    }
    const [, id, action] = resource.split("/");
    const subscription = state.subscriptions.find(({ subscriptionId }) => subscriptionId === id);
    if (method === "PUT") Object.assign(subscription, body);
    if (action === "test" && state.rejectTest)
      return Response.json({ errors: [{ errorId: 195013 }] }, { status: 404 });
    return new Response(null, { status: method === "PUT" ? 204 : 202 });
  };
  return { request: notificationRequest("app-token", fetcher), calls, state };
}

const ours = {
  destinationId: "ours",
  status: "ENABLED",
  deliveryConfig: { endpoint },
};
const other = {
  destinationId: "other",
  status: "ENABLED",
  deliveryConfig: { endpoint: "https://fiscalbay.it/webhooks/ebay" },
};
const deletion = {
  subscriptionId: "deletion",
  topicId: "MARKETPLACE_ACCOUNT_DELETION",
  status: "ENABLED",
  destinationId: "ours",
  payload: { format: "JSON", schemaVersion: "1.0", deliveryProtocol: "HTTPS" },
};

describe("notifiche eBay dell'applicazione", () => {
  it("legge l'ingresso eBay dell'ambiente da cloudflare.config.ts", () => {
    assert.equal(endpointOf("test"), endpoint);
    assert.equal(endpointOf("live"), "https://fiscalbay.it/webhooks/ebay");
  });

  it("chiede il token dell'applicazione con il solo scope base e non ne espone il rifiuto", async () => {
    let request;
    const accepted = await applicationToken(
      { clientId: "id", clientSecret: "secret" },
      (...args) => {
        request = args;
        return Promise.resolve(Response.json({ access_token: "app-token" }));
      },
    );
    assert.equal(accepted, "app-token");
    assert.equal(request[1].headers.authorization, `Basic ${btoa("id:secret")}`);
    assert.equal(
      request[1].body.toString(),
      "grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope",
    );
    await assert.rejects(
      applicationToken({ clientId: "id", clientSecret: "secret" }, () =>
        Promise.resolve(Response.json({ error: "invalid_client" }, { status: 401 })),
      ),
      { message: "token dell'applicazione: rifiutato" },
    );
  });

  it("segnala topic mancanti, poi li sottoscrive sulla destinazione dell'ambiente", async () => {
    const api = ebay({
      config: { alertEmail: "avvisi@example.com" },
      destinations: [other, ours],
      subscriptions: [deletion],
    });
    const before = checkNotifications(await readNotifications(api.request, endpoint));
    assert.deepEqual(
      before.filter(({ ok }) => !ok).map(({ item }) => item),
      ["sottoscrizione AUTHORIZATION_REVOCATION", "sottoscrizione BULK_DATA_TRANSFER_THRESHOLD"],
    );
    api.calls.length = 0;
    await applyNotifications(api.request, endpoint, await readNotifications(api.request, endpoint));
    assert.deepEqual(
      api.calls.filter(({ method }) => method !== "GET"),
      ["AUTHORIZATION_REVOCATION", "BULK_DATA_TRANSFER_THRESHOLD"].map((topicId) => ({
        method: "POST",
        resource: "subscription",
        body: {
          topicId,
          destinationId: "ours",
          payload: { format: "JSON", schemaVersion: "1.0", deliveryProtocol: "HTTPS" },
          status: "ENABLED",
        },
      })),
    );
    const after = checkNotifications(await readNotifications(api.request, endpoint));
    assert.ok(after.every(({ ok }) => ok));
    assert.equal(
      report(after),
      [
        "✓ email di avviso",
        "✓ destinazione abilitata",
        ...Object.keys(applicationTopics).map((topic) => `✓ sottoscrizione ${topic}`),
      ].join("\n"),
    );
    // Allineato: ripeterlo non chiama eBay in scrittura.
    api.calls.length = 0;
    await applyNotifications(api.request, endpoint, await readNotifications(api.request, endpoint));
    assert.ok(api.calls.every(({ method }) => method === "GET"));
  });

  it("sposta sull'ambiente e riabilita le sottoscrizioni che puntano altrove o sono spente", async () => {
    const api = ebay({
      config: { alertEmail: "avvisi@example.com" },
      destinations: [other, ours],
      subscriptions: [
        { ...deletion, destinationId: "other" },
        {
          ...deletion,
          subscriptionId: "revocation",
          topicId: "AUTHORIZATION_REVOCATION",
          status: "DISABLED",
        },
        {
          ...deletion,
          subscriptionId: "threshold",
          topicId: "BULK_DATA_TRANSFER_THRESHOLD",
          payload: { ...deletion.payload, schemaVersion: "2.0" },
        },
      ],
    });
    const state = await readNotifications(api.request, endpoint);
    assert.deepEqual(
      checkNotifications(state).map(({ ok }) => ok),
      [true, true, false, false, false],
    );
    api.calls.length = 0;
    await applyNotifications(api.request, endpoint, state);
    assert.deepEqual(
      api.calls.map(({ method, resource }) => `${method} ${resource}`),
      ["PUT subscription/deletion", "PUT subscription/revocation", "PUT subscription/threshold"],
    );
    assert.ok(
      checkNotifications(await readNotifications(api.request, endpoint)).every(({ ok }) => ok),
    );
  });

  it("crea la destinazione assente soltanto con il token di verifica", async () => {
    const api = ebay({ config: null, destinations: [other], subscriptions: [] });
    const state = await readNotifications(api.request, endpoint);
    assert.deepEqual(
      checkNotifications(state)
        .filter(({ ok }) => !ok)
        .map(({ item }) => item),
      [
        "email di avviso",
        "destinazione abilitata",
        ...Object.keys(applicationTopics).map((topic) => `sottoscrizione ${topic}`),
      ],
    );
    await assert.rejects(applyNotifications(api.request, endpoint, state, "corto"), {
      message: "Destinazione assente: serve EBAY_NOTIFICATION_VERIFICATION_TOKEN.",
    });
    assert.ok(api.calls.every(({ method }) => method === "GET"));
    await applyNotifications(api.request, endpoint, state, token);
    assert.deepEqual(
      api.calls.find(({ method }) => method === "POST"),
      {
        method: "POST",
        resource: "destination",
        body: {
          name: "test.fiscalbay.it",
          status: "ENABLED",
          deliveryConfig: { endpoint, verificationToken: token },
        },
      },
    );
    const after = checkNotifications(await readNotifications(api.request, endpoint));
    assert.deepEqual(
      after.filter(({ ok }) => !ok).map(({ item }) => item),
      ["email di avviso"],
    );
  });

  it("chiede consegne di prova soltanto per le sottoscrizioni dell'ambiente", async () => {
    const api = ebay({
      destinations: [other, ours],
      subscriptions: [
        deletion,
        {
          ...deletion,
          subscriptionId: "revocation",
          topicId: "AUTHORIZATION_REVOCATION",
          destinationId: "other",
        },
      ],
    });
    const state = await readNotifications(api.request, endpoint);
    api.calls.length = 0;
    assert.deepEqual(await testNotifications(api.request, state), [
      { item: "consegna di prova MARKETPLACE_ACCOUNT_DELETION richiesta", ok: true },
      { item: "consegna di prova AUTHORIZATION_REVOCATION richiesta", ok: false },
      { item: "consegna di prova BULK_DATA_TRANSFER_THRESHOLD richiesta", ok: false },
    ]);
    assert.deepEqual(api.calls, [{ method: "POST", resource: "subscription/deletion/test" }]);
    api.state.rejectTest = true;
    assert.equal((await testNotifications(api.request, state))[0].ok, false);
  });

  it("un errore di eBay porta metodo, percorso e codice, senza identificativi", async () => {
    const request = notificationRequest("app-token", async () =>
      Response.json({ errors: [{ errorId: 195011 }] }, { status: 403 }),
    );
    await assert.rejects(request("POST", "subscription/abc/test"), {
      message: "POST subscription/…/test: 403 (195011)",
    });
  });
});
