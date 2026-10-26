import { env } from "cloudflare:workers";
import Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { supportEmail } from "../app/app-copy";
import { annualPaidMonths, firstChargeAt, formatPrice, priceGeneration } from "../app/catalog";
import {
  applyStripeEvent,
  changeSubscriptionPeriod,
  openBillingPortal,
  paidCoverage,
  reconcileBilling,
  stopRenewals,
  subscriptionOffers,
  subscriptionRenews,
  subscriptionView,
} from "../app/domain/billing.server";
import { checkoutConfigured, purchaseState, startCheckout } from "../app/domain/checkout.server";
import { grantLifetimeConcession, grantPremium } from "../app/domain/concessions.server";
import { accountCoverage, orderAllowance, startTrial } from "../app/domain/grants.server";
import { lifetimeContext, refundedShare, unusedCredit } from "../app/domain/lifetime.server";
import {
  catalogMismatch,
  stripeAccountProfile,
  stripePortalConfiguration,
  stripeWebhookEvents,
} from "../app/integrations/stripe-account.server";
import {
  buildManagedCheckoutParams,
  createManagedCheckout,
  createStripeClient,
  createStripeReader,
  isMissingObject,
  stripeRead,
  stripeSecretKey,
  verifyStripeEvent,
} from "../app/integrations/stripe.server";
import { receiveWebhook } from "../app/integrations/webhooks.server";
import { localizedPath } from "../app/i18n";
import { action as settingsAction, loader as settingsLoader } from "../app/routes/settings";
import { verifiedSession } from "./fixtures/account-fixtures";
import { insertStore, now, resetDatabase } from "./fixtures/database-fixtures";
const event = {
  id: "evt_checkout_completed",
  object: "event",
  api_version: "2026-08-26.dahlia",
  created: 1_789_914_800,
  data: { object: { id: "cs_test_checkout", object: "checkout.session" } },
  livemode: false,
  pending_webhooks: 1,
  request: null,
  type: "checkout.session.completed",
} satisfies Stripe.Event;

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM webhook_receipts").run();
});

/** Chiave segreta live: Production accetta soltanto chiavi live, standard o con limitazioni. */
const liveKey = "sk_live_fiscalbay";

const checkoutInput = {
  priceId: "price_test_monthly",
  generation: "2026-09",
  workspaceId: "workspace-test",
  email: "merchant@example.invalid",
  language: "it" as const,
  successUrl: "https://test.fiscalbay.it/app/impostazioni/piano",
  cancelUrl: "https://test.fiscalbay.it/app/impostazioni/piano",
};

/** Prezzo Stripe conforme al listino, con le variazioni del singolo caso. */
function catalogPrice(
  overrides: Record<string, unknown> = {},
  product: Record<string, unknown> = {},
) {
  return {
    id: "price_test_monthly",
    object: "price",
    active: true,
    currency: "eur",
    unit_amount: 490,
    tax_behavior: "exclusive",
    type: "recurring",
    recurring: { interval: "month", interval_count: 1 },
    product: {
      id: "prod_test",
      object: "product",
      active: true,
      tax_code: "txcd_10103001",
      ...product,
    },
    ...overrides,
  } as unknown as Stripe.Price;
}

/**
 * Stripe simulato: prezzi, creazione e chiusura della sessione, con le richieste ricevute. Più
 * prezzi si distinguono per identificativo.
 */
function stripeApi(
  price: Stripe.Price | Record<string, Stripe.Price>,
  session: Record<string, unknown> = {
    id: "cs_test_checkout",
    object: "checkout.session",
    url: "https://checkout.example.invalid/c/pay/cs_test_checkout",
    managed_payments: { enabled: true },
  },
) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const path = new URL(String(input)).pathname;
    const body = !path.startsWith("/v1/prices/")
      ? session
      : "object" in price
        ? price
        : price[path.slice("/v1/prices/".length)];
    return Response.json(body, { headers: { "request-id": "req_test" } });
  });
}

const paths = (request: ReturnType<typeof stripeApi>) =>
  request.mock.calls.map(([url, options]) => `${options?.method} ${new URL(String(url)).pathname}`);

/** Spazio con un negozio collegato; `synced` registra la prima lettura riuscita. */
async function workspace(userId: string, { synced = true } = {}) {
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO workspaces (id, name, created_at) VALUES ('w-a', 'Spazio', ?)",
    ).bind(now),
    env.DB.prepare(
      "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ('w-a', ?, 'owner')",
    ).bind(userId),
    insertStore({ id: "s-a" }),
    ...(synced
      ? [
          env.DB.prepare(
            "INSERT INTO sync_state (store_id, last_success_at, updated_at) VALUES ('s-a', ?1, ?1)",
          ).bind(now),
        ]
      : []),
  ]);
}

function buy(cookie: string, plan: string, path = "/app/impostazioni/piano") {
  return settingsAction({
    request: new Request(`http://localhost:5173${path}`, {
      method: "POST",
      headers: { cookie, origin: "http://localhost:5173" },
      body: new URLSearchParams({ intent: "buy", plan }),
    }),
  } as Parameters<typeof settingsAction>[0]);
}

describe("Stripe Managed Payments", () => {
  beforeEach(async () => {
    await resetDatabase();
    await env.DB.prepare("DELETE FROM workspace_entitlements").run();
  });

  it("crea soltanto parametri compatibili con Managed Payments", () => {
    const metadata = {
      workspace_id: "workspace-test",
      offer: "monthly",
      price_generation: "2026-09",
    };
    const params = buildManagedCheckoutParams({ ...checkoutInput, offer: "monthly" });
    expect(params).toEqual({
      mode: "subscription",
      line_items: [{ price: "price_test_monthly", quantity: 1 }],
      managed_payments: { enabled: true },
      client_reference_id: "workspace-test",
      integration_identifier: "fiscalbay_mp_qnwjrzta",
      customer_email: "merchant@example.invalid",
      locale: "it",
      metadata,
      subscription_data: { metadata },
      success_url:
        "https://test.fiscalbay.it/app/impostazioni/piano?checkout=processing&session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://test.fiscalbay.it/app/impostazioni/piano?checkout=cancelled",
    });
    // Imposte, valuta e metodi restano a Stripe come merchant of record.
    for (const parameter of [
      "automatic_tax",
      "adaptive_pricing",
      "tax_id_collection",
      "payment_method_types",
      "payment_method_configuration",
      "excluded_payment_method_types",
      "invoice_creation",
    ])
      expect(params).not.toHaveProperty(parameter);
    const lifetime = buildManagedCheckoutParams({
      ...checkoutInput,
      offer: "lifetime",
      priceId: "price_test_lifetime",
    });
    expect(lifetime.mode).toBe("payment");
    expect(lifetime.payment_intent_data).toEqual({
      metadata: { ...metadata, offer: "lifetime" },
    });
    expect(lifetime).not.toHaveProperty("subscription_data");
  });

  it("vende soltanto prezzi conformi al listino netto e coperti da Managed Payments", () => {
    const net = priceGeneration.net.monthly;
    expect(catalogMismatch(catalogPrice(), "monthly", net)).toBeNull();
    expect(catalogMismatch(catalogPrice({ active: false }), "monthly", net)).toBe("inactive");
    expect(catalogMismatch(catalogPrice({}, { active: false }), "monthly", net)).toBe("inactive");
    expect(catalogMismatch(catalogPrice({ product: "prod_test" }), "monthly", net)).toBe(
      "inactive",
    );
    expect(catalogMismatch(catalogPrice({ currency: "usd" }), "monthly", net)).toBe("currency");
    expect(catalogMismatch(catalogPrice({ unit_amount: 590 }), "monthly", net)).toBe("amount");
    // Un prezzo con imposte incluse, o senza indicazione, non è il listino netto.
    expect(catalogMismatch(catalogPrice({ tax_behavior: "inclusive" }), "monthly", net)).toBe(
      "tax_behavior",
    );
    expect(catalogMismatch(catalogPrice({ tax_behavior: "unspecified" }), "monthly", net)).toBe(
      "tax_behavior",
    );
    expect(catalogMismatch(catalogPrice(), "annual", net)).toBe("billing_period");
    expect(
      catalogMismatch(
        catalogPrice({ recurring: { interval: "month", interval_count: 12 } }),
        "monthly",
        net,
      ),
    ).toBe("billing_period");
    expect(catalogMismatch(catalogPrice(), "lifetime", net)).toBe("billing_period");
    expect(
      catalogMismatch(catalogPrice({ type: "one_time", recurring: null }), "lifetime", net),
    ).toBeNull();
    expect(catalogMismatch(catalogPrice({}, { tax_code: null }), "monthly", net)).toBe("tax_code");
    // Un prezzo una tantum non vale come mensile o annuale.
    expect(
      catalogMismatch(catalogPrice({ type: "one_time", recurring: null }), "monthly", net),
    ).toBe("billing_period");
  });

  it("descrive dalla configurazione l'account Stripe atteso di ogni ambiente", () => {
    const origin = "https://fiscalbay.it";
    expect(stripeAccountProfile(true, origin)).toEqual({
      name: "FiscalBay",
      url: origin,
      supportEmail,
    });
    expect(stripeAccountProfile(false, "https://test.fiscalbay.it")).toEqual({
      name: "FiscalBay Sandbox",
      url: "https://test.fiscalbay.it",
      supportEmail,
    });
    const portal = stripePortalConfiguration(origin);
    expect(portal.business_profile).toEqual({
      privacy_policy_url: `${origin}/privacy`,
      terms_of_service_url: `${origin}/termini`,
    });
    expect(portal.default_return_url).toBe(
      `${origin}${localizedPath("it", "/app/impostazioni/piano")}`,
    );
    // Disdetta a fine periodo senza conguaglio; la periodicità cambia dalla pagina del piano.
    // Il cliente aggiorna i propri dati e il metodo di pagamento e consulta i documenti.
    expect(portal.features).toEqual({
      customer_update: { enabled: true, allowed_updates: ["name", "email", "address"] },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: {
        enabled: true,
        mode: "at_period_end",
        proration_behavior: "none",
        cancellation_reason: {
          enabled: true,
          options: ["too_expensive", "switched_service", "unused", "other"],
        },
      },
      subscription_update: { enabled: false },
    });
    expect(new Set(stripeWebhookEvents).size).toBe(stripeWebhookEvents.length);
  });

  it("mostra il listino netto dalla sola fonte del catalogo", () => {
    expect(formatPrice(priceGeneration.net.monthly, "it")).toBe("4,90\u00a0€");
    expect(formatPrice(priceGeneration.net.annual, "en")).toBe("€49");
    expect(formatPrice(priceGeneration.net.lifetime, "it")).toBe("149\u00a0€");
    // L'annuale costa dieci mesi: dodici al prezzo di dieci.
    expect(annualPaidMonths()).toBe(10);
  });

  it("crea il checkout con il trasporto Fetch del Worker e restituisce la sessione", async () => {
    const session = {
      id: "cs_test_transport",
      object: "checkout.session",
      url: "https://checkout.example.invalid/test",
    };
    const transport = vi.spyOn(Stripe, "createFetchHttpClient");
    const request = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        Response.json(session, { headers: { "request-id": "req_test_transport" } }),
      );
    try {
      const client = await createStripeClient("sk_test_transport");
      expect(transport).toHaveBeenCalledOnce();
      expect(
        await createManagedCheckout(client, {
          ...checkoutInput,
          offer: "annual",
          priceId: "price_test_annual",
        }),
      ).toMatchObject(session);
      expect(request).toHaveBeenCalledOnce();
      const [url, options] = request.mock.calls[0]!;
      expect(new URL(String(url)).pathname).toBe("/v1/checkout/sessions");
      expect(options?.method).toBe("POST");
      expect(new Headers(options?.headers).get("authorization")).toBe("Bearer sk_test_transport");
      const body = new URLSearchParams(String(options?.body));
      expect(body.get("line_items[0][price]")).toBe("price_test_annual");
      expect(body.get("managed_payments[enabled]")).toBe("true");
      expect(body.get("metadata[offer]")).toBe("annual");
      expect(body.get("subscription_data[metadata][workspace_id]")).toBe("workspace-test");
    } finally {
      request.mockRestore();
      transport.mockRestore();
    }
  });

  it("richiede la prima lettura riuscita e nessuna copertura in corso", async () => {
    const { userId } = await verifiedSession("acquisto-stato@example.invalid");
    expect(await purchaseState(env.DB, userId)).toBeNull();
    await workspace(userId, { synced: false });
    expect(await purchaseState(env.DB, userId)).toEqual({
      workspaceId: "w-a",
      state: "needs-sync",
      trialEndsAt: null,
    });
    await env.DB.prepare(
      "INSERT INTO sync_state (store_id, last_success_at, updated_at) VALUES ('s-a', ?1, ?1)",
    )
      .bind(now)
      .run();
    // Anche senza ordini: conta la lettura riuscita, e resta dopo lo scollegamento.
    expect(await purchaseState(env.DB, userId)).toEqual({
      workspaceId: "w-a",
      state: "available",
      trialEndsAt: null,
    });
    // Durante la prova l'acquisto resta possibile e ne conserva la fine.
    await env.DB.prepare(
      `INSERT INTO workspace_entitlements (id, workspace_id, source, starts_at, ends_at)
       VALUES ('trial', 'w-a', 'trial', ?, ?)`,
    )
      .bind(now, "2026-09-27T20:00:00.000Z")
      .run();
    expect(await purchaseState(env.DB, userId)).toEqual({
      workspaceId: "w-a",
      state: "available",
      trialEndsAt: "2026-09-27T20:00:00.000Z",
    });
    // Alla fine della prova l'acquisto è quello ordinario.
    expect(await purchaseState(env.DB, userId, new Date("2026-09-27T20:00:00.000Z"))).toEqual({
      workspaceId: "w-a",
      state: "available",
      trialEndsAt: null,
    });
    // Un altro diritto in corso ferma l'acquisto, anche insieme alla prova.
    await env.DB.prepare(
      `INSERT INTO workspace_entitlements (id, workspace_id, source, starts_at, ends_at)
       VALUES ('admin', 'w-a', 'admin', ?, ?)`,
    )
      .bind(now, "2026-09-25T20:00:00.000Z")
      .run();
    expect(await purchaseState(env.DB, userId)).toEqual({
      workspaceId: "w-a",
      state: "covered",
      trialEndsAt: null,
    });
  });

  it("apre il checkout soltanto con prezzo conforme e sessione Managed Payments", async () => {
    const { userId } = await verifiedSession("acquisto-checkout@example.invalid");
    await workspace(userId);
    const input = {
      request: new Request("http://localhost:5173/app/impostazioni/piano", { method: "POST" }),
      userId,
      email: "acquisto-checkout@example.invalid",
      offer: "annual" as const,
      language: "en" as const,
    };
    const annual = catalogPrice({
      id: "price_test_annual",
      unit_amount: 4900,
      recurring: { interval: "year", interval_count: 1 },
    });

    let api = stripeApi(annual);
    try {
      expect(await startCheckout(env, input)).toEqual({
        ok: true,
        url: "https://checkout.example.invalid/c/pay/cs_test_checkout",
      });
      expect(paths(api)).toEqual([
        "GET /v1/prices/price_test_annual",
        "POST /v1/checkout/sessions",
      ]);
      const body = new URLSearchParams(String(api.mock.calls[1]![1]?.body));
      expect(body.get("client_reference_id")).toBe("w-a");
      expect(body.get("metadata[price_generation]")).toBe(priceGeneration.id);
      expect(body.get("locale")).toBe("en");
      expect(body.get("success_url")).toBe(
        "http://localhost:5173/en/app/impostazioni/piano?checkout=processing&session_id={CHECKOUT_SESSION_ID}",
      );
    } finally {
      api.mockRestore();
    }

    // Un prezzo diverso dal listino ferma la vendita prima di creare la sessione.
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    api = stripeApi(catalogPrice({ unit_amount: 3900, recurring: annual.recurring }));
    try {
      expect(await startCheckout(env, input)).toEqual({ ok: false, reason: "unavailable" });
      expect(paths(api)).toEqual(["GET /v1/prices/price_test_annual"]);
      expect(JSON.parse(String(log.mock.calls.at(-1)?.[0]))).toMatchObject({
        operation: "checkout",
        failure: "catalog_amount",
      });
    } finally {
      api.mockRestore();
    }

    // Una sessione aperta fuori da Managed Payments si chiude e non arriva al cliente.
    api = stripeApi(annual, {
      id: "cs_test_standard",
      object: "checkout.session",
      url: "https://checkout.example.invalid/c/pay/cs_test_standard",
      managed_payments: null,
    });
    try {
      expect(await startCheckout(env, input)).toEqual({ ok: false, reason: "unavailable" });
      // La sessione precedente dello spazio si rilegge prima di aprirne un'altra.
      expect(paths(api)).toEqual([
        "GET /v1/prices/price_test_annual",
        "GET /v1/checkout/sessions/cs_test_checkout",
        "POST /v1/checkout/sessions",
        "POST /v1/checkout/sessions/cs_test_standard/expire",
      ]);
      expect(JSON.parse(String(log.mock.calls.at(-1)?.[0]))).toMatchObject({
        failure: "not_managed",
      });
    } finally {
      api.mockRestore();
    }

    // Stripe non raggiungibile: nessuna sessione, il merchant riprova.
    api = vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("rete assente"));
    try {
      expect(await startCheckout(env, input)).toEqual({ ok: false, reason: "unavailable" });
    } finally {
      api.mockRestore();
      log.mockRestore();
    }
  });

  it("porta a Stripe dalla pagina del piano soltanto quando l'acquisto è possibile", async () => {
    const { userId, cookie } = await verifiedSession("acquisto-piano@example.invalid");
    const api = stripeApi(catalogPrice());
    try {
      // Senza negozio letto nessuna chiamata a Stripe.
      expect(await buy(cookie, "monthly")).toMatchObject({
        data: {
          ok: false,
          notice: "Potrai acquistare Premium dopo la prima lettura riuscita di un negozio.",
        },
        init: { status: 409 },
      });
      await workspace(userId);
      // Un'offerta che il listino non conosce non arriva a Stripe.
      expect(await buy(cookie, "settimanale")).toMatchObject({ init: { status: 400 } });
      expect(api).not.toHaveBeenCalled();

      const response = (await buy(cookie, "monthly")) as Response;
      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toBe(
        "https://checkout.example.invalid/c/pay/cs_test_checkout",
      );

      await env.DB.prepare(
        `INSERT INTO workspace_entitlements (id, workspace_id, source, starts_at, ends_at)
         VALUES ('paid', 'w-a', 'premium', ?, ?)`,
      )
        .bind(now, "2026-10-13T20:00:00.000Z")
        .run();
      expect(await buy(cookie, "annual")).toMatchObject({
        data: { ok: false, notice: "Il tuo spazio ha già Premium attivo." },
      });
      expect(paths(api)).toEqual([
        "GET /v1/prices/price_test_monthly",
        "POST /v1/checkout/sessions",
      ]);
    } finally {
      api.mockRestore();
    }
  });

  it("mostra prezzi, stato dell'acquisto e ritorno da Stripe nella pagina del piano", async () => {
    const { userId, cookie } = await verifiedSession("acquisto-pagina@example.invalid");
    const page = async (query = "") => {
      const result = (await settingsLoader({
        request: new Request(`http://localhost:5173/app/impostazioni/piano${query}`, {
          headers: { cookie },
        }),
        params: { sezione: "piano" },
      } as unknown as Parameters<typeof settingsLoader>[0])) as { page: Record<string, unknown> };
      return result.page;
    };
    expect(await page()).toMatchObject({
      services: { billing: true },
      purchase: {
        state: "needs-sync",
        offers: ["monthly", "annual", "lifetime"],
        // Senza spazio nessun negozio è stato collegato.
        lifetime: null,
        checkout: null,
      },
    });
    await workspace(userId);
    expect(await page("?checkout=processing&session_id=cs_test_checkout")).toMatchObject({
      account: { plan: "free" },
      purchase: {
        state: "available",
        lifetime: { state: "available", credit: 0, replaces: false },
        checkout: "processing",
      },
    });
    expect(await page("?checkout=altro")).toMatchObject({ purchase: { checkout: null } });
    await env.DB.prepare(
      `INSERT INTO workspace_entitlements (id, workspace_id, source, starts_at, ends_at)
       VALUES ('trial', 'w-a', 'trial', ?, ?)`,
    )
      .bind(now, "2026-09-30T09:00:00.000Z")
      .run();
    expect(await page()).toMatchObject({
      account: { plan: "premium", trial: { endsAt: "2026-09-30T09:00:00.000Z" } },
      purchase: { state: "available" },
    });
    const previous = env.STRIPE_PRICE_ANNUAL;
    env.STRIPE_PRICE_ANNUAL = "";
    try {
      expect(await page()).toMatchObject({ services: { billing: false } });
    } finally {
      env.STRIPE_PRICE_ANNUAL = previous;
    }
  });

  it("fa partire il primo addebito alla fine della prova, o subito con meno di due giorni", () => {
    // Prova lontana: il primo addebito coincide con la sua fine, al secondo intero.
    expect(firstChargeAt("2026-09-30T09:00:00.250Z", now)).toBe("2026-09-30T09:00:01.000Z");
    // Il Checkout vuole almeno due giorni di prova: al margine vale ancora la sua fine.
    expect(firstChargeAt("2026-09-15T20:10:00.000Z", now)).toBe("2026-09-15T20:10:00.000Z");
    // Con meno l'addebito è subito, come un acquisto ordinario.
    expect(firstChargeAt("2026-09-15T20:09:59.000Z", now)).toBeNull();
    expect(firstChargeAt("2026-09-14T08:00:00.000Z", now)).toBeNull();
  });

  it("durante la prova apre l'abbonamento con i soli giorni residui, senza incasso oggi", () => {
    const params = buildManagedCheckoutParams({
      ...checkoutInput,
      offer: "annual",
      priceId: "price_test_annual",
      trial: { endsAt: "2026-10-30T09:00:00.250Z", chargeAt: "2026-10-30T09:00:01.000Z" },
    });
    const metadata = {
      workspace_id: "workspace-test",
      offer: "annual",
      price_generation: "2026-09",
      trial_ends_at: "2026-10-30T09:00:00.250Z",
    };
    expect(params).toMatchObject({
      mode: "subscription",
      line_items: [{ price: "price_test_annual", quantity: 1 }],
      managed_payments: { enabled: true },
      metadata,
      subscription_data: {
        metadata,
        trial_end: Date.parse("2026-10-30T09:00:01.000Z") / 1000,
      },
    });
    // Una sola riga: nessun incasso anticipato e nessun rinvio presentato come prova gratuita.
    expect(params.line_items).toHaveLength(1);
    expect(params).not.toHaveProperty("expires_at");
    expect(params.subscription_data).not.toHaveProperty("billing_cycle_anchor");
    expect(params.subscription_data).not.toHaveProperty("trial_period_days");
  });

  it("acquista durante la prova con il primo addebito alla sua fine", async () => {
    const { userId } = await verifiedSession("acquisto-prova@example.invalid");
    await workspace(userId);
    const trialEndsAt = "2026-09-30T09:00:00.000Z";
    await env.DB.prepare(
      `INSERT INTO workspace_entitlements (id, workspace_id, source, starts_at, ends_at)
       VALUES ('trial', 'w-a', 'trial', ?, ?)`,
    )
      .bind(now, trialEndsAt)
      .run();
    const input = {
      request: new Request("http://localhost:5173/app/impostazioni/piano", { method: "POST" }),
      userId,
      email: "acquisto-prova@example.invalid",
      offer: "monthly" as const,
      language: "it" as const,
    };
    const charge = async (at: Date) => {
      const api = stripeApi(catalogPrice());
      try {
        expect(await startCheckout(env, input, at)).toMatchObject({ ok: true });
        expect(paths(api)).toEqual([
          "GET /v1/prices/price_test_monthly",
          "POST /v1/checkout/sessions",
        ]);
        const body = new URLSearchParams(String(api.mock.calls.at(-1)![1]?.body));
        expect(body.get("mode")).toBe("subscription");
        expect(body.has("line_items[1][price]")).toBe(false);
        return {
          trialEnd: body.get("subscription_data[trial_end]"),
          trialEndsAt: body.get("subscription_data[metadata][trial_ends_at]"),
        };
      } finally {
        api.mockRestore();
      }
    };
    // Il primo addebito è alla fine della prova.
    expect(await charge(new Date(now))).toEqual({
      trialEnd: String(Date.parse(trialEndsAt) / 1000),
      trialEndsAt,
    });
    // Nell'ultimo giorno della prova il Checkout non accetta una prova così breve: l'abbonamento
    // parte subito e Premium continua senza interruzioni.
    const late = new Date(Date.parse(trialEndsAt) - 5 * 60 * 60 * 1000);
    expect(await charge(late)).toEqual({ trialEnd: null, trialEndsAt: null });
  });

  it("verifica la firma sul corpo grezzo e registra l'evento una sola volta", async () => {
    const body = JSON.stringify(event);
    const secret = "whsec_fiscalbay_test";
    const signature = await Stripe.webhooks.generateTestHeaderStringAsync({
      payload: body,
      secret,
    });
    const verified = await verifyStripeEvent(body, signature, secret);
    expect(verified).toEqual(event);
    const send = vi.fn().mockResolvedValue(undefined);
    const environment = { ...env, WORK_QUEUE: { send } } as Env;
    const request = () =>
      new Request("https://test.fiscalbay.it/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": signature },
        body,
      });
    for (let delivery = 0; delivery < 2; delivery++)
      expect(
        (await receiveWebhook(request(), environment, fetch, new Date(event.created * 1000)))
          ?.status,
      ).toBe(204);
    expect(send).toHaveBeenCalledOnce();
    expect(
      await env.DB.prepare(
        "SELECT topic, object_id, environment FROM webhook_receipts WHERE provider = 'stripe' AND provider_id = ?",
      )
        .bind(event.id)
        .first(),
    ).toEqual({
      topic: "checkout.session.completed",
      object_id: "cs_test_checkout",
      environment: "test",
    });
  });

  it("rifiuta una firma non valida", async () => {
    await expect(
      verifyStripeEvent(JSON.stringify(event), "t=1,v1=invalid", "whsec_fiscalbay_test"),
    ).rejects.toThrow();
  });
});

