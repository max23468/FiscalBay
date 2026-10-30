import { env } from "cloudflare:workers";
import Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyStripeEvent,
  changeSubscriptionPeriod,
  openBillingPortal,
  paidCoverage,
  reconcileBilling,
  subscriptionRenews,
} from "../app/domain/billing.server";
import { subscriptionOffers } from "../app/catalog";
import { checkoutConfigured, purchaseState } from "../app/domain/checkout.server";
import { orderAllowance, startTrial } from "../app/domain/grants.server";
import {
  createBoundedStripeClient,
  isMissingObject,
  stripeCall,
  stripeSecretKey,
} from "../app/integrations/stripe.server";
import { action as settingsAction, loader as settingsLoader } from "../app/routes/settings";
import { verifiedSession } from "./fixtures/account-fixtures";
import { subscriptionView } from "../app/domain/plan-view.server";
import { insertEntitlement, now, resetDatabase } from "./fixtures/database-fixtures";
import { routePage } from "./fixtures/route-fixtures";
import {
  catalogPrice,
  workspace,
  second,
  periodStart,
  periodEnd,
  nextEnd,
  type FakeSubscription,
  stripeAccount,
  firstInvoice,
} from "./fixtures/stripe-fixtures";

/** Chiave segreta live: Production accetta soltanto chiavi live, standard o con limitazioni. */
const liveKey = "sk_live_fiscalbay";

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
    const result = await routePage(settingsLoader, "/app/impostazioni/piano", {
      cookie,
      params: { sezione: "piano" },
    });
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
      [env, "sk_live_sk_test_fiscalbay"],
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
      await insertEntitlement({ id: source, source, endsAt: periodEnd }).run();
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
    await insertEntitlement({
      id: "trial",
      source: "trial",
      startsAt: "2026-09-06T20:00:00.000Z",
      endsAt: trialEnd,
    }).run();
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
    // Una disdetta a fine periodo, successiva alla tutela, non la sostituisce: la chiusura
    // si anticipa alla fine della tutela.
    stripe.state.subscription = {
      status: "past_due",
      start: periodEnd,
      end: nextEnd,
      cancelAt: nextEnd,
    };
    await applyStripeEvent(
      env,
      { topic: "customer.subscription.updated", objectId: "sub_test" },
      stripe.fetcher,
      at("2026-10-20T19:59:00.000Z"),
    );
    expect(stripe.state.subscription.cancelAt).toBe("2026-10-20T20:00:00.000Z");
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
      insertEntitlement({
        id: "pagato",
        workspaceId: "w-c",
        source: "premium",
        startsAt: hours(240),
        endsAt: hours(-240),
      }),
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
      { metadata: {} as Record<string, string> },
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
      insertEntitlement({
        id: source,
        source,
        endsAt: periodEnd,
        grantedBy: source === "admin" ? "owner" : null,
        grantReason: source === "admin" ? "owner" : null,
      }).run();
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
        payments: { data: [invoice.payments!.data[0]] },
      } as unknown as Stripe.Invoice),
    ).toMatchObject({ invoiceId: "in_mixed", paymentIntent: null });
    // Un periodo senza durata non copre nulla.
    expect(paidCoverage(only(line(now, now, "subscription_item_details")))).toBeNull();
  });

  it("legge Stripe senza retry propri, entro il limite dei byte e con errori classificati", async () => {
    const reply = vi.fn<typeof fetch>();
    const stripe = await createBoundedStripeClient("rk_test_fiscalbay", reply);
    const read = () => stripeCall(() => stripe.subscriptions.retrieve("sub_test"));
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
    // Fuori dagli errori del cliente la richiesta resta da riprovare, anche con un rinvio.
    for (const status of [302, 500, 503]) {
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
    expect(reply).toHaveBeenCalledTimes(11);
  });
});
