# Marketplace Metadata Refresh

Use this rule when replacing `GeteBayDetails` or planning metadata refresh jobs.

## Rule

Pull only the specific metadata slices the application uses, and refresh them on a schedule instead of expecting one monolithic site-metadata payload.

## Recommended Replacement Split

- `getCurrencies` for currency metadata
- `getHandlingTimes` for dispatch-time metadata
- `getExcludeShippingLocations` for excluded ship-to locations
- `getShippingCarriers` for carrier metadata
- `getShippingLocations` for supported shipping destinations
- `getShippingServices` for service and package-related shipping options

## Related Taxonomy Context

- Use `getDefaultCategoryTreeId` only when the old workflow needed category-tree bootstrap for a marketplace.
- Do not present `getDefaultCategoryTreeId` as a validated one-to-one replacement for the full `SiteDetails` container.

## SiteDetails Judgment Boundary

- Keep `SiteDetails -> getDefaultCategoryTreeId` visible when answering `GeteBayDetails`, because the current package sources explicitly keep that mapping in scope.
- Describe `getDefaultCategoryTreeId` as the Taxonomy bootstrap call for marketplace and category-tree identity.
- Do not say that `SiteDetails` has no modern mapping if the question is about marketplace/category-tree identity.
- Do not expand `getDefaultCategoryTreeId` into full field-for-field parity for every historical `SiteDetails` field.
- If the traditional use case depends on other `SiteDetails` subfields, state that additional parity is not validated in this package and should be confirmed separately.

## Refresh Guidance

- Refresh on a documented cadence appropriate to the consuming workflow, and verify any fixed schedule against current public documentation.
- Use marketplace-scoped refresh jobs rather than one global SOAP snapshot.

## Non-Migrated DetailName Groups

The Listing Metadata guide explicitly calls out several `GeteBayDetails` groups that are not carried forward as direct modern API lookups, including:
- buyer requirement details
- country and timezone reference data
- item-specific and variation rule data that are now treated as stable documentation rather than dynamic API metadata
- listing designer and other retired listing-feature details
- region IDs and other no-longer-applicable metadata groups

## Why This Matters

- `GeteBayDetails` used broad `DetailName` filters and SOAP site headers.
- Modern APIs are resource-specific and path-parameter driven.
- Explicit refresh boundaries reduce unnecessary calls and make decommissioned metadata visible instead of silently disappearing.

## Common Failure Modes

- Expecting one modern endpoint to return the full old site-metadata envelope
- Saying `SiteDetails` has no mapping even though this package keeps `getDefaultCategoryTreeId` in scope for that slice
- Presenting `getDefaultCategoryTreeId` as if it fully replaces the entire historical `SiteDetails` container
- Treating documentation-only or retired metadata groups as if a hidden REST replacement must exist
- Forgetting that many modern methods use marketplace path parameters instead of a traditional header
