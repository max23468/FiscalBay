# Notification Operation Index

Validated inventory derived from bundled notification evidence and guide set.

## Notification API Operations

These rows are legacy API-operation mappings. For modern-side evidence, prefer
operation-specific modern method docs under `references/operations/` and use
modern `_example.md` files only as illustrative payload support.

| Legacy API call | Status | Modern replacement | Notes |
| --- | --- | --- | --- |
| `GetNotificationPreferences` | Mapped | `getSubscriptions` | Modern subscriptions return topics instead of legacy event types. |
| `SetNotificationPreferences` | Mapped | `createDestination`, `updateDestination` | Use destination methods for delivery endpoint registration and updates. |
| `SetNotificationPreferences` | Mapped | `updateConfig`, `getConfig` | Use config methods for alert email management. |
| `SetNotificationPreferences` | Mapped | `createSubscription`, `updateSubscription`, `deleteSubscription`, `disableSubscription`, `enableSubscription` | Use subscription methods for topic enablement and subscription lifecycle. |
| `GetNotificationsUsage` | To be decommissioned | None | Preserve decommission wording exactly. |

## Concrete Event To Topic Mappings

These rows are legacy platform-event mappings. For modern-side evidence, prefer
topic docs under `references/operations/` for the mapped topic and use topic
activity or reason values to distinguish grouped modern replacements.

| Platform notification event | Modern replacement | Notes |
| --- | --- | --- |
| FeedbackLeft | FEEDBACK_LEFT |  |
| FeedbackReceived | FEEDBACK_RECEIVED |  |
| FeedbackStarChanged | FEEDBACK_STAR_RATING |  |
| TokenRevocation | authorization_revocation | Bundled migration mapping lists this replacement, but the bundled migration guide still lists it as pending. Requires confirmation if the distinction matters. |
| ItemClosed | LISTING | One topic with creation, revision, and end notifications. Filters can be used for subscription. |
| ItemSold | LISTING | Use `LISTING` for the listing-state event with `reason = ENDED`. If payment-cleared confirmation is also needed, pair it separately with `ORDER_CONFIRMATION`. |
| ItemRevised | LISTING | This new notification topic covers multiple events related to listing states. When a listing ends, the seller will receive this notification and the `reason` field will have a value of `UPDATED`. |
| ItemListed | LISTING | This new notification topic covers multiple events related to listing states. When a listing ends, the seller will receive this notification and the `reason` field will have a value of `CREATED`. |
| FixedPriceTransaction | ORDER_CONFIRMATION | Fixed-price and auction checkout completion are merged into one modern payment-cleared notification. |
| AuctionCheckoutComplete | AUCTION_ENDED |  |
| CheckoutBuyerRequestsTotal | BUYER_REQUESTED_PURCHASE_QUOTE | Seller receives a quote-request notification before buyer payment. |
| AskSellerQuestion | BUYER_QUESTION | Seller receives a buyer question on an active listing. |
| MyMessageseBayMessage | NEW_MESSAGE | Legacy message-summary and header detail collapse into one modern message detail path. |
| MyMessagesM2MMessage | NEW_MESSAGE | Modern topic covers each new member-to-member conversation message. |
| M2MMessageStatusChange | NEW_MESSAGE | Use the modern message topic as the nearest bundled replacement. |
| ItemMarkedShipped | ITEM_MARKED_SHIPPED |  |
| BestOffer | OFFER_ACTIVITY | Seller-side modern payload uses `BUYER_OFFER` with `PENDING`. |
| BestOfferPlaced | OFFER_ACTIVITY | Buyer-side offer activity; modern payload differentiates by activity fields. |
| BestOfferDeclined | OFFER_ACTIVITY | Buyer-side offer decline is represented by modern offer activity status. |
| CounterOfferReceived | OFFER_ACTIVITY | Buyer and seller views split by `OfferType` value in one consolidated topic. |
| BidPlaced | AUCTION_ACTIVITY | Modern payload uses `BID_PLACED` activity. |
| BidReceived | AUCTION_ACTIVITY | Modern payload uses seller-visible bid activity in one consolidated topic. |
| ItemWon | AUCTION_ACTIVITY | Modern payload uses `AUCTION_WON` activity. |
| OutBid | AUCTION_ACTIVITY | Modern payload uses `OUTBID` activity. |
| EndOfAuction | AUCTION_ENDED |  |

## Notification Event/Topic - Migration plan yet to be decided

| Platform notification event |
| --- |
| MyMessagesHighPriorityMessageHeader |
| BuyerCancelRequested |
| EBPMyPaymentDue |
| EBPPaymentDone |
| INRBuyerRespondedToDispute |
| ItemExtended |
| ItemOutOfStock |
| ItemSuspended |
| ItemUnsold |
| OrderInquiryReminderForEscalation |
| ReturnRefundOverdue |
| ReturnSellerInfoOverdue |
| ReturnWaitingForSellerInfo |
| ReturnClosed |
| ReturnCreated |
| ReturnDelivered |
| ReturnEscalated |
| ReturnShipped |
| EBPAppealedCase |
| EBPClosedAppeal |
| EBPClosedCase |
| EBPEscalatedCase |
| EBPMyResponseDue |
| EBPOnHoldCase |
| EBPOtherPartyResponseDue |
| ItemMarkedPaid |
| ItemLost |
| PaymentReminder |

## Notification Event/Topic - Not Supported

| Platform notification event | Status | Notes |
| --- | --- | --- |
| Feedback | No Replacement | This event will not be migrated due to either low usage or due to no longer being applicable; use `FeedbackReceived` or `FeedbackLeft` instead. |
| MyMessagesHighPriorityMessage | No Replacement | This event will not be migrated due to either low usage or due to no longer being applicable. |
| SecondChanceOffer | No Replacement | This event will not be migrated due to either low usage or due to no longer being applicable. |
| MyMessageseBayMessageHeader | No Replacement | This event will not be migrated due to either low usage or due to no longer being applicable. |
| MyMessagesM2MMessageHeader | No Replacement | This event will not be migrated due to either low usage or due to no longer being applicable. |
| BidItemEndingSoon | No Replacement | This event will not be migrated due to either low usage or due to no longer being applicable. |
| ItemRevisedAddCharity | No Replacement | This event will not be migrated due to either low usage or due to no longer being applicable. |
| WatchedItemEndingSoon | No Replacement | This event will not be migrated due to either low usage or due to no longer being applicable. |
| ItemReadyForPickup | No Replacement | This event will not be migrated due to either low usage or due to no longer being applicable. |
| ShoppingCartItemEndingSoon | No Replacement | This event will not be migrated due to either low usage or due to no longer being applicable. |