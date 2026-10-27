# Topic Consolidation And Fallbacks

- `OFFER_ACTIVITY` consolidates multiple offer lifecycle events. Use payload
  fields such as `OfferType` and `OfferStatus` to distinguish `BestOffer`,
  `BestOfferPlaced`, `BestOfferDeclined`, and `CounterOfferReceived`.
- `AUCTION_ACTIVITY` consolidates multiple auction lifecycle events. Use
  `AuctionActivity` values such as `BID_PLACED`, `BID_RECEIVED`,
  `AUCTION_WON`, and `OUTBID`.
- `NEW_MESSAGE` consolidates legacy message notifications. Legacy header-only
  events do not always have a one-to-one modern equivalent.
- `LISTING` is a guide-backed modern target for listing-state changes such as
  end, create, and revise, but this package does not yet bundle a local
  standalone `LISTING` topic doc.
- `ItemSold` remains a fallback-only case in the bundled guide: use `LISTING`
  to observe listing end and `ORDER_CONFIRMATION` to observe payment-cleared
  order completion.
- When a grouped or modern topic mapping does not have a bundled modern
  `_example.md` file, do not invent a full modern sample payload. Instead,
  answer with: the mapped modern topic, the documented discriminator field or
  value such as `OfferType`, `OfferStatus`, `AuctionActivity`,
  `WatchlistRevision`, or listing `reason`, and a short legacy example that
  shows what the old notification looked like before migration.
- If the package also lacks a local standalone modern topic doc for that case,
  keep the gap explicit while still giving the user the mapped topic name and
  the best bundled guide-backed discriminator or fallback detail available.