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

### getCategorySuggestions

#### GET /category_tree/{category_tree_id}/get_category_suggestions
**Description:** This call returns an array of category tree leaf nodes in the specified category tree that are considered by eBay to most closely correspond to the query string **q**. Returned with each suggested node is a localized name for that category (based on the **Accept-Language** header specified for the call), and details about each of the category's ancestor nodes, extending from its immediate parent up to the root of the category tree.  
  
You identify the tree using the **category\_tree\_id** parameter, which was returned by the [getDefaultCategoryTreeId](/develop/api/sell/taxonomy#sell-taxonomy-category_tree-getdefaultcategorytreeid ) call in the **categoryTreeId** field.  
  
**Important:** This call is not supported in the Sandbox environment. It will return a response payload in which the **categoryName** fields contain random or boilerplate text regardless of the query submitted.
**Parameters:**
- **category_tree_id** (string) *required*
  - The unique identifier of the eBay category tree. The category tree ID for an eBay marketplace can be retrieved using the [getDefaultCategoryTreeId](/develop/api/sell/taxonomy#sell-taxonomy-category_tree-getdefaultcategorytreeid ) method.
- **q** (string) *required*
  - A quoted string that describes or characterizes the item being offered for sale. The string format is free form, and can contain any combination of phrases or keywords. eBay will parse the string and return suggested categories for the item.
**OAuth scope**

This request requires an access token created with the **Client Credentials Grant** flow, using one or more scopes from the following list (please check your Application Keys page for a list of OAuth scopes available to your application):

**Required Scopes:**

**Client Credentials Grant:**

- `https://api.ebay.com/oauth/api_scope`

## Shared Types

Shared API-level schema and common type definitions live in [Taxonomy API_shared.md](Taxonomy API_shared.md).
