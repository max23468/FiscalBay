---
title: Account API v2
description: "The Account API v2 helps sellers manage their shipping logistics, seller preferences, and payout settings through a single set of REST endpoints. This API focuses on shipping rate tables and combined-shipping discounts, seller-level preferences (like combined payments, same-day shipping cut-off times, and unpaid item handling), and, for eligible sellers in mainland China, configuring split payouts across two payment instruments. Specifically, the API lets you define and maintain shipping rate tables by marketplace and region, including service-level categories, per-item or weight-based rates, and regional surcharges. It also supports creating and updating combined-shipping rules (calculated, flat, and promotional) that control how shipping and handling fees are discounted when buyers purchase multiple items in a single order. In addition, you can read and update seller preferences such as combined payment settings, dispatch cut-off time for same-day shipping, unpaid item automation, and carrier rate options, as well as retrieve and adjust payout split percentages across two active payout instruments in supported regions. This API is exposed as a REST service under the `/sell/account/v2` base path, using standard HTTP methods and JSON payloads. It is designed to be used alongside listing and order APIs so you can centralize rate tables, shipping discounts, and payout rules at the account level and apply them consistently across all your eBay listings and marketplaces. ### How to get started * Review the Account API v2 reference: [https://developer.ebay.com/develop/api/account/api](https://developer.ebay.com/develop/api/account/api) * Sign in to your eBay developer account and use the API Explorer to test key operations such as managing rate tables, combined-shipping rules, user preferences, and payout settings in your chosen environment: [https://developer.ebay.com/my/api\\_test\\_tool](https://developer.ebay.com/my/api_test_tool) * Use the `rateTableId`, `rateId`, and combined-shipping rule configurations returned by this API when creating or updating listings so that shipping costs and discounts are driven from centrally managed tables and rules rather than per-listing overrides. * For marketplace-specific behaviors—such as Global Shipping Program availability, carrier rate options, and supported rate calculation types—combine Account API v2 with metadata and shipping documentation to validate configurations before rolling them out broadly. **NOTE:** Some features in Account API v2 are marketplace- or region-specific—for example, Global Shipping Program and carrier rate preferences are limited to certain marketplaces, and split payout configuration is currently supported only for eligible sellers in mainland China. Be sure to check marketplace constraints when designing cross-market integrations."
api_version: 2.2.0
api_name: account_api_v2
api_type: REST
api_group: account/api
source_url:
  html: https://developer.ebay.com/develop/api/account/api
  md: https://developer.ebay.com/develop/api/account/api.md
---
# Account API v2 API

## API Methods

### updateCalculatedShippingRules

#### POST /combined_shipping_rules/update_calculated_shipping_rules
**Description:** This method can be used to update previously defined calculated shipping rules to modify discount percentages, weight offsets, or amount parameters for the seller.
**Parameters:**
- **X-EBAY-C-MARKETPLACE-ID** (string) *required*
  - This header identifies the eBay marketplace identifier for which the API request is being executed (e.g., `EBAY_US`, `EBAY_GB`, `EBAY_DE`).  
  
For the full list of eBay marketplace values, see the [MarketplaceIdEnum](/api-docs/sell/account/v2/types/ba:MarketplaceIdEnum  ).
**OAuth scope**

This request requires an access token created with the **Client Credentials Grant** flow, using one or more scopes from the following list (please check your Application Keys page for a list of OAuth scopes available to your application):

**Required Scopes:**

**Client Credentials Grant:**

- `https://api.ebay.com/oauth/api_scope/sell.account`

## Shared Types

Shared API-level schema and common type definitions live in [Account API v2_shared.md](Account API v2_shared.md).
