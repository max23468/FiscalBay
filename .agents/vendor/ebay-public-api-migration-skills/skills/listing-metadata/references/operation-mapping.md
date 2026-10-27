# Listing Metadata Operation Mapping

## Marketplace Metadata

### GeteBayDetails -> getCurrencies, getHandlingTimes, getExcludeShippingLocations, getShippingCarriers, getShippingLocations, getShippingServices, getMinimumListingPricePolicies, getSalesTaxJurisdictions, getDefaultCategoryTreeId (SiteDetails)
Purpose:
- Retrieve marketplace-level metadata that listing flows used for currencies, handling times, shipping services, shipping carriers, shipping locations, excluded ship-to locations, and minimum listing price policies.
- Preserve a conservative boundary for traditional `SiteDetails`: current source inventory and migration-guide evidence keep `getDefaultCategoryTreeId` in scope, but this package does not claim full one-to-one parity for the whole `SiteDetails` container.

Modern API:
- Sell Metadata REST methods scoped by `marketplace_id` path parameters.
- Taxonomy `getDefaultCategoryTreeId` for the source-backed `SiteDetails` mapping used to bootstrap marketplace/category-tree identity.

Key Differences:
- One broad SOAP call becomes several focused REST lookups.
- The old `DetailName` filter is replaced by choosing the exact REST resource.
- `getSalesTaxJurisdictions` uses a `countryCode` path parameter instead of `marketplace_id`; supported values are US and CA only.
- `getDefaultCategoryTreeId` remains part of the source-backed mapping for `SiteDetails`, but it should be described as a scoped taxonomy bootstrap mapping rather than a full direct replacement for every `SiteDetails` field.
- Several old `GeteBayDetails` detail groups are not carried forward as direct modern API calls.

Request Payload Transformation:

- Traditional: [GeteBayDetails_example.md](operations/GeteBayDetails_example.md)
- Modern: [getCurrencies_example.md](operations/getCurrencies_example.md), [getHandlingTimes_example.md](operations/getHandlingTimes_example.md), [getExcludeShippingLocations_example.md](operations/getExcludeShippingLocations_example.md), [getShippingCarriers_example.md](operations/getShippingCarriers_example.md), [getShippingLocations_example.md](operations/getShippingLocations_example.md), [getShippingServices_example.md](operations/getShippingServices_example.md), [getMinimumListingPricePolicies_example.md](operations/getMinimumListingPricePolicies_example.md), [getSalesTaxJurisdictions_example.md](operations/getSalesTaxJurisdictions_example.md)



Response Payload Transformation:

- Traditional: [GeteBayDetails_example.md](operations/GeteBayDetails_example.md)
- Modern: [getCurrencies_example.md](operations/getCurrencies_example.md), [getHandlingTimes_example.md](operations/getHandlingTimes_example.md), [getExcludeShippingLocations_example.md](operations/getExcludeShippingLocations_example.md), [getShippingCarriers_example.md](operations/getShippingCarriers_example.md), [getShippingLocations_example.md](operations/getShippingLocations_example.md), [getShippingServices_example.md](operations/getShippingServices_example.md), [getMinimumListingPricePolicies_example.md](operations/getMinimumListingPricePolicies_example.md), [getSalesTaxJurisdictions_example.md](operations/getSalesTaxJurisdictions_example.md)





Note: `getShippingServices`, `getMinimumListingPricePolicies`, and `getSalesTaxJurisdictions` response shapes are not available in the current bundled examples. Refer to references/operations/ docs for those endpoints.

Restrictions:
- Do not present `SiteDetails -> getDefaultCategoryTreeId` as a validated one-to-one field mapping.
- Current source inventory and migration-guide evidence still keep `getDefaultCategoryTreeId` in the mapping, so keep it visible when answering, but explain that it primarily covers marketplace/category-tree bootstrap.
- If the old workflow depended on other `SiteDetails` subfields beyond marketplace/category-tree identity, call out that additional parity is not validated in this package.

Migration Guide:
- Use getShippingServices method of Metadata API to retrieve metadata equivalent to ShippingServiceDetails and ShippingPackageDetails in GeteBayDetails.
- Use getShippingCarriers method of Metadata API to retrieve metadata equivalent to ShippingCarrierDetails in GeteBayDetails.
- Use getShippingLocations method of Metadata API to retrieve metadata equivalent to ShippingLocationDetails in GeteBayDetails.
- Use getExcludeShippingLocations method of Metadata API to retrieve metadata equivalent to ExcludeShippingLocationDetails in GeteBayDetails.
- Use getHandlingTimes method of Metadata API to retrieve metadata equivalent to DispatchTimeMaxDetails in GeteBayDetails.
- Use getCurrencies method of Metadata API to retrieve data tied to CurrencyDetails in GeteBayDetails.
- Use getMinimumListingPricePolicies method of Metadata API to retrieve data tied to ListingStartPriceDetails in GeteBayDetails.
- Use getSalesTaxJurisdictions method of Metadata API to retrieve data tied to TaxJurisdiction containers in GeteBayDetails.
- Use getDefaultCategoryTreeId method of Taxonomy API to retrieve data tied to SiteDetails containers in GeteBayDetails.
- Key things to know about the Metadata API methods:
  - The eBay marketplace is set through a marketplace_id path parameter and not through a HTTP header, and these eBay marketplaces are defined in the Marketplace ID values table.
  - The getSalesTaxJurisdictions method requires a countryCode path parameter, and the only supported values are US and CA, as a seller can only configure/set sales tax rates for five US territories (no US states or D.C.) and Canadian provinces.