const second = (iso: string) => Date.parse(iso) / 1000;
const periodStart = now;
const periodEnd = "2026-10-13T20:00:00.000Z";
const nextEnd = "2026-11-13T20:00:00.000Z";

type FakeSubscription = {
  status: string;
  start: string;
  end: string;
  cancel?: boolean;
  /** Disdetta a un istante esplicito, come dal portale. */
  cancelAt?: string;
  /** Modifica programmata con una Subscription Schedule. */
  schedule?: string;
  /** Abbonamento senza righe. */
  noItems?: boolean;
  metadata?: Record<string, string>;
  livemode?: boolean;
  /** Prezzo del rinnovo; senza, quello della periodicità dei metadati. */
  price?: { id: string; interval: "month" | "year" };
};

type FakeCharge = {
  id: string;
  paymentIntent: string | null;
  customer: string;
  /** Tentativo non riuscito; senza, l'addebito è riuscito. */
  failed?: true;
  amount: number;
  created: number;
  refunds: Array<{ amount: number; status: "succeeded" | "pending" | "failed" }>;
  dispute?: "needs_response" | "under_review" | "won" | "lost";
};

/**
 * Stripe simulato per la riconciliazione: abbonamento, fatture pagate e sessioni completate
 * modificabili dal test, con le richieste ricevute. `down` risponde 503, `missing` 404.
 */
function stripeAccount() {
  const state = {
    subscription: { status: "active", start: periodStart, end: periodEnd } as FakeSubscription,
    invoices: [] as Array<{
      id: string;
      start: string;
      end: string;
      amount: number;
      paidAt: string;
      /** Fattura senza abbonamento: senza origine, oppure da un preventivo. */
      orphan?: "none" | "quote";
      /** Pagamento della fattura; senza, `pi_<fattura>`. */
      paymentIntent?: string;
    }>,
    /** Sessioni Checkout: quelle create dal test di acquisto si aggiungono qui. */
    sessions: [] as Array<
      { id: string; mode: string; subscription: string | null } & Record<string, unknown>
    >,
    /** Coupon creati per il credito del lifetime. */
    coupons: [] as Array<Record<string, string>>,
    /**
     * Addebiti riusciti, per payment intent: le fatture pagano `pi_<fattura>`, il lifetime
     * `pi_<sessione>`. Rimborsi con il loro stato e una disputa facoltativa.
     */
    charges: [] as FakeCharge[],
    /** Clienti cancellati su Stripe e clienti che Stripe non restituisce più. */
    deletedCustomers: [] as string[],
    missingCustomers: [] as string[],
    /** L'elenco degli addebiti del cliente risponde 404 oppure 503. */
    chargesMissing: false,
    chargesDown: false,
    /** Inizio della finestra chiesta nell'ultimo elenco delle sessioni, in secondi. */
    sessionsSince: 0,
    /** Percorsi che rispondono 503, per un singolo passo non riuscito. */
    failing: [] as string[],
    down: false,
    missing: false,
  };
  const subscription = () => ({
    id: "sub_test",
    object: "subscription",
    // Espanso: l'identificativo si legge anche dall'oggetto.
    customer: { id: "cus_test", object: "customer" },
    livemode: state.subscription.livemode ?? false,
    status: state.subscription.status,
    cancel_at_period_end: state.subscription.cancel ?? false,
    cancel_at: state.subscription.cancelAt ? second(state.subscription.cancelAt) : null,
    schedule: state.subscription.schedule ?? null,
    metadata: state.subscription.metadata ?? {
      workspace_id: "w-a",
      offer: "monthly",
      price_generation: "2026-09",
    },
    items: {
      object: "list",
      data: (state.subscription.noItems ? [] : [null]).map(() => ({
        id: "si_test",
        current_period_start: second(state.subscription.start),
        current_period_end: second(state.subscription.end),
        price: {
          id: state.subscription.price?.id ?? "price_monthly",
          object: "price",
          product: "prod_test",
          recurring: {
            interval:
              state.subscription.price?.interval ??
              ((state.subscription.metadata?.offer ?? "monthly") === "annual" ? "year" : "month"),
          },
        },
      })),
    },
  });
  const invoice = (paid: (typeof state.invoices)[number]) => ({
    id: paid.id,
    object: "invoice",
    status: "paid",
    payments: {
      object: "list",
      data: [
        {
          status: "paid",
          payment: {
            type: "payment_intent",
            payment_intent: paid.paymentIntent ?? `pi_${paid.id}`,
          },
        },
      ],
    },
    amount_paid: paid.amount,
    currency: "eur",
    status_transitions: { paid_at: second(paid.paidAt) },
    parent:
      paid.orphan === "none"
        ? null
        : paid.orphan === "quote"
          ? { type: "quote_details", subscription_details: null }
          : { type: "subscription_details", subscription_details: { subscription: "sub_test" } },
    lines: {
      object: "list",
      data: [
        {
          period: { start: second(paid.start), end: second(paid.end) },
          parent: { type: "subscription_item_details" },
        },
      ],
    },
  });
  const charge = (paid: FakeCharge) => ({
    id: paid.id,
    object: "charge",
    amount: paid.amount,
    // Come su Stripe, l'importo rimborsato conta anche i rimborsi ancora in corso.
    amount_refunded: paid.refunds
      .filter((refund) => refund.status !== "failed")
      .reduce((sum, refund) => sum + refund.amount, 0),
    disputed: !!paid.dispute,
    payment_intent: paid.paymentIntent,
    customer: paid.customer,
    status: paid.failed ? "failed" : "succeeded",
    created: paid.created,
  });
  const refund = (paid: FakeCharge, index: number) => ({
    id: `re_${paid.id}_${index}`,
    object: "refund",
    charge: paid.id,
    payment_intent: paid.paymentIntent,
    ...paid.refunds[index],
  });
  const dispute = (paid: FakeCharge) => ({
    id: `du_${paid.id}`,
    object: "dispute",
    charge: paid.id,
    // Espanso: l'identificativo si legge anche dall'oggetto.
    payment_intent: { id: paid.paymentIntent, object: "payment_intent" },
    status: paid.dispute,
  });
  const requests: string[] = [];
  /** Corpi delle richieste di modifica, già letti come form. */
  const writes: Array<{ path: string; body: URLSearchParams }> = [];
  /** Prezzi ricorrenti del prodotto, come li elenca Stripe. */
  const prices: Stripe.Price[] = [];
  const fetcher = vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(String(input));
    requests.push(`${init?.method} ${url.pathname}`);
    if (init?.method === "POST")
      writes.push({ path: url.pathname, body: new URLSearchParams(String(init.body ?? "")) });
    if (state.down || state.failing.includes(url.pathname))
      return Response.json({ error: { type: "api_error" } }, { status: 503 });
    if (state.missing)
      return Response.json(
        { error: { type: "invalid_request_error", code: "resource_missing" } },
        { status: 404 },
      );
    const list = (data: unknown[]) => Response.json({ object: "list", data, has_more: false });
    if (url.pathname === "/v1/subscriptions/sub_test" && init?.method === "DELETE") {
      state.subscription.status = "canceled";
      return Response.json(subscription());
    }
    if (url.pathname === "/v1/subscriptions/sub_test" && init?.method === "POST") {
      // Cambio di periodicità o rinvio del rinnovo: prezzo, fine del periodo e metadati.
      const body = writes.at(-1)!.body;
      const price = prices.find((candidate) => candidate.id === body.get("items[0][price]"));
      if (price)
        state.subscription.price = {
          id: price.id,
          interval: price.recurring!.interval as "month" | "year",
        };
      const trialEnd = body.get("trial_end");
      if (trialEnd) {
        state.subscription.end = new Date(Number(trialEnd) * 1000).toISOString();
        state.subscription.status = "trialing";
      }
      // Chiusura programmata alla fine della tutela del prezzo, o tolta con un valore vuoto.
      if (body.has("cancel_at"))
        state.subscription.cancelAt = body.get("cancel_at")
          ? new Date(Number(body.get("cancel_at")) * 1000).toISOString()
          : undefined;
      if (body.get("metadata[offer]"))
        state.subscription.metadata = {
          ...(state.subscription.metadata ?? {
            workspace_id: "w-a",
            offer: "monthly",
            price_generation: "2026-09",
          }),
          offer: body.get("metadata[offer]")!,
        };
      return Response.json(subscription());
    }
    if (url.pathname === "/v1/subscriptions/sub_test") return Response.json(subscription());
    if (url.pathname === "/v1/prices") {
      expect(url.searchParams.get("product")).toBe("prod_test");
      expect(url.searchParams.get("type")).toBe("recurring");
      // Il prodotto, con il codice fiscale, compare soltanto se espanso.
      const expanded = [...url.searchParams].some(
        ([key, value]) => key.startsWith("expand") && value === "data.product",
      );
      return list(
        prices.map((price) =>
          expanded ? price : { ...price, product: (price.product as { id: string }).id },
        ),
      );
    }
    if (url.pathname === "/v1/billing_portal/sessions")
      return Response.json({
        object: "billing_portal.session",
        url: "https://billing.example.invalid/p/session_test",
      });
    if (url.pathname === "/v1/invoices") {
      expect(url.searchParams.get("subscription")).toBe("sub_test");
      expect(url.searchParams.get("status")).toBe("paid");
      // I pagamenti della fattura compaiono soltanto se espansi.
      const expanded = [...url.searchParams].some(
        ([key, value]) => key.startsWith("expand") && value === "data.payments",
      );
      return list(
        state.invoices
          .filter((paid) => !paid.orphan)
          .map((paid) => ({ ...invoice(paid), ...(expanded ? {} : { payments: undefined }) })),
      );
    }
    if (url.pathname.startsWith("/v1/invoices/"))
      return Response.json(invoice(state.invoices.find((paid) => url.pathname.endsWith(paid.id))!));
    if (url.pathname === "/v1/invoice_payments") {
      expect(url.searchParams.get("payment[type]")).toBe("payment_intent");
      const intent = url.searchParams.get("payment[payment_intent]");
      const paid = state.invoices.find(
        (candidate) => (candidate.paymentIntent ?? `pi_${candidate.id}`) === intent,
      );
      return list(paid ? [{ object: "invoice_payment", invoice: paid.id, status: "paid" }] : []);
    }
    const missing = () =>
      Response.json(
        { error: { type: "invalid_request_error", code: "resource_missing" } },
        { status: 404 },
      );
    if (url.pathname === "/v1/charges" && state.chargesMissing) return missing();
    if (url.pathname === "/v1/charges" && state.chargesDown)
      return Response.json({ error: { type: "api_error" } }, { status: 503 });
    if (url.pathname === "/v1/charges")
      return list(
        state.charges
          .filter((paid) => paid.customer === url.searchParams.get("customer"))
          .map(charge),
      );
    const byCharge = (id: string | null) => state.charges.find((paid) => paid.id === id)!;
    if (url.pathname.startsWith("/v1/charges/"))
      return Response.json(charge(byCharge(url.pathname.split("/").at(-1)!)));
    if (url.pathname === "/v1/refunds") {
      const paid = byCharge(url.searchParams.get("charge"));
      return list(paid.refunds.map((_, index) => refund(paid, index)));
    }
    if (url.pathname.startsWith("/v1/refunds/")) {
      const [, id, index] = /^re_(.+)_(\d+)$/u.exec(url.pathname.split("/").at(-1)!)!;
      return Response.json(refund(byCharge(id!), Number(index)));
    }
    if (url.pathname === "/v1/disputes") {
      const paid = byCharge(url.searchParams.get("charge"));
      return list(paid.dispute ? [dispute(paid)] : []);
    }
    if (url.pathname.startsWith("/v1/disputes/"))
      return Response.json(dispute(byCharge(url.pathname.split("/").at(-1)!.slice(3))));
    if (url.pathname.startsWith("/v1/customers/")) {
      const id = url.pathname.split("/").at(-1)!;
      if (state.missingCustomers.includes(id)) return missing();
      return Response.json(
        state.deletedCustomers.includes(id)
          ? { id, object: "customer", deleted: true }
          : { id, object: "customer" },
      );
    }
    if (url.pathname === "/v1/prices/price_test_monthly") return Response.json(catalogPrice());
    if (url.pathname === "/v1/prices/price_test_lifetime")
      return Response.json(
        catalogPrice(
          {
            id: "price_test_lifetime",
            unit_amount: 14900,
            type: "one_time",
            recurring: null,
          },
          { id: "prod_lifetime" },
        ),
      );
    if (url.pathname === "/v1/coupons") {
      const body = writes.at(-1)!.body;
      const coupon = { id: `coupon_${state.coupons.length + 1}`, ...Object.fromEntries(body) };
      state.coupons.push(coupon);
      return Response.json({ object: "coupon", ...coupon });
    }
    if (url.pathname === "/v1/checkout/sessions" && init?.method === "POST") {
      const body = writes.at(-1)!.body;
      const id = `cs_lifetime_${state.sessions.length + 1}`;
      state.sessions.push({
        id,
        mode: body.get("mode")!,
        subscription: null,
        status: "open",
        payment_status: "unpaid",
        livemode: false,
        created: second(now),
        url: `https://checkout.example.invalid/c/pay/${id}`,
        managed_payments: { enabled: true },
        metadata: {
          workspace_id: body.get("metadata[workspace_id]")!,
          offer: body.get("metadata[offer]")!,
          price_generation: body.get("metadata[price_generation]")!,
        },
        customer: body.get("customer"),
        payment_intent: null,
      });
      return Response.json({ object: "checkout.session", ...state.sessions.at(-1) });
    }
    if (url.pathname.endsWith("/expire")) {
      const session = state.sessions.find((candidate) => url.pathname.includes(candidate.id))!;
      if (session.status !== "open")
        return Response.json({ error: { type: "invalid_request_error" } }, { status: 400 });
      session.status = "expired";
      return Response.json({ object: "checkout.session", ...session });
    }
    const intentOf = (session: (typeof state.sessions)[number]) =>
      (session.payment_intent as { id: string } | null)?.id;
    if (url.pathname === "/v1/checkout/sessions" && url.searchParams.has("payment_intent"))
      return list(
        state.sessions
          .filter((session) => intentOf(session) === url.searchParams.get("payment_intent"))
          .map((session) => ({ object: "checkout.session", ...session })),
      );
    if (url.pathname === "/v1/checkout/sessions") {
      expect(url.searchParams.get("status")).toBe("complete");
      state.sessionsSince = Number(url.searchParams.get("created[gte]"));
      return list(state.sessions.map((session) => ({ object: "checkout.session", ...session })));
    }
    if (url.pathname.startsWith("/v1/checkout/sessions/")) {
      const session = state.sessions.find((candidate) => url.pathname.endsWith(candidate.id))!;
      const intent = session.payment_intent as { latest_charge: { id: string } | null } | null;
      // L'addebito espanso riflette rimborsi e dispute registrati dopo il pagamento.
      const latest = intent?.latest_charge && byCharge(intent.latest_charge.id);
      return Response.json({
        object: "checkout.session",
        ...session,
        ...(latest ? { payment_intent: { ...intent, latest_charge: charge(latest) } } : {}),
      });
    }
    throw new Error("unexpected_stripe_request");
  });
  /** Esito del pagamento di una sessione lifetime, come lo rilegge Stripe. */
  const settle = (
    id: string,
    outcome: "paid" | "processing" | "failed" | "expired",
    paidAt = now,
  ) => {
    const session = state.sessions.find((candidate) => candidate.id === id)!;
    session.status = outcome === "expired" ? "expired" : "complete";
    session.payment_status = outcome === "paid" ? "paid" : "unpaid";
    session.customer ??= "cus_lifetime";
    session.payment_intent = {
      id: `pi_${id}`,
      object: "payment_intent",
      status:
        outcome === "paid" ? "succeeded" : outcome === "processing" ? "processing" : "canceled",
      amount_received: outcome === "paid" ? 18178 : 0,
      currency: "eur",
      latest_charge: outcome === "paid" ? { id: `ch_${id}`, created: second(paidAt) } : null,
    };
    if (outcome === "paid")
      state.charges.push({
        id: `ch_${id}`,
        paymentIntent: `pi_${id}`,
        customer: session.customer as string,
        amount: 18178,
        created: second(paidAt),
        refunds: [],
      });
  };
  return { state, fetcher, requests, writes, prices, settle };
}

