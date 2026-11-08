# Bozza 1: header del marketplace e identificativo fiscale

**Dove:** risposta al ticket del supporto sviluppatori eBay del 27 ottobre 2026, che ha confermato l'header; poi il feedback della pagina di reference di `getOrder`.

**Verifica:** 7 novembre 2026, specifica OpenAPI Fulfillment `v1.20.7`; qualifica del 10 ottobre nel [confronto fiscale](../../reference/EBAY_TAX_COMPARISON.md#qualifica-production-del-2026-10-10).

**Dati:** soltanto conteggi aggregati; nessun ID ordine, negozio, acquirente o valore fiscale.

---

**Subject:** Fulfillment API getOrder: X-EBAY-C-MARKETPLACE-ID is required for buyer.taxIdentifier but is not documented

**Context**

We build FiscalBay, a read-only app for Italian eBay sellers that reads `buyer.taxIdentifier` (Codice Fiscale) with Sell Fulfillment `getOrder`. In your reply of October 27, 2026, Developer Support confirmed that `getOrder` is the supported REST method for the buyer tax identifier and that the `X-EBAY-C-MARKETPLACE-ID` header is required.

**What the documentation says today** (OpenAPI spec v1.20.7, downloaded November 7, 2026)

- `X-EBAY-C-MARKETPLACE-ID` doesn't appear anywhere in the Fulfillment spec: not in the `getOrder` parameters and not in the `Buyer.taxIdentifier` or `TaxIdentifier` descriptions.
- Those descriptions only say that the container is returned by `getOrder`, not `getOrders`, for orders on the eBay Italy and eBay Spain marketplaces.

**What we observed**

On 18 controlled EBAY_IT orders, `getOrder` with `fieldGroups=TAX_BREAKDOWN`:

- without the header returned no tax identifier on any order;
- with the header set to the listing marketplace returned it on 10 orders, matching Trading `GetOrders` where both were available.

An integration that follows the reference gets a response that looks like a buyer without a tax ID.

**Requests**

1. Document `X-EBAY-C-MARKETPLACE-ID` as a `getOrder` parameter and in the `taxIdentifier` descriptions, with the expected value (the listing marketplace, `lineItems[].listingMarketplaceId`).
2. State the behavior for orders whose line items come from different marketplaces.
3. If possible, return a warning when the header is missing and the order could carry a tax identifier, so "missing header" and "no tax identifier" are distinguishable.

**Expected result**

A new integration that follows only the reference receives the Italian buyer tax identifier on the first try.
