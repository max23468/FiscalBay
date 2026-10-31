import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { openPromotionEnd } from "../app/catalog.ts";
import {
  configurationChecks,
  entitlementChecks,
  feeChecks,
  feeSummary,
  listAll,
  methodChanges,
  paymentOffers,
  subscriptionChecks,
} from "./commercial.mjs";

const problemsOf = (results) =>
  Object.fromEntries(results.map(({ item, problems }) => [item.split(" (")[0], problems]));

describe("configurazione commerciale", () => {
  const now = new Date("2026-12-01T00:00:00Z");
  const promotion = { starts_at: "2026-11-15T09:00:00Z", ends_at: openPromotionEnd };
  const base = {
    promotions: [{ ...promotion, quota: 10 }],
    quotas: [],
    admission: undefined,
    seats: 3,
    now,
  };

  it("accetta una promozione in corso senza fine con quota 10, acquisti aperti e posti", () => {
    const results = configurationChecks(base);
    assert.ok(results.every(({ ok }) => ok));
    assert.ok(results.some(({ item }) => item.includes("2026-11-15T09:00:00Z → senza fine")));
    assert.ok(results.some(({ item }) => item === "posti lifetime (3 occupati su 20)"));
    // La fine decisa dall'owner compare nel resoconto.
    const ending = configurationChecks({
      ...base,
      promotions: [{ ...promotion, ends_at: "2027-01-15T09:00:00Z", quota: 10 }],
    });
    assert.ok(ending.every(({ ok }) => ok));
    assert.ok(ending.some(({ item }) => item.includes("→ 2027-01-15T09:00:00Z")));
  });

  it("segnala promozione assente, doppia, con altra quota o non ancora iniziata", () => {
    assert.deepEqual(problemsOf(configurationChecks({ ...base, promotions: [] })).promozione, [
      "assente",
    ]);
    assert.deepEqual(
      problemsOf(
        configurationChecks({ ...base, promotions: [base.promotions[0], base.promotions[0]] }),
      ).promozione,
      ["più_promozioni"],
    );
    assert.deepEqual(
      problemsOf(
        configurationChecks({
          ...base,
          promotions: [{ ...promotion, starts_at: "2026-12-02T00:00:00Z", quota: 8 }],
        }),
      ).promozione,
      ["quota", "non_iniziata"],
    );
  });

  it("vuole la quota base del listino dopo la promozione", () => {
    const quota = (value, at, id = 1) => ({ id, quota: value, effective_at: at });
    const after = (quotas, ends_at = openPromotionEnd) =>
      problemsOf(
        configurationChecks({
          ...base,
          quotas,
          promotions: [{ ...promotion, ends_at, quota: 10 }],
        }),
      )["quota base dopo la promozione"];
    // Senza fine vale la quota base in vigore adesso.
    assert.deepEqual(after([quota(7, "2026-11-20T00:00:00.000Z")]), ["quota"]);
    assert.deepEqual(after([quota(7, "2027-01-20T00:00:00.000Z")]), []);
    // Con una fine vale quella del ciclo che inizia alla fine.
    const end = "2027-01-15T09:00:00.000Z";
    assert.deepEqual(after([quota(7, "2026-12-10T00:00:00.000Z")], end), ["quota"]);
    assert.deepEqual(after([quota(7, "2026-12-10T00:00:00.000Z"), quota(5, end, 2)], end), []);
  });

  it("segnala acquisti chiusi e riporta la lista d'attesa", () => {
    const results = configurationChecks({
      ...base,
      admission: { free_waitlist: 1, purchases_open: 0 },
    });
    const purchases = results.find(({ item }) => item.startsWith("acquisti"));
    assert.equal(purchases.item, "acquisti (lista d'attesa attiva)");
    assert.deepEqual(purchases.problems, ["chiusi"]);
  });
});

