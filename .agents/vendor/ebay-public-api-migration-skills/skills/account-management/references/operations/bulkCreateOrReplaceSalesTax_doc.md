---
title: Account API v1
description: "The Account API v1 helps sellers configure and manage the core selling settings that power their eBay business. This API centralizes seller account configuration, including business policies (payment, fulfillment, and return), sales tax tables, custom compliance policies, and key account-level attributes like selling limits, subscriptions, and payments program status. Specifically, the API provides REST endpoints to create, update, and retrieve seller business policies, manage sales tax entries by jurisdiction, define and maintain custom policies, and access seller-level data such as advertising program eligibility, selling privileges and limits, managed payments onboarding status, and shipping rate tables. By externalizing these controls, partners and sellers can keep account settings consistent and reusable across listings, marketplaces, and tools. This API is exposed as a REST service under the `/sell/account/v1` base path. It uses standard HTTP methods and JSON payloads, allowing you to automate account configuration workflows, ensure listing policies stay in sync with your back-office systems, and build tools that keep eBay account settings aligned with your business rules. ### How to get started * Review the Account API v1 reference at: [https://developer.ebay.com/develop/api/account/api](https://developer.ebay.com/develop/api/account/api) * Sign in to your eBay developer account and use the API Explorer to exercise key operations like creating payment, fulfillment, and return policies, and retrieving existing policies and rate tables: [https://developer.ebay.com/my/api\\_test\\_tool](https://developer.ebay.com/my/api_test_tool) * Use the business policy IDs (paymentPolicyId, fulfillmentPolicyId, returnPolicyId) and rateTableId values returned by this API when creating or revising listings via the Selling APIs, so your listings always reference the correct account-level settings. * For marketplace- and category-specific constraints (for example, valid return periods or shipping regions), combine the Account API with the Metadata API to validate your configurations before applying them at scale. **NOTE:** The Account API v1 is part of the Sell APIs and is intended for managing account-level configuration, not for creating or revising individual listings. Use it together with listing-focused APIs (such as Inventory or Trading/Listing APIs) to ensure that all listings consistently follow your centralized payment, shipping, return, and tax policies across eBay marketplaces."
api_version: v1.9.3
api_name: account_api_v1
api_type: REST
api_group: account/api
source_url:
  html: https://developer.ebay.com/develop/api/account/api
  md: https://developer.ebay.com/develop/api/account/api.md
---
# Account API v1 API

## API Methods

### bulkCreateOrReplaceSalesTax

#### POST /bulk_create_or_replace_sales_tax
**Description:** This method creates or updates multiple sales-tax table entries.  
  
_Sales-tax tables_ can be set up for countries that support different _tax jurisdictions_.  
  
**Note:** Sales-tax tables are only available for the US (EBAY\_US) and Canada (EBAY\_CA) marketplaces.  
Each sales-tax table entry comprises the following parameters:

*   `countryCode`
*   `jurisdictionId`
*   `salesTaxPercentage`
*   `shippingAndHandlingTaxed`

  
Valid jurisdiction IDs are retrieved using **[getSalesTaxJurisdictions](/api-docs/sell/metadata/resources/country/methods/getSalesTaxJurisdictions)** in the Metadata API.  
  
For details about using this call, refer to [Establishing sales-tax tables](/api-docs/sell/static/seller-accounts/tax-tables.html).  
  

**Important!** In the US, eBay now calculates, collects, and remits sales tax to the proper taxing authorities in all 50 states and Washington, DC. Sellers can no longer specify sales-tax rates for these jurisdictions using a tax table.  
  
However, sellers may continue to use a sales-tax table to set rates for the following US territories:

*   American Samoa (AS)
*   Guam (GU)
*   Northern Mariana Islands (MP)
*   Palau (PW)
*   US Virgin Islands (VI)

For additional information, refer to [Taxes and import charges](https://www.ebay.com/help/selling/fees-credits-invoices/taxes-import-charges?id=4121 ).
**OAuth scope**

This request requires an access token created with the **Client Credentials Grant** flow, using one or more scopes from the following list (please check your Application Keys page for a list of OAuth scopes available to your application):

**Required Scopes:**

**Client Credentials Grant:**

- `https://api.ebay.com/oauth/api_scope/sell.account`

## Shared Types

Shared API-level schema and common type definitions live in [Account API v1_shared.md](Account API v1_shared.md).
