# ItemReadyForPickup

Bundled source status:

- No standalone legacy topic page for `ItemReadyForPickup` is bundled locally.
- The bundled notification tables identify it as a buyer-side platform
  notification, but they do not provide a dedicated payload reference page.

Legacy event behavior:

- This event name indicates the buyer-facing readiness state for an order that
  can be picked up rather than shipped.
- The bundled sources do not expose a richer field-by-field SOAP description for
  this event, so only the event role and migration status are source-backed here.

Migration guidance:

- `ItemReadyForPickup` is marked as `No Replacement` in the bundled migration
  guide.
- There is no mapped Notification API topic in this package for pickup-ready
  alerts.
- If pickup state still matters in the migrated integration, model it from the
  relevant order or fulfillment workflow your application owns instead of waiting
  for a direct platform-notification equivalent.
