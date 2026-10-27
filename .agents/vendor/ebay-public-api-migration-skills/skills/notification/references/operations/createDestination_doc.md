# createDestination

Source basis:

- Bundled migration guide reference.
- Bundled modern example payload.

Local evidence status:

- The bundled REST reference page in this runtime package does not include a
  standalone `createDestination` subsection.

Guide-backed modern behavior:

- `createDestination` replaces the destination-registration portion of
  `SetNotificationPreferences`.
- Use this method to register the HTTPS endpoint that receives notifications
  for subscribed topics.

Public method reference:

- `POST /commerce/notification/v1/destination`