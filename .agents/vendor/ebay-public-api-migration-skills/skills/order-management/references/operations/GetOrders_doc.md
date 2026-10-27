---
title: Fulfillment API
description: "Use the **Fulfillment API** to complete the process of packaging, addressing, handling, and shipping each order on behalf of the seller, in accordance with the payment method and timing specified at checkout. The API includes methods that allow the seller to get and post order, refund, and shipments information as well as work with payment disputes."
api_version: v1.20.6
api_name: fulfillment_api
api_type: REST
api_group: fulfillment/api
source_url:
  html: https://developer.ebay.com/develop/api/fulfillment/api
  md: https://developer.ebay.com/develop/api/fulfillment/api.md
---
# Fulfillment API

## API Methods

### getOrders

#### GET /order
**Description:** Use this method to search for and retrieve one or more orders based on their creation date, last modification date, or fulfillment status using the **filter** parameter. You can alternatively specify a list of orders using the **orderIds** parameter. Include the optional **fieldGroups** query parameter set to `TAX_BREAKDOWN` to return a breakdown of the taxes and fees. By default, when no filters are used this call returns all orders created within the last 90 days.  
  
The returned **Order** objects contain information you can use to create and process fulfillments, including:

*   Information about the buyer and seller
*   Information about the order's line items
*   The plans for packaging, addressing and shipping the order
*   The status of payment, packaging, addressing, and shipping the order
*   A summary of monetary amounts specific to the order such as pricing, payments, and shipping costs
*   A summary of applied taxes and fees, and optionally a breakdown of each

  
  
**Important:** In this call, the **cancelStatus.cancelRequests** array is returned but is always empty. Use the **getOrder** call instead, which returns this array fully populated with information about any cancellation requests.
**Parameters:**
- **fieldGroups** (string)
  - This parameter lets you control what is returned in the response.  
  
**Note:** The only presently supported value is `TAX_BREAKDOWN`. This field group adds addition fields to the response that return a breakdown of taxes and fees.
- **filter** (string)
  - One or more comma-separated criteria for narrowing down the collection of orders returned by this call. These criteria correspond to specific fields in the response payload. Multiple filter criteria combine to further restrict the results.  
  
**Note:** **getOrders** can return orders up to two years old. Do not set the `creationdate` filter to a date beyond two years in the past.  
**Note:** If the **orderIds** parameter is included in the request, the **filter** parameter will be ignored.  
The available criteria are as follows:

`**creationdate**`

The time period during which qualifying orders were created (the **orders.creationDate** field). In the URI, this is expressed as a starting timestamp, with or without an ending timestamp (in brackets). The timestamps are in ISO 8601 format, which uses the 24-hour Universal Coordinated Time (UTC) clock.For example:

*   `creationdate:[2016-02-21T08:25:43.511Z..]` identifies orders created on or after the given timestamp.
*   `creationdate:[2016-02-21T08:25:43.511Z..2016-04-21T08:25:43.511Z]` identifies orders created between the given timestamps, inclusive.

`**lastmodifieddate**`

The time period during which qualifying orders were last modified (the **orders.modifiedDate** field). In the URI, this is expressed as a starting timestamp, with or without an ending timestamp (in brackets). The timestamps are in ISO 8601 format, which uses the 24-hour Universal Coordinated Time (UTC) clock.For example:

*   `lastmodifieddate:[2016-05-15T08:25:43.511Z..]` identifies orders modified on or after the given timestamp.
*   `lastmodifieddate:[2016-05-15T08:25:43.511Z..2016-05-31T08:25:43.511Z]` identifies orders modified between the given timestamps, inclusive.

**Note:** If **creationdate** and **lastmodifieddate** are both included, only **creationdate** is used.  
  

`**orderfulfillmentstatus**`

The degree to which qualifying orders have been shipped (the **orders.orderFulfillmentStatus** field). In the URI, this is expressed as one of the following value combinations:

*   `orderfulfillmentstatus:{NOT_STARTED|IN_PROGRESS}` specifies orders for which no shipping fulfillments have been started, plus orders for which at least one shipping fulfillment has been started but not completed.
*   `orderfulfillmentstatus:{FULFILLED|IN_PROGRESS}` specifies orders for which all shipping fulfillments have been completed, plus orders for which at least one shipping fulfillment has been started but not completed.

**Note:** The values `NOT_STARTED`, `IN_PROGRESS`, and `FULFILLED` can be used in various combinations, but only the combinations shown here are currently supported.

Here is an example of a **getOrders** call using all of these filters:  
  
`GET https://api.ebay.com/sell/v1/order?   filter=**creationdate**:%5B2016-03-21T08:25:43.511Z..2016-04-21T08:25:43.511Z%5D,   **lastmodifieddate**:%5B2016-05-15T08:25:43.511Z..%5D,   **orderfulfillmentstatus**:%7BNOT_STARTED%7CIN_PROGRESS%7D`  
  
**Note:** This call requires that certain special characters in the URI query string be percent-encoded:  
    `[` = `%5B`       `]` = `%5D`       `{` = `%7B`       `|` = `%7C`       `}` = `%7D`  
This query filter example uses these codes. For implementation help, refer to eBay API documentation at https://developer.ebay.com/api-docs/sell/fulfillment/types/api:FilterField
- **limit** (string)
  - The number of orders to return per page of the result set. Use this parameter in conjunction with the **offset** parameter to control the pagination of the output.  
  
For example, if **offset** is set to `10` and **limit** is set to `10`, the call retrieves orders 11 through 20 from the result set.  
  
If a limit is not set, the **limit** defaults to 50 and returns up to 50 orders. If a requested limit is more than 200, the call fails and returns an error.  
  
**Note:** This feature employs a zero-based list, where the first item in the list has an offset of `0`. If the **orderIds** parameter is included in the request, this parameter will be ignored.  
  
**Maximum:** `200`  
**Default:** `50`
- **offset** (string)
  - Specifies the number of orders to skip in the result set before returning the first order in the paginated response.

Combine **offset** with the **limit** query parameter to control the items returned in the response. For example, if you supply an **offset** of `0` and a **limit** of `10`, the first page of the response contains the first 10 items from the complete list of items retrieved by the call. If **offset** is `10` and **limit** is `20`, the first page of the response contains items 11-30 from the complete result set.

**Default:** 0
- **orderIds** (string)
  - A comma-separated list of the unique identifiers of the orders to retrieve (maximum 50). If one or more order ID values are specified through the **orderIds** query parameter, all other query parameters will be ignored.  
  
**Note:** **getOrders** can return orders up to two years old. Do not provide the **orderId** for an order created more than two years in the past.
**OAuth scope**

This request requires an access token created with the **Client Credentials Grant** flow, using one or more scopes from the following list (please check your Application Keys page for a list of OAuth scopes available to your application):

**Required Scopes:**

**Client Credentials Grant:**

- `https://api.ebay.com/oauth/api_scope/sell.fulfillment`
- `https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly`

## Shared Types

Shared API-level schema and common type definitions live in [Fulfillment API_shared.md](Fulfillment API_shared.md).
