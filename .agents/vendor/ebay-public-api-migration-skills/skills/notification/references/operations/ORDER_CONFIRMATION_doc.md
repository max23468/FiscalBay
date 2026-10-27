---
title: order_confirmation
description: "Notification sent to seller when buyer completes checkout"
event_label: ORDER_CONFIRMATION
delivery_channel: HTTPS webhook (POST)
notification_group: Order Management
---
- Source URL: https://developer.ebay.com/develop/api/sell/notification_events


# order_confirmation

## Overview

**Event Label:** ORDER_CONFIRMATION  
**Delivery Channel:** HTTPS webhook (POST)  
**Summary:** Notification sent to seller when buyer completes checkout

## Event Details

This notification is sent to a seller when the buyer completes the checkout process and payment clears for a fixed price or auction listing.

## Spec

**Spec Name:** order_confirmation  
**Spec Type:** REST  
**Version:** 1.0.0

```yaml
asyncapi: 2.0.0
info:
  title: eBay Order Confirmation Notifications
  version: 1.0.0
  description: 'An ORDER_CONFIRMATION notification is sent when a buyer completes the checkout process for an auction or fixed-price item. Usually, an ORDER_CONFIRMATION notification occurs only once per listing. However, if the payment for checkout fails, the checkout status will change from "complete" to "incomplete." If the buyer then successfully pays for the item via checkout, the checkout status will change back to "complete" again. When the checkout status changes back to "complete," another ORDER_CONFIRMATION notification will be sent. An ORDER_CONFIRMATION notification is generated for each line item in the order. The seller looks up the orderId from the notification and then issues a GetOrders call (using the orderId as an input filter) to retrieve complete order information.'
channels:
  ORDER_CONFIRMATION:
    subscribe:
      message:
        $ref: '#/components/messages/message'
      bindings:
        http:
          type: request
          method: POST
          headers:
            type: object
            properties:
              Content-Type:
                type: string
                enum: ['application/json']
components:
  messages:
    message:
      headers:
        type: object
        properties:
          X-EBAY-SIGNATURE:
            description: 'The ECC message signature. This signature is used to process and validate the message payload.'
            type: string
      payload:
        type: object
        properties:
          metadata:
            $ref: '#/components/schemas/Metadata'
          notification:
            $ref: '#/components/schemas/Notification'
            
  schemas:
    Metadata:
      type: object
      description: 'This type specifies the metadata included with the notification.'
      properties:
        topic:
          type: string
          description: 'This specifies the topic to which the notification is subscribed.'
        schemaVersion:
          type: string
          description: 'This specifies the schema for this topic.'
        deprecated:
          type: boolean
          description: 'This specifies if this is a deprecated schema or topic.'
          default: false

    Notification:
      type: object
      description: 'This type includes information about the notification.'
      properties:
        notificationId:
          type: string
          description: 'This specifies the notification ID.'
        eventDate:
          type: string
          description: 'This specifices the event date associated with this notification in UTC format.'
        publishDate:
          type: string
          description: 'This specifies the publish date of the message in UTC format.'
        publishAttemptCount:
          type: integer
          description: 'This indicates the number of attempts made to publish this message.'
        data:
          description: 'This field references the order confirmation data.'
          $ref: '#/components/schemas/OrderConfirmationData'

    OrderConfirmationData:
      type: object
      description: 'This type is the payload for the Order Confirmation notification.'
      properties:
        order:
          type: object
          description: 'This object contains the order details for the notification subscriber.'  
          $ref: '#/components/schemas/Order' 
        

    Order:
      type: object
      description: 'This type contains the order details for the notification subscriber.'
      properties:
        orderId:
          type: string
          description: 'This string is the unique identifier for the order.'
        orderLineItems:
          type: array
          description: 'This array contains the order line item information for the order.'
          items:
            $ref: '#/components/schemas/OrderLineItem' 

    OrderLineItem:
      type: object
      description: 'This type contains the order line item information.'
      properties:
        orderLineItemId:
          type: string
          description: 'This string is the unique identifier for the line item.'
        listingId:
          type: string
          description: 'This string is the unique identifier for the listing.'
        quantity:
          type: integer
          description: 'This integer value is the quantity of the item.'
```
