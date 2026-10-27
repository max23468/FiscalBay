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

### getAutomotivePartsCompatibilityPolicies

#### GET /marketplace/{marketplace_id}/get_automotive_parts_compatibility_policies
**Description:** This method returns the eBay policies that define how to list automotive parts compatibility items in the categories of the specified marketplace.  
  
By default, this method returns all categories that support parts compatibility. You can limit the size of the result set by using the **filter** query parameter to specify only the category IDs you want to review.  
  
**Note:** To return policy information for the eBay US marketplace, specify `EBAY_MOTORS_US` as the path parameter for **marketplace\_id**.  
**Tip:** This method can potentially return a very large response payload. eBay recommends that the response payload be compressed by passing in the **Accept-Encoding** request header and setting the value to `gzip`.  
If you specify a valid marketplace ID but that marketplace does not contain policy information, or if you filter out all results, a **204 No content** status code is returned with an empty response body.
**Parameters:**
- **filter** (string)
  - This query parameter limits the response by returning policy information for only the selected sections of the category tree. Supply **categoryId** values for the sections of the tree you want returned. Use the [Taxonomy API](/api-docs/commerce/taxonomy/overview.html) to retrieve category ID values.  
  
The parameter takes a list of **categoryId** values and you can specify up to 50 separate category IDs. Separate multiple values with a pipe character ('|'). If you specify more than 50 `categoryId` values, eBay returns the policies for the first 50 IDs and a warning that not all categories were returned.  
  
**Example:** `filter=categoryIds:{183521|183523|183524}`  
  
**Note:** URL-encoding of the parameter list is no longer required.
- **marketplace_id** (string) *required*
  - This path parameter specifies the eBay marketplace for which policy information is retrieved.  
  
**Note:** Only the following eBay marketplaces support automotive parts compatibility:

*   EBAY\_MOTORS\_US
*   EBAY\_AU
*   EBAY\_CA
*   EBAY\_DE
*   EBAY\_ES
*   EBAY\_FR
*   EBAY\_GB
*   EBAY\_IT
- **Accept-Encoding** (string)
  - This header indicates the compression-encoding algorithms the client accepts for the response. This value should be set to `gzip`.  
  
For more information, refer to [Request Headers](/develop/api/sell/request_headers).
**OAuth scope**

This request requires an access token created with the **Client Credentials Grant** flow, using one or more scopes from the following list (please check your Application Keys page for a list of OAuth scopes available to your application):

**Required Scopes:**

**Client Credentials Grant:**

- `https://api.ebay.com/oauth/api_scope`

## Shared Types

Shared API-level schema and common type definitions live in [Metadata API_shared.md](Metadata API_shared.md).
