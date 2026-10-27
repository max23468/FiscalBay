# GetCategoryFeatures Field Mapping And Migration

Use this rule when migrating from traditional API `GetCategoryFeatures`.

## Migration Overview

`GetCategoryFeatures` splits across multiple **Metadata API** and **Taxonomy API** methods. The traditional call returned all category metadata in one response; modern APIs require separate calls per policy family.

## Critical Differences

- **Metadata API methods only return data for leaf categories** - no site defaults like the traditional call
- Can specify up to 50 leaf categories via filter parameter
- Each feature ID group maps to a separate REST method

## Modern API Methods By Policy Family

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
- `getItemAspectsForCategory` - Required/recommended/optional aspects including GTIN and Brand/MPN
  - Uses `localizedAspectName` with `aspectRequired` and `aspectUsage` fields
  - Covers EAN, ISBN, UPC, Brand, MPN identifiers

## Key Field Mappings Summary

| Traditional Field | Modern Field | Method |
|--------------|--------------|--------|
| BestOfferEnabled | negotiatedPricePolicies | getNegotiatedPricePolicies |
| ConditionValues.* | itemConditions.* | getItemConditionPolicies |
| VariationsEnabled | variationsSupported | getListingStructurePolicies |
| ListingDuration | listingDurations | getListingTypePolicies |
| ReturnPolicyEnabled | required | getReturnPolicies |
| EAN/ISBN/UPC/BrandMPNEnabled | localizedAspectName | getItemAspectsForCategory (Taxonomy) |
| ItemCompatibilityEnabled | automotivePartsCompatibilityPolicies | getAutomotivePartsCompatibility |

## Fields Not Migrated

**Deprecated features (no longer applicable):**
- BuyerGuaranteeEnabled, ClassifiedAdPayPerLeadEnabled, GalleryFeaturedDurations.Duration
- HomePageFeaturedEnabled, INEscrowWorkflowTimeline, PaisaPayFullEscrowEnabled
- ProductCreationEnabled, ProPackEnabled, TransactionConfirmationRequestEnabled
- UserConsentRequired, MaxFlatShippingCostCBTExempt

**Universal across all categories:**
- ItemSpecificsEnabled (all categories support item specifics)
- RevisePriceAllowed (all categories allow price revisions)
- ReviseQuantityAllowed (all categories allow quantity revisions for fixed price)
- SafePaymentRequired (eBay controls all online payments)

**Business policy changes:**
- ShippingProfileCategoryGroup (default category groups no longer supported)

**Limited scope:**
- ReturnPolicyEnabled (only Germany, Austria, France, Italy, Spain - applies to all categories)
- FreeGalleryPlusEnabled, FreePicturePackEnabled (very limited category support)
- StoreOwnerExtendedListingsDurations (deprecated feature)

## Authorization Notes

- `getItemConditionPolicies` works with application token
- User authorization may be needed for refurbished-condition visibility (Certified/Excellent/Very Good/Good - Refurbished)
- Check current API documentation before assuming token compatibility

## Reference

All key field mappings, non-migrated fields, and migration guidance are included in this rule file.