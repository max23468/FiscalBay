# ShoppingCartItemEndingSoon

Source evidence:

- Bundled Trading API release note text in `GetNotificationPreferences.html`
  and `SetNotificationPreferences.html`
- Bundled Trading API sample data showing a `TimeLeft` event property

Legacy event behavior:

- `ShoppingCartItemEndingSoon` is sent to a subscribed buyer when the listing for
  an unpurchased item in that buyer's cart is about to end.
- The bundled Trading API sample material shows this reminder event using a
  `TimeLeft` property, with `15` minutes shown in the example response.
- No standalone legacy payload reference page is bundled locally for deeper
  field-level SOAP documentation.

Migration guidance:

- This event is marked as `No Replacement` in the bundled migration guide.
- There is no direct Notification API topic for cart-expiration reminders.
- If the buyer reminder is still important, rebuild it from cart and listing end
  times in application logic instead of expecting a modern webhook equivalent.
