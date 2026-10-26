import { buyerSnapshotSchema, type BuyerSnapshot } from "./order-import.server";
import { buyerNameView } from "../contact";
import { maxListedOrders } from "../orders/order-list";
import { searchTokens } from "../orders/order-search";
import { buyerTaxKey, taxIdentifierType, taxQuality, taxTypeNames } from "../tax-quality";
import {
  fiscalSituations,
  orderPeriods,
  orderPeriodStart,
  paymentStatuses,
  premiumOrderPeriods,
  shippingStatuses,
  type FiscalSituation,
  type PaymentStatus,
  type ShippingStatus,
  type SuggestionView,
  type TaxQuality,
} from "../view-models";
import { orderAccessSql } from "./grants.server";
import type { EbayEnvironment } from "../integrations/ebay/environment.server";
import { consultableStore, storeLabelSql } from "./store-state.server";
import { orderSuggestions } from "./order-suggestions.server";
import { sqlList } from "./sql.server";

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
    /** Identità della riga: inizia con l'ID dell'inserzione eBay, quando la fonte lo fornisce. */
    stableKey: string | null;
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
   * Situazione fiscale calcolata dalla stessa espressione SQL dei filtri. Un ordine senza
   * controllo fiscale e senza lettura in attesa non è stato verificato: risulta una lettura non
   * riuscita, da riprovare.
   */
  fiscalState: FiscalSituation;
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
 * Tipo dell'identificativo come in `taxIdentifierType`, dagli stessi elenchi: CF e Partita IVA
 * italiani, anche con Paese omesso dove la fonte lo ammette; gli altri restano distinti per tipo
 * e Paese.
 */
