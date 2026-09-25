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
  return value.replace(/&(amp|lt|gt|quot|apos);/gu, (_, name: string) => xmlEntities[name]!).trim();
}

function xmlField(block: string, tag: string): string | null {
  const match = new RegExp(`<${tag}>([^<]*)</${tag}>`, "u").exec(block);
  return match ? xmlText(match[1]!) : null;
}

export function parseTradingOrderTaxIdentifiers(
  xml: string,
  orderId: string,
): TradingTaxIdentifier[] {
  const ack = xmlField(xml, "Ack");
  if (ack !== "Success" && ack !== "Warning") throw new Error("trading_get_orders_failed");

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
