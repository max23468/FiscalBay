---
title: Return
description: "The **Return API** lets sellers manage returns at the line-item level. It provides queries to retrieve a specific return and list seller returns, and mutations to initiate in-store returns, message buyers, approve/decline, attach or record labels, provide RMA, record receipt of returned item, and process refunds. Sellers can manage shipment labels by uploading using the **Media API** and attaching them with the **attachReturnShipmentLabel** mutation."
api_version: 1.0
api_name: sell_return
api_type: GraphQL
api_group: sell/return
source_url:
  html: https://developer.ebay.com/develop/api/sell/return
  md: https://developer.ebay.com/develop/api/sell/return.md
---
# Return API

The **Return API** lets sellers manage returns at the line-item level. It provides queries to retrieve a specific return and list seller returns, and mutations to initiate in-store returns, message buyers, approve/decline, attach or record labels, provide RMA, record receipt of returned item, and process refunds. Sellers can manage shipment labels by uploading using the **Media API** and attaching them with the **attachReturnShipmentLabel** mutation.

## GraphQL Schema Information

**Queries:** 2
**Mutations:** 11
**Types:** 1394

## Mutations

### proposeKeepItemWithPartialRefund

The \*\*proposeKeepItemWithPartialRefund\*\* mutation proposes a keep-item-with-partial-refund offer on one or more items in an existing return. Sellers use this to offer the buyer a partial refund to keep the item instead of returning it.

**Important!** Due to EU & UK Payments regulatory requirements, an additional security verification via Digital Signatures is required for certain API calls that are made on behalf of EU/UK sellers, including calls with the **proposeKeepItemWithPartialRefund** mutation . Please refer to [Digital Signatures](https://developer.ebay.com/develop/guides/digital-signatures-for-apis) for APIs to learn more and the process to create signatures to be included in the HTTP payload.

**Returns:** `ProposeKeepItemWithPartialRefundOutput!`

**Arguments:**
- **input** (ProposeKeepItemWithPartialRefundInput!)

**OAuth scope**

This request requires an access token created with the **Authorization Code Grant** flow, using one or more scopes from the following list (please check your Application Keys page for a list of OAuth scopes available to your application):

**Required Scopes:**

**Authorization Code Grant:**

- `https://api.ebay.com/oauth/api_scope/sell.return`

## Shared Types

Shared API-level schema and common type definitions live in [Return API_shared.md](Return API_shared.md).
