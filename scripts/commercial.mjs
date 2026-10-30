#!/usr/bin/env node
/**
 * Configurazione e vendite commerciali di un ambiente, in sola lettura.
 *
 * `preflight` si esegue al go-live, prima di aprire le iscrizioni: account Stripe allineato al
 * codice, una sola promozione globale del Free in corso con quota 10, senza fine o con la fine
 * decisa dall'owner, seguita dalla quota base, acquisti aperti e posti lifetime. `verify --since
 * <ISO>` rilegge le vendite reali: ogni fattura pagata e ogni lifetime pagato hanno il loro
 * diritto in D1, ogni abbonamento in D1 coincide con Stripe (stato, periodicità del periodo
 * pagato e del rinnovo, fine del periodo, disdetta, generazione del listino) e le commissioni
 * effettive di ogni offerta si confrontano con le stime di D193.
 *
 * Il resoconto riporta esiti, conteggi e percentuali, mai importi, clienti o riferimenti.
 * Le richieste a Stripe passano dal profilo della CLI, la D1 dalla CLI `cf`.
 *
 * Uso:
 *   node scripts/commercial.mjs preflight [--mode live] [--project-name <profilo>]
 *   node scripts/commercial.mjs verify --since <ISO> [--mode live] [--project-name <profilo>]
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import {
  baseFreeQuota,
  lifetimeSlots,
  openPromotionEnd,
  subscriptionOffers,
} from "../app/catalog.ts";
import { d1Query } from "./lib/provider.mjs";
import { literal, targetOf as databaseOf } from "./recovery.mjs";
import { checkAccount, cliRequest, report, targetOf as accountOf } from "./stripe-account.mjs";

/** Promozione globale del Free (§5): 10 sblocchi per ciclo, dal go-live finché l'owner la chiude. */
export const promotionQuota = 10;

/**
 * Commissioni stimate in D193 sul netto, con carta UE: Managed Payments, carta e Billing. Una
 * commissione effettiva oltre la stima di più di un decimo richiede la decisione dell'owner.
 */
export const feeEstimates = { monthly: 0.12, annual: 0.075, lifetime: 0.063 };
const feeTolerance = 1.1;

/**
 * Controlli della configurazione commerciale in D1. `promotions` sono le promozioni non ancora
 * concluse, `quotas` le modifiche della quota base, `admission` la riga degli interruttori,
 * `seats` i posti lifetime occupati.
 */
export function configurationChecks({ promotions, quotas, admission, seats, now = new Date() }) {
  const results = [];
  const record = (item, problems, detail) =>
    results.push({ item: detail ? `${item} (${detail})` : item, ok: !problems.length, problems });

  const [current] = promotions;
  if (promotions.length !== 1)
    record("promozione", [promotions.length ? "più_promozioni" : "assente"]);
  else {
    const open = current.ends_at === openPromotionEnd;
    record(
      "promozione",
      [
        ...(current.quota === promotionQuota ? [] : ["quota"]),
        ...(Date.parse(current.starts_at) <= now.getTime() ? [] : ["non_iniziata"]),
      ],
      `${current.starts_at} → ${open ? "senza fine" : current.ends_at}`,
    );
    // La quota base è quella che il sito promette dopo la promozione: alla sua fine, oppure
    // quella in vigore finché la promozione non ha una fine.
    const until = open ? now.getTime() : Date.parse(current.ends_at);
    const base =
      quotas
        .filter(({ effective_at }) => Date.parse(effective_at) <= until)
        .sort((a, b) => Date.parse(a.effective_at) - Date.parse(b.effective_at) || a.id - b.id)
        .at(-1)?.quota ?? baseFreeQuota;
    record("quota base dopo la promozione", base === baseFreeQuota ? [] : ["quota"]);
  }

  // Senza la riga gli acquisti sono aperti e la lista d'attesa spenta.
  record(
    "acquisti",
    !admission || admission.purchases_open ? [] : ["chiusi"],
    admission?.free_waitlist ? "lista d'attesa attiva" : "lista d'attesa spenta",
  );
  record(
    "posti lifetime",
    seats <= lifetimeSlots ? [] : ["oltre_il_tetto"],
    `${seats} occupati su ${lifetimeSlots}`,
  );
  return results;
}

/** Tutte le pagine di un elenco Stripe. */
export function listAll(request, resource, params = {}) {
  const items = [];
  for (let page; !page || page.has_more;) {
    page = request("get", resource, {
      ...params,
      limit: 100,
      ...(items.length ? { starting_after: items.at(-1).id } : {}),
    });
    items.push(...page.data);
  }
  return items;
}

