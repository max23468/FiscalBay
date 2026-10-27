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

### createShippingFulfillment

#### POST /order/{orderId}/shipping_fulfillment
**Description:** When you group an order's line items into one or more packages, each package requires a corresponding plan for handling, addressing, and shipping; this is _shipping fulfillment_. For each package, execute this call once to generate the shipping fulfillment associated with that package.  
  
**Note:** A single line item in an order can consist of multiple units of a purchased item, and one unit can consist of multiple parts or components. Although these components might be provided by the manufacturer in separate packaging, the seller must include all components of a given line item in the same package.  
Before using this call for a given package, you must determine which line items are in the package. If the package has been shipped, you should provide the date of shipment in the request. If not provided, it will default to the current date and time.  
  
This method can also be used to provide proof of delivery for contested payment disputes. To do so, use this method to create a shipping fulfillment and provide shipment tracking information for all line items involved in the dispute. eBay will then pick up this information for the dispute directly.
**Parameters:**
- **orderId** (string) *required*
  - This path parameter is used to specify the unique identifier of the order associated with the shipping fulfillment being created.  
  
Use the [getOrders](/api-docs/sell/fulfillment/resources/order/methods/getOrders) method to retrieve order IDs.
- **Content-Type** (string) *required*
  - This header indicates the format of the request body provided by the client. Its value should be set to **application/json**.  
  
For more information, refer to [HTTP request headers](/api-docs/static/rest-request-components.html#HTTP).
**OAuth scope**

This request requires an access token created with the **Client Credentials Grant** flow, using one or more scopes from the following list (please check your Application Keys page for a list of OAuth scopes available to your application):

**Required Scopes:**

**Client Credentials Grant:**

- `https://api.ebay.com/oauth/api_scope/sell.fulfillment`

## Shared Types

Shared API-level schema and common type definitions live in [Fulfillment API_shared.md](Fulfillment API_shared.md).
