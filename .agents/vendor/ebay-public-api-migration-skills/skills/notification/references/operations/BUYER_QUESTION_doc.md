---
title: buyer_question
description: "Notification when a buyer asks a question"
event_label: BUYER_QUESTION
delivery_channel: HTTPS webhook (POST)
notification_group: Communication
---
- Source URL: https://developer.ebay.com/develop/api/sell/notification_events


# buyer_question

## Overview

**Event Label:** BUYER_QUESTION  
**Delivery Channel:** HTTPS webhook (POST)  
**Summary:** Notification when a buyer asks a question

## Event Details

Use this event to receive a notification when a potential buyer/bidder asks a question on an active listing.

## Spec

**Spec Name:** buyer_question  
**Spec Type:** REST  
**Version:** 1.0.0

```yaml
asyncapi: 2.0.0
info:
  title: Buyer Question Notifications
  version: 1.0.0
  description: 'This contract defines the eBay notification for the BUYER_QUESTION topic. This notification is sent when a buyer asks a question about an active listing.'
channels:
  BUYER_QUESTION:
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
          description: 'This field references the buyer question data.'
          $ref: '#/components/schemas/BuyerQuestionData'

    BuyerQuestionData:
      type: object
      description: 'This type is the payload for the BUYER_QUESTION notification.'
      properties:
        messageId:
          type: string
          description: 'This string is the unique identifier of the message.'
          example: '5498562796019'
        conversationId:
          type: string
          description: 'This string is the unique identifier of the conversation.'
          example: '9394020427474'
        messageBody:
          type: string
          description: 'This string is the body text of the message.'
          example: 'Is there a size standard?'
        listingId:
          type: string
          description: 'This string is the unique identifier of the listing associated with the conversation.'
          example: '1234567'
        senderUserName:
          type: string
          description: 'This strings is the eBay username of the sender.'
        recipientUserName:
          type: string
          description: 'This string is the eBay username of the recipient.'
        subject:
          type: string
          description: 'This string is the subject of the message.'
        readStatus:
          type: boolean
          description: 'This Boolean indicates if the message has been read.'
          default: false
        createdDate:
          type: string
          description: 'This string is the date and time when the message was created, in ISO 8601 format.'
          example: '2025-04-21T08:16:20.000Z'
        messageMedia:
          type: array
          description: 'This array is a list of media attachments associated with a message.'
          items:
            type: object
            properties:
              mediaName:
                type: string
                description: 'This string is the name of the media attached to the message.'
              mediaUrl:
                type: string
                description: 'This string is the URL of the self-hosted media attached to the message.'
              mediaType:
                type: string
                description: 'This string indicates the type of media attached to the message. Supported values include: IMAGE, PDF, DOC, TXT. Additional values may be introduced in the future.'
                example: IMAGE
```
