---
title: Finances API
description: "The **Finances API** retrieves a variety of seller transactional information, including the following: * Seller payouts for orders * Detailed information on other transaction types, including eBay shipping label purchases, buyer refunds, seller credits, and listing-related fees * Complete list of selling fees and credits during a specified date range * A detailed breakdown of order earnings and seller expenses for orders"
api_version: v1.19.0
api_name: finances_api
api_type: REST
api_group: finances/api
source_url:
  html: https://developer.ebay.com/develop/api/finances/api
  md: https://developer.ebay.com/develop/api/finances/api.md
---
# Finances API

## API Methods

### getBillingActivities

#### GET /billing_activity
**Description:** **Important!** Due to EU & UK Payments regulatory requirements, an additional security verification via Digital Signatures is required for certain API calls that are made on behalf of EU/UK sellers, including all **Finances API** methods. Please refer to [Digital Signatures for APIs](/develop/guides/digital-signatures-for-apis ) to learn more on the impacted APIs and the process to create signatures to be included in the HTTP payload.

  
**Note:** The **Finances API** does not support [Team Access](https://www.ebay.com/sellercenter/ebay-for-business/multi-user-account-access). Financial information, such as payouts or transactions, is only returned for the user that makes the call. You cannot use any of the methods in this API to return financial information for another user.  
This method retrieves filtered billing activities of the seller. Returned results are filtered through query parameters such as date range, activity ID, listing ID, or order ID. Sorting and pagination features help organize and navigate returned activities efficiently.
**Parameters:**
- **Accept-Language** (string)
  - This header indicates the natural language and locale preferred by the user for the response.  
  
For more information, see the **Accept-Language** header in [Request Headers](/develop/api/sell/request_headers) and [Marketplace ID values](/develop/api/sell/request_headers#marketplace-id-values). If not provided, defaults to `en-US`.
- **filter** (string)
  - This required field specifies which results to return in the response. Only one of the following four filter values must be used. A user can either retrieve all billing activity within a date range, or they can retrieve billing activity related to a specific eBay order, eBay listing, or they can retrieve information on a specific billing activity.  

*   **activityId**: If this filter is used, only information on a specific billing activity is returned. The [billingTransactionId](/develop/api/sell/finances_api#sell-finances_api-billing_activity-getbillingactivities.billingactivitylineitem.billingtransactionid) returned in the response can be used as the **activityId**.
*   **listingId**: If this filter is used, only billing activity associated with the specified listing is returned.
*   **orderId**: If this filter is used, only billing activity associated with the specified order is returned.
*   **transactionDate**: If a date range filter is used, only billing activity that occurred within the specified date range is returned. The starting date cannot be set back further than 120 days in the past. Use UTC date values in the following order: `[_start_.._end_]`

  
**Examples**  
  
IDs:  
`filter=activityID:{12**56}`  
  
Date range:  
`filter=transactionDate:[2025-10-01T00:00:00Z..2025-10-31T23:59:59Z]`
- **limit** (string)
  - Sets the maximum number of records to return per page of data.  

Use this parameter in conjunction with the **offset** parameter to control the pagination of the output. For example, with offset set to `20` and limit set to `10`, the call retrieves entries 21 through 30 from the result set.

Although this field is optional, if omitted the default value of `100` is used.

  
**Minimum:** `1`  
**Maximum:** `200`  
**Default:** `100`
- **offset** (string)
  - Specifies the number of records to skip in the result set. This is used with the `limit` field to control the pagination of the output. For example:  

*   If **offset** is `0` and **limit** is `10`, the method will retrieve records 1-10 from the list of records returned
*   If **offset** is `10` and **limit** is `10`, the method will retrieve records 11-20 from the list of records returned.

If this parameter is not set, its value defaults to `0` which returns the first page of records.

**Note:** This feature employs a zero-based list, where the first activity in the list has an offset of 0.

**Default:** `0` (zero, returns the first page)
- **sort** (string)
  - By default, transactions that match the input criteria are sorted in descending order according to the transaction date (most recent transactions returned first).  
  
To view transactions in ascending order instead (oldest transactions first), include the **sort** query parameter and set its value to `sort=transactionDate`. For example (ascending order):  
  
`filter=transactionDate:[2025-11-01T00:00:01.000Z..2025-11-12T00:00:01.000Z]&sort=transactionDate`  
  
Transactions can only be sorted according to transaction date. If omitted, defaults to descending order (most recent transactions returned first).
**OAuth scope**

This request requires an access token created with the **Client Credentials Grant** flow, using one or more scopes from the following list (please check your Application Keys page for a list of OAuth scopes available to your application):

**Required Scopes:**

**Client Credentials Grant:**

- `https://api.ebay.com/oauth/api_scope/sell.finances`

## Error Codes

The following error codes may be returned by this API:

## Shared Types

Shared API-level schema and common type definitions live in [Finances API_shared.md](Finances API_shared.md).
