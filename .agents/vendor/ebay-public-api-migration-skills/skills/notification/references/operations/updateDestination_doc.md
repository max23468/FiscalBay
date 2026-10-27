# updateDestination

Source basis:

- Bundled migration guide reference.
- Bundled modern example payload.

Local evidence status:

- The bundled REST reference page in this runtime package does not include a
  standalone `updateDestination` subsection.

Guide-backed modern behavior:

- `updateDestination` replaces the destination-update portion of
  `SetNotificationPreferences`.
- Use this method to change the configured HTTPS endpoint that receives
  notifications for subscribed topics.

Public method reference:

- `PUT /commerce/notification/v1/destination/{destination_id}`