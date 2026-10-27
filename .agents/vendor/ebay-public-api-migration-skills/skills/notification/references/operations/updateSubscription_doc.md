# updateSubscription

Source basis:

- Bundled migration guide reference.
- Bundled modern example payload.

Local evidence status:

- The bundled REST reference page in this runtime package does not include a
  standalone `updateSubscription` subsection.

Guide-backed modern behavior:

- `updateSubscription` replaces part of the legacy event-subscription workflow
  from `SetNotificationPreferences`.
- Use this method to change an existing topic subscription.

Public method reference:

- `PUT /commerce/notification/v1/subscription/{subscription_id}`