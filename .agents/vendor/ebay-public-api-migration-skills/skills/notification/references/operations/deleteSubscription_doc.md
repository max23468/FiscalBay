# deleteSubscription

Source basis:

- Bundled migration guide reference.
- Bundled modern example payload.

Local evidence status:

- The bundled REST reference page in this runtime package does not include a
  standalone `deleteSubscription` subsection.

Guide-backed modern behavior:

- `deleteSubscription` replaces part of the legacy event-subscription workflow
  from `SetNotificationPreferences`.
- Use this method to remove an existing topic subscription.

Public method reference:

- `DELETE /commerce/notification/v1/subscription/{subscription_id}`