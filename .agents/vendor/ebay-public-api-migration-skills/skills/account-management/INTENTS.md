# Account Management Intent Guide

Use this file when the migration task is easier to describe by business goal than by traditional operation name.

Answer rule:

- When the selected `references/operation-mapping.md` entry includes guide-derived `Migration Guide:` bullets such as `Key changes`, `Key things to know`, prerequisites, sequencing, or caveats, include those points in the answer instead of returning only the replacement name.

## Intent: Retrieve User Identity Or Account Profile

When to use:

- You are migrating `GetUser`.
- You need authenticated user profile data, seller profile data, or scope-dependent identity fields.

Recommended workflow:

1. Start in [INDEX.md](INDEX.md) to confirm whether the caller needs GraphQL `user` or Identity REST `getUser`.
2. Read [rules/user-retrieval-and-preferences.md](rules/user-retrieval-and-preferences.md) for scope, privacy, and target-selection rules.
3. Open [references/operation-mapping.md](references/operation-mapping.md#identity-and-user-profile) for the concrete payload transformation and support-file links.

Navigate next:

- [references/operations/GetUser_doc.md](references/operations/GetUser_doc.md)
- [references/operations/user_doc.md](references/operations/user_doc.md)
- [references/operations/getUser_rest_doc.md](references/operations/getUser_rest_doc.md)

## Intent: Review Or Update User Preferences

When to use:

- You are migrating `GetUserPreferences` or `SetUserPreferences`.
- You need seller preference flags, business-policy preference visibility, or account-preference updates.

Recommended workflow:

1. Use [INDEX.md](INDEX.md) to confirm the Account API v2 endpoint.
2. Read [rules/user-retrieval-and-preferences.md](rules/user-retrieval-and-preferences.md) for preference-group, partial-update, and marketplace-header guidance.
3. Use [references/operation-mapping.md](references/operation-mapping.md#preference-and-account-settings) for request/response transformation notes.

Navigate next:

- [references/operations/GetUserPreferences_doc.md](references/operations/GetUserPreferences_doc.md)
- [references/operations/SetUserPreferences_doc.md](references/operations/SetUserPreferences_doc.md)
- [references/operations/getUserPreferences_rest_doc.md](references/operations/getUserPreferences_rest_doc.md)
- [references/operations/getUserPreferences_rest_example.md](references/operations/getUserPreferences_rest_example.md)
- [references/operations/setUserPreferences_rest_doc.md](references/operations/setUserPreferences_rest_doc.md)
- [references/operations/setUserPreferences_rest_example.md](references/operations/setUserPreferences_rest_example.md)

## Intent: Manage Store Profile Or Store Categories

When to use:

- You are migrating `GetStore`, `GetStoreCategoryUpdateStatus`, or `SetStoreCategories`.
- You need to read store details, list store categories, or track asynchronous category updates.

Recommended workflow:

1. Start with [INDEX.md](INDEX.md) to choose the correct Stores API operation.
2. Read [rules/store-category-task-monitoring.md](rules/store-category-task-monitoring.md) for sync-versus-async behavior and action splitting.
3. Use [references/operation-mapping.md](references/operation-mapping.md#store-profile-and-category-management) for the concrete split mapping.

Navigate next:

- [references/operations/GetStore_doc.md](references/operations/GetStore_doc.md)
- [references/operations/GetStoreCategoryUpdateStatus_doc.md](references/operations/GetStoreCategoryUpdateStatus_doc.md)
- [references/operations/SetStoreCategories_doc.md](references/operations/SetStoreCategories_doc.md)

## Intent: Retrieve Billing Or Transaction History

When to use:

- You are migrating `GetAccount`.
- You need billing-fee views, transaction ledgers, order-linked financial data, or payout-adjacent context.

Recommended workflow:

1. Confirm the split mapping in [INDEX.md](INDEX.md).
2. Read [rules/finances-digital-signatures.md](rules/finances-digital-signatures.md) before implementation if EU/UK seller domicile is possible.
3. Use [references/operation-mapping.md](references/operation-mapping.md#billing-and-tax-settings) for example request and response shapes.

Navigate next:

- [references/operations/GetAccount_doc.md](references/operations/GetAccount_doc.md)
- [references/operations/getBillingActivities_doc.md](references/operations/getBillingActivities_doc.md)
- [references/operations/getTransactions_doc.md](references/operations/getTransactions_doc.md)

## Intent: Retrieve Or Update Sales Tax Tables

When to use:

- You are migrating `GetTaxTable` or `SetTaxTable`.
- You need a country-level table, a jurisdiction lookup, a single-jurisdiction update, or a bulk update.

Recommended workflow:

1. Read [rules/sales-tax-split-crud.md](rules/sales-tax-split-crud.md) to choose between country, jurisdiction, single-update, and bulk-update paths.
2. Use [references/operation-mapping.md](references/operation-mapping.md#billing-and-tax-settings) for payload transformation notes.
3. Use the support files for exact examples where they exist.

Navigate next:

- [references/operations/GetTaxTable_doc.md](references/operations/GetTaxTable_doc.md)
- [references/operations/SetTaxTable_doc.md](references/operations/SetTaxTable_doc.md)
- [references/operations/getSalesTax_example.md](references/operations/getSalesTax_example.md)
- [references/operations/getSalesTaxes_example.md](references/operations/getSalesTaxes_example.md)
- [references/operations/bulkCreateOrReplaceSalesTax_example.md](references/operations/bulkCreateOrReplaceSalesTax_example.md)
- [references/operations/createOrReplaceSalesTax_example.md](references/operations/createOrReplaceSalesTax_example.md)

## Intent: Migrate Shipping Discount Rules

When to use:

- You are migrating `GetShippingDiscountProfiles` or `SetShippingDiscountProfiles`.
- You need to split flat, calculated, promotional, or combined-payment discount management into Account API v2 operations.

Recommended workflow:

1. Read [rules/shipping-discount-rule-splits.md](rules/shipping-discount-rule-splits.md) to choose the modern rule-specific operation.
2. Use [references/operation-mapping.md](references/operation-mapping.md#shipping-discount-programs) for the endpoint inventory and split-mapping guidance.
3. Use the bundled modern doc and example files to select the exact request body by rule type and to preserve the documented `204 No Content` success behavior.

Navigate next:

- [references/operations/GetShippingDiscountProfiles_doc.md](references/operations/GetShippingDiscountProfiles_doc.md)
- [references/operations/SetShippingDiscountProfiles_doc.md](references/operations/SetShippingDiscountProfiles_doc.md)
- [references/operations/getCombinedShippingRules_doc.md](references/operations/getCombinedShippingRules_doc.md)
- [references/operations/getCombinedShippingRules_example.md](references/operations/getCombinedShippingRules_example.md)
- [references/operations/createCalculatedShippingRules_doc.md](references/operations/createCalculatedShippingRules_doc.md)
- [references/operations/createCalculatedShippingRules_example.md](references/operations/createCalculatedShippingRules_example.md)
- [references/operations/createFlatShippingRules_example.md](references/operations/createFlatShippingRules_example.md)
- [references/operations/createPromotionalShippingRule_example.md](references/operations/createPromotionalShippingRule_example.md)
- [references/operations/updateCalculatedShippingRules_example.md](references/operations/updateCalculatedShippingRules_example.md)
- [references/operations/updateCombinedPayments_example.md](references/operations/updateCombinedPayments_example.md)
- [references/operations/updateFlatShippingRules_example.md](references/operations/updateFlatShippingRules_example.md)
- [references/operations/updatePromotionalShippingRule_example.md](references/operations/updatePromotionalShippingRule_example.md)

## Intent: Confirm A Call Has No Safe Replacement

When to use:

- You are reviewing `GetUserContactDetails`.
- You need to preserve a removal or deprecation outcome without inventing a replacement.

Recommended workflow:

1. Confirm the status in [INDEX.md](INDEX.md).
2. Read the matching entry in [references/operation-mapping.md](references/operation-mapping.md#identity-and-user-profile).
3. Keep the migration output explicit about `No replacement` and the privacy reason behind that outcome.

Navigate next:

- [references/operations/GetUserContactDetails_doc.md](references/operations/GetUserContactDetails_doc.md)

## Intent: Inspect Auction Listing Bidder Activity (Traditional GetAllBidders)

When to use:

- You are migrating `GetAllBidders`.
- You need bidder activity for one active or recently ended auction listing.

Recommended workflow:

1. Confirm the mapping in [INDEX.md](INDEX.md).
2. Use [references/operation-mapping.md](references/operation-mapping.md#bidder-and-buying-activity) to compare listing-scoped `itemBiddingActivity` with user-scoped `userBiddingActivity`.
3. Build the GraphQL selection set around the bidder detail level your seller workflow actually used.

Navigate next:

- [references/operations/GetAllBidders_doc.md](references/operations/GetAllBidders_doc.md)
- [references/operations/itemBiddingActivity_doc.md](references/operations/itemBiddingActivity_doc.md)
- [references/operations/itemBiddingActivity_example.md](references/operations/itemBiddingActivity_example.md)

## Intent: Retrieve Bidding Activity (Traditional GetBidderList)

When to use:

- You are migrating `GetBidderList`.
- You need items the user is bidding on, or has won/purchased.

Recommended workflow:

1. Confirm the mapping in [INDEX.md](INDEX.md).
2. Use [references/operation-mapping.md](references/operation-mapping.md#bidder-and-buying-activity) to see the high-level payload transformation and choose the user-scoped query rather than the listing-scoped one.
3. Implement the GraphQL selection set based on which traditional response fields your integration actually used.

Navigate next:

- [references/operations/GetBidderList_doc.md](references/operations/GetBidderList_doc.md)
- [references/operations/userBiddingActivity_doc.md](references/operations/userBiddingActivity_doc.md)
- [references/operations/userBiddingActivity_example.md](references/operations/userBiddingActivity_example.md)

## Intent: Create/Update/Delete Private User Notes (Traditional SetUserNotes)

When to use:

- You are migrating `SetUserNotes`.
- You need to store private notes for items or order line items.

Recommended workflow:

1. Confirm the split mapping in [INDEX.md](INDEX.md).
2. Use [references/operation-mapping.md](references/operation-mapping.md#user-notes) to choose the correct mutation.
3. Copy the request patterns from the bundled GraphQL examples.

Navigate next:

- [references/operations/SetUserNotes_doc.md](references/operations/SetUserNotes_doc.md)
- [references/operations/createOrReplaceUserNote_example.md](references/operations/createOrReplaceUserNote_example.md)
- [references/operations/deleteUserNote_example.md](references/operations/deleteUserNote_example.md)