# M2MMessageStatusChange

Source evidence:

- Bundled Trading API release note text in `SetNotificationPreferences.html`
  and `GetNotificationPreferences.html`
- Packaged modern topic doc:
  [NEW_MESSAGE_doc.md](./NEW_MESSAGE_doc.md)

Legacy event behavior:

- `M2MMessageStatusChange` is sent to a subscribed buyer, seller, or application
  when a member-to-member message in the My Messages inbox is either deleted or
  marked as read.
- This is a status-change event, not a new-message delivery event.
- No standalone legacy payload page is bundled locally, so the trigger
  description above comes from the Trading API release notes rather than a full
  topic reference.

Migration guidance:

- The bundled mapping points to `NEW_MESSAGE` as the nearest modern replacement
  path.
- That replacement is only partial: `NEW_MESSAGE` covers newly received messages,
  while the legacy event covered read or delete changes after receipt.
- If the old integration depended on read or delete state transitions, preserve
  that behavior in application state management; do not assume the modern topic
  is one-to-one.
