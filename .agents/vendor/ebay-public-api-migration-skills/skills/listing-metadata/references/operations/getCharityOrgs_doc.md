---
title: Charity API
description: "The eBay **Charity API** provides buyers and sellers a formal way to search for supported charitable organizations and charitable organization details. **Note:** The **Charity API** is supported only in the UK and US marketplaces. For more information about using RESTful APIs, see [Get started with eBay APIs](/develop/guides-v2/get-started-with-ebay-apis/get-started-with-ebay-apis#overview) and [Using eBay RESTful APIs](/develop/guides-v2/using-ebay-restful-apis/using-ebay-restful-apis#overview). #### Sandbox vs. Production data The data in the eBay Sandbox environment is static. It can be limited in scope and quantity, and is sometimes simulated or mock data. As a result, you should not depend on data in the Production environment to have the same limitations. Use good coding practices to anticipate the wider range and variability of data that your application is likely to encounter."
api_version: v1.2.1
api_name: charity_api
api_type: REST
api_group: charity/api
source_url:
  html: https://developer.ebay.com/develop/api/charity/api
  md: https://developer.ebay.com/develop/api/charity/api.md
---
# Charity API

## API Methods

### getCharityOrgs

#### GET /charity_org
**Description:** This call is used to search for supported charitable organizations. It allows users to search for a specific charitable organization, or for multiple charitable organizations, from a particular charitable domain and/or geographical region, or by using search criteria.  
  
The call returns paginated search results containing the charitable organizations that match the specified criteria.
**Parameters:**
- **limit** (string)
  - The number of items, from the result set, returned in a single page.  
  
**Valid Values:** `1-100`  
  
**Default:** `20`
- **offset** (string)
  - The number of items that will be skipped in the result set. This is used with the **limit** field to control the pagination of the output.  
  
For example, if the **offset** is set to `0` and the **limit** is set to `10`, the method will retrieve items 1 through 10 from the list of items returned. If the **offset** is set to `10` and the **limit** is set to `10`, the method will retrieve items 11 through 20 from the list of items returned.  
  
**Valid Values:** `0-10,000`  
  
**Default:** `0`
- **q** (string)
  - A query string that matches the keywords in name, mission statement, or description.
- **registration_ids** (string)
  - A comma-separated list of charitable organization registration IDs.  
  
**Note:** Do not specify this parameter for query-based searches. Specify either the **q** or **registration\_ids** parameter, but not both.  
  
**Maximum Limit:** `20`
- **X-EBAY-C-MARKETPLACE-ID** (string) *required*
  - A header used to specify the eBay marketplace ID.  
  
**Valid Values:** `EBAY_GB` and `EBAY_US`
**OAuth scope**

This request requires an access token created with the **Client Credentials Grant** flow, using one or more scopes from the following list (please check your Application Keys page for a list of OAuth scopes available to your application):

**Required Scopes:**

**Client Credentials Grant:**

- `https://api.ebay.com/oauth/api_scope`

## Error Codes

The following error codes may be returned by this API:

## Shared Types

Shared API-level schema and common type definitions live in [Charity API_shared.md](Charity API_shared.md).
