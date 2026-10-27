# Notification Operation Mapping

This reference covers the bundled Notification API operations and the concrete
legacy platform notification events that have usable local evidence in this
runtime package, plus explicit `No Replacement` rows that still need to remain
visible to users.

## Notification API Operations

### GetNotificationPreferences -> getSubscriptions

Purpose:
- Review which legacy notification preferences are currently enabled.

Modern Target:
- `getSubscriptions`

Key Differences:
- Modern responses return topic subscriptions instead of legacy event types.
- Modern delivery setup is managed separately from subscription retrieval.

Legacy Doc:
- [GetNotificationPreferences_doc.md](./operations/GetNotificationPreferences_doc.md)

Legacy Example:
- [GetNotificationPreferences_example.md](./operations/GetNotificationPreferences_example.md)

Modern Doc:
- [getSubscriptions_doc.md](./operations/getSubscriptions_doc.md)

Modern Example:
- [getSubscriptions_example.md](./operations/getSubscriptions_example.md)

Migration Guide:
- `getSubscriptions` replaces `GetNotificationPreferences`.
- If eBay does not receive the required response when it sends a notification
  (HTTP status `200 OK`), eBay assumes the notification delivery failed.

### SetNotificationPreferences -> createDestination, updateDestination, updateConfig, getConfig, createSubscription, updateSubscription, deleteSubscription, disableSubscription, enableSubscription

Purpose:
- Configure delivery URLs, alert email, and event or topic subscriptions.

Modern Target:
- Destination resource methods
- Config resource methods
- Subscription resource methods

Key Differences:
- One legacy call splits into three resource families in the Notification API.
- Destination registration, alert-email management, and topic subscription
  lifecycle are no longer one combined payload.

Legacy Doc:
- [SetNotificationPreferences_doc.md](./operations/SetNotificationPreferences_doc.md)

Legacy Example:
- [SetNotificationPreferences_example.md](./operations/SetNotificationPreferences_example.md)

Modern Doc:
- [createDestination_doc.md](./operations/createDestination_doc.md)
- [updateDestination_doc.md](./operations/updateDestination_doc.md)
- [getConfig_doc.md](./operations/getConfig_doc.md)
- [updateConfig_doc.md](./operations/updateConfig_doc.md)
- [createSubscription_doc.md](./operations/createSubscription_doc.md)
- [updateSubscription_doc.md](./operations/updateSubscription_doc.md)
- [deleteSubscription_doc.md](./operations/deleteSubscription_doc.md)
- [disableSubscription_doc.md](./operations/disableSubscription_doc.md)
- [enableSubscription_doc.md](./operations/enableSubscription_doc.md)

Modern Example:
- [createDestination_example.md](./operations/createDestination_example.md)
- [updateDestination_example.md](./operations/updateDestination_example.md)
- [getConfig_example.md](./operations/getConfig_example.md)
- [updateConfig_example.md](./operations/updateConfig_example.md)
- [createSubscription_example.md](./operations/createSubscription_example.md)
- [updateSubscription_example.md](./operations/updateSubscription_example.md)
- [deleteSubscription_example.md](./operations/deleteSubscription_example.md)
- [disableSubscription_example.md](./operations/disableSubscription_example.md)
- [enableSubscription_example.md](./operations/enableSubscription_example.md)

Migration Guide:
- `createDestination` and `updateDestination` replace the legacy destination
  configuration portion of `SetNotificationPreferences`.
- `updateConfig` adds or modifies the alert email used for notifications, and
  `getConfig` returns the current alert email configuration.
- `createSubscription`, `updateSubscription`, `deleteSubscription`,
  `disableSubscription`, and `enableSubscription` replace the legacy event-
  subscription portion of `SetNotificationPreferences`.
- If eBay does not receive the required response when it sends a notification
  (HTTP status `200 OK`), eBay assumes the notification delivery failed.

### GetNotificationsUsage -> None; to be decommissioned

Purpose:
- Inspect legacy notification usage for an application.

Modern Target:
- None

Key Differences:
- This call has no replacement and is being decommissioned.

Legacy Doc:
- [GetNotificationsUsage_doc.md](./operations/GetNotificationsUsage_doc.md)

Legacy Example:
- [GetNotificationsUsage_example.md](./operations/GetNotificationsUsage_example.md)

Migration Guide:
- `None; to be decommissioned`.

## Platform Event Mappings

### FeedbackLeft -> FEEDBACK_LEFT

Purpose:
- Notify when feedback left for an order partner has been recorded.

Modern Target:
- `FEEDBACK_LEFT`