const iso = (seconds) => new Date(seconds * 1000).toISOString();
const sum = (items) => items.reduce((total, value) => total + value, 0);

/** Righe di una fattura che appartengono a un abbonamento. */
const subscriptionLines = (invoice) =>
  invoice.lines.data.filter((line) => line.parent?.type === "subscription_item_details");

/** Pagamento riuscito di una fattura, per collegarla all'addebito. */
const invoicePayment = (invoice) =>
  invoice.payments?.data.find((payment) => payment.status === "paid")?.payment?.payment_intent ??
  null;

/**
 * Offerta di ogni pagamento: le sessioni lifetime pagate, poi le fatture degli abbonamenti con
 * la periodicità del prezzo della riga. `priceOffer` risolve un prezzo nella sua periodicità.
 */
export function paymentOffers({ invoices, sessions, priceOffer }) {
  const offers = new Map();
  for (const session of sessions)
    if (session.payment_intent) offers.set(session.payment_intent, "lifetime");
  for (const invoice of invoices) {
    const intent = invoicePayment(invoice);
    const [line] = subscriptionLines(invoice);
    if (!intent || !line || offers.has(intent)) continue;
    const offer = priceOffer(line.pricing?.price_details?.price);
    if (offer) offers.set(intent, offer);
  }
  return offers;
}

/**
 * Commissioni effettive per offerta, in percentuale del netto incassato (imposte trattenute
 * escluse). La commissione di elaborazione è quella dell'addebito; Managed Payments e Billing
 * arrivano come addebiti separati e si ripartiscono in proporzione al lordo, come si calcolano,
 * Billing soltanto sugli abbonamenti. Dispute e altre commissioni restano fuori dal confronto.
 */
export function feeSummary({ charges, offers, fees }) {
  const rows = charges.flatMap((charge) => {
    const transaction = charge.balance_transaction;
    if (charge.status !== "succeeded" || !transaction || typeof transaction !== "object") return [];
    const details = transaction.fee_details ?? [];
    const withheld = sum(
      details.filter(({ type }) => type === "withheld_tax").map(({ amount }) => amount),
    );
    return [
      {
        offer: offers.get(charge.payment_intent) ?? "altro",
        gross: transaction.amount,
        net: transaction.amount - withheld,
        processing: sum(
          details.filter(({ type }) => type !== "withheld_tax").map(({ amount }) => amount),
        ),
      },
    ];
  });
  const kinds = { managed: 0, billing: 0, disputes: 0, other: 0 };
  let managedEntries = 0;
  for (const fee of fees) {
    const kind = /managed payments/iu.test(fee.description ?? "")
      ? "managed"
      : /billing/iu.test(fee.description ?? "")
        ? "billing"
        : /dispute/iu.test(fee.description ?? "")
          ? "disputes"
          : "other";
    kinds[kind] -= fee.amount;
    if (kind === "managed") managedEntries++;
  }
  // Un pagamento senza offerta non è una vendita FiscalBay: non riceve commissioni ripartite.
  const grossAll = sum(rows.filter(({ offer }) => offer !== "altro").map(({ gross }) => gross));
  const recurring = rows.filter(({ offer }) => offer === "monthly" || offer === "annual");
  const grossRecurring = sum(recurring.map(({ gross }) => gross));
  const offersSummary = {};
  for (const offer of [...Object.keys(feeEstimates), "altro"]) {
    const own = rows.filter((row) => row.offer === offer);
    if (!own.length) continue;
    const gross = sum(own.map((row) => row.gross));
    const net = sum(own.map((row) => row.net));
    const managed = grossAll && offer !== "altro" ? (kinds.managed * gross) / grossAll : 0;
    const billing =
      grossRecurring && (offer === "monthly" || offer === "annual")
        ? (kinds.billing * gross) / grossRecurring
        : 0;
    const total = sum(own.map((row) => row.processing)) + managed + billing;
    offersSummary[offer] = {
      payments: own.length,
      rate: net ? total / net : 0,
      estimate: feeEstimates[offer] ?? null,
    };
  }
  return {
    offers: offersSummary,
    managedEntries,
    disputes: kinds.disputes,
    other: kinds.other,
  };
}

