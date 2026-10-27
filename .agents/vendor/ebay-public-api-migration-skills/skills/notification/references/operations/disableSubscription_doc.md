# disableSubscription

Source basis:

- Bundled migration guide reference.
- Bundled modern example payload.

Local evidence status:

- The bundled REST reference page in this runtime package does not include a
  standalone `disableSubscription` subsection.

Guide-backed modern behavior:

- `disableSubscription` replaces part of the legacy event-subscription
  workflow from `SetNotificationPreferences`.
- Use this method to disable an existing topic subscription without deleting
  it.

Public method reference:

- `POST /commerce/notification/v1/subscription/{subscription_id}/disable`