const firstInvoice = {
  id: "in_first",
  start: periodStart,
  end: periodEnd,
  amount: 598,
  paidAt: periodStart,
};

describe("Webhook e riconciliazione Stripe", () => {
  let userId: string;
  let cookie: string;
  const at = (iso: string) => new Date(iso);
  /** Account della pagina del piano reale all'istante indicato. */
  const planAccount = async (time: string) => {
    vi.setSystemTime(at(time));
    // La sessione di prova resta valida anche a un mese di distanza.
    await env.DB.prepare('UPDATE "session" SET "expiresAt" = ? WHERE "userId" = ?')
      .bind(new Date(at(time).getTime() + 86_400_000).toISOString(), userId)
      .run();
    const result = (await settingsLoader({
      request: new Request("http://localhost:5173/app/impostazioni/piano", { headers: { cookie } }),
      params: { sezione: "piano" },
    } as unknown as Parameters<typeof settingsLoader>[0])) as {
      page: { account: Record<string, unknown>; services: Record<string, unknown> };
    };
    return result.page;
  };
  const coverages = async () =>
    (
      await env.DB.prepare(
        `SELECT source, starts_at, ends_at, revoked_at, stripe_invoice_id, amount_paid, currency, paid_at
          FROM workspace_entitlements ORDER BY starts_at`,
      ).all()
    ).results;
  const premium = async (time: string) => (await orderAllowance(env.DB, userId, at(time)))!.premium;
  const view = async (time: string) => {
    const allowance = (await orderAllowance(env.DB, userId, at(time)))!;
    return subscriptionView(env.DB, env, "w-a", allowance.coverage, at(time));
  };

  /** Righe di errore registrate, già lette come JSON. */
  const logged = (errors: { mock: { calls: unknown[][] } }) =>
    errors.mock.calls.map(([line]) => JSON.parse(String(line)) as Record<string, unknown>);

  beforeEach(async () => {
    await resetDatabase();
    await env.DB.batch([
      env.DB.prepare("DELETE FROM stripe_subscriptions"),
      env.DB.prepare("DELETE FROM workspace_entitlements"),
    ]);
    ({ userId, cookie } = await verifiedSession(
      `riconciliazione-${crypto.randomUUID()}@example.invalid`,
    ));
    await workspace(userId);
  });

  it("attribuisce una sola copertura per fattura pagata con eventi duplicati o fuori ordine", async () => {
    const stripe = stripeAccount();
    stripe.state.sessions = [{ id: "cs_test", mode: "subscription", subscription: "sub_test" }];
    stripe.state.invoices = [firstInvoice];
    const events = [
      { topic: "checkout.session.completed", objectId: "cs_test" },
      { topic: "checkout.session.completed", objectId: "cs_test" },
      { topic: "invoice.paid", objectId: "in_first" },
      { topic: "customer.subscription.created", objectId: "sub_test" },
      // Evento senza effetti commerciali: nessuna rilettura.
      { topic: "customer.updated", objectId: "cus_test" },
    ];
    for (const event of events) await applyStripeEvent(env, event, stripe.fetcher, at(now));
    expect(await coverages()).toEqual([
      {
        source: "premium",
        starts_at: periodStart,
        ends_at: periodEnd,
        revoked_at: null,
        stripe_invoice_id: "in_first",
        amount_paid: 598,
        currency: "eur",
        paid_at: periodStart,
      },
    ]);
    expect(stripe.requests.filter((request) => request.includes("cus_test"))).toEqual([]);
    expect(await premium(now)).toBe(true);
    expect((await purchaseState(env.DB, userId, at(now)))?.state).toBe("covered");
    expect(await view(now)).toEqual({ premium: { period: "monthly", renewsAt: periodEnd } });
    // Un abbonamento che si rinnova non riceve scritture da FiscalBay.
    expect(stripe.writes).toEqual([]);
    // Il piano reale mostra periodicità e rinnovo; con la chiave Stripe il portale è disponibile.
    const page = await planAccount(now);
    expect(page.account).toMatchObject({
      plan: "premium",
      premium: { period: "monthly", renewsAt: periodEnd },
    });
    expect(page.account).not.toHaveProperty("payment");
    expect(page.services).toMatchObject({ billingPortal: true });

    // Una rilettura conclusa dopo una più recente non ne sovrascrive lo stato.
    stripe.state.subscription.cancel = true;
    await applyStripeEvent(
      env,
      { topic: "customer.subscription.updated", objectId: "sub_test" },
      stripe.fetcher,
      at("2026-09-14T10:00:00.000Z"),
    );
    stripe.state.subscription.cancel = false;
    await applyStripeEvent(
      env,
      { topic: "customer.subscription.updated", objectId: "sub_test" },
      stripe.fetcher,
      at("2026-09-14T09:00:00.000Z"),
    );
    expect(await view("2026-09-14T11:00:00.000Z")).toEqual({
      premium: { period: "monthly", renewsAt: null, endsAt: periodEnd },
    });
    expect(await coverages()).toHaveLength(1);
  });

  it("ogni evento rilegge l'abbonamento, salvo pagamenti una tantum e fatture senza abbonamento", async () => {
    const stripe = stripeAccount();
    stripe.state.subscription.metadata = {
      workspace_id: "w-a",
      offer: "annual",
      price_generation: "2026-09",
    };
    stripe.state.sessions = [
      { id: "cs_test", mode: "subscription", subscription: "sub_test" },
      { id: "cs_once", mode: "payment", subscription: null },
      { id: "cs_open", mode: "subscription", subscription: null },
    ];
    stripe.state.invoices = [
      firstInvoice,
      { ...firstInvoice, id: "in_orphan", orphan: "none" },
      { ...firstInvoice, id: "in_quote", orphan: "quote" },
    ];
    for (const [topic, objectId] of [
      ["checkout.session.completed", "cs_test"],
      ["invoice.paid", "in_first"],
      ["customer.subscription.updated", "sub_test"],
    ]) {
      await env.DB.batch([
        env.DB.prepare("DELETE FROM workspace_entitlements"),
        env.DB.prepare("DELETE FROM stripe_subscriptions"),
      ]);
      await applyStripeEvent(env, { topic: topic!, objectId: objectId! }, stripe.fetcher, at(now));
      expect(await coverages()).toHaveLength(1);
      expect(
        await env.DB.prepare(
          "SELECT workspace_id, environment, customer_id, offer, price_generation FROM stripe_subscriptions",
        ).first(),
      ).toEqual({
        workspace_id: "w-a",
        environment: "test",
        customer_id: "cus_test",
        offer: "annual",
        price_generation: "2026-09",
      });
    }
    expect(await view(now)).toEqual({ premium: { period: "annual", renewsAt: periodEnd } });
    await env.DB.batch([
      env.DB.prepare("DELETE FROM workspace_entitlements"),
      env.DB.prepare("DELETE FROM stripe_subscriptions"),
    ]);
    stripe.requests.length = 0;
    for (const [topic, objectId] of [
      ["checkout.session.completed", "cs_once"],
      ["checkout.session.completed", "cs_open"],
      ["invoice.paid", "in_orphan"],
      ["invoice.paid", "in_quote"],
    ])
      await applyStripeEvent(env, { topic: topic!, objectId: objectId! }, stripe.fetcher, at(now));
    expect(stripe.requests).toEqual([
      "GET /v1/checkout/sessions/cs_once",
      "GET /v1/checkout/sessions/cs_open",
      "GET /v1/invoices/in_orphan",
      "GET /v1/invoices/in_quote",
    ]);
    expect(await coverages()).toEqual([]);
  });

  it("senza chiave Stripe la ricevuta resta da elaborare e il cron non chiama Stripe", async () => {
    const stripe = stripeAccount();
    const missing = { ...env, STRIPE_SECRET_KEY: undefined } as Env;
    await expect(
      applyStripeEvent(missing, { topic: "invoice.paid", objectId: "in_first" }, stripe.fetcher),
    ).rejects.toMatchObject({ code: "UPSTREAM_UNAVAILABLE" });
    await reconcileBilling(missing, stripe.fetcher, at(now));
    expect(stripe.fetcher).not.toHaveBeenCalled();
  });

  it("usa soltanto la chiave dell'ambiente, standard o con limitazioni", async () => {
    const production = { ...env, APP_ORIGIN: "https://fiscalbay.it" } as Env;
    expect(stripeSecretKey(env)).toBe("rk_test_fiscalbay");
    expect(stripeSecretKey({ ...env, STRIPE_SECRET_KEY: "sk_test_fiscalbay" })).toBe(
      "sk_test_fiscalbay",
    );
    expect(stripeSecretKey({ ...production, STRIPE_SECRET_KEY: liveKey })).toBe(liveKey);
    expect(stripeSecretKey({ ...production, STRIPE_SECRET_KEY: "rk_live_fiscalbay" })).toBe(
      "rk_live_fiscalbay",
    );
    for (const [target, key] of [
      [env, liveKey],
      [env, "rk_live_fiscalbay"],
      [env, "rk_test_"],
      [env, "pk_test_fiscalbay"],
      [env, ""],
      [production, "pk_live_fiscalbay"],
      [production, "rk_test_fiscalbay"],
      [production, "sk_test_fiscalbay"],
      [production, `x${liveKey}`],
      [production, "rk_live_"],
      [production, undefined],
    ] as const)
      expect(stripeSecretKey({ ...target, STRIPE_SECRET_KEY: key })).toBeUndefined();
    // Una chiave rifiutata ferma acquisti, portale, ricevute e cron senza chiamare Stripe.
    const stripe = stripeAccount();
    for (const target of [
      { ...env, STRIPE_SECRET_KEY: liveKey },
      { ...production, STRIPE_SECRET_KEY: "sk_test_fiscalbay" },
    ] as Env[]) {
      expect(checkoutConfigured(target)).toBe(false);
      await expect(
        applyStripeEvent(target, { topic: "invoice.paid", objectId: "in_first" }, stripe.fetcher),
      ).rejects.toMatchObject({ code: "UPSTREAM_UNAVAILABLE" });
      await reconcileBilling(target, stripe.fetcher, at(now));
      expect(await openBillingPortal(target, "u-a", "https://fiscalbay.it/", "it")).toBeNull();
    }
    expect(stripe.fetcher).not.toHaveBeenCalled();
  });

  it("in Production registra gli abbonamenti live", async () => {
    const stripe = stripeAccount();
    stripe.state.subscription.livemode = true;
    stripe.state.invoices = [firstInvoice];
    const live = { ...env, APP_ORIGIN: "https://fiscalbay.it", STRIPE_SECRET_KEY: liveKey } as Env;
    await applyStripeEvent(
      live,
      { topic: "customer.subscription.created", objectId: "sub_test" },
      stripe.fetcher,
      at(now),
    );
    expect(await env.DB.prepare("SELECT environment FROM stripe_subscriptions").first()).toEqual({
      environment: "live",
    });
    expect(await premium(now)).toBe(true);
  });

  it("un redirect falso, un abbonamento estraneo o dell'altro ambiente non attivano Premium", async () => {
    const stripe = stripeAccount();
    const { cookie } = await verifiedSession("redirect-falso@example.invalid");
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const result = (await settingsLoader({
        request: new Request(
          "http://localhost:5173/app/impostazioni/piano?checkout=processing&session_id=cs_test",
          { headers: { cookie } },
        ),
        params: { sezione: "piano" },
      } as unknown as Parameters<typeof settingsLoader>[0])) as { page: { account: unknown } };
      expect(result.page.account).toMatchObject({ plan: "free" });
      expect(stripe.fetcher).not.toHaveBeenCalled();

      stripe.state.invoices = [firstInvoice];
      for (const subscription of [
        { metadata: { workspace_id: "w-a" } },
        { metadata: {} },
        { livemode: true },
      ]) {
        Object.assign(stripe.state.subscription, subscription);
        await applyStripeEvent(
          env,
          { topic: "customer.subscription.created", objectId: "sub_test" },
          stripe.fetcher,
          at(now),
        );
        stripe.state.subscription = { status: "active", start: periodStart, end: periodEnd };
      }
      // Lo spazio indicato non esiste: nessun abbonamento né copertura.
      stripe.state.subscription.metadata = {
        workspace_id: "w-altro",
        offer: "monthly",
        price_generation: "2026-09",
      };
      await applyStripeEvent(
        env,
        { topic: "customer.subscription.created", objectId: "sub_test" },
        stripe.fetcher,
        at(now),
      );
      expect(await coverages()).toEqual([]);
      expect(
        (await env.DB.prepare("SELECT COUNT(*) AS n FROM stripe_subscriptions").first())!.n,
      ).toBe(0);
      expect(await premium(now)).toBe(false);
      // I tre abbonamenti senza i nostri riferimenti si segnalano con un'etichetta fissa.
      expect(logged(errors)).toEqual(
        Array.from({ length: 3 }, () => ({
          event: "application_error",
          code: "INVALID_REQUEST",
          operation: "billing",
          failure: "unknown_subscription",
        })),
      );
    } finally {
      errors.mockRestore();
    }
  });

  it("senza copertura pagata il pagamento resta in attesa e una fattura a zero non attiva", async () => {
    const stripe = stripeAccount();
    stripe.state.subscription.status = "incomplete";
    stripe.state.invoices = [{ ...firstInvoice, amount: 0 }];
    await applyStripeEvent(
      env,
      { topic: "customer.subscription.created", objectId: "sub_test" },
      stripe.fetcher,
      at(now),
    );
    expect(await coverages()).toEqual([]);
    expect(await view(now)).toEqual({ payment: { state: "pending" } });
    // L'abbonamento può ancora incassare: un secondo acquisto o la prova lo sovrapporrebbero.
    expect((await purchaseState(env.DB, userId, at(now)))?.state).toBe("covered");
    expect((await orderAllowance(env.DB, userId, at(now)))?.trialAvailable).toBe(false);
    expect(await startTrial(env.DB, userId, at(now))).toBeNull();
    // Il cron rilegge un pagamento senza copertura dopo un'ora, non prima.
    stripe.requests.length = 0;
    await reconcileBilling(env, stripe.fetcher, at("2026-09-13T20:50:00.000Z"));
    expect(stripe.requests).toEqual(["GET /v1/checkout/sessions"]);
    await reconcileBilling(env, stripe.fetcher, at("2026-09-13T21:00:00.000Z"));
    expect(stripe.requests).toContain("GET /v1/subscriptions/sub_test");
    // Un abbonamento in pausa non incassa: nessuna attivazione in corso.
    await env.DB.prepare("UPDATE stripe_subscriptions SET status = 'paused'").run();
    expect(await view(now)).toEqual({});
    // Durante la prova l'acquisto da confermare resta visibile; una concessione prevale.
    await env.DB.prepare("UPDATE stripe_subscriptions SET status = 'incomplete'").run();
    for (const [source, expected] of [
      ["trial", { payment: { state: "pending" } }],
      ["admin", { grant: { endsAt: periodEnd } }],
    ] as const) {
      await env.DB.prepare(
        `INSERT INTO workspace_entitlements (id, workspace_id, source, starts_at, ends_at)
         VALUES (?1, 'w-a', ?1, ?2, ?3)`,
      )
        .bind(source, now, periodEnd)
        .run();
      expect(await view(now)).toEqual(expected);
      await env.DB.prepare("DELETE FROM workspace_entitlements").run();
    }
    stripe.state.subscription.status = "active";
    stripe.state.invoices = [firstInvoice];
    await applyStripeEvent(
      env,
      { topic: "invoice.paid", objectId: "in_first" },
      stripe.fetcher,
      at(now),
    );
    expect(await premium(now)).toBe(true);
  });

  it("l'abbonamento scelto durante la prova si paga e copre dalla sua fine", async () => {
    // Prova fino al 20 settembre: Stripe registra `trialing` fino alla stessa data, senza incasso.
    const trialEnd = "2026-09-20T20:00:00.000Z";
    const renewsAt = "2026-10-20T20:00:00.000Z";
    await env.DB.prepare(
      `INSERT INTO workspace_entitlements (id, workspace_id, source, starts_at, ends_at)
       VALUES ('trial', 'w-a', 'trial', ?, ?)`,
    )
      .bind("2026-09-06T20:00:00.000Z", trialEnd)
      .run();
    const stripe = stripeAccount();
    stripe.state.subscription = { status: "trialing", start: now, end: trialEnd };
    await applyStripeEvent(
      env,
      { topic: "customer.subscription.created", objectId: "sub_test" },
      stripe.fetcher,
      at(now),
    );
    // Nessuna copertura pagata: la prova resta, con il primo addebito alla sua fine.
    expect((await coverages()).map((row) => row.source)).toEqual(["trial"]);
    expect(await view(now)).toEqual({
      payment: { state: "scheduled", period: "monthly", chargeAt: trialEnd },
    });
    expect((await purchaseState(env.DB, userId, at(now)))?.state).toBe("covered");
    // Prima del primo addebito l'abbonamento si disdice dal portale e scollegare l'ultimo
    // negozio non lo ferma; il cambio di periodicità aspetta un periodo pagato.
    expect(await subscriptionRenews(env.DB, env, userId)).toBe(true);
    expect(await changeSubscriptionPeriod(env, userId, "annual", at(now))).toBe("not_allowed");
    // Disdetto dal portale prima del primo addebito: nessun incasso annunciato e nessun
    // avviso allo scollegamento; riattivato, torna com'era.
    stripe.state.subscription = { status: "trialing", start: now, end: trialEnd, cancel: true };
    await applyStripeEvent(
      env,
      { topic: "customer.subscription.updated", objectId: "sub_test" },
      stripe.fetcher,
      at("2026-09-13T20:01:00.000Z"),
    );
    expect(await view(now)).toEqual({
      payment: { state: "scheduled", period: "monthly", chargeAt: trialEnd, cancelled: true },
    });
    expect(await subscriptionRenews(env.DB, env, userId)).toBe(false);
    stripe.state.subscription = { status: "trialing", start: now, end: trialEnd };
    await applyStripeEvent(
      env,
      { topic: "customer.subscription.updated", objectId: "sub_test" },
      stripe.fetcher,
      at("2026-09-13T20:02:00.000Z"),
    );
    expect(await view(now)).toEqual({
      payment: { state: "scheduled", period: "monthly", chargeAt: trialEnd },
    });
    expect(await subscriptionRenews(env.DB, env, userId)).toBe(true);
    // Alla fine della prova Stripe incassa il primo periodo, che copre fino al rinnovo.
    stripe.state.subscription = { status: "active", start: trialEnd, end: renewsAt };
    stripe.state.invoices = [
      { id: "in_first", start: trialEnd, end: renewsAt, amount: 598, paidAt: trialEnd },
    ];
    await applyStripeEvent(
      env,
      { topic: "invoice.paid", objectId: "in_first" },
      stripe.fetcher,
      at(trialEnd),
    );
    expect((await coverages()).map((row) => [row.source, row.starts_at, row.ends_at])).toEqual([
      ["trial", "2026-09-06T20:00:00.000Z", trialEnd],
      ["premium", trialEnd, renewsAt],
    ]);
    expect(await premium("2026-10-01T00:00:00.000Z")).toBe(true);
    expect(await view("2026-10-01T00:00:00.000Z")).toEqual({
      premium: { period: "monthly", renewsAt },
    });
  });

  it("al rinnovo fallito torna subito al Free e protegge il prezzo per sette giorni", async () => {
    const stripe = stripeAccount();
    stripe.state.invoices = [firstInvoice];
    await applyStripeEvent(
      env,
      { topic: "customer.subscription.created", objectId: "sub_test" },
      stripe.fetcher,
      at(now),
    );
    // Stripe apre il nuovo periodo e il pagamento fallisce: nessuna settimana gratuita.
    stripe.state.subscription = { status: "past_due", start: periodEnd, end: nextEnd };
    const failedAt = "2026-10-13T21:00:00.000Z";
    await applyStripeEvent(
      env,
      { topic: "invoice.payment_failed", objectId: "in_first" },
      stripe.fetcher,
      at(failedAt),
    );
    expect(await premium(periodEnd)).toBe(false);
    expect(await view(failedAt)).toEqual({
      payment: { state: "renewal-failed", protectedUntil: "2026-10-20T20:00:00.000Z" },
    });
    expect((await purchaseState(env.DB, userId, at(failedAt)))?.state).toBe("covered");
    const page = await planAccount(failedAt);
    expect(page.account).toMatchObject({
      plan: "free",
      payment: { state: "renewal-failed", protectedUntil: "2026-10-20T20:00:00.000Z" },
    });
    expect(page.account).not.toHaveProperty("premium");
    // Stripe chiude l'abbonamento all'istante esatto in cui finisce la tutela, senza conguaglio:
    // nessun tentativo può incassare dopo.
    const schedule = stripe.writes.filter((write) => write.path === "/v1/subscriptions/sub_test");
    expect(schedule.map((write) => Object.fromEntries(write.body))).toEqual([
      {
        cancel_at: String(Date.parse("2026-10-20T20:00:00.000Z") / 1000),
        proration_behavior: "none",
      },
    ]);
    // Riletto di nuovo, non la riprogramma; una disdetta del cliente che arriva prima resta.
    await applyStripeEvent(
      env,
      { topic: "customer.subscription.updated", objectId: "sub_test" },
      stripe.fetcher,
      at(failedAt),
    );
    stripe.state.subscription.cancelAt = "2026-10-15T00:00:00.000Z";
    await applyStripeEvent(
      env,
      { topic: "customer.subscription.updated", objectId: "sub_test" },
      stripe.fetcher,
      at(failedAt),
    );
    expect(
      stripe.writes.filter((write) => write.path === "/v1/subscriptions/sub_test"),
    ).toHaveLength(1);
    stripe.state.subscription.cancelAt = "2026-10-20T20:00:00.000Z";

    // Regolarizzato entro sette giorni: copertura contigua al periodo precedente.
    stripe.state.subscription.status = "active";
    stripe.state.invoices = [
      {
        id: "in_renewal",
        start: periodEnd,
        end: nextEnd,
        amount: 598,
        paidAt: "2026-10-16T08:00:00.000Z",
      },
      firstInvoice,
    ];
    await applyStripeEvent(
      env,
      { topic: "invoice.paid", objectId: "in_renewal" },
      stripe.fetcher,
      at("2026-10-16T08:00:00.000Z"),
    );
    expect((await coverages()).map((row) => [row.starts_at, row.ends_at])).toEqual([
      [periodStart, periodEnd],
      [periodEnd, nextEnd],
    ]);
    expect(await premium("2026-10-16T08:00:00.000Z")).toBe(true);
    expect(stripe.requests).not.toContain("DELETE /v1/subscriptions/sub_test");
    // Il pagamento toglie la chiusura programmata: l'abbonamento si rinnova come prima.
    expect(Object.fromEntries(stripe.writes.at(-1)!.body)).toEqual({ cancel_at: "" });
    expect(stripe.state.subscription.cancelAt).toBeUndefined();
    expect(await view("2026-10-16T08:00:00.000Z")).toMatchObject({
      premium: { renewsAt: nextEnd },
    });
  });

  it("finita la tutela del prezzo chiude il rinnovo non pagato su Stripe", async () => {
    const stripe = stripeAccount();
    stripe.state.invoices = [firstInvoice];
    stripe.state.subscription = { status: "past_due", start: periodEnd, end: nextEnd };
    await applyStripeEvent(
      env,
      { topic: "customer.subscription.updated", objectId: "sub_test" },
      stripe.fetcher,
      at("2026-10-20T19:59:00.000Z"),
    );
    expect(stripe.requests).not.toContain("DELETE /v1/subscriptions/sub_test");
    // Allo scadere esatto la tutela è finita, anche per il piano mostrato.
    expect(await view("2026-10-20T20:00:00.000Z")).toEqual({});
    // Il cron rilegge l'abbonamento alla fine della tutela, anche senza webhook, e lo chiude
    // senza programmare una chiusura ormai passata, anche se quella di prima è sparita.
    stripe.state.subscription.cancelAt = undefined;
    const scheduled = stripe.writes.length;
    await reconcileBilling(env, stripe.fetcher, at("2026-10-20T20:00:00.000Z"));
    expect(stripe.writes.slice(scheduled).map((write) => write.path)).toEqual([]);
    expect(stripe.requests).toContain("DELETE /v1/subscriptions/sub_test");
    expect(await view("2026-10-20T20:10:00.000Z")).toEqual({});
    expect((await purchaseState(env.DB, userId, at("2026-10-20T20:10:00.000Z")))?.state).toBe(
      "available",
    );
    // Le coperture pagate restano.
    expect(await coverages()).toHaveLength(1);
  });

  it("un oggetto non più disponibile o Stripe fuori servizio non revocano né prorogano", async () => {
    const stripe = stripeAccount();
    stripe.state.invoices = [firstInvoice];
    await applyStripeEvent(
      env,
      { topic: "customer.subscription.created", objectId: "sub_test" },
      stripe.fetcher,
      at(now),
    );
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      stripe.state.down = true;
      await expect(
        applyStripeEvent(
          env,
          { topic: "customer.subscription.updated", objectId: "sub_test" },
          stripe.fetcher,
          at("2026-09-20T10:00:00.000Z"),
        ),
      ).rejects.toMatchObject({ failure: "unavailable" });
      await expect(
        applyStripeEvent(
          env,
          { topic: "invoice.paid", objectId: "in_first" },
          stripe.fetcher,
          at("2026-09-20T10:00:00.000Z"),
        ),
      ).rejects.toMatchObject({ failure: "unavailable" });
      // L'uso già pagato continua, e finisce con il periodo pagato.
      expect(await premium("2026-09-20T10:00:00.000Z")).toBe(true);
      expect(await premium(periodEnd)).toBe(false);

      stripe.state.down = false;
      stripe.state.missing = true;
      await applyStripeEvent(
        env,
        { topic: "customer.subscription.deleted", objectId: "sub_test" },
        stripe.fetcher,
        at("2026-09-21T10:00:00.000Z"),
      );
      await applyStripeEvent(
        env,
        { topic: "invoice.paid", objectId: "in_first" },
        stripe.fetcher,
        at("2026-09-21T10:00:00.000Z"),
      );
      expect((await coverages())[0]).toMatchObject({ revoked_at: null, ends_at: periodEnd });
      expect(
        await env.DB.prepare("SELECT unavailable_at FROM stripe_subscriptions").first(),
      ).toEqual({ unavailable_at: "2026-09-21T10:00:00.000Z" });
      expect(await premium("2026-09-21T10:00:00.000Z")).toBe(true);
      // Segnalati entrambi, per l'abbonamento e per la fattura, senza effetti.
      expect(logged(errors)).toEqual(
        Array.from({ length: 2 }, () => ({
          event: "application_error",
          code: "INVALID_REQUEST",
          operation: "billing",
          failure: "rejected",
        })),
      );
    } finally {
      errors.mockRestore();
    }
  });

  it("il cron rilegge prima i rinnovi dovuti, poi i pagamenti da confermare, poi gli altri", async () => {
    const turn = "2026-10-01T12:00:00.000Z";
    const hours = (count: number) => new Date(Date.parse(turn) - count * 3_600_000).toISOString();
    // Lo spazio w-c ha una copertura pagata in corso; w-a nessuna, quindi aspetta un pagamento.
    await env.DB.batch([
      env.DB.prepare("INSERT INTO workspaces (id, name, created_at) VALUES ('w-c', 'C', ?)").bind(
        now,
      ),
      env.DB.prepare(`INSERT INTO workspace_entitlements (id, workspace_id, source, starts_at,
          ends_at) VALUES ('pagato', 'w-c', 'premium', ?1, ?2)`).bind(hours(240), hours(-240)),
    ]);
    const subscription = (id: string, workspace: string, checked: string, periodEnd: string) =>
      env.DB.prepare(`INSERT INTO stripe_subscriptions (id, workspace_id, environment, customer_id,
          offer, price_generation, status, current_period_start, current_period_end,
          cancel_at_period_end, synced_at, checked_at, renewal_offer)
        VALUES (?1, ?2, 'test', 'cus_test', 'monthly', '2026-09', 'active', ?3, ?4, 0, ?3, ?3,
          'monthly')`).bind(id, workspace, checked, periodEnd);
    await env.DB.batch([
      ...Array.from({ length: 3 }, (_, index) =>
        subscription(`dovuto-${index}`, "w-c", hours(80), hours(1)),
      ),
      ...Array.from({ length: 24 }, (_, index) =>
        subscription(`giornaliero-${index}`, "w-c", hours(72 + index), hours(-240)),
      ),
      ...Array.from({ length: 5 }, (_, index) =>
        subscription(`in-attesa-${index}`, "w-a", hours(2), hours(-240)),
      ),
    ]);
    await env.DB.prepare(`INSERT INTO subscription_checkouts (workspace_id, claim, session_id,
        expires_at, created_at) VALUES ('w-a', 'turno', 'cs_vecchia', ?1, ?1)`)
      .bind(hours(49))
      .run();
    const stripe = stripeAccount();
    stripe.state.down = true;
    vi.spyOn(console, "error").mockImplementation(() => {});
    await reconcileBilling(env, stripe.fetcher, at(turn));
    const { results } = await env.DB.prepare(
      "SELECT id FROM stripe_subscriptions WHERE checked_at = ? ORDER BY id",
    )
      .bind(turn)
      .all<{ id: string }>();
    const kinds = results.map(({ id }) => id.replace(/-\d+$/u, ""));
    expect(kinds.filter((kind) => kind === "dovuto")).toHaveLength(3);
    // Il riferimento a una sessione scaduta da oltre due giorni si elimina.
    expect(await env.DB.prepare("SELECT 1 FROM subscription_checkouts").first()).toBeNull();
    // Se la pulizia non riesce, l'errore si registra e il turno rilegge gli abbonamenti.
    const failing = new Proxy(env.DB, {
      get(target, property) {
        if (property === "prepare")
          return (sql: string) => {
            // D1 rifiuta l'esecuzione, non la preparazione.
            if (sql.includes("DELETE FROM subscription_checkouts"))
              return { bind: () => ({ run: () => Promise.reject(new Error("cleanup")) }) };
            return target.prepare(sql);
          };
        const value = Reflect.get(target, property) as unknown;
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const later = new Date(Date.parse(turn) + 86_400_000 + 3_600_000).toISOString();
    await reconcileBilling({ ...env, DB: failing } as Env, stripe.fetcher, at(later));
    // Stripe è fuori servizio: l'unico errore senza il motivo del provider è la pulizia.
    expect(
      errors.mock.calls
        .map(([line]) => JSON.parse(String(line)) as Record<string, unknown>)
        .filter((entry) => !entry.failure),
    ).toEqual([expect.objectContaining({ operation: "billing" })]);
    expect(
      await env.DB.prepare("SELECT count(*) AS n FROM stripe_subscriptions WHERE checked_at = ?")
        .bind(later)
        .first(),
    ).toEqual({ n: 25 });
    expect(kinds.filter((kind) => kind === "in-attesa")).toHaveLength(5);
    // Delle riletture giornaliere restano i posti del turno, prima le più vecchie.
    expect(results.filter(({ id }) => id.startsWith("giornaliero")).map(({ id }) => id)).toEqual(
      Array.from({ length: 17 }, (_, index) => `giornaliero-${index + 7}`).sort(),
    );
  });

  it("il cron riconcilia un pagamento senza webhook, anche con il browser chiuso", async () => {
    const stripe = stripeAccount();
    // Due sessioni dello stesso abbonamento e una di un abbonamento già noto, ormai chiuso.
    stripe.state.sessions = [
      { id: "cs_test", mode: "subscription", subscription: "sub_test" },
      { id: "cs_retry", mode: "subscription", subscription: "sub_test" },
      { id: "cs_known", mode: "subscription", subscription: "sub_known" },
      { id: "cs_lifetime", mode: "payment", subscription: null },
    ];
    await env.DB.prepare(
      `INSERT INTO stripe_subscriptions (id, workspace_id, environment, customer_id, offer,
        price_generation, status, current_period_start, current_period_end, cancel_at_period_end,
        synced_at, checked_at)
       VALUES ('sub_known', 'w-a', 'test', 'cus_test', 'monthly', '2026-09', 'canceled', ?1, ?2, 0, ?1, ?1)`,
    )
      .bind("2026-08-13T20:00:00.000Z", now)
      .run();
    stripe.state.invoices = [firstInvoice];
    const errors = vi.spyOn(console, "error");
    await reconcileBilling(env, stripe.fetcher, at(now));
    expect(await premium(now)).toBe(true);
    expect(stripe.state.sessionsSince).toBe(second(now) - 2 * 86_400);
    // Un abbonamento già noto e coperto non si rilegge prima del giorno seguente.
    stripe.requests.length = 0;
    await reconcileBilling(env, stripe.fetcher, at("2026-09-13T21:30:00.000Z"));
    expect(stripe.requests).toEqual(["GET /v1/checkout/sessions"]);

    // Al rinnovo senza webhook: rilettura dopo la fine del periodo, poi non subito di nuovo.
    stripe.state.subscription = { status: "active", start: periodEnd, end: nextEnd };
    stripe.state.invoices = [
      { id: "in_renewal", start: periodEnd, end: nextEnd, amount: 598, paidAt: periodEnd },
      firstInvoice,
    ];
    stripe.state.charges = [
      {
        id: "ch_in_renewal",
        paymentIntent: "pi_in_renewal",
        customer: "cus_test",
        amount: 598,
        created: second(periodEnd),
        refunds: [],
      },
    ];
    stripe.state.sessions = [];
    stripe.requests.length = 0;
    await reconcileBilling(env, stripe.fetcher, at("2026-10-13T20:10:00.000Z"));
    // Gli addebiti del cliente si leggono una volta: nessun rimborso, nessuna altra richiesta.
    expect(stripe.requests).toEqual([
      "GET /v1/checkout/sessions",
      "GET /v1/subscriptions/sub_test",
      "GET /v1/invoices",
      "GET /v1/charges",
    ]);
    expect(await premium("2026-10-13T20:10:00.000Z")).toBe(true);
    stripe.requests.length = 0;
    await reconcileBilling(env, stripe.fetcher, at("2026-10-13T21:10:00.000Z"));
    expect(stripe.requests).toEqual(["GET /v1/checkout/sessions"]);
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it("un passo del cron fallito si registra e non ferma gli altri né torna in testa", async () => {
    const stripe = stripeAccount();
    stripe.state.invoices = [firstInvoice];
    await applyStripeEvent(
      env,
      { topic: "customer.subscription.created", objectId: "sub_test" },
      stripe.fetcher,
      at(now),
    );
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      stripe.state.down = true;
      await reconcileBilling(env, stripe.fetcher, at(periodEnd));
      expect(stripe.requests.slice(-2)).toEqual([
        "GET /v1/checkout/sessions",
        "GET /v1/subscriptions/sub_test",
      ]);
      expect(logged(errors)).toEqual(
        Array.from({ length: 2 }, () => ({
          event: "application_error",
          code: "UPSTREAM_UNAVAILABLE",
          operation: "billing",
          failure: "unavailable",
        })),
      );
      // Il tentativo fallito conta: il turno seguente non lo ripete subito.
      stripe.requests.length = 0;
      await reconcileBilling(env, stripe.fetcher, at("2026-10-13T20:30:00.000Z"));
      expect(stripe.requests).toEqual(["GET /v1/checkout/sessions"]);
    } finally {
      errors.mockRestore();
    }
  });

  /** Prezzi ricorrenti della generazione indicata, mensile e annuale, con il listino dato. */
  const generationPrices = (generation: string, monthly: number, annual: number) => [
    catalogPrice({
      id: `price_monthly_${generation}`,
      unit_amount: monthly,
      metadata: { offer: "monthly", price_generation: generation },
    }),
    catalogPrice({
      id: `price_annual_${generation}`,
      unit_amount: annual,
      recurring: { interval: "year", interval_count: 1 },
      metadata: { offer: "annual", price_generation: generation },
    }),
  ];

  /** Abbonamento mensile pagato, già riletto, con le chiamate globali allo Stripe simulato. */
  const paidMonthly = async () => {
    const stripe = stripeAccount();
    stripe.state.invoices = [firstInvoice];
    stripe.prices.push(
      ...generationPrices("2026-09", 490, 4900),
      ...generationPrices("2025-01", 390, 3900),
      // Il prezzo una tantum del primo periodo non è un rinnovo.
      catalogPrice({
        id: "price_annual_prepaid",
        recurring: { interval: "year", interval_count: 1 },
        unit_amount: 4900,
        metadata: { offer: "annual", price_generation: "2026-09", role: "prepaid_first_period" },
      }),
    );
    await applyStripeEvent(
      env,
      { topic: "customer.subscription.created", objectId: "sub_test" },
      stripe.fetcher,
      at(now),
    );
    vi.spyOn(globalThis, "fetch").mockImplementation(stripe.fetcher);
    return stripe;
  };
  const change = (period: string) =>
    settingsAction({
      request: new Request("http://localhost:5173/app/impostazioni/piano", {
        method: "POST",
        headers: { cookie, origin: "http://localhost:5173" },
        body: new URLSearchParams({ intent: "change-period", period }),
      }),
    } as Parameters<typeof settingsAction>[0]).catch((thrown: unknown) => thrown);

  it("cambia periodicità alla fine del periodo pagato, senza conguaglio, e la riporta indietro", async () => {
    const stripe = await paidMonthly();
    vi.setSystemTime(at(now));
    expect(await change("annual")).toEqual({ ok: true, notice: "Rinnovo aggiornato." });
    const [write] = stripe.writes;
    expect(write!.path).toBe("/v1/subscriptions/sub_test");
    expect(Object.fromEntries(write!.body)).toMatchObject({
      "items[0][id]": "si_test",
      "items[0][price]": "price_annual_2026-09",
      trial_end: String(second(periodEnd)),
      proration_behavior: "none",
      "metadata[offer]": "monthly",
      "metadata[workspace_id]": "w-a",
      "metadata[price_generation]": "2026-09",
    });
    // Il periodo pagato resta mensile; l'annuale parte al rinnovo, senza nuova copertura.
    expect(await view(now)).toEqual({
      premium: { period: "monthly", renewsAt: periodEnd, nextPeriod: "annual" },
    });
    expect(await coverages()).toHaveLength(1);
    expect((await planAccount(now)).account).toMatchObject({
      premium: { period: "monthly", nextPeriod: "annual" },
    });
    // Ripetere lo stesso cambio non scrive nulla; tornare al mensile lo annulla.
    expect(await change("annual")).toEqual({ ok: true, notice: "Rinnovo aggiornato." });
    expect(stripe.writes).toHaveLength(1);
    expect(await change("monthly")).toEqual({ ok: true, notice: "Rinnovo aggiornato." });
    expect(stripe.writes.at(-1)!.body.get("items[0][price]")).toBe("price_monthly_2026-09");
    expect(await view(now)).toEqual({ premium: { period: "monthly", renewsAt: periodEnd } });
    expect(((await change("trimestrale")) as { init: ResponseInit }).init.status).toBe(400);

    // Dopo il rinnovo con il nuovo prezzo, il periodo pagato è annuale.
    stripe.state.subscription = {
      status: "active",
      start: periodEnd,
      end: "2027-10-13T20:00:00.000Z",
      price: { id: "price_annual_2026-09", interval: "year" },
      metadata: { workspace_id: "w-a", offer: "monthly", price_generation: "2026-09" },
    };
    stripe.state.invoices.push({
      id: "in_annual",
      start: periodEnd,
      end: "2027-10-13T20:00:00.000Z",
      amount: 5978,
      paidAt: periodEnd,
    });
    await applyStripeEvent(
      env,
      { topic: "invoice.paid", objectId: "in_annual" },
      stripe.fetcher,
      at("2026-10-13T21:00:00.000Z"),
    );
    expect(await view("2026-10-13T21:00:00.000Z")).toEqual({
      premium: { period: "annual", renewsAt: "2027-10-13T20:00:00.000Z" },
    });
  });

  it("conserva il listino della generazione dell'abbonamento e rifiuta prezzi non conformi", async () => {
    const stripe = await paidMonthly();
    stripe.state.subscription.metadata = {
      workspace_id: "w-a",
      offer: "monthly",
      price_generation: "2025-01",
    };
    vi.setSystemTime(at(now));
    expect(await changeSubscriptionPeriod(env, userId, "annual", at(now))).toBe("done");
    expect(stripe.writes.at(-1)!.body.get("items[0][price]")).toBe("price_annual_2025-01");
    stripe.writes.length = 0;
    // Senza un prezzo conforme della generazione nessuna modifica.
    stripe.state.subscription.metadata = {
      workspace_id: "w-a",
      offer: "monthly",
      price_generation: "2024-01",
    };
    stripe.state.subscription.price = undefined;
    stripe.state.subscription.status = "active";
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await changeSubscriptionPeriod(env, userId, "annual", at(now))).toBe("unavailable");
    stripe.prices.push(
      catalogPrice({
        id: "price_annual_inclusive",
        tax_behavior: "inclusive",
        recurring: { interval: "year", interval_count: 1 },
        metadata: { offer: "annual", price_generation: "2024-01" },
      }),
    );
    expect(await changeSubscriptionPeriod(env, userId, "annual", at(now))).toBe("unavailable");
    expect(stripe.writes).toEqual([]);
    expect(errors).toHaveBeenCalled();
    // Un abbonamento disdetto non cambia periodicità; un altro utente non ha abbonamenti.
    stripe.state.subscription.cancel = true;
    await applyStripeEvent(
      env,
      { topic: "customer.subscription.updated", objectId: "sub_test" },
      stripe.fetcher,
      at(now),
    );
    expect(await changeSubscriptionPeriod(env, userId, "annual", at(now))).toBe("not_allowed");
    expect(await changeSubscriptionPeriod(env, "estraneo", "annual", at(now))).toBe("not_allowed");
    expect(stripe.writes).toEqual([]);
  });

  it("cambia periodicità soltanto se Stripe conferma un abbonamento modificabile", async () => {
    const stripe = await paidMonthly();
    vi.setSystemTime(at(now));
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const base = { ...stripe.state.subscription };
    // Lo stato locale dice rinnovabile, Stripe no: nessuna modifica.
    for (const variant of [
      { metadata: {} },
      { metadata: { workspace_id: "w-b", offer: "monthly", price_generation: "2026-09" } },
      { noItems: true },
      { status: "past_due" },
      { cancel: true },
      { cancelAt: periodEnd },
      { schedule: "sub_sched_test" },
    ] satisfies Array<Partial<FakeSubscription>>) {
      stripe.state.subscription = { ...base, ...variant };
      expect(await changeSubscriptionPeriod(env, userId, "annual", at(now))).toBe("not_allowed");
    }
    expect(stripe.writes).toEqual([]);
    expect(errors).not.toHaveBeenCalled();
    stripe.state.subscription = { ...base };

    // Senza chiave nessuna richiesta né errore da registrare.
    const missing = { ...env, STRIPE_SECRET_KEY: undefined } as Env;
    stripe.requests.length = 0;
    expect(await changeSubscriptionPeriod(missing, userId, "annual", at(now))).toBe("unavailable");
    expect(stripe.requests).toEqual([]);
    expect(errors).not.toHaveBeenCalled();
    // Stripe non disponibile: nessuna modifica, l'errore si registra.
    stripe.state.down = true;
    expect(await changeSubscriptionPeriod(env, userId, "annual", at(now))).toBe("unavailable");
    expect(logged(errors)).toEqual([
      expect.objectContaining({ operation: "billing", failure: "unavailable" }),
    ]);
    stripe.state.down = false;
    errors.mockClear();

    // Il prezzo della generazione corrente deve avere l'importo del listino.
    const annual = stripe.prices.find((price) => price.id === "price_annual_2026-09")!;
    annual.unit_amount = 5900;
    expect(await changeSubscriptionPeriod(env, userId, "annual", at(now))).toBe("unavailable");
    // Senza il prezzo della generazione: un solo errore, con la sua etichetta.
    stripe.prices.splice(stripe.prices.indexOf(annual), 1);
    expect(await changeSubscriptionPeriod(env, userId, "annual", at(now))).toBe("unavailable");
    expect(logged(errors)).toEqual([
      expect.objectContaining({ operation: "billing", failure: "unknown_subscription" }),
      expect.objectContaining({ operation: "billing", failure: "unknown_subscription" }),
    ]);
    expect(stripe.writes).toEqual([]);
  });

  it("legge la periodicità dal prezzo ricorrente o, senza, dai metadati", () => {
    const subscription = (status: string, recurring: { interval: string } | null) =>
      ({
        status,
        items: { data: [{ price: { recurring } }] },
      }) as unknown as Stripe.Subscription;
    expect(subscriptionOffers(subscription("active", { interval: "month" }), "annual")).toEqual({
      offer: "monthly",
      renewal: "monthly",
    });
    expect(subscriptionOffers(subscription("active", { interval: "year" }), "monthly")).toEqual({
      offer: "annual",
      renewal: "annual",
    });
    // Un prezzo non ricorrente o di un'altra durata non decide la periodicità.
    for (const recurring of [null, { interval: "week" }])
      expect(subscriptionOffers(subscription("active", recurring), "annual")).toEqual({
        offer: "annual",
        renewal: "annual",
      });
    // Durante il periodo `trialing` vale la periodicità pagata dei metadati.
    expect(subscriptionOffers(subscription("trialing", { interval: "year" }), "monthly")).toEqual({
      offer: "monthly",
      renewal: "annual",
    });
  });

  it("nel piano combina coperture, abbonamento e lifetime in conferma", async () => {
    const later = "2026-09-20T10:00:00.000Z";
    const subscription = (status: string) =>
      env.DB.prepare(`INSERT OR REPLACE INTO stripe_subscriptions (id, workspace_id, environment,
          customer_id, offer, price_generation, status, current_period_start, current_period_end,
          cancel_at_period_end, synced_at, checked_at, renewal_offer)
        VALUES ('sub_test', 'w-a', 'test', 'cus_test', 'monthly', '2026-09', ?1, ?2, ?3, 0, ?2,
          ?2, 'monthly')`)
        .bind(status, now, periodEnd)
        .run();
    const entitlement = (source: "premium" | "trial" | "admin") =>
      env.DB.prepare(`INSERT INTO workspace_entitlements (id, workspace_id, source, starts_at,
          ends_at, granted_by, grant_reason) VALUES (?1, 'w-a', ?1, ?2, ?3, ?4, ?4)`)
        .bind(source, now, periodEnd, source === "admin" ? "owner" : null)
        .run();
    // Senza copertura un abbonamento ancora da pagare resta in attivazione.
    for (const status of ["incomplete", "trialing", "active"]) {
      await subscription(status);
      expect(await view(later)).toEqual({ payment: { state: "pending" } });
    }
    // Una concessione a un abbonamento che si rinnova ne mostra il rinnovo.
    await entitlement("admin");
    expect(await view(later)).toEqual({ premium: { period: "monthly", renewsAt: periodEnd } });
    await env.DB.prepare("DELETE FROM workspace_entitlements").run();

    // Lifetime pagato e in conferma: durante la prova prevale sull'abbonamento scelto, con un
    // periodo pagato lo accompagna.
    await env.DB.prepare(`INSERT INTO lifetime_allocations (slot, workspace_id, status, kind,
        provider_reference, expires_at, completed_at, created_at)
      VALUES (1, 'w-a', 'reserved', 'sale', 'cs_pending', ?1, ?2, ?2)`)
      .bind(periodEnd, now)
      .run();
    await subscription("trialing");
    await entitlement("trial");
    expect(await view(later)).toEqual({ payment: { state: "pending", lifetime: true } });
    await env.DB.prepare("DELETE FROM workspace_entitlements").run();
    await subscription("active");
    await entitlement("premium");
    expect(await view(later)).toEqual({
      payment: { state: "pending", lifetime: true },
      premium: { period: "monthly", renewsAt: periodEnd },
    });
  });

  it("un passo del cron fallito per il lifetime si registra e non ferma gli altri", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const stripe = stripeAccount();
    // Una sessione lifetime completata senza posto locale, che Stripe non restituisce ora.
    stripe.state.sessions = [
      {
        id: "cs_lifetime_down",
        mode: "payment",
        subscription: null,
        status: "complete",
        metadata: { workspace_id: "w-a", offer: "lifetime" },
      },
    ];
    stripe.state.failing = ["/v1/checkout/sessions/cs_lifetime_down"];
    // Anche il passo dei posti fallisce, sul database.
    const batch = vi.spyOn(env.DB, "batch").mockRejectedValueOnce(new Error("d1_unavailable"));
    // L'abbonamento dovuto si rilegge comunque.
    await env.DB.prepare(`INSERT INTO stripe_subscriptions (id, workspace_id, environment,
        customer_id, offer, price_generation, status, current_period_start, current_period_end,
        cancel_at_period_end, synced_at, checked_at, renewal_offer)
      VALUES ('sub_test', 'w-a', 'test', 'cus_test', 'monthly', '2026-09', 'active', ?1, ?2, 0,
        ?1, ?1, 'monthly')`)
      .bind(periodStart, periodEnd)
      .run();
    await reconcileBilling(env, stripe.fetcher, at("2026-10-13T20:10:00.000Z"));
    expect(logged(errors)).toEqual([
      expect.objectContaining({ operation: "billing", failure: "unavailable" }),
      expect.objectContaining({ operation: "billing", code: "INTERNAL_ERROR" }),
    ]);
    expect(stripe.requests).toContain("GET /v1/subscriptions/sub_test");
    batch.mockRestore();
  });

  it("apre il portale di Stripe con il cliente dello spazio e il ritorno al piano", async () => {
    const stripe = await paidMonthly();
    vi.setSystemTime(at(now));
    expect((await planAccount(now)).services).toMatchObject({ billingPortal: true });
    const portal = (await settingsAction({
      request: new Request("http://localhost:5173/en/app/impostazioni/piano", {
        method: "POST",
        headers: { cookie, origin: "http://localhost:5173" },
        body: new URLSearchParams({ intent: "manage-billing" }),
      }),
    } as Parameters<typeof settingsAction>[0]).catch((thrown: unknown) => thrown)) as Response;
    expect(portal.status).toBe(302);
    expect(portal.headers.get("location")).toBe("https://billing.example.invalid/p/session_test");
    expect(Object.fromEntries(stripe.writes.at(-1)!.body)).toEqual({
      customer: "cus_test",
      return_url: `${new URL(env.APP_ORIGIN).origin}/en/app/impostazioni/piano`,
      locale: "en",
    });
    expect(
      await openBillingPortal(env, "estraneo", "https://test.fiscalbay.it/app", "it"),
    ).toBeNull();
    // Senza chiave Stripe il portale non si apre, anche con un cliente.
    expect(
      await openBillingPortal(
        { ...env, STRIPE_SECRET_KEY: undefined } as Env,
        userId,
        "https://test.fiscalbay.it/app",
        "it",
      ),
    ).toBeNull();
    // Lo scollegamento dell'ultimo negozio avvisa finché l'abbonamento si rinnova.
    expect(await subscriptionRenews(env.DB, env, userId)).toBe(true);
    stripe.state.subscription.cancel = true;
    await applyStripeEvent(
      env,
      { topic: "customer.subscription.updated", objectId: "sub_test" },
      stripe.fetcher,
      at(now),
    );
    expect(await subscriptionRenews(env.DB, env, userId)).toBe(false);
  });

  it("legge il periodo pagato soltanto dalle righe dell'abbonamento", () => {
    const line = (start: string, end: string, type: string | null) => ({
      period: { start: second(start), end: second(end) },
      parent: type ? { type } : null,
    });
    // Prezzo una tantum e due righe dell'abbonamento, come una proroga con conguaglio.
    const invoice = {
      id: "in_mixed",
      status: "paid",
      amount_paid: 1200,
      currency: "eur",
      status_transitions: { paid_at: second(now) },
      // Un primo tentativo fallito e il pagamento riuscito, espanso.
      payments: {
        data: [
          { status: "canceled", payment: { type: "payment_intent", payment_intent: "pi_failed" } },
          {
            status: "paid",
            payment: { type: "payment_intent", payment_intent: { id: "pi_mixed" } },
          },
        ],
      },
      lines: {
        data: [
          line("2026-09-01T00:00:00.000Z", nextEnd, "invoice_item_details"),
          line("2026-09-01T00:00:00.000Z", "2026-12-13T20:00:00.000Z", null),
          line(periodEnd, nextEnd, "subscription_item_details"),
          line(now, periodEnd, "subscription_item_details"),
        ],
      },
    } as unknown as Stripe.Invoice;
    expect(paidCoverage(invoice)).toEqual({
      invoiceId: "in_mixed",
      paymentIntent: "pi_mixed",
      startsAt: now,
      endsAt: nextEnd,
      amountPaid: 1200,
      currency: "eur",
      paidAt: now,
    });
    const only = (...data: unknown[]) => ({ ...invoice, lines: { data } }) as Stripe.Invoice;
    expect(paidCoverage({ ...invoice, status: "open" } as Stripe.Invoice)).toBeNull();
    expect(paidCoverage(only(invoice.lines.data[0]))).toBeNull();
    // Senza pagamenti espansi, o senza un pagamento riuscito, la copertura resta senza
    // riferimento all'addebito.
    expect(paidCoverage({ ...invoice, payments: undefined } as Stripe.Invoice)).toMatchObject({
      invoiceId: "in_mixed",
      paymentIntent: null,
    });
    expect(
      paidCoverage({
        ...invoice,
        payments: { data: [invoice.payments.data[0]] },
      } as unknown as Stripe.Invoice),
    ).toMatchObject({ invoiceId: "in_mixed", paymentIntent: null });
    // Un periodo senza durata non copre nulla.
    expect(paidCoverage(only(line(now, now, "subscription_item_details")))).toBeNull();
  });

  it("legge Stripe senza retry propri, entro il limite dei byte e con errori classificati", async () => {
    const reply = vi.fn<typeof fetch>();
    const stripe = await createStripeReader("rk_test_fiscalbay", reply);
    const read = () => stripeRead(() => stripe.subscriptions.retrieve("sub_test"));
    const failure = (status: number, body: unknown, headers: Record<string, string> = {}) =>
      reply.mockResolvedValueOnce(Response.json(body, { status, headers }));

    reply.mockResolvedValueOnce(Response.json({ id: "sub_test", object: "subscription" }));
    expect(await read()).toMatchObject({ id: "sub_test" });
    failure(429, { error: { type: "rate_limit_error" } }, { "retry-after": "30" });
    await expect(read()).rejects.toMatchObject({
      failure: "rate_limited",
      details: { status: 429, retryAfter: 30 },
    });
    failure(429, { error: { type: "rate_limit_error" } });
    await expect(read()).rejects.toMatchObject({
      failure: "rate_limited",
      details: { status: 429, retryAfter: undefined },
    });
    for (const status of [500, 503]) {
      failure(status, { error: { type: "api_error" } });
      await expect(read()).rejects.toMatchObject({ failure: "unavailable", details: { status } });
    }
    failure(404, { error: { type: "invalid_request_error", code: "resource_missing" } });
    const missing = await read().catch((error: unknown) => error);
    expect(missing).toMatchObject({
      failure: "rejected",
      details: { status: 404, providerCode: "resource_missing" },
    });
    expect(isMissingObject(missing as never)).toBe(true);
    // Un codice fuori formato non entra nell'errore; un 404 diverso non è un oggetto mancante.
    failure(404, { error: { type: "invalid_request_error", code: "missing-Code" } });
    const other = await read().catch((error: unknown) => error);
    expect(other).toMatchObject({ details: { status: 404, providerCode: undefined } });
    expect(isMissingObject(other as never)).toBe(false);
    failure(400, { error: { type: "invalid_request_error", code: "resource_missing" } });
    const invalid = await read().catch((error: unknown) => error);
    expect(invalid).toMatchObject({ failure: "rejected", details: { status: 400 } });
    expect(isMissingObject(invalid as never)).toBe(false);
    // Un corpo oltre il limite si interrompe, anche senza lunghezza dichiarata.
    reply.mockResolvedValueOnce(new Response("x".repeat(1_048_577)));
    await expect(read()).rejects.toMatchObject({
      failure: "invalid_response",
      details: { status: 200 },
    });
    reply.mockRejectedValueOnce(new TypeError("network"));
    await expect(read()).rejects.toMatchObject({ failure: "unavailable", details: {} });
    // Ogni errore è stato una sola richiesta: nessun retry dello SDK.
    expect(reply).toHaveBeenCalledTimes(10);
  });
});

