import { UpstreamError, upstreamText } from "../http.server";
import type { EbayAccess } from "./environment.server";
import { orderObservationSchema, type OrderObservation } from "../../domain/order-import.server";
import { parseMinor } from "../../money";

/**
 * Trading resta circoscritto alle chiamate necessarie: `GetOrders` per gli acquisti prima del
 * checkout, le identità di riga e i dati fiscali, `GetItem` per l'immagine. Le risposte passano dal
 * confine HTTP e vengono rifiutate prima del parsing se troppo grandi, con byte NUL o con
 * dichiarazioni `DOCTYPE`/`ENTITY`.
 */
const tradingApiVersion = "1455";
const tradingSiteId = "101";
const tradingMaxBytes = 2_097_152;

// Codici eBay del token non più valido e del limite di chiamate raggiunto.
const credentialErrors = new Set(["931", "932", "17470", "21916984"]);
const rateLimitErrors = new Set(["518"]);

export type EbayTaxIdentifierObservation = {
  type: string;
  issuingCountry: string | null;
  value: string;
  source: "ebay_trading_get_orders";
};

export type TradingTaxIdentifier = {
  id: string;
  type: string;
  attributes?: ReadonlyArray<{ name: string; value: string }>;
};

const xmlEntities: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

function xmlText(value: string): string {
  return value
    .replace(
      /&(?:(amp|lt|gt|quot|apos)|#(\d{1,7})|#x([\da-f]{1,6}));/giu,
      (entity, name, dec, hex) => {
        if (name) return xmlEntities[name as string]!;
        const code = dec ? Number(dec) : Number.parseInt(hex as string, 16);
        return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
      },
    )
    .trim();
}

function xmlField(block: string, tag: string): string | null {
  const match = new RegExp(`<${tag}>([^<]*)</${tag}>`, "u").exec(block);
  return match ? xmlText(match[1]!) : null;
}

function escapeXml(value: string): string {
  return value.replace(
    /[<>&"']/gu,
    (char) => `&${Object.keys(xmlEntities).find((name) => xmlEntities[name] === char)};`,
  );
}

/** Rifiuta una risposta Trading che non si deve neppure analizzare. */
export function assertSafeTradingXml(xml: string): void {
  if (xml.length > tradingMaxBytes || xml.includes("\0") || /<!(?:DOCTYPE|ENTITY)/iu.test(xml)) {
    throw new UpstreamError("invalid_response");
  }
}

/**
 * Esito di una risposta Trading: `Success` e `Warning` sono letture valide; gli errori diventano
 * credenziali, limite di chiamate, indisponibilità o rifiuto, con il solo codice numerico eBay.
 */
export function tradingAck(xml: string): void {
  assertSafeTradingXml(xml);
  const ack = xmlField(xml, "Ack");
  if (ack === "Success" || ack === "Warning") return;
  if (ack !== "Failure" && ack !== "PartialFailure") throw new UpstreamError("invalid_response");
  const errors = [...xml.matchAll(/<Errors>([\s\S]*?)<\/Errors>/gu)]
    .map(([, block]) => ({
      code: xmlField(block!, "ErrorCode") ?? "",
      severity: xmlField(block!, "SeverityCode"),
      system: xmlField(block!, "ErrorClassification") === "SystemError",
    }))
    .filter(({ severity }) => severity !== "Warning");
  // Un esito negativo senza errori leggibili è una risposta malformata.
  if (errors.length === 0) throw new UpstreamError("invalid_response");
  const providerCode = errors.find(({ code }) => /^\d{1,12}$/u.test(code))?.code;
  if (errors.some(({ code }) => credentialErrors.has(code))) {
    throw new UpstreamError("credentials", { providerCode });
  }
  if (errors.some(({ code }) => rateLimitErrors.has(code))) {
    throw new UpstreamError("rate_limited", { providerCode });
  }
  if (errors.some(({ system }) => system)) throw new UpstreamError("unavailable", { providerCode });
  throw new UpstreamError("rejected", { providerCode });
}

async function tradingCall(access: EbayAccess, call: string, fields: string): Promise<string> {
  const xml = await upstreamText(
    access.fetcher,
    access.configuration.tradingUrl,
    {
      method: "POST",
      headers: {
        "content-type": "text/xml;charset=UTF-8",
        "x-ebay-api-call-name": call,
        "x-ebay-api-siteid": tradingSiteId,
        "x-ebay-api-compatibility-level": tradingApiVersion,
        "x-ebay-api-iaf-token": access.accessToken,
      },
      body:
        '<?xml version="1.0" encoding="utf-8"?>' +
        `<${call}Request xmlns="urn:ebay:apis:eBLBaseComponents">` +
        `<Version>${tradingApiVersion}</Version>${fields}</${call}Request>`,
    },
    { maxBytes: tradingMaxBytes },
  );
  tradingAck(xml);
  return xml;
}

/** Elenco Trading: include gli acquisti non ancora disponibili in Fulfillment. */
export async function readTradingOrders(
  access: EbayAccess,
  input: { from: string; until: string; page: number },
): Promise<{ orders: OrderObservation[]; total: number; more: boolean; skipped: number }> {
  const from = new Date(input.from).toISOString();
  const until = new Date(input.until).toISOString();
  if (from > until || !Number.isSafeInteger(input.page) || input.page < 1)
    throw new UpstreamError("invalid_response");
  const xml = await tradingCall(
    access,
    "GetOrders",
    `<DetailLevel>ReturnAll</DetailLevel><OrderRole>Seller</OrderRole><OrderStatus>All</OrderStatus>` +
      `<ModTimeFrom>${from}</ModTimeFrom><ModTimeTo>${until}</ModTimeTo>` +
      `<Pagination><EntriesPerPage>25</EntriesPerPage><PageNumber>${input.page}</PageNumber></Pagination>`,
  );
  return parseTradingOrders(xml);
}

/** Campi strutturati soltanto: le transazioni non contaminano i campi dell'ordine. */
export function parseTradingOrders(xml: string) {
  tradingAck(xml);
  const totalText = xmlField(xml, "TotalNumberOfEntries");
  const moreText = xmlField(xml, "HasMoreOrders");
  if (!totalText || !/^\d+$/u.test(totalText) || !["true", "false"].includes(moreText ?? ""))
    throw new UpstreamError("invalid_response");
  const orders: OrderObservation[] = [];
  let entries = 0;
  let skipped = 0;
  for (const [, block] of xml.matchAll(/<Order>([\s\S]*?)<\/Order>/gu)) {
    entries += 1;
    // Un ordine illeggibile si salta: gli altri della pagina restano acquisibili.
    try {
      const transactions =
        /<TransactionArray>([\s\S]*?)<\/TransactionArray>/u.exec(block!)?.[1] ?? "";
      const header = block!.replace(/<TransactionArray>[\s\S]*?<\/TransactionArray>/gu, "");
      const id = xmlField(header, "OrderID");
      const status = xmlField(header, "OrderStatus");
      const checkout = /<CheckoutStatus>([\s\S]*?)<\/CheckoutStatus>/u.exec(header)?.[1] ?? "";
      const total = /<Total currencyID="([A-Z]{3})">([^<]+)<\/Total>/u.exec(header);
      if (!id || !status || !total) throw new Error("invalid_order");
      const paid = !!xmlField(header, "PaidTime") || status === "Completed";
      const shipping = /<ShippingAddress>([\s\S]*?)<\/ShippingAddress>/u.exec(header)?.[1];
      const items = [...transactions.matchAll(/<Transaction>([\s\S]*?)<\/Transaction>/gu)].map(
        ([, transaction]) => {
          const item = /<Item>([\s\S]*?)<\/Item>/u.exec(transaction!)?.[1] ?? "";
          const itemId = xmlField(item, "ItemID");
          const transactionId = xmlField(transaction!, "TransactionID");
          const lineId = xmlField(transaction!, "OrderLineItemID");
          const stableKey = itemId && transactionId ? `${itemId}-${transactionId}` : lineId;
          if (lineId && stableKey !== lineId) throw new Error("conflicting_line_identity");
          const quantity = Number(xmlField(transaction!, "QuantityPurchased"));
          const price =
            /<TransactionPrice currencyID="([A-Z]{3})">([^<]+)<\/TransactionPrice>/u.exec(
              transaction!,
            );
          return {
            lineItemId: lineId ?? stableKey,
            stableKey,
            legacyItemId: itemId,
            title: xmlField(item, "Title") ?? "",
            sku: xmlField(item, "SKU"),
            quantity,
            total: price
              ? { minor: parseMinor(price[2]!, price[1]!) * quantity, currency: price[1]! }
              : null,
          };
        },
      );
      if (!items.length) throw new Error("missing_transactions");
      const taxBlocks = [
        ...header.matchAll(/<BuyerTaxIdentifier>([\s\S]*?)<\/BuyerTaxIdentifier>/gu),
      ];
      const validTax = taxBlocks.every(([, tax]) => xmlField(tax!, "ID") && xmlField(tax!, "Type"));
      orders.push(
        orderObservationSchema.parse({
          source: "trading",
          buyerEiasToken: xmlField(header, "EIASToken") || undefined,
          externalOrderId: id,
          provisional: !paid,
          creationTime: xmlField(header, "CreatedTime"),
          lastModifiedTime: xmlField(checkout, "LastModifiedTime"),
          total: { minor: parseMinor(total[2]!, total[1]!), currency: total[1] },
          paymentStatus: paid
            ? "PAID"
            : [
                  "Active",
                  "Incomplete",
                  "InProcess",
                  "Cancelled",
                  "Canceled",
                  "CancelPending",
                ].includes(status)
              ? "PENDING"
              : status,
          fulfillmentStatus: xmlField(header, "ShippedTime") ? "FULFILLED" : null,
          cancelStatus:
            ["Cancelled", "Canceled"].includes(status) ||
            xmlField(header, "CancelStatus") === "CancelClosedWithRefund"
              ? "CANCELED"
              : xmlField(header, "CancelStatus"),
          buyer: {
            username: xmlField(header, "BuyerUserID"),
            shipTo: shipping
              ? {
                  name: xmlField(shipping, "Name"),
                  phone: xmlField(shipping, "Phone"),
                  address: {
                    addressLine1: xmlField(shipping, "Street1"),
                    addressLine2: xmlField(shipping, "Street2"),
                    city: xmlField(shipping, "CityName"),
                    postalCode: xmlField(shipping, "PostalCode"),
                    stateOrProvince: xmlField(shipping, "StateOrProvince"),
                    countryCode: xmlField(shipping, "Country"),
                  },
                }
              : null,
          },
          items,
          taxIdentifiers: validTax
            ? {
                source: "ebay_trading_get_orders",
                complete: false,
                availability: taxBlocks.length ? "present" : "not_included",
                values: mapTradingTaxIdentifiers(parseTradingOrderTaxIdentifiers(xml, id)),
              }
            : {
                source: "ebay_trading_get_orders",
                complete: false,
                verification: "error",
                availability: "not_included",
                values: [],
              },
        }),
      );
    } catch {
      skipped += 1;
    }
  }
  if (
    !Number.isSafeInteger(Number(totalText)) ||
    Number(totalText) < entries ||
    new Set(orders.map((order) => order.externalOrderId)).size !== orders.length ||
    (moreText === "true" && !entries)
  )
    throw new UpstreamError("invalid_response");
  return { orders, total: Number(totalText), more: moreText === "true", skipped };
}

/** Identificativi fiscali dell'acquirente per un solo ordine, letti da `GetOrders`. */
export async function readTradingTaxIdentifiers(
  access: EbayAccess,
  orderId: string,
): Promise<EbayTaxIdentifierObservation[]> {
  return (await readTradingTaxObservation(access, orderId)).values;
}

/** Distingue ordine non restituito e ordine presente senza identificativi. */
export async function readTradingTaxObservation(access: EbayAccess, orderId: string) {
  const xml = await tradingCall(
    access,
    "GetOrders",
    "<DetailLevel>ReturnAll</DetailLevel><OrderRole>Seller</OrderRole><OrderStatus>All</OrderStatus>" +
      `<OrderIDArray><OrderID>${escapeXml(orderId)}</OrderID></OrderIDArray>`,
  );
  const matching = [...xml.matchAll(/<Order>([\s\S]*?)<\/Order>/gu)].filter(
    ([, order]) =>
      xmlField(order!, "OrderID") === orderId || xmlField(order!, "ExtendedOrderID") === orderId,
  );
  if (matching.length > 1) throw new UpstreamError("invalid_response");
  if (matching.length === 0) return { orderFound: false, lastModifiedTime: undefined, values: [] };
  const order = matching[0]![1]!;
  for (const [, block] of order.matchAll(
    /<BuyerTaxIdentifier>([\s\S]*?)<\/BuyerTaxIdentifier>/gu,
  )) {
    if (!xmlField(block!, "ID") || !xmlField(block!, "Type"))
      throw new UpstreamError("invalid_response");
  }
  return {
    orderFound: true,
    buyerEiasToken:
      xmlField(
        order.replace(/<TransactionArray>[\s\S]*?<\/TransactionArray>/gu, ""),
        "EIASToken",
      ) || undefined,
    lastModifiedTime: (() => {
      const checkout = /<CheckoutStatus>([\s\S]*?)<\/CheckoutStatus>/u.exec(order)?.[1];
      const value = checkout ? xmlField(checkout, "LastModifiedTime") : null;
      if (value === null) return undefined;
      const parsed = orderObservationSchema.shape.lastModifiedTime.safeParse(value);
      if (!parsed.success) throw new UpstreamError("invalid_response");
      return parsed.data;
    })(),
    values: mapTradingTaxIdentifiers(parseTradingOrderTaxIdentifiers(xml, orderId)),
  };
}

export function parseTradingOrderTaxIdentifiers(
  xml: string,
  orderId: string,
): TradingTaxIdentifier[] {
  tradingAck(xml);
  const identifiers: TradingTaxIdentifier[] = [];
  for (const [, order] of xml.matchAll(/<Order>([\s\S]*?)<\/Order>/gu)) {
    if (
      xmlField(order!, "OrderID") !== orderId &&
      xmlField(order!, "ExtendedOrderID") !== orderId
    ) {
      continue;
    }
    for (const [, block] of order!.matchAll(
      /<BuyerTaxIdentifier>([\s\S]*?)<\/BuyerTaxIdentifier>/gu,
    )) {
      const id = xmlField(block!, "ID");
      const type = xmlField(block!, "Type");
      if (!id || !type) continue;
      const attributes = [
        ...block!.matchAll(/<Attribute name="([^"]*)">([^<]*)<\/Attribute>/gu),
      ].map(([, name, value]) => ({ name: xmlText(name!), value: xmlText(value!) }));
      identifiers.push({ id, type, attributes });
    }
  }
  return identifiers;
}

export function mapTradingTaxIdentifiers(
  identifiers: ReadonlyArray<TradingTaxIdentifier>,
): EbayTaxIdentifierObservation[] {
  return identifiers.map(({ id, type, attributes = [] }) => ({
    type,
    issuingCountry: attributes.find(({ name }) => name === "IssuingCountry")?.value ?? null,
    value: id,
    source: "ebay_trading_get_orders",
  }));
}

const imageHosts = new Set(["i.ebayimg.com", "i.ebayimg.sandbox.ebay.com"]);

/**
 * URL di un'immagine eBay mostrabile così com'è: HTTPS, host delle immagini eBay, nessuna
 * credenziale o porta e formato raster. Altrimenti null, senza seguire o scaricare nulla.
 */
export function qualifiedImageUrl(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  return url.protocol === "https:" &&
    imageHosts.has(url.hostname) &&
    !url.port &&
    !url.username &&
    !url.password &&
    /\.(?:jpe?g|png|webp)$/iu.test(url.pathname)
    ? url.href
    : null;
}

/** Prima immagine qualificata dell'inserzione in una risposta `GetItem`. */
export function parseItemImage(xml: string): string | null {
  tradingAck(xml);
  const pictures = /<PictureDetails>([\s\S]*?)<\/PictureDetails>/u.exec(xml)?.[1] ?? "";
  for (const [, , url] of pictures.matchAll(/<(PictureURL|GalleryURL)>([^<]*)<\/\1>/gu)) {
    const qualified = qualifiedImageUrl(xmlText(url!));
    if (qualified) return qualified;
  }
  return null;
}

/** Immagine dell'inserzione da `GetItem` tramite l'ID legacy dell'articolo. */
export async function readItemImage(
  access: EbayAccess,
  legacyItemId: string,
): Promise<string | null> {
  return parseItemImage(
    await tradingCall(access, "GetItem", `<ItemID>${escapeXml(legacyItemId)}</ItemID>`),
  );
}
