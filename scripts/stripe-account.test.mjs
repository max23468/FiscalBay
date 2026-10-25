import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  stripePortalConfiguration,
  stripeWebhookEvents,
} from "../app/integrations/stripe-account.server.ts";
import {
  applyAccount,
  checkAccount,
  differences,
  formParams,
  report,
  targetOf,
} from "./stripe-account.mjs";

const origin = "https://fiscalbay.it";
const target = {
  live: true,
  origin,
  prices: { monthly: "price_monthly", annual: "price_annual", lifetime: "price_lifetime" },
};
const product = { id: "prod_premium", active: true, tax_code: "txcd_10103001" };
const price = (id, amount, recurring) => ({
  id,
  livemode: true,
  active: true,
  currency: "eur",
  unit_amount: amount,
  tax_behavior: "exclusive",
  type: recurring ? "recurring" : "one_time",
  recurring: recurring ? { interval: recurring, interval_count: 1 } : null,
  product,
});

/** Account live configurato come il codice si aspetta, con le variazioni del singolo caso. */
function account(change = (state) => state) {
  const state = change({
    tax: {
      livemode: true,
      status: "active",
      defaults: { tax_behavior: "exclusive", tax_code: product.tax_code },
      head_office: { address: { country: "IT" } },
    },
    profile: {
      name: "FiscalBay",
      url: origin,
      support_email: "supporto@fiscalbay.it",
      support_url: null,
    },
    prices: {
      price_monthly: price("price_monthly", 490, "month"),
      price_annual: price("price_annual", 4900, "year"),
      price_lifetime: price("price_lifetime", 14900, null),
    },
    endpoints: [
      {
        id: "we_live",
        url: `${origin}/webhooks/stripe`,
        status: "enabled",
        enabled_events: [...stripeWebhookEvents].reverse(),
      },
      { id: "we_other", url: "https://example.invalid/hook", status: "enabled" },
    ],
    portals: [{ id: "bpc_live", ...structuredClone(stripePortalConfiguration(origin)) }],
  });
  const calls = [];
  const request = (method, resource, params) => {
    calls.push(`${method} ${resource}`);
    if (method === "post") return { id: "we_new", secret: "whsec_nuovo", params };
    if (resource === "/v1/tax/settings") return state.tax;
    if (resource === "/v1/account") return { business_profile: state.profile };
    if (resource === "/v1/webhook_endpoints") return { data: state.endpoints };
    if (resource === "/v1/billing_portal/configurations") return { data: state.portals };
    const found = state.prices[resource.replace("/v1/prices/", "")];
    if (!found) throw Object.assign(new Error("resource_missing"), { code: "resource_missing" });
    return found;
  };
  return { request, calls };
}

const failures = (results) =>
  Object.fromEntries(results.filter(({ ok }) => !ok).map(({ item, problems }) => [item, problems]));

