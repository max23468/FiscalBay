---
title: authorization_revocation
description: "Sent to developers when a user revokes Developers Program permissions."
event_label: AUTHORIZATION_REVOCATION
delivery_channel: HTTPS webhook (POST)
notification_group: Account Management
---
- Source URL: https://developer.ebay.com/develop/api/sell/notification_events


# authorization_revocation

## Overview

**Event Label:** AUTHORIZATION_REVOCATION  
**Delivery Channel:** HTTPS webhook (POST)  
**Summary:** Sent to developers when a user revokes Developers Program permissions.

## Event Details

A subscription for this topic initiates notifications being sent to a developer when an eBay user revokes permissions for their eBay Developers Program application.

## Spec

**Spec Name:** authorization_revocation  
**Spec Type:** REST  
**Version:** 1.0.0

```yaml
asyncapi: 2.0.0
info:
  title: eBay Notifications
  version: 1.0.0
  description: This contract defines eBay notification for AUTHORIZATION_REVOCATION
channels:
  AUTHORIZATION_REVOCATION:
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
          description: 'This field references the authorization revocation data.'
          $ref: '#/components/schemas/AuthorizationRevocationData'


    AuthorizationRevocationData:
      type: object
      description: 'This type defines the Authorization Revocation payload.'
      properties:
        username:
          type: string
          description: 'This string contains the username for the user. Effective September 26, 2025, select developers will no longer receive username data for U.S. users through this field. Instead, an immutable user ID will be returned in its place.'
        userId:
          type: string
          description: 'This tring is the immutable public userId for the user.'
        eiasToken:
          type: string
          description: 'This string is the legacy eiasToken specific to the user.'
        revokeReason:
          type: string
          description: 'This enum includes the reasons an authorization revocation has occurred. | - **REVOKED_BY_APP**: This value represents that the authorization was revoked by the app. - **REVOKED_BY_USER**: This value represents that the authorization was revoked by the user. - **REVOKED_BY_EBAY**: This value represents that the authorization was revoked by eBay. - **PASSWORD_CHANGE**: This value represents that the authorization was revoked because the password changed.'
          enum:
            - REVOKED_BY_APP
            - REVOKED_BY_USER
            - REVOKED_BY_EBAY
            - PASSWORD_CHANGE
        revocationDate:
          type: string
          description: 'This is the date and time when the authorization was revoked.'
```