const taxKind = (table: string) => `CASE
  WHEN ${table}.issuing_country IS NOT NULL AND ${table}.issuing_country <> 'IT'
    THEN json_array(${table}.identifier_type, ${table}.issuing_country)
  WHEN ${table}.identifier_type IN (${sqlList(taxTypeNames.cf)}) THEN 'CF'
  WHEN ${table}.identifier_type IN (${sqlList(taxTypeNames.vat)})
    OR (${table}.issuing_country = 'IT'
      AND ${table}.identifier_type IN (${sqlList(taxTypeNames.italianVat)})) THEN 'PIVA'
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
  /** Ordini che nell'elenco seguono questo, dal più recente con spareggio per ID. */
  after?: { creationTime: string; id: string };
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
 * Verifica fiscale dell'ordine: lettura non riuscita, in corso, conclusa o mai avvenuta.
 */
const verificationSql = `CASE
  WHEN EXISTS (SELECT 1 FROM order_source_refs r WHERE r.order_id = o.id AND r.detail_error IS NOT NULL)
    OR ${latestCheckSql("verification")} = 'error' THEN 'error'
  WHEN EXISTS (SELECT 1 FROM order_source_refs r WHERE r.order_id = o.id
    AND r.source = 'fulfillment' AND r.detail_for IS NOT r.last_modified_time) THEN 'checking'
  WHEN EXISTS (SELECT 1 FROM order_tax_checks tc JOIN orders original ON original.id = tc.order_id
         WHERE original.id = o.id OR original.merged_into = o.id) THEN 'completed'
  ELSE 'unchecked' END`;

/**
 * Unica definizione della situazione fiscale, per i filtri e per l'elenco: identificativi
 * autorizzati con `access` o da sbloccare, altrimenti lo stato della verifica. Una verifica
 * conclusa senza dato distingue l'acquirente con fatturazione estera dal dato non riportato da
 * eBay; una mai conclusa è da riprovare.
 */
const fiscalSql = (access: string) => `CASE
  WHEN EXISTS (SELECT 1 FROM tax_identifiers WHERE order_id = o.id AND removed_at IS NULL)
    THEN CASE WHEN ${access} THEN 'available' ELSE 'locked' END
  ELSE CASE ${verificationSql}
    WHEN 'completed' THEN CASE WHEN ${latestCheckSql("availability")} NOT IN ('masked', 'removed')
      AND json_extract(o.buyer_json, '$.billingAddress.countryCode') NOT IN ('', 'IT')
      THEN 'foreign' ELSE 'missing' END
    WHEN 'checking' THEN 'checking'
    ELSE 'error' END END`;

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
 * Ordini consultabili dello spazio: utente ?1, ambiente ?2, istante ?3, ID ?5, criteri da ?6,
 * acquisti non pagati ?12, istantanea da ?13 e posizione nell'elenco da ?15. Un ordine senza
 * istante d'ingresso negli elenchi è stato letto prima che venisse registrato e vale come già
 * presente. Ogni percorso (elenco, conteggio, facet, suggerimenti) applica gli stessi controlli
 * di negozio e conservazione. Un acquisto non pagato resta fuori, salvo con
 * il filtro «Non pagato» o quando l'elenco lo mostra (D180).
 */
// `+o.merged_into` esclude quell'indice: il piano parte dai negozi dello spazio e legge i loro
// ordini per negozio, invece di scorrere gli ordini non uniti di tutti gli spazi.
const visibleOrdersSql = `FROM workspace_members wm
   JOIN ebay_stores s ON s.workspace_id = wm.workspace_id
   JOIN orders o ON o.store_id = s.id
  WHERE wm.user_id = ?1 AND s.ebay_environment = ?2 AND ${consultableStore("s")}
    AND o.retention_until > ?3
    AND +o.merged_into IS NULL
    AND (o.is_provisional = 0 OR ?8 = 'unpaid' OR ?12 = 1)
    AND (?5 IS NULL OR o.id IN (SELECT value FROM json_each(?5)))
    AND (?6 IS NULL OR o.store_id = ?6)
    AND (?7 IS NULL OR o.creation_time >= ?7)
    AND (?8 IS NULL OR ${paymentSql} = ?8)
    AND (?9 IS NULL OR ${shippingSql} = ?9)
    AND (?10 IS NULL OR ${fiscalSql(accessSql)} = ?10)
    AND NOT EXISTS (SELECT 1 FROM json_each(COALESCE(?11, '[]')) token WHERE ${tokenMissingSql})
    AND (?13 IS NULL OR o.listed_at IS NULL OR o.listed_at <= ?13)
    AND (?14 IS NULL OR o.listed_at > ?14)
    AND (?15 IS NULL OR o.creation_time < ?15 OR (o.creation_time = ?15 AND o.id < ?16))`;

function visibleOrdersParams(
  userId: string,
  ebayEnvironment: EbayEnvironment,
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
    ids ? JSON.stringify(ids) : null,
    criteria.storeId ?? null,
    criteria.since ?? null,
    criteria.payment ?? null,
    criteria.shipping ?? null,
    criteria.fiscal ?? null,
    criteria.tokens?.length ? JSON.stringify(criteria.tokens) : null,
    provisional ? 1 : 0,
    criteria.listedBefore ?? null,
    criteria.listedAfter ?? null,
    criteria.after?.creationTime ?? null,
    criteria.after?.id ?? null,
  ];
}

/** Ordini che soddisfano i criteri, senza leggerli. */
export async function countVisibleOrders(
  db: D1Database,
  userId: string,
  ebayEnvironment: EbayEnvironment,
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
 * Dati dell'intero elenco consultabile, indipendenti dai criteri: quanti ordini esistono e se
 * qualche ordine ha un dato da sbloccare.
 */
export async function visibleOrderFacets(
  db: D1Database,
  userId: string,
  ebayEnvironment: EbayEnvironment,
  now: Date,
): Promise<{ total: number; locked: boolean }> {
  const row = await db
    .prepare(
      `SELECT count(*) AS total, MAX(${fiscalSql(accessSql)} = 'locked') AS locked ${visibleOrdersSql}`,
    )
    .bind(...visibleOrdersParams(userId, ebayEnvironment, now, 0, undefined, {}))
    .first<{ total: number; locked: number | null }>();
  // Un aggregato restituisce sempre una riga; senza ordini `locked` è null.
  const { total, locked } = row!;
  return { total, locked: locked === 1 };
}

/**
 * Negozio e situazione fiscale di un ordine consultabile dall'utente nell'ambiente, anche non
 * pagato come con il filtro «Non pagato»; null per un ordine che l'utente non può consultare.
 */
export async function visibleOrderState(
  db: D1Database,
  userId: string,
  ebayEnvironment: EbayEnvironment,
  id: string,
  now = new Date(),
): Promise<{ storeId: string; fiscalState: FiscalSituation } | null> {
  const row = await db
    .prepare(`SELECT o.store_id, ${fiscalSql(accessSql)} AS fiscal_state ${visibleOrdersSql}`)
    .bind(...visibleOrdersParams(userId, ebayEnvironment, now, 1, [id], {}, true))
    .first<{ store_id: string; fiscal_state: FiscalSituation }>();
  return row ? { storeId: row.store_id, fiscalState: row.fiscal_state } : null;
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
  ebayEnvironment: EbayEnvironment,
  now: Date,
  tokens: string[],
  limit = 5,
): Promise<{ items: OrderSearchMatch[]; total: number }> {
  const criteria = { tokens };
  const [result, total] = await Promise.all([
    db
      .prepare(
        `SELECT o.id, o.ebay_order_id,
                json_extract(o.buyer_json, '$.name') AS buyer_name,
                json_extract(o.buyer_json, '$.username') AS buyer_username,
                COALESCE((SELECT title FROM order_items WHERE order_id = o.id ORDER BY rowid LIMIT 1), '')
                  AS detail
           ${visibleOrdersSql}
          ORDER BY o.creation_time DESC, o.id DESC
          LIMIT ?4`,
      )
      .bind(...visibleOrdersParams(userId, ebayEnvironment, now, limit, undefined, criteria))
      .all<{
        id: string;
        ebay_order_id: string;
        buyer_name: string | null;
        buyer_username: string | null;
        detail: string;
      }>(),
    countVisibleOrders(db, userId, ebayEnvironment, now, criteria),
  ]);
  return {
    items: result.results.map((row) => ({
      id: row.id,
      ebayOrderId: row.ebay_order_id,
      buyerName: buyerNameView(row.buyer_name) ?? row.buyer_username ?? "",
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
  ebayEnvironment: EbayEnvironment = "production",
  now = new Date(),
  filter: { ids?: string[]; criteria?: OrderCriteria; provisional?: boolean } = {},
): Promise<VisibleOrder[]> {
  const limit = Math.max(1, Math.min(maxListedOrders, Math.trunc(requestedLimit)));
  const listedAccessSql = orderAccessSql("o.id", "vo.workspace_id", "?3");
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
              ${verificationSql} AS tax_verification,
              ${fiscalSql(listedAccessSql)} AS fiscal_state,
              (SELECT MIN(t.observed_at) FROM tax_identifiers t JOIN orders original ON original.id = t.order_id
                WHERE original.id = o.id OR original.merged_into = o.id) AS first_tax_available_at,
              (EXISTS (SELECT 1 FROM order_reconciliation_issues i
                WHERE i.order_id = o.id OR i.related_order_id = o.id)
               OR EXISTS (SELECT 1 FROM order_items i WHERE i.order_id = o.id AND i.stable_key IS NULL)) AS reconciliation_issue,
              (SELECT json_group_array(json_object('lineItemId', line_item_id, 'title', title,
                        'quantity', quantity, 'sku', sku, 'totalMinor', total_minor,
                        'currency', currency, 'imageUrl', image_url,
                        'stableKey', stable_key))
                 FROM (SELECT * FROM order_items WHERE order_id = o.id ORDER BY rowid)) AS items_json,
              ${storeLabelSql("s")} AS store_name,
              NOT EXISTS (SELECT 1 FROM tax_identifiers t WHERE t.order_id = o.id
                AND t.removed_at IS NULL AND ${taxKind("t")} <> 'PIVA') AS vat_only,
              ti.identifier_type,
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
           ON ti.order_id = o.id AND ti.removed_at IS NULL AND ${listedAccessSql}
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
      tax_verification: VisibleOrder["taxVerification"];
      fiscal_state: FiscalSituation;
      first_tax_available_at: string | null;
      tax_updated: number;
      vat_only: number;
      reconciliation_issue: number;
      store_id: string;
      marketplace_id: string | null;
      is_provisional: number;
      items_json: string;
      store_name: string;
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
        })
      : null;
    const identified = row.fiscal_state === "available" || row.fiscal_state === "locked";
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
      fiscalState: row.fiscal_state,
      taxVerification: row.tax_verification,
      taxAvailability: check?.availability ?? (identified ? "present" : "unknown"),
      taxCheckedAt: check?.at ?? null,
      firstTaxAvailableAt: row.first_tax_available_at,
      lockedShownAs: identified && row.vat_only ? "PIVA" : "CF",
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
        ? buyerTaxKey(tax)
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
      .filter(
        (order) =>
          (order.fiscalState === "missing" || order.fiscalState === "foreign") &&
          !order.provisional,
      )
      .map((order) => order.id),
    ebayEnvironment,
    new Date(Math.max(now.getTime(), Date.now())),
  );
  return visible.map((order) => ({ ...order, ...suggestions.get(order.id) }));
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
  const period = known(
    "periodo",
    orderPeriods.filter((value) => plan === "premium" || !premiumOrderPeriods.has(value)),
  );
  const tokens = searchTokens(query);
  const value = (name: string) => {
    const raw = search.get(name);
    return raw && raw.length <= 64 ? raw : undefined;
  };
  return {
    storeId: value("negozio"),
    since: period ? orderPeriodStart(period, now).toISOString() : undefined,
    payment: known("pagamento", paymentStatuses),
    shipping: known("spedizione", shippingStatuses),
    fiscal: known("fiscale", fiscalSituations),
    tokens: tokens.length ? tokens : undefined,
  };
}
