# GetCategories Field Mapping And Migration

Use this rule when migrating from traditional API `GetCategories`.

## Migration Overview

`GetCategories` splits into **Taxonomy API** calls for hierarchy data and **Metadata API** for category-level policy flags.

## Modern API Equivalents

**Taxonomy API:**
- `getDefaultCategoryTreeId` - Resolves marketplace to tree ID
- `getCategoryTree` - Retrieves full category tree
- `getCategorySubtree` - Retrieves partial tree rooted at any category

**Metadata API:**
- `getCategoryPolicies` - Retrieves non-taxonomy category-level data points

## Field Name Changes

| Traditional Field | Modern Field |
|--------------|--------------|
| LeafCategory | leafCategoryTreeNode |
| CategorySiteID | category_tree_id (path parameter) |
| CategoryParent | category_id (query parameter) |

## Non-Taxonomy Field Mappings

| GetCategories | getCategoryPolicies |
|---------------|---------------------|
| AutoPayEnabled | autoPayEnabled |
| B2BVATEnabled | b2bVatEnabled |
| Expired | expired |
| LSD | lsd |
| ORPA | orpa |
| ORRA | orra |
| Virtual | virtual |
| ReduceReserveAllowed | reduceReserveAllowed |
| ReservePriceAllowed | reservePriceAllowed |

## Key Migration Notes

- Taxonomy API methods return similar payloads but field names differ slightly
- `category_tree_id` path parameter is equivalent to `CategorySiteID` in the traditional call
- `category_id` query parameter in `getCategorySubtree` is equivalent to `CategoryParent`
- Use `leafCategoryTreeNode=true` to identify leaf categories for downstream policy calls

## Reference

All necessary field mappings and migration guidance are included in this rule file.