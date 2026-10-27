---
name: listing-management
description: |
  Migration guidance for traditional listing lifecycle operations to Listing API (GraphQL), Media API, and Leads API.

  Trigger when user mentions: AddItem/AddFixedPriceItem/AddItems -> createListing; VerifyAddItem/VerifyAddFixedPriceItem/VerifyRelistItem/VerifyAddSecondChanceItem -> VALIDATE mode; ReviseItem/ReviseFixedPriceItem/RelistItem/RelistFixedPriceItem/EndItem/EndFixedPriceItem/EndItems -> update, relist, or end flows; GetItem/GetSellerList/GetSellerEvents/GetMyeBaySelling -> seller listing retrieval; UploadSiteHostedPictures -> Media API; or asks "how do I migrate traditional listing calls".

  Covers 24 traditional operations including create, verify, revise, relist, end, seller retrieval, image upload, and explicit decommission or no-replacement rows.
  Do NOT use for category or taxonomy metadata work or for post-order workflows.
---

# Listing Management

Use this skill when the migration task belongs to the canonical `Listing Management` domain in `sources/api-mapping/listing-management.csv`. This package now covers the full domain inventory instead of only the Listing API subset.

## What This Skill Covers

- Listing API GraphQL create, validate, revise, relist, end, seller retrieval/search, second-chance, and focused inventory update flows.
- Media API REST image-upload migration for `UploadSiteHostedPictures`.
- No-replacement and decommissioned Listing Management rows such as `ExtendSiteHostedPictures` and `GetDescriptionTemplates`.
- Fallback guidance for `AddToItemDescription` through full-description replacement with `updateListing`.

## Key Migration Patterns

- `VerifyAddFixedPriceItem`, `VerifyAddItem`, `VerifyRelistItem`, and `VerifyAddSecondChanceItem` become the execute mutation plus `options.operationMode=VALIDATE`.
- `AddItem`, `AddFixedPriceItem`, and `AddItems` converge on `createListing`, but traditional batch creation behavior from `AddItems` becomes orchestration around repeated modern calls.
- `ReviseItem` and `ReviseFixedPriceItem` converge on `updateListing` for broader listing revisions, while `ReviseInventoryStatus` stays a dedicated `bulkUpdateInventory` path for price-and-quantity-only changes.
- `VerifyRelistItem`, `RelistItem`, and `RelistFixedPriceItem` stay on the `relistListing` path; do not fall back to generic `createListing` wording when the task is explicitly a relist flow.
- `UploadSiteHostedPictures` is a split REST migration: create the EPS asset with `createImageFromFile` or `createImageFromUrl`, then retrieve metadata with `getImage` when needed.
- `AddToItemDescription` has no validated direct parity replacement in this package; when approximation is required, use `updateListing` only as full-description replacement guidance.
- `ExtendSiteHostedPictures` remains explicitly decommissioned with no replacement in the authoritative inventory.
- `GetSellerEvents` maps to `sellerListingSearch`, where date-window filters stay visible and the response groups matches into `activeListings`, `endedListings`, and `scheduledListings` with pagination instead of returning a traditional event container.
- `GetDescriptionTemplates` remains visible in scope as a no-replacement outcome rather than disappearing from the migration inventory.

## Workflow Notes

- Start with `INDEX.md` to confirm the exact traditional operation, its status, and whether it is validated, fallback-only, or decommissioned.
- Use `references/operation-mapping.md` for the authoritative per-operation mapping narrative.
- Use `references/operations/` when you need bundled traditional extracts, modern doc extracts, or example payload files.
- Apply `rules/mode-verify-to-validate.md` for verify flows, `rules/full-replacement-arrays.md` for revise or relist array updates, `rules/inventory-bulk-update.md` when the task is only price and quantity updates, `rules/field-end-listing.md` for end reasons, and `rules/variation-to-items.md` for multi-variation create flows.
- Keep seller retrieval split between direct listing lookup (`sellerListings`) and filtered listing search (`sellerListingSearch`) instead of collapsing everything into one query.

## Transport And Auth Notes

- Listing API mappings in this package are GraphQL and follow the serialized `query` / `mutation` plus variables pattern described in the common GraphQL guidance.
- Media API image-upload mappings in this package are REST and follow standard HTTP method, path, header, and JSON or multipart request conventions.
- Seller-side Listing API operations use `https://api.ebay.com/oauth/api_scope/sell.listing` or `https://api.ebay.com/oauth/api_scope/sell.listing.read` scopes as documented in the bundled Listing API GraphQL pages.

## Open Items

- Media API image method docs are now backed by bundled local REST doc pages plus local examples for the core `UploadSiteHostedPictures` split methods.

## Navigation

- Use `INDEX.md` for the full Listing Management operation table.
- Use `INTENTS.md` for task-oriented workflows.
- Use `references/operation-mapping.md` for the canonical operation-level mapping narrative.
- Use `references/operations/` for supporting traditional-side and modern-side doc and example files.
- Use `rules/` for recurring Listing API lifecycle patterns that still apply within the broader Listing Management domain.

## Field-Level Details

Field-level request and response details and field-by-field mapping are not provided in this skill, even if explicitly requested. For field definitions, refer to the official eBay developer documentation page.