/** Controlli delle commissioni: una per offerta venduta, oltre la stima con tolleranza. */
export function feeChecks(summary) {
  const percent = (value) => `${(value * 100).toFixed(1).replace(".", ",")}%`;
  return Object.entries(summary.offers).map(([offer, { payments, rate, estimate }]) => ({
    item: `commissioni ${offer} (${payments} pagamenti, ${percent(rate)}${
      estimate === null ? "" : ` su stima ${percent(estimate)}`
    })`,
    ok: estimate !== null && rate <= estimate * feeTolerance,
    problems: estimate === null ? ["offerta_sconosciuta"] : ["oltre_stima"],
  }));
}

/**
 * Abbonamenti FiscalBay dell'ambiente su Stripe confrontati con la loro riga in D1: per ogni
 * abbonamento i campi diversi, `assente` senza riga se può ancora incassare.
 */
export function subscriptionChecks(subscriptions, rows) {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const problems = new Map();
  for (const subscription of subscriptions) {
    const item = subscription.items.data[0];
    const row = byId.get(subscription.id);
    if (!row) {
      // Lo spazio cancellato porta via la riga e chiude l'abbonamento.
      if (subscription.status !== "canceled") problems.set(subscription.id, ["assente"]);
      continue;
    }
    const offers = subscriptionOffers(subscription, subscription.metadata.offer);
    const expected = {
      workspace_id: subscription.metadata.workspace_id,
      status: subscription.status,
      offer: offers.offer,
      renewal_offer: offers.renewal,
      price_generation: subscription.metadata.price_generation,
      current_period_end: item ? iso(item.current_period_end) : null,
      cancel_at_period_end: subscription.cancel_at_period_end || !!subscription.cancel_at ? 1 : 0,
    };
    const fields = Object.entries(expected)
      .filter(([field, value]) => row[field] !== value)
      .map(([field]) => field);
    if (fields.length) problems.set(subscription.id, fields);
  }
  const fields = [...new Set([...problems.values()].flat())];
  return {
    item: `abbonamenti (${subscriptions.length})`,
    ok: !problems.size,
    problems: problems.size ? [`${problems.size} diversi`, ...fields] : [],
  };
}

/**
 * Metodo di pagamento cambiato dopo il primo addebito: abbonamenti con un metodo predefinito
 * diverso da quello del primo pagamento, e quanti di loro hanno un pagamento successivo con il
 * metodo nuovo. Soltanto conteggi, nessun controllo: il cambio è un'azione dell'owner.
 */
export function methodChanges(subscriptions, invoices, charges) {
  const methodOf = new Map(charges.map((charge) => [charge.payment_intent, charge.payment_method]));
  let changed = 0;
  let paidWithNew = 0;
  for (const subscription of subscriptions) {
    const method = subscription.default_payment_method;
    if (!method) continue;
    const paid = invoices
      .filter((invoice) =>
        subscriptionLines(invoice).some(
          (line) => line.parent.subscription_item_details?.subscription === subscription.id,
        ),
      )
      .sort((a, b) => a.status_transitions.paid_at - b.status_transitions.paid_at)
      .map((invoice) => methodOf.get(invoicePayment(invoice)))
      .filter(Boolean);
    if (!paid.length || paid[0] === method) continue;
    changed++;
    if (paid.slice(1).includes(method)) paidWithNew++;
  }
  return { changed, paidWithNew };
}

/** Riferimenti di Stripe senza il loro diritto in D1. */
export function entitlementChecks({ invoices, sessions, invoiceRights, sessionRights }) {
  const paidInvoices = invoices.filter(
    (invoice) => invoice.amount_paid > 0 && subscriptionLines(invoice).length,
  );
  const missingInvoices = paidInvoices.filter(({ id }) => !invoiceRights.has(id)).length;
  const missingSessions = sessions.filter(({ id }) => !sessionRights.has(id)).length;
  return [
    {
      item: `coperture pagate (${paidInvoices.length})`,
      ok: !missingInvoices,
      problems: [`${missingInvoices} senza diritto`],
    },
    {
      item: `lifetime pagati (${sessions.length})`,
      ok: !missingSessions,
      problems: [`${missingSessions} senza diritto`],
    },
  ];
}

/** Elenco SQL di riferimenti, oppure un elenco che non trova nulla. */
const sqlIn = (values) => (values.length ? values.map(literal).join(", ") : "NULL");

async function preflight({ account, database, request }) {
  const results = checkAccount(request, account);
  const [promotions, quotas, admission, seats] = await d1Query(
    database,
    [
      `SELECT starts_at, ends_at, quota FROM free_promotions
        WHERE julianday(ends_at) > julianday('now') ORDER BY starts_at`,
      "SELECT id, quota, effective_at FROM free_quota_changes",
      "SELECT free_waitlist, purchases_open FROM admission_settings WHERE id = 1",
      "SELECT COUNT(*) AS taken FROM lifetime_allocations",
    ],
    { ci: true },
  );
  results.push(
    ...configurationChecks({
      promotions,
      quotas,
      admission: admission[0],
      seats: seats[0].taken,
    }),
  );
  return results;
}

