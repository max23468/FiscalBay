---
title: Auction
description: "The **Auction API** features two queries that allow an authenticated user to retrieve auction bidding activity for a specific auction listing or bidding activity for a specific user over a specific date range. The **itemBiddingActivity** query will return the most amount of information if the authenticated user making the query is the owner of that auction listing, a little less data for an authenticated user who has placed one or more bids on that auction item, and the least amount of data to an authenticated user who has not made any bids on that auction listing. The **userBiddingActivity** query will return the most amount of information if the authenticated user making the query is retrieving their own bidding activity. Limited data is retrieved if the authenticated user if retrieving bidding activity on another eBay user."
api_version: 1.0
api_name: commerce_auction
api_type: GraphQL
api_group: commerce/auction
source_url:
  html: https://developer.ebay.com/develop/api/commerce/auction
  md: https://developer.ebay.com/develop/api/commerce/auction.md
---
# Auction API

The **Auction API** features two queries that allow an authenticated user to retrieve auction bidding activity for a specific auction listing or bidding activity for a specific user over a specific date range.  
  
The **itemBiddingActivity** query will return the most amount of information if the authenticated user making the query is the owner of that auction listing, a little less data for an authenticated user who has placed one or more bids on that auction item, and the least amount of data to an authenticated user who has not made any bids on that auction listing.  
  
The **userBiddingActivity** query will return the most amount of information if the authenticated user making the query is retrieving their own bidding activity. Limited data is retrieved if the authenticated user if retrieving bidding activity on another eBay user.

## GraphQL Schema Information

**Queries:** 2
**Types:** 1514

## Queries

### itemBiddingActivity

Query to return auction and bid information for a specified listing. This query returns auction details such as current price, highest bid, etc., as well as bidder information. \*\*Note\*\*: When auction and bid information is requested by a buyer, their username and other private information is restricted to their data.

**Returns:** `ItemBiddingActivityOutput!`

**Arguments:**
- **input** (ItemBiddingActivityInput!)

**OAuth scope**

This request requires an access token created with the **Authorization Code Grant** flow, using one or more scopes from the following list (please check your Application Keys page for a list of OAuth scopes available to your application):

**Required Scopes:**

**Authorization Code Grant:**

- `https://api.ebay.com/oauth/api_scope/buy.auction.read`
- `https://api.ebay.com/oauth/api_scope/sell.auction.read`

## Shared Types

Shared API-level schema and common type definitions live in [Auction API_shared.md](Auction API_shared.md).