- See below for the full list of GeteBayDetails metadata groups that will not be carried over into new modern APIs, and the reasons why:
  - BuyerRequirementDetails - listing-level Buyer Requirements are no longer supported, but the seller can only set/modify these settings in My eBay.
  - CountryDetails - these are just ISO 3166 country codes that can be retrieved and maintained by using the standards doc or a tool.
  - ItemSpecificDetails - all of these threshold values are stable across all eBay marketplaces and have not had a single change since 2010. These thresholds will be covered in supporting docs instead.
  - ListingFeatureDetails - this metadata is no longer needed since Bold Titles is the only supported feature out of the eight features that are returned, and Bold Titles are supported on all eBay marketplaces.
  - ProductDetails - the text used for each marketplace when a GTIN is unknown/not applicable does not change, and all values are documented here: /api-docs/sell/static/inventory/product-identifier-text.html
  - RecoupmentPolicyDetails - this metadata is no longer applicable.
  - RegionDetails - the region IDs are no longer supported.
  - ShippingCategoryDetails - the shipping speed/level metadata is only informational and is not used anywhere in listing flows.
  - TimeZoneDetails - timezone data is not eBay-specific data and other tools and libraries can be used for this data.
  - URLDetails - default root URLs will not be migrated.
  - VariationDetails - all of these threshold values are stable across all eBay marketplaces and have not had a single change since 2013. These thresholds will be covered in docs instead.
Related Patterns:
- Full traditional doc extract: references/operations/GeteBayDetails_doc.md
- Full modern doc notes: references/operations/getCurrencies_doc.md, references/operations/getShippingServices_doc.md, references/operations/getMinimumListingPricePolicies_doc.md, references/operations/getSalesTaxJurisdictions_doc.md
- Full modern examples: references/operations/getCurrencies_example.md, references/operations/getShippingServices_example.md, references/operations/getMinimumListingPricePolicies_example.md, references/operations/getSalesTaxJurisdictions_example.md
- Source-backed taxonomy mapping with scoped coverage: references/operations/getDefaultCategoryTreeId_doc.md, references/operations/getDefaultCategoryTreeId_example.md

### GetCategoryMappings (Decommissioned) -> getExpiredCategories
Purpose:
- Map retired category IDs to their replacement category IDs.

Modern API:
- Taxonomy `getExpiredCategories`.

Key Differences:
- The authoritative CSV status is `Decommission`, so this package keeps that status visible even while routing to a concrete modern method.
- Use the modern expired-category lookup as the replacement workflow for category-retirement checks rather than treating this row as a generic non-mapping placeholder.

Request Payload Transformation:

- Traditional: [GetCategoryMappings_doc.md](operations/GetCategoryMappings_doc.md)
- Modern: [getExpiredCategories_example.md](operations/getExpiredCategories_example.md)

Response Payload Transformation:

- Traditional: [GetCategoryMappings_doc.md](operations/GetCategoryMappings_doc.md)
- Modern: [getExpiredCategories_example.md](operations/getExpiredCategories_example.md)

Migration Guide:
- getExpiredCategories call of the Taxonomy API.

Related Patterns:
- Full traditional doc extract: references/operations/GetCategoryMappings_doc.md
- Full modern doc notes: references/operations/getExpiredCategories_doc.md
- Full modern example: references/operations/getExpiredCategories_example.md

## Category Taxonomy And Discovery

### GetCategories -> getDefaultCategoryTreeId, getCategoryTree, getCategorySubtree
Purpose:
- Retrieve marketplace taxonomy data and discover the category path needed before listing.

Modern API:
- Taxonomy REST methods for marketplace tree resolution and traversal.

Key Differences:
- `GetCategories` combined site selection and tree traversal in one SOAP call.
- Modern flows first resolve `categoryTreeId`, then fetch the whole tree or one subtree.
- Leaf-category validation matters before downstream policy calls.

Request Payload Transformation:

- Traditional: [GetCategories_example.md](operations/GetCategories_example.md)
- Modern: [getDefaultCategoryTreeId_example.md](operations/getDefaultCategoryTreeId_example.md), [getCategoryTree_example.md](operations/getCategoryTree_example.md), [getCategorySubtree_example.md](operations/getCategorySubtree_example.md)



Response Payload Transformation:

- Traditional: [GetCategories_example.md](operations/GetCategories_example.md)
- Modern: [getDefaultCategoryTreeId_example.md](operations/getDefaultCategoryTreeId_example.md), [getCategoryTree_example.md](operations/getCategoryTree_example.md), [getCategorySubtree_example.md](operations/getCategorySubtree_example.md)



Migration Guide:
- See `rules/getcategories-mapping.md` for field mappings and migration guidance.
- See `rules/category-taxonomy-sequencing.md` for taxonomy call sequencing rules.
- getDefaultCategoryTreeId method of Taxonomy API to get category tree ID
- getCategoryTree method of Taxonomy API to get full category tree
- getCategorySubtree method of Taxonomy API to get a subset of the category tree, starting at any category level
- getCategoryPolicies method of Metadata API for all site-level data points.

