---
title: Item Commitment
description: "This API retrieves item commitments on behalf of authenticated eBay sellers. Item commitments are eBay items that a buyer has commited to purchase, but payment has not been received as of yet. Item commitments can be retrieved through the **itemCommitments** query featuring multiple filter criteria, or the user can use the **itemCommitmentsByIds**query to retrieve item commitments baed on distinct item commitment IDs. There is also a mutation to mark item commitments as paid and a mutation that allows the seller to add or delete custom item commitment tags (up to 5 per item commitment)."
api_version: 1.0
api_name: sell_item_commitment
api_type: GraphQL
api_group: sell/item
source_url:
  html: https://developer.ebay.com/develop/api/sell/item
  md: https://developer.ebay.com/develop/api/sell/item.md
---
# Item Commitment API

This API retrieves item commitments on behalf of authenticated eBay sellers. Item commitments are eBay items that a buyer has commited to purchase, but payment has not been received as of yet. Item commitments can be retrieved through the **itemCommitments** query featuring multiple filter criteria, or the user can use the **itemCommitmentsByIds**query to retrieve item commitments baed on distinct item commitment IDs. There is also a mutation to mark item commitments as paid and a mutation that allows the seller to add or delete custom item commitment tags (up to 5 per item commitment).

## GraphQL Schema Information

**Queries:** 2
**Mutations:** 2
**Types:** 1394

## Queries

### itemCommitmentsByIds

This query is used to retrieve detailed information on up to 100 of an authenticated user's item commitments.

**Returns:** `ItemCommitmentsByIdsOutput!`

**Arguments:**
- **input** (ItemCommitmentsByIdsInput!)

**OAuth scope**

This request requires an access token created with the **Authorization Code Grant** flow, using one or more scopes from the following list (please check your Application Keys page for a list of OAuth scopes available to your application):

**Required Scopes:**

**Authorization Code Grant:**

- `https://api.ebay.com/oauth/api_scope/buy.commitment`
- `https://api.ebay.com/oauth/api_scope/buy.commitment.read`
- `https://api.ebay.com/oauth/api_scope/sell.commitment`
- `https://api.ebay.com/oauth/api_scope/sell.commitment.read`

## Shared Types

Shared API-level schema and common type definitions live in [Item Commitment API_shared.md](Item Commitment API_shared.md).
