import { z } from "zod";

import { buyerSnapshotSchema, type BuyerSnapshot } from "./order-import.server";
import { contactsView } from "../contact";
import { searchTokens } from "../orders/order-search";
import { taxComparisonKey, taxIdentifierType, taxQuality } from "../tax-quality";
import {
  fiscalSituations,
  paymentStatuses,
  shippingStatuses,
  type FiscalNotice,
  type FiscalSituation,
  type FiscalView,
  type OrderView,
  type PaymentStatus,
  type ShippingStatus,
  type SourceStatus,
  type SuggestionView,
  type TaxQuality,
} from "../view-models";
import { orderAccessSql } from "./grants.server";

/** Ordini letti al massimo in una richiesta: oltre servono i cursori dell'elenco. */
export const maxListedOrders = 300;
import { consultableStore } from "./store-state.server";
import { orderSuggestions } from "./order-suggestions.server";

export type PaymentState = "paid" | "unpaid" | "partially_refunded" | "refunded" | "unknown";
export type ShippingState = "to_ship" | "in_progress" | "shipped" | "cancelled" | "unknown";

const paymentStates: Record<string, PaymentState> = {
  PAID: "paid",
  PENDING: "unpaid",
  FAILED: "unpaid",
  PARTIALLY_REFUNDED: "partially_refunded",
  FULLY_REFUNDED: "refunded",
};
const shippingStates: Record<string, ShippingState> = {
  NOT_STARTED: "to_ship",
  IN_PROGRESS: "in_progress",
  FULFILLED: "shipped",
};

/**
 * Stato di pagamento normalizzato dall'originale eBay: un pagamento in attesa o fallito non è
 * incassato e un valore non previsto resta `unknown`. null se la fonte non l'ha fornito.
 */
export function paymentState(status: string | null): PaymentState | null {
  return status === null ? null : (paymentStates[status] ?? "unknown");
}

/** Stato di evasione normalizzato; un annullamento confermato prevale sull'evasione. */
export function shippingState(
  fulfillment: string | null,
  cancel: string | null,
): ShippingState | null {
  if (cancel === "CANCELED") return "cancelled";
  return fulfillment === null ? null : (shippingStates[fulfillment] ?? "unknown");
}

/**
 * Stati originali della fonte, la loro forma normalizzata e righe dell'ordine; null dove la
 * fonte non li ha forniti.
 */
export type OrderSummary = {
  buyer: BuyerSnapshot | null;
  orderPaymentStatus: string | null;
  orderFulfillmentStatus: string | null;
  payment: PaymentState | null;
  shipping: ShippingState | null;
  lineItems: Array<{
    lineItemId: string;
    title: string;
    quantity: number;
    sku: string | null;
    totalMinor: number | null;
    currency: string | null;
    imageUrl: string | null;
  }>;
};

export type VisibleOrder = {
  id: string;
  ebayOrderId: string;
  creationTime: string;
  lastModifiedTime: string;
  currency: string;
  totalMinor: number;
  storeId: string;
  storeName: string;
  marketplaceId: string | null;
  /** Acquisto non ancora pagato, consultabile soltanto con il filtro «Non pagato» (D180). */
  provisional: boolean;
  summary: OrderSummary;
  /**
   * Un ordine senza controllo fiscale e senza lettura in attesa non è stato verificato:
   * risulta una lettura non riuscita, da riprovare.
   */
  fiscalState: "available" | "locked" | "checking" | "missing" | "error";
  taxVerification: "unchecked" | "checking" | "completed" | "error";
  taxAvailability: "unknown" | "present" | "absent" | "not_included" | "masked" | "removed";
  taxCheckedAt: string | null;
  firstTaxAvailableAt: string | null;
  /** Nome del dato prima dello sblocco: Partita IVA solo se l'ordine ha soltanto quella. */
  lockedShownAs: "CF" | "PIVA";
  reconciliationIssue: boolean;
  suggestions?: SuggestionView[];
  suggestionStatus?: "identity_missing" | "none" | "ambiguous";
  taxIdentifiers: Array<{
    type: string;
    issuingCountry: string | null;
    value: string;
    source: string;
    observedAt: string;
    quality: TaxQuality;
    updated: boolean;
  }>;
};

