import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyStripeEvent,
  openBillingPortal,
  reconcileBilling,
  stopRenewals,
  subscriptionRenews,
} from "../app/domain/billing.server";
import { purchaseState } from "../app/domain/checkout.server";
import { orderAllowance } from "../app/domain/grants.server";
import { lifetimeContext } from "../app/domain/lifetime.server";
import { loader as settingsLoader } from "../app/routes/settings";
import { verifiedSession } from "./fixtures/account-fixtures";
import { subscriptionView } from "../app/domain/plan-view.server";
import { insertEntitlement, now, resetDatabase } from "./fixtures/database-fixtures";
import { routePage } from "./fixtures/route-fixtures";
import {
  workspace,
  second,
  periodEnd,
  nextEnd,
  type FakeCharge,
  stripeAccount,
  firstInvoice,
} from "./fixtures/stripe-fixtures";

/** Chiave segreta live: Production accetta soltanto chiavi live, standard o con limitazioni. */
const liveKey = "sk_live_fiscalbay";

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
      insertEntitlement({
        id: "trial",
        source: "trial",
        startsAt: "2026-08-30T20:00:00.000Z",
        endsAt: now,
      }),
      insertEntitlement({
        id: "admin",
        source: "admin",
        startsAt: nextEnd,
        endsAt: "2026-11-20T20:00:00.000Z",
        grantedBy: "owner",
        grantReason: "Disservizio",
      }),
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
    const page = await routePage(settingsLoader, "/app/impostazioni/piano", {
      cookie,
      params: { sezione: "piano" },
    });
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
    await insertEntitlement({
      id: "pagato",
      source: "premium",
      endsAt: "2026-10-20T20:00:00.000Z",
    }).run();
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
