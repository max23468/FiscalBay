---
api_title: Catalog
api_version: v1_beta.5.3
api_name: catalog
api_group: api
doc_kind: split_shared_reference
---

# Catalog Shared Content

## Shared Authentication

### Authentication

- **type** (oauth2)
- **description** (The security definitions for this API. Please check individual operations for applicable scopes.)

## Shared Error Codes

## Error Codes

The following error codes may be returned by this API:

### REQUEST Errors

#### 75007 - API_CATALOG
**Description:** Currently, the {marketplaceId} marketplace is not supported. The supported Marketplaces are: {allowedMarketplaces}.

#### 75010 - API_CATALOG
**Description:** The specified EPID value {epid} was not found.

#### 75011 - API_CATALOG
**Description:** The specified EPID value {epid} no longer exists. Its new value is {newepid}.

#### 75015 - API_CATALOG
**Description:** Insufficient permissions to fulfill the request.

#### 75016 - API_CATALOG
**Description:** The specified EPID value {epid} is no longer available.

#### 75001 - API_CATALOG
**Description:** The call must have a valid 'q', or 'category_ids' or 'gtin' or 'mpn' query parameter.

#### 75004 - API_CATALOG
**Description:** The 'limit' value should be between 1 and 200 (inclusive).

#### 75006 - API_CATALOG
**Description:** Top level category browsing is not allowed. Please provide keywords or more filters for the applied top level category.

#### 75008 - API_CATALOG
**Description:** The 'fieldgroups' value {fieldgroups} is invalid. The supported fieldgroups are: {supportedFieldgroups}

#### 75012 - API_CATALOG
**Description:** The aspect_filter format is invalid. For more information, see the API call reference documentation.

#### 75013 - API_CATALOG
**Description:** The 'aspect_filter' query parameter must include a categoryId. For more information, see the API call reference documentation.

#### 75014 - API_CATALOG
**Description:** The categoryId in 'aspect_filter' query parameter is invalid. For more information, see the API call reference documentation.

#### 75017 - API_CATALOG
**Description:** The specified GTIN value is invalid.

#### 75018 - API_CATALOG
**Description:** The call must be made with either 'q' or 'gtin/mpn'.

#### 75019 - API_CATALOG
**Description:** The call with 'gtin/mpn' cannot be made with aspect_filter.

### APPLICATION Errors

#### 75000 - API_CATALOG
**Description:** There was a problem with an eBay internal system or process. Contact eBay developer support for assistance.

## Shared Types Reference

This aggregated REST API source document includes shared type definitions.

- Source file: `/Users/eliu1/code/ebay-migration-skill-creator/src-skills/api-guide-generator/references/rest_doc/catalog.md`
- Shared types section: `## Types`

Refer to the original source document for full shared type definitions.