function isFulfillmentCf(tax: VisibleOrder["taxIdentifiers"][number]): boolean {
  // cfKey qualifica già il Paese prima del confronto fra le fonti.
  return tax.source === "ebay_fulfillment" && tax.type === "CODICE_FISCALE";
}

/**
 * Tipo dell'identificativo come in `taxIdentifierType`: CF e Partita IVA italiani, anche
 * con Paese omesso dove la fonte lo ammette; gli altri restano distinti per tipo e Paese.
 */
const taxKind = (table: string) => `CASE
  WHEN ${table}.issuing_country IS NOT NULL AND ${table}.issuing_country <> 'IT'
    THEN json_array(${table}.identifier_type, ${table}.issuing_country)
  WHEN ${table}.identifier_type IN ('CODICE_FISCALE', 'CodiceFiscale') THEN 'CF'
  WHEN ${table}.identifier_type = 'PartitaIVA'
    OR (${table}.issuing_country = 'IT' AND ${table}.identifier_type IN ('VAT_ID', 'VATIN')) THEN 'PIVA'
  ELSE json_array(${table}.identifier_type, ${table}.issuing_country) END`;

function summaryOf(row: {
  buyer_json: string | null;
  payment_status: string | null;
  fulfillment_status: string | null;
  cancel_status: string | null;
  items_json: string;
}): OrderSummary {
  return {
    buyer: row.buyer_json ? buyerSnapshotSchema.parse(JSON.parse(row.buyer_json)) : null,
    orderPaymentStatus: row.payment_status,
    orderFulfillmentStatus: row.fulfillment_status,
    payment: paymentState(row.payment_status),
    shipping: shippingState(row.fulfillment_status, row.cancel_status),
    lineItems: JSON.parse(row.items_json),
  };
}

/** Criteri dell'elenco, già validati: un valore assente non filtra. */
export type OrderCriteria = {
  storeId?: string;
  marketplace?: string;
  /** Ordini creati da questo istante in poi. */
  since?: string;
  payment?: PaymentStatus;
  shipping?: ShippingStatus;
  fiscal?: FiscalSituation;
  /** Parole cercate nella forma di confronto: ognuna deve comparire nei dati consultabili. */
  tokens?: string[];
  /** Ordini entrati negli elenchi fino a questo istante: l'istantanea dell'elenco aperto. */
  listedBefore?: string;
  /** Ordini entrati negli elenchi dopo questo istante: i nuovi rispetto all'istantanea. */
  listedAfter?: string;
};

// Stryker disable next-line StringLiteral: un altro separatore rende la query invalida e le prove falliscono subito; sotto Stryker il worker supera invece il timeout.
const clauseSeparator = " ";

const caseOf = (column: string, states: Record<string, string>) =>
  `CASE ${column} ${Object.entries(states)
    .map(([original, state]) => `WHEN '${original}' THEN '${state}'`)
    .join(clauseSeparator)} END`;

/** Stato normalizzato in SQL dalle stesse tabelle di `paymentState` e `shippingState`. */
const paymentSql = caseOf("o.payment_status", paymentStates);
const shippingSql = `CASE WHEN o.cancel_status = 'CANCELED' THEN 'cancelled'
  ELSE ${caseOf("o.fulfillment_status", shippingStates)} END`;

/** Accesso ai valori fiscali dell'ordine all'istante ?3, nello spazio della riga. */
const accessSql = orderAccessSql("o.id", "wm.workspace_id", "?3");

/** Colonna dell'ultima verifica fiscale dell'ordine, anche degli acquisti confluiti. */
const latestCheckSql = (column: "availability" | "verification") =>
  `(SELECT tc.${column} FROM order_tax_checks tc JOIN orders original ON original.id = tc.order_id
     WHERE original.id = o.id OR original.merged_into = o.id
     ORDER BY tc.observed_at DESC, tc.source LIMIT 1)`;

