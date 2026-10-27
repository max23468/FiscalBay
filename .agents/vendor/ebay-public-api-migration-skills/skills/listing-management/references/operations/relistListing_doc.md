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

### relistListing

This mutation is used to relist an ended eBay listing. Either the listing ID or the SKU value must be specified to identify the listing to be relisted. It is possible to relist a listing without making any changes to the listing at all, but any updates to the listing are allowed if desired. Regardless of whether changes are made or not, the relisted item will be treated as a new listing and will get a new \*\*listingId\*\* value. The new listing will also be subject to any applicable listing-related fees. The operation returns either the details of the newly created listing or error information if the relisting fails. This field only returns null under exceptional circumstances, such as when an execution error is raised.

**Returns:** `RelistListingOutput`

**Arguments:**
- **input** (RelistListingInput!)

**OAuth scope**

This request requires an access token created with the **Authorization Code Grant** flow, using one or more scopes from the following list (please check your Application Keys page for a list of OAuth scopes available to your application):

**Required Scopes:**

**Authorization Code Grant:**

- `https://api.ebay.com/oauth/api_scope/sell.listing`

## Shared Types

Shared API-level schema and common type definitions live in [Listing API_shared.md](Listing API_shared.md).
