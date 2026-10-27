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

### getVeroReportItems

#### GET /vero_report_items
**Description:** **Important!** You must be a member of the Verified Rights Owner (VeRO) Program to use this call.

  
This method can be used to retrieve status information about one or more VeRO reported items you have submitted.  
  
Without the use of any query parameters, the default behavior of this method is to return the status of all VeRO reported items submitted by the seller during the last two years. Use the **itemId** query parameter to see a specific reported item, and use the **filter** query to retrieve the status of reported items submitted within a specific date range. Pagination is also available to limit the number of reported items that are retrieved per page of data.
**Parameters:**
- **filter** (string)
  - This query parameter can be used to filter the result set by a date range. Only items reported within the specified time period will be returned.  
  
This parameter will be ignored if **itemId** has been specified.  
  
**Format:** `YYYY-MM-DD HH:MM:SS`  
  
**Example**: `reportSubmittedDate:[2024-11-14T07:47:48Z..2024-12-14T07:47:48Z]`.
- **itemId** (string)
  - This query parameter specifies the unique identifier of an eBay listing. Only the specified reported item will be returned.
- **limit** (string)
  - The maximum number of entries that can be returned on each page of the paginated response. Use this parameter in conjunction with the **offset** parameter to control the pagination of the output.  
  
**Note:** This feature employs a zero-based list, where the first item in the list has an offset of `0`.  
For example, if **offset** is set to `10` and **limit** is set to `10`, the call retrieves entries 11 through 20 from the result set.  
  
If this parameter is omitted, the default value is used.  
  
**Default:** 25
- **offset** (string)
  - The number of reports to skip in the result set before returning the first report in the paginated response. Combine offset with the **limit** query parameter to control the reports returned in the response. For example, if you supply an **offset** of `0` and a **limit** of `10`, the first page of the response contains the first 10 reports from the complete list of reports retrieved by the call. If this query parameter is not set, the default value is used and the first page of reports is returned.  
  
**Default:** 0
**OAuth scope**

This request requires an access token created with the **Client Credentials Grant** flow, using one or more scopes from the following list (please check your Application Keys page for a list of OAuth scopes available to your application):

**Required Scopes:**

**Client Credentials Grant:**

- `https://api.ebay.com/oauth/scope/commerce.vero`

## Error Codes

The following error codes may be returned by this API:

## Shared Types

Shared API-level schema and common type definitions live in [VeRO API_shared.md](VeRO API_shared.md).