async function verify({ account, database, request, since, environment }) {
  const from = Math.floor(Date.parse(since) / 1000);
  const invoices = listAll(request, "/v1/invoices", {
    status: "paid",
    "created[gte]": from,
    expand: ["data.payments"],
  });
  const sessions = listAll(request, "/v1/checkout/sessions", {
    status: "complete",
    "created[gte]": from,
  }).filter(
    (session) =>
      session.mode === "payment" &&
      session.metadata?.offer === "lifetime" &&
      session.payment_status === "paid",
  );
  const charges = listAll(request, "/v1/charges", {
    "created[gte]": from,
    expand: ["data.balance_transaction"],
  });
  const fees = listAll(request, "/v1/balance_transactions", {
    type: "stripe_fee",
    "created[gte]": from,
  });
  const subscriptions = listAll(request, "/v1/subscriptions", { status: "all" }).filter(
    (subscription) => subscription.livemode === account.live && subscription.metadata?.workspace_id,
  );

  const known = Object.fromEntries(
    ["monthly", "annual"].map((offer) => [account.prices[offer], offer]),
  );
  const intervals = new Map();
  const priceOffer = (id) => {
    if (!id) return null;
    if (known[id]) return known[id];
    // Prezzo di una generazione precedente: vale la sua periodicità.
    if (!intervals.has(id))
      intervals.set(id, request("get", `/v1/prices/${id}`).recurring?.interval ?? null);
    return { month: "monthly", year: "annual" }[intervals.get(id)] ?? null;
  };

  const invoiceIds = invoices.map(({ id }) => id);
  const sessionIds = sessions.map(({ id }) => id);
  const [invoiceRows, sessionRows, subscriptionRows] = await d1Query(
    database,
    [
      `SELECT stripe_invoice_id AS id FROM workspace_entitlements
        WHERE stripe_invoice_id IN (${sqlIn(invoiceIds)})`,
      `SELECT stripe_checkout_session_id AS id FROM workspace_entitlements
        WHERE stripe_checkout_session_id IN (${sqlIn(sessionIds)})`,
      `SELECT id, workspace_id, status, offer, renewal_offer, price_generation,
          current_period_end, cancel_at_period_end FROM stripe_subscriptions
        WHERE environment = ${literal(environment)}`,
    ],
    { ci: true },
  );

  const summary = feeSummary({
    charges,
    offers: paymentOffers({ invoices, sessions, priceOffer }),
    fees,
  });
  const results = [
    ...entitlementChecks({
      invoices,
      sessions,
      invoiceRights: new Set(invoiceRows.map(({ id }) => id)),
      sessionRights: new Set(sessionRows.map(({ id }) => id)),
    }),
    subscriptionChecks(subscriptions, subscriptionRows),
    ...feeChecks(summary),
  ];
  const methods = methodChanges(subscriptions, invoices, charges);
  const notes = [
    `commissioni Managed Payments giornaliere lette: ${summary.managedEntries}`,
    `commissioni di dispute: ${summary.disputes ? "presenti" : "nessuna"}, altre: ${
      summary.other ? "presenti" : "nessuna"
    }`,
    `metodo cambiato: ${methods.changed} abbonamenti, ${methods.paidWithNew} con un pagamento successivo con il nuovo metodo`,
  ];
  return { results, notes };
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      mode: { type: "string", default: "test" },
      since: { type: "string" },
      "project-name": { type: "string" },
    },
  });
  if (!["test", "live"].includes(values.mode)) throw new Error("--mode accetta test o live.");
  const account = accountOf(values.mode);
  const { database } = databaseOf(values.mode);
  const request = cliRequest({ live: account.live, project: values["project-name"] });
  const [command] = positionals;
  let results;
  let notes = [];
  if (command === "preflight") results = await preflight({ account, database, request });
  else if (command === "verify") {
    if (!Number.isFinite(Date.parse(values.since ?? ""))) throw new Error("--since richiesto.");
    ({ results, notes } = await verify({
      account,
      database,
      request,
      since: values.since,
      environment: account.live ? "live" : "test",
    }));
  } else throw new Error("Comando non supportato: preflight o verify.");
  console.log(report(results));
  for (const note of notes) console.log(`· ${note}`);
  if (results.some(({ ok }) => !ok)) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]))
  await main();
