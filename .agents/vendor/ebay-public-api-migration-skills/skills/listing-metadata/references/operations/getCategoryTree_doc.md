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

### getCategoryTree

#### GET /category_tree/{category_tree_id}
**Description:** This method retrieves the complete category tree that is identified by the **category\_tree\_id** parameter. The value of **category\_tree\_id** was returned by the [getDefaultCategoryTreeId](/develop/api/sell/taxonomy#sell-taxonomy-category_tree-getdefaultcategorytreeid ) method in the **categoryTreeId** field. The response contains details of all nodes of the specified eBay category tree, as well as the eBay marketplaces that use this category tree.  
  
**Note:** This method can return a very large payload, so gzip compression is supported. To enable gzip compression, include the `Accept-Encoding` header and set its value to `gzip` as shown below:  
  
`Accept-Encoding: gzip`
**Parameters:**
- **category_tree_id** (string) *required*
  - The unique identifier of the eBay category tree. The category tree ID for an eBay marketplace can be retrieved using the [getDefaultCategoryTreeId](/develop/api/sell/taxonomy#sell-taxonomy-category_tree-getdefaultcategorytreeid ) method.
- **Accept-Encoding** (string)
  - This header indicates the compression-encoding algorithms the client accepts for the response. This value should be set to `gzip`.  
  
For more information, refer to [HTTP request headers](/api-docs/static/rest-request-components.html#HTTP).
**OAuth scope**

This request requires an access token created with the **Client Credentials Grant** flow, using one or more scopes from the following list (please check your Application Keys page for a list of OAuth scopes available to your application):

**Required Scopes:**

**Client Credentials Grant:**

- `https://api.ebay.com/oauth/api_scope`

## Shared Types

Shared API-level schema and common type definitions live in [Taxonomy API_shared.md](Taxonomy API_shared.md).
