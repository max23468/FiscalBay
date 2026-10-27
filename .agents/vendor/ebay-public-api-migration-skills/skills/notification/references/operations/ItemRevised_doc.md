# ItemRevised

Source evidence:

- Bundled migration guide guidance for `ItemRevised`
- Packaged modern topic doc:
  [LISTING_doc.md](./LISTING_doc.md)

Legacy event behavior:

- `ItemRevised` is the legacy seller notification for listing updates.
- The corresponding modern Notification API topic is `LISTING`.
- In the `LISTING` async contract, the matching lifecycle signal is
  `notification.data.reason = UPDATED`.

Migration guidance:

- Migrate `ItemRevised` to `LISTING`.
- Use the `reason` field to distinguish this update event from listing creation
  and listing end events that share the same topic.
