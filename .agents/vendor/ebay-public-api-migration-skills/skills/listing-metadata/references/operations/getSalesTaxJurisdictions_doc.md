---
title: Metadata API
description: "The **Metadata API** lets you retrieve metadata on eBay category policies, information on sales tax jurisdictions, and available hazardous material related label information. _Category policies_ are the eBay policies and guidelines for how you must list certain items in specific categories across the different eBay marketplaces. For example, if you are listing items with variations, you'll want to know which categories support multiple-variation listings. Another example is that you may want to know which item conditions are supported for different eBay categories. See [Finding the correct category ID and item condition for your item](/api-docs/sell/static/metadata/getting-metadata.html#s0-1-31-4-7-5-content) [](/api-docs/sell/metadata/overview.html#policies)for more information. Several countries have _sales tax jurisdictions_ where the tax rates across the different jurisdictions may vary. You can use the Metadata API to retrieve the lists of tax jurisdictions which you can then use to set up sales tax tables. See [Getting a list of tax jurisdictions](/api-docs/sell/static/metadata/getting-metadata.html#jurisdictions) for more information. Sellers have the ability to add _hazardous material related label_ information to their listings. See [Specifying hazardous material related information](/api-docs/sell/static/metadata/feature-regulatorhazmatcontainer.html) for more information."
api_version: v1.13.0
api_name: metadata_api
api_type: REST
api_group: metadata/api
source_url:
  html: https://developer.ebay.com/develop/api/metadata/api
  md: https://developer.ebay.com/develop/api/metadata/api.md
---
# Metadata API

## API Methods

### getSalesTaxJurisdictions

#### GET /country/{countryCode}/sales_tax_jurisdiction
**Description:** This method retrieves all sales-tax jurisdictions for the country specified in the **countryCode** path parameter. Countries with valid sales-tax jurisdictions are Canada and the US.  
  
The response from this call tells you the jurisdictions for which a seller can configure tax tables. Although setting up tax tables is optional, you can use the **createOrReplaceSalesTax** method in the **Account API** call to configure the tax tables for the jurisdictions into which you sell.  
  
**Note:** Sales-tax tables are only available for the US (EBAY\_US) and Canada (EBAY\_CA) marketplaces.  

**Important!** In the US, eBay now calculates, collects, and remits sales tax to the proper taxing authorities in all 50 states and Washington, DC. Sellers can no longer specify sales-tax rates for these jurisdictions using a tax table.  
  
However, sellers may continue to use a sales-tax table to set rates for the following US territories:

*   American Samoa (AS)
*   Guam (GU)
*   Northern Mariana Islands (MP)
*   Palau (PW)
*   US Virgin Islands (VI)

For additional information, refer to [Taxes and import charges](https://www.ebay.com/help/selling/fees-credits-invoices/taxes-import-charges?id=4121 ).
**Parameters:**
- **countryCode** (string) *required*
  - This path parameter specifies the two-letter [ISO 3166](https://www.iso.org/iso-3166-country-codes.html  "https://www.iso.org ") country code for the country whose jurisdictions you want to retrieve.  
  
**Note:** Sales-tax tables are available only for the US and Canada marketplaces. Therefore, the only supported values are:

*   `US`
*   `CA`
**OAuth scope**

This request requires an access token created with the **Client Credentials Grant** flow, using one or more scopes from the following list (please check your Application Keys page for a list of OAuth scopes available to your application):

**Required Scopes:**

**Client Credentials Grant:**

- `https://api.ebay.com/oauth/api_scope`

## Error Codes

The following error codes may be returned by this API:

## Shared Types

Shared API-level schema and common type definitions live in [Metadata API_shared.md](Metadata API_shared.md).
