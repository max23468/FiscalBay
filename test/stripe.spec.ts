import { env } from "cloudflare:workers";
import Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { annualPaidMonths, firstChargeAt, formatPrice, priceGeneration } from "../app/catalog";
import {
  applyStripeEvent,
  changeSubscriptionPeriod,
  openBillingPortal,
  paidCoverage,
  reconcileBilling,
  subscriptionRenews,
  subscriptionView,
} from "../app/domain/billing.server";
import { purchaseState, startCheckout } from "../app/domain/checkout.server";
import { orderAllowance, startTrial } from "../app/domain/grants.server";
import {
  buildManagedCheckoutParams,
  catalogMismatch,
  createManagedCheckout,
  createStripeClient,
  createStripeReader,
  isMissingObject,
  stripeRead,
  verifyStripeEvent,
} from "../app/integrations/stripe.server";
import { receiveWebhook } from "../app/integrations/webhooks.server";
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
      expect(paths(api)).toEqual([
        "GET /v1/prices/price_test_annual",
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
      // Il lifetime non è in vendita finché mancano le prenotazioni dei posti.
      expect(await buy(cookie, "lifetime")).toMatchObject({ init: { status: 400 } });
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
      purchase: { state: "needs-sync", offers: ["monthly", "annual"], checkout: null },
    });
    await workspace(userId);
    expect(await page("?checkout=processing&session_id=cs_test_checkout")).toMatchObject({
      account: { plan: "free" },
      purchase: { state: "available", checkout: "processing" },
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
  metadata?: Record<string, string>;
  livemode?: boolean;
  /** Prezzo del rinnovo; senza, quello della periodicità dei metadati. */
  price?: { id: string; interval: "month" | "year" };
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
    }>,
    sessions: [] as Array<{ id: string; mode: string; subscription: string | null }>,
    /** Inizio della finestra chiesta nell'ultimo elenco delle sessioni, in secondi. */
    sessionsSince: 0,
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
    metadata: state.subscription.metadata ?? {
      workspace_id: "w-a",
      offer: "monthly",
      price_generation: "2026-09",
    },
    items: {
      object: "list",
      data: [
        {
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
        },
      ],
    },
  });
  const invoice = (paid: (typeof state.invoices)[number]) => ({
    id: paid.id,
    object: "invoice",
    status: "paid",
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
    if (state.down) return Response.json({ error: { type: "api_error" } }, { status: 503 });
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
      // Cambio di periodicità: prezzo del rinnovo, fine del periodo pagato e metadati.
      const body = writes.at(-1)!.body;
      const price = prices.find((candidate) => candidate.id === body.get("items[0][price]"))!;
      state.subscription.price = {
        id: price.id,
        interval: price.recurring!.interval as "month" | "year",
      };
      state.subscription.status = "trialing";
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
      return list(prices);
    }
    if (url.pathname === "/v1/billing_portal/sessions")
      return Response.json({
        object: "billing_portal.session",
        url: "https://billing.example.invalid/p/session_test",
      });
    if (url.pathname === "/v1/invoices") {
      expect(url.searchParams.get("subscription")).toBe("sub_test");
      expect(url.searchParams.get("status")).toBe("paid");
      return list(state.invoices.filter((paid) => !paid.orphan).map(invoice));
    }
    if (url.pathname.startsWith("/v1/invoices/"))
      return Response.json(invoice(state.invoices.find((paid) => url.pathname.endsWith(paid.id))!));
    if (url.pathname === "/v1/checkout/sessions") {
      expect(url.searchParams.get("status")).toBe("complete");
      state.sessionsSince = Number(url.searchParams.get("created[gte]"));
      return list(state.sessions.map((session) => ({ object: "checkout.session", ...session })));
    }
    if (url.pathname.startsWith("/v1/checkout/sessions/"))
      return Response.json({
        object: "checkout.session",
        ...state.sessions.find((session) => url.pathname.endsWith(session.id)),
      });
    throw new Error("unexpected_stripe_request");
  });
  return { state, fetcher, requests, writes, prices };
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

  it("in Production registra gli abbonamenti live", async () => {
    const stripe = stripeAccount();
    stripe.state.subscription.livemode = true;
    stripe.state.invoices = [firstInvoice];
    const live = { ...env, APP_ORIGIN: "https://fiscalbay.it" } as Env;
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
      ["admin", {}],
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
    // Il cron rilegge l'abbonamento alla fine della tutela, anche senza webhook.
    await reconcileBilling(env, stripe.fetcher, at("2026-10-20T20:00:00.000Z"));
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
    stripe.state.sessions = [];
    stripe.requests.length = 0;
    await reconcileBilling(env, stripe.fetcher, at("2026-10-13T20:10:00.000Z"));
    expect(stripe.requests).toEqual([
      "GET /v1/checkout/sessions",
      "GET /v1/subscriptions/sub_test",
      "GET /v1/invoices",
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
      startsAt: now,
      endsAt: nextEnd,
      amountPaid: 1200,
      currency: "eur",
      paidAt: now,
    });
    const only = (...data: unknown[]) => ({ ...invoice, lines: { data } }) as Stripe.Invoice;
    expect(paidCoverage({ ...invoice, status: "open" } as Stripe.Invoice)).toBeNull();
    expect(paidCoverage(only(invoice.lines.data[0]))).toBeNull();
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