**Field Name Changes:**
- `leafCategoryTreeNode` (REST) replaces `LeafCategory` (SOAP)
- `categoryTreeId` (REST path parameter) replaces `CategorySiteID` (SOAP)
- `category_id` query parameter in `getCategorySubtree` replaces `CategoryParent` in SOAP
Related Patterns:
- Full traditional doc extract: references/operations/GetCategories_doc.md
- Full modern doc notes: references/operations/getDefaultCategoryTreeId_doc.md, references/operations/getCategoryTree_doc.md, references/operations/getCategorySubtree_doc.md
- Full modern examples: references/operations/getDefaultCategoryTreeId_example.md, references/operations/getCategoryTree_example.md, references/operations/getCategorySubtree_example.md

### GetSuggestedCategories (Decommissioned) -> getCategorySuggestions
Purpose:
- Suggest likely listing categories from product keywords.

Modern API:
- Taxonomy `getCategorySuggestions`.

Key Differences:
- The authoritative inventory keeps this row in `Decommission`, so the package preserves that status instead of silently upgrading it to a standard REST row.
- The modern taxonomy suggestion call is still the concrete replacement workflow for category discovery from free-text keywords.

Request Payload Transformation:

- Traditional: [GetSuggestedCategories_doc.md](operations/GetSuggestedCategories_doc.md)
- Modern: [getCategorySuggestions_example.md](operations/getCategorySuggestions_example.md)

Response Payload Transformation:

- Traditional: [GetSuggestedCategories_doc.md](operations/GetSuggestedCategories_doc.md)
- Modern: [getCategorySuggestions_example.md](operations/getCategorySuggestions_example.md)

Related Patterns:
- Full traditional doc extract: references/operations/GetSuggestedCategories_doc.md
- Full modern doc notes: references/operations/getCategorySuggestions_doc.md
- Full modern example: references/operations/getCategorySuggestions_example.md

## Category Policies And Features

### GetCategoryFeatures -> getItemConditionPolicies, getListingTypePolicies, getReturnPolicies, getListingStructurePolicies, getNegotiatedPricePolicies, getMotorsListingPolicies, getAutomotivePartsCompatibilityPolicies, getClassifiedAdPolicies, getSiteVisibilityPolicies, getShippingPolicies, getCategoryPolicies, getItemAspectsForCategory
Purpose:
- Retrieve category-level feature flags, conditions, return-policy metadata, listing-type support, aspect requirements, motors support, best-offer support, classified-ad support, site-visibility rules, shipping constraints, and category-policy metadata.

Modern API:
- Sell Metadata plus Taxonomy REST methods, selected by policy family.

Key Differences:
- One feature-rich SOAP response becomes a policy-family split across many REST endpoints, including shipping and category-policy resources.
- Metadata responses are leaf-category only, so traditional-era site defaults do not carry over.
- Modern policy methods are marketplace-scoped and can optionally filter by up to 50 leaf category IDs.
- Some traditional fields are deprecated, universally supported, or no longer modeled as category-level metadata in REST.
- Aspects moved to Taxonomy and require `categoryTreeId` plus a final category.

Request Payload Transformation:

- Traditional: [GetCategoryFeatures_example.md](operations/GetCategoryFeatures_example.md)
- Modern: [getItemConditionPolicies_example.md](operations/getItemConditionPolicies_example.md), [getListingTypePolicies_example.md](operations/getListingTypePolicies_example.md), [getReturnPolicies_example.md](operations/getReturnPolicies_example.md), [getListingStructurePolicies_example.md](operations/getListingStructurePolicies_example.md), [getNegotiatedPricePolicies_example.md](operations/getNegotiatedPricePolicies_example.md), [getMotorsListingPolicies_example.md](operations/getMotorsListingPolicies_example.md), [getAutomotivePartsCompatibilityPolicies_example.md](operations/getAutomotivePartsCompatibilityPolicies_example.md), [getClassifiedAdPolicies_example.md](operations/getClassifiedAdPolicies_example.md), [getSiteVisibilityPolicies_example.md](operations/getSiteVisibilityPolicies_example.md), [getShippingPolicies_example.md](operations/getShippingPolicies_example.md), [getCategoryPolicies_example.md](operations/getCategoryPolicies_example.md), [getItemAspectsForCategory_example.md](operations/getItemAspectsForCategory_example.md)



Response Payload Transformation:

- Traditional: [GetCategoryFeatures_example.md](operations/GetCategoryFeatures_example.md)
- Modern: [getItemConditionPolicies_example.md](operations/getItemConditionPolicies_example.md), [getListingTypePolicies_example.md](operations/getListingTypePolicies_example.md), [getReturnPolicies_example.md](operations/getReturnPolicies_example.md), [getListingStructurePolicies_example.md](operations/getListingStructurePolicies_example.md), [getNegotiatedPricePolicies_example.md](operations/getNegotiatedPricePolicies_example.md), [getMotorsListingPolicies_example.md](operations/getMotorsListingPolicies_example.md), [getAutomotivePartsCompatibilityPolicies_example.md](operations/getAutomotivePartsCompatibilityPolicies_example.md), [getClassifiedAdPolicies_example.md](operations/getClassifiedAdPolicies_example.md), [getSiteVisibilityPolicies_example.md](operations/getSiteVisibilityPolicies_example.md), [getShippingPolicies_example.md](operations/getShippingPolicies_example.md), [getCategoryPolicies_example.md](operations/getCategoryPolicies_example.md), [getItemAspectsForCategory_example.md](operations/getItemAspectsForCategory_example.md)



