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

### getReturnPolicies

#### GET /marketplace/{marketplace_id}/get_return_policies
**Description:** This method returns the eBay policies that define whether or not you must include a return policy for the items you list in the categories of a specific marketplace, plus the guidelines for creating domestic and international return policies in the different eBay categories.  
  
By default, this method returns the entire category tree for the specified marketplace. You can limit the size of the result set by using the **filter** query parameter to specify only the category IDs you want to review.  
  
**Tip:** This method can potentially return a very large response payload. eBay recommends that the response payload be compressed by passing in the **Accept-Encoding** request header and setting the value to `gzip`.
**Parameters:**
- **filter** (string)
  - This query parameter limits the response by returning policy information for only the selected sections of the category tree. Supply **categoryId** values for the sections of the tree you want returned.  
  
When you specify a **categoryId** value, the returned category tree includes the policies for that parent node, plus the policies for any leaf nodes below that parent node.  
  
The parameter takes a list of **categoryId** values and you can specify up to 50 separate category IDs. Separate multiple values with a pipe character ('|'). If you specify more than 50 `categoryId` values, eBay returns the policies for the first 50 IDs and a warning that not all categories were returned.  
  
**Example:** `filter=categoryIds:{100|101|102}`  
  
Note that you must URL-encode the parameter list, which results in the following filter for the above example:  
  
  `filter=categoryIds%3A%7B100%7C101%7C102%7D`
- **marketplace_id** (string) *required*
  - This path parameter specifies the eBay marketplace for which policy information is retrieved.  
  
See [Request Headers](/develop/api/sell/request_headers#marketplace-id-values) for a list of supported eBay marketplace ID values.
- **Accept-Encoding** (string)
  - This header indicates the compression-encoding algorithms the client accepts for the response. This value should be set to `gzip`.  
  
For more information, refer to [Request Headers](/develop/api/sell/request_headers#marketplace-id-values).
- **Accept-Language** (string)
  - This header is required to retrieve metadata for the French Canada, French Belgium, and Dutch Belgium marketplaces.  
  
Follow the instructions below to retrieve metadata for these three marketplaces:

*   **French Belgium**: Set the **marketplace\_id** path parameter value to `EBAY_BE`, and include the **Accept-Language** header with a value of `fr-BE`.
*   **Dutch Belgium**: Set the **marketplace\_id** path parameter value to `EBAY_BE`, and include the **Accept-Language** header with a value of `nl-BE`.
*   **French Canada**: Set the **marketplace\_id** path parameter value to `EBAY_CA`, and include the **Accept-Language** header with a value of `fr-CA`.

**Note:** If `EBAY_CA` is set as the **marketplace\_id** path parameter and the **Accept-Language** header is not used, the marketplace will default to the English Canada marketplace.
**OAuth scope**

This request requires an access token created with the **Client Credentials Grant** flow, using one or more scopes from the following list (please check your Application Keys page for a list of OAuth scopes available to your application):

**Required Scopes:**

**Client Credentials Grant:**

- `https://api.ebay.com/oauth/api_scope`

## Shared Types

Shared API-level schema and common type definitions live in [Metadata API_shared.md](Metadata API_shared.md).
