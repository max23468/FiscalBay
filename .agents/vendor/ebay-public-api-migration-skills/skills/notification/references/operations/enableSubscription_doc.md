# enableSubscription

Source basis:

- Bundled migration guide reference.
- Bundled modern example payload.

Local evidence status:

- The bundled REST reference page in this runtime package does not include a
  standalone `enableSubscription` subsection.

Guide-backed modern behavior:

- `enableSubscription` replaces part of the legacy event-subscription
  workflow from `SetNotificationPreferences`.
- Use this method to re-enable an existing topic subscription.

Public method reference:

- `POST /commerce/notification/v1/subscription/{subscription_id}/enable`