describe("elenchi Stripe", () => {
  it("legge tutte le pagine dal cursore dell'ultimo elemento", () => {
    const calls = [];
    const request = (_method, _resource, params) => {
      calls.push(params.starting_after ?? null);
      return params.starting_after
        ? { data: [{ id: "b" }], has_more: false }
        : { data: [{ id: "a" }], has_more: true };
    };
    assert.deepEqual(
      listAll(request, "/v1/charges").map(({ id }) => id),
      ["a", "b"],
    );
    assert.deepEqual(calls, [null, "a"]);
  });
});

const line = (subscription, price) => ({
  parent: { type: "subscription_item_details", subscription_item_details: { subscription } },
  pricing: { price_details: { price } },
});
const invoice = (id, intent, lines, paidAt = 1, amount = 490) => ({
  id,
  amount_paid: amount,
  status_transitions: { paid_at: paidAt },
  lines: { data: lines },
  payments: { data: [{ status: "paid", payment: { payment_intent: intent } }] },
});
const charge = (intent, gross, fees, method = "pm_a") => ({
  status: "succeeded",
  payment_intent: intent,
  payment_method: method,
  balance_transaction: { amount: gross, fee_details: fees },
});

describe("commissioni effettive", () => {
  const priceOffer = (id) => ({ price_month: "monthly", price_year: "annual" })[id] ?? null;
  const invoices = [
    invoice("in_m", "pi_m", [line("sub_m", "price_month")]),
    invoice("in_a", "pi_a", [line("sub_a", "price_year")]),
    // La fattura del lifetime ha soltanto una riga una tantum.
    invoice("in_l", "pi_l", [{ parent: { type: "invoice_item_details" } }]),
  ];
  const sessions = [{ id: "cs_l", payment_intent: "pi_l" }];

  it("attribuisce ogni pagamento alla sua offerta", () => {
    const offers = paymentOffers({ invoices, sessions, priceOffer });
    assert.deepEqual(Object.fromEntries(offers), {
      pi_l: "lifetime",
      pi_m: "monthly",
      pi_a: "annual",
    });
  });

  it("toglie le imposte trattenute e ripartisce Managed Payments e Billing sul lordo", () => {
    const offers = paymentOffers({ invoices, sessions, priceOffer });
    const summary = feeSummary({
      charges: [
        charge("pi_m", 1000, [{ type: "stripe_fee", amount: 50 }]),
        charge("pi_a", 3000, [{ type: "stripe_fee", amount: 100 }]),
        charge("pi_l", 6000, [
          { type: "stripe_fee", amount: 200 },
          { type: "withheld_tax", amount: 1000 },
        ]),
        charge("pi_estraneo", 1000, [{ type: "stripe_fee", amount: 10 }]),
        { ...charge("pi_fallito", 1000, []), status: "failed" },
      ],
      offers,
      fees: [
        { description: "Managed Payments Transaction Fee (2026-11-02)", amount: -500 },
        { description: "Billing usage fee", amount: -40 },
        { description: "Card Dispute Countered Fee (2026-11-02)", amount: -1500 },
        { description: "Radar", amount: -5 },
      ],
    });
    const rate = (offer) => Math.round(summary.offers[offer].rate * 10_000) / 10_000;
    // Mensile: 50 + 500·1000/10000 + 40·1000/4000 = 110 su 1000.
    assert.equal(rate("monthly"), 0.11);
    // Annuale: 100 + 150 + 30 = 280 su 3000.
    assert.equal(rate("annual"), 0.0933);
    // Lifetime: 200 + 300, senza Billing, su 5000 di netto.
    assert.equal(rate("lifetime"), 0.1);
    assert.equal(rate("altro"), 0.01);
    assert.deepEqual(
      { managed: summary.managedEntries, disputes: summary.disputes, other: summary.other },
      { managed: 1, disputes: 1500, other: 5 },
    );
  });

  it("segnala un'offerta oltre la stima con tolleranza e un pagamento senza offerta", () => {
    const checks = feeChecks({
      offers: {
        monthly: { payments: 2, rate: 0.131, estimate: 0.12 },
        annual: { payments: 1, rate: 0.083, estimate: 0.075 },
        altro: { payments: 1, rate: 0.01, estimate: null },
      },
    });
    assert.deepEqual(
      checks.map(({ item, ok }) => [item, ok]),
      [
        ["commissioni monthly (2 pagamenti, 13,1% su stima 12,0%)", true],
        ["commissioni annual (1 pagamenti, 8,3% su stima 7,5%)", false],
        ["commissioni altro (1 pagamenti, 1,0%)", false],
      ],
    );
    assert.deepEqual(checks[2].problems, ["offerta_sconosciuta"]);
  });
});

