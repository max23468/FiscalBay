import { env } from "cloudflare:workers";
import Stripe from "stripe";
import { expect, vi } from "vitest";
import { action as settingsAction } from "../../app/routes/settings";
import { insertStore, now } from "./database-fixtures";
import { callRoute } from "./route-fixtures";

export const event = {
  id: "evt_checkout_completed",
  object: "event",
  api_version: "2026-08-26.dahlia",
  created: 1_789_914_800,
  data: {
    object: { id: "cs_test_checkout", object: "checkout.session" } as Stripe.Checkout.Session,
  },
  livemode: false,
  pending_webhooks: 1,
  request: null,
  type: "checkout.session.completed",
} satisfies Stripe.Event;

export const checkoutInput = {
  priceId: "price_test_monthly",
  generation: "2026-09",
  workspaceId: "workspace-test",
  email: "merchant@example.invalid",
  language: "it" as const,
  successUrl: "https://test.fiscalbay.it/app/impostazioni/piano",
  cancelUrl: "https://test.fiscalbay.it/app/impostazioni/piano",
};

/** Prezzo Stripe conforme al listino, con le variazioni del singolo caso. */
export function catalogPrice(
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
export function stripeApi(
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

export const paths = (request: ReturnType<typeof stripeApi>) =>
  request.mock.calls.map(([url, options]) => `${options?.method} ${new URL(String(url)).pathname}`);

/** Spazio con un negozio collegato; `synced` registra la prima lettura riuscita. */
export async function workspace(userId: string, { synced = true } = {}) {
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

export function buy(cookie: string, plan: string, path = "/app/impostazioni/piano") {
  return callRoute(settingsAction, path, { cookie, fields: { intent: "buy", plan } });
}

export const second = (iso: string) => Date.parse(iso) / 1000;
export const periodStart = now;
export const periodEnd = "2026-10-13T20:00:00.000Z";
export const nextEnd = "2026-11-13T20:00:00.000Z";

export type FakeSubscription = {
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

export type FakeCharge = {
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
export function stripeAccount() {
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
    /** Elementi per pagina degli elenchi, come il `limit` massimo di Stripe. */
    pageSize: 100,
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
    // Elenchi a pagine come su Stripe: dopo `starting_after`, `pageSize` elementi alla volta.
    const list = (data: unknown[]) => {
      const after = url.searchParams.get("starting_after");
      const from = after ? data.findIndex((item) => (item as { id?: string }).id === after) + 1 : 0;
      const page = data.slice(from, from + state.pageSize);
      return Response.json({
        object: "list",
        data: page,
        has_more: from + page.length < data.length,
      });
    };
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

export const firstInvoice = {
  id: "in_first",
  start: periodStart,
  end: periodEnd,
  amount: 598,
  paidAt: periodStart,
};