Key Differences:
- Subscription moves from legacy event enablement to Notification API topic
  subscriptions.

Legacy Doc:
- [FeedbackLeft_doc.md](./operations/FeedbackLeft_doc.md)

Legacy Example:
- [FeedbackLeft_example.md](./operations/FeedbackLeft_example.md)

Modern Doc:
- [FEEDBACK_LEFT_doc.md](./operations/FEEDBACK_LEFT_doc.md)

Migration Guide:
- This notification is sent to a seller or buyer when the feedback they have
  left for their order partner for a line item has been recorded.

### FeedbackReceived -> FEEDBACK_RECEIVED

Purpose:
- Notify when an order partner leaves feedback.

Modern Target:
- `FEEDBACK_RECEIVED`

Key Differences:
- Delivery still requires topic subscription and HTTP `200 OK`
  acknowledgement.

Legacy Doc:
- [FeedbackReceived_doc.md](./operations/FeedbackReceived_doc.md)

Legacy Example:
- [FeedbackReceived_example.md](./operations/FeedbackReceived_example.md)

Modern Doc:
- [FEEDBACK_RECEIVED_doc.md](./operations/FEEDBACK_RECEIVED_doc.md)

Migration Guide:
- This notification is sent to a seller or buyer when their order partner has
  left them feedback for a line item.

### FeedbackStarChanged -> FEEDBACK_STAR_RATING

Purpose:
- Notify when feedback star rating changes.

Modern Target:
- `FEEDBACK_STAR_RATING`

Key Differences:
- The modern topic is rating-oriented instead of exposing the legacy star-
  change event name.

Legacy Doc:
- [FeedbackStarChanged_doc.md](./operations/FeedbackStarChanged_doc.md)

Legacy Example:
- [FeedbackStarChanged_example.md](./operations/FeedbackStarChanged_example.md)

Modern Doc:
- [FEEDBACK_STAR_RATING_doc.md](./operations/FEEDBACK_STAR_RATING_doc.md)

Migration Guide:
- This notification is sent to a seller or buyer when their feedback star
  rating has changed.

### TokenRevocation -> authorization_revocation

Purpose:
- Notify when authorization is revoked.

Modern Target:
- `authorization_revocation`

Key Differences:
- The bundled migration mapping lists this event as authorization_revocation,
  but the bundled guide still lists it as pending.

Legacy Doc:
- [TokenRevocation_doc.md](./operations/TokenRevocation_doc.md)

Legacy Example:
- [TokenRevocation_example.md](./operations/TokenRevocation_example.md)

Modern Doc:
- [AUTHORIZATION_REVOCATION_doc.md](./operations/AUTHORIZATION_REVOCATION_doc.md)

Migration Guide:
- The bundled migration mapping lists this event as `authorization_revocation`.
- The bundled migration guide still lists this event as pending. Treat
  `authorization revocation` as the current replacement name; requires
  confirmation if precision matters.

### ItemClosed -> LISTING

Purpose:
- Notify when a listing ends.

Modern Target:
- `LISTING`

Key Differences:
- This is a grouped listing-state topic rather than a one-event-one-topic
  mapping.
- Use listing `reason = ENDED` to identify the legacy end-of-listing case.

Legacy Doc:
- [ItemClosed_doc.md](./operations/ItemClosed_doc.md)

Legacy Example:
- [ItemClosed_example.md](./operations/ItemClosed_example.md)

Modern Doc:
- [LISTING_doc.md](./operations/LISTING_doc.md)

Migration Guide:
- This new notification topic covers multiple events related to listing
  states.
- When a listing ends, the seller will receive this notification and the
  `reason` field will have a value of `ENDED`.

### ItemListed -> LISTING

Purpose:
- Notify when a listing is created.

Modern Target:
- `LISTING`

Key Differences:
- The bundled migration mapping does not name a replacement, but the bundled
  guide maps this to the grouped `LISTING` topic.
- Use listing `reason = CREATED` to identify the legacy listing-created case.

Legacy Doc:
- [ItemListed_doc.md](./operations/ItemListed_doc.md)

Legacy Example:
- [ItemListed_example.md](./operations/ItemListed_example.md)

Modern Doc:
- [LISTING_doc.md](./operations/LISTING_doc.md)

Migration Guide:
- This new notification topic covers multiple events related to listing
  states.
- When a listing ends, the seller will receive this notification and the
  `reason` field will have a value of `CREATED`.

### ItemRevised -> LISTING

Purpose:
- Notify when a listing is updated.

Modern Target:
- `LISTING`

