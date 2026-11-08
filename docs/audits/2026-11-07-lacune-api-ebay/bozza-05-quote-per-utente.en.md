# Bozza 5: quote per utente

**Stato:** non inviata; nota interna per un eventuale invio futuro.

**Dove:** nuovo ticket al supporto sviluppatori eBay, area Developer Analytics API. Non chiede limiti più alti: per quelli vale l'[Application Growth Check](../../ROADMAP.md#re-01).

**Verifica:** 7 novembre 2026, specifica OpenAPI della Developer Analytics API `v1_beta.0.1`; rifiuto del token del venditore osservato il 27 ottobre nel [confronto fiscale](../../reference/EBAY_TAX_COMPARISON.md#seller-transactions).

**Dati:** nessun limite, consumo o ID dell'applicazione.

---

**Subject:** Developer Analytics API: getUserRateLimits requires scopes that a read-only order app doesn't use

**Context**

FiscalBay is a read-only app for eBay sellers. It asks sellers only for `api_scope`, `commerce.identity.readonly`, `sell.fulfillment.readonly` and `commerce.notification.subscription`. It already monitors application limits with `getRateLimits`.

**The gap**

- `getUserRateLimits` accepts only tokens with one of `sell.inventory`, `sell.inventory.readonly`, `sell.marketplace.insights.readonly`, `commerce.catalog.readonly`, `sell.marketing` or `sell.marketing.readonly`.
- Our sellers' tokens are rejected, so we can't see per-seller usage without asking for scopes we would never use.
- The Developer Analytics API is still `v1_beta`, and Trading `GetApiAccessRules` now returns 410.

**Requests**

1. Accept any user access token for `getUserRateLimits`, or at least one with `sell.fulfillment.readonly`.
2. A stable version of the Developer Analytics API.

**Expected result**

A read-only order app can see per-seller usage without requesting unrelated scopes.
