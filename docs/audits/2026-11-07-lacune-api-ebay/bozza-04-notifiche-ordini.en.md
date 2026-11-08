# Bozza 4: notifiche degli ordini

**Stato:** non inviata; nota interna per un eventuale invio futuro.

**Dove:** nuovo ticket al supporto sviluppatori eBay, area Notification API.

**Verifica:** 7 novembre 2026, `getTopics` e `getTopic` Production con il token dell'applicazione (tre chiamate), specifica della Notification API, [release notes](https://developer.ebay.com/api-docs/commerce/notification/release-notes.html).

**Dati:** nessun ID di venditori, destinazioni o sottoscrizioni.

---

**Subject:** Notification API: ORDER_CONFIRMATION schema 1.1, read-only order update events, and one subscription per seller

**Context**

FiscalBay is a read-only app for eBay sellers. It subscribes each seller to `ORDER_CONFIRMATION` (schema 1.0) with `commerce.notification.subscription` and `sell.fulfillment.readonly`, and reconciles with periodic polling.

**1. ORDER_CONFIRMATION schema 1.1**

`getTopic` now lists schema versions 1.0 and 1.1. We couldn't find the 1.1 payload, how it differs from 1.0, or whether 1.0 will be deprecated. The topic description still tells developers to call `GetOrders` with the order ID, and says one notification is sent per line item.

Requests: publish both payload schemas and the differences, state the 1.0 deprecation plan if any, and point the description to Fulfillment `getOrder`.

**2. Order updates with read-only scopes**

Of the 28 topics returned by `getTopics`, the seller order topics are:

- `ORDER_CONFIRMATION`;
- `ITEM_MARKED_SHIPPED`, which requires `commerce.shipping`;
- the consolidated cancellation, inquiry and return topics, which require the `sell.cancellation`, `sell.inquiry` and `sell.return` scopes.

With `sell.fulfillment.readonly` alone, there's no event for a later payment, a refund, a cancellation, or a tax identifier that becomes available after confirmation. A read-only app has to poll for all of these.

Request: an `ORDER_UPDATED` topic, or an extension of `ORDER_CONFIRMATION`, carrying the order ID, the kind of change and `modifiedDate`, available with the Fulfillment read-only scope.

**3. One subscription per seller and topic**

An application can hold only one subscription per seller and topic. A test environment and production that share a keyset can't both receive events for the same seller, so testing on a real seller's account moves their events away from production.

Request: multiple destinations per subscription, or one subscription per destination.

**Expected result**

Schema 1.1 is documented, and a change to a paid order produces an event that a read-only app can subscribe to.
