# ItemSold

Source evidence:

- Bundled migration guide guidance for `ItemSold`
- Packaged modern topic doc:
  [LISTING_doc.md](./LISTING_doc.md)

Legacy event behavior:

- `ItemSold` is the seller-facing legacy notification that the listing has
  completed with a sale.
- For the listing-state portion of that legacy event, the bundled modern
  replacement should be treated as `LISTING`.
- In the `LISTING` async contract, the closest lifecycle signal is
  `notification.data.reason = ENDED`.

Migration guidance:

- Migrate the listing completion event to the `LISTING` topic and inspect the
  `reason` field for `ENDED`.
- If the old integration also depended on payment-cleared confirmation, use
  `ORDER_CONFIRMATION` as an additional downstream payment-state signal rather
  than as the primary replacement for the listing event itself.