Key Differences:
- The bundled migration mapping does not name a replacement, but the bundled
  guide maps this to the grouped `LISTING` topic.
- Use listing `reason = UPDATED` to identify the legacy listing-revised case.

Legacy Doc:
- [ItemRevised_doc.md](./operations/ItemRevised_doc.md)

Legacy Example:
- [ItemRevised_example.md](./operations/ItemRevised_example.md)

Modern Doc:
- [LISTING_doc.md](./operations/LISTING_doc.md)

Migration Guide:
- This new notification topic covers multiple events related to listing
  states.
- When a listing ends, the seller will receive this notification and the
  `reason` field will have a value of `UPDATED`.

### ItemSold -> LISTING

Purpose:
- Detect that a seller's listing has completed with a sale.

Modern Target:
- `LISTING`

Key Differences:
- Use the grouped `LISTING` topic for the listing-state event itself.
- Distinguish this legacy case with `notification.data.reason = ENDED`.
- If the old integration also relied on payment-cleared confirmation, that is a
  separate downstream signal and can be paired with `ORDER_CONFIRMATION`.

Legacy Doc:
- [ItemSold_doc.md](./operations/ItemSold_doc.md)

Legacy Example:
- [ItemSold_example.md](./operations/ItemSold_example.md)

Modern Doc:
- [LISTING_doc.md](./operations/LISTING_doc.md)

Migration Guide:
- Use `LISTING` as the direct migration topic for the listing event and inspect
  `reason = ENDED`.
- If payment-cleared confirmation is still needed, add `ORDER_CONFIRMATION` as a
  separate follow-on signal rather than treating it as the primary replacement.

### FixedPriceTransaction -> ORDER_CONFIRMATION

Purpose:
- Notify when checkout completes and payment clears for a fixed-price or
  auction listing.

Modern Target:
- `ORDER_CONFIRMATION`

Key Differences:
- Fixed-price and auction checkout completion are merged into one modern topic.

Legacy Doc:
- [FixedPriceTransaction_doc.md](./operations/FixedPriceTransaction_doc.md)

Legacy Example:
- [FixedPriceTransaction_example.md](./operations/FixedPriceTransaction_example.md)

Modern Doc:
- [ORDER_CONFIRMATION_doc.md](./operations/ORDER_CONFIRMATION_doc.md)

Migration Guide:
- This notification is sent to a seller when the buyer completes the checkout
  process and payment clears for a fixed price or auction listing.

### AuctionCheckoutComplete -> AUCTION_ENDED

Purpose:
- Notify when an auction listing ends.

Modern Target:
- `AUCTION_ENDED`

Key Differences:
- Modern topic covers the end-of-auction lifecycle instead of the legacy event
  name.

Legacy Doc:
- [AuctionCheckoutComplete_doc.md](./operations/AuctionCheckoutComplete_doc.md)

Legacy Example:
- [AuctionCheckoutComplete_example.md](./operations/AuctionCheckoutComplete_example.md)

Modern Doc:
- [AUCTION_ENDED_doc.md](./operations/AUCTION_ENDED_doc.md)

Migration Guide:
- This notification is sent to the seller and bidders as soon as an auction
  listing ends, with or without a winning bidder.

### CheckoutBuyerRequestsTotal -> BUYER_REQUESTED_PURCHASE_QUOTE

Purpose:
- Notify a seller when a buyer requests the total before paying.

Modern Target:
- `BUYER_REQUESTED_PURCHASE_QUOTE`

Key Differences:
- Modern topic is quote-request oriented rather than checkout-step named.

Legacy Doc:
- [CheckoutBuyerRequestsTotal_doc.md](./operations/CheckoutBuyerRequestsTotal_doc.md)

Legacy Example:
- [CheckoutBuyerRequestsTotal_example.md](./operations/CheckoutBuyerRequestsTotal_example.md)

Modern Doc:
- [BUYER_REQUESTED_PURCHASE_QUOTE_doc.md](./operations/BUYER_REQUESTED_PURCHASE_QUOTE_doc.md)

Migration Guide:
- This notification is sent to a seller when a buyer requests the total price
  of one or more item commitments before paying.

### AskSellerQuestion -> BUYER_QUESTION

Purpose:
- Notify a seller when a buyer or bidder asks a question on an active listing.

Modern Target:
- `BUYER_QUESTION`

Key Differences:
- Modern topic uses question-centric naming instead of the legacy Ask Seller
  event name.

Legacy Doc:
- [AskSellerQuestion_doc.md](./operations/AskSellerQuestion_doc.md)

Legacy Example:
- [AskSellerQuestion_example.md](./operations/AskSellerQuestion_example.md)

