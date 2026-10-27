# ItemListed

Source evidence:

- Bundled migration guide guidance for `ItemListed`
- Packaged modern topic doc:
  [LISTING_doc.md](./LISTING_doc.md)

Legacy event behavior:

- `ItemListed` is the legacy seller notification for listing creation.
- The corresponding modern Notification API topic is `LISTING`.
- In the `LISTING` async contract, the matching lifecycle signal is
  `notification.data.reason = CREATED`.

Migration guidance:

- Migrate `ItemListed` to `LISTING`.
- Use the `reason` field to distinguish this creation event from listing
  updates and listing end events that share the same topic.
