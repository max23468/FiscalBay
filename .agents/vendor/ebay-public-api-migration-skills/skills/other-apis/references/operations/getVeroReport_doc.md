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

### getVeroReport

#### GET /vero_report/{vero_report_id}
**Description:** **Important!** You must be a member of the Verified Rights Owner (VeRO) Program to use this call.

  
This method can be used to retrieve status information about a VeRO report you have submitted to eBay for copyright, trademark, or other intellectual property rights infringement.  
  
The **vero\_report\_id** path parameter is used to specify the eBay report for which to retrieve status information.
**Parameters:**
- **includeItemDetails** (string)
  - Include this query and set it to `true` if you want to retrieve the **reportedItemDetails** container in the response, which contains item-level status information. This container may be helpful if you have reported violations on more than one eBay item in the report.  
  
By default, this boolean is set to `false`.
- **vero_report_id** (string) *required*
  - This path parameter specifies the unique identifier of the VeRO report being retrieved.  
  
This value is returned when creating a VeRO report through the [createVeroReport](/api-docs/commerce/vero/resources/vero_report/methods/createVeroReport) method.
**OAuth scope**

This request requires an access token created with the **Client Credentials Grant** flow, using one or more scopes from the following list (please check your Application Keys page for a list of OAuth scopes available to your application):

**Required Scopes:**

**Client Credentials Grant:**

- `https://api.ebay.com/oauth/api_scope/commerce.vero`

## Shared Types

Shared API-level schema and common type definitions live in [VeRO API_shared.md](VeRO API_shared.md).
