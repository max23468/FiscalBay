---
title: Taxonomy API
description: "The Taxonomy API enables you to assist both sellers and buyers: * It helps sellers to determine the best eBay category under which to offer each inventory item for sale in a selected eBay marketplace. It helps sellers to select the categories of items to include in a campaign or promotion. It also provides information about the aspects to include when defining an inventory item in a given category. For more information, see the [Selling Integration Guide](/api-docs/sell/static/selling-ig-landing.html). * It helps buyers to determine the appropriate categories in which to browse or search for the items they're looking to purchase in a particular eBay marketplace. For more information, see the [Buying Integration Guide](/api-docs/buy/static/buying-ig-landing.html)."
api_version: v1.1.1
api_name: taxonomy_api
api_type: REST
api_group: taxonomy/api
source_url:
  html: https://developer.ebay.com/develop/api/taxonomy/api
  md: https://developer.ebay.com/develop/api/taxonomy/api.md
---
# Taxonomy API

## API Methods

### getDefaultCategoryTreeId

#### GET /get_default_category_tree_id
**Description:** A given eBay marketplace might use multiple category trees, but one of those trees is considered to be the default for that marketplace. This call retrieves a reference to the default category tree associated with the specified eBay marketplace ID. The response includes only the tree's unique identifier and version, which you can use to retrieve more details about the tree, its structure, and its individual category nodes.
**Parameters:**
- **marketplace_id** (string) *required*
  - The unique identifier of the eBay marketplace for which the category tree ID is requested. For a list of supported marketplace IDs, see [Marketplaces with Default Category Trees](/api-docs/commerce/taxonomy/static/supportedmarketplaces.html).
**OAuth scope**

This request requires an access token created with the **Client Credentials Grant** flow, using one or more scopes from the following list (please check your Application Keys page for a list of OAuth scopes available to your application):

**Required Scopes:**

**Client Credentials Grant:**

- `https://api.ebay.com/oauth/api_scope`

## Shared Types

Shared API-level schema and common type definitions live in [Taxonomy API_shared.md](Taxonomy API_shared.md).