Modern Doc:
- [BUYER_QUESTION_doc.md](./operations/BUYER_QUESTION_doc.md)

Migration Guide:
- Seller receives this notification when a potential buyer or bidder asks
  question on an active listing.

### MyMessageseBayMessage -> NEW_MESSAGE

Purpose:
- Notify when eBay sends a new message that starts or continues a conversation.

Modern Target:
- `NEW_MESSAGE`

Key Differences:
- Legacy header and summary variants collapse into one message topic.
- `FROM_EBAY` payloads may omit `messageBody`.

Legacy Doc:
- [MyMessageseBayMessage_doc.md](./operations/MyMessageseBayMessage_doc.md)

Legacy Example:
- [MyMessageseBayMessage_example.md](./operations/MyMessageseBayMessage_example.md)

Modern Doc:
- [NEW_MESSAGE_doc.md](./operations/NEW_MESSAGE_doc.md)

Migration Guide:
- Sellers or buyers subscribed to this topic will get a notification each time
  another member or eBay sends them a new message that starts or continues a
  conversation.

### MyMessagesM2MMessage -> NEW_MESSAGE

Purpose:
- Notify when another member sends a new conversation message.

Modern Target:
- `NEW_MESSAGE`

Key Differences:
- Modern topic is conversation-based and covers both new and continued member
  messaging.

Legacy Doc:
- [MyMessagesM2MMessage_doc.md](./operations/MyMessagesM2MMessage_doc.md)

Legacy Example:
- [MyMessagesM2MMessage_example.md](./operations/MyMessagesM2MMessage_example.md)

Modern Doc:
- [NEW_MESSAGE_doc.md](./operations/NEW_MESSAGE_doc.md)

Migration Guide:
- Sellers or buyers subscribed to this topic will get a notification each time
  another member or eBay sends them a new message that starts or continues a
  conversation.

### M2MMessageStatusChange -> NEW_MESSAGE

Purpose:
- Handle legacy message status changes in the nearest modern message-notify
  flow.

Modern Target:
- `NEW_MESSAGE`

Key Differences:
- The guide does not describe a one-to-one status-change topic; it uses the
  new-message topic as the fallback replacement.

Legacy Doc:
- [M2MMessageStatusChange_doc.md](./operations/M2MMessageStatusChange_doc.md)

Legacy Example:
- [M2MMessageStatusChange_example.md](./operations/M2MMessageStatusChange_example.md)

Modern Doc:
- [NEW_MESSAGE_doc.md](./operations/NEW_MESSAGE_doc.md)

Migration Guide:
- No direct migration for this one, but buyers and sellers will each get a
  notification for each new message that starts or continues a conversation
  between members.
- The `NEW_MESSAGE` topic should be subscribed to.

### ItemMarkedShipped -> ITEM_MARKED_SHIPPED

Purpose:
- Notify buyer and seller when an order is marked as shipped.

Modern Target:
- `ITEM_MARKED_SHIPPED`

Key Differences:
- The bundled legacy topic page is not present locally; this mapping is
  supported by the bundled migration evidence.

Legacy Doc:
- [ItemMarkedShipped_doc.md](./operations/ItemMarkedShipped_doc.md)

Legacy Example:
- [ItemMarkedShipped_example.md](./operations/ItemMarkedShipped_example.md)

Modern Doc:
- [ITEM_MARKED_SHIPPED_doc.md](./operations/ITEM_MARKED_SHIPPED_doc.md)

Migration Guide:
- This notification is shipped to the seller and buyer involved in an order
  when the seller has marked the order as being shipped.

### BestOffer -> OFFER_ACTIVITY

Purpose:
- Notify a seller when a buyer proposes a best offer.

Modern Target:
- `OFFER_ACTIVITY`

Key Differences:
- Modern topic consolidates multiple offer events.
- Seller-side legacy `BestOffer` maps to `BUYER_OFFER` with status `PENDING`.

Legacy Doc:
- [BestOffer_doc.md](./operations/BestOffer_doc.md)

Legacy Example:
- [BestOffer_example.md](./operations/BestOffer_example.md)

Modern Doc:
- [OFFER_ACTIVITY_doc.md](./operations/OFFER_ACTIVITY_doc.md)

Migration Guide:
- The BestOffer notification is sent to the seller when a Best Offer is
  proposed by the buyer.
- The seller will see `BUYER_OFFER` as the `OfferType` value and `PENDING` as
  the `OfferStatus` value.

### BestOfferPlaced -> OFFER_ACTIVITY

