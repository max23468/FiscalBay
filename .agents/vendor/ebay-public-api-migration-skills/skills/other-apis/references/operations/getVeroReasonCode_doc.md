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

### getVeroReasonCode

#### GET /vero_reason_code/{vero_reason_code_id}
**Description:** **Important!** You must be a member of the Verified Rights Owner (VeRO) Program to use this call.

  
This method is used to retrieve the details of a specific VeRO reason code, including a description of the code and the marketplace associated with the code.  
  
The **vero\_reason\_code\_id** of the VeRO reason code for which to retrieve details is required as a path parameter.
**Parameters:**
- **vero_reason_code_id** (string) *required*
  - This path parameter specifies the unique identifier of the VeRO reason code that is to be retrieved.  
  
Use the [getVeroReasonCodes](/api-docs/commerce/vero/resources/vero_reason_code/methods/getVeroReasonCodes) method to retrieve supported VeRO reason code IDs.
**OAuth scope**

This request requires an access token created with the **Client Credentials Grant** flow, using one or more scopes from the following list (please check your Application Keys page for a list of OAuth scopes available to your application):

**Required Scopes:**

**Client Credentials Grant:**

- `https://api.ebay.com/oauth/api_scope/commerce.vero`

## Shared Types

Shared API-level schema and common type definitions live in [VeRO API_shared.md](VeRO API_shared.md).