/**
 * Situazione fiscale come in `listVisibleOrders` e `fiscalView`: identificativi autorizzati o
 * da sbloccare, poi lettura non riuscita, in corso, conclusa senza dato (acquirente con
 * fatturazione estera o dato non riportato da eBay) o mai conclusa (da riprovare).
 */
const fiscalSql = `CASE
  WHEN EXISTS (SELECT 1 FROM tax_identifiers WHERE order_id = o.id AND removed_at IS NULL)
    THEN CASE WHEN ${accessSql} THEN 'available' ELSE 'locked' END
  WHEN EXISTS (SELECT 1 FROM order_source_refs r WHERE r.order_id = o.id AND r.detail_error IS NOT NULL)
    OR ${latestCheckSql("verification")} = 'error' THEN 'error'
  WHEN EXISTS (SELECT 1 FROM order_source_refs r WHERE r.order_id = o.id
    AND r.source = 'fulfillment' AND r.detail_for IS NOT r.last_modified_time) THEN 'checking'
  WHEN EXISTS (SELECT 1 FROM order_tax_checks tc JOIN orders original ON original.id = tc.order_id
         WHERE original.id = o.id OR original.merged_into = o.id)
    THEN CASE WHEN ${latestCheckSql("availability")} NOT IN ('masked', 'removed')
      AND json_extract(o.buyer_json, '$.billingAddress.countryCode') NOT IN ('', 'IT')
      THEN 'foreign' ELSE 'missing' END
  ELSE 'error' END`;

/**
 * Testo cercabile di un ordine che la manutenzione non ha ancora indicizzato: le stesse parti
 * di `orderSearchText`, con le sole minuscole ASCII di SQLite.
 */
const unindexedSearchSql = `lower(o.ebay_order_id || ' ' || COALESCE(json_extract(o.buyer_json, '$.name'), '')
  || ' ' || COALESCE(json_extract(o.buyer_json, '$.username'), '') || ' '
  || COALESCE((SELECT group_concat(title || ' ' || COALESCE(sku, ''), ' ')
       FROM order_items WHERE order_id = o.id), ''))`;

/**
 * La parola `token.value` manca dall'ordine: né nel testo cercabile né, se autorizzati, nei
 * valori fiscali, confrontati anche senza spazi. Un valore da sbloccare non trova l'ordine.
 */
const tokenMissingSql = `instr(COALESCE(o.search_text, ${unindexedSearchSql}), token.value) = 0
  AND NOT (${accessSql} AND EXISTS (SELECT 1 FROM tax_identifiers t
    WHERE t.order_id = o.id AND t.removed_at IS NULL
      AND instr(lower(t.value || ' ' || replace(t.value, ' ', '')), token.value) > 0))`;

/**
 * Ordini consultabili dello spazio: utente ?1, ambiente ?2, istante ?3, ID ?6, criteri da ?7,
 * acquisti non pagati ?14 e istantanea da ?15. Un ordine senza istante d'ingresso negli elenchi
 * è stato letto prima che venisse registrato e vale come già presente. Ogni percorso (elenco, conteggio, facet, suggerimenti) applica gli
 * stessi controlli di negozio e conservazione. Un acquisto non pagato resta fuori, salvo con
 * il filtro «Non pagato» o quando l'elenco lo mostra (D180).
 */
const visibleOrdersSql = `FROM workspace_members wm
   JOIN ebay_stores s ON s.workspace_id = wm.workspace_id
   JOIN orders o ON o.store_id = s.id
  WHERE wm.user_id = ?1 AND s.ebay_environment = ?2 AND ${consultableStore("s")}
    AND o.retention_until > ?3
    AND o.merged_into IS NULL
    AND (o.is_provisional = 0 OR ?10 = 'unpaid' OR ?14 = 1)
    AND (?6 IS NULL OR o.id IN (SELECT value FROM json_each(?6)))
    AND (?7 IS NULL OR o.store_id = ?7)
    AND (?8 IS NULL OR o.marketplace_id = ?8)
    AND (?9 IS NULL OR o.creation_time >= ?9)
    AND (?10 IS NULL OR ${paymentSql} = ?10)
    AND (?11 IS NULL OR ${shippingSql} = ?11)
    AND (?12 IS NULL OR ${fiscalSql} = ?12)
    AND NOT EXISTS (SELECT 1 FROM json_each(COALESCE(?13, '[]')) token WHERE ${tokenMissingSql})
    AND (?15 IS NULL OR o.listed_at IS NULL OR o.listed_at <= ?15)
    AND (?16 IS NULL OR o.listed_at > ?16)`;

