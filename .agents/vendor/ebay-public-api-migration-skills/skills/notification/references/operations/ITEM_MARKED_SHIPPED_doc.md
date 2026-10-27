---
title: item_marked_shipped
description: "Sent when a seller marks an item as shipped."
event_label: ITEM_MARKED_SHIPPED
delivery_channel: HTTPS webhook (POST)
notification_group: Order Management
---
- Source URL: https://developer.ebay.com/develop/api/sell/notification_events


# item_marked_shipped

## Overview

**Event Label:** ITEM_MARKED_SHIPPED  
**Delivery Channel:** HTTPS webhook (POST)  
**Summary:** Sent when a seller marks an item as shipped.

## Event Details

Use this event to update shipment status, notify the buyer-facing experience, and reconcile fulfillment systems. Treat deliveries as at-least-once and deduplicate by eventId.

## Spec

**Spec Name:** item_marked_shipped  
**Spec Type:** REST  
**Version:** 1.0.0

```yaml
asyncapi: 2.0.0
info:
  title: eBay Notifications
  version: 1.0.0
  description: This contract defines eBay notification for ITEM_MARKED_SHIPPED.
channels:
  ITEM_MARKED_SHIPPED:
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
            description: The ECC message signature. This signature is used to process and validate the message payload.
            type: string
      payload:
        type: object
        properties:
          metadata:
            $ref: '#/components/schemas/MetaData'
          notification:
            $ref: '#/components/schemas/Notification'

  schemas:
    MetaData:
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
          description: 'This field references the item marked shipped data.'
          $ref: '#/components/schemas/ItemMarkedShippedData'

    ItemMarkedShippedData:
      type: object
      description: 'This is the payload for the ITEM_MARKED_SHIPPED event.'
      properties:
        trackingNumber:
          type: string
          description: This string is the shipment tracking number.
        carrier:
          type: string
          description: This string is the shipping carrier (e.g., USPS, UPS, FedEx).
        shippedDate:
          type: string
          format: date-time
          description: This string is the date-time when the item was marked shipped, including timezone offset.
        orderId:
          type: string
          description: This string is the order ID associated with the shipment.
        itemId:
          type: string
          description: This string represents the item ID.
        transactionId:
          type: string
          description: This string represents the transaction ID for the item.
        lineItemId:
          type: string
          description: This string is the composite ID of item and transaction (line item).
        publicUserId:
          type: string
          description: This string is the immutable user identifier associated with the seller.
        username:
          type: string
          description: >
            The seller's username. Effective September 26, 2025, select developers will no longer receive username data for U.S. users through this field. Instead, an immutable user ID will be returned in its place. For more information, please refer to [Data Handling Compliance](https://developer.ebay.com/api-docs/static/data-handling-update.html).
```