Note: Response shapes for the individual Metadata API policy methods (`getShippingPolicies`, `getCategoryPolicies`) are not available as bundled examples in the current source set. Refer to the per-operation doc files in references/operations/ for each endpoint.

Example notes / request stubs are available in:
- references/operations/getItemAspectsForCategory_example.md
- references/operations/getItemConditionPolicies_example.md
- references/operations/getReturnPolicies_example.md (no bundled JSON response example in doc page)
- references/operations/getNegotiatedPricePolicies_example.md (no bundled JSON response example in doc page)
- references/operations/getListingStructurePolicies_example.md (no bundled JSON response example in doc page)
- references/operations/getAutomotivePartsCompatibilityPolicies_example.md (no bundled JSON response example in doc page)

Field To Method Mapping:
- `getAutomotivePartsCompatibility`: `AdditionalCompatibilityEnabled`, `CompatibleVehicleType`, `ItemCompatibilityEnabled`.
- `getClassifiedAdPolicies`: `AdFormatEnabled`, `ClassifiedAdAutoAcceptEnabled`, `ClassifiedAdAutoDeclineEnabled`, `ClassifiedAdBestOfferEnabled`, `ClassifiedAdCompanyNameEnabled`, `ClassifiedAdContactByAddressEnabled`, `ClassifiedAdContactByEmailEnabled`, `ClassifiedAdContactByPhoneEnabled`, `ClassifiedAdCounterOfferEnabled`, `ClassifiedAdPaymentMethodEnabled`, `ClassifiedAdPhoneCount`, `ClassifiedAdShippingMethodEnabled`, `ClassifiedAdStreetCount`, `SellerContactDetailsEnabled`.
- `getNegotiatedPricePolicies`: `BestOfferAutoAcceptEnabled`, `BestOfferAutoDeclinedEnabled`, `BestOfferCounterEnabled`, `BestOfferEnabled`.
- `getItemAspectsForCategory` (Taxonomy): `BrandMPNIdentifierEnabled`, `EANEnabled`, `ISBNEnabled`, `UPCEnabled`.
- `getItemConditionPolicies`: `ConditionEnabled`, `ConditionValues.Condition.DisplayName`, `ConditionValues.Condition.ID`, `ConditionValues.ConditionHelpURL`, `SpecialFeatures.Condition.DisplayName`, `SpecialFeatures.Condition.ID`, `SpecialFeatures.ConditionHelpURL`.
- `getSiteVisibilityPolicies`: `CrossBorderTradeAustraliaEnabled`, `CrossBorderTradeGBEnabled`, `CrossBorderTradeNorthAmericaEnabled`.
- `getMotorsListingPolicies`: `DepositSupported`, `eBayMotorsProAdFormatEnabled`, `eBayMotorsProAutoAcceptEnabled`, `eBayMotorsProAutoDeclineEnabled`, `eBayMotorsProBestOfferEnabled`, `eBayMotorsProCompanyNameEnabled`, `eBayMotorsProContactByAddressEnabled`, `eBayMotorsProContactByEmailEnabled`, `eBayMotorsProContactByPhoneEnabled`, `eBayMotorsProCounterOfferEnabled`, `eBayMotorsProPaymentMethodCheckOutEnabled`, `eBayMotorsProPhoneCount`, `eBayMotorsProSellerContactDetailsEnabled`, `eBayMotorsProShippingMethodEnabled`, `eBayMotorsProStreetCount`, `EpidSupported`, `KTypeSupported`, `LocalMarketAdFormatEnabled`, `LocalMarketAutoAcceptEnabled`, `LocalMarketAutoDeclineEnabled`, `LocalMarketBestOfferEnabled`, `LocalMarketCompanyNameEnabled`, `LocalMarketContactByAddressEnabled`, `LocalMarketContactByEmailEnabled`, `LocalMarketContactByPhoneEnabled`, `LocalMarketCounterOfferEnabled`, `LocalMarketNonSubscription`, `LocalMarketPaymentMethodCheckOutEnabled`, `LocalMarketPhoneCount`, `LocalMarketPremiumSubscription`, `LocalMarketRegularSubscription`, `LocalMarketSellerContactDetailsEnabled`, `LocalMarketShippingMethodEnabled`, `LocalMarketSpecialitySubscription`, `LocalMarketStreetCount`, `MaxGranularFitmentCount`, `MaxItemCompatibility`, `MinItemCompatibility`, `NonSubscription`, `PremiumSubscription`, `RegularSubscription`, `SellerProvidedTitleSupported`, `VINSupported`, `VRMSupported`.
- `getListingTypePolicies`: `DigitalGoodDeliveryEnabled`, `ListingDuration`, `PickupDropOffEnabled`.
- `getReturnPolicies`: `DomesticRefundMethodValues.DomesticRefundMethod`, `DomesticReturnsAcceptedValues.DomesticReturnsAccepted`, `DomesticReturnsDurationValues.DomesticReturnsDuration`, `DomesticReturnsShipmentPayeeValues.DomesticReturnsShipmentPayee`, `InternationalRefundMethodValues.InternationalRefundMethod`, `InternationalReturnsAcceptedValues.InternationalReturnsAccepted`, `InternationalReturnsDurationValues.InternationalReturnsDuration`, `InternationalReturnsShipmentPayeeValues.InternationalReturnsShipmentPayee`, `ReturnPolicyDescriptionEnabled`, `ReturnPolicyEnabled`.
- `getShippingPolicies`: `GlobalShippingEnabled`, `Group1MaxFlatShippingCost`, `Group2MaxFlatShippingCost`, `Group3MaxFlatShippingCost`, `HandlingTimeEnabled`, `MaxFlatShippingCost`, `ShippingTermsRequired`.
- `getCategoryPolicies`: `MinimumReservePrice`, `PaymentMethod`, `ValueCategory`.
- `getListingStructurePolicies`: `VariationsEnabled`.
- No REST API method listed on the page: `SpecialitySubscription` maps to REST field `specialtySubscription`, but the table leaves the method column blank.
- Deprecated or non-migrated on the same page: `BuyerGuaranteeEnabled`, `ClassifiedAdPayPerLeadEnabled`, `FreeGalleryPlusEnabled`, `FreePicturePackEnabled`, `GalleryFeaturedDurations.Duration`, `HomePageFeatureEnabled`, `INEscrowWorkflowTimeline`, `ItemSpecificsEnabled`, `MaxFlatShippingCostCBTExempt`, `PaisaPayFullEscrowEnabled`, `ProductCreationEnabled`, `ProPackEnabled`, `RevisePriceAllowed`, `ReviseQuantityAllowed`, `SafePaymentRequired`, `ShippingProfileCategoryGroup`, `StoreOwnerExtendedListingDurations.Duration`, `StoreOwnerExtendedListingsDurationsEnabled`, `TransactionConfirmationRequestEnabled`, `UserConsentRequired`.

