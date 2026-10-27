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

### updateListing

This mutation is used to make one or multiple updates to an active or scheduled eBay listing. Either the listing ID or the SKU value must be specified to identify the listing to be updated. Common changes include changes to price, quantity, listing title, listing description, aspects, and other information. It can be used to update various listing attributes such as price, quantity, title, description, and other relevant information. The operation returns either the updated listing details or error information if the update fails. Some general notes on update behavior are captured below: - With most collection fields (arrays), complete replacement is performed, which means that existing values not included will be removed from the listing. The exceptions to these rules include the \*\*variationDetails\*\*, \*\*items\*\*, and \*\*itemCompatibilities\*\* arrays. More information is provided in the descriptions for those arrays. - An individual field should only be provided if the seller wants to modify the setting/value for that field. - To remove/disable an optional field/feature, include that field and set it to null or leave empty as appropriate. More information is provided in the descriptions for those optional fields.

**Returns:** `UpdateListingOutput`

**Arguments:**
- **input** (UpdateListingInput!)

**OAuth scope**

This request requires an access token created with the **Authorization Code Grant** flow, using one or more scopes from the following list (please check your Application Keys page for a list of OAuth scopes available to your application):

**Required Scopes:**

**Authorization Code Grant:**

- `https://api.ebay.com/oauth/api_scope/sell.listing`

## Shared Types

Shared API-level schema and common type definitions live in [Listing API_shared.md](Listing API_shared.md).