function visibleOrdersParams(
  userId: string,
  ebayEnvironment: "production" | "sandbox",
  now: Date,
  limit: number,
  ids: string[] | undefined,
  criteria: OrderCriteria,
  provisional = false,
) {
  return [
    userId,
    ebayEnvironment,
    now.toISOString(),
    limit,
    now.toISOString(),
    ids ? JSON.stringify(ids) : null,
    criteria.storeId ?? null,
    criteria.marketplace ?? null,
    criteria.since ?? null,
    criteria.payment ?? null,
    criteria.shipping ?? null,
    criteria.fiscal ?? null,
    criteria.tokens?.length ? JSON.stringify(criteria.tokens) : null,
    provisional ? 1 : 0,
    criteria.listedBefore ?? null,
    criteria.listedAfter ?? null,
  ];
}

/** Ordini che soddisfano i criteri, senza leggerli. */
export async function countVisibleOrders(
  db: D1Database,
  userId: string,
  ebayEnvironment: "production" | "sandbox",
  now: Date,
  criteria: OrderCriteria = {},
): Promise<number> {
  // Un aggregato restituisce sempre una riga, anche senza ordini.
  const row = await db
    .prepare(`SELECT count(*) AS total ${visibleOrdersSql}`)
    .bind(...visibleOrdersParams(userId, ebayEnvironment, now, 0, undefined, criteria))
    .first<{ total: number }>();
  return row!.total;
}

/**
 * Dati dell'intero elenco consultabile, indipendenti dai criteri: quanti ordini esistono, i
 * marketplace da offrire fra i filtri e se qualche ordine ha un dato da sbloccare.
 */
export async function visibleOrderFacets(
  db: D1Database,
  userId: string,
  ebayEnvironment: "production" | "sandbox",
  now: Date,
): Promise<{ total: number; marketplaces: string[]; locked: boolean }> {
  const row = await db
    .prepare(
      `SELECT count(*) AS total,
              json_group_array(DISTINCT o.marketplace_id) FILTER (WHERE o.marketplace_id IS NOT NULL)
                AS marketplaces,
              MAX(${fiscalSql} = 'locked') AS locked
         ${visibleOrdersSql}`,
    )
    .bind(...visibleOrdersParams(userId, ebayEnvironment, now, 0, undefined, {}))
    .first<{ total: number; marketplaces: string; locked: number | null }>();
  // Un aggregato restituisce sempre una riga; senza ordini l'elenco è vuoto e `locked` è null.
  const { total, marketplaces, locked } = row!;
  return {
    total,
    marketplaces: z.array(z.string()).parse(JSON.parse(marketplaces)).sort(),
    locked: locked === 1,
  };
}

/** Ordine proposto dalla ricerca della barra superiore, con i soli dati non fiscali. */
export type OrderSearchMatch = {
  id: string;
  ebayOrderId: string;
  buyerName: string;
  detail: string;
};

/**
 * Primi ordini della ricerca e loro numero, con lo stesso filtro dell'elenco: la barra
 * superiore propone ciò che «Vedi tutti» mostra, senza leggere gli ordini completi.
 */
