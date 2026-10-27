# createSubscription

Source basis:

- Bundled migration guide reference.
- Bundled modern example payload.

Local evidence status:

- The bundled REST reference page in this runtime package does not include a
  standalone `createSubscription` subsection.

Guide-backed modern behavior:

- `createSubscription` replaces part of the legacy event-subscription workflow
  from `SetNotificationPreferences`.
- Use this method to subscribe to a modern Notification API topic.

Public method reference:

- `POST /commerce/notification/v1/subscription`