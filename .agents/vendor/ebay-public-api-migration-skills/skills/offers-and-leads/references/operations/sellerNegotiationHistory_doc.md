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

## Queries

### sellerNegotiationHistory

The \*\*sellerNegotiationHistory\*\* query can be used to retrieve the seller perspective of the user's negotiation history, such as negotiations on items a seller has listed. Upon success, this query returns the \*\*latest offer per negotiation thread\*\*, grouped by item and sorted by most-recent activity in descending order. The \*\*SellerNegotiationHistoryInput\*\* request object is required. With no \*\*filters\*\* included in this request object, information from the last 90 days will be returned for the seller. To further limit the result set, add optional \*\*filters\*\* to the request object. \*\*Note\*\*: The following default filters will be applied if the \*\*SellerNegotiationHistoryInput\*\* object is omitted: - Time window: last \`90 days\` by most-recent activity - Status: \`ACTIONABLE\` - Initiator: \`BUYER\` - Pagination: Returns up to 10 item entities per page

**Returns:** `SellerNegotiationHistoryOutput!`

**Arguments:**
- **input** (SellerNegotiationHistoryInput!)

**OAuth scope**

This request requires an access token created with the **Authorization Code Grant** flow, using one or more scopes from the following list (please check your Application Keys page for a list of OAuth scopes available to your application):

**Required Scopes:**

**Authorization Code Grant:**

- `https://api.ebay.com/oauth/api_scope/sell.offer`
- `https://api.ebay.com/oauth/api_scope/sell.offer.read`

## Shared Types

Shared API-level schema and common type definitions live in [Offer API_shared.md](Offer API_shared.md).
