---
title: Catalog API
description: "The **Catalog API** allows users to search for and locate an eBay catalog product that is a direct match for the product that they wish to sell. Listing against an eBay catalog product helps insure that all listings (based off of that catalog product) have complete and accurate information. In addition to helping to create high-quality listings, another benefit to the seller of using catalog information to create listings is that much of the details of the listing will be prefilled, including the listing title, the listing description, the item specifics, and a stock image for the product (if available). Sellers will not have to enter item specifics themselves, and the overall listing process is a lot faster and easier."
api_version: v1_beta.5.3
api_name: catalog_api
api_type: REST
api_group: catalog/api
source_url:
  html: https://developer.ebay.com/develop/api/catalog/api
  md: https://developer.ebay.com/develop/api/catalog/api.md
---
# Catalog API

## API Methods

### getProduct

#### GET /product/{epid}
**Description:** This method retrieves details of the catalog product identified by the eBay product identifier (ePID) specified in the request. These details include the product's title and description, aspects and their values, associated images, applicable category IDs, and any recognized identifiers that apply to the product.  
  
For a new listing, you can use the **search** method to identify candidate products on which to base the listing, then use the **getProduct** method to present the full details of those candidate products to the seller to make a a final selection.
**Parameters:**
- **X-EBAY-C-MARKETPLACE-ID** (string)
  - This method uses the `X-EBAY-C-MARKETPLACE-ID` header to identify the seller's eBay marketplace. The Catalog API is supported in the following marketplaces:

*   Australia (EBAY\_AU)
*   Canada (EBAY\_CA)
*   Germany (EBAY\_DE)
*   Spain (EBAY\_ES)
*   France (EBAY\_FR)
*   Great Britain (EBAY\_GB)
*   Italy (EBAY\_IT)
*   US (EBAY\_US and EBAY\_MOTORS\_US)
- **epid** (string) *required*
  - The eBay product identifier (ePID) of the product being requested. This value can be discovered by issuing the **search** method and examining the value of the **productSummaries.epid** field for the desired returned product summary.
**OAuth scope**

This request requires an access token created with the **Client Credentials Grant** flow, using one or more scopes from the following list (please check your Application Keys page for a list of OAuth scopes available to your application):

**Required Scopes:**

**Client Credentials Grant:**

- `https://api.ebay.com/oauth/api_scope/commerce.catalog.readonly`
- `https://api.ebay.com/oauth/api_scope/sell.inventory`

## Shared Types

Shared API-level schema and common type definitions live in [Catalog API_shared.md](Catalog API_shared.md).
