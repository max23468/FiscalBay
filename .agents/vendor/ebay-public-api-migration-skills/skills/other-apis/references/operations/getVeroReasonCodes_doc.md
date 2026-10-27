---
title: VeRO API
description: "API documentation and reference"
api_version: 1.0.0
api_name: vero_api
api_type: REST
api_group: vero/api
source_url:
  html: https://developer.ebay.com/develop/api/vero/api
  md: https://developer.ebay.com/develop/api/vero/api.md
---
# VeRO API

## API Methods

### getVeroReasonCodes

#### GET /vero_reason_code
**Description:** **Important!** You must be a member of the Verified Rights Owner (VeRO) Program to use this call.

  
This method is used to retrieve the details of an array of VeRO reason codes. This information includes the descriptions of each code, as well as the marketplace associated with each code.  
  
If the **X-EBAY-C-MARKETPLACE-ID** header is present, only VeRO reason codes for that specific site will be returned. If this header is not included, all reason codes for all sites are returned.
**Parameters:**
- **X-EBAY-C-MARKETPLACE-ID** (string)
  - This header identifies the eBay marketplace for which to retrieve VeRO reason codes. If this header is used, only VeRO reason codes for the specified marketplace will be returned in the response.  
  
See [MarketplaceIdEnum](/api-docs/commerce/vero/types/br:MarketplaceIdEnum) for a list of supported values.
**OAuth scope**

This request requires an access token created with the **Client Credentials Grant** flow, using one or more scopes from the following list (please check your Application Keys page for a list of OAuth scopes available to your application):

**Required Scopes:**

**Client Credentials Grant:**

- `https://api.ebay.com/oauth/api_scope/commerce.vero`

## Shared Types

Shared API-level schema and common type definitions live in [VeRO API_shared.md](VeRO API_shared.md).
