# ItemRevisedAddCharity

Bundled source status:

- No standalone legacy topic page for `ItemRevisedAddCharity` is bundled locally.
- The bundled notification mapping table classifies it as a seller-side event
  and marks it as not migrated.

Legacy event behavior:

- `ItemRevisedAddCharity` is the charity-specific variant of the legacy item
  revision family.
- The bundled materials do not include a dedicated payload page, so there is no
  source-backed field inventory beyond the event name and seller-side scope.

Migration guidance:

- This event is marked as `No Replacement` in the bundled migration guide.
- There is no direct Notification API topic for charity-specific listing revision
  alerts in this package.
- When migrating, treat charity changes as part of the broader listing update
  flow your application already monitors instead of expecting a dedicated modern
  notification.
