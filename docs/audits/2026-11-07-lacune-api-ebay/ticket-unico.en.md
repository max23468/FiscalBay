# Ticket unico a eBay

**Dove:** nuovo ticket al supporto sviluppatori eBay, che cita la risposta del 27 ottobre 2026 sugli identificativi fiscali. Al posto di «[number]» va il numero di quel ticket, che è nella mail dell'owner.

**Contenuto:** riunisce gli [invii 1-5](README.md#in-sintesi) e tre delle [domande secondarie](README.md#domande-secondarie), in ordine di urgenza, entro il limite di 2.000 caratteri del modulo (il testo sotto ne conta circa 1.820). Prove e dettagli restano nel dossier e nelle bozze separate.

**Prima dell'invio:** [azione interna 1](README.md#azioni-interne-prima-degli-invii), cioè ripetere i controlli sulle specifiche e togliere i punti già corretti da eBay.

**Dati:** nessun ID di ordini, negozi o acquirenti, nessun valore fiscale.

---

**Subject:** Buyer tax ID and buyer identity after the GetOrders decommission

FiscalBay is a read-only app for Italian sellers (scopes: identity, sell.fulfillment.readonly, notification subscription). It reads the buyer's Codice Fiscale for invoicing. Follow-up to ticket [number] (Oct 27, 2026). GetOrders was deprecated on Nov 6, with decommission on June 30, 2027.

1. Before June 30, 2027, please expose the buyer tax ID and billing address in the GraphQL Order API and PurchaseQuote, as getOrder does. Today they're missing, and seller-created combined invoices paid outside eBay checkout exist only in GetOrders. If parity can't ship in time, please keep GetOrders for those reads.

2. Please add an immutable buyer ID (userId or eiasToken) to Fulfillment orders and the Order API. Fulfillment has only username, which can change, and EIAS comes only from GetOrders. Without it, we can't reliably match MARKETPLACE_ACCOUNT_DELETION to stored orders. Is Order.buyer.userId returned to sellers?

3. X-EBAY-C-MARKETPLACE-ID is required for taxIdentifier, but the getOrder spec (v1.20.7) doesn't mention it. Without it, no tax ID is returned.

4. Please return taxIdentifier in getOrders, at least with orderIds; today it costs one call per order. It's also a single object (CODICE_FISCALE and VATIN can't coexist), and issuingCountry is often missing.

5. Please document the ORDER_CONFIRMATION 1.1 schema. We'd also like a read-only order update topic (payment, refund, cancellation) and more than one destination per seller subscription.

6. getUserRateLimits rejects tokens without inventory, marketing or catalog scopes. Please accept sell.fulfillment.readonly.

Questions:
a) How can we create a paid Sandbox EBAY_IT order that has taxIdentifier?
b) Does an Italian business buyer's VAT number arrive as VATIN?
c) Are deprecations planned for GetItem, GetStore and GetUser?

Thank you.
