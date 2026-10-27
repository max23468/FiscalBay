# BidItemEndingSoon

Bundled source status:

- No standalone legacy topic page for `BidItemEndingSoon` is bundled locally.
- The bundled Trading API material still shows this as a buyer-side platform
  notification event and includes a `TimeLeft` event property example with a
  value of `15` minutes.

Legacy event behavior:

- `BidItemEndingSoon` is the buyer reminder for an auction listing the user has
  already bid on when the listing is close to ending.
- The bundled materials do not include a dedicated payload reference page, but
  they do show this event as separately subscribable from broader bidding alerts.
- The `TimeLeft` event property indicates the warning threshold used for this
  reminder-style event.

Migration guidance:

- This event is marked as `No Replacement` in the bundled migration guide due to
  low usage or because it is no longer being carried forward as a modern topic.
- There is no direct Notification API topic for this countdown reminder.
- If the old flow still matters, recreate the reminder behavior in application
  logic using listing end times from the Buy side listing data you already track.
