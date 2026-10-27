# updateConfig

Source basis:

- Bundled migration guide reference.
- Bundled modern example payload.

Local evidence status:

- The bundled REST reference page in this runtime package does not include a
  standalone `updateConfig` subsection.

Guide-backed modern behavior:

- `updateConfig` replaces the alert-email update portion of
  `SetNotificationPreferences`.
- Use this method to add or modify the alert email used for Notification API
  alerts.

Public method reference:

- `PUT /commerce/notification/v1/config`