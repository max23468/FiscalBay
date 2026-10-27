# Listing Management Intents

Use this file when the migration problem is easier to describe as a task than as a single traditional operation lookup.

Answer rule:

- When the selected `references/operation-mapping.md` entry includes guide-derived `Migration Guide:` bullets such as `Key changes`, `Key things to know`, prerequisites, sequencing, or caveats, include those points in the answer instead of returning only the replacement name.

## Intent: Migrate Listing Creation Or Verification

When to use it:

- You are converting `AddItem`, `AddFixedPriceItem`, `AddItems`, `VerifyAddItem`, or `VerifyAddFixedPriceItem`.

Recommended workflow:

1. Check `INDEX.md` to confirm whether the traditional call is create or verify.
2. Load `references/operation-mapping.md` under `Create and validate listings`.
3. Use `rules/mode-verify-to-validate.md` for verify handling.
4. Use `rules/variation-to-items.md` when the listing contains multiple variations.
5. Open the matching traditional-side and modern-side files in `references/operations/` if you need payload examples.

Navigate next:

- `references/operation-mapping.md`
- `references/operations/VerifyAddItem_doc.md`
- `references/operations/createListing_doc.md`
- `rules/mode-verify-to-validate.md`
- `rules/variation-to-items.md`

## Intent: Migrate Listing Image Uploads

When to use it:

- You are converting `UploadSiteHostedPictures`.

Recommended workflow:

1. Start in `INDEX.md` to confirm that the traditional call is a REST split migration rather than a one-call GraphQL replacement.
2. Use `references/operation-mapping.md` under the media/image-upload section.
3. Decide whether your source integration is uploading a local file or referencing an externally hosted image URL.
4. Use `createImageFromFile` for direct uploads, `createImageFromUrl` for externally hosted images, and `getImage` when you need to retrieve or persist the returned EPS metadata.
5. Open the supporting traditional and modern operation files in `references/operations/` for the exact REST method, required scope, and EPS image retrieval details.

Navigate next:

- `references/operation-mapping.md`
- `references/operations/UploadSiteHostedPictures_doc.md`
- `references/operations/createImageFromFile_doc.md`
- `references/operations/createImageFromUrl_doc.md`
- `references/operations/getImage_doc.md`

## Intent: Handle Description Fallback Or Full Revise

When to use it:

- You are converting `AddToItemDescription`, `ReviseItem`, or `ReviseFixedPriceItem`.

Recommended workflow:

1. Decide whether the traditional task is fallback description replacement or a full revise flow.
2. Use `updateListing` for general revisions, and use it as fallback guidance when approximating `AddToItemDescription`.
3. Treat `AddToItemDescription` as fallback full description replacement guidance rather than append-only behavior or validated direct parity.
4. Apply `rules/full-replacement-arrays.md` when any array-shaped field changes.
5. Open the per-operation examples in `references/operations/` when you need a short before-and-after snippet.

Navigate next:

- `references/operation-mapping.md`
- `references/operations/AddToItemDescription_doc.md`
- `references/operations/updateListing_doc.md`
- `rules/full-replacement-arrays.md`

## Intent: Relist Or Validate Relist

When to use it:

- You are converting `VerifyRelistItem`, `RelistItem`, or `RelistFixedPriceItem`.

Recommended workflow:

1. Map all three flows to `relistListing`.
2. Add `options.operationMode=VALIDATE` when the source call is `VerifyRelistItem`.
3. Rebuild array-shaped fields as full replacements when the relist payload changes images, aspects, or variation data.
4. Preserve the lifecycle note that a successful relist receives a new listing identifier.

Navigate next:

- `references/operation-mapping.md`
- `references/operations/VerifyRelistItem_doc.md`
- `references/operations/relistListing_doc.md`
- `rules/mode-verify-to-validate.md`
- `rules/full-replacement-arrays.md`
- `rules/listing-lifecycle-restrictions.md`

## Intent: Apply Focused Inventory Updates

When to use it:

- You are converting `ReviseInventoryStatus` and only need price or quantity updates.

Recommended workflow:

1. Confirm that the task is limited to price and quantity.
2. Use `bulkUpdateInventory` instead of `updateListing`.
3. Move back to general revise guidance if the change touches title, description, category, images, or aspects.

Navigate next:

- `references/operation-mapping.md`
- `references/operations/ReviseInventoryStatus_doc.md`
- `references/operations/bulkUpdateInventory_doc.md`
- `rules/inventory-bulk-update.md`

