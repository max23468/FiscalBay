import { UpstreamError, upstreamText } from "../http.server";
import type { EbayAccess } from "./environment.server";

/**
 * Trading resta circoscritto alle chiamate necessarie: `GetOrders` per gli identificativi
 * fiscali dell'acquirente e `GetItem` per l'immagine dell'articolo. Le risposte passano dal
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
  for (const [, block] of (matching[0]?.[1] ?? "").matchAll(
    /<BuyerTaxIdentifier>([\s\S]*?)<\/BuyerTaxIdentifier>/gu,
  )) {
    if (!xmlField(block!, "ID") || !xmlField(block!, "Type"))
      throw new UpstreamError("invalid_response");
  }
  return {
    orderFound: matching.length === 1,
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
