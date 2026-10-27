---
title: auction_activity
description: "Notifications sent when bids are placed on an auction item."
event_label: AUCTION_ACTIVITY
delivery_channel: HTTPS webhook (POST)
notification_group: Account Management
---
- Source URL: https://developer.ebay.com/develop/api/sell/notification_events


# auction_activity

## Overview

**Event Label:** AUCTION_ACTIVITY  
**Delivery Channel:** HTTPS webhook (POST)  
**Summary:** Notifications sent when bids are placed on an auction item.

## Event Details

A subscription for this topic initiates auction activity related notifications being sent to bidders and sellers.

The four notifications that may be sent are:

*   BID\_PLACED (buyer only)
    
*   BID\_RECEIVED (seller only)
    
*   OUTBID (buyer only)
    
*   AUCTION\_WON (buyer only)

## Spec

**Spec Name:** auction_activity  
**Spec Type:** REST  
**Version:** 1.0.0

```yaml
asyncapi: 2.0.0
info:
  title: eBay Auction Activity Notification
  version: 1.0.0
  description: "This notification is sent to subscribed bidders/sellers when auction activity is detected. A BID_PLACED notification is sent to a subscribed buyer when the buyer places a bid for an auction item. A BID_RECEIVED notification is sent to the seller each time a prospective buyer places a bid for the seller's auction item. An OUTBID notification is sent to a subscribed buyer when another buyer has submitted a bid that is higher bid than that submitted by the subscribed buyer and the subscribed buyer is no longer the current high bidder. An ITEM_WON notification is sent to a subscribed buyer when they are the winner of an auction item."
channels:
  AUCTION_ACTIVITY:
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
          description: 'This field references the payload for the auction activity events notifications.'
          $ref: '#/components/schemas/Payload'

    Payload:   
      type: object
      description: 'This type is the payload for the Auction Activity notification.'
      properties:          
        itemId: 
          description: 'This string is the unique ID associated with the item being auctioned.'        
          type: string
        activity: 
          description: 'This object is the auction activity that has triggered the sending of an AUCTION_ACTIVITY notification.'
          $ref: '#/components/schemas/AuctionActivity'
        seller:
          description: 'This object is the information about the seller.'
          $ref: '#/components/schemas/User'
        buyer:
          description: 'This object is the information about the buyer who has placed the bid, has been outbid, or has won the auction.'
          $ref: '#/components/schemas/User'
          
    AuctionActivity: 
      description: "This enumerated type represents the auction activity that has triggered the sending of an AUCTION_ACTIVITY notification. | - **BID_PLACED**: This indicates the buyer’s bid has been submitted on an auction-style listing. - **BID_RECEIVED**: This inidcates the seller’s listing has received a new bid from a buyer. - **OUTBID**: This indicates the buyer’s previous highest bid has been surpassed by another bidder. - **AUCTION_WON**: This indicates the buyer’s bid is highest at auction end and wins the item."
      type: object
      enum: 
        - BID_PLACED
        - BID_RECEIVED
        - OUTBID
        - AUCTION_WON
        
    User:
      type: object
      description: 'This type represents the information about the subscribed user.'
      properties:
        userId:
          description: 'This string is the unique, public identifier for the subscribed user.'
          type: string
        userName:
          description: 'This string is the username associated with the subscribed user.<br><br><span class=\"tablenote\"><strong>Note:</strong> Effective September 26, 2025, select developers will no longer receive username data for U.S. users through this field. Instead, an immutable user ID will be returned in its place. For more information, please refer to <a href=\"/api-docs/static/data-handling-update.html\">Data Handling Compliance</a>.</span>'
          type: string
```
