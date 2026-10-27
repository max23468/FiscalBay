# Feedback

Source evidence:

- Official legacy page: https://developer.ebay.com/api-docs/static/pn_feedback.html
- Bundled notification mapping table: `src-docs/notification/Notifications Topics.html`

Legacy event behavior:

- `Feedback` is the older combined platform notification for both directions of
  feedback activity.
- eBay sends it to a subscribed buyer or seller when that user has either left
  feedback for the other party in the order or has received feedback from the
  other party.
- The legacy SOAP body uses `GetFeedbackResponse` with `ReturnAll` detail level.
  The payload includes `FeedbackDetailArray` entries such as commenter,
  comment text, comment type, item ID, transaction ID, and role. The legacy page
  also notes that detailed seller rating averages are not included in this
  notification.

Migration guidance:

- This generic combined event is marked as `No Replacement` in the bundled
  migration mapping.
- Use `FEEDBACK_RECEIVED` when the application needs buyer or seller inbound
  feedback events.
- Use `FEEDBACK_LEFT` when the application needs confirmation that the user's own
  feedback submission was recorded.
- If the old integration depended on the legacy combined event, split that logic
  into separate handlers for received-versus-left feedback instead of expecting a
  single modern topic.
