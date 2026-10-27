---
title: Order
description: "The **Order API** retrieves orders on behalf of authenticated eBay sellers. Orders can be retrieved through the **orders** query featuring multiple filter criteria, or the user can use the **ordersByIds** or **orderLineItemsByIds** queries to retrieve orders based on distinct order IDs or item commitment IDs. There is also a mutation to mark orders as paid and a mutation that allows the seller to add or delete custom order tags (up to 5 per order)."
api_version: 1.0
api_name: sell_order
api_type: GraphQL
api_group: sell/order
source_url:
  html: https://developer.ebay.com/develop/api/sell/order
  md: https://developer.ebay.com/develop/api/sell/order.md
---
# Order API

The **Order API** retrieves orders on behalf of authenticated eBay sellers. Orders can be retrieved through the **orders** query featuring multiple filter criteria, or the user can use the **ordersByIds** or **orderLineItemsByIds** queries to retrieve orders based on distinct order IDs or item commitment IDs. There is also a mutation to mark orders as paid and a mutation that allows the seller to add or delete custom order tags (up to 5 per order).

## GraphQL Schema Information

**Queries:** 3
**Mutations:** 2
**Types:** 1394

## Queries

### ordersByIds

This query can be used to retrieve one or more orders by their unique IDs. You can access up to 100 identifiers for each query. \*\*Note:\*\* Orders not found will be excluded from the results.

**Returns:** `OrdersByIdsOutput!`

**Arguments:**
- **input** (OrdersByIdsInput!)

**OAuth scope**

This request requires an access token created with the **Authorization Code Grant** flow, using one or more scopes from the following list (please check your Application Keys page for a list of OAuth scopes available to your application):

**Required Scopes:**

**Authorization Code Grant:**

- `https://api.ebay.com/oauth/api_scope/buy.order`
- `https://api.ebay.com/oauth/api_scope/buy.order.read`
- `https://api.ebay.com/oauth/api_scope/sell.order`
- `https://api.ebay.com/oauth/api_scope/sell.order.read`

## Shared Types

Shared API-level schema and common type definitions live in [Order API_shared.md](Order API_shared.md).