## Intent: End A Listing

When to use it:

- You are converting `EndItem`, `EndFixedPriceItem`, or `EndItems`.

Recommended workflow:

1. Normalize the request to `endListing`.
2. Preserve the listing identifier and explicit end reason.
3. Treat `EndItems` as orchestration around repeated modern calls.
4. Open the modern example file if you need the new identifier and reason shape.

Navigate next:

- `references/operation-mapping.md`
- `references/operations/endListing_example.md`
- `rules/field-end-listing.md`

## Intent: Retrieve Or Search Seller Listings

When to use it:

- You are converting `GetItem`, `GetMyeBaySelling`, `GetSellerList`, or `GetSellerEvents` for seller-side listing retrieval or search.

Recommended workflow:

1. Confirm the task is seller-side retrieval or seller-side listing search, not buyer discovery.
2. Use `sellerListings` for direct lookup of one known listing.
3. Use `sellerListingSearch` when the traditional flow searched across active, ended, scheduled, or recently modified listings.
4. Preserve the relevant filters from the SOAP call, such as listing IDs, SKUs, category filters, pagination, sort, or start/end/modified time windows.
5. Use the supporting operation files when you need query-shape examples, branch-level `searchInput` patterns, filter notes, or seller-auth scope details.

Navigate next:

- `references/operation-mapping.md`
- `references/operations/GetItem_doc.md`
- `references/operations/GetMyeBaySelling_doc.md`
- `references/operations/GetSellerList_doc.md`
- `references/operations/GetSellerEvents_doc.md`
- `references/operations/sellerListings_example.md`
- `references/operations/sellerListingSearch_example.md`

## Intent: Migrate Second-Chance Listing Flows

When to use it:

- You are converting `VerifyAddSecondChanceItem` or `AddSecondChanceItem`.

Recommended workflow:

1. Use `createSecondChanceListing` as the modern target.
2. Preserve listing identity, recipient user, duration, and optional seller message.
3. Use `VALIDATE` mode for verify flows.
4. Keep execution and validation on the same mutation boundary.

Navigate next:

- `references/operation-mapping.md`
- `references/operations/VerifyAddSecondChanceItem_doc.md`
- `references/operations/createSecondChanceListing_doc.md`
- `rules/mode-verify-to-validate.md`

## Intent: Handle No-Replacement Or Decommissioned Rows

When to use it:

- You are evaluating `ExtendSiteHostedPictures`, `GetDescriptionTemplates` or fallback-only `AddToItemDescription` behavior.

Recommended workflow:

1. Confirm the row status in `INDEX.md` before designing code changes.
2. Distinguish `No replacement`, `Decommission`, and fallback-only guidance instead of flattening them into one category.
3. Preserve the removal reason and any remaining workaround notes from `references/operation-mapping.md`.
4. Avoid inventing direct modern parity for features that were intentionally removed from the canonical inventory.

Navigate next:

- `INDEX.md`
- `references/operation-mapping.md`
- `references/operations/GetDescriptionTemplates_doc.md`
- `references/operations/AddToItemDescription_doc.md`

## Intent: Plan A Full Listing Management Migration

When to use it:

- You are building a migration plan for the full canonical Listing Management domain.

Recommended workflow:

1. Enumerate the exact traditional operations and confirm they all exist in `INDEX.md`.
2. Separate the work into image upload, create/verify, revise, relist, end, seller retrieval/search, second-chance, bidder activity, negotiation history, and decommissioned/no-replacement tracks.
3. Keep `AddToItemDescription` in a fallback track rather than treating it as direct parity.

Navigate next:

- `INDEX.md`
- `references/operation-mapping.md`
- `rules/`

## Intent: Find Operation-Level Detail Or Payload Evidence

When to use it:

- You already know the mapped operation and want the shortest path to a supporting doc summary or example payload.

Recommended workflow:

1. Start in `references/operation-mapping.md` to confirm the mapping and the right grouped workflow section.
2. Open the matching traditional-side `_doc.md` or `_example.md` file for the source call.
3. Open the shared modern-side `_doc.md` or `_example.md` file for the target operation.
4. Cross-check `rules/` only when a behavior note mentions validation mode, array replacement, bulk inventory updates, or end reasons.

Navigate next:

- `INDEX.md`
- `references/operation-mapping.md`
- `references/operations/`
- `rules/`