Purpose:
- Notify a buyer when a best offer is submitted.

Modern Target:
- `OFFER_ACTIVITY`

Key Differences:
- Modern topic is consolidated, so the payload must distinguish buyer-side
  offer activity.

Legacy Doc:
- [BestOfferPlaced_doc.md](./operations/BestOfferPlaced_doc.md)

Legacy Example:
- [BestOfferPlaced_example.md](./operations/BestOfferPlaced_example.md)

Modern Doc:
- [OFFER_ACTIVITY_doc.md](./operations/OFFER_ACTIVITY_doc.md)

Migration Guide:
- This new notification topic covers multiple events related to offers between
  buyers and sellers.
- The BestOfferPlaced notification is sent to the buyer when the buyer
  successfully submits a Best Offer on a listing.
- The buyer will see `BUYER_OFFER` as the `OfferType` value and `PENDING` as
  the `OfferStatus` value.

### BestOfferDeclined -> OFFER_ACTIVITY

Purpose:
- Notify a buyer when a submitted best offer is declined.

Modern Target:
- `OFFER_ACTIVITY`

Key Differences:
- Modern payload status identifies the decline instead of using a separate
  topic.

Legacy Doc:
- [BestOfferDeclined_doc.md](./operations/BestOfferDeclined_doc.md)

Legacy Example:
- [BestOfferDeclined_example.md](./operations/BestOfferDeclined_example.md)

Modern Doc:
- [OFFER_ACTIVITY_doc.md](./operations/OFFER_ACTIVITY_doc.md)

Migration Guide:
- This new notification topic covers multiple events related to offers between
  buyers and sellers.
- The BestOfferDeclined notification is sent to the buyer when the buyer's
  Best Offer is declined by the seller.
- The buyer will see `BUYER_OFFER` as the `OfferType` value and `DECLINED` as
  the `OfferStatus` value.

### CounterOfferReceived -> OFFER_ACTIVITY

Purpose:
- Notify a buyer or seller when the other side submits a counteroffer.

Modern Target:
- `OFFER_ACTIVITY`

Key Differences:
- The modern payload distinguishes seller and buyer views using `OfferType`.

Legacy Doc:
- [CounterOfferReceived_doc.md](./operations/CounterOfferReceived_doc.md)

Legacy Example:
- [CounterOfferReceived_example.md](./operations/CounterOfferReceived_example.md)

Modern Doc:
- [OFFER_ACTIVITY_doc.md](./operations/OFFER_ACTIVITY_doc.md)

Migration Guide:
- This new notification topic covers multiple events related to offers between
  buyers and sellers.
- The CounterOfferReceived notification is sent to a seller or buyer when
  their offer partner proposes a counteroffer to their offer or counteroffer.
- A seller will see `BUYER_COUNTER_OFFER` as the `OfferType` value and
  `PENDING` as the `OfferStatus` value.
- A buyer will see `SELLER_COUNTER_OFFER` as the `OfferType` value and
  `PENDING` as the `OfferStatus` value.

### BidPlaced -> AUCTION_ACTIVITY

Purpose:
- Notify a buyer when a bid is successfully placed.

Modern Target:
- `AUCTION_ACTIVITY`

Key Differences:
- Modern payload uses `AuctionActivity` to distinguish the legacy event.

Legacy Doc:
- [BidPlaced_doc.md](./operations/BidPlaced_doc.md)

Legacy Example:
- [BidPlaced_example.md](./operations/BidPlaced_example.md)

Modern Doc:
- [AUCTION_ACTIVITY_doc.md](./operations/AUCTION_ACTIVITY_doc.md)

Migration Guide:
- This new notification topic covers multiple events related to bidding on
  auction listings.
- The BidPlaced notification is sent to the buyer when the buyer successfully
  placed a bid on an auction item.
- The buyer will see `BID_PLACED` as the `AuctionActivity` value.

### BidReceived -> AUCTION_ACTIVITY

Purpose:
- Notify a seller when a bid is received.

Modern Target:
- `AUCTION_ACTIVITY`

Key Differences:
- One modern topic covers multiple bid lifecycle events.

Legacy Doc:
- [BidReceived_doc.md](./operations/BidReceived_doc.md)

Legacy Example:
- [BidReceived_example.md](./operations/BidReceived_example.md)

Modern Doc:
- [AUCTION_ACTIVITY_doc.md](./operations/AUCTION_ACTIVITY_doc.md)

Migration Guide:
- This new notification topic covers multiple events related to bidding on
  auction listings.
- The BidReceived notification is sent to the seller each time a prospective
  buyer places a bid for the seller's auction item.
