---
title: feedback_star_rating
description: "Notification sent when feedback star rating changes"
event_label: FEEDBACK_STAR_RATING
delivery_channel: HTTPS webhook (POST)
notification_group: Account Management
---
- Source URL: https://developer.ebay.com/develop/api/sell/notification_events


# feedback_star_rating

## Overview

**Event Label:** FEEDBACK_STAR_RATING  
**Delivery Channel:** HTTPS webhook (POST)  
**Summary:** Notification sent when feedback star rating changes

## Event Details

This notification is sent to a seller or buyer when their feedback start rating has changed.

## Spec

**Spec Name:** feedback_star_rating  
**Spec Type:** REST  
**Version:** 1.0.0

```yaml
asyncapi: 2.0.0
info:
  title: eBay Feedback Star Rating Change Notifications
  version: 1.0.0
  description: 'This contract defines the payload for eBay feedback received notification. The service dispatches notifications to users when there is a change in their current feedback star rating.'
channels:
  FEEDBACK_STAR_RATING:
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
            description: ECC message signature.
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
          description: 'This field references the feedback star rating data.'
          $ref: '#/components/schemas/FeedbackStarRatingData'

    FeedbackStarRatingData:
      type: object
      description: "This rating indicates how many buyers and sellers have provided feedback for a user. A user receives a different star based on how many buyers and sellers have provided positive feedback about their experience with the user. Colored stars helps to identify users with higher feedback scores."
      properties:
        user:
            description: "This field references the user feedback data."
            $ref: '#/components/schemas/UserFeedbackData'

    UserFeedbackData:
      type: object
      description: "This type contains information about the user whose feedback rating has changed."
      properties:
        userId:
          type: string
          description: "This string is the unique, public identifier for the user whose feedback rating has changed."
        positiveFeedbackPercent:
          type: number
          description: "This number is the calculated user feedback percent based on negative and positive feedback count."
        feedbackStarRating:
          description: "This enumerated type defines the feedback star rating for the user whose feedback rating has changed. | - **SILVER_SHOOTING_STAR**: A silver shooting feedback star assigned to users with scores in the designated range. - **GREEN_SHOOTING_STAR**: A green shooting feedback star assigned to users with scores in the designated range. - **RED_SHOOTING_STAR**: A red shooting feedback star assigned to users with scores in the designated range. - **PURPLE_SHOOTING_STAR**: A purple shooting feedback star assigned to users with scores in the designated range. - **TURQUOISE_SHOOTING_STAR**: A turquoise shooting feedback star assigned to users with scores in the designated range. - **YELLOW_SHOOTING_STAR**: A yellow shooting feedback star assigned to users with scores in the designated range. -**GREEN_STAR**: A green feedback star assigned to users with scores in the designated range. - **RED_STAR**: A red feedback star assigned to users with scores in the designated range. - **PURPLE_STAR**: A purple feedback star assigned to users with scores in the designated range. - **TURQUOISE_STAR**: A turquoise feedback star assigned to users with scores in the designated range. - **BLUE_STAR**: A blue feedback star assigned to users with scores in the designated range. -  **YELLOW_STAR**: A yellow feedback star assigned to users with scores in the designated range. - **NONE**: There is not enough feedback information to assign a star rating."
          type: string
          enum:
            - SILVER_SHOOTING_STAR
            - GREEN_SHOOTING_STAR
            - RED_SHOOTING_STAR
            - PURPLE_SHOOTING_STAR
            - TURQUOISE_SHOOTING_STAR
            - YELLOW_SHOOTING_STAR
            - GREEN_STAR
            - RED_STAR
            - PURPLE_STAR
            - TURQUOISE_STAR
            - BLUE_STAR
            - YELLOW_STAR
            - NONE
```
