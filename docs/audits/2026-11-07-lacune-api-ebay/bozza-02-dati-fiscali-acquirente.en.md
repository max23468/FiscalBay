# Bozza 2: dati fiscali dell'acquirente nelle letture di elenco

**Dove:** nuovo ticket al supporto sviluppatori eBay, con riferimento a quello del 27 ottobre 2026; in alternativa il referente del Partner Program, se FiscalBay viene ammesso.

**Stato:** non inviata, superata dal [ticket inviato](README.md#ticket-inviato). Il punto 3, sulla parità del CF nella Order API, è stato tolto: partiva da una premessa corretta dopo la stesura, perché il CF non dipende da `GetOrders` e le fatture combinate senza checkout eBay non hanno CF in nessuna fonte, e [D334](../../decisions/DECISION_REGISTER.md) sceglie la sola Fulfillment. Per un invio futuro restano i punti 1 e 2.

**Prima di un eventuale invio:** azione interna 1 del [dossier](README.md#azioni-interne-prima-degli-invii).

**Verifica:** 7 novembre 2026, specifica Fulfillment `v1.20.7` e schema GraphQL `listing.graphqls`; prove del 10 e del 27 ottobre nel [confronto fiscale](../../reference/EBAY_TAX_COMPARISON.md).

**Dati:** nessun ID, negozio o valore fiscale; nessuna affermazione normativa oltre il bisogno generale di fatturazione.

---

**Subject:** Buyer tax identifier: `getOrders` coverage and completeness of the container

**Context**

FiscalBay is a read-only app for Italian eBay sellers. It reads the buyer's Codice Fiscale, which Italian sellers need to issue invoices, from Sell Fulfillment `getOrder`. On October 27, 2026, Developer Support confirmed that `getOrder` is the supported REST source.

**1. One extra call per order**

`taxIdentifier` is returned only by `getOrder`, not by `getOrders`, even with the `orderIds` parameter (up to 50 orders). An app that lists 200 orders per page then needs one `getOrder` per order to read the tax ID.

Request: return `taxIdentifier` in `getOrders` as well, at least with `orderIds` or behind a dedicated `fieldGroups` value, under the same authorization as `getOrder`.

**2. Completeness of the container**

- `Buyer.taxIdentifier` is a single object, while `TaxIdentifierTypeEnum` includes both `CODICE_FISCALE` and `VATIN`. An Italian buyer with both a Codice Fiscale and a VAT number can't have both in the same response.
- `issuingCountry` was missing in part of our sample; Trading `BuyerTaxIdentifier` never returned it.
- A missing container doesn't tell "buyer has no tax ID" from "marketplace not covered" or "data no longer available".

Request: a list of identifiers with type and issuing country always set on covered marketplaces, plus an explicit indication when the data isn't available.

**Expected result**

An Italian seller gets the Codice Fiscale of every paid order without one call per order.
