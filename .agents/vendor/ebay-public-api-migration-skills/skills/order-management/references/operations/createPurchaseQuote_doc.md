---
title: Purchase Quote
description: "This API retrieves purchase quotes on behalf of authenticated eBay sellers. Purchase quotes can be retrieved through the **purchaseQuotes** query featuring multiple filter criteria, or the user can use the **purchaseQuotes****ByIds** or **purchaseQuotes****LineItemsByIds** queries to retrieve purchase quotes baed on distinct purchase quote IDs or item commitment IDs. There is also a mutation to create a purchase quotes and a mutation to update one or more existing purchase quotes."
api_version: 1.0
api_name: sell_purchase_quote
api_type: GraphQL
api_group: sell/purchase
source_url:
  html: https://developer.ebay.com/develop/api/sell/purchase
  md: https://developer.ebay.com/develop/api/sell/purchase.md
---
# Purchase Quote API

This API retrieves purchase quotes on behalf of authenticated eBay sellers. Purchase quotes can be retrieved through the **purchaseQuotes** query featuring multiple filter criteria, or the user can use the **purchaseQuotes****ByIds** or **purchaseQuotes****LineItemsByIds** queries to retrieve purchase quotes baed on distinct purchase quote IDs or item commitment IDs. There is also a mutation to create a purchase quotes and a mutation to update one or more existing purchase quotes.

## GraphQL Schema Information

**Queries:** 3
**Mutations:** 2
**Types:** 1514

## Mutations

### createPurchaseQuote

This mutation allows a seller to create a new purchase quote containing multiple item commitments with price details and optional shipping estimates. \*\*Note\*\*: This operation is not available to buyers.

**Returns:** `CreatePurchaseQuoteOutput!`

**Arguments:**
- **input** (CreatePurchaseQuoteInput!)

**OAuth scope**

This request requires an access token created with the **Authorization Code Grant** flow, using one or more scopes from the following list (please check your Application Keys page for a list of OAuth scopes available to your application):

**Required Scopes:**

**Authorization Code Grant:**

- `https://api.ebay.com/oauth/api_scope/sell.purchase.quote`

## Error Codes

The following error codes may be returned by this GraphQL API:

## Shared Types

Shared API-level schema and common type definitions live in [Purchase Quote API_shared.md](Purchase Quote API_shared.md).
