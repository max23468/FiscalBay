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

### getCharityOrg

#### GET /charity_org/{charity_org_id}
**Description:** This call is used to retrieve detailed information about supported charitable organizations. It allows users to retrieve the details for a specific charitable organization using its charity organization ID.
**Parameters:**
- **charity_org_id** (string) *required*
  - The unique ID of the charitable organization.
- **X-EBAY-C-MARKETPLACE-ID** (string) *required*
  - A header used to specify the eBay marketplace ID.  
  
**Valid Values:** `EBAY_GB` and `EBAY_US`
**OAuth scope**

This request requires an access token created with the **Client Credentials Grant** flow, using one or more scopes from the following list (please check your Application Keys page for a list of OAuth scopes available to your application):

**Required Scopes:**

**Client Credentials Grant:**

- `https://api.ebay.com/oauth/api_scope`

## Shared Types

Shared API-level schema and common type definitions live in [Charity API_shared.md](Charity API_shared.md).
