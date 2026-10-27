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

### getCurrencies

#### GET /marketplace/{marketplace_id}/get_currencies
**Description:** This method returns the default currency used by the eBay marketplace specified in the request. This is the currency that the seller should use when providing price data for this marketplace through listing APIs.
**Parameters:**
- **marketplace_id** (string) *required*
  - This path parameter specifies the eBay marketplace for which currency information is retrieved.  
  
See the [Marketplace ID values](/develop/api/sell/request_headers#marketplace-id-values) type for a list of supported eBay marketplace ID values.
- **Accept-Language** (string)
  - This header is required to retrieve metadata for the French Canada and French Belgium marketplaces.  
  
Follow the instructions below to retrieve metadata for these marketplaces:

*   **French Belgium**: Set the **marketplace\_id** path parameter value to `EBAY_BE`, and include the **Accept-Language** header with a value of `fr-BE`.  
      
    **Note:** If `EBAY_BE` is set as the **marketplace\_id** path parameter and the **Accept-Language** header is not used, the marketplace will default to the Dutch Belgium marketplace.
*   **French Canada**: Set the **marketplace\_id** path parameter value to `EBAY_CA` and include the **Accept-Language** header with a value of `fr-CA`.
**Note:** If `EBAY_CA` is set as the **marketplace\_id** path parameter and the **Accept-Language** header is not used, the marketplace will default to the English Canada marketplace.
**OAuth scope**

This request requires an access token created with the **Client Credentials Grant** flow, using one or more scopes from the following list (please check your Application Keys page for a list of OAuth scopes available to your application):

**Required Scopes:**

**Client Credentials Grant:**

- `https://api.ebay.com/oauth/api_scope`

## Shared Types

Shared API-level schema and common type definitions live in [Metadata API_shared.md](Metadata API_shared.md).
