---
api_title: Browse API
api_version: v1.20.4
api_name: browse_api
api_group: browse
doc_kind: split_shared_reference
---

# Browse API Shared Content

## Shared Authentication

### Authentication

- **type** (oauth2)
- **description** (The security definitions for this API. Please check individual operations for applicable scopes.)
- **clientCredentials** ({"tokenUrl":"https://api.ebay.com/identity/v1/oauth2/token","scopes":{"https://api.ebay.com/oauth/api_scope/buy.item.bulk":"Retrieve eBay items in bulk.","https://api.ebay.com/oauth/api_scope":"View public data from eBay"}})

## Shared Error Codes

## Error Codes

The following error codes may be returned by this API:

### REQUEST Errors

#### 12001 - API_BROWSE
**Description:** The call must have a valid 'q', 'category\_ids', 'epid' or 'gtin' query parameter.

#### 12004 - API_BROWSE
**Description:** The 'offset' value cannot be negative.

#### 12005 - API_BROWSE
**Description:** The 'offset' value must be an integer.

#### 12006 - API_BROWSE
**Description:** The 'limit' value should be between 1 and 200 (inclusive).

#### 12007 - API_BROWSE
**Description:** The 'limit' value must be an integer value.

#### 12023 - API_BROWSE
**Description:** This keyword search results in a response that is too large to return. Either change the keyword or add additional query parameters and/or filters.

#### 12025 - API_BROWSE
**Description:** The 'charity\_ids' field has exceeded the maximum limit of 20.

#### 12026 - API_BROWSE
**Description:** The 'charity\_ids' field is not supported for the marketplace {marketplaceId}. Valid marketplaces are: {validMarketplaces}.

#### 12027 - API_BROWSE
**Description:** The 'auto\_correct' value is invalid. For the valid values, refer to the API call documentation.

#### 12028 - API_BROWSE
**Description:** The 'auto\_correct' is not supported for the marketplace {marketplaceId}. Valid marketplaces are: {validMarketplaces}

#### 12029 - API_BROWSE
**Description:** The maximum number of listings that can be retrieved is 10,000, so your offset value must be less than 10,000. If 10,000 or more listings are matching your search criteria, consider narrowing the scope of your search.

#### 12030 - API_BROWSE
**Description:** The number of categories in the request has exceeded the limit. Please reduce the number of categories to {allowedMaxCategories} or less.

#### 12032 - API_BROWSE
**Description:** The number of sellers in the filter has exceeded the limit. Please reduce the number of sellers to 250 or fewer.

#### 12033 - API_BROWSE
**Description:** The 'qualifiedPrograms' filter for {filterValue} requires valid 'deliveryPostalCode' and 'deliveryCountry' filter values.

#### 12034 - API_BROWSE
**Description:** The 'buyingOptions' filter value {filterValue} is not supported for the sort by {sortOption}. For the supported values, refer to the API call documentation.

#### 12503 - API_BROWSE
**Description:** There is no compatibility information found either because there is no compatibility results or the data provided in the compatibility\_filter is invalid or insufficient.

#### 12504 - API_BROWSE
**Description:** You must provide a category ID that supports fitment.

#### 12505 - API_BROWSE
**Description:** The following compatibility attributes in the request are not supported: {attributes}.

#### 12506 - API_BROWSE
**Description:** The category ID submitted does not support fitment.

#### 12507 - API_BROWSE
**Description:** To filter by 'guaranteedDeliveryInDays', you must include 'deliveryCountry'.

#### 12508 - API_BROWSE
**Description:** To filter by 'guaranteedDeliveryInDays', you must include 'deliveryPostalCode' for the 'deliveryCountry'.

#### 12509 - API_BROWSE
**Description:** The 'guaranteedDeliveryInDays' value {guaranteedDeliveryInDays} is invalid for 'deliveryCountry' value {deliveryCountry}. Valid values for 'guaranteedDeliveryInDays' for {deliveryCountry} must be in the range of {rangeLowerBound} to {rangeUpperBound} inclusive.

#### 12510 - API_BROWSE
**Description:** The 'guaranteedDeliveryInDays' filter is not supported for the marketplace {marketplaceId}. Valid marketplaces are: {validMarketplaces}

#### 12512 - API_BROWSE
**Description:** The 'qualifiedPrograms' filter for {filterValue} is not supported for the marketplace {marketplaceId}. Valid marketplaces are: {validMarketplaces}

#### 12515 - API_BROWSE
**Description:** The 'offset' value must be either zero or a multiple of the 'limit' value.

#### 12516 - API_BROWSE
**Description:** The ‘q’ value is invalid. It must be longer than one character when using the ‘searchInDescription’ filter.

#### 12517 - API_BROWSE
**Description:** Only one item location filter can be applied at a time. Refer to the API call documentation.

