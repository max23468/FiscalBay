# Listing Management Index

This table is the authoritative lookup for the full canonical `Listing Management` inventory.

## Main Table

| Traditional operation | Status | Modern API family | Modern operation | Notes |
| --- | --- | --- | --- | --- |
| UploadSiteHostedPictures | REST | Media API | `createImageFromFile`, `createImageFromUrl`, `getImage` | Split migration: create EPS-backed image assets, then retrieve stored image metadata as needed. |
| ExtendSiteHostedPictures | Decommission | No replacement | No replacement | Keep the traditional operation visible as decommissioned; the authoritative bundled inventory documents no replacement. |
| GetDescriptionTemplates | No replacement | No replacement | No replacement | Listing Designer templates are no longer supported. |
| VerifyAddFixedPriceItem | GraphQL | Listing API | `createListing` | Use `options.operationMode=VALIDATE`. |
| VerifyAddItem | GraphQL | Listing API | `createListing` | Use `options.operationMode=VALIDATE`. |
| AddFixedPriceItem | GraphQL | Listing API | `createListing` | Fixed-price creation converges on one mutation. |
| AddItem | GraphQL | Listing API | `createListing` | Listing creation converges on one mutation. |
| AddItems | GraphQL | Listing API | `createListing` | Traditional batch create becomes repeated modern calls or orchestration. |
| AddToItemDescription | No replacement | Listing API | `updateListing` fallback only | No validated direct parity replacement; approximate only by sending the final full description instead of append-only text. |
| VerifyRelistItem | GraphQL | Listing API | `relistListing` | Use `options.operationMode=VALIDATE`. |
| RelistFixedPriceItem | GraphQL | Listing API | `relistListing` | Fixed-price relist converges on one mutation. |
| RelistItem | GraphQL | Listing API | `relistListing` | Stay on the relist path, not generic `createListing` guidance; relist flows converge on one mutation. |
| ReviseFixedPriceItem | GraphQL | Listing API | `updateListing` | Use for broader fixed-price listing revision; `ReviseInventoryStatus` remains the price-and-quantity-only path. Arrays behave as full replacements. |
| ReviseItem | GraphQL | Listing API | `updateListing` | Send changed top-level fields; replace arrays fully. |
| ReviseInventoryStatus | GraphQL | Listing API | `bulkUpdateInventory` | Dedicated price and quantity update path. |
| EndFixedPriceItem | GraphQL | Listing API | `endListing` | Requires identifier and end reason. |
| EndItem | GraphQL | Listing API | `endListing` | Requires identifier and end reason. |
| EndItems | GraphQL | Listing API | `endListing` | `endListing` is one-listing-per-operation initially; bulk end becomes orchestration or a Sell Feed API flow. |
| GetItem | GraphQL | Listing API | `sellerListings` | Seller-side retrieval is the validated replacement for this domain. |
| VerifyAddSecondChanceItem | GraphQL | Listing API | `createSecondChanceListing` | Use `options.operationMode=VALIDATE`. |
| AddSecondChanceItem | GraphQL | Listing API | `createSecondChanceListing` | Second-chance flow converges on one mutation. |
| GetMyeBaySelling | GraphQL | Listing API | `sellerListingSearch` | Use active, ended, and scheduled search branches instead of My eBay buckets. |
| GetSellerList | GraphQL | Listing API | `sellerListingSearch` | Start or end time windows, category, SKU, and pagination filters become search input criteria. |
| GetSellerEvents | GraphQL | Listing API | `sellerListingSearch` | Start, end, or modified time event windows become seller-side listing search filters, and results come back in grouped `activeListings`, `endedListings`, and `scheduledListings` arrays with pagination. |

## Coverage Notes

- The canonical Listing Management inventory contains 24 unique traditional operations.
- The main table covers validated GraphQL and REST mappings, fallback guidance, no-replacement outcomes, and decommissioned rows that must remain visible.
- Detailed doc and example assets for traditional and modern operations live under `references/operations/`.
