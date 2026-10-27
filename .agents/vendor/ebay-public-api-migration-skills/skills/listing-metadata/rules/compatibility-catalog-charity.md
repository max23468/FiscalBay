# Compatibility Catalog Charity

Use this rule when migrating motors compatibility, product discovery, catalog lookup, or charity discovery flows.

## Compatibility Rule

Split compatibility work into three layers:
1. Category support: use `getAutomotivePartsCompatibilityPolicies` to confirm whether the leaf category supports compatibility data.
2. Compatibility-property discovery: use `getCompatibilityPropertyNames`, `getCompatibilityPropertyValues`, or `getMultiCompatibilityPropertyValues` to build guided fitment selections.
3. Product-to-compatibility lookup: use `getProductCompatibilities` when you already have a product identity and need associated compatibility details.

## Catalog Rule

- Use `search` to find candidate products and ePIDs.
- Use `getProduct` to confirm the final product record.
- Keep `ProductDetails` marked as decommissioned even though Catalog endpoints are available for adjacent lookup workflows.

## Charity Rule

- Use `getCharityOrgs` to search for supported charities.
- Use `getCharityOrg` to confirm a specific organization.
- Keep `GetCharities` marked as decommissioned; modern charity endpoints support discovery but do not change the CSV status.

## No-Replacement Rule

For these traditional operations, keep the gap explicit and do not invent a replacement:
- `findProductsByCompatibility`
- `addProducts`
- `getProductMetadataBulk`
- `getProductSearchDataVersion`
- `getProductSearchNames`
- `getProductSearchValues`
- `getProductSearchValuesBulk`
- `getProductSubmissions`

## Fallback Rule

- `getCompatibilitySearchDataVersion` has no direct replacement, but the migration mapping used by this package points to `metadataVersion` values returned by compatibility value methods as the fallback signal.
- Treat that as a note, not as a true one-to-one replacement.

## Common Failure Modes

- Jumping straight to product compatibility lookup without first confirming category support
- Assuming every deprecated Product Metadata Service call has a hidden Catalog or Metadata equivalent
- Converting a decommissioned mapping row into a fully supported replacement just because a related modern endpoint exists