export async function searchVisibleOrders(
  db: D1Database,
  userId: string,
  ebayEnvironment: "production" | "sandbox",
  now: Date,
  tokens: string[],
  limit = 5,
): Promise<{ items: OrderSearchMatch[]; total: number }> {
  const criteria = { tokens };
  const [result, total] = await Promise.all([
    db
      .prepare(
        `SELECT o.id, o.ebay_order_id,
                COALESCE(json_extract(o.buyer_json, '$.name'), json_extract(o.buyer_json, '$.username'), '')
                  AS buyer_name,
                COALESCE((SELECT title FROM order_items WHERE order_id = o.id ORDER BY rowid LIMIT 1), '')
                  AS detail
           ${visibleOrdersSql}
          ORDER BY o.creation_time DESC, o.id DESC
          LIMIT ?4`,
      )
      .bind(...visibleOrdersParams(userId, ebayEnvironment, now, limit, undefined, criteria))
      .all<{ id: string; ebay_order_id: string; buyer_name: string; detail: string }>(),
    countVisibleOrders(db, userId, ebayEnvironment, now, criteria),
  ]);
  return {
    items: result.results.map((row) => ({
      id: row.id,
      ebayOrderId: row.ebay_order_id,
      buyerName: row.buyer_name,
      detail: row.detail,
    })),
    total,
  };
}

/**
 * Ordini consultabili dello spazio dell'utente, dal più recente per data ordine, fino a `limit`.
 * Con `ids` si leggono soltanto quelli indicati; i criteri filtrano nella stessa query, con gli
 * stessi controlli di spazio, negozio e conservazione. `provisional` ammette anche gli acquisti
 * non pagati, come il filtro «Non pagato».
 */