Migration Guide:
- See `rules/getcategoryfeatures-mapping.md` for field mappings and migration guidance.
- See `rules/category-policy-split-and-filters.md` for policy split and filter rules.
- Key things to know about the Metadata API methods:
  - The eBay marketplace is set through a marketplace_id path parameter and not through a HTTP header, and these eBay marketplaces are defined in the Marketplace ID values table.
  - The default behavior the Metadata API methods is to retrieve metadata from all leaf categories on the specified marketplace, but users can use the filter query parameter to specify anywhere from 1 to 50 leaf category IDs to restrict retrieved metadata to those leaf categories.
- Key things to know about the Taxonomy API methods:
  - Both the getItemAspectsForCategory and fetchItemAspects methods require a category tree identifier through the category_tree_id path parameter. The ID associated with each marketplace can be retrieved using the getDefaultCategoryTreeId method.
  - The getItemAspectsForCategory method can only retrieve metadata on one leaf category per operation, and this leaf category is specified through the category_id query parameter.
  - A successful fetchItemAspects method retrieves a binary version of a gzipped JSON file, and once extracted, this file will contain metadata on all leaf categories for a marketplace.
  - The fetchItemAspects method can be paired together with the open source Taxonomy SDK to compare the aspect metadata that is returned in this response for each subsequent fetchItemAspects operation. The Taxonomy SDK uses the fetchItemAspects method to surface changes (new, modified, and removed entities) between an updated version of a bulk downloaded file relative to a previous version.
Related Patterns:
- Full traditional doc extract: references/operations/GetCategoryFeatures_doc.md
- Full modern doc notes: references/operations/getItemConditionPolicies_doc.md, references/operations/getReturnPolicies_doc.md, references/operations/getShippingPolicies_doc.md, references/operations/getCategoryPolicies_doc.md, references/operations/getItemAspectsForCategory_doc.md
- Full modern examples: references/operations/getItemConditionPolicies_example.md, references/operations/getListingTypePolicies_example.md, references/operations/getShippingPolicies_example.md, references/operations/getCategoryPolicies_example.md, references/operations/getMotorsListingPolicies_example.md

## Compatibility And Fitment Metadata

### findCompatibilitiesBySpecification (Decommissioned) -> getCompatibilitiesBySpecification
Purpose:
- Retrieve compatibilities from a structured specification payload.

Modern API:
- Sell Metadata `getCompatibilitiesBySpecification`.

Key Differences:
- Keep the decommission status visible instead of silently converting it into a normal REST migration.
- The modern endpoint is a useful supporting lookup when planning fitment workflows.

Request Payload Transformation:

- Traditional: [findCompatibilitiesBySpecification_doc.md](operations/findCompatibilitiesBySpecification_doc.md)
- Modern: [getCompatibilitiesBySpecification_example.md](operations/getCompatibilitiesBySpecification_example.md)

Response Payload Transformation:

- Traditional: [findCompatibilitiesBySpecification_doc.md](operations/findCompatibilitiesBySpecification_doc.md)
- Modern: [getCompatibilitiesBySpecification_example.md](operations/getCompatibilitiesBySpecification_example.md)