describe("Lifetime e concessioni", () => {
  let userId: string;
  let cookie: string;
  const at = (iso: string) => new Date(iso);
  const request = new Request("http://localhost:5173/app/impostazioni/piano", { method: "POST" });
  /** Acquisto lifetime dalla pagina del piano, con Stripe simulato anche per il client. */
  const buyLifetime = (stripe: ReturnType<typeof stripeAccount>, user = userId, time = now) => {
    vi.spyOn(globalThis, "fetch").mockImplementation(stripe.fetcher);
    return startCheckout(
      env,
      {
        request,
        userId: user,
        email: "lifetime@example.invalid",
        offer: "lifetime",
        language: "it",
      },
      at(time),
    );
  };
  const event = (stripe: ReturnType<typeof stripeAccount>, topic: string, id: string, time = now) =>
    applyStripeEvent(env, { topic, objectId: id }, stripe.fetcher, at(time));
  const allocations = async () =>
    (
      await env.DB.prepare(
        `SELECT slot, workspace_id, status, kind, provider_reference, expires_at, completed_at,
          customer_id FROM lifetime_allocations ORDER BY slot`,
      ).all()
    ).results;
  const lifetimes = async () =>
    (
      await env.DB.prepare(
        `SELECT workspace_id, starts_at, ends_at, stripe_checkout_session_id, amount_paid, currency,
          granted_by, grant_reason FROM workspace_entitlements WHERE source = 'lifetime'`,
      ).all()
    ).results;
  /** Posti già occupati da altri spazi, ormai cancellati. */
  const taken = (slots: number) =>
    env.DB.batch(
      Array.from({ length: slots }, (_, index) =>
        env.DB.prepare(`INSERT INTO lifetime_allocations (slot, status, activated_at, created_at)
          VALUES (?1, 'active', ?2, ?2)`).bind(index + 1, now),
      ),
    );
  const view = async (time = now) => {
    const allowance = (await orderAllowance(env.DB, userId, at(time)))!;
    return subscriptionView(env.DB, env, "w-a", allowance.coverage, at(time));
  };
  const reservationEnd = new Date(Date.parse(now) + 3_600_000).toISOString();

  beforeEach(async () => {
    await resetDatabase();
    await env.DB.batch([
      env.DB.prepare("DELETE FROM stripe_subscriptions"),
      env.DB.prepare("DELETE FROM workspace_entitlements"),
    ]);
    ({ userId, cookie } = await verifiedSession(`lifetime-${crypto.randomUUID()}@example.invalid`));
    await workspace(userId);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("detrae soltanto il periodo pagato non usato, sull'istante UTC", () => {
    const month = { startsAt: "2028-02-01T00:00:00.000Z", endsAt: "2028-03-01T00:00:00.000Z" };
    // Febbraio bisestile: 29 giorni, 15 ancora da usare.
    expect(unusedCredit(490, month, at("2028-02-15T00:00:00.000Z"))).toBe(
      Math.floor((490 * 15) / 29),
    );
    // Il periodo non ancora iniziato vale per intero, quello finito niente.
    expect(unusedCredit(490, month, at("2028-01-31T23:00:00.000Z"))).toBe(490);
    expect(unusedCredit(490, month, at("2028-03-01T00:00:00.000Z"))).toBe(0);
    const year = { startsAt: "2026-12-31T23:30:00.000Z", endsAt: "2027-12-31T23:30:00.000Z" };
    expect(unusedCredit(4900, year, at("2027-07-02T11:30:00.000Z"))).toBe(2450);
    // Un rimborso parziale del periodo riduce il credito in proporzione al pagamento.
    expect(refundedShare(2450, 5978, null)).toBe(2450);
    expect(refundedShare(2450, 5978, 2989)).toBe(1225);
    expect(refundedShare(2450, 5978, 5978)).toBe(0);
    expect(refundedShare(2450, 5978, 9000)).toBe(0);
  });

  it("vende l'ultimo posto una volta sola con acquisti concorrenti", async () => {
    const stripe = stripeAccount();
    const other = await verifiedSession("lifetime-concorrente@example.invalid");
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO workspaces (id, name, created_at) VALUES ('w-b', 'Altro', ?)",
      ).bind(now),
      env.DB.prepare(
        "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ('w-b', ?, 'owner')",
      ).bind(other.userId),
      insertStore({ id: "s-b", workspaceId: "w-b" }),
      env.DB.prepare(
        "INSERT INTO sync_state (store_id, last_success_at, updated_at) VALUES ('s-b', ?1, ?1)",
      ).bind(now),
    ]);
    await taken(19);
    const results = await Promise.all([buyLifetime(stripe), buyLifetime(stripe, other.userId)]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toEqual([{ ok: false, reason: "sold-out" }]);
    const reserved = (await allocations()).filter((row) => row.status === "reserved");
    expect(reserved).toEqual([
      expect.objectContaining({
        slot: 20,
        expires_at: reservationEnd,
        provider_reference: "cs_lifetime_1",
      }),
    ]);
    // Il checkout scade con la prenotazione e crea il cliente per i documenti.
    const body = stripe.writes.find((write) => write.path === "/v1/checkout/sessions")!.body;
    expect(body.get("mode")).toBe("payment");
    expect(body.get("expires_at")).toBe(String(second(reservationEnd)));
    expect(body.get("customer_creation")).toBe("always");
    // Il ritorno dice che il lifetime è in attivazione, anche durante la prova.
    expect(body.get("success_url")).toBe(
      "http://localhost:5173/app/impostazioni/piano?checkout=lifetime&session_id={CHECKOUT_SESSION_ID}",
    );
    expect(body.get("line_items[0][price]")).toBe("price_test_lifetime");
    expect(body.get("discounts[0][coupon]")).toBeNull();
    // Chi non ha avuto il posto lo vede esaurito; nessun posto oltre il ventesimo.
    const loser = reserved[0]!.workspace_id === "w-a" ? other.userId : userId;
    expect((await lifetimeContext(env.DB, env, loser))?.offer).toEqual({
      state: "sold-out",
      credit: 0,
      replaces: false,
    });
    expect(await allocations()).toHaveLength(20);
  });

  it("tiene aperta una sola sessione per spazio fra mensile, annuale e lifetime", async () => {
    const stripe = stripeAccount();
    const buy = (offer: "monthly" | "annual" | "lifetime", time = now) => {
      vi.spyOn(globalThis, "fetch").mockImplementation(stripe.fetcher);
      return startCheckout(
        env,
        { request, userId, email: "lifetime@example.invalid", offer, language: "it" },
        at(time),
      );
    };
    const statuses = () => stripe.state.sessions.map((session) => [session.id, session.status]);
    expect(await buy("monthly")).toMatchObject({ ok: true });
    // Scade dopo un'ora, come il lifetime.
    const first = stripe.writes.find((write) => write.path === "/v1/checkout/sessions")!.body;
    expect(first.get("mode")).toBe("subscription");
    expect(first.get("expires_at")).toBe(String(second(reservationEnd)));
    expect(first.get("customer")).toBeNull();
    expect(first.get("customer_email")).toBe("lifetime@example.invalid");
    // Una seconda scheda chiude la sessione precedente prima di aprirne un'altra.
    expect(await buy("monthly")).toMatchObject({ ok: true });
    expect(statuses()).toEqual([
      ["cs_lifetime_1", "expired"],
      ["cs_lifetime_2", "open"],
    ]);
    // Il lifetime chiude la sessione dell'abbonamento, e viceversa liberando il posto.
    expect(await buy("lifetime")).toMatchObject({ ok: true });
    expect(statuses().at(1)).toEqual(["cs_lifetime_2", "expired"]);
    expect(await allocations()).toEqual([
      expect.objectContaining({ status: "reserved", provider_reference: "cs_lifetime_3" }),
    ]);
    expect(await buy("monthly")).toMatchObject({ ok: true });
    expect(statuses().slice(2)).toEqual([
      ["cs_lifetime_3", "expired"],
      ["cs_lifetime_4", "open"],
    ]);
    expect(await allocations()).toEqual([]);
    // Pagata in un'altra scheda prima del webhook: il nuovo acquisto si ferma senza sessioni.
    Object.assign(stripe.state.sessions[3]!, { status: "complete", subscription: "sub_test" });
    expect(await buy("monthly")).toEqual({ ok: false, reason: "covered" });
    expect(stripe.state.sessions).toHaveLength(4);
    expect(await env.DB.prepare("SELECT id, status FROM stripe_subscriptions").all()).toMatchObject(
      { results: [{ id: "sub_test", status: "active" }] },
    );
    // La sessione pagata è registrata: il passaggio a vita dell'abbonato si apre.
    expect(await env.DB.prepare("SELECT 1 FROM subscription_checkouts").first()).toBeNull();
    expect(await buy("lifetime")).toMatchObject({ ok: true });
    expect(stripe.state.sessions).toHaveLength(5);
  });

  it("fra richieste concorrenti dello stesso spazio apre una sola sessione", async () => {
    const stripe = stripeAccount();
    vi.spyOn(globalThis, "fetch").mockImplementation(stripe.fetcher);
    const buy = () =>
      startCheckout(
        env,
        { request, userId, email: "lifetime@example.invalid", offer: "monthly", language: "it" },
        at(now),
      );
    const results = await Promise.all([buy(), buy(), buy()]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toEqual([
      { ok: false, reason: "unavailable" },
      { ok: false, reason: "unavailable" },
    ]);
    expect(stripe.state.sessions.filter((session) => session.status === "open")).toHaveLength(1);
    // Una richiesta interrotta prima di legare la sessione non blocca lo spazio oltre cinque minuti.
    await env.DB.prepare("UPDATE subscription_checkouts SET session_id = NULL").run();
    expect(await buy()).toEqual({ ok: false, reason: "unavailable" });
    expect(
      await startCheckout(
        env,
        { request, userId, email: "lifetime@example.invalid", offer: "monthly", language: "it" },
        at(new Date(Date.parse(now) + 5 * 60_000).toISOString()),
      ),
    ).toMatchObject({ ok: true });
    // Un lifetime concorrente dello stesso spazio non legge «Posti esauriti».
    await env.DB.prepare("DELETE FROM subscription_checkouts").run();
    vi.spyOn(globalThis, "fetch").mockImplementation(stripe.fetcher);
    const lifetime = await Promise.all([buyLifetime(stripe), buyLifetime(stripe)]);
    expect(lifetime.filter((result) => !result.ok)).toEqual([{ ok: false, reason: "unavailable" }]);
  });

  it("riusa il cliente dello spazio e apre il portale su quello che può ancora addebitare", async () => {
    const stripe = stripeAccount();
    const portalCustomer = async () => {
      vi.spyOn(globalThis, "fetch").mockImplementation(stripe.fetcher);
      await openBillingPortal(env, userId, "http://localhost:5173/app/impostazioni/piano", "it");
      return stripe.writes
        .filter((write) => write.path === "/v1/billing_portal/sessions")
        .at(-1)!
        .body.get("customer");
    };
    // Lifetime rimborsato: il posto resta con il suo cliente.
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO lifetime_allocations (slot, workspace_id, status, kind,
          provider_reference, customer_id, activated_at, created_at)
        VALUES (1, 'w-a', 'active', 'sale', 'cs_paid', 'cus_lifetime', ?1, ?1)`).bind(now),
      env.DB.prepare(`INSERT INTO workspace_entitlements (id, workspace_id, source, starts_at,
          stripe_checkout_session_id, amount_paid, currency, paid_at, revoked_at, revocation)
        VALUES ('lifetime', 'w-a', 'lifetime', ?1, 'cs_paid', 18178, 'eur', ?1, ?1, 'refund')`).bind(
        now,
      ),
    ]);
    expect(await portalCustomer()).toBe("cus_lifetime");
    // Il nuovo abbonamento usa lo stesso cliente.
    vi.spyOn(globalThis, "fetch").mockImplementation(stripe.fetcher);
    expect(
      await startCheckout(
        env,
        { request, userId, email: "lifetime@example.invalid", offer: "monthly", language: "it" },
        at(now),
      ),
    ).toMatchObject({ ok: true });
    const body = stripe.writes.find((write) => write.path === "/v1/checkout/sessions")!.body;
    expect(body.get("customer")).toBe("cus_lifetime");
    expect(body.get("customer_email")).toBeNull();
    // Con un cliente diverso, l'abbonamento che può ancora addebitare prevale sul lifetime
    // rimborsato.
    await env.DB.prepare(`INSERT INTO stripe_subscriptions (id, workspace_id, environment,
        customer_id, offer, price_generation, status, current_period_start, current_period_end,
        cancel_at_period_end, synced_at, checked_at, renewal_offer)
      VALUES ('sub_new', 'w-a', 'test', 'cus_new', 'monthly', '2026-09', 'active', ?1, ?2, 0, ?1,
        ?1, 'monthly')`)
      .bind(now, periodEnd)
      .run();
    expect(await portalCustomer()).toBe("cus_new");
    // Chiuso, l'abbonamento più recente prevale comunque sul lifetime rimborsato.
    await env.DB.prepare(
      "UPDATE stripe_subscriptions SET status = 'canceled' WHERE id = 'sub_new'",
    ).run();
    expect(await portalCustomer()).toBe("cus_new");
  });

  it("apre il portale sul cliente del lifetime in vigore, non su un abbonamento chiuso", async () => {
    const stripe = stripeAccount();
    vi.spyOn(globalThis, "fetch").mockImplementation(stripe.fetcher);
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO stripe_subscriptions (id, workspace_id, environment,
          customer_id, offer, price_generation, status, current_period_start, current_period_end,
          cancel_at_period_end, synced_at, checked_at, renewal_offer)
        VALUES ('sub_old', 'w-a', 'test', 'cus_old', 'monthly', '2026-09', 'canceled', ?1, ?2, 0,
          ?1, ?1, 'monthly')`).bind(now, periodEnd),
      env.DB.prepare(`INSERT INTO lifetime_allocations (slot, workspace_id, status, kind,
          provider_reference, customer_id, activated_at, created_at)
        VALUES (1, 'w-a', 'active', 'sale', 'cs_paid', 'cus_lifetime', ?1, ?1)`).bind(now),
      env.DB.prepare(`INSERT INTO workspace_entitlements (id, workspace_id, source, starts_at,
          stripe_checkout_session_id) VALUES ('lifetime', 'w-a', 'lifetime', ?1, 'cs_paid')`).bind(
        now,
      ),
    ]);
    await openBillingPortal(env, userId, "http://localhost:5173/app/impostazioni/piano", "it");
    expect(
      stripe.writes
        .find((write) => write.path === "/v1/billing_portal/sessions")!
        .body.get("customer"),
    ).toBe("cus_lifetime");
  });

  it("dalla pagina del piano porta al checkout lifetime o dice che i posti sono finiti", async () => {
    const stripe = stripeAccount();
    vi.spyOn(globalThis, "fetch").mockImplementation(stripe.fetcher);
    const response = (await buy(cookie, "lifetime")) as Response;
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://checkout.example.invalid/c/pay/cs_lifetime_1",
    );
    await env.DB.prepare("DELETE FROM lifetime_allocations").run();
    await taken(20);
    expect(await buy(cookie, "lifetime")).toMatchObject({
      data: { ok: false, notice: "I posti a vita sono esauriti." },
      init: { status: 409 },
    });
  });

  it("libera il posto soltanto quando la sessione non può più incassare", async () => {
    const stripe = stripeAccount();
    expect(await buyLifetime(stripe)).toEqual({
      ok: true,
      url: "https://checkout.example.invalid/c/pay/cs_lifetime_1",
    });
    stripe.settle("cs_lifetime_1", "expired");
    await event(stripe, "checkout.session.expired", "cs_lifetime_1");
    expect(await allocations()).toEqual([]);

    // Completata con un pagamento asincrono: il posto resta oltre la scadenza della sessione.
    await buyLifetime(stripe);
    stripe.settle("cs_lifetime_2", "processing");
    await event(stripe, "checkout.session.completed", "cs_lifetime_2");
    await reconcileBilling(env, stripe.fetcher, at("2026-09-13T23:00:00.000Z"));
    expect(await allocations()).toEqual([
      expect.objectContaining({
        status: "reserved",
        provider_reference: "cs_lifetime_2",
        completed_at: now,
      }),
    ]);
    expect(await view()).toEqual({ payment: { state: "pending", lifetime: true } });
    expect((await lifetimeContext(env.DB, env, userId))?.offer).toBeNull();
    // Nemmeno mensile o annuale finché il pagamento lifetime non ha un esito.
    expect((await purchaseState(env.DB, userId))?.state).toBe("covered");
    expect(await buyLifetime(stripe)).toEqual({ ok: false, reason: "covered" });
    stripe.settle("cs_lifetime_2", "failed");
    await event(stripe, "checkout.session.async_payment_failed", "cs_lifetime_2");
    expect(await allocations()).toEqual([]);

    // Pagamento asincrono riuscito: posto attivo, diritto senza scadenza con la prova.
    await buyLifetime(stripe);
    stripe.settle("cs_lifetime_3", "processing");
    await event(stripe, "checkout.session.completed", "cs_lifetime_3");
    stripe.settle("cs_lifetime_3", "paid", "2026-09-14T08:00:00.000Z");
    for (const topic of ["checkout.session.async_payment_succeeded", "checkout.session.completed"])
      await event(stripe, topic, "cs_lifetime_3", "2026-09-14T08:05:00.000Z");
    expect(await allocations()).toEqual([
      expect.objectContaining({
        slot: 1,
        workspace_id: "w-a",
        status: "active",
        kind: "sale",
        expires_at: null,
        customer_id: "cus_lifetime",
      }),
    ]);
    expect(await lifetimes()).toEqual([
      {
        workspace_id: "w-a",
        starts_at: "2026-09-14T08:00:00.000Z",
        ends_at: null,
        stripe_checkout_session_id: "cs_lifetime_3",
        amount_paid: 18178,
        currency: "eur",
        granted_by: null,
        grant_reason: null,
      },
    ]);
    expect(await view("2026-09-14T09:00:00.000Z")).toEqual({
      premium: { period: "lifetime", renewsAt: null },
    });
    expect((await purchaseState(env.DB, userId, at("2026-09-14T09:00:00.000Z")))?.state).toBe(
      "covered",
    );
    expect((await lifetimeContext(env.DB, env, userId))?.offer).toBeNull();
    // Un rimborso, gestito dall'assistenza, non libera il posto né lo rende riassegnabile.
    stripe.state.sessions.at(-1)!.payment_intent = {
      ...(stripe.state.sessions.at(-1)!.payment_intent as object),
      amount_refunded: 18178,
    };
    await event(stripe, "checkout.session.completed", "cs_lifetime_3", "2026-09-20T08:00:00.000Z");
    await reconcileBilling(env, stripe.fetcher, at("2026-09-20T08:00:00.000Z"));
    expect(await allocations()).toEqual([expect.objectContaining({ slot: 1, status: "active" })]);
    expect(await lifetimes()).toHaveLength(1);
  });

  it("un rimborso revoca il lifetime, lascia occupato il posto e riapre mensile e annuale", async () => {
    const stripe = stripeAccount();
    await buyLifetime(stripe);
    stripe.settle("cs_lifetime_1", "paid");
    await event(stripe, "checkout.session.completed", "cs_lifetime_1");
    // Un omaggio di un altro spazio non dipende da questo pagamento.
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO workspaces (id, name, created_at) VALUES ('w-b', 'Altro', ?)",
      ).bind(now),
    ]);
    expect(
      await grantLifetimeConcession(env, {
        workspaceId: "w-b",
        author: "owner",
        reason: "Omaggio",
      }),
    ).toBe("done");
    // Managed Payments emette una fattura anche per l'acquisto una tantum.
    stripe.state.invoices.push({
      id: "in_lifetime",
      start: now,
      end: now,
      amount: 18178,
      paidAt: now,
      orphan: "none",
      paymentIntent: "pi_cs_lifetime_1",
    });
    stripe.state.charges
      .find((charge) => charge.id === "ch_cs_lifetime_1")!
      .refunds.push({
        amount: 18178,
        status: "succeeded",
      });
    await event(stripe, "charge.refunded", "ch_cs_lifetime_1", "2026-09-20T08:00:00.000Z");
    expect(
      (
        await env.DB.prepare(
          `SELECT workspace_id, revoked_at, revocation, amount_refunded FROM workspace_entitlements
            WHERE source = 'lifetime' ORDER BY workspace_id`,
        ).all()
      ).results,
    ).toEqual([
      {
        workspace_id: "w-a",
        revoked_at: "2026-09-20T08:00:00.000Z",
        revocation: "refund",
        amount_refunded: 18178,
      },
      { workspace_id: "w-b", revoked_at: null, revocation: null, amount_refunded: null },
    ]);
    expect(await allocations()).toEqual([
      expect.objectContaining({ slot: 1, workspace_id: "w-a", status: "active" }),
      expect.objectContaining({ slot: 2, workspace_id: "w-b", status: "active", kind: "gift" }),
    ]);
    const later = "2026-09-20T09:00:00.000Z";
    expect(await view(later)).toEqual({ payment: { state: "refunded", lifetime: true } });
    expect((await lifetimeContext(env.DB, env, userId, at(later)))?.offer).toBeNull();
    expect((await purchaseState(env.DB, userId, at(later)))?.state).toBe("available");

    // Un abbonamento acquistato dopo il rimborso non è sostituito dal lifetime revocato.
    await env.DB.prepare(`INSERT INTO stripe_subscriptions (id, workspace_id, environment,
        customer_id, offer, price_generation, status, current_period_start, current_period_end,
        cancel_at_period_end, synced_at, checked_at, renewal_offer)
      VALUES ('sub_test', 'w-a', 'test', 'cus_lifetime', 'monthly', '2026-09', 'active', ?1, ?2,
        0, ?1, ?1, 'monthly')`)
      .bind(later, "2026-10-20T09:00:00.000Z")
      .run();
    stripe.requests.length = 0;
    await reconcileBilling(env, stripe.fetcher, at("2026-09-20T10:00:00.000Z"));
    expect(stripe.requests).not.toContain("DELETE /v1/subscriptions/sub_test");
  });

  it("alla cancellazione dell'account chiude il checkout lifetime aperto", async () => {
    const stripe = stripeAccount();
    await buyLifetime(stripe);
    stripe.requests.length = 0;
    expect(await stopRenewals(env, "w-a", stripe.fetcher, at(now))).toBe(true);
    expect(stripe.requests).toContain("POST /v1/checkout/sessions/cs_lifetime_1/expire");
    expect(await allocations()).toEqual([]);
    // Un pagamento in conferma non si può fermare: il job ripete e avvisa.
    await buyLifetime(stripe);
    stripe.settle("cs_lifetime_2", "processing");
    await event(stripe, "checkout.session.completed", "cs_lifetime_2");
    stripe.requests.length = 0;
    expect(await stopRenewals(env, "w-a", stripe.fetcher, at(now))).toBe(false);
    expect(stripe.requests).not.toContain("POST /v1/checkout/sessions/cs_lifetime_2/expire");
    expect(await allocations()).toEqual([
      expect.objectContaining({ provider_reference: "cs_lifetime_2", status: "reserved" }),
    ]);
  });

  it("alla cancellazione dell'account chiude il checkout dell'abbonamento o ferma quello pagato", async () => {
    const stripe = stripeAccount();
    const buyMonthly = () => {
      vi.spyOn(globalThis, "fetch").mockImplementation(stripe.fetcher);
      return startCheckout(
        env,
        { request, userId, email: "lifetime@example.invalid", offer: "monthly", language: "it" },
        at(now),
      );
    };
    await buyMonthly();
    expect(await stopRenewals(env, "w-a", stripe.fetcher, at(now))).toBe(true);
    expect(stripe.requests).toContain("POST /v1/checkout/sessions/cs_lifetime_1/expire");
    // Completata prima che il webhook registri l'abbonamento: l'abbonamento si chiude.
    await buyMonthly();
    Object.assign(stripe.state.sessions[1]!, { status: "complete", subscription: "sub_test" });
    expect(await stopRenewals(env, "w-a", stripe.fetcher, at(now))).toBe(true);
    expect(stripe.requests).toContain("DELETE /v1/subscriptions/sub_test");
    expect(stripe.state.subscription.status).toBe("canceled");
    // Una sessione già scaduta non ha nulla da fermare.
    await env.DB.prepare("DELETE FROM stripe_subscriptions").run();
    await buyMonthly();
    stripe.state.sessions[2]!.status = "expired";
    stripe.requests.length = 0;
    expect(await stopRenewals(env, "w-a", stripe.fetcher, at(now))).toBe(true);
    expect(stripe.requests).toEqual(["GET /v1/checkout/sessions/cs_lifetime_3"]);
  });

  it("il cron rilegge una volta al giorno i lifetime venduti, per i rimborsi senza webhook", async () => {
    const stripe = stripeAccount();
    await buyLifetime(stripe);
    stripe.settle("cs_lifetime_1", "paid");
    await event(stripe, "checkout.session.completed", "cs_lifetime_1");
    const rereads = () =>
      stripe.requests.filter((request) => request === "GET /v1/checkout/sessions/cs_lifetime_1")
        .length;
    stripe.requests.length = 0;
    await reconcileBilling(env, stripe.fetcher, at("2026-09-13T21:00:00.000Z"));
    expect(rereads()).toBe(1);
    stripe.state.charges[0]!.refunds.push({ amount: 18178, status: "succeeded" });
    // Entro il giorno nessuna nuova rilettura; il giorno dopo il rimborso si applica.
    await reconcileBilling(env, stripe.fetcher, at("2026-09-14T20:00:00.000Z"));
    expect(rereads()).toBe(1);
    expect(await view("2026-09-14T20:30:00.000Z")).toEqual({
      premium: { period: "lifetime", renewsAt: null },
    });
    await reconcileBilling(env, stripe.fetcher, at("2026-09-14T21:00:00.000Z"));
    expect(rereads()).toBe(2);
    expect(await view("2026-09-14T21:30:00.000Z")).toEqual({
      payment: { state: "refunded", lifetime: true },
    });
    // Revocato, non si rilegge più.
    await reconcileBilling(env, stripe.fetcher, at("2026-09-16T21:00:00.000Z"));
    expect(rereads()).toBe(2);
  });

  it("riprende dopo un errore o un crash senza liberare posti prima del tempo", async () => {
    const stripe = stripeAccount();
    // Stripe non crea la sessione: nessun indirizzo al cliente, il posto si libera subito.
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) =>
      new URL(String(input)).pathname === "/v1/checkout/sessions"
        ? Response.json({ error: { type: "api_error" } }, { status: 500 })
        : stripe.fetcher(input, init),
    );
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(
      await startCheckout(
        env,
        { request, userId, email: "lifetime@example.invalid", offer: "lifetime", language: "it" },
        at(now),
      ),
    ).toEqual({ ok: false, reason: "unavailable" });
    expect(await allocations()).toEqual([]);
    vi.mocked(globalThis.fetch).mockRestore();

    // Sessione aperta oltre la scadenza: il cron la chiude e libera il posto, non prima.
    await buyLifetime(stripe);
    await reconcileBilling(env, stripe.fetcher, at("2026-09-13T20:50:00.000Z"));
    expect(await allocations()).toHaveLength(1);
    await reconcileBilling(env, stripe.fetcher, at("2026-09-13T21:01:00.000Z"));
    expect(stripe.state.sessions[0]!.status).toBe("expired");
    expect(await allocations()).toEqual([]);

    // Crash fra prenotazione e sessione: senza sessione legata il posto scade con la prenotazione.
    await env.DB.prepare(`INSERT INTO lifetime_allocations (slot, workspace_id, status, expires_at,
        created_at) VALUES (1, 'w-a', 'reserved', ?, ?)`)
      .bind(reservationEnd, now)
      .run();
    await reconcileBilling(env, stripe.fetcher, at("2026-09-13T20:30:00.000Z"));
    expect(await allocations()).toHaveLength(1);
    await reconcileBilling(env, stripe.fetcher, at(reservationEnd));
    expect(await allocations()).toEqual([]);

    // Una sessione precedente ancora aperta si chiude prima di aprirne un'altra sullo stesso posto.
    await buyLifetime(stripe);
    await buyLifetime(stripe, userId, "2026-09-13T20:10:00.000Z");
    expect(stripe.state.sessions.slice(-2).map((session) => session.status)).toEqual([
      "expired",
      "open",
    ]);
    expect(await allocations()).toEqual([
      expect.objectContaining({ slot: 1, provider_reference: stripe.state.sessions.at(-1)!.id }),
    ]);
    // Il webhook della sessione chiusa non tocca la nuova prenotazione.
    await event(stripe, "checkout.session.expired", stripe.state.sessions.at(-2)!.id);
    expect(await allocations()).toHaveLength(1);

    // Pagamento confermato senza posto, dopo una liberazione: occupa il primo libero; a posti
    // finiti si segnala all'assistenza senza diritto né rimborso automatico.
    await env.DB.prepare("DELETE FROM lifetime_allocations").run();
    stripe.settle(stripe.state.sessions.at(-1)!.id, "paid");
    await reconcileBilling(env, stripe.fetcher, at("2026-09-13T21:30:00.000Z"));
    expect(await allocations()).toEqual([expect.objectContaining({ slot: 1, status: "active" })]);
    expect(await lifetimes()).toHaveLength(1);
    await resetDatabase();
    await env.DB.prepare("DELETE FROM workspace_entitlements").run();
    ({ userId } = await verifiedSession("lifetime-senza-posto@example.invalid"));
    await workspace(userId);
    await taken(20);
    log.mockClear();
    await event(stripe, "checkout.session.completed", stripe.state.sessions.at(-1)!.id);
    expect(await lifetimes()).toEqual([]);
    expect(await allocations()).toHaveLength(20);
    expect(JSON.parse(String(log.mock.calls.at(-1)?.[0]))).toMatchObject({
      operation: "billing",
      failure: "lifetime_unallocated",
    });
  });

  it("passa al lifetime detraendo il periodo pagato non usato e chiude l'abbonamento", async () => {
    const stripe = stripeAccount();
    stripe.state.invoices = [firstInvoice];
    await event(stripe, "customer.subscription.created", "sub_test");
    const halfway = "2026-09-28T20:00:00.000Z";
    expect((await lifetimeContext(env.DB, env, userId, at(halfway)))?.offer).toEqual({
      state: "available",
      credit: 245,
      replaces: true,
    });
    // Con il rinnovo prima della scadenza del checkout il credito non sarebbe esatto.
    expect(await buyLifetime(stripe, userId, "2026-10-13T19:30:00.000Z")).toEqual({
      ok: false,
      reason: "renewing",
    });
    expect(await allocations()).toEqual([]);

    expect(await buyLifetime(stripe, userId, halfway)).toMatchObject({ ok: true });
    expect(stripe.state.coupons).toEqual([
      expect.objectContaining({
        amount_off: "245",
        currency: "eur",
        duration: "once",
        max_redemptions: "1",
        redeem_by: String(second(halfway) + 3600),
        "applies_to[products][0]": "prod_lifetime",
        name: "Periodo pagato non usato",
        "metadata[workspace_id]": "w-a",
      }),
    ]);
    const body = stripe.writes.find((write) => write.path === "/v1/checkout/sessions")!.body;
    expect(body.get("discounts[0][coupon]")).toBe("coupon_1");
    expect(body.get("customer")).toBe("cus_test");
    expect(body.get("customer_email")).toBeNull();
    expect(body.get("customer_creation")).toBeNull();

    stripe.settle("cs_lifetime_1", "paid", halfway);
    await event(stripe, "checkout.session.completed", "cs_lifetime_1", halfway);
    expect(stripe.requests).toContain("DELETE /v1/subscriptions/sub_test");
    expect(
      await env.DB.prepare("SELECT status FROM stripe_subscriptions WHERE id = 'sub_test'").first(),
    ).toEqual({ status: "canceled" });
    expect(await view(halfway)).toEqual({ premium: { period: "lifetime", renewsAt: null } });
    // Il portale apre i documenti del cliente del lifetime.
    vi.spyOn(globalThis, "fetch").mockImplementation(stripe.fetcher);
    await openBillingPortal(env, userId, "https://test.fiscalbay.it/piano", "it");
    expect(stripe.writes.at(-1)!.body.get("customer")).toBe("cus_test");
  });

  it("durante la prova il lifetime si paga subito e chiude l'abbonamento scelto", async () => {
    const stripe = stripeAccount();
    const trialEnd = (await startTrial(env.DB, userId, at(now)))!;
    stripe.state.subscription = { status: "trialing", start: now, end: trialEnd };
    await event(stripe, "customer.subscription.created", "sub_test");
    expect((await purchaseState(env.DB, userId))?.state).toBe("covered");
    expect((await lifetimeContext(env.DB, env, userId))?.offer).toEqual({
      state: "available",
      credit: 0,
      replaces: true,
    });
    await buyLifetime(stripe);
    expect(stripe.state.coupons).toEqual([]);
    stripe.settle("cs_lifetime_1", "paid");
    await event(stripe, "checkout.session.completed", "cs_lifetime_1");
    expect(stripe.state.subscription.status).toBe("canceled");
    const allowance = (await orderAllowance(env.DB, userId))!;
    expect(allowance.coverage).toEqual({ source: "lifetime", endsAt: null });
    expect(accountCoverage(allowance)).toEqual({});
  });

  it("concede il lifetime in omaggio consumando un posto, con autore e motivo", async () => {
    const stripe = stripeAccount();
    stripe.state.invoices = [firstInvoice];
    await event(stripe, "customer.subscription.created", "sub_test");
    vi.spyOn(globalThis, "fetch").mockImplementation(stripe.fetcher);
    const grant = (workspaceId: string, reason = "Collaborazione") =>
      grantLifetimeConcession(env, { workspaceId, author: "admin-1", reason }, at(now));
    expect(await grant("w-a", " ")).toBe("invalid");
    expect(await grant("w-inesistente")).toBe("not_found");
    expect(await grant("w-a")).toBe("done");
    expect(await grant("w-a")).toBe("owned");
    expect(await allocations()).toEqual([
      expect.objectContaining({ slot: 1, workspace_id: "w-a", status: "active", kind: "gift" }),
    ]);
    expect(await lifetimes()).toEqual([
      expect.objectContaining({
        workspace_id: "w-a",
        stripe_checkout_session_id: null,
        amount_paid: null,
        granted_by: "admin-1",
        grant_reason: "Collaborazione",
      }),
    ]);
    expect(stripe.state.subscription.status).toBe("canceled");
    expect(await view()).toEqual({
      premium: { period: "lifetime", renewsAt: null, granted: true },
    });
    // A posti finiti l'omaggio non supera il tetto.
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO workspaces (id, name, created_at) VALUES ('w-b', 'Altro', ?)",
      ).bind(now),
      ...Array.from({ length: 19 }, (_, index) =>
        env.DB.prepare(`INSERT INTO lifetime_allocations (slot, status, activated_at, created_at)
          VALUES (?1, 'active', ?2, ?2)`).bind(index + 2, now),
      ),
    ]);
    expect(await grant("w-b")).toBe("sold-out");
  });

  it("concede Premium dopo la copertura in corso e ne rinvia il rinnovo", async () => {
    const stripe = stripeAccount();
    vi.spyOn(globalThis, "fetch").mockImplementation(stripe.fetcher);
    const grant = (days: number, time = now) =>
      grantPremium(
        env,
        { workspaceId: "w-a", author: "admin-1", reason: "Disservizio", days },
        at(time),
      );
    for (const days of [0, 1.5, 367]) expect(await grant(days)).toEqual({ result: "invalid" });
    expect(
      await grantPremium(env, { workspaceId: "w-a", author: "", reason: "Disservizio", days: 3 }),
    ).toEqual({ result: "invalid" });

    // Senza abbonamento: da subito, con la fine nel piano e senza gestione su Stripe.
    expect(await grant(10)).toEqual({
      result: "done",
      startsAt: now,
      endsAt: "2026-09-23T20:00:00.000Z",
    });
    expect(await view()).toEqual({ grant: { endsAt: "2026-09-23T20:00:00.000Z" } });
    expect(stripe.writes).toEqual([]);
    // Una seconda concessione si accoda alla prima.
    expect(await grant(5)).toMatchObject({
      startsAt: "2026-09-23T20:00:00.000Z",
      endsAt: "2026-09-28T20:00:00.000Z",
    });

    // Con un abbonamento che si rinnova: dopo il periodo pagato, con il rinnovo rinviato.
    await env.DB.prepare("DELETE FROM workspace_entitlements").run();
    stripe.state.invoices = [firstInvoice];
    await event(stripe, "customer.subscription.created", "sub_test");
    expect(await grant(7)).toEqual({
      result: "done",
      startsAt: periodEnd,
      endsAt: "2026-10-20T20:00:00.000Z",
    });
    const update = stripe.writes.find((write) => write.path === "/v1/subscriptions/sub_test")!;
    expect(update.body.get("trial_end")).toBe(String(second("2026-10-20T20:00:00.000Z")));
    expect(update.body.get("proration_behavior")).toBe("none");
    expect(update.body.has("items[0][price]")).toBe(false);
    // Durante la concessione il piano indica il rinnovo rinviato; nessun incasso figura.
    expect(await view("2026-10-15T00:00:00.000Z")).toEqual({
      premium: { period: "monthly", renewsAt: "2026-10-20T20:00:00.000Z" },
    });
    expect(
      (
        await env.DB.prepare(
          "SELECT amount_paid, stripe_invoice_id FROM workspace_entitlements WHERE source = 'admin'",
        ).all()
      ).results,
    ).toEqual([{ amount_paid: null, stripe_invoice_id: null }]);

    // Un rinnovo disdetto non si riattiva: la concessione prolunga soltanto il diritto.
    await env.DB.prepare("DELETE FROM workspace_entitlements WHERE source = 'admin'").run();
    stripe.state.subscription = {
      status: "active",
      start: periodStart,
      end: periodEnd,
      cancel: true,
    };
    await event(stripe, "customer.subscription.updated", "sub_test");
    stripe.writes.length = 0;
    expect(await grant(7)).toMatchObject({ endsAt: "2026-10-20T20:00:00.000Z" });
    expect(stripe.writes).toEqual([]);
    expect(await view("2026-09-20T00:00:00.000Z")).toEqual({
      premium: { period: "monthly", renewsAt: null, endsAt: "2026-10-20T20:00:00.000Z" },
    });
  });
});

