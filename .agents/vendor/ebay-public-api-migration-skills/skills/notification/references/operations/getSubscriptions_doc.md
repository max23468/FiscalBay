# getSubscriptions

Source basis:

- Bundled migration guide reference.
- Bundled modern example payload.

Local evidence status:

- The bundled REST reference page in this runtime package does not include a
	standalone `getSubscriptions` subsection.

Guide-backed modern behavior:

- `getSubscriptions` replaces `GetNotificationPreferences`.
- The modern call returns subscribed topics rather than legacy event types.
- Use Notification API topic subscriptions as the authoritative modern model.

Public method reference:

- `GET /commerce/notification/v1/subscription`
