# Listing Metadata Intents

Answer rule:

- When the selected `references/operation-mapping.md` entry includes guide-derived `Migration Guide:` bullets such as `Key changes`, `Key things to know`, prerequisites, sequencing, or caveats, include those points in the answer instead of returning only the replacement name.

## Migrate Site-Level Metadata

When to use it:
- You are replacing `GeteBayDetails` or one of its `DetailName` slices.

Recommended workflow:
1. Identify which old metadata group is actually needed: currencies, handling times, shipping services, shipping carriers, shipping locations, or excluded shipping locations.
2. If the old workflow mentions `SiteDetails`, keep the source-backed `getDefaultCategoryTreeId` mapping visible, but explain that it is the Taxonomy bootstrap call for marketplace/category-tree identity and not full parity for every historical `SiteDetails` field.
3. Use `INDEX.md` to confirm the split modern operations.
4. Read `rules/marketplace-metadata-refresh.md` for refresh cadence, marketplace parameter rules, and non-migrated metadata groups.
5. Use `references/operation-mapping.md` and the supporting `get*` operation files under `references/operations/`.

Navigate next:
- `rules/marketplace-metadata-refresh.md`
- `references/operation-mapping.md`

## Split GetCategories Into Taxonomy Steps

When to use it:
- You need category tree IDs, the whole taxonomy tree, a subtree, or leaf-category discovery.

Recommended workflow:
1. Resolve the marketplace to `categoryTreeId` first.
2. Decide whether the use case needs the full tree, a subtree, expired-category mapping, or keyword suggestions.
3. Confirm leaf-category requirements before using downstream category-policy endpoints.
4. Use `rules/category-taxonomy-sequencing.md` for the required order of operations.

Navigate next:
- `rules/category-taxonomy-sequencing.md`
- `references/operation-mapping.md`

## Split GetCategoryFeatures Into Policy Endpoints

When to use it:
- You need item conditions, return policies, listing structure, best-offer support, shipping constraints, category-policy metadata, aspects, motors support, or classified-ad support.

Recommended workflow:
1. Confirm the target marketplace and leaf categories.
2. Map the exact feature family to the modern endpoint instead of expecting one omnibus response.
3. Use category filters only with leaf categories that belong to the selected marketplace.
4. Include `getShippingPolicies` and `getCategoryPolicies` when the listing flow depends on shipping-term requirements, payment methods, reserve-price rules, or value-category metadata.
5. Check `rules/category-policy-split-and-filters.md` for filter limits, token nuances, and feature-family splits.

Navigate next:
- `rules/category-policy-split-and-filters.md`
- `references/operation-mapping.md`

## Migrate Motors Compatibility Metadata

When to use it:
- You are replacing Product Metadata compatibility calls or a motors fitment discovery flow.

Recommended workflow:
1. Separate category compatibility-policy checks from compatibility-property discovery and product-compatibility lookup.
2. Use `getAutomotivePartsCompatibilityPolicies` to confirm category support.
3. Use modern compatibility-property names and values calls for guided fitment selection.
4. Keep `findCompatibilitiesBySpecification` marked as decommissioned and use modern compatibility lookups only as the supported replacement workflow.
5. Use `getProductCompatibilities` only when you already have a product identity and need associated compatibilities.

Navigate next:
- `rules/compatibility-catalog-charity.md`
- `references/operation-mapping.md`

## Use Catalog Or Charity Discovery

When to use it:
- You need to search catalog products, fetch a product by ePID, or discover a charity organization for listing flows.

Recommended workflow:
1. Use `search` for candidate product discovery.
2. Use `getProduct` to confirm a product record before relying on it for listing enrichment.
3. Use `getCharityOrgs` to search and `getCharityOrg` to confirm a specific charity.
4. Keep decommission status explicit when the CSV marks the old traditional operation as decommissioned.

Navigate next:
- `rules/compatibility-catalog-charity.md`
- `references/operation-mapping.md`

## Handle No-Replacement Product Metadata Calls

When to use it:
- You are migrating one of the deprecated Product Metadata Service operations with `No replacement` status.

Recommended workflow:
1. Verify the status in `INDEX.md` before designing a replacement.
2. Check whether the migration mapping used by this package provides a documented fallback note instead of a true replacement.
3. Preserve the gap explicitly in migration plans and user-facing guidance.
4. Do not invent a modern endpoint solely because nearby APIs exist.

Navigate next:
- `INDEX.md`
- `references/operation-mapping.md`

## Plan A Full Metadata Workflow

When to use it:
- You need category discovery, category policy checks, marketplace metadata, and catalog or compatibility enrichment in one migration plan.

Recommended workflow:
1. Resolve marketplace and category tree prerequisites first.
2. Confirm the final leaf category.
3. Fetch only the category-policy endpoints relevant to the listing payload being built, including shipping or category-policy endpoints when those fields drive listing validation.
4. Add marketplace metadata refresh and compatibility or catalog lookups as separate steps.
5. Keep any decommissioned or no-replacement traditional calls as explicit migration notes.

Navigate next:
- `rules/category-taxonomy-sequencing.md`
- `rules/category-policy-split-and-filters.md`
- `rules/marketplace-metadata-refresh.md`
- `rules/compatibility-catalog-charity.md`
