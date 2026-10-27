# Notification Subscription Model

- Legacy notification setup was concentrated in `SetNotificationPreferences`.
- Modern Notification API setup is split across destination, config, and
  subscription resources.
- Use destination methods to register or update the HTTPS endpoint that
  receives notifications.
- Use config methods to manage alert email configuration.
- Use subscription methods to create, update, disable, enable, or delete topic
  subscriptions.
- `GetNotificationPreferences` becomes `getSubscriptions` for subscription
  visibility, but the modern response is topic-based instead of event-based.
- Keep the legacy platform guide behavior in mind: delivery endpoints must be
  functional, notifications expect HTTP `200 OK`, and repeated failures can
  stop delivery.