- The seller will see `BID_RECEIVED` as the `AuctionActivity` value.

### ItemWon -> AUCTION_ACTIVITY

Purpose:
- Notify a buyer that they won an auction.

Modern Target:
- `AUCTION_ACTIVITY`

Key Differences:
- Modern payload uses `AUCTION_WON` in one consolidated topic.

Legacy Doc:
- [ItemWon_doc.md](./operations/ItemWon_doc.md)

Legacy Example:
- [ItemWon_example.md](./operations/ItemWon_example.md)

Modern Doc:
- [AUCTION_ACTIVITY_doc.md](./operations/AUCTION_ACTIVITY_doc.md)

Migration Guide:
- This new notification topic covers multiple events related to bidding on
  auction listings.
- The ItemWon notification is sent to the buyer when the buyer is the winning
  bidder on an auction item.
- The buyer will see `AUCTION_WON` as the `AuctionActivity` value.

### OutBid -> AUCTION_ACTIVITY

Purpose:
- Notify a buyer that another bidder has outbid them.

Modern Target:
- `AUCTION_ACTIVITY`

Key Differences:
- Modern payload uses `OUTBID` in one consolidated topic.

Legacy Doc:
- [OutBid_doc.md](./operations/OutBid_doc.md)

Legacy Example:
- [OutBid_example.md](./operations/OutBid_example.md)

Modern Doc:
- [AUCTION_ACTIVITY_doc.md](./operations/AUCTION_ACTIVITY_doc.md)

Migration Guide:
- This new notification topic covers multiple events related to bidding on
  auction listings.
- The OutBid notification is sent to the buyer when the buyer is outbid by
  another bidder on an auction item.
- The buyer will see `OUTBID` as the `AuctionActivity` value.

### EndOfAuction -> AUCTION_ENDED

Purpose:
- Notify seller and bidders when an auction listing ends.

Modern Target:
- `AUCTION_ENDED`

Key Differences:
- Modern topic fires for auction end with or without a winning bidder.

Legacy Doc:
- [EndOfAuction_doc.md](./operations/EndOfAuction_doc.md)

Legacy Example:
- [EndOfAuction_example.md](./operations/EndOfAuction_example.md)

Modern Doc:
- [AUCTION_ENDED_doc.md](./operations/AUCTION_ENDED_doc.md)

Migration Guide:
- This notification is sent to the seller and bidders as soon as an auction
  listing ends, with or without a winning bidder.

## No Replacement Event Statuses

### Feedback -> No Replacement

Purpose:
- Capture the deprecated generic feedback notification family.

Modern Target:
- `No Replacement`

Key Differences:
- This event is marked as `No Replacement`.
- The following platform notifications will not be migrated due to either low
  usage or due to no longer being applicable
- Use `FeedbackReceived` or `FeedbackLeft` instead when those concrete legacy
  events are the real trigger.

Legacy Doc:
- [Feedback_doc.md](./operations/Feedback_doc.md)

Legacy Example:
- [Feedback_example.md](./operations/Feedback_example.md)

Migration Guide:
- The following platform notifications will not be migrated due to either low
  usage or due to no longer being applicable
- Feedback (use FeedbackReceived or FeedbackLeft instead)

### MyMessagesHighPriorityMessage -> No Replacement

Purpose:
- Capture the legacy high-priority My Messages notification.

Modern Target:
- `No Replacement`

Key Differences:
- This event is marked as `No Replacement`.
- The following platform notifications will not be migrated due to either low
  usage or due to no longer being applicable

Legacy Doc:
- [MyMessagesHighPriorityMessage_doc.md](./operations/MyMessagesHighPriorityMessage_doc.md)

Legacy Example:
- [MyMessagesHighPriorityMessage_example.md](./operations/MyMessagesHighPriorityMessage_example.md)

Migration Guide:
- The following platform notifications will not be migrated due to either low
  usage or due to no longer being applicable
- MyMessagesHighPriorityMessage

### MyMessagesHighPriorityMessageHeader -> migration plan yet to be decided

Purpose:
- Capture the legacy high-priority My Messages header notification.

Modern Target:
- `migration plan yet to be decided`

Key Differences:
- This event is marked as `migration plan yet to be decided`.
- The following platform notifications will not be migrated due to either low
  usage or due to no longer being applicable
- Keep the replacement unresolved and do not invent a modern topic from the
  grouped guide wording alone.

Legacy Doc:
- [MyMessagesHighPriorityMessageHeader_doc.md](./operations/MyMessagesHighPriorityMessageHeader_doc.md)