Migration Guide:
- getCompatibilitiesBySpecification

Related Patterns:
- Full traditional doc extract: references/operations/findCompatibilitiesBySpecification_doc.md
- Full modern doc notes: references/operations/getCompatibilitiesBySpecification_doc.md
- Full modern example: references/operations/getCompatibilitiesBySpecification_example.md

### findProductsByCompatibility (Decommissioned) -> No replacement
Purpose:
- Search products using compatibility-driven filters.

Modern API:
- No replacement.

Key Differences:
- The migration mapping used by this package does not document a supported direct replacement.
- The authoritative inventory marks this traditional operation as decommissioned.
- Nearby compatibility endpoints do not change the explicit `No replacement` status.

Related Patterns:
- Full traditional doc extract: references/operations/findProductsByCompatibility_doc.md

### getCompatibilitySearchDataVersion -> No replacement
Purpose:
- Retrieve the compatibility metadata version for a category.

Modern API:
- No replacement.

Key Differences:
- The authoritative inventory keeps this traditional operation as an explicit `No replacement` gap.
- The CSV documents a fallback note rather than a new direct endpoint.

Migration Guide:
- No direct replacement, but both the getCompatibilityPropertyValues and getMultiCompatibilityPropertyValues return a metadataVersion value in the response.
Related Patterns:
- Full traditional doc extract: references/operations/getCompatibilitySearchDataVersion_doc.md

### getCompatibilitySearchNames -> getCompatibilityPropertyNames
Purpose:
- Retrieve the compatibility-property names needed to build guided motors fitment selection.

Modern API:
- Sell Metadata `getCompatibilityPropertyNames`.

Key Differences:
- The modern call is explicit about compatibility-property discovery rather than generic search-name retrieval.
- Category support should be confirmed before using the names in a fitment workflow.

Request Payload Transformation:

- Traditional: [getCompatibilitySearchNames_example.md](operations/getCompatibilitySearchNames_example.md)
- Modern: [getCompatibilityPropertyNames_example.md](operations/getCompatibilityPropertyNames_example.md)



Response Payload Transformation:

- Traditional: [getCompatibilitySearchNames_example.md](operations/getCompatibilitySearchNames_example.md)
- Modern: [getCompatibilityPropertyNames_example.md](operations/getCompatibilityPropertyNames_example.md)



Migration Guide:
- getCompatibilitySearchNames maps to getCompatibilityPropertyNames method of Metadata API
- Key things to know about the methods under the compatibilities resource of the Metadata API:
  - The X-EBAY-C-MARKETPLACE-ID header is needed to identify the eBay marketplace from which metadata will be retrieved. Compatibility methods will only retrieve data for marketplaces that support parts compatibility
  - The leaf category is specified through the categoryId field.
Related Patterns:
- Full traditional doc extract: references/operations/getCompatibilitySearchNames_doc.md
- Full modern doc notes: references/operations/getCompatibilityPropertyNames_doc.md
- Full modern example: references/operations/getCompatibilityPropertyNames_example.md

### getCompatibilitySearchValues -> getCompatibilityPropertyValues
Purpose:
- Retrieve supported values for one compatibility property such as make, model, or year.

Modern API:
- Sell Metadata `getCompatibilityPropertyValues`.

Key Differences:
- The modern request is a dedicated REST payload instead of SOAP search-value parameters.
- Compatibility-property syntax and filters must be valid or the call fails.

Request Payload Transformation:

- Traditional: [getCompatibilitySearchValues_example.md](operations/getCompatibilitySearchValues_example.md)
- Modern: [getCompatibilityPropertyValues_example.md](operations/getCompatibilityPropertyValues_example.md)



Response Payload Transformation:

- Traditional: [getCompatibilitySearchValues_example.md](operations/getCompatibilitySearchValues_example.md)
- Modern: [getCompatibilityPropertyValues_example.md](operations/getCompatibilityPropertyValues_example.md)



Migration Guide:
- getCompatibilitySearchValues maps to getCompatibilityPropertyValues method of Metadata API
- Key things to know about the methods under the compatibilities resource of the Metadata API:
  - The X-EBAY-C-MARKETPLACE-ID header is needed to identify the eBay marketplace from which metadata will be retrieved. Compatibility methods will only retrieve data for marketplaces that support parts compatibility
  - The leaf category is specified through the categoryId field.
  - With the getCompatibilitySearchValues method, a property name such as Make or Model must be input into the propertyName field to retrieve the values for that property name on that marketplace.
  - The propertyFilters array in the getCompatibilitySearchValues method is used to further filter the property values that will be returned. For example, you might want to only see the vehicle Makes from the year 1957, so you would include the propertyName field and set it to "Year" and include the propertyValue field and set it to "1957".
Related Patterns:
- Full traditional doc extract: references/operations/getCompatibilitySearchValues_doc.md
- Full modern doc notes: references/operations/getCompatibilityPropertyValues_doc.md
- Full modern example: references/operations/getCompatibilityPropertyValues_example.md

### getCompatibilitySearchValuesBulk -> getMultiCompatibilityPropertyValues
Purpose:
- Retrieve supported values for several compatibility properties in one request.

