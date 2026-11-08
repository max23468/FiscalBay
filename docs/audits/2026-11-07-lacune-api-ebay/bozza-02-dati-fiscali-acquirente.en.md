# Bozza 2: dati fiscali dell'acquirente nelle letture di elenco e nelle API moderne

**Dove:** nuovo ticket al supporto sviluppatori eBay, con riferimento a quello del 27 ottobre 2026; in alternativa il referente del Partner Program, se FiscalBay viene ammesso.

**Stato:** non inviata, superata dal [ticket inviato](README.md#ticket-inviato). Il punto 3 parte da una premessa corretta dopo la stesura: il CF non dipende da `GetOrders`, e le fatture combinate senza checkout eBay non hanno CF in nessuna fonte. Per un invio futuro restano utili i punti 1 e 2.

**Prima di un eventuale invio:** azione interna 1 del [dossier](README.md#azioni-interne-prima-degli-invii).

**Verifica:** 7 novembre 2026, specifica Fulfillment `v1.20.7` e schema GraphQL `listing.graphqls`; prove del 10 e del 27 ottobre nel [confronto fiscale](../../reference/EBAY_TAX_COMPARISON.md).

**Dati:** nessun ID, negozio o valore fiscale; nessuna affermazione normativa oltre il bisogno generale di fatturazione.

---

**Subject:** Buyer tax identifier: parity in the GraphQL Order API before the GetOrders decommission on June 30, 2027

**Context**

FiscalBay is a read-only app for Italian eBay sellers. It reads the buyer's Codice Fiscale, which Italian sellers need to issue invoices, from Sell Fulfillment `getOrder`, with Trading `GetOrders` as fallback. On October 27, 2026, Developer Support confirmed that `getOrder` is the supported REST source and that `GetOrders` also returns the tax ID and billing address of seller-created combined invoices. On November 6, 2026, `GetOrders` was deprecated, with decommission on June 30, 2027.

**1. One extra call per order**

`taxIdentifier` is returned only by `getOrder`, not by `getOrders`, even with the `orderIds` parameter (up to 50 orders). An app that lists 200 orders per page then needs one `getOrder` per order to read the tax ID.

Request: return `taxIdentifier` in `getOrders` as well, at least with `orderIds` or behind a dedicated `fieldGroups` value, under the same authorization as `getOrder`.

**2. Completeness of the container**

- `Buyer.taxIdentifier` is a single object, while `TaxIdentifierTypeEnum` includes both `CODICE_FISCALE` and `VATIN`. An Italian buyer with both a Codice Fiscale and a VAT number can't have both in the same response.
- `issuingCountry` was missing in part of our sample; Trading `BuyerTaxIdentifier` never returned it.
- A missing container doesn't tell "buyer has no tax ID" from "marketplace not covered" or "data no longer available".

Request: a list of identifiers with type and issuing country always set on covered marketplaces, plus an explicit indication when the data isn't available.

**3. Parity in the modern APIs**

The deprecation notice and the migration mapping point to Fulfillment for paid orders and to the GraphQL Order API (`orders`, `ordersByIds`), item commitments and Purchase Quote for the rest. In the schema published on November 7, 2026:

- `Order` has `buyer`, `taxes`, `logistics` and totals, and `OrderTaxes` only has `eBayCollectAndRemitTax`, `taxAddress` and `taxBreakdown`;
- we couldn't find a buyer tax identifier or a per-order billing address;
- `PurchaseQuote`, the replacement for combined invoices, has `shippingAddress` but no tax data.

Seller-created combined invoices paid outside eBay checkout exist only in Trading: `getOrder` rejects them as invalid because they have no extended order ID.

Requests:

1. Before June 30, 2027, expose the buyer tax identifier and billing address in the Order API and in `PurchaseQuote`, under the same authorization rules as `getOrder`.
2. If that parity can't ship in time, keep `GetOrders` available for the reads that have no replacement yet.

**Expected result**

An Italian seller gets the Codice Fiscale of every paid order, combined invoices included, from a non-deprecated API, without one call per order.