Migration Guide:
- The following platform notifications will not be migrated due to either low
  usage or due to no longer being applicable
- MyMessagesHighPriorityMessageHeader

### SecondChanceOffer -> No Replacement

Purpose:
- Capture the legacy second-chance-offer notification.

Modern Target:
- `No Replacement`

Key Differences:
- This event is marked as `No Replacement`.
- The following platform notifications will not be migrated due to either low
  usage or due to no longer being applicable

Legacy Doc:
- [SecondChanceOffer_doc.md](./operations/SecondChanceOffer_doc.md)

Legacy Example:
- [SecondChanceOffer_example.md](./operations/SecondChanceOffer_example.md)

Migration Guide:
- The following platform notifications will not be migrated due to either low
  usage or due to no longer being applicable
- SecondChanceOffer

### MyMessageseBayMessageHeader -> No Replacement

Purpose:
- Capture the legacy header-only eBay message notification.

Modern Target:
- `No Replacement`

Key Differences:
- This event is marked as `No Replacement`.
- The following platform notifications will not be migrated due to either low
  usage or due to no longer being applicable

Legacy Doc:
- [MyMessageseBayMessageHeader_doc.md](./operations/MyMessageseBayMessageHeader_doc.md)

Legacy Example:
- [MyMessageseBayMessageHeader_example.md](./operations/MyMessageseBayMessageHeader_example.md)

Migration Guide:
- The following platform notifications will not be migrated due to either low
  usage or due to no longer being applicable
- MyMessageseBayMessageHeader

### MyMessagesM2MMessageHeader -> No Replacement

Purpose:
- Capture the legacy header-only member-to-member message notification.

Modern Target:
- `No Replacement`

Key Differences:
- This event is marked as `No Replacement`.
- The following platform notifications will not be migrated due to either low
  usage or due to no longer being applicable

Legacy Doc:
- [MyMessagesM2MMessageHeader_doc.md](./operations/MyMessagesM2MMessageHeader_doc.md)

Legacy Example:
- [MyMessagesM2MMessageHeader_example.md](./operations/MyMessagesM2MMessageHeader_example.md)

Migration Guide:
- The following platform notifications will not be migrated due to either low
  usage or due to no longer being applicable
- MyMessagesM2MMessageHeader

### BidItemEndingSoon -> No Replacement

Purpose:
- Capture the legacy bidder warning for an auction item ending soon.

Modern Target:
- `No Replacement`

Key Differences:
- This event is marked as `No Replacement`.
- The following platform notifications will not be migrated due to either low
  usage or due to no longer being applicable

Legacy Doc:
- [BidItemEndingSoon_doc.md](./operations/BidItemEndingSoon_doc.md)

Legacy Example:
- [BidItemEndingSoon_example.md](./operations/BidItemEndingSoon_example.md)

Migration Guide:
- The following platform notifications will not be migrated due to either low
  usage or due to no longer being applicable
- BidItemEndingSoon

### ItemRevisedAddCharity -> No Replacement

Purpose:
- Capture the legacy charity-related listing revision notification.

Modern Target:
- `No Replacement`

Key Differences:
- This event is marked as `No Replacement`.
- The following platform notifications will not be migrated due to either low
  usage or due to no longer being applicable

Legacy Doc:
- [ItemRevisedAddCharity_doc.md](./operations/ItemRevisedAddCharity_doc.md)

Legacy Example:
- [ItemRevisedAddCharity_example.md](./operations/ItemRevisedAddCharity_example.md)

Migration Guide:
- The following platform notifications will not be migrated due to either low
  usage or due to no longer being applicable.
- ItemRevisedAddCharity

### WatchedItemEndingSoon -> No Replacement

Purpose:
- Capture the legacy watch-list ending-soon notification.

Modern Target:
- `No Replacement`

Key Differences:
- This event is marked as `No Replacement`.
- The following platform notifications will not be migrated due to either low
  usage or due to no longer being applicable

Legacy Doc:
- [WatchedItemEndingSoon_doc.md](./operations/WatchedItemEndingSoon_doc.md)

Legacy Example:
- [WatchedItemEndingSoon_example.md](./operations/WatchedItemEndingSoon_example.md)

Migration Guide:
- The following platform notifications will not be migrated due to either low
  usage or due to no longer being applicable.
- WatchedItemEndingSoon

### ItemReadyForPickup -> No Replacement

Purpose:
- Capture the legacy pickup-ready notification.

Modern Target:
- `No Replacement`

Key Differences:
- This event is marked as `No Replacement`.
- The following platform notifications will not be migrated due to either low
  usage or due to no longer being applicable

