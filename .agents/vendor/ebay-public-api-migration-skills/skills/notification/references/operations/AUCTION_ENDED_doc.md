---
title: auction_ended
description: "Notifications sent to buyers and sellers when an auction ends."
event_label: AUCTION_ENDED
delivery_channel: HTTPS webhook (POST)
notification_group: Account Management
---
- Source URL: https://developer.ebay.com/develop/api/sell/notification_events


# auction_ended

## Overview

**Event Label:** AUCTION_ENDED  
**Delivery Channel:** HTTPS webhook (POST)  
**Summary:** Notifications sent to buyers and sellers when an auction ends.

## Event Details

A subscription for this topic initiates a notification being sent to buyers and sellers as soon as an auction listing ends, with or without a winning bidder.

## Spec

**Spec Name:** auction_ended  
**Spec Type:** REST  
**Version:** 1.0.0

```yaml
asyncapi: 2.0.0
info:
  title: eBay Auction End Notification
  version: 1.0.0
  description: "This notification is sent to subscribed buyers and sellers as soon as an auction listing ends with or without a winning bidder. This notification will also be sent if the auction ends as a result of a buyer using the auction listing's Buy It Now feature. This notification is only applicable for auction listings."
channels:
  AUCTION_ENDED:
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
          description: 'This field references the payload for the auction ended events notifications.'
          $ref: '#/components/schemas/Payload'

    Payload:   
      type: object
      description: 'This type is the payload for the Auction Ended notification.'
      properties:          
        itemId: 
          description: 'This string is the unique identifier of the item for which the Auction Ended notification is being sent.' 
          type: string
        seller:
          description: 'This string is the user information for the seller of the item for which the Auction Ended notification is being sent.'
          $ref: '#/components/schemas/User'
        
    User:
      type: object
      description: 'This type is the user information for the subscribed recipient of the Auction Ended notification.'
      properties:
        userId:
          description: 'This string is the unique public identifier for the subscribed recipient of the Auction Ended notification.'
          type: string
        userName:
          description: 'This string is the username associated with the subscribed recipient of the Auction Ended notification.<br><br><span class=\"tablenote\"><strong>Note:</strong> Effective September 26, 2025, select developers will no longer receive username data for U.S. users through this field. Instead, an immutable user ID will be returned in its place. For more information, please refer to <a href=\"/api-docs/static/data-handling-update.html\">Data Handling Compliance</a>.</span>'
          type: string
```