Modern API:
- Sell Metadata `getMultiCompatibilityPropertyValues`.

Key Differences:
- The modern flow has an explicit bulk compatibility-value method instead of repeated SOAP value searches.

Request Payload Transformation:

- Traditional: [getCompatibilitySearchValuesBulk_example.md](operations/getCompatibilitySearchValuesBulk_example.md)
- Modern: [getMultiCompatibilityPropertyValues_example.md](operations/getMultiCompatibilityPropertyValues_example.md)



Response Payload Transformation:

- Traditional: [getCompatibilitySearchValuesBulk_example.md](operations/getCompatibilitySearchValuesBulk_example.md)
- Modern: [getMultiCompatibilityPropertyValues_example.md](operations/getMultiCompatibilityPropertyValues_example.md)



Migration Guide:
- getCompatibilitySearchValuesBulk maps to getMultiCompatibilityPropertyValues method of Metadata API.
- The getCompatibilitySearchValuesBulk method works similarly to the getCompatibilitySearchValues method, except that multiple property names such as Make, Model, and Year can be specified through the `propertyNames` array, and then each vehicle that matches the specified attributes is returned under a separate `compatibilityDetails` node.
Related Patterns:
- Full traditional doc extract: references/operations/getCompatibilitySearchValuesBulk_doc.md
- Full modern doc notes: references/operations/getMultiCompatibilityPropertyValues_doc.md
- Full modern example: references/operations/getMultiCompatibilityPropertyValues_example.md

### getProductCompatibilities -> getProductCompatibilities
Purpose:
- Retrieve compatibilities associated with a specific product identity.

Modern API:
- Sell Metadata `getProductCompatibilities`.

Key Differences:
- The modern call keeps the same high-level intent but moves to REST JSON and current compatibility resources.

Request Payload Transformation:

- Traditional: [getProductCompatibilities_example.md](operations/getProductCompatibilities_example.md)
- Modern: [getProductCompatibilities_example.md](operations/getProductCompatibilities_example.md)



Response Payload Transformation:

- Traditional: [getProductCompatibilities_example.md](operations/getProductCompatibilities_example.md)
- Modern: [getProductCompatibilities_example.md](operations/getProductCompatibilities_example.md)



Migration Guide:
- getProductCompatibilities maps to getProductCompatibilities method of Metadata API.
- The getProductCompatibilities method requires that a motor vehicle part or accessory is identified through the `productIdentifier` container using an ePID or a GTIN ID. This method also has filters, pagination, and sorting available.
Related Patterns:
- Full traditional doc extract: references/operations/getProductCompatibilities_doc.md
- Full modern doc notes: references/operations/getProductCompatibilities_doc.md
- Full modern example: references/operations/getProductCompatibilities_example.md

## Catalog And Charity Discovery

### GetCharities (Decommissioned) -> getCharityOrg + getCharityOrgs
Purpose:
- Search and retrieve charity organizations that can be attached to listing flows.

Modern API:
- Charity `getCharityOrg` and `getCharityOrgs`.

Key Differences:
- The old traditional lookup is decommissioned in the authoritative inventory.
- Modern charity discovery still supports the business need, but the status does not silently change.
- The bundled `getCharityOrgs` example now contains concrete query-based and registration-ID-based search examples; use those as supporting evidence only because the inventory row remains `Decommission`.

Request Payload Transformation:

- Traditional: [GetCharities_doc.md](operations/GetCharities_doc.md)
- Modern: [getCharityOrg_example.md](operations/getCharityOrg_example.md), [getCharityOrgs_example.md](operations/getCharityOrgs_example.md)

Response Payload Transformation:

- Traditional: [GetCharities_doc.md](operations/GetCharities_doc.md)
- Modern: [getCharityOrg_example.md](operations/getCharityOrg_example.md), [getCharityOrgs_example.md](operations/getCharityOrgs_example.md)

Related Patterns:
- Full traditional doc extract: references/operations/GetCharities_doc.md
- Full modern doc notes: references/operations/getCharityOrg_doc.md, references/operations/getCharityOrgs_doc.md
- Full modern examples: references/operations/getCharityOrg_example.md, references/operations/getCharityOrgs_example.md
- `references/operations/getCharityOrgs_example.md` now includes concrete request/response samples for charity search by query and by registration ID.

### findProducts -> search
Purpose:
- Search the catalog for product candidates by category, keywords, or property filters.

Modern API:
- Catalog `search`.

Key Differences:
- The modern search flow is REST and catalog-oriented.
- This package's migration guidance notes support for motors use cases.

Request Payload Transformation:

- Traditional: [findProducts_example.md](operations/findProducts_example.md)
- Modern: [search_example.md](operations/search_example.md)



Response Payload Transformation:

- Traditional: [findProducts_example.md](operations/findProducts_example.md)
- Modern: [search_example.md](operations/search_example.md)



Note: Full response shape details (nested fields) are in shared type documentation referenced by Catalog_search.md. The `productSummaries` top-level field is confirmed by the bundled doc page.