Legacy Doc:
- [ItemReadyForPickup_doc.md](./operations/ItemReadyForPickup_doc.md)

Legacy Example:
- [ItemReadyForPickup_example.md](./operations/ItemReadyForPickup_example.md)

Migration Guide:
- The following platform notifications will not be migrated due to either low
  usage or due to no longer being applicable
- ItemReadyForPickup

### ShoppingCartItemEndingSoon -> No Replacement

Purpose:
- Capture the legacy shopping-cart ending-soon notification.

Modern Target:
- `No Replacement`

Key Differences:
- This event is marked as `No Replacement`.
- The following platform notifications will not be migrated due to either low
  usage or due to no longer being applicable

Legacy Doc:
- [ShoppingCartItemEndingSoon_doc.md](./operations/ShoppingCartItemEndingSoon_doc.md)

Legacy Example:
- [ShoppingCartItemEndingSoon_example.md](./operations/ShoppingCartItemEndingSoon_example.md)

Migration Guide:
- The following platform notifications will not be migrated due to either low
  usage or due to no longer being applicable
- ShoppingCartItemEndingSoon

## Pending Migration Plan Event Statuses

### BuyerCancelRequested -> migration plan yet to be decided

The migration plan for `BuyerCancelRequested` has yet to be decided.

### EBPMyPaymentDue -> migration plan yet to be decided

The migration plan for `EBPMyPaymentDue` has yet to be decided.

### EBPPaymentDone -> migration plan yet to be decided

The migration plan for `EBPPaymentDone` has yet to be decided.

### INRBuyerRespondedToDispute -> migration plan yet to be decided

The migration plan for `INRBuyerRespondedToDispute` has yet to be decided.

### ItemExtended -> migration plan yet to be decided

The migration plan for `ItemExtended` has yet to be decided.

### ItemOutOfStock -> migration plan yet to be decided

The migration plan for `ItemOutOfStock` has yet to be decided.

### ItemSuspended -> migration plan yet to be decided

The migration plan for `ItemSuspended` has yet to be decided.

### ItemUnsold -> migration plan yet to be decided

The migration plan for `ItemUnsold` has yet to be decided.

### OrderInquiryReminderForEscalation -> migration plan yet to be decided

The migration plan for `OrderInquiryReminderForEscalation` has yet to be decided.

### ReturnRefundOverdue -> migration plan yet to be decided

The migration plan for `ReturnRefundOverdue` has yet to be decided.

### ReturnSellerInfoOverdue -> migration plan yet to be decided

The migration plan for `ReturnSellerInfoOverdue` has yet to be decided.

### ReturnWaitingForSellerInfo -> migration plan yet to be decided

The migration plan for `ReturnWaitingForSellerInfo` has yet to be decided.

### ReturnClosed -> migration plan yet to be decided

The migration plan for `ReturnClosed` has yet to be decided.

### ReturnCreated -> migration plan yet to be decided

The migration plan for `ReturnCreated` has yet to be decided.

### ReturnDelivered -> migration plan yet to be decided

The migration plan for `ReturnDelivered` has yet to be decided.

### ReturnEscalated -> migration plan yet to be decided

The migration plan for `ReturnEscalated` has yet to be decided.

### ReturnShipped -> migration plan yet to be decided

The migration plan for `ReturnShipped` has yet to be decided.

### EBPAppealedCase -> migration plan yet to be decided

The migration plan for `EBPAppealedCase` has yet to be decided.

### EBPClosedAppeal -> migration plan yet to be decided

The migration plan for `EBPClosedAppeal` has yet to be decided.

### EBPClosedCase -> migration plan yet to be decided

The migration plan for `EBPClosedCase` has yet to be decided.

### EBPEscalatedCase -> migration plan yet to be decided

The migration plan for `EBPEscalatedCase` has yet to be decided.

### EBPMyResponseDue -> migration plan yet to be decided

The migration plan for `EBPMyResponseDue` has yet to be decided.

### EBPOnHoldCase -> migration plan yet to be decided

The migration plan for `EBPOnHoldCase` has yet to be decided.

### EBPOtherPartyResponseDue -> migration plan yet to be decided

The migration plan for `EBPOtherPartyResponseDue` has yet to be decided.

### ItemMarkedPaid -> migration plan yet to be decided

The migration plan for `ItemMarkedPaid` has yet to be decided.

### ItemLost -> migration plan yet to be decided

The migration plan for `ItemLost` has yet to be decided.

### PaymentReminder -> migration plan yet to be decided

The migration plan for `PaymentReminder` has yet to be decided.