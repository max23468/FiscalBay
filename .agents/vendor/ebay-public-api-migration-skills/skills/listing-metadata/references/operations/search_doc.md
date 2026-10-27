---
api_title: Browse API
api_version: v1.20.4
api_name: browse_api
api_group: browse
method_name: search
http_method: GET
path: /item_summary/search
filename_resolution: fallback_api_name_and_method_name
doc_kind: split_reference
---
# search

## Metadata

- API Title: Browse API
- API Version: v1.20.4
- API Name: browse_api
- API Group: browse
- HTTP Method: GET
- Path: /item_summary/search
- Full Endpoint: /buy/browse/v1/item_summary/search
- JSONL Match: Not specified in source

## Description

This searches for eBay items by various query parameters and retrieves summaries of the items. You can search by keyword, category, eBay product ID (ePID), or GTIN, charity ID, or a combination of these.  
  
**Note:** Only listings where `FIXED_PRICE` (Buy It Now) is a buying option are returned by default. To retrieve listings that do not have `FIXED_PRICE` as a buying option, the `buyingOptions` filter can be used to retrieve those listings.  
  
Note that an auction listing enabled with the _Buy it Now_ feature will initially show `AUCTION` and `FIXED_PRICE` as buying options, but if/when that auction listing receives a qualifying bid, only `AUCTION` remains as a buying option. If this happens, the `buyingOptions` filter would need to be used to retrieve that auction listing.  
This method also supports the following:

*   Filtering by the value of one or multiple fields, such as listing format, item condition, price range, location, and more. For the fields supported by this method, refer to the [filter](#uri.filter) parameter.
*   Retrieving the refinements (metadata) of an item, such as item aspects (color, brand) condition, category, etc. using the [fieldgroups](#uri.fieldgroups) parameter.
*   Filtering by item aspects and other refinements using the [aspect\_filter](#uri.aspect_filter) parameter.
*   Filtering for items that are compatible with a specific product, using the [compatibility\_filter](#uri.compatibility_filter) parameter.
*   Creating aspects histograms, which enables shoppers to drill down in each refinement narrowing the search results.

For additional information and examples of these capabilities, refer to [Browse API](/api-docs/buy/static/api-browse.html) in the Buying Integration Guide.

## Request

#### GET /item_summary/search

**Parameters:**
Not specified in source

## Shared Content Reference

- Shared content file: `Browse API_shared.md`
- Method JSONL file: `Not specified in source`
- Request-related types: `Not specified in source`
- Response-related types: `Not specified in source`
- Included sections:
  - `Shared Authentication`
  - `Shared Error Codes`
  - `Shared Types Reference`

Refer to the shared content file for API-level authentication, shared error codes, and shared type reference material.