#### 12518 - API_BROWSE
**Description:** The 'itemLocationRegion' filter value is not supported for the marketplace {marketplaceId}. Valid values are: {validRegionValues}

#### 12500 - API_BROWSE
**Description:** This image search results in a response that is too large to return. Either change the image or add additional query parameters and/or filters.

#### 12501 - API_BROWSE
**Description:** The image data is empty, is not Base64 encoded, or is invalid.

#### 11001 - API_BROWSE
**Description:** The specified item ID was not found.

#### 11002 - API_BROWSE
**Description:** The specified item group was not found.

#### 11004 - API_BROWSE
**Description:** The item is not available for purchase. This can be for many reasons, such as when the listing is being updated by the seller. Wait a few minutes and try the call again.

#### 11005 - API_BROWSE
**Description:** The item group ID is invalid. Use {itemHref} to get the item details.

#### 11008 - API_BROWSE
**Description:** The item group is not available. This can be for many reasons, such as when the listing is being updated by the seller. Wait a few minutes and try the call again.

#### 11011 - API_BROWSE
**Description:** The marketplace value {marketplaceId} is not supported. The supported values are: {allowedMarketplaces}

#### 11012 - API_BROWSE
**Description:** The specified item IDs are invalid, or the format of the specified values are invalid.

#### 11013 - API_BROWSE
**Description:** The specified group IDs are invalid, or the format of the specified values are invalid.

#### 11014 - API_BROWSE
**Description:** An item\_ids and an item\_group\_ids list cannot be used at same time. Please use only one of these lists.

#### 11015 - API_BROWSE
**Description:** The maximum number of item ids has been exceeded. Please reduce the number of item ids to {maxAllowedItemIds} or less.

#### 11016 - API_BROWSE
**Description:** The maximum number of item group IDs has been exceeded. Please reduce the number of item group ids to {maxAllowedItemGroupIds} or less.

#### 11018 - API_BROWSE
**Description:** The specified fieldgroups are invalid. The COMPACT fieldgroup cannot be combined with another fieldgroup.

#### 11019 - API_BROWSE
**Description:** The quantity\_for\_shipping\_estimate value {quantityForShippingEstimate} is invalid. Please enter a positive value.

#### 11501 - API_BROWSE
**Description:** The 'fieldgroups' value(s) are invalid: {fieldgroups}. The supported fieldgroups are: {supportedFieldgroups}

#### 11003 - API_BROWSE
**Description:** The specified legacy item ID was not found.

#### 11006 - API_BROWSE
**Description:** The legacy ID is invalid. Use {itemGroupHref} to get the item group details.

#### 11009 - API_BROWSE
**Description:** The legacy variation sku is invalid.

#### 11010 - API_BROWSE
**Description:** You cannot submit legacy\_variation\_sku and legacy\_variation\_id in the same request. For help, see the documentation.

#### 11017 - API_BROWSE
**Description:** An item\_ids or an item\_group\_ids list is required. Please use one of these lists.

#### 11503 - API_BROWSE
**Description:** The request is either empty or incomplete. For help, see the documentation for this call.

#### 11505 - API_BROWSE
**Description:** The item is not valid for compatibility validation.

#### 11506 - API_BROWSE
**Description:** The 'name' {compatibilityNames} appears more than once in the request.

#### 11507 - API_BROWSE
**Description:** The following name(s) in the request are not supported {attributes}.

### BUSINESS Errors

#### 12013 - API_BROWSE
**Description:** Top level category browsing is not allowed. Please provide keywords or more filters for the applied top level category.

#### 12019 - API_BROWSE
**Description:** Currently, the {marketplaceId} marketplace is not supported. The supported Marketplaces are: {allowedMarketplaces} .

#### 12020 - API_BROWSE
**Description:** The 'fieldgroups' value {fieldgroups} is invalid when multiple 'category\_ids' are specified. Either change the call to have only one value in 'category\_ids' or remove the 'fieldgroups'.

#### 12513 - API_BROWSE
**Description:** The 'priorityListing' filter for {filterValue} is not supported for the marketplace {marketplaceId}. Valid marketplaces are: {validMarketplaces}

#### 12514 - API_BROWSE
**Description:** The 'priorityListing' filter is not supported for the specified sort option. Refer to the API call documentation.

### APPLICATION Errors

#### 12000 - API_BROWSE
**Description:** There was a problem with an eBay internal system or process. Contact eBay developer support for assistance.

#### 11000 - API_BROWSE
**Description:** There was a problem with an eBay internal system or process. Contact eBay developer support for assistance.

## Shared Types Reference

This aggregated REST API source document includes shared type definitions.

- Source file: `/Users/eliu1/code/ebay-migration-skill-creator/src-skills/api-guide-generator/references/rest_doc/browse_api.md`
- Shared types section: `## Types`

Refer to the original source document for full shared type definitions.
