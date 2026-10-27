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

### getOrder

#### GET /order/{orderId}
**Description:** Use this call to retrieve the contents of an order based on its unique identifier, _orderId_. This value was returned in the **getOrders** call's **orders.orderId** field when you searched for orders by creation date, modification date, or fulfillment status. Include the optional **fieldGroups** query parameter set to `TAX_BREAKDOWN` to return a breakdown of the taxes and fees.  
  
The returned **Order** object contains information you can use to create and process fulfillments, including:

*   Information about the buyer and seller
*   Information about the order's line items
*   The plans for packaging, addressing and shipping the order
*   The status of payment, packaging, addressing, and shipping the order
*   A summary of monetary amounts specific to the order such as pricing, payments, and shipping costs
*   A summary of applied taxes and fees, and optionally a breakdown of each
**Parameters:**
- **fieldGroups** (string)
  - This parameter lets you control what is returned in the response.  
  
**Note:** The only presently supported value is `TAX_BREAKDOWN`. This field group adds addition fields to the response that return a breakdown of taxes and fees.
- **orderId** (string) *required*
  - This path parameter is used to specify the unique identifier of the order being retrieved.  
  
Use the [getOrders](/api-docs/sell/fulfillment/resources/order/methods/getOrders) method to retrieve order IDs. Order ID values are also shown in My eBay/Seller Hub.  
  
**Note:** **getOrders** can return orders up to two years old. Do not provide the **orderId** for an order created more than two years in the past.
**OAuth scope**

This request requires an access token created with the **Client Credentials Grant** flow, using one or more scopes from the following list (please check your Application Keys page for a list of OAuth scopes available to your application):

**Required Scopes:**

**Client Credentials Grant:**

- `https://api.ebay.com/oauth/api_scope/sell.fulfillment`
- `https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly`

## Shared Types

Shared API-level schema and common type definitions live in [Fulfillment API_shared.md](Fulfillment API_shared.md).
