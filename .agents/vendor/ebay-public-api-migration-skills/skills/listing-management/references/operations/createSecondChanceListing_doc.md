---
title: Listing
description: "The **Listing API** enable sellers of any size to integrate seamlessly with eBay’s listing platform and to bring products to market faster. Specifically, these APIs let you model both single-SKU and multiple-SKU offerings by leveraging the product data you already maintain, including titles, descriptions, identifiers, and aspects, and then generate complete eBay listing in one step. These GraphQL operations expose only the fields that you need via flexible queries and mutations, reducing payload bloat and accelerating development."
api_version: 1.0
api_name: listing
api_type: GraphQL
api_group: sell/listing
source_url:
  html: https://developer.ebay.com/develop/api/sell/listing
  md: https://developer.ebay.com/develop/api/sell/listing.md
---
# Listing API

The **Listing API** enable sellers of any size to integrate seamlessly with eBay’s listing platform and to bring products to market faster. Specifically, these APIs let you model both single-SKU and multiple-SKU offerings by leveraging the product data you already maintain, including titles, descriptions, identifiers, and aspects, and then generate complete eBay listing in one step. These GraphQL operations expose only the fields that you need via flexible queries and mutations, reducing payload bloat and accelerating development.

## GraphQL Schema Information

**Queries:** 2
**Mutations:** 6
**Types:** 1394

## Mutations

### createSecondChanceListing

This mutation is used to create a Second Chance Offer listing based off of a recently ended auction listing. Second Chance Offers can only be made to a competitive bidder who participated in that auction listing. Either the listing ID or the SKU value must be specified to identify the listing for which a Second Chance Offer will be created against. The mutation also requires the user ID of the recipient that will receive the offer, the price of the offer, and the duration of the offer. Note that the offer price must match the user's original high bid and the supported offer duration times are 1, 3, 5, and 7 days. The recipient will receive an email notification with the offer details and will have the specified duration period to accept the offer before it expires. Sellers might want to use Second Chance Offers if the winning bidder never paid for the item, or if they have extra inventory of the item and would prefer to offer it up to a competitive bidder instead of creating another auction to make a sale. Upon successful creation, a new listing with a unique \*\*listingId\*\* is generated. However, this listing will not be exposed/available to anyone other than the recipient of that Second Chance Offer. This field only returns null under exceptional circumstances, such as when an execution error is raised.

**Returns:** `CreateSecondChanceListingOutput`

**Arguments:**
- **input** (CreateSecondChanceListingInput!)

**OAuth scope**

This request requires an access token created with the **Authorization Code Grant** flow, using one or more scopes from the following list (please check your Application Keys page for a list of OAuth scopes available to your application):

**Required Scopes:**

**Authorization Code Grant:**

- `https://api.ebay.com/oauth/api_scope/sell.listing`

## Shared Types

Shared API-level schema and common type definitions live in [Listing API_shared.md](Listing API_shared.md).
