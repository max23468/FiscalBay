# Ticket unico a eBay

**Dove:** nuovo ticket al supporto sviluppatori eBay, che cita la risposta del 27 ottobre 2026 sugli identificativi fiscali. Il numero di quel ticket è nella mail dell'owner e va aggiunto prima dell'invio.

**Contenuto:** riunisce gli [invii 1-5](README.md#in-sintesi) e le [domande secondarie](README.md#domande-secondarie), in ordine di urgenza. Le bozze separate restano come dettaglio di ciascun punto.

**Prima dell'invio:** [azione interna 1](README.md#azioni-interne-prima-degli-invii), cioè ripetere i controlli sulle specifiche e togliere i punti già corretti da eBay.

**Dati:** nessun ID di ordini, negozi o acquirenti, nessun valore fiscale, nessun conteggio riferito a un negozio.

---

**Subject:** Read-only seller app: buyer tax ID and buyer identity after the GetOrders decommission, plus documentation and notification gaps

**Context**

We build FiscalBay, a read-only app for Italian eBay sellers. It reads their orders to collect the buyer's Codice Fiscale, which they need to issue invoices. We ask sellers only for `api_scope`, `commerce.identity.readonly`, `sell.fulfillment.readonly` and `commerce.notification.subscription`.

On October 27, 2026, Developer Support confirmed in ticket [number] that:

- Fulfillment `getOrder` is the supported REST method for the buyer tax identifier;
- the `X-EBAY-C-MARKETPLACE-ID` header is required;
- Trading `GetOrders` also returns the tax ID and billing address of seller-created combined invoices.

On November 6, 2026, `GetOrders` was deprecated, with decommission on June 30, 2027. The points below are what we need before that date, followed by smaller gaps. All of them were checked against the specs published on November 7, 2026.

**1. Buyer tax identifier in the APIs that replace GetOrders (deadline: June 30, 2027)**

The deprecation notice points to Fulfillment for paid orders and to the GraphQL Order API, item commitments and Purchase Quote for the rest. In the GraphQL schema:

- `Order` has `buyer`, `taxes`, `logistics` and totals, and `OrderTaxes` only has `eBayCollectAndRemitTax`, `taxAddress` and `taxBreakdown`;
- we couldn't find a buyer tax identifier or a per-order billing address;
- `PurchaseQuote` has `shippingAddress` but no tax data.

Seller-created combined invoices paid outside eBay checkout exist only in Trading: `getOrder` rejects them as invalid because they have no extended order ID.

Requests:

- expose the buyer tax identifier and billing address in the Order API and in `PurchaseQuote`, under the same authorization rules as `getOrder`, before June 30, 2027;
- if that can't ship in time, keep `GetOrders` available for the reads that have no replacement yet.

**2. Immutable buyer identifier for Marketplace Account Deletion**

`MARKETPLACE_ACCOUNT_DELETION` carries `userId`, `eiasToken` and `username`. The Fulfillment `Buyer` type has only `username`, which the Identity API describes as changeable by the user. The buyer's EIAS token is available only in `GetOrders`, within 90 days, so after June 30, 2027 no API will return it.

For orders read from Fulfillment, the only key that matches a deletion request is therefore the username stored with the order, which may be outdated. We re-read it weekly, but that narrows the gap without closing it. The deletion guide requires deleting the user's data, but doesn't say how to recognize the buyer in Fulfillment orders. The GraphQL `User` type exposes `userId`, but we couldn't find whether it's returned for the buyer of a seller's order.

Requests:

- an immutable buyer identifier (`userId` or `eiasToken`) in Fulfillment `getOrder` and `getOrders` and in the Order API, available with the order read scopes;
- alternatively, official guidance on which key to use, and confirmation of whether `Order.buyer.userId` is returned to the seller.

**3. X-EBAY-C-MARKETPLACE-ID is not documented for getOrder**

The header doesn't appear anywhere in the Fulfillment OpenAPI spec v1.20.7: not in the `getOrder` parameters and not in the `taxIdentifier` descriptions. On 18 controlled EBAY_IT orders, `getOrder` with `fieldGroups=TAX_BREAKDOWN` returned no tax identifier on any order without the header. With the header set to the listing marketplace, it returned one on 10 orders, matching `GetOrders`.

Request: document the header and its expected value (`lineItems[].listingMarketplaceId`), state the behavior for orders with line items from different marketplaces, and, if possible, warn when the header is missing and the order could carry a tax identifier.

**4. Tax identifier in list reads, and a complete container**

- `taxIdentifier` is returned only by `getOrder`, not by `getOrders`, even with `orderIds` (up to 50 orders), so we need one call per order.
- `Buyer.taxIdentifier` is a single object, while `TaxIdentifierTypeEnum` includes both `CODICE_FISCALE` and `VATIN`: a buyer with both can't have both in one response.
- `issuingCountry` was missing in part of our sample, and `GetOrders` never returned it.
- A missing container doesn't tell "no tax ID" from "not available".

Requests: `taxIdentifier` in `getOrders`, at least with `orderIds` or behind a `fieldGroups` value; a list of identifiers with type and issuing country always set on covered marketplaces; an explicit indication when the data isn't available.

**5. Order notifications**

- `getTopic` lists `ORDER_CONFIRMATION` schema versions 1.0 and 1.1, but we couldn't find the 1.1 payload or how it differs. The topic description still points to `GetOrders`.
- With `sell.fulfillment.readonly` alone there is no event for a later payment, refund, cancellation or tax identifier: the consolidated cancellation, inquiry and return topics need their own scopes.
- An application can hold only one subscription per seller and topic, so a test environment and production that share a keyset can't both receive a seller's events.

Requests: publish both `ORDER_CONFIRMATION` schemas and point the description to `getOrder`; an `ORDER_UPDATED` topic, or an extension of `ORDER_CONFIRMATION`, available with the Fulfillment read-only scope; multiple destinations per subscription.

**6. Per-user rate limits**

`getUserRateLimits` accepts only tokens with an inventory, marketing, marketplace insights or catalog scope, so our sellers' tokens are rejected. The Developer Analytics API is still `v1_beta`.

Request: accept any user token, or at least `sell.fulfillment.readonly`, and a stable API version.

**Questions**

1. How can we create a paid Sandbox order for an Italian buyer that returns `taxIdentifier`? Sandbox payments currently don't complete, and the order never reaches Fulfillment.
2. On EBAY_IT, is a business buyer's VAT number returned as `VATIN`, and when instead of the Codice Fiscale?
3. Are deprecations planned for Trading `GetItem`, `GetStore` and `GetUser`? Will feedback score, positive percentage and Top Rated status stay readable without new scopes?
4. Is there a way to access billing data already provided for an order after Fulfillment stops returning it at 90 days, for invoices issued later?
5. Which Bulk Data Transfer categories and thresholds apply to a read-only order app? The threshold read currently returns an empty list.

Thank you. We can share more detail on any point, without buyer data.
