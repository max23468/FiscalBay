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

### bulkUpdateInventory

This mutation is used to perform a bulk update of price and quantity for multiple fixed price items for a single-SKU or multi-SKU listing. In the output, the operation returns the corresponding item in the successes list for items that were updated and the failure list for items where issues occurred during the update. The operation returns either the updated listing details or error information if the update fails. This field only returns null under exceptional circumstances, such as when an execution error is raised.

**Returns:** `BulkUpdateInventoryOutput`

**Arguments:**
- **input** (BulkUpdateInventoryInput!)

**OAuth scope**

This request requires an access token created with the **Authorization Code Grant** flow, using one or more scopes from the following list (please check your Application Keys page for a list of OAuth scopes available to your application):

**Required Scopes:**

**Authorization Code Grant:**

- `https://api.ebay.com/oauth/api_scope/sell.listing`

## Shared Types

Shared API-level schema and common type definitions live in [Listing API_shared.md](Listing API_shared.md).
