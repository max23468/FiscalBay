---
title: Offer
description: "This API has mutations that allow sellers to accept, decline, or counter an offer on their listing. There is also a **sellerNegotiationHistory** query that retrieves recent pending, countered, accepted, and declined offers."
api_version: 1.0
api_name: sell_offer
api_type: GraphQL
api_group: sell/offer
source_url:
  html: https://developer.ebay.com/develop/api/sell/offer
  md: https://developer.ebay.com/develop/api/sell/offer.md
---
# Offer API

This API has mutations that allow sellers to accept, decline, or counter an offer on their listing. There is also a **sellerNegotiationHistory** query that retrieves recent pending, countered, accepted, and declined offers.

## GraphQL Schema Information

**Queries:** 1
**Mutations:** 3
**Types:** 1514

## Mutations

### declineOffer

This mutation can be used to decline an active offer (or counteroffer) and end the negotiation process.

**Returns:** `DeclineOfferOutput!`

**Arguments:**
- **input** (DeclineOfferInput!)

**OAuth scope**

This request requires an access token created with the **Authorization Code Grant** flow, using one or more scopes from the following list (please check your Application Keys page for a list of OAuth scopes available to your application):

**Required Scopes:**

**Authorization Code Grant:**

- `https://api.ebay.com/oauth/api_scope/buy.offer`
- `https://api.ebay.com/oauth/api_scope/sell.offer`

## Shared Types

Shared API-level schema and common type definitions live in [Offer API_shared.md](Offer API_shared.md).