describe("Rimborsi, dispute e cancellazioni finanziarie", () => {
  let userId: string;
  let cookie: string;
  const at = (iso: string) => new Date(iso);
  const renewal = {
    id: "in_renewal",
    start: periodEnd,
    end: nextEnd,
    amount: 598,
    paidAt: periodEnd,
  };
  /** Addebito riuscito della fattura, del cliente dell'abbonamento. */
  const paid = (invoice: string, amount = 598): FakeCharge => ({
    id: `ch_${invoice}`,
    paymentIntent: `pi_${invoice}`,
    customer: "cus_test",
    amount,
    created: second(now),
    refunds: [],
  });
  const event = (stripe: ReturnType<typeof stripeAccount>, topic: string, id: string, time = now) =>
    applyStripeEvent(env, { topic, objectId: id }, stripe.fetcher, at(time));
  const entitlements = async () =>
    (
      await env.DB.prepare(
        `SELECT source, stripe_invoice_id, revoked_at, revocation, amount_refunded
          FROM workspace_entitlements ORDER BY julianday(starts_at), source`,
      ).all()
    ).results;
  const premium = async (time: string) => (await orderAllowance(env.DB, userId, at(time)))!.premium;
  const view = async (time: string) => {
    const allowance = (await orderAllowance(env.DB, userId, at(time)))!;
    return subscriptionView(env.DB, env, "w-a", allowance.coverage, at(time));
  };
  const logged = (errors: { mock: { calls: unknown[][] } }) =>
    errors.mock.calls.map(([line]) => JSON.parse(String(line)) as Record<string, unknown>);
  const signals = (errors: { mock: { calls: unknown[][] } }) =>
    errors.mock.calls.map(([line]) => (JSON.parse(String(line)) as { failure?: string }).failure);

  beforeEach(async () => {
    await resetDatabase();
    await env.DB.batch([
      env.DB.prepare("DELETE FROM stripe_subscriptions"),
      env.DB.prepare("DELETE FROM workspace_entitlements"),
      env.DB.prepare("DELETE FROM stripe_customer_erasures"),
    ]);
    ({ userId, cookie } = await verifiedSession(`rimborsi-${crypto.randomUUID()}@example.invalid`));
    await workspace(userId);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("un rimborso totale revoca soltanto la copertura che ha pagato", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const stripe = stripeAccount();
    stripe.state.subscription = { status: "active", start: periodEnd, end: nextEnd };
    stripe.state.invoices = [firstInvoice, renewal];
    // Il rinnovo riuscito al secondo tentativo, dopo uno fallito con lo stesso payment intent,
    // e un addebito senza payment intent.
    stripe.state.charges = [
      paid("in_first"),
      paid("in_renewal"),
      { ...paid("in_renewal"), id: "ch_in_renewal_failed", failed: true },
      { ...paid("in_legacy"), paymentIntent: null },
    ];
    // Diritti indipendenti: la prova conclusa e Premium concesso dopo il rinnovo.
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO workspace_entitlements (id, workspace_id, source, starts_at,
          ends_at) VALUES ('trial', 'w-a', 'trial', '2026-08-30T20:00:00.000Z', ?)`).bind(now),
      env.DB.prepare(`INSERT INTO workspace_entitlements (id, workspace_id, source, starts_at,
          ends_at, granted_by, grant_reason)
        VALUES ('admin', 'w-a', 'admin', ?, '2026-11-20T20:00:00.000Z', 'owner', 'Disservizio')`).bind(
        nextEnd,
      ),
    ]);
    await event(stripe, "invoice.paid", "in_renewal", "2026-10-13T21:00:00.000Z");
    expect(await premium("2026-10-20T10:00:00.000Z")).toBe(true);

    stripe.state.charges[1]!.refunds.push({ amount: 598, status: "succeeded" });
    const refundedAt = "2026-10-20T10:00:00.000Z";
    await event(stripe, "charge.refunded", "ch_in_renewal", refundedAt);
    const expected = [
      {
        source: "trial",
        stripe_invoice_id: null,
        revoked_at: null,
        revocation: null,
        amount_refunded: null,
      },
      {
        source: "premium",
        stripe_invoice_id: "in_first",
        revoked_at: null,
        revocation: null,
        amount_refunded: null,
      },
      {
        source: "premium",
        stripe_invoice_id: "in_renewal",
        revoked_at: refundedAt,
        revocation: "refund",
        amount_refunded: 598,
      },
      {
        source: "admin",
        stripe_invoice_id: null,
        revoked_at: null,
        revocation: null,
        amount_refunded: null,
      },
    ];
    expect(await entitlements()).toEqual(expected);
    // Il periodo rimborsato torna Free; la concessione successiva resta.
    expect(await premium("2026-10-20T11:00:00.000Z")).toBe(false);
    expect(await premium("2026-11-14T20:00:00.000Z")).toBe(true);

    // Eventi duplicati, fuori ordine e la rete del cron non spostano la revoca.
    await event(stripe, "charge.refund.updated", "re_ch_in_renewal_0", "2026-10-21T10:00:00.000Z");
    await event(stripe, "charge.refunded", "ch_in_renewal", "2026-10-19T10:00:00.000Z");
    await event(stripe, "invoice.paid", "in_renewal", "2026-10-22T10:00:00.000Z");
    await reconcileBilling(env, stripe.fetcher, at("2026-10-23T10:00:00.000Z"));
    expect(await entitlements()).toEqual(expected);
    // Un rimborso totale non è parziale: nessuna segnalazione.
    expect(errors).not.toHaveBeenCalled();
  });

  it("un rimborso parziale, in corso o fallito non revoca e non diventa giorni", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const stripe = stripeAccount();
    stripe.state.invoices = [firstInvoice];
    stripe.state.charges = [paid("in_first")];
    await event(stripe, "invoice.paid", "in_first");
    const coverage = async () =>
      env.DB.prepare(
        "SELECT ends_at, revoked_at, amount_refunded FROM workspace_entitlements WHERE stripe_invoice_id = 'in_first'",
      ).first();

    stripe.state.charges[0]!.refunds.push({ amount: 200, status: "succeeded" });
    await event(stripe, "charge.refunded", "ch_in_first", "2026-09-20T10:00:00.000Z");
    expect(await coverage()).toEqual({
      ends_at: periodEnd,
      revoked_at: null,
      amount_refunded: 200,
    });
    // Una segnalazione per l'assistenza: un'etichetta fissa, senza importi né riferimenti.
    expect(logged(errors)).toEqual([
      {
        event: "application_error",
        code: "INVALID_REQUEST",
        operation: "billing",
        failure: "partial_refund",
      },
    ]);

    // Il resto, ancora in corso: nessuna revoca finché Stripe non lo conferma.
    stripe.state.charges[0]!.refunds.push({ amount: 398, status: "pending" });
    await event(stripe, "charge.refunded", "ch_in_first", "2026-09-21T10:00:00.000Z");
    expect(await coverage()).toEqual({
      ends_at: periodEnd,
      revoked_at: null,
      amount_refunded: 200,
    });
    expect(await premium("2026-09-21T11:00:00.000Z")).toBe(true);
    // Fallito: il periodo resta pagato.
    stripe.state.charges[0]!.refunds[1]!.status = "failed";
    await event(stripe, "charge.refund.updated", "re_ch_in_first_1", "2026-09-22T10:00:00.000Z");
    expect(await coverage()).toEqual({
      ends_at: periodEnd,
      revoked_at: null,
      amount_refunded: 200,
    });
    // Riuscito in un secondo tentativo: l'intero importo è restituito e la copertura si revoca.
    stripe.state.charges[0]!.refunds.push({ amount: 398, status: "succeeded" });
    await event(stripe, "charge.refund.updated", "re_ch_in_first_2", "2026-09-23T10:00:00.000Z");
    expect(await coverage()).toEqual({
      ends_at: periodEnd,
      revoked_at: "2026-09-23T10:00:00.000Z",
      amount_refunded: 598,
    });
  });

  it("revoca anche quando il rimborso arriva prima della fattura e spiega il ritorno al Free", async () => {
    const stripe = stripeAccount();
    stripe.state.invoices = [firstInvoice];
    stripe.state.charges = [paid("in_first")];
    stripe.state.charges[0]!.refunds.push({ amount: 598, status: "succeeded" });
    await event(stripe, "charge.refunded", "ch_in_first", "2026-09-14T10:00:00.000Z");
    expect(await entitlements()).toEqual([
      {
        source: "premium",
        stripe_invoice_id: "in_first",
        revoked_at: "2026-09-14T10:00:00.000Z",
        revocation: "refund",
        amount_refunded: 598,
      },
    ]);
    expect(await premium("2026-09-14T11:00:00.000Z")).toBe(false);
    // L'abbonamento continua: Premium riprende con il rinnovo, senza prova né nuovo acquisto.
    expect(await view("2026-09-14T11:00:00.000Z")).toEqual({
      payment: { state: "refunded", renewsAt: periodEnd },
    });
    expect((await purchaseState(env.DB, userId, at("2026-09-14T11:00:00.000Z")))?.state).toBe(
      "covered",
    );
    expect(
      (await orderAllowance(env.DB, userId, at("2026-09-14T11:00:00.000Z")))?.trialAvailable,
    ).toBe(false);
    vi.setSystemTime(at("2026-09-14T11:00:00.000Z"));
    const page = (await settingsLoader({
      request: new Request("http://localhost:5173/app/impostazioni/piano", { headers: { cookie } }),
      params: { sezione: "piano" },
    } as unknown as Parameters<typeof settingsLoader>[0])) as {
      page: { account: Record<string, unknown> };
    };
    expect(page.page.account).toMatchObject({
      plan: "free",
      payment: { state: "refunded", renewsAt: periodEnd },
    });
    vi.useRealTimers();
    // Un periodo rimborsato non è un pagamento da confermare: il cron non lo rilegge ogni ora.
    stripe.requests.length = 0;
    await reconcileBilling(env, stripe.fetcher, at("2026-09-14T13:00:00.000Z"));
    expect(stripe.requests).toEqual(["GET /v1/checkout/sessions"]);
    // Disdetto: nessun rinnovo da annunciare.
    stripe.state.subscription.cancel = true;
    await event(stripe, "customer.subscription.updated", "sub_test", "2026-09-15T10:00:00.000Z");
    expect(await view("2026-09-15T11:00:00.000Z")).toEqual({ payment: { state: "refunded" } });
    // Dopo il periodo rimborsato nessun avviso resta.
    stripe.state.subscription.status = "canceled";
    await event(stripe, "customer.subscription.deleted", "sub_test", periodEnd);
    expect(await view("2026-10-14T00:00:00.000Z")).toEqual({});
  });

  it("una disputa aperta o vinta non revoca, una persa revoca la sola copertura", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const stripe = stripeAccount();
    stripe.state.invoices = [firstInvoice];
    stripe.state.charges = [paid("in_first")];
    await event(stripe, "invoice.paid", "in_first");
    stripe.state.charges[0]!.dispute = "needs_response";
    await event(stripe, "charge.dispute.created", "du_ch_in_first", "2026-09-20T10:00:00.000Z");
    expect(await premium("2026-09-20T11:00:00.000Z")).toBe(true);
    expect(signals(errors)).toEqual(["dispute_opened"]);
    stripe.state.charges[0]!.dispute = "won";
    await event(stripe, "charge.dispute.closed", "du_ch_in_first", "2026-09-25T10:00:00.000Z");
    expect(await premium("2026-09-25T11:00:00.000Z")).toBe(true);

    stripe.state.charges[0]!.dispute = "lost";
    await event(stripe, "charge.dispute.closed", "du_ch_in_first", "2026-09-26T10:00:00.000Z");
    expect(await entitlements()).toEqual([
      {
        source: "premium",
        stripe_invoice_id: "in_first",
        revoked_at: "2026-09-26T10:00:00.000Z",
        revocation: "dispute",
        amount_refunded: null,
      },
    ]);
    expect(signals(errors)).toEqual(["dispute_opened", "dispute_lost"]);
    expect(await premium("2026-09-26T11:00:00.000Z")).toBe(false);
  });

  it("un evento di rimborso senza un nostro pagamento non ha effetti", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const stripe = stripeAccount();
    stripe.state.charges = [{ ...paid("in_other"), customer: "cus_other" }];
    // Il rimborso è fallito: nulla di restituito e nessuna segnalazione.
    stripe.state.charges[0]!.refunds.push({ amount: 598, status: "failed" });
    await event(stripe, "charge.refunded", "ch_in_other");
    expect(errors).not.toHaveBeenCalled();
    expect(stripe.requests).toEqual([
      "GET /v1/charges/ch_in_other",
      "GET /v1/invoice_payments",
      "GET /v1/checkout/sessions",
    ]);
    expect(await entitlements()).toEqual([]);
  });

  it("dopo la cancellazione su Link conserva coperture e spazio e non usa più il cliente", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const stripe = stripeAccount();
    stripe.state.invoices = [firstInvoice];
    stripe.state.charges = [paid("in_first")];
    await event(stripe, "invoice.paid", "in_first");
    // Un cliente ancora presente su Stripe o di altri spazi non si registra.
    stripe.state.deletedCustomers = ["cus_unknown"];
    await event(stripe, "customer.deleted", "cus_test");
    await event(stripe, "customer.deleted", "cus_unknown");
    expect((await env.DB.prepare("SELECT * FROM stripe_customer_erasures").all()).results).toEqual(
      [],
    );

    // Stripe chiude l'abbonamento e cancella il cliente.
    stripe.state.subscription.status = "canceled";
    stripe.state.deletedCustomers = ["cus_test"];
    stripe.requests.length = 0;
    await event(stripe, "customer.deleted", "cus_test", "2026-09-20T10:00:00.000Z");
    expect(
      await env.DB.prepare(
        "SELECT customer_id, environment, source, received_at FROM stripe_customer_erasures",
      ).first(),
    ).toEqual({
      customer_id: "cus_test",
      environment: "test",
      source: "webhook",
      received_at: "2026-09-20T10:00:00.000Z",
    });
    // L'abbonamento si rilegge chiuso, senza leggere gli addebiti cancellati.
    expect(stripe.requests).toEqual([
      "GET /v1/customers/cus_test",
      "GET /v1/subscriptions/sub_test",
      "GET /v1/invoices",
    ]);
    expect(
      await env.DB.prepare("SELECT status FROM stripe_subscriptions WHERE id = 'sub_test'").first(),
    ).toEqual({ status: "canceled" });
    expect(signals(errors)).toEqual(["financial_erasure"]);
    // La copertura pagata e lo spazio restano; il portale e il passaggio a vita non usano più
    // il cliente.
    expect(await premium("2026-09-20T11:00:00.000Z")).toBe(true);
    expect(await env.DB.prepare("SELECT id FROM workspaces WHERE id = 'w-a'").first()).toEqual({
      id: "w-a",
    });
    expect(
      await openBillingPortal(env, userId, "http://localhost:5173/app/impostazioni/piano", "it"),
    ).toBeNull();
    expect((await lifetimeContext(env.DB, env, userId))?.subscription).toMatchObject({
      customerId: null,
    });
    // Ripetuto, l'evento non duplica né aggiorna la registrazione.
    await event(stripe, "customer.deleted", "cus_test", "2026-09-21T10:00:00.000Z");
    expect(
      (await env.DB.prepare("SELECT received_at FROM stripe_customer_erasures").all()).results,
    ).toEqual([{ received_at: "2026-09-20T10:00:00.000Z" }]);
    expect(signals(errors)).toEqual(["financial_erasure"]);
    // Un cliente che Stripe non restituisce più vale come cancellato.
    await env.DB.prepare("DELETE FROM stripe_customer_erasures").run();
    stripe.state.deletedCustomers = [];
    stripe.state.missingCustomers = ["cus_test"];
    await event(stripe, "customer.deleted", "cus_test", "2026-09-22T10:00:00.000Z");
    expect(
      (await env.DB.prepare("SELECT received_at FROM stripe_customer_erasures").all()).results,
    ).toEqual([{ received_at: "2026-09-22T10:00:00.000Z" }]);
    // In Production vale per i clienti degli abbonamenti live.
    await env.DB.prepare("DELETE FROM stripe_customer_erasures").run();
    await env.DB.prepare(`INSERT INTO stripe_subscriptions (id, workspace_id, environment,
        customer_id, offer, price_generation, status, current_period_start, current_period_end,
        cancel_at_period_end, synced_at, checked_at, renewal_offer)
      VALUES ('sub_live', 'w-a', 'live', 'cus_live', 'monthly', '2026-09', 'canceled', ?1, ?2,
        0, ?1, ?1, 'monthly')`)
      .bind(now, periodEnd)
      .run();
    stripe.state.missingCustomers = ["cus_live"];
    const live = { ...env, APP_ORIGIN: "https://fiscalbay.it", STRIPE_SECRET_KEY: liveKey } as Env;
    await applyStripeEvent(
      live,
      { topic: "customer.deleted", objectId: "cus_live" },
      stripe.fetcher,
    );
    expect(
      await env.DB.prepare("SELECT environment FROM stripe_customer_erasures").first(),
    ).toEqual({ environment: "live" });
    // Stripe non disponibile: la ricevuta si ripete, nulla si registra.
    await env.DB.prepare("DELETE FROM stripe_customer_erasures").run();
    stripe.state.down = true;
    await expect(event(stripe, "customer.deleted", "cus_test")).rejects.toMatchObject({
      failure: "unavailable",
    });
    expect((await env.DB.prepare("SELECT * FROM stripe_customer_erasures").all()).results).toEqual(
      [],
    );
  });

  it("conserva il motivo della revoca e le cancellazioni registrate", async () => {
    await env.DB.prepare(`INSERT INTO workspace_entitlements (id, workspace_id, source, starts_at,
        ends_at) VALUES ('pagato', 'w-a', 'premium', ?1, ?2)`)
      .bind(now, "2026-10-20T20:00:00.000Z")
      .run();
    // La revoca richiede l'istante e, una volta registrata, non cambia motivo né si annulla.
    await expect(
      env.DB.prepare("UPDATE workspace_entitlements SET revocation = 'refund'").run(),
    ).rejects.toThrow();
    await env.DB.prepare("UPDATE workspace_entitlements SET revocation = 'refund', revoked_at = ?")
      .bind(now)
      .run();
    for (const change of ["revocation = 'dispute'", "revocation = NULL"])
      await expect(
        env.DB.prepare(`UPDATE workspace_entitlements SET ${change}`).run(),
      ).rejects.toThrow();
    await expect(
      env.DB.prepare("UPDATE workspace_entitlements SET revocation = 'altro'").run(),
    ).rejects.toThrow();
    // Una cancellazione segnalata all'assistenza registra autore e motivo e resta com'è.
    const erasure = (source: string, by: string | null, reason: string | null) =>
      env.DB.prepare(`INSERT INTO stripe_customer_erasures (customer_id, environment, source,
          received_at, recorded_by, reason) VALUES (?, 'test', ?, ?, ?, ?)`).bind(
        `cus_${source}_${by}`,
        source,
        now,
        by,
        reason,
      );
    await expect(erasure("support", null, null).run()).rejects.toThrow("CHECK constraint failed");
    await expect(erasure("webhook", "owner", "Richiesta").run()).rejects.toThrow(
      "CHECK constraint failed",
    );
    await erasure("support", "owner", "Richiesta tramite Link").run();
    await expect(
      env.DB.prepare("UPDATE stripe_customer_erasures SET reason = 'altro'").run(),
    ).rejects.toThrow("immutable_erasure");
  });

  it("senza l'elenco degli addebiti la rilettura continua e non revoca", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const stripe = stripeAccount();
    stripe.state.invoices = [firstInvoice];
    stripe.state.charges = [paid("in_first")];
    stripe.state.charges[0]!.refunds.push({ amount: 598, status: "succeeded" });
    // Stripe non disponibile: la ricevuta si ripete senza scrivere nulla.
    stripe.state.chargesDown = true;
    await expect(event(stripe, "invoice.paid", "in_first")).rejects.toMatchObject({
      failure: "unavailable",
    });
    expect(await entitlements()).toEqual([]);
    stripe.state.chargesDown = false;
    // Non più disponibile: la copertura si registra, senza revoca.
    stripe.state.chargesMissing = true;
    await event(stripe, "invoice.paid", "in_first");
    expect(await entitlements()).toEqual([
      {
        source: "premium",
        stripe_invoice_id: "in_first",
        revoked_at: null,
        revocation: null,
        amount_refunded: null,
      },
    ]);
    expect(logged(errors)).toEqual([
      expect.objectContaining({ operation: "billing", failure: "rejected" }),
    ]);
    // Torna disponibile: la stessa rilettura revoca.
    stripe.state.chargesMissing = false;
    await event(stripe, "invoice.paid", "in_first", "2026-09-14T10:00:00.000Z");
    expect(await entitlements()).toEqual([
      expect.objectContaining({ revoked_at: "2026-09-14T10:00:00.000Z", revocation: "refund" }),
    ]);
  });

  it("alla cancellazione dell'account ferma i rinnovi e lo conferma soltanto con Stripe", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const stripe = stripeAccount();
    const missing = { ...env, STRIPE_SECRET_KEY: undefined } as Env;
    // Senza abbonamenti nulla da fermare, anche senza Stripe.
    expect(await stopRenewals(env, "w-a", stripe.fetcher, at(now))).toBe(true);
    expect(await stopRenewals(missing, "w-a", stripe.fetcher, at(now))).toBe(true);
    expect(stripe.requests).toEqual([]);
    stripe.state.invoices = [firstInvoice];
    await event(stripe, "invoice.paid", "in_first");
    // Senza chiave nulla si può confermare: il job ripete, senza errori da registrare.
    expect(await stopRenewals(missing, "w-a", stripe.fetcher, at(now))).toBe(false);
    expect(errors).not.toHaveBeenCalled();
    stripe.state.down = true;
    expect(await stopRenewals(env, "w-a", stripe.fetcher, at(now))).toBe(false);
    expect(logged(errors)).toEqual([
      expect.objectContaining({ operation: "billing", failure: "unavailable" }),
    ]);
    stripe.state.down = false;
    stripe.requests.length = 0;
    expect(await stopRenewals(env, "w-a", stripe.fetcher, at("2026-09-14T10:00:00.000Z"))).toBe(
      true,
    );
    expect(stripe.requests).toEqual([
      "GET /v1/subscriptions/sub_test",
      "DELETE /v1/subscriptions/sub_test",
    ]);
    expect(
      await env.DB.prepare("SELECT status FROM stripe_subscriptions WHERE id = 'sub_test'").first(),
    ).toEqual({ status: "canceled" });
    expect(await subscriptionRenews(env.DB, env, userId)).toBe(false);
    // Già fermo: nessuna nuova richiesta. Un abbonamento sparito da Stripe non addebita.
    stripe.requests.length = 0;
    expect(await stopRenewals(env, "w-a", stripe.fetcher, at(now))).toBe(true);
    expect(stripe.requests).toEqual([]);
    // Chiuso su Stripe ma non ancora in locale: si registra senza una seconda chiusura.
    await env.DB.prepare("UPDATE stripe_subscriptions SET status = 'active'").run();
    stripe.requests.length = 0;
    expect(await stopRenewals(env, "w-a", stripe.fetcher, at("2026-09-15T10:00:00.000Z"))).toBe(
      true,
    );
    expect(stripe.requests).toEqual(["GET /v1/subscriptions/sub_test"]);
    expect(
      await env.DB.prepare("SELECT status FROM stripe_subscriptions WHERE id = 'sub_test'").first(),
    ).toEqual({ status: "canceled" });
    // Un primo pagamento mai completato è già scaduto su Stripe: nessuna chiusura.
    await env.DB.prepare("UPDATE stripe_subscriptions SET status = 'incomplete'").run();
    stripe.state.subscription.status = "incomplete_expired";
    stripe.requests.length = 0;
    expect(await stopRenewals(env, "w-a", stripe.fetcher, at("2026-09-16T10:00:00.000Z"))).toBe(
      true,
    );
    expect(stripe.requests).toEqual(["GET /v1/subscriptions/sub_test"]);
    expect(
      await env.DB.prepare("SELECT status FROM stripe_subscriptions WHERE id = 'sub_test'").first(),
    ).toEqual({ status: "incomplete_expired" });
    await env.DB.prepare("UPDATE stripe_subscriptions SET status = 'active'").run();
    stripe.state.missing = true;
    expect(await stopRenewals(env, "w-a", stripe.fetcher, at(now))).toBe(true);
    expect(await env.DB.prepare("SELECT unavailable_at FROM stripe_subscriptions").first()).toEqual(
      { unavailable_at: now },
    );
  });

  it("l'avviso del rimborso segue lo stato dell'abbonamento", async () => {
    const later = "2026-09-20T10:00:00.000Z";
    const subscription = (status: string, cancel = 0) =>
      env.DB.prepare(`INSERT OR REPLACE INTO stripe_subscriptions (id, workspace_id, environment,
          customer_id, offer, price_generation, status, current_period_start, current_period_end,
          cancel_at_period_end, synced_at, checked_at, renewal_offer)
        VALUES ('sub_test', 'w-a', 'test', 'cus_test', 'monthly', '2026-09', ?1, ?2, ?3, ?4, ?2, ?2,
          'monthly')`)
        .bind(status, now, periodEnd, cancel)
        .run();
    await env.DB.prepare(`INSERT INTO workspace_entitlements (id, workspace_id, source, starts_at,
        ends_at, stripe_invoice_id, amount_paid, currency, paid_at, revoked_at, revocation)
      VALUES ('paid', 'w-a', 'premium', ?1, ?2, 'in_first', 598, 'eur', ?1, ?1, 'refund')`)
      .bind(now, periodEnd)
      .run();
    // Chiuso dopo il rimborso: nessun rinnovo da annunciare.
    expect(await view(later)).toEqual({ payment: { state: "refunded" } });
    // Cambio di periodicità programmato: Premium riprende comunque al rinnovo.
    await subscription("trialing");
    expect(await view(later)).toEqual({ payment: { state: "refunded", renewsAt: periodEnd } });
    // Rinnovo non riuscito: prevale la tutela del prezzo.
    await subscription("past_due");
    expect(await view(later)).toMatchObject({ payment: { state: "renewal-failed" } });
    // Dopo un lifetime rimborsato, un nuovo abbonamento da confermare prevale.
    await env.DB.prepare("DELETE FROM workspace_entitlements").run();
    await env.DB.prepare(`INSERT INTO lifetime_allocations (slot, workspace_id, status, kind,
        provider_reference, customer_id, completed_at, activated_at, created_at)
      VALUES (1, 'w-a', 'active', 'sale', 'cs_paid', 'cus_test', ?1, ?1, ?1)`)
      .bind(now)
      .run();
    await env.DB.prepare(`INSERT INTO workspace_entitlements (id, workspace_id, source, starts_at,
        stripe_checkout_session_id, amount_paid, currency, paid_at, revoked_at, revocation)
      VALUES ('lifetime', 'w-a', 'lifetime', ?1, 'cs_paid', 18178, 'eur', ?1, ?1, 'refund')`)
      .bind(now)
      .run();
    await subscription("active");
    expect(await view(later)).toEqual({ payment: { state: "pending" } });
    await env.DB.prepare("DELETE FROM stripe_subscriptions").run();
    expect(await view(later)).toEqual({ payment: { state: "refunded", lifetime: true } });
  });

  it("un evento di rimborso senza payment intent non legge altro", async () => {
    const stripe = stripeAccount();
    stripe.state.charges = [{ ...paid("in_first"), paymentIntent: null }];
    stripe.state.charges[0]!.refunds.push({ amount: 598, status: "succeeded" });
    await event(stripe, "charge.refunded", "ch_in_first");
    expect(stripe.requests).toEqual(["GET /v1/charges/ch_in_first"]);
  });
});
