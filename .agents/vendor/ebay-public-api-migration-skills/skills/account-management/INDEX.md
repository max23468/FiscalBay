# Account Management Operation Index

Validated lookup for Account Management traditional operations and their modern replacements.

## Validated Mappings

| Traditional operation | Status | Modern API family | Modern operation or endpoint | Notes |
| --- | --- | --- | --- | --- |
| `GetUser` | `GraphQL + REST` | User API; Identity API | `user` query; `GET /commerce/identity/v1/user/` | Use GraphQL for scope-shaped user data or REST for authenticated account profile retrieval. |
| `GetUserContactDetails` | `No replacement` | None | No replacement | Retrieving another user's PII is not supported in modern public APIs. |
| `GetUserPreferences` | `REST` | Account API v2 | `GET /sell/account/v2/user_preferences` | Bundled modern doc extract and usage example are available. |
| `SetUserPreferences` | `REST` | Account API v2 | `PATCH /sell/account/v2/user_preferences` | Bundled modern doc extract and usage example are available. |
| `GetStore` | `REST` | Stores API | `GET /sell/stores/v1/store`; `GET /sell/stores/v1/store/categories` | One traditional read flow splits across store-profile and store-category reads. |
| `GetStoreCategoryUpdateStatus` | `REST` | Stores API | `GET /sell/stores/v1/store/tasks/{task_id}`; `GET /sell/stores/v1/store/tasks` | Use task-by-id or task-collection retrieval depending on workflow. |
| `SetStoreCategories` | `REST` | Stores API | `addStoreCategory`; `moveStoreCategory`; `renameStoreCategory`; `deleteStoreCategory` | One SOAP action container becomes one action-specific REST call. |
| `GetAccount` | `REST` | Finances API | `getBillingActivities`; `getTransactions` | Finances flows may require digital signatures for EU/UK sellers. |
| `GetTaxTable` | `REST` | Account API v1 | `getSalesTax`; `getSalesTaxes` | Split between a single jurisdiction and a country-level tax table, with bundled doc extracts and examples for both reads. |
| `SetTaxTable` | `REST` | Account API v1 | `bulkCreateOrReplaceSalesTax`; `createOrReplaceSalesTax` | Split between batch and single-jurisdiction updates, with bundled doc extracts and examples for both writes. |
| `GetShippingDiscountProfiles` | `REST` | Account API v2 | `getCombinedShippingRules` | Bundled modern doc extract and usage example are available. |
| `SetShippingDiscountProfiles` | `REST` | Account API v2 | `createCalculatedShippingRules`; `createFlatShippingRules`; `createPromotionalShippingRule`; `updateCalculatedShippingRules`; `updateCombinedPayments`; `updateFlatShippingRules`; `updatePromotionalShippingRule` | Traditional discount-profile maintenance splits across rule-type-specific and combined-payment operations. |
| `GetAllBidders` | `GraphQL` | Auction API | `itemBiddingActivity` | listing-scoped auction bidder activity now lives in Account Management with the rest of the Auction API family. |
| `GetBidderList` | `GraphQL` | Auction API | `userBiddingActivity` | traditional bidder list is replaced by a GraphQL query; select fields based on traditional usage. |
| `SetUserNotes` | `GraphQL` | User Note API | `createOrReplaceUserNote`; `deleteUserNote` | Traditional Action `AddOrUpdate` vs `Delete` becomes two mutations. |

## Notes

- `GetUser` is the only in-domain operation with both GraphQL and REST targets in the authoritative CSV.
- `GetUserContactDetails` has no validated modern replacement because the traditional call exposes another user's PII.
- `SetTaxTable` and `SetShippingDiscountProfiles` are split migrations. Select the modern operation by update scope rather than trying to mirror the SOAP container one-for-one.
- Auction API bidder-activity mappings for both listing-scoped and user-scoped retrieval are bundled locally in this package.
- Account API v1/v2 preference, sales-tax, and combined-shipping rows now have bundled modern doc extracts and usage examples in this package.
- `GetAccount` and the mapped Finances API calls should be reviewed together with [rules/finances-digital-signatures.md](rules/finances-digital-signatures.md).