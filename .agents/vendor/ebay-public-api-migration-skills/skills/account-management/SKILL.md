---
name: account-management
description: |
  Migration guidance for traditional API account management to User API (GraphQL), Identity API, Account API v1/v2, Stores API, Finances API, and Auction API.

  Trigger when user mentions: GetUser/GetUserPreferences/SetUserPreferences -> GraphQL user, Identity getUser, or Account API preference flows; GetStore/GetStoreCategoryUpdateStatus/SetStoreCategories -> Stores API; GetTaxTable/SetTaxTable -> Account API v1 tax operations; GetShippingDiscountProfiles/SetShippingDiscountProfiles -> Account API v2 combined-shipping rules; GetAccount billing or transaction lookups; GetAllBidders/GetBidderList -> Auction API bidder-activity queries; or asks "how do I migrate traditional account or store calls to REST/GraphQL".

  Covers 15 traditional operations including user identity, preferences, store management, billing, tax tables, shipping discounts, auction bidder activity, and explicit no-replacement rows such as GetUserContactDetails and SetUserNotes.
  Do NOT use for listing lifecycle or order/post-order workflows.
---

# Account Management Migration Skill

Use this skill for traditional account-oriented flows that now map to modern account, identity, store, or finance APIs.

Covered traditional flows:

- User identity and account profile retrieval
- User preference retrieval and update
- Store profile and store-category management
- Billing and transaction retrieval
- Sales-tax table retrieval and update
- Shipping-discount profile retrieval and update
- Auction bidder activity retrieval for a listing or current user

Modern API families covered:

- User API (GraphQL)
- Identity API
- Account API v1
- Account API v2
- Stores API
- Finances API
- Auction API

## When To Use

Reference this skill when you need to:

- migrate `GetUser`, `GetUserPreferences`, `SetUserPreferences`, or `GetUserContactDetails`
- split a traditional store-category workflow into modern Stores API operations
- translate `GetAccount` into billing-activity or transaction retrieval flows
- replace `GetTaxTable` or `SetTaxTable` with Account API v1 tax-table methods
- convert `GetShippingDiscountProfiles` or `SetShippingDiscountProfiles` into Account API v2 combined-shipping-rule operations
- map `GetAllBidders` or `GetBidderList` to the correct Auction API query
- identify calls that no longer have a partner-safe replacement

## Key Migration Patterns

- Traditional account calls are no longer a single SOAP surface. The modern replacements are spread across REST and GraphQL APIs with resource-specific endpoints.
- `GetUser` is a dual-target migration. Use GraphQL `user` when you need scope-driven structured profile retrieval, and Identity REST `getUser` when you need the authenticated account profile via REST.
- Store-category updates are action-specific in the Stores API. A single `SetStoreCategories` SOAP request becomes one of `addStoreCategory`, `moveStoreCategory`, `renameStoreCategory`, or `deleteStoreCategory`.
- Tax-table maintenance is split by scope. Use `getSalesTaxes` for country-level table retrieval, `getSalesTax` for a jurisdiction-level lookup, `bulkCreateOrReplaceSalesTax` for batch updates, and `createOrReplaceSalesTax` for a single jurisdiction update.
- Shipping-discount profiles now map to multiple Account API v2 combined-shipping-rule operations. The bundled source set now includes method-specific doc pages and usage examples for the combined-shipping operations in this package.
- Auction API bidder activity now lives fully in this package. Use `itemBiddingActivity` for listing-scoped auction inspection (`GetAllBidders`) and `userBiddingActivity` for current-user bidding history (`GetBidderList`).
- `GetAccount` remains migration-relevant even when the Finances API is used. For EU- or UK-domiciled sellers, the guide requires digital signatures for Finances API calls and for the traditional `GetAccount` call itself.

## Navigation

- Use [INDEX.md](INDEX.md) for the fast operation lookup table.
- Use [INTENTS.md](INTENTS.md) for task-based navigation.
- Use [references/operation-mapping.md](references/operation-mapping.md) for the canonical traditional-to-modern migration narrative.
- Use [rules/user-retrieval-and-preferences.md](rules/user-retrieval-and-preferences.md) for scope, privacy, and dual-target guidance.
- Use [rules/store-category-task-monitoring.md](rules/store-category-task-monitoring.md) for asynchronous store-category updates.
- Use [rules/finances-digital-signatures.md](rules/finances-digital-signatures.md) for signature-sensitive finance workflows.
- Use [rules/sales-tax-split-crud.md](rules/sales-tax-split-crud.md) for tax-table split mappings.
- Use [rules/shipping-discount-rule-splits.md](rules/shipping-discount-rule-splits.md) for combined-shipping-rule migrations.

## Evidence Boundaries

- The bundled source set contains full traditional API doc extracts for all in-domain traditional operations.
- Modern doc pages and examples are available for the User API, Identity API, Stores API, Finances API, and Auction API targets used here.
- Modern REST doc pages and usage examples are also bundled for the Account API v1 sales-tax operations and the Account API v2 user-preference and combined-shipping operations used here.
- Some bundled modern usage examples intentionally end at HTTP `204 No Content` or omit a sample response body. This package preserves those source limits instead of inventing extra payloads.
- `GetUserContactDetails` remains visible because the authoritative CSV keeps it in Account Management as an explicit `No replacement` outcome.

## Field-Level Details

Field-level request and response details and field-by-field mapping are not provided in this skill, even if explicitly requested. For field definitions, refer to the official eBay developer documentation page.
