import { env } from "cloudflare:workers";
import Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildManagedCheckoutParams,
  createManagedCheckout,
  createStripeClient,
  verifyStripeEvent,
} from "../app/integrations/stripe.server";
import { action as checkoutAction } from "../app/routes/stripe-checkout";
import { receiveWebhook } from "../app/integrations/webhooks.server";

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

describe("Stripe Managed Payments", () => {
  it("rifiuta il checkout senza prezzo prima di usare Auth", async () => {
    const previous = env.STRIPE_PRICE_MONTHLY;
    env.STRIPE_PRICE_MONTHLY = "";
    try {
      const response = await checkoutAction({
        request: new Request("http://localhost:5173/stripe-checkout", {
          method: "POST",
          headers: {
            origin: "http://localhost:5173",
            "content-type": "application/x-www-form-urlencoded",
          },
          body: "offer=monthly",
        }),
      });
      expect(response.status).toBe(403);
      expect((await response.json()).code).toBe("FORBIDDEN");
    } finally {
      env.STRIPE_PRICE_MONTHLY = previous;
    }
  });

  it("crea soltanto parametri compatibili con Managed Payments", () => {
    const params = buildManagedCheckoutParams({
      offer: "monthly",
      priceId: "price_test_monthly",
      workspaceId: "workspace-test",
      email: "merchant@example.invalid",
      appOrigin: "https://test.fiscalbay.it",
    });

    expect(params).toEqual({
      mode: "subscription",
      line_items: [{ price: "price_test_monthly", quantity: 1 }],
      managed_payments: { enabled: true },
      client_reference_id: "workspace-test",
      integration_identifier: "fiscalbay_mp_qnwjrzta",
      customer_email: "merchant@example.invalid",
      metadata: { workspace_id: "workspace-test", offer: "monthly" },
      success_url:
        "https://test.fiscalbay.it/?checkout=processing&session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://test.fiscalbay.it/?checkout=cancelled",
    });
    expect(params).not.toHaveProperty("automatic_tax");
    expect(params).not.toHaveProperty("payment_method_types");
    expect(
      buildManagedCheckoutParams({
        offer: "lifetime",
        priceId: "price_test_lifetime",
        workspaceId: "workspace-test",
        email: "merchant@example.invalid",
        appOrigin: "https://test.fiscalbay.it",
      }).mode,
    ).toBe("payment");
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
      const client = createStripeClient("sk_test_transport");
      expect(transport).toHaveBeenCalledOnce();
      expect(
        await createManagedCheckout(client, {
          offer: "annual",
          priceId: "price_test_annual",
          workspaceId: "workspace-test",
          email: "merchant@example.invalid",
          appOrigin: "https://test.fiscalbay.it",
        }),
      ).toMatchObject(session);
      expect(request).toHaveBeenCalledOnce();
      const [url, options] = request.mock.calls[0]!;
      expect(new URL(String(url)).pathname).toBe("/v1/checkout/sessions");
      expect(options?.method).toBe("POST");
      expect(new Headers(options?.headers).get("authorization")).toBe("Bearer sk_test_transport");
      const body = new URLSearchParams(String(options?.body));
      expect(body.get("line_items[0][price]")).toBe("price_test_annual");
      expect(body.get("metadata[offer]")).toBe("annual");
    } finally {
      request.mockRestore();
      transport.mockRestore();
    }
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
    const environment = { ...env, WEBHOOK_QUEUE: { send } } as Env;
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
