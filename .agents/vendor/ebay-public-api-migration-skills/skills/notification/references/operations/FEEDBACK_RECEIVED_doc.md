---
title: feedback_received
description: "Notification sent to when feedback has been received"
event_label: FEEDBACK_RECEIVED
delivery_channel: HTTPS webhook (POST)
notification_group: Communication
---
- Source URL: https://developer.ebay.com/develop/api/sell/notification_events


# feedback_received

## Overview

**Event Label:** FEEDBACK_RECEIVED  
**Delivery Channel:** HTTPS webhook (POST)  
**Summary:** Notification sent to when feedback has been received

## Event Details

This notification is sent to a seller or buyer when their order partner has left them feedback for a line item.

## Spec

**Spec Name:** feedback_received  
**Spec Type:** REST  
**Version:** 1.0.0

```yaml
asyncapi: 2.0.0
info:
  title: eBay Feedback Received Notifications
  version: 1.0.0
  description: 'This contract defines the payload for eBay feedback received notification. The service dispatches notifications to users when they receive feedback from another user.'
channels:
  FEEDBACK_RECEIVED:
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
          description: 'This field references the feedback data.'
          $ref: '#/components/schemas/FeedbackData'

    FeedbackData:
      type: object
      description: "This type is the payload for the Feedback Received notification."
      properties:
        receiverUserDetail:
          type: object
          description: "This object contains the information about the user who received the feedback."
          properties:
              userId:
                type: string
                description: "This string is the unique, public identifier for the user who received the feedback."
              role:
                type: string
                description: "This enumerated type defines the role of the user who provided the feedback.| - **BUYER**: This value indicates feedback related to the user's role as a buyer. - **SELLER**: This value indicates feedback related to the user's role as a seller."
                enum:
                  - BUYER
                  - SELLER
        
        feedbackDetail:
            type: object
            description: "This object contains the details of the feedback received by the user."
            properties:
              feedbackId:
                type: string
                description: "This string is the unique feedback id of the feedback received by the user."
              orderLineItemSummary:
                type: object
                description: "This object contains the summary of the listing transaction."
                properties:
                  orderLineItemId:
                    type: string
                    description: "This string is the concatenation of the listingId and transactionId of an order, represented as `listingId-transactionId`."
                  listingId:
                    type: string
                    description: "This string is the unique id of the listing for which feedback has been received."
                  listingTitle:
                    type: string
                    description: "This string is the title of the listing for which feedback has been received."
                  listingPrice:
                      type: object
                      description: "This object contains the price information of the item for which feedback has been received."
                      properties:
                        currency:
                          type: string
                          description: "This string is the currency of the item."
                        value:
                          type: number
                          description: "This number is the value of the item."
        commentType:
            description: "This enumerated type defines the type of feedback being received. | - **POSITIVE**: This value indicates that the feedback expresses satisfaction with the transaction or experience. This typically reflects a successful and favorable interaction between the buyer and seller. - **NEUTRAL**: This value indicates that the feedback is neither distinctly favorable nor unfavorable. The transaction was completed, but did not fully meet expectations, or was considered average. - **NEGATIVE**:This value indicates dissatisfaction with the transaction or experience. This type of feedback highlights issues or problems that occurred, signaling that the buyer or seller was not satisfied."
            type: string
            enum:
              - POSITIVE
              - NEUTRAL
              - NEGATIVE
        feedbackComment:
            type: object
            description: "This object contains the feedback comment received by the user."
            properties:
              commentText:
                type: string
                description: "This string is the text of the feedback comment."
              state:
                type: string
                description: "This enumerated type defines the possible states of feedback entries returned. This can be different from the feedbackState field. | - **ENTERED**: This value indicates that the feedback has been submitted and is currently active. The feedback is visible to applicable parties. - **WITHDRAWN**: This value indicates that the feedback has been officially withdrawn and no longer has an effect on reputation calculations. - **HIDDEN**: This value indicates that the feedback has been hidden due to policy and is not visible to standard views. See <a href=\"https://www.ebay.com/help/policies/feedback-policies/feedback-policy?id=4208\" target=\"_blank\">Feedback policy</a> for more information. - **REVISED**: This value indicates that the feedback was edited after initial submission. The revised version is not active. - **REVISION_OPEN**: This value indicates that a request to revise the feedback is in progress but not yet completed. - **REVISION_DECLINED_OR_EXPIRED**: This value indicates that the feedback revision request was declined or has expired."
                enum:
                  - ENTERED
                  - WITHDRAWN
                  - HIDDEN
                  - REVISED
                  - REVISION_OPEN
                  - REVISION_DECLINED_OR_EXPIRED
        replyComment:
            type: object
            description: "This object contains the feedback reply comment."
            properties:
              commentText:
                type: string
                description: "This string is the text of the reply comment."
              state:
                type: string
                description: "This enumerated type defines the possible states of feedback entries returned. | - **ENTERED**: This value indicates that the feedback has been submitted and is currently active. The feedback is visible to applicable parties. - **WITHDRAWN**: This value indicates that the feedback has been officially withdrawn and no longer has an effect on reputation calculations. - **HIDDEN**: This value indicates that the feedback has been hidden due to policy and is not visible to standard views. See <a href=\"https://www.ebay.com/help/policies/feedback-policies/feedback-policy?id=4208\" target=\"_blank\">Feedback policy</a> for more information. - **REVISED**: This value indicates that the feedback was edited after initial submission. The revised version is not active. - **REVISION_OPEN**: This value indicates that a request to revise the feedback is in progress but not yet completed. - **REVISION_DECLINED_OR_EXPIRED**: This value indicates that the feedback revision request was declined or has expired."
                enum:
                  - ENTERED
                  - WITHDRAWN
                  - HIDDEN
                  - REVISED
                  - REVISION_OPEN
                  - REVISION_DECLINED_OR_EXPIRED
        followupComment:
            type: object
            description: "This object contains the feedback follow up comment."
            properties:
              commentText:
                type: string
                description: "This string is the text of the follow up comment."
              state:
                type: string
                description: "This enumerated type defines the possible states of feedback entries returned. | - **ENTERED**: This value indicates that the feedback has been submitted and is currently active. The feedback is visible to applicable parties. - **WITHDRAWN**: This value indicates that the feedback has been officially withdrawn and no longer has an effect on reputation calculations. - **HIDDEN**: This value indicates that the feedback has been hidden due to policy and is not visible to standard views. See <a href=\"https://www.ebay.com/help/policies/feedback-policies/feedback-policy?id=4208\" target=\"_blank\">Feedback policy</a> for more information. - **REVISED**: This value indicates that the feedback was edited after initial submission. The revised version is not active. - **REVISION_OPEN**: This value indicates that a request to revise the feedback is in progress but not yet completed. - **REVISION_DECLINED_OR_EXPIRED**: This value indicates that the feedback revision request was declined or has expired."
                enum:
                  - ENTERED
                  - WITHDRAWN
                  - HIDDEN
                  - REVISED
                  - REVISION_OPEN
                  - REVISION_DECLINED_OR_EXPIRED
        providerUserDetail:
            type: object
            description: "This object contains information about the user who provided the feedback."
            properties:
              userId:
                type: string
                description: "This string is the unique, public identifier of the user who provided the feedback."
              role:
                type: string
                description: "This enumerated type defines the role of the user who provided the feedback.| - **BUYER**: This value indicates feedback related to the user's role as a buyer. - **SELLER**: This value indicates feedback related to the user's role as a seller."
                enum:
                  - BUYER
                  - SELLER
              feedbackScore:
                type: integer
                description: "This integer is the numeric feedback score of the feedback provider."
        feedbackState:
            type: string
            description: "This enumerated type defines the state of the entire feedback as a whole.| - **ENTERED**: This value indicates that the feedback has been submitted and is currently active. The feedback is visible to applicable parties. - **DESCORED**: This value indicates that the feedback has a score impact of 0 and does not contribute to the overall feedback score. - **MUTUAL_WITHDRAWAL_INITIATED**: This value indicates that the buyer or seller has started a mutual feedback withdrawal process and agreement from the other party is pending. - **FEEDBACK_REVISION_OPEN**: This value indicates that a feedback revision request has been sent and is currently open and awaiting a response. - **FEEDBACK_REVISION_CLOSED**: This value indicates that the feedback revision request has been closed either because the request was revised, declined, or it expired."
            enum:
                - ENTERED
                - DESCORED
                - MUTUAL_WITHDRAWAL_INITIATED
                - FEEDBACK_REVISION_OPEN
                - FEEDBACK_REVISION_CLOSED
        feedbackEnteredDate:
            type: string
            description: "This string is the date when the feedback was entered. This date is returned as a UTC-formatted timestamp."

```
