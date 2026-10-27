# ItemMarkedShipped

Source evidence:

- Packaged modern topic doc:
  [ITEM_MARKED_SHIPPED_doc.md](./ITEM_MARKED_SHIPPED_doc.md)
- Bundled notification mapping table: `src-docs/notification/Notifications Topics.html`

Legacy and modern behavior:

- `ItemMarkedShipped` is the shipment-status event used when a seller marks an
  order line item as shipped.
- The bundled migration mapping ties this legacy event directly to the modern
  `ITEM_MARKED_SHIPPED` Notification API topic.
- In the modern contract, the JSON payload carries shipment-specific fields such
  as `orderId`, `itemId`, `trackingNumber`, `carrier`, and `shippedDate` inside
  `notification.data`.

Migration guidance:

- Treat this as a direct topic migration rather than a fallback recommendation.
- Migrate SOAP listener logic to HTTPS webhook handling, validate the
  `X-EBAY-SIGNATURE` header, and parse JSON instead of a Trading API SOAP body.
- Update downstream consumers to use the explicit shipment data in the modern
  payload instead of extracting shipment state from legacy XML.
