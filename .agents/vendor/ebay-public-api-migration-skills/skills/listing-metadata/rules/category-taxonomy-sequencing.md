# Category Taxonomy Sequencing

Use this rule when a traditional flow depends on category lookup, leaf-category validation, category suggestions, or expired-category remapping.

## Rule

1. Resolve the marketplace first.
2. Call `getDefaultCategoryTreeId` to obtain the correct `categoryTreeId` for that marketplace.
3. Use one of these next steps based on the job:
   - `getCategoryTree` for a full marketplace tree snapshot
   - `getCategorySubtree` for one branch rooted at a known category
   - `getCategorySuggestions` for keyword-driven category discovery
   - `getExpiredCategories` when you need to map outdated category IDs to current ones
4. Treat `leafCategoryTreeNode=true` as the confirmation that the chosen category can be used in downstream listing metadata flows.
5. Only after the final leaf category is known should you move on to category-policy or aspect endpoints.

## Why This Matters

- `GetCategories` returned hierarchy data in one SOAP shape.
- Modern Taxonomy flows split marketplace resolution from tree traversal.
- Category-policy and aspect endpoints depend on correct marketplace and leaf-category context.

## Implementation Notes

- `getCategoryTree` and `getCategorySubtree` operate on `categoryTreeId`, not traditional `SiteID` headers.
- `getCategorySuggestions` helps discovery, but it does not replace explicit subtree or leaf validation.
- If an old category is no longer valid, use `getExpiredCategories` before attempting policy lookups or listing creation.

## Common Failure Modes

- Using the wrong marketplace and therefore the wrong `categoryTreeId`
- Assuming a suggested category is a usable leaf category without checking the returned node metadata
- Sending a non-leaf category to aspect or policy lookups that require a leaf category
