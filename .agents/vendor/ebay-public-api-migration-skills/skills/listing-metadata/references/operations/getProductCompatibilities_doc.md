---
title: Metadata API
description: "The **Metadata API** lets you retrieve metadata on eBay category policies, information on sales tax jurisdictions, and available hazardous material related label information. _Category policies_ are the eBay policies and guidelines for how you must list certain items in specific categories across the different eBay marketplaces. For example, if you are listing items with variations, you'll want to know which categories support multiple-variation listings. Another example is that you may want to know which item conditions are supported for different eBay categories. See [Finding the correct category ID and item condition for your item](/api-docs/sell/static/metadata/getting-metadata.html#s0-1-31-4-7-5-content) [](/api-docs/sell/metadata/overview.html#policies)for more information. Several countries have _sales tax jurisdictions_ where the tax rates across the different jurisdictions may vary. You can use the Metadata API to retrieve the lists of tax jurisdictions which you can then use to set up sales tax tables. See [Getting a list of tax jurisdictions](/api-docs/sell/static/metadata/getting-metadata.html#jurisdictions) for more information. Sellers have the ability to add _hazardous material related label_ information to their listings. See [Specifying hazardous material related information](/api-docs/sell/static/metadata/feature-regulatorhazmatcontainer.html) for more information."
api_version: v1.13.0
api_name: metadata_api
api_type: REST
api_group: metadata/api
source_url:
  html: https://developer.ebay.com/develop/api/metadata/api
  md: https://developer.ebay.com/develop/api/metadata/api.md
---
# Metadata API

## API Methods

### getProductCompatibilities

#### POST /compatibilities/get_product_compatibilities
**Description:** This method is used to retrieve all available item compatibility details for the specified product.  
  
Item compatibility details can be used to see the properties for which an item is compatible. For example, if you are searching for a part for a specific vehicle, you can use this method to see the years, engine, and/or trim for which the part is compatible. Item compatibility details are returned as name-value pairs.  
  
The product for which to retrieve item compatibility details must be provided through the **productIdentifier** field. This value can be either an eBay specific identifier (such as an ePID) or an external identifier (such as a UPC).  
  
By default, all available item compatibility details for the specified product are returned. You can limit the size of the result set using the **dataset** or **datasetPropertyName** fields to specify the types of properties you want returned in the response. The **applicationPropertyFilter** array can also be used so that only parts compatible with the specified name-value pairs are returned.
**Parameters:**
- **X-EBAY-C-MARKETPLACE-ID** (string) *required*
  - This header identifies the seller's eBay marketplace.  
  
See [Marketplace ID values](/develop/api/sell/request_headers#marketplace-id-values) for a list of supported eBay marketplace ID values.
- **Content-Type** (string) *required*
  - This header indicates the format of the request body provided by the client.  
  
Its value should be set to `application/json`.  
  
For more information, refer to [Request Headers](/develop/api/sell/request_headers).
**OAuth scope**

This request requires an access token created with the **Client Credentials Grant** flow, using one or more scopes from the following list (please check your Application Keys page for a list of OAuth scopes available to your application):

**Required Scopes:**

**Client Credentials Grant:**

- `https://api.ebay.com/oauth/api_scope`

## Shared Types

Shared API-level schema and common type definitions live in [Metadata API_shared.md](Metadata API_shared.md).
