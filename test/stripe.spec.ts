import { env } from "cloudflare:workers";
import Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { annualPaidMonths, firstChargeAt, formatPrice, priceGeneration } from "../app/catalog";
import { purchaseState, startCheckout } from "../app/domain/checkout.server";
import {
  buildManagedCheckoutParams,
  catalogMismatch,
  createManagedCheckout,
  createStripeClient,
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

  it("fa partire il primo addebito alla fine della prova, mai prima di due giorni", () => {
    // Prova lontana: il primo addebito coincide con la sua fine, al secondo intero.
    expect(firstChargeAt("2026-09-30T09:00:00.250Z", now)).toBe("2026-09-30T09:00:01.000Z");
    // Con meno di due giorni di prova Stripe non accetta la sessione: il cliente riceve il
    // minimo ammesso, due giorni e dieci minuti, e non perde giorni.
    expect(firstChargeAt("2026-09-14T08:00:00.000Z", now)).toBe("2026-09-15T20:10:00.000Z");
    expect(firstChargeAt("2026-09-15T20:10:00.000Z", now)).toBe("2026-09-15T20:10:00.000Z");
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
        expect(body.get("subscription_data[metadata][trial_ends_at]")).toBe(trialEndsAt);
        return body.get("subscription_data[trial_end]");
      } finally {
        api.mockRestore();
      }
    };
    // Il primo addebito è alla fine della prova.
    expect(await charge(new Date(now))).toBe(String(Date.parse(trialEndsAt) / 1000));
    // Nell'ultimo giorno della prova Stripe vuole almeno due giorni: il cliente non perde nulla.
    const late = new Date(Date.parse(trialEndsAt) - 5 * 60 * 60 * 1000);
    expect(await charge(late)).toBe(String(Date.parse(firstChargeAt(trialEndsAt, late)) / 1000));
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
