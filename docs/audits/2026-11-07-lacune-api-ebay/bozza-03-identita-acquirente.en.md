# Bozza 3: identità immutabile dell'acquirente negli ordini

**Stato:** il contenuto è andato a eBay il 7 novembre 2026 come punto 2 del [ticket inviato](README.md#ticket-inviato).

**Dove:** nuovo ticket al supporto sviluppatori eBay, area Marketplace Account Deletion e Fulfillment.

**Verifica:** 7 novembre 2026, guida [Marketplace user account deletion](https://developer.ebay.com/develop/guides-v2/marketplace-user-account-deletion), specifiche Fulfillment `v1.20.7` e Identity, schema GraphQL; abbinamento descritto nella [conservazione](../../engineering/DATA_RETENTION.md#cancellazione-ebay).

**Dati:** nessun ID, username o conteggio di singoli negozi.

---

**Subject:** Marketplace Account Deletion: no immutable buyer identifier in Fulfillment orders to match deletion requests

**Context**

FiscalBay stores eBay orders for its sellers and must delete a buyer's data when it receives `MARKETPLACE_ACCOUNT_DELETION`. The notification carries `userId` (immutable), `eiasToken` and `username`. The guide notes that some developers don't receive `username` for US users.

**The gap**

- Sell Fulfillment `Buyer` has only `username`, `taxAddress`, `taxIdentifier` and `buyerRegistrationAddress`, with no `userId` or `eiasToken`.
- The Identity API describes `username` as a value the user can change.
- The buyer's EIAS token is available only in Trading `GetOrders`, which returns orders up to 90 days old, while Fulfillment returns them up to two years. `GetOrders` was deprecated on November 6, 2026 and will be decommissioned on June 30, 2027, so after that date no API will return the token.
- So for orders read only from Fulfillment, the only key that matches a deletion request is the username recorded with the order, which may no longer be the buyer's current one. For one of our sellers this applies to most stored orders. We now re-read the username weekly, which narrows the gap but can't close it.
- The GraphQL `User` type exposes `userId` under `commerce.identity.readonly`, but we couldn't find whether it's returned for the buyer of a seller's order.

The guide requires deleting the user's data, but doesn't say how to recognize that user in orders read from Fulfillment.

**Requests**

1. An immutable buyer identifier (`userId` or `eiasToken`) in Fulfillment `getOrder` and `getOrders` and in the GraphQL Order API, available with the order read scopes.
2. Alternatively, official guidance on which key to use to match a deletion notification to orders read from Fulfillment, and confirmation of whether `Order.buyer.userId` is returned to the seller.

**Expected result**

Every stored order can be matched to a deletion request without relying on the username or on Trading.
