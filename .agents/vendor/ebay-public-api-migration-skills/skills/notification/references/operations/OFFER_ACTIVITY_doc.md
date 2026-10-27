---
title: offer_activity
description: "Notifications sent to buyer or seller when listing offer activity occurs."
event_label: OFFER_ACTIVITY
delivery_channel: HTTPS webhook (POST)
notification_group: Offers and Leads
---
- Source URL: https://developer.ebay.com/develop/api/sell/notification_events


# offer_activity

## Overview

**Event Label:** OFFER_ACTIVITY  
**Delivery Channel:** HTTPS webhook (POST)  
**Summary:** Notifications sent to buyer or seller when listing offer activity occurs.

## Event Details

A subscription for this topic initiates offer-related notifications being sent to a buyer or seller when listing offer activity occurs.

The four notifications that may be sent are:

*   BUYER\_OFFER (seller only)
    
*   BUYER\_COUNTER\_OFFER (seller only)
    
*   SELLER\_OFFER (buyer only)
    
*   SELLER\_COUNTER\_OFFER (buyer only).

## Spec

**Spec Name:** offer_activity  
**Spec Type:** REST  
**Version:** 1.0.0

```yaml
asyncapi: 2.0.0
info:
  title: eBay Offer Activity Notification
  version: 1.0.0
  description: "This contract outlines the parameters of eBay's notification service for offer-related activity. The service notifies sellers and buyers whenever a new offer is made or an existing offer they are tracking is updated."
channels:
  OFFER_ACTIVITY:
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
                enum: [ 'application/json' ]
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
        description: 'Payload for the best offer event'
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
          description: 'This field references the payload for the offer events.'
          $ref: '#/components/schemas/Payload'

    Payload:
      type: object
      description: 'This type is the payload for best offer events.'
      properties:
        offerId:
          description: 'This string is the unique ID for the offer record.'
          type: string
        itemId:
          description: 'This string indicates the item on which the offer activity took place.'
          type: string
        status:
          description: 'This object represents the current state of the offer in its lifecycle'
          $ref: '#/components/schemas/OfferStatus'
        offerType:
          description: 'This object references the type of the offer based on the current negotiation status. It indicates if the offer was sent by the seller or the buyer and if this was an initial or counter offer.'
          $ref: '#/components/schemas/OfferType'
        seller:
          description: 'This object represents the seller.'
          $ref: '#/components/schemas/User'
        buyer:
          description: 'This object represents the buyer who placed the offer.'
          $ref: '#/components/schemas/User'

    OfferStatus:
      description: "This enumerated type is the current status of the offer. | - **PENDING**: The offer is awaiting a response from the buyer. - **DECLINED**: The buyer has declined the seller's offer. - **ACCEPTED**: The buyer has accepted the offer that was sent by the seller. - **EXPIRED**: The offer reached its deadline and is no longer available to the buyer."
      type: string
      enum:
        - PENDING
        - DECLINED
        - ACCEPTED
        - EXPIRED
        
    OfferType:
      description: "This enumerated type describes the offer based on the current negotiation status. It also indicate who sent this offer and whether this was an initial offer or a counter offer. | - **BUYER_OFFER**: This is the offer initiated by the buyer on a listing, pending seller response. - **BUYER_COUNTER_OFFER**: This is a buyer’s revised offer in response to a previous seller offer.. - **SELLER_OFFER**: This is a seller-initiated offer to sell the item to the buyer at a specified price. - **SELLER_COUNTER_OFFER**: This is a seller's revised offer in response to a previous buyer offer."
      type: string
      enum:
        - BUYER_OFFER
        - BUYER_COUNTER_OFFER
        - SELLER_OFFER
        - SELLER_COUNTER_OFFER

    User:
      type: object
      description: 'This type contains the user details for the notification subscriber.'
      properties:
        userId:
          description: 'This string is the unique identifier for the user. Note this is the public userId.'
          type: string
        userName:
          description: 'This string is the username associated with the user.<br><br><span class=\"tablenote\"><strong>Note:</strong> Effective September 26, 2025, select developers will no longer receive username data for U.S. users through this field. Instead, an immutable user ID will be returned in its place. For more information, please refer to <a href=\"/api-docs/static/data-handling-update.html\">Data Handling Compliance</a>. </span>'
          type: string
```