export async function listVisibleOrders(
  db: D1Database,
  userId: string,
  requestedLimit = 50,
  ebayEnvironment: "production" | "sandbox" = "production",
  now = new Date(),
  filter: { ids?: string[]; criteria?: OrderCriteria; provisional?: boolean } = {},
): Promise<VisibleOrder[]> {
  const limit = Math.max(1, Math.min(maxListedOrders, Math.trunc(requestedLimit)));
  const result = await db
    .prepare(
      `WITH visible_orders AS (
         SELECT o.id, wm.workspace_id ${visibleOrdersSql}
          ORDER BY o.creation_time DESC, o.id DESC
          LIMIT ?4
       )
       SELECT o.id, o.ebay_order_id, o.creation_time, o.last_modified_time,
              o.currency, o.total_minor, o.buyer_json, o.payment_status, o.fulfillment_status,
              o.cancel_status, o.store_id, o.marketplace_id, o.is_provisional,
              (SELECT json_object('availability', availability, 'at', observed_at, 'verification', verification)
                 FROM order_tax_checks tc JOIN orders original ON original.id = tc.order_id
                WHERE original.id = o.id OR original.merged_into = o.id
                ORDER BY tc.observed_at DESC, tc.source LIMIT 1) AS tax_check_json,
              EXISTS (SELECT 1 FROM order_source_refs r WHERE r.order_id = o.id
                AND r.detail_error IS NOT NULL) AS tax_error,
              EXISTS (SELECT 1 FROM order_source_refs r WHERE r.order_id = o.id
                AND r.source = 'fulfillment' AND r.detail_for IS NOT r.last_modified_time) AS tax_pending,
              (SELECT MIN(t.observed_at) FROM tax_identifiers t JOIN orders original ON original.id = t.order_id
                WHERE original.id = o.id OR original.merged_into = o.id) AS first_tax_available_at,
              (EXISTS (SELECT 1 FROM order_reconciliation_issues i
                WHERE i.order_id = o.id OR i.related_order_id = o.id)
               OR EXISTS (SELECT 1 FROM order_items i WHERE i.order_id = o.id AND i.stable_key IS NULL)) AS reconciliation_issue,
              (SELECT json_group_array(json_object('lineItemId', line_item_id, 'title', title,
                        'quantity', quantity, 'sku', sku, 'totalMinor', total_minor,
                        'currency', currency, 'imageUrl', image_url))
                 FROM (SELECT * FROM order_items WHERE order_id = o.id ORDER BY rowid)) AS items_json,
              COALESCE(s.display_name, s.ebay_account_id, s.ebay_user_id) ||
                CASE WHEN s.ebay_environment = 'sandbox' THEN ' (Sandbox)' ELSE '' END AS store_name,
              EXISTS (SELECT 1 FROM tax_identifiers
                       WHERE order_id = o.id AND removed_at IS NULL) AS has_identifiers,
              NOT EXISTS (SELECT 1 FROM tax_identifiers
                           WHERE order_id = o.id AND removed_at IS NULL
                             AND NOT (identifier_type = 'PartitaIVA' AND (issuing_country IS NULL OR issuing_country = 'IT')
                               OR identifier_type IN ('VAT_ID', 'VATIN') AND issuing_country = 'IT')) AS vat_only,
              ${orderAccessSql("o.id", "vo.workspace_id", "?5")} AS grant_id, ti.identifier_type,
              EXISTS (SELECT 1 FROM tax_identifiers previous
                JOIN orders original ON original.id = previous.order_id
                WHERE (original.id = o.id OR original.merged_into = o.id)
                AND previous.source = ti.source
                AND ${taxKind("previous")} = ${taxKind("ti")}
                AND previous.removed_at <= ti.observed_at) AS tax_updated,
              ti.issuing_country, ti.value, ti.source, ti.observed_at
         FROM visible_orders vo
         JOIN orders o ON o.id = vo.id
         JOIN ebay_stores s ON s.id = o.store_id
         LEFT JOIN tax_identifiers ti
           ON ti.order_id = o.id AND ti.removed_at IS NULL
             AND ${orderAccessSql("o.id", "vo.workspace_id", "?5")}
        ORDER BY o.creation_time DESC, o.id DESC, ti.identifier_type, ti.issuing_country DESC`,
    )
    .bind(
      ...visibleOrdersParams(
        userId,
        ebayEnvironment,
        now,
        limit,
        filter.ids,
        filter.criteria ?? {},
        filter.provisional,
      ),
    )
    .all<{
      id: string;
      ebay_order_id: string;
      creation_time: string;
      last_modified_time: string;
      currency: string;
      total_minor: number;
      buyer_json: string | null;
      payment_status: string | null;
      fulfillment_status: string | null;
      cancel_status: string | null;
      tax_check_json: string | null;
      tax_error: number;
      tax_pending: number;
      first_tax_available_at: string | null;
      tax_updated: number;
      vat_only: number;
      reconciliation_issue: number;
      store_id: string;
      marketplace_id: string | null;
      is_provisional: number;
      items_json: string;
      store_name: string;
      has_identifiers: number;
      grant_id: number;
      identifier_type: string | null;
      issuing_country: string | null;
      value: string | null;
      source: string | null;
      observed_at: string | null;
    }>();

  const orders = new Map<string, VisibleOrder>();
  for (const row of result.results) {
    const check = row.tax_check_json
      ? (JSON.parse(row.tax_check_json) as {
          availability: VisibleOrder["taxAvailability"];
          at: string;
          verification: "completed" | "error";
        })
      : null;
    const verification =
      row.tax_error || check?.verification === "error"
        ? "error"
        : row.tax_pending
          ? "checking"
          : check
            ? "completed"
            : "unchecked";
    const order = orders.get(row.id) ?? {
      id: row.id,
      ebayOrderId: row.ebay_order_id,
      creationTime: row.creation_time,
      lastModifiedTime: row.last_modified_time,
      currency: row.currency,
      totalMinor: row.total_minor,
      storeId: row.store_id,
      storeName: row.store_name,
      marketplaceId: row.marketplace_id,
      provisional: row.is_provisional === 1,
      summary: summaryOf(row),
      fiscalState: row.has_identifiers
        ? row.grant_id
          ? "available"
          : "locked"
        : verification === "completed"
          ? "missing"
          : verification === "unchecked"
            ? "error"
            : verification,
      taxVerification: verification,
      taxAvailability: check?.availability ?? (row.has_identifiers ? "present" : "unknown"),
      taxCheckedAt: check?.at ?? null,
      firstTaxAvailableAt: row.first_tax_available_at,
      lockedShownAs: row.has_identifiers && row.vat_only ? "PIVA" : "CF",
      reconciliationIssue: !!row.reconciliation_issue,
      taxIdentifiers: [],
    };
    // Le colonne dell'identificativo sono tutte presenti o tutte assenti (join senza grant).
    if (row.identifier_type !== null) {
      const { buyer } = order.summary;
      order.taxIdentifiers.push({
        type: row.identifier_type,
        issuingCountry: row.issuing_country,
        value: row.value!,
        source: row.source!,
        observedAt: row.observed_at!,
        quality: taxQuality(
          { type: row.identifier_type, issuingCountry: row.issuing_country, value: row.value! },
          [buyer?.name, buyer?.shipTo?.name],
        ),
        updated: !!row.tax_updated,
      });
    }
    orders.set(row.id, order);
  }
  const visible = [...orders.values()].map((order) => {
    const primary = new Map<string, VisibleOrder["taxIdentifiers"][number]>();
    const cfKey = (tax: VisibleOrder["taxIdentifiers"][number]) =>
      taxIdentifierType(tax.type, tax.issuingCountry) === "CF" &&
      (tax.source === "ebay_trading_get_orders" || isFulfillmentCf(tax))
        ? taxComparisonKey({ ...tax, issuingCountry: "IT" })
        : null;
    for (const tax of order.taxIdentifiers) {
      const key = cfKey(tax);
      if (key === null) continue;
      const previous = primary.get(key);
      const updated = !!previous?.updated || tax.updated;
      if (
        !previous ||
        (isFulfillmentCf(tax) && !isFulfillmentCf(previous)) ||
        (tax.source === previous.source && tax.issuingCountry === "IT")
      ) {
        tax.updated = updated;
        primary.set(key, tax);
      } else previous.updated = updated;
    }
    return {
      ...order,
      // Le osservazioni restano nel database; la consultazione sceglie il CF più completo.
      taxIdentifiers: order.taxIdentifiers.filter((tax) => {
        const key = cfKey(tax);
        return key === null || primary.get(key) === tax;
      }),
    };
  });
  const suggestions = await orderSuggestions(
    db,
    userId,
    // Un acquisto non pagato non riceve suggerimenti (D180).
    visible
      .filter((order) => order.fiscalState === "missing" && !order.provisional)
      .map((order) => order.id),
    ebayEnvironment,
    new Date(Math.max(now.getTime(), Date.now())),
  );
  return visible.map((order) => ({ ...order, ...suggestions.get(order.id) }));
}

