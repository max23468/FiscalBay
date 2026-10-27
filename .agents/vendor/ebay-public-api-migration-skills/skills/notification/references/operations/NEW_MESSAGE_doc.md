---
title: new_message
description: "Notification when a user receives a new message."
event_label: NEW_MESSAGE
delivery_channel: HTTPS webhook (POST)
notification_group: Communication
---
- Source URL: https://developer.ebay.com/develop/api/sell/notification_events


# new_message

## Overview

**Event Label:** NEW_MESSAGE  
**Delivery Channel:** HTTPS webhook (POST)  
**Summary:** Notification when a user receives a new message.

## Event Details

Sellers or buyers subscribed to this topic will get a notification each time another member or eBay sends them a new message that starts or continues a conversation.

## Spec

**Spec Name:** new_message  
**Spec Type:** REST  
**Version:** 1.0.0

```yaml
asyncapi: 2.0.0
info:
  title: New Message Notifications
  version: 1.0.0
  description: 'This contract defines the eBay notification for the NEW_MESSAGE topic. This notification is sent when a user receives a new message from another eBay user or when a user receives a new message from eBay.'
channels:
  NEW_MESSAGE:
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
          description: 'This field references the new message data.'
          $ref: '#/components/schemas/NewMessageData'

    NewMessageData:
      type: object
      description: 'This type is the payload for the NEW_MESSAGE notification.'
      properties:
        messageId:
          type: string
          description: 'This string is the unique identifier of the message.'
          example: '5498562796019'
        conversationType:
          type: string
          description: 'This enumeration type defines the sender of the message | - **FROM_MEMBERS**: The message is being sent by an eBay member. - **FROM_EBAY**: The message is being sent from eBay.'
          enum:
            - FROM_MEMBERS
            - FROM_EBAY
          example: 'FROM_MEMBERS'
        conversationId:
          type: string
          description: 'This string is the unique identifier of the conversation.'
          example: '9394020427474'
        messageBody:
          type: string
          description: 'This string is the body text of the message.'
          example: 'Is there a size standard?'
        senderUserName:
          type: string
          description: 'This string represents the eBay username of the sender.'
        recipientUserName:
          type: string
          description: 'This string represents the eBay username of the recipient.'
        subject:
          type: string
          description: 'This string is the subject of the message.'
        readStatus:
          type: boolean
          description: 'Thos Boolean Indicates if the message has been read.'
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
            description: 'This object contains information about the media attached to the message.'
            properties:
              mediaName:
                type: string
                description: 'This string is the name of the media attached to the message.'
              mediaUrl:
                type: string
                description: 'This string is the URL of the self-hosted media attached to the message.'
              mediaType:
                type: string
                description: 'This string is the type of media attached to the message. Supported values include: IMAGE, PDF, DOC, TXT. Additional values may be introduced in the future.'
                example: IMAGE
```