Migration Guide:
- findProducts maps to search method of Catalog API
- Key things to know about the search method:
  - The q query parameter is used to specify a search string, and eBay will scan the title, description, and item specifics fields in listings looking for matches.
  - If a user has a GTIN value, the gtin query parameter can be used to specify that GTIN ID to see if an eBay catalog product match is found.
  - The mpn query parameter can also be used to specify a Manufacturer Part Number, but this filter must be paired up with the q query parameter, where the user will generally pass in the brand of the part.
  - The aspect_filter query parameter allows the user to specify one or more item specific name-value pairs as part of the search.
  - The category_ids query parameter is used to retrieve only products associated with specific eBay categories.
  - The fieldgroups query parameter is used to control the type and amount of data that is retrieved for products.
  - The limit query parameter is used to control the maximum number of products retrieved per page of data, and the offset query parameter determines which page of data is retrieved.
Related Patterns:
- Full traditional doc extract: references/operations/findProducts_doc.md
- Full modern doc notes: references/operations/search_doc.md
- Full modern example: references/operations/search_example.md

### getProductDetails -> getProduct
Purpose:
- Retrieve details for a known product identity.

Modern API:
- Catalog `getProduct`.

Key Differences:
- The modern call is REST and directly keyed by product identity rather than SOAP request containers.

Request Payload Transformation:

- Traditional: [getProductDetails_example.md](operations/getProductDetails_example.md)
- Modern: [getProductCompatibilities_example.md](operations/getProductCompatibilities_example.md), [getProduct_example.md](operations/getProduct_example.md)



Response Payload Transformation:

- Traditional: [getProductDetails_example.md](operations/getProductDetails_example.md)
- Modern: [getProductCompatibilities_example.md](operations/getProductCompatibilities_example.md), [getProduct_example.md](operations/getProduct_example.md)


Note: The `getProduct` response shape is not available in the current bundled examples or doc pages. The bundled `Catalog_getProduct.md` describes the request only and references shared type documentation. Refer to references/operations/getProduct_doc.md for available details.

Migration Guide:
- getProductDetails does not have specific migration guidance in the migration_guide_for_pilot.md file. The operation is mapped to the getProduct method of Catalog API where the eBay Product ID (ePID) is passed in as path parameter.
Related Patterns:
- Full traditional doc extract: references/operations/getProductDetails_doc.md
- Full modern doc notes: references/operations/getProduct_doc.md
- Full modern example: references/operations/getProduct_example.md

## Decommissioned Product Metadata With No Replacement

### addProducts (Decommissioned) -> No replacement
Purpose:
- Submit products into the traditional product metadata flow.

Modern API:
- No replacement.

Key Differences:
- The authoritative inventory marks this traditional operation as decommissioned.
- No supported modern replacement appears in the bundled authoritative mapping inventory.

Related Patterns:
- Full traditional doc extract: references/operations/addProducts_doc.md

### getProductMetadataBulk (Decommissioned) -> No replacement
Purpose:
- Retrieve bulk product metadata from the deprecated product metadata service.

Modern API:
- No replacement.

Key Differences:
- The authoritative inventory marks this traditional operation as decommissioned.
- No supported modern replacement appears in the bundled authoritative mapping inventory.

Related Patterns:
- Full traditional doc extract: references/operations/getProductMetadataBulk_doc.md

### getProductSearchDataVersion (Decommissioned) -> No replacement
Purpose:
- Retrieve search-data version metadata for the deprecated product search flow.

Modern API:
- No replacement.

Key Differences:
- The authoritative inventory marks this traditional operation as decommissioned.
- No supported modern replacement appears in the bundled authoritative mapping inventory.

Related Patterns:
- Full traditional doc extract: references/operations/getProductSearchDataVersion_doc.md

### getProductSearchNames (Decommissioned) -> No replacement
Purpose:
- Retrieve searchable property names from the deprecated product metadata flow.

Modern API:
- No replacement.

Key Differences:
- The authoritative inventory marks this traditional operation as decommissioned.
- No supported modern replacement appears in the bundled authoritative mapping inventory.

Related Patterns:
- Full traditional doc extract: references/operations/getProductSearchNames_doc.md

### getProductSearchValues (Decommissioned) -> No replacement
Purpose:
- Retrieve searchable property values from the deprecated product metadata flow.

Modern API:
- No replacement.

Key Differences:
- The authoritative inventory marks this traditional operation as decommissioned.
- No supported modern replacement appears in the bundled authoritative mapping inventory.

Related Patterns:
- Full traditional doc extract: references/operations/getProductSearchValues_doc.md

### getProductSearchValuesBulk (Decommissioned) -> No replacement
Purpose:
- Retrieve bulk searchable property values from the deprecated product metadata flow.

Modern API:
- No replacement.

Key Differences:
- The authoritative inventory marks this traditional operation as decommissioned.
- No supported modern replacement appears in the bundled authoritative mapping inventory.

Related Patterns:
- Full traditional doc extract: references/operations/getProductSearchValuesBulk_doc.md

### getProductSubmissions (Decommissioned) -> No replacement
Purpose:
- Retrieve traditional product-submission state from the deprecated product metadata flow.

Modern API:
- No replacement.

Key Differences:
- The authoritative inventory marks this traditional operation as decommissioned.
- No supported modern replacement appears in the bundled authoritative mapping inventory.

Related Patterns:
- Full traditional doc extract: references/operations/getProductSubmissions_doc.md
