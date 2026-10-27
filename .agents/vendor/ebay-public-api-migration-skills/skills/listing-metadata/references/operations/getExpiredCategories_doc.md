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

### getExpiredCategories

#### GET /category_tree/{category_tree_id}/get_expired_categories
**Description:** This method retrieves the mappings of expired leaf categories in the specified category tree to their corresponding active leaf categories. Note that in some cases, several expired categories are mapped to a single active category.  
  
**Note:** This method only returns information about categories that have been mapped (i.e., combined categories and split categories). It does not return information about expired categories that have no corresponding active categories. When a category expires in this manner, any completed items that were listed in the expired category can still be found, but new listings cannot be created in the category.
**Parameters:**
- **category_tree_id** (string) *required*
  - The unique identifier of the eBay category tree.  
  
The category tree ID for an eBay marketplace can be retrieved using the [getDefaultCategoryTreeId](/api-docs/commerce/taxonomy/resources/category_tree/methods/getDefaultCategoryTreeId) method.
**OAuth scope**

This request requires an access token created with the **Client Credentials Grant** flow, using one or more scopes from the following list (please check your Application Keys page for a list of OAuth scopes available to your application):

**Required Scopes:**

**Client Credentials Grant:**

- `https://api.ebay.com/oauth/api_scope`

## Error Codes

The following error codes may be returned by this API:

## Shared Types

Shared API-level schema and common type definitions live in [Taxonomy API_shared.md](Taxonomy API_shared.md).