describe("account Stripe dell'ambiente", () => {
  it("legge target e prezzi dalla configurazione di ogni Worker", () => {
    const test = targetOf("test");
    assert.equal(test.live, false);
    assert.equal(test.origin, "https://test.fiscalbay.it");
    assert.ok(Object.values(test.prices).every((id) => id.startsWith("price_")));
    const live = targetOf("live");
    assert.equal(live.live, true);
    assert.equal(live.origin, origin);
    // Nessun prezzo del test diventa un prezzo live.
    for (const id of Object.values(live.prices))
      assert.equal(Object.values(test.prices).includes(id), false);
  });

  it("conferma un account allineato senza riportarne i valori", () => {
    const { request, calls } = account();
    const results = checkAccount(request, target);
    assert.deepEqual(failures(results), {});
    assert.equal(calls.includes("post /v1/tax/settings"), false);
    assert.equal(
      report(results),
      [
        "✓ ambiente",
        "✓ profilo pubblico",
        "✓ prezzo monthly",
        "✓ prezzo annual",
        "✓ prezzo lifetime",
        "✓ impostazioni fiscali",
        "✓ webhook",
        "✓ portale",
      ].join("\n"),
    );
  });

  it("si ferma alla chiave dell'altro ambiente", () => {
    const { request, calls } = account((state) => ({
      ...state,
      tax: { ...state.tax, livemode: false },
    }));
    assert.deepEqual(failures(checkAccount(request, target)), { ambiente: ["chiave_di_test"] });
    assert.deepEqual(calls, ["get /v1/tax/settings"]);
    const failing = () => {
      throw Object.assign(new Error("cli_failed"), { code: "cli_failed" });
    };
    assert.equal(checkAccount(failing, target)[0].ok, false);
  });

  it("segnala profilo, prezzi, imposte, webhook e portale non allineati", () => {
    const { request } = account((state) => ({
      tax: { ...state.tax, defaults: { tax_behavior: "inclusive", tax_code: null } },
      profile: {
        ...state.profile,
        name: "Temisfera",
        support_email: "info@fiscalbay.it",
        support_url: "https://accessible.stripe.com/support",
      },
      prices: {
        price_monthly: { ...state.prices.price_monthly, livemode: false },
        price_annual: { ...state.prices.price_annual, unit_amount: 5900 },
      },
      endpoints: [
        {
          ...state.endpoints[0],
          status: "disabled",
          enabled_events: stripeWebhookEvents.slice(1),
        },
        { id: "we_test", url: "https://test.fiscalbay.it/webhooks/stripe", status: "enabled" },
      ],
      portals: [
        {
          ...state.portals[0],
          default_return_url: "https://test.fiscalbay.it/app/impostazioni/piano",
          features: {
            ...state.portals[0].features,
            subscription_update: { enabled: true },
          },
        },
      ],
    }));
    assert.deepEqual(
      failures(checkAccount(request, { ...target, prices: { ...target.prices, lifetime: "" } })),
      {
        "profilo pubblico": ["name", "support_email", "support_url"],
        "prezzo monthly": ["livemode"],
        "prezzo annual": ["amount"],
        "prezzo lifetime": ["non_configurato"],
        "impostazioni fiscali": ["defaults.tax_behavior", "defaults.tax_code"],
        webhook: ["status", "enabled_events", "endpoint_altro_ambiente"],
        portale: ["default_return_url", "features.subscription_update.enabled"],
      },
    );
  });

  it("riconosce un prezzo assente, endpoint mancanti o duplicati e il portale da salvare", () => {
    const { request } = account((state) => ({
      ...state,
      prices: {},
      endpoints: [state.endpoints[0], state.endpoints[0]],
      portals: [],
    }));
    const found = failures(checkAccount(request, target));
    assert.deepEqual(found["prezzo monthly"], ["resource_missing"]);
    assert.deepEqual(found.webhook, ["endpoint_duplicati"]);
    assert.deepEqual(found.portale, ["configurazione_assente"]);
    // Senza i prodotti del listino il codice fiscale predefinito non è verificabile.
    assert.deepEqual(found["impostazioni fiscali"], ["defaults.tax_code"]);
    const empty = account((state) => ({ ...state, endpoints: [] }));
    assert.deepEqual(failures(checkAccount(empty.request, target)).webhook, ["endpoint_assente"]);
  });

  it("non tocca un account già allineato", () => {
    const { request, calls } = account();
    assert.deepEqual(applyAccount(request, target, { secretFile: "unused" }), []);
    assert.equal(
      calls.some((call) => call.startsWith("post")),
      false,
    );
  });

  it("allinea imposte, endpoint e portale e custodisce soltanto nel file il segreto nuovo", () => {
    const posts = [];
    const secrets = [];
    const { request } = account((state) => ({
      ...state,
      tax: { ...state.tax, defaults: { tax_behavior: "inclusive", tax_code: null } },
      endpoints: [],
      portals: [{ ...state.portals[0], default_return_url: null }],
    }));
    const recording = (method, resource, params) => {
      if (method === "post") posts.push([resource, params]);
      return request(method, resource, params);
    };
    const actions = applyAccount(recording, target, {
      secretFile: "/tmp/segreto",
      writeSecret: (file, secret) => secrets.push([file, secret]),
    });
    assert.deepEqual(actions, [
      "impostazioni fiscali aggiornate",
      "endpoint creato, segreto nel file indicato",
      "portale aggiornato",
    ]);
    assert.deepEqual(secrets, [["/tmp/segreto", "whsec_nuovo"]]);
    assert.equal(actions.join(" ").includes("whsec_"), false);
    assert.deepEqual(posts, [
      ["/v1/tax/settings", { defaults: { tax_behavior: "exclusive", tax_code: product.tax_code } }],
      [
        "/v1/webhook_endpoints",
        { url: `${origin}/webhooks/stripe`, enabled_events: [...stripeWebhookEvents] },
      ],
      ["/v1/billing_portal/configurations/bpc_live", stripePortalConfiguration(origin)],
    ]);
  });

  it("riattiva l'endpoint con gli eventi attesi e lascia all'owner i duplicati", () => {
    const posts = [];
    const drifted = account((state) => ({
      ...state,
      endpoints: [{ ...state.endpoints[0], status: "disabled" }],
    }));
    applyAccount(
      (method, resource, params) => {
        if (method === "post") posts.push([resource, params]);
        return drifted.request(method, resource, params);
      },
      target,
      {},
    );
    assert.deepEqual(posts, [
      [
        "/v1/webhook_endpoints/we_live",
        { enabled_events: [...stripeWebhookEvents], disabled: false },
      ],
    ]);
    const duplicated = account((state) => ({
      ...state,
      endpoints: [state.endpoints[0], { ...state.endpoints[0], id: "we_copy", status: "disabled" }],
    }));
    assert.deepEqual(applyAccount(duplicated.request, target, {}), []);
    // Senza il file per il segreto un endpoint nuovo non nasce.
    const missing = account((state) => ({ ...state, endpoints: [] }));
    assert.throws(() => applyAccount(missing.request, target, {}), /--secret-file/u);
    // Con la chiave dell'altro ambiente non scrive nulla.
    const foreign = account((state) => ({ ...state, tax: { ...state.tax, livemode: false } }));
    assert.deepEqual(applyAccount(foreign.request, target, {}), []);
    assert.deepEqual(foreign.calls, ["get /v1/tax/settings"]);
  });

  it("codifica i parametri come i form di Stripe e confronta gli elenchi come insiemi", () => {
    assert.deepEqual(formParams({ a: { b: ["x", "y"] }, c: false, d: 1 }), [
      ["a[b][0]", "x"],
      ["a[b][1]", "y"],
      ["c", "false"],
      ["d", "1"],
    ]);
    assert.deepEqual(
      differences(
        { list: ["a", "b"], nested: { on: true } },
        { list: ["b", "a"], nested: { on: true } },
      ),
      [],
    );
    assert.deepEqual(differences({ list: ["a", "b"], nested: { on: true } }, { list: ["a"] }), [
      "list",
      "nested.on",
    ]);
  });
});
