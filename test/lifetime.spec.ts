import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyStripeEvent,
  openBillingPortal,
  reconcileBilling,
  stopRenewals,
} from "../app/domain/billing.server";
import { purchaseState, startCheckout } from "../app/domain/checkout.server";
import { grantLifetimeConcession, grantPremium } from "../app/domain/concessions.server";
import { accountCoverage, orderAllowance, startTrial } from "../app/domain/grants.server";
import { lifetimeContext, refundedShare, unusedCredit } from "../app/domain/lifetime.server";
import { verifiedSession } from "./fixtures/account-fixtures";
import { subscriptionView } from "../app/domain/plan-view.server";
import { insertEntitlement, insertStore, now, resetDatabase } from "./fixtures/database-fixtures";
import {
  workspace,
  buy,
  second,
  periodStart,
  periodEnd,
  stripeAccount,
  firstInvoice,
} from "./fixtures/stripe-fixtures";

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
    ({ userId, cookie } = await verifiedSession(`lifetime-${crypto.randomUUID()}@example.invalid`));
    await workspace(userId);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Stripe simulato che ferma la creazione della sessione lifetime finché `resume` non la
   * lascia proseguire, oppure la fa fallire.
   */
  function heldLifetime(stripe: ReturnType<typeof stripeAccount>, outcome: "held" | "failed") {
    let entered!: () => void;
    let resume!: () => void;
    const reached = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const held = new Promise<void>((resolve) => {
      resume = resolve;
    });
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      if (
        new URL(String(input)).pathname === "/v1/checkout/sessions" &&
        init?.method === "POST" &&
        new URLSearchParams(String(init.body)).get("mode") === "payment"
      ) {
        entered();
        await held;
        if (outcome === "failed")
          return Response.json({ error: { type: "api_error" } }, { status: 503 });
      }
      return stripe.fetcher(input, init);
    });
    return { reached, resume };
  }
  const purchase = (offer: "monthly" | "annual" | "lifetime") =>
    startCheckout(
      env,
      { request, userId, email: "turno@example.invalid", offer, language: "it" },
      at(now),
    );
  const open = (stripe: ReturnType<typeof stripeAccount>) =>
    stripe.state.sessions.filter((session) => session.status === "open");

  it("un lifetime in creazione ferma mensile, annuale e un altro lifetime dello stesso spazio", async () => {
    const stripe = stripeAccount();
    const { reached, resume } = heldLifetime(stripe, "held");
    const lifetime = purchase("lifetime");
    await reached;
    expect(await purchase("monthly")).toEqual({ ok: false, reason: "unavailable" });
    expect(await purchase("annual")).toEqual({ ok: false, reason: "unavailable" });
    expect(await purchase("lifetime")).toEqual({ ok: false, reason: "unavailable" });
    resume();
    expect(await lifetime).toMatchObject({ ok: true });
    expect(open(stripe)).toEqual([expect.objectContaining({ mode: "payment" })]);
    // Legata la sessione il turno è libero: il mensile chiude il lifetime e il posto si libera.
    expect(await purchase("monthly")).toMatchObject({ ok: true });
    expect(open(stripe)).toEqual([expect.objectContaining({ mode: "subscription" })]);
    expect(await allocations()).toEqual([]);
  });

  it("un lifetime non creato libera subito il turno dello spazio", async () => {
    const stripe = stripeAccount();
    const { reached, resume } = heldLifetime(stripe, "failed");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const lifetime = purchase("lifetime");
    await reached;
    resume();
    expect(await lifetime).toEqual({ ok: false, reason: "unavailable" });
    expect(await allocations()).toEqual([]);
    expect(await purchase("monthly")).toMatchObject({ ok: true });
  });

  it("due concessioni contemporanee si sommano senza sovrapporsi", async () => {
    const input = { workspaceId: "w-a", author: "owner", days: 3 };
    const results = await Promise.all([
      grantPremium(env, { ...input, reason: "Prima concessione" }, at(now)),
      grantPremium(env, { ...input, reason: "Seconda concessione" }, at(now)),
    ]);
    const day = 86_400_000;
    const after = (days: number) => new Date(Date.parse(now) + days * day).toISOString();
    expect(
      results.toSorted((a, b) =>
        "startsAt" in a && "startsAt" in b ? a.startsAt.localeCompare(b.startsAt) : 0,
      ),
    ).toEqual([
      { result: "done", startsAt: now, endsAt: after(3) },
      { result: "done", startsAt: after(3), endsAt: after(6) },
    ]);
    expect(
      (
        await env.DB.prepare(
          "SELECT starts_at, ends_at FROM workspace_entitlements WHERE source = 'admin' ORDER BY starts_at",
        ).all()
      ).results,
    ).toEqual([
      { starts_at: now, ends_at: after(3) },
      { starts_at: after(3), ends_at: after(6) },
    ]);
  });

  it("il lifetime in omaggio chiude la sessione di mensile o annuale ancora aperta", async () => {
    const stripe = stripeAccount();
    vi.spyOn(globalThis, "fetch").mockImplementation(stripe.fetcher);
    expect(await purchase("monthly")).toMatchObject({ ok: true });
    // La chiusura all'attivazione non riesce: la ripete il cron.
    stripe.state.failing.push("/v1/checkout/sessions/cs_lifetime_1");
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(
      await grantLifetimeConcession(
        env,
        { workspaceId: "w-a", author: "admin-1", reason: "Omaggio" },
        at(now),
      ),
    ).toBe("done");
    expect(open(stripe)).toHaveLength(1);
    stripe.state.failing.length = 0;
    await reconcileBilling(env, stripe.fetcher, at(now));
    expect(open(stripe)).toEqual([]);
    expect(
      await env.DB.prepare("SELECT COUNT(*) AS n FROM subscription_checkouts").first(),
    ).toEqual({ n: 0 });
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
      seats: { left: 0, total: 20 },
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
      insertEntitlement({
        id: "lifetime",
        source: "lifetime",
        stripeCheckoutSessionId: "cs_paid",
        amountPaid: 18178,
        currency: "eur",
        paidAt: now,
        revokedAt: now,
        revocation: "refund",
      }),
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
      insertEntitlement({ id: "lifetime", source: "lifetime", stripeCheckoutSessionId: "cs_paid" }),
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

  it("una vendita completata mentre la cancellazione attende Stripe non crea il diritto", async () => {
    const stripe = stripeAccount();
    await buyLifetime(stripe);
    stripe.settle("cs_lifetime_1", "processing");
    await event(stripe, "checkout.session.completed", "cs_lifetime_1");
    // La cancellazione resta in attesa del pagamento in conferma, poi il pagamento riesce.
    await env.DB.prepare(`INSERT INTO account_deletions (id, user_id, workspace_id, requested_at)
      VALUES (?1, ?2, 'w-a', ?3)`)
      .bind(crypto.randomUUID(), userId, now)
      .run();
    stripe.settle("cs_lifetime_1", "paid");
    await event(stripe, "checkout.session.completed", "cs_lifetime_1");
    expect(await lifetimes()).toEqual([]);
    // Il posto pagato resta occupato con i riferimenti dell'acquisto.
    expect(await allocations()).toEqual([
      expect.objectContaining({
        provider_reference: "cs_lifetime_1",
        status: "active",
        customer_id: "cus_lifetime",
      }),
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
    // La sessione aperta si chiude senza fermare alcun abbonamento.
    expect(stripe.requests.filter((request) => request.includes("/v1/subscriptions"))).toEqual([]);
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
    // Completata senza abbonamento, come un pagamento ancora da confermare: nulla da fermare.
    await buyMonthly();
    Object.assign(stripe.state.sessions[3]!, { status: "complete", subscription: null });
    stripe.requests.length = 0;
    expect(await stopRenewals(env, "w-a", stripe.fetcher, at(now))).toBe(true);
    expect(stripe.requests).toEqual(["GET /v1/checkout/sessions/cs_lifetime_4"]);
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
      seats: { left: 20, total: 20 },
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
        "metadata[role]": "lifetime_credit",
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
      seats: { left: 20, total: 20 },
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

  it("riprende il posto se Stripe non ha più la vendita o non c'è una vendita da rileggere", async () => {
    const stripe = stripeAccount();
    vi.spyOn(globalThis, "fetch").mockImplementation(stripe.fetcher);
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO workspaces (id, name, created_at) VALUES ('w-b', 'Altro', ?)",
      ).bind(now),
      env.DB.prepare(`INSERT INTO lifetime_allocations (slot, status, provider_reference,
          activated_at, created_at) VALUES (1, 'active', 'cs_sparita', ?1, ?1),
          (2, 'active', NULL, ?1, ?1)`).bind(now),
    ]);
    const recover = (workspaceId: string, slot: number) =>
      grantLifetimeConcession(
        env,
        { workspaceId, author: "owner", reason: "Ritorno", slot },
        at(now),
      );
    // Una sessione sparita non prova un rimborso.
    stripe.state.missing = true;
    expect(await recover("w-a", 1)).toBe("done");
    // Un posto senza vendita registrata non chiede nulla a Stripe.
    stripe.state.down = true;
    stripe.requests.length = 0;
    expect(await recover("w-b", 2)).toBe("done");
    expect(stripe.requests.filter((request) => request.includes("/v1/checkout/"))).toEqual([]);
    expect(await allocations()).toEqual([
      expect.objectContaining({ slot: 1, workspace_id: "w-a" }),
      expect.objectContaining({ slot: 2, workspace_id: "w-b" }),
    ]);
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
