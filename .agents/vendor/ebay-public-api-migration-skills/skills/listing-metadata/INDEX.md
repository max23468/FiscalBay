# Listing Metadata Index

| Traditional Operation | Status | Modern API Family | Modern Operation or Endpoint | Notes |
| --- | --- | --- | --- | --- |
| GeteBayDetails | REST | Sell Metadata, Taxonomy | `getCurrencies`, `getHandlingTimes`, `getExcludeShippingLocations`, `getShippingCarriers`, `getShippingLocations`, `getShippingServices`, `getMinimumListingPricePolicies`, `getSalesTaxJurisdictions`, `getDefaultCategoryTreeId` | Split by metadata type. `getSalesTaxJurisdictions` uses `countryCode` path param (US/CA only). Current source inventory and migration guide both tie `SiteDetails` to `getDefaultCategoryTreeId`, but that taxonomy method should still be described as a scoped category-tree bootstrap mapping rather than full parity for every `SiteDetails` field. Several old `DetailName` groups are not carried forward. |
| GetCategories | REST | Taxonomy | `getDefaultCategoryTreeId`, `getCategoryTree`, `getCategorySubtree` | Tree lookup is now a sequence, not a single bulk traditional call. |
| GetCategoryFeatures | REST | Sell Metadata, Taxonomy | `getItemConditionPolicies`, `getListingTypePolicies`, `getReturnPolicies`, `getListingStructurePolicies`, `getNegotiatedPricePolicies`, `getMotorsListingPolicies`, `getAutomotivePartsCompatibilityPolicies`, `getClassifiedAdPolicies`, `getSiteVisibilityPolicies`, `getShippingPolicies`, `getCategoryPolicies`, `getItemAspectsForCategory` | Split across category-policy, shipping-policy, and aspect endpoints. |
| GetCategoryMappings | Decommission | Taxonomy | `getExpiredCategories` | Keep visible as decommissioned inventory. Use the modern endpoint only as documented fallback context. |
| GetSuggestedCategories | Decommission | Taxonomy | `getCategorySuggestions` | Inventory row is decommissioned even though a modern suggestions endpoint exists. |
| GetCharities | Decommission | Charity | `getCharityOrg`, `getCharityOrgs` | Decommissioned traditional lookup; modern charity search/detail endpoints support discovery workflows. |
| findCompatibilitiesBySpecification | Decommission | Sell Metadata | `getCompatibilitiesBySpecification` | Keep decommission status explicit. |
| findProducts | REST | Catalog | `search` | Modern catalog search supports the motors use cases called out in this package's migration guidance. |
| findProductsByCompatibility | Decommission | No replacement | No replacement | No direct replacement is documented in this package's migration mapping. |
| getCompatibilitySearchDataVersion | No replacement | No replacement | No replacement | Use `metadataVersion` returned by compatibility value methods as the documented fallback. |
| getCompatibilitySearchNames | REST | Sell Metadata | `getCompatibilityPropertyNames` | Motors compatibility-property discovery moved to Sell Metadata. |
| getCompatibilitySearchValues | REST | Sell Metadata | `getCompatibilityPropertyValues` | Use modern compatibility-property value lookup. |
| getCompatibilitySearchValuesBulk | REST | Sell Metadata | `getMultiCompatibilityPropertyValues` | Bulk value lookup is a dedicated REST call. |
| getProductCompatibilities | REST | Sell Metadata | `getProductCompatibilities` | Compatibility lookup remains available in modern metadata flows. |
| getProductDetails | REST | Catalog | `getProduct` | Direct product-detail lookup by ePID or other identifiers. |
| addProducts | Decommission | No replacement | No replacement | No supported modern replacement is documented in this package's migration mapping. |
| getProductMetadataBulk | Decommission | No replacement | No replacement | No supported modern replacement is documented in this package's migration mapping. |
| getProductSearchDataVersion | Decommission | No replacement | No replacement | No supported modern replacement is documented in this package's migration mapping. |
| getProductSearchNames | Decommission | No replacement | No replacement | No supported modern replacement is documented in this package's migration mapping. |
| getProductSearchValues | Decommission | No replacement | No replacement | No supported modern replacement is documented in this package's migration mapping. |
| getProductSearchValuesBulk | Decommission | No replacement | No replacement | No supported modern replacement is documented in this package's migration mapping. |
| getProductSubmissions | Decommission | No replacement | No replacement | No supported modern replacement is documented in this package's migration mapping. |

## Notes

- No `Requires confirmation` rows were identified in the migration mapping used by this package.
- The migration mapping used by this package remains authoritative for status. If a modern endpoint exists but the row status is `Decommission`, this index keeps the `Decommission` status instead of silently upgrading it to `REST`.
