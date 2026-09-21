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
