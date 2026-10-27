# GetCategoryFeatures

Traditional API:
- traditional API `GetCategoryFeatures`

Scope:
- Category policies, shipping constraints, listing-type support, conditions, motors support, visibility, returns, and aspect metadata.

Migration status:
- REST split across Sell Metadata and Taxonomy endpoints.

Notes:
- **Important**: Metadata API methods only return metadata for leaf categories (no site defaults like GetCategoryFeatures).
- Can specify up to 50 leaf categories via query parameter.
- One SOAP response becomes multiple policy-family lookups.
- Shipping and category-policy fields split into additional Sell Metadata methods.
- Aspects now come from Taxonomy rather than traditional metadata.

## Key Field Mappings

| GetCategoryFeatures Field | REST API Field | REST API Method |
|-------------------------|----------------|-----------------|
| BestOfferEnabled | negotiatedPricePolicies | getNegotiatedPricePolicies |
| ConditionValues.* | itemConditions.* | getItemConditionPolicies |
| VariationsEnabled | variationsSupported | getListingStructurePolicies |
| ListingDuration | listingDurations | getListingTypePolicies |
| ReturnPolicyEnabled | required | getReturnPolicies |
| EAN/ISBN/UPC/BrandMPNEnabled | localizedAspectName | getItemAspectsForCategory (Taxonomy) |
| ItemCompatibilityEnabled | automotivePartsCompatibilityPolicies | getAutomotivePartsCompatibility |
| GTIN/Brand/MPN aspects | localizedAspectName + aspectRequired/aspectUsage | getItemAspectsForCategory |

## Major REST API Methods

**Metadata API methods:**
- `getAutomotivePartsCompatibilityPolicies` - Parts compatibility and vehicle types
- `getClassifiedAdPolicies` - Classified Ad features and contact options
- `getItemConditionPolicies` - Item conditions (requires user token for refurbished conditions)
- `getListingTypePolicies` - Listing durations, digital delivery, pickup/dropoff
- `getListingStructurePolicies` - Variations support
- `getMotorsListingPolicies` - Motors-specific features, VIN, ktype, Motors Pro listings
- `getNegotiatedPricePolicies` - Best Offer features
- `getReturnPolicies` - Return policies (domestic and international)
- `getShippingPolicies` - Shipping cost limits, handling time, global shipping
- `getSiteVisibilityPolicies` - Cross-border trade exposure
- `getCategoryPolicies` - Payment methods, reserve prices, value category

**Taxonomy API method:**
- `getItemAspectsForCategory` - Required/recommended/optional aspects including GTIN (EAN, ISBN, UPC) and Brand/MPN

## Deprecated/Non-Migrated Fields

The following fields were NOT migrated:

**Deprecated features:**
- BuyerGuaranteeEnabled, ClassifiedAdPayPerLeadEnabled, GalleryFeaturedDurations.Duration, HomePageFeaturedEnabled, INEscrowWorkflowTimeline, PaisaPayFullEscrowEnabled, ProductCreationEnabled, ProPackEnabled, StoreOwnerExtendedListingsDurations*, TransactionConfirmationRequestEnabled, UserConsentRequired, MaxFlatShippingCostCBTExempt

**No longer applicable across all categories:**
- ItemSpecificsEnabled (all categories support item specifics)
- RevisePriceAllowed (all categories allow price revisions)
- ReviseQuantityAllowed (all categories allow quantity revisions for fixed price)
- SafePaymentRequired (eBay controls all payments)

**Business policy changes:**
- ShippingProfileCategoryGroup (default category groups no longer supported)

**Limited to specific marketplaces:**
- ReturnPolicyEnabled (only Germany, Austria, France, Italy, Spain - apply to all categories)

**Very limited scope:**
- FreeGalleryPlusEnabled, FreePicturePackEnabled

Reference basis:
- See `rules/getcategoryfeatures-mapping.md` for field mappings and migration guidance.
- See `rules/category-policy-split-and-filters.md` for policy split and filter rules.
- Traditional API documentation referenced by this package.