/** Dato fiscale nella forma della pagina Ordini: valori presenti soltanto se autorizzati. */
function fiscalView(order: VisibleOrder): FiscalView {
  if (order.fiscalState === "available") {
    const notice: FiscalNotice | null =
      order.taxVerification === "error"
        ? "lastKnown"
        : order.taxVerification === "checking"
          ? "checking"
          : order.taxAvailability === "masked"
            ? "masked"
            : order.taxAvailability === "absent" || order.taxAvailability === "not_included"
              ? "notReturned"
              : null;
    return {
      state: "available",
      identifiers: order.taxIdentifiers.map((identifier) => {
        const type = taxIdentifierType(identifier.type, identifier.issuingCountry);
        return {
          type,
          ...(type === "OTHER" ? { typeLabel: identifier.type } : {}),
          value: identifier.value,
          quality: identifier.quality,
          updated: identifier.updated,
        };
      }),
      ...(notice ? { notice } : {}),
    };
  }
  if (order.fiscalState === "locked") {
    // Lo sblocco resta sospeso finché l'acquisto non è pagato (D174) o durante una nuova verifica.
    const hold = order.provisional
      ? ("unpaid" as const)
      : order.taxVerification === "checking"
        ? ("checking" as const)
        : null;
    return { state: "locked", shownAs: order.lockedShownAs, ...(hold ? { hold } : {}) };
  }
  if (order.fiscalState === "missing") {
    const reason = order.taxAvailability;
    if (reason === "masked" || reason === "removed") return { state: "missing", reason };
    const country = order.summary.buyer?.billingAddress?.countryCode;
    return country && country !== "IT"
      ? { state: "missing", reason: "foreign", country }
      : { state: "missing" };
  }
  return { state: order.fiscalState };
}

function sourceStatus<Status extends string>(
  status: Status | "unknown" | null,
  code: string | null,
): SourceStatus<Status> {
  return status === null || status === "unknown"
    ? // Senza stato normalizzato manca anche il codice originale.
      { status: null, code }
    : { status };
}

