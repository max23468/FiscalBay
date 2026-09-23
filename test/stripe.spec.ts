import { env } from "cloudflare:workers";
import Stripe from "stripe";
import { beforeEach, describe, expect, it } from "vitest";

import {
  buildManagedCheckoutParams,
  recordStripeEvent,
  verifyStripeEvent,
} from "../app/domain/stripe.server";

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
  await env.DB.prepare("DELETE FROM stripe_events").run();
});

describe("Stripe Managed Payments", () => {
  it("crea soltanto parametri compatibili con Managed Payments", () => {
    const params = buildManagedCheckoutParams({
      offer: "monthly",
      priceId: "price_test_monthly",
      workspaceId: "workspace-test",
      email: "merchant@example.com",
      appOrigin: "https://test.fiscalbay.it",
    });

    expect(params).toMatchObject({
      mode: "subscription",
      line_items: [{ price: "price_test_monthly", quantity: 1 }],
      managed_payments: { enabled: true },
      client_reference_id: "workspace-test",
    });
    expect(params).not.toHaveProperty("automatic_tax");
    expect(params).not.toHaveProperty("payment_method_types");
    expect(
      buildManagedCheckoutParams({
        offer: "lifetime",
        priceId: "price_test_lifetime",
        workspaceId: "workspace-test",
        email: "merchant@example.com",
        appOrigin: "https://test.fiscalbay.it",
      }).mode,
    ).toBe("payment");
  });

  it("verifica la firma sul corpo grezzo e registra l'evento una sola volta", async () => {
    const body = JSON.stringify(event);
    const secret = "whsec_fiscalbay_test";
    const signature = await Stripe.webhooks.generateTestHeaderStringAsync({
      payload: body,
      secret,
    });
    const verified = await verifyStripeEvent(body, signature, secret);

    expect(await recordStripeEvent(env.DB, verified)).toBe(true);
    expect(await recordStripeEvent(env.DB, verified)).toBe(false);
    expect(
      await env.DB.prepare(
        "SELECT event_type, object_id, livemode FROM stripe_events WHERE stripe_event_id = ?",
      )
        .bind(event.id)
        .first(),
    ).toEqual({
      event_type: "checkout.session.completed",
      object_id: "cs_test_checkout",
      livemode: 0,
    });
  });

  it("rifiuta una firma non valida", async () => {
    await expect(
      verifyStripeEvent(JSON.stringify(event), "t=1,v1=invalid", "whsec_fiscalbay_test"),
    ).rejects.toThrow();
  });
});
