---
title: Cancellation
description: "The **Cancellation GraphQL API** enables managing contract termination across orders, item commitments, and purchase quotes. Mutations let sellers create, approve, or decline cancellations, with optional relist handling for sellers. Queries retrieve specific cancellation details and filtered seller's cancellation lists. Authorization scopes control access, supporting streamlined cancellation workflows for buyers and sellers."
api_version: 1.0
api_name: sell_cancellation
api_type: GraphQL
api_group: sell/cancellation
source_url:
  html: https://developer.ebay.com/develop/api/sell/cancellation
  md: https://developer.ebay.com/develop/api/sell/cancellation.md
---
# Cancellation API

The **Cancellation GraphQL API** enables managing contract termination across orders, item commitments, and purchase quotes. Mutations let sellers create, approve, or decline cancellations, with optional relist handling for sellers. Queries retrieve specific cancellation details and filtered seller's cancellation lists. Authorization scopes control access, supporting streamlined cancellation workflows for buyers and sellers.

## GraphQL Schema Information

**Queries:** 2
**Mutations:** 5
**Types:** 1514

## Mutations

### createItemCommitmentCancellation

The \*\*createItemCommitmentCancellation\*\* mutation creates a cancellation on an item commitment. \*\*Note\*\*: An item commitment is the agreement to reserve a specific item for a buyer, ensuring its availability for purchase. Cancelling an item commitment releases that reservation. If the seller opts to relist the item by setting \*\*relistItem\*\* to \`true\`, and the \*\*PostPurchaseListingRelistTask\*\* completes successfully, the item becomes available to other buyers.

**Returns:** `CreateItemCommitmentCancellationOutput!`

**Arguments:**
- **input** (CreateItemCommitmentCancellationInput!)

**OAuth scope**

This request requires an access token created with the **Authorization Code Grant** flow, using one or more scopes from the following list (please check your Application Keys page for a list of OAuth scopes available to your application):

**Required Scopes:**

**Authorization Code Grant:**

- `https://api.ebay.com/oauth/api_scope/sell.cancellation`

## Shared Types

Shared API-level schema and common type definitions live in [Cancellation API_shared.md](Cancellation API_shared.md).