/** Luogo di consegna sintetico: città, provincia tra parentesi. */
function locality(address: NonNullable<BuyerSnapshot["shipTo"]>["address"]) {
  if (!address?.city) return null;
  return address.stateOrProvince ? `${address.city} (${address.stateOrProvince})` : address.city;
}

/**
 * Ordine persistito nella vista condivisa con l'anteprima. Prima riga d'indirizzo e località
 * compongono l'indirizzo di fatturazione; un dato non fornito da eBay resta null.
 */
export function orderView(order: VisibleOrder): OrderView {
  const buyer = order.summary.buyer;
  const billing = buyer?.billingAddress;
  const shipTo = buyer?.shipTo;
  const line = [billing?.addressLine1, billing?.addressLine2].filter(Boolean).join(", ");
  // La miniatura è la prima immagine d'inserzione disponibile fra gli articoli.
  const thumbnail = order.summary.lineItems.find((item) => item.imageUrl)?.imageUrl;
  const view: Omit<OrderView, "contacts"> = {
    id: order.id,
    ebayOrderId: order.ebayOrderId,
    createdAt: order.creationTime,
    storeId: order.storeId,
    storeName: order.storeName,
    marketplace: order.marketplaceId,
    buyerName: buyer?.name ?? null,
    buyerUsername: buyer?.username ?? null,
    shipTo: shipTo
      ? {
          name: shipTo.name,
          locality: locality(shipTo.address),
          country: shipTo.address?.countryCode ?? null,
        }
      : null,
    items: order.summary.lineItems.map((item) => ({
      id: item.lineItemId,
      title: item.title,
      sku: item.sku,
      quantity: item.quantity,
      // Un importo in un'altra valuta non si mostra come se fosse nella valuta dell'ordine.
      totalMinor: item.currency === order.currency ? item.totalMinor : null,
      currency: order.currency,
    })),
    totalMinor: order.totalMinor,
    currency: order.currency,
    payment: sourceStatus<PaymentStatus>(order.summary.payment, order.summary.orderPaymentStatus),
    shipping: sourceStatus<ShippingStatus>(
      order.summary.shipping,
      order.summary.orderFulfillmentStatus,
    ),
    billingAddress:
      billing && line && billing.city && billing.countryCode
        ? {
            line,
            postalCode: billing.postalCode ?? "",
            city: billing.city,
            province: billing.stateOrProvince,
            countryCode: billing.countryCode,
          }
        : null,
    phone: buyer?.phone ?? shipTo?.phone ?? null,
    email: buyer?.email ?? null,
    fiscal: fiscalView(order),
    suggestions: order.suggestions ?? [],
    ...(order.suggestionStatus ? { suggestionStatus: order.suggestionStatus } : {}),
    ...(order.reconciliationIssue ? { reconciliationIssue: true } : {}),
    ...(thumbnail ? { thumbnail } : {}),
    lastSyncedAt: order.taxCheckedAt,
  };
  return { ...view, contacts: contactsView(view) };
}

/**
 * Criteri dell'elenco dall'indirizzo: un valore sconosciuto, o un'opzione del piano Premium in
 * Free, vale come «Tutti». La ricerca, già decifrata, diventa un elenco di parole.
 */
export function orderCriteria(
  search: URLSearchParams,
  now: Date,
  plan: "free" | "premium",
  query: string | null = null,
): OrderCriteria {
  const known = <Value extends string>(name: string, values: readonly Value[]) => {
    const value = search.get(name);
    return values.find((candidate) => candidate === value);
  };
  const days = known("periodo", plan === "premium" ? ["7", "30", "90"] : ["7", "30"]);
  const tokens = searchTokens(query);
  const value = (name: string) => {
    const raw = search.get(name);
    return raw && raw.length <= 64 ? raw : undefined;
  };
  return {
    storeId: value("negozio"),
    marketplace: value("marketplace"),
    since: days ? new Date(now.getTime() - Number(days) * 86_400_000).toISOString() : undefined,
    payment: known("pagamento", paymentStatuses),
    shipping: known("spedizione", shippingStatuses),
    fiscal: known("fiscale", fiscalSituations),
    tokens: tokens.length ? tokens : undefined,
  };
}
