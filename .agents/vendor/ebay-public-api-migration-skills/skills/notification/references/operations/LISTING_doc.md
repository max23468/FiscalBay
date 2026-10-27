# LISTING

- Source URL: https://developer.ebay.com/develop/api/sell/notification_events

## Description

The modern `LISTING` topic is the Notification API topic for seller listing
lifecycle changes. A seller subscription receives webhook deliveries when a
listing is created, updated, or ended.

## Migration relevance

- `ItemListed` maps to `LISTING` with `notification.data.reason = CREATED`.
- `ItemRevised` maps to `LISTING` with `notification.data.reason = UPDATED`.
- `ItemClosed` maps to `LISTING` with `notification.data.reason = ENDED`.
- `ItemSold` should also use `LISTING` for the listing-end event itself, with
  `notification.data.reason = ENDED`; if the old integration also depended on
  buyer payment completion, pair that with `ORDER_CONFIRMATION` as a separate
  payment-state signal.

## Internal references

- Packaged event docs that rely on this topic doc:
  - [ItemClosed_doc.md](./ItemClosed_doc.md)
  - [ItemListed_doc.md](./ItemListed_doc.md)
  - [ItemRevised_doc.md](./ItemRevised_doc.md)
  - [ItemSold_doc.md](./ItemSold_doc.md)

## Async contract summary

- Event label: `LISTING`
- Delivery channel: HTTPS webhook `POST`
- Payload root: `notification.data`
- Key fields:
  - `listingId`
  - `reason` with enum values `CREATED`, `UPDATED`, `ENDED`
  - `user.userId`
  - `user.username`

## Spec

**Spec Name:** `LISTING`
**Spec Type:** `REST`
**Version:** `1.0.0`

```yaml
asyncapi: 2.0.0
info:
  title: eBay Listing Notifications
  version: 1.0.0
  description: This contract defines eBay notifications for all seller listing events

channels:
  LISTING:
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
      properties:
        topic:
          type: string
        schemaVersion:
          type: string
        deprecated:
          type: boolean

    Notification:
      type: object
      properties:
        notificationId:
          type: string
        eventDate:
          type: string
        publishDate:
          type: string
        publishAttemptCount:
          type: integer
        data:
          $ref: '#/components/schemas/SellerListingNotificationsData'

    SellerListingNotificationsData:
      type: object
      properties:
        listingId:
          type: string
        reason:
          type: string
          enum:
            - CREATED
            - UPDATED
            - ENDED
        user:
          $ref: '#/components/schemas/User'

    User:
      type: object
      properties:
        userId:
          type: string
        username:
          type: string
```
