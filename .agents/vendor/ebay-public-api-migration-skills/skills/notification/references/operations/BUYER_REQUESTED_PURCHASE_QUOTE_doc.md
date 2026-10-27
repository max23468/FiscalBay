---
title: buyer_requested_purchase_quote
description: "Notification when buyer requests a quote"
event_label: BUYER_REQUESTED_PURCHASE_QUOTE
delivery_channel: HTTPS webhook (POST)
notification_group: Order Management
---
- Source URL: https://developer.ebay.com/develop/api/sell/notification_events


# buyer_requested_purchase_quote

## Overview

**Event Label:** BUYER_REQUESTED_PURCHASE_QUOTE  
**Delivery Channel:** HTTPS webhook (POST)  
**Summary:** Notification when buyer requests a quote

## Event Details

Use this event to receive a notification when a buyer requests the total price of one or more item commitments before paying.

## Spec

**Spec Name:** buyer_requested_purchase_quote  
**Spec Type:** REST  
**Version:** 1.0.0

```yaml
asyncapi: 2.0.0
info:
  title: eBay Buyer Requested Purchase Quote Notifications
  version: 1.0.0
  description: 'This notification is sent to a subscribed seller when a buyer/winning bidder is requesting a total price before paying for the item. This notification is applicable for auction listings and for fixed-price listings that do not require immediate payment. For fixed-price items, a BUYER_REQUESTED_PURCHASE_QUOTE notification would be received by the seller before a FixedPriceTransaction notification. For auction items, a BUYER_REQUESTED_PURCHASE_QUOTE notification would be received by the seller after an EndOfAuction notification, but before an AuctionCheckoutComplete notification. A BUYER_REQUESTED_PURCHASE_QUOTE notification may be sent multiple times for the same listing if a buyer requests a total more than once.'
channels:
  BUYER_REQUESTED_PURCHASE_QUOTE:
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
          $ref: '#/components/schemas/BuyerRequestedPurchaseQuoteData'

    BuyerRequestedPurchaseQuoteData:
      type: object
      description: 'This type is the payload for the Buyer Requested Purchase Quote notification.'
      properties:
        itemCommitments:
          type: array
          description: 'This array is a list of one or more item commitments associated with the purchase quote.'
          items:
            type: object
            $ref: '#/components/schemas/ItemCommitment'

    ItemCommitment:
      type: object
      description: 'This type is the item commitment details associated with the purchase quote.'
      properties:
        listingId:
          type: string
          description: 'This string is the unique identifier for the listing.'
        itemCommitmentId:
          type: string
          description: 'This string is the unique identifier for the item commitment.'
        quantity:
          type: integer
          description: 'This integer is the quantity for this item commitment.'
```
