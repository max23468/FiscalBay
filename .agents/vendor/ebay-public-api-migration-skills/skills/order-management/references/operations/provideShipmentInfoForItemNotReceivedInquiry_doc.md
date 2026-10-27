---
title: Order Inquiry
description: "This API allows a seller to view and manage any Item Not Received inquiries that buyers might file against them. There is a query to receive multiple queries using various filter criteria and a query to retrieve a specific inquiry. There are mutation that allow the user provide shipment tracking information for the inquiry, send a message to the order partner, issue a refund, or refer the inquiry to eBay customer support for furhter investigation."
api_version: 1.0
api_name: sell_order_inquiry
api_type: GraphQL
api_group: sell/order
source_url:
  html: https://developer.ebay.com/develop/api/sell/order
  md: https://developer.ebay.com/develop/api/sell/order.md
---
# Order Inquiry API

This API allows a seller to view and manage any Item Not Received inquiries that buyers might file against them. There is a query to receive multiple queries using various filter criteria and a query to retrieve a specific inquiry. There are mutation that allow the user provide shipment tracking information for the inquiry, send a message to the order partner, issue a refund, or refer the inquiry to eBay customer support for furhter investigation.

## GraphQL Schema Information

**Queries:** 2
**Mutations:** 4
**Types:** 1394

## Mutations

### provideShipmentInfoForItemNotReceivedInquiry

This mutation can be used to provide shipment-related information in response to an Item Not Received inquiry. The information is submitted by the responder (typically the seller) to fulfill an existing information request initiated earlier in the inquiry flow, and will be shared with the initiator (typically the buyer or system) and other inquirers involved in the inquiry.

**Returns:** `ProvideShipmentInfoForItemNotReceivedInquiryOutput!`

**Arguments:**
- **input** (ProvideShipmentInfoForItemNotReceivedInquiryInput!)

**OAuth scope**

This request requires an access token created with the **Authorization Code Grant** flow, using one or more scopes from the following list (please check your Application Keys page for a list of OAuth scopes available to your application):

**Required Scopes:**

**Authorization Code Grant:**

- `https://api.ebay.com/oauth/api_scope/sell.inquiry`

## Shared Types

Shared API-level schema and common type definitions live in [Order Inquiry API_shared.md](Order Inquiry API_shared.md).