describe("riconciliazione dei diritti", () => {
  const subscription = (fields = {}) => ({
    id: "sub_1",
    status: "active",
    cancel_at_period_end: false,
    cancel_at: null,
    metadata: { workspace_id: "w1", offer: "monthly", price_generation: "2026-09" },
    items: {
      data: [{ current_period_end: 1_800_000_000, price: { recurring: { interval: "month" } } }],
    },
    ...fields,
  });
  const row = {
    id: "sub_1",
    workspace_id: "w1",
    status: "active",
    offer: "monthly",
    renewal_offer: "monthly",
    price_generation: "2026-09",
    current_period_end: new Date(1_800_000_000_000).toISOString(),
    cancel_at_period_end: 0,
  };

  it("accetta un abbonamento uguale in D1", () => {
    assert.equal(subscriptionChecks([subscription()], [row]).ok, true);
  });

  it("legge un cambio di periodicità programmato come rinnovo diverso dal periodo pagato", () => {
    const changed = subscription({
      status: "trialing",
      items: {
        data: [{ current_period_end: 1_800_000_000, price: { recurring: { interval: "year" } } }],
      },
    });
    assert.equal(
      subscriptionChecks([changed], [{ ...row, status: "trialing", renewal_offer: "annual" }]).ok,
      true,
    );
    assert.deepEqual(subscriptionChecks([changed], [row]).problems, [
      "1 diversi",
      "status",
      "renewal_offer",
    ]);
  });

  it("segnala disdetta non riletta e abbonamento assente", () => {
    assert.deepEqual(
      subscriptionChecks([subscription({ cancel_at: 1_800_000_000 })], [row]).problems,
      ["1 diversi", "cancel_at_period_end"],
    );
    assert.deepEqual(subscriptionChecks([subscription()], []).problems, ["1 diversi", "assente"]);
    assert.equal(subscriptionChecks([subscription({ status: "canceled" })], []).ok, true);
  });

  it("vuole un diritto per ogni copertura pagata e ogni lifetime pagato", () => {
    const invoices = [
      invoice("in_1", "pi_1", [line("sub_1", "price_month")]),
      invoice("in_2", "pi_2", [line("sub_1", "price_month")], 2),
      invoice("in_0", "pi_0", [line("sub_1", "price_month")], 3, 0),
    ];
    const [coverages, lifetimes] = entitlementChecks({
      invoices,
      sessions: [{ id: "cs_1" }],
      invoiceRights: new Set(["in_1"]),
      sessionRights: new Set(["cs_1"]),
    });
    assert.deepEqual(
      [coverages.item, coverages.ok, coverages.problems],
      ["coperture pagate (2)", false, ["1 senza diritto"]],
    );
    assert.equal(lifetimes.ok, true);
  });

  it("conta i metodi cambiati dopo il primo pagamento e i rinnovi pagati con il nuovo", () => {
    const invoices = [
      invoice("in_1", "pi_1", [line("sub_1", "price_month")], 1),
      invoice("in_2", "pi_2", [line("sub_1", "price_month")], 2),
      invoice("in_3", "pi_3", [line("sub_2", "price_month")], 1),
    ];
    const charges = [
      charge("pi_1", 490, [], "pm_old"),
      charge("pi_2", 490, [], "pm_new"),
      charge("pi_3", 490, [], "pm_same"),
    ];
    const subscriptions = [
      subscription({ default_payment_method: "pm_new" }),
      subscription({ id: "sub_2", default_payment_method: "pm_same" }),
      subscription({ id: "sub_3", default_payment_method: null }),
    ];
    assert.deepEqual(methodChanges(subscriptions, invoices, charges), {
      changed: 1,
      paidWithNew: 1,
    });
  });
});
