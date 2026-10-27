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

### getHandlingTimes

#### GET /shipping/marketplace/{marketplace_id}/get_handling_times
**Description:** This method retrieves a list of supported handling times for the specified marketplace. The handling time returned specifies the maximum number of business days the eBay site allows for shipping an item to domestic buyers after receiving a cleared payment. Handling times apply to both domestic and international orders. If the handling time is 1 day, the seller commits to dropping the item off for shipment one business day after payment clears.

Manage handing times using business policies through the **fulfillment\_policy** resource of the **Account v1 API**.
**Parameters:**
- **Accept-Language** (string)
  - This header is required to retrieve metadata for the French Canada, French Belgium, and Dutch Belgium marketplaces.  
  
Follow the instructions below to retrieve metadata for these three marketplaces:

*   **French Belgium**: Set the **marketplace\_id** path parameter value to `EBAY_BE`, and include the **Accept-Language** header with a value of `fr-BE`.
*   **Dutch Belgium**: Set the **marketplace\_id** path parameter value to `EBAY_BE`, and include the **Accept-Language** header with a value of `nl-BE`.
*   **French Canada**: Set the **marketplace\_id** path parameter value to `EBAY_CA`, and include the **Accept-Language** header with a value of `fr-CA`.

**Note:** If `EBAY_CA` is set as the **marketplace\_id** path parameter and the **Accept-Language** header is not used, the marketplace will default to the English Canada marketplace.
- **marketplace_id** (string) *required*
  - This path parameter specifies the eBay marketplace for which handling times information is retrieved.  
  
See [Marketplace ID values](/develop/api/sell/request_headers#marketplace-id-values) for supported eBay marketplace ID values.

**Note:** When listing the items on the French Canada, French Belgium, and Dutch Belgium marketplaces, also set the **Accept-Language** header as needed.
**OAuth scope**

This request requires an access token created with the **Client Credentials Grant** flow, using one or more scopes from the following list (please check your Application Keys page for a list of OAuth scopes available to your application):

**Required Scopes:**

**Client Credentials Grant:**

- `https://api.ebay.com/oauth/api_scope`

## Shared Types

Shared API-level schema and common type definitions live in [Metadata API_shared.md](Metadata API_shared.md).
