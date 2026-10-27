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

### getItemAspectsForCategory

#### GET /category_tree/{category_tree_id}/get_item_aspects_for_category
**Description:** This call returns a list of _aspects_ that are appropriate or necessary for accurately describing items in the specified leaf category. Each aspect identifies an item attribute (for example, color,) for which the seller will be required or encouraged to provide a value (or variation values) when offering an item in that category on eBay.  
  
For each aspect, [getItemAspectsForCategory](/develop/api/sell/taxonomy#sell-taxonomy-category_tree-getitemaspectsforcategory) provides complete metadata, including:

*   The aspect's data type, format, and entry mode
*   Whether the aspect is required in listings
*   Whether the aspect can be used for item variations
*   Whether the aspect accepts multiple values for an item
*   Allowed values for the aspect

Use this information to construct an interface through which sellers can enter or select the appropriate values for their items or item variations. Once you collect those values, include them as product aspects when creating inventory items using the Inventory API.
**Parameters:**
- **category_id** (string) *required*
  - The unique identifier of the leaf category for which aspects are being requested.  
  
**Note:** If the **category\_id** submitted does not identify a leaf node of the tree, this call returns an error.
- **category_tree_id** (string) *required*
  - The unique identifier of the eBay category tree. The category tree ID for an eBay marketplace can be retrieved using the [getDefaultCategoryTreeId](/develop/api/sell/taxonomy#sell-taxonomy-category_tree-getdefaultcategorytreeid ) method.
**OAuth scope**

This request requires an access token created with the **Client Credentials Grant** flow, using one or more scopes from the following list (please check your Application Keys page for a list of OAuth scopes available to your application):

**Required Scopes:**

**Client Credentials Grant:**

- `https://api.ebay.com/oauth/api_scope`
- `https://api.ebay.com/oauth/api_scope/metadata.insights`

## Shared Types

Shared API-level schema and common type definitions live in [Taxonomy API_shared.md](Taxonomy API_shared.md).
