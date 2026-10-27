# Category Policy Split And Filters

Use this rule when replacing `GetCategoryFeatures`.

## Rule

Do not model `GetCategoryFeatures` as one modern call. Split the request into the exact policy families needed:
- `getItemConditionPolicies`
- `getListingTypePolicies`
- `getReturnPolicies`
- `getListingStructurePolicies`
- `getNegotiatedPricePolicies`
- `getMotorsListingPolicies`
- `getAutomotivePartsCompatibilityPolicies`
- `getClassifiedAdPolicies`
- `getSiteVisibilityPolicies`
- `getItemAspectsForCategory`

## Filter And Scope Rules

- Sell Metadata category-policy methods use `marketplace_id` path parameters rather than SOAP headers.
- The default Sell Metadata behavior can return metadata for all leaf categories on a marketplace.
- When narrowing scope with a category filter, use only leaf categories that belong to that marketplace.
- Check the current public API documentation for supported category-filter limits before relying on a fixed range.
- `getItemAspectsForCategory` is single-category, while `fetchItemAspects` is bulk-download oriented and outside the mapping inventory for this package.

## Token And Access Nuances

- `getItemConditionPolicies` often works with an application token.
- User authorization may be needed for refurbished-condition visibility; verify current requirements in the public API documentation.
- Check operation docs before assuming a single token type works for every policy endpoint.

## Why This Matters

- The traditional call mixed marketplace defaults, category overrides, aspect requirements, motors fitment capability, and listing-type rules in one payload.
- The modern APIs separate those concerns. A migration plan must state which modern policy calls are needed for the target listing workflow.

## Common Failure Modes

- Treating one policy response as a substitute for all feature families
- Passing category IDs from the wrong marketplace into a filtered Sell Metadata request
- Skipping leaf-category validation before calling `getItemAspectsForCategory`
- Assuming the same authorization scope works for every condition-policy scenario
