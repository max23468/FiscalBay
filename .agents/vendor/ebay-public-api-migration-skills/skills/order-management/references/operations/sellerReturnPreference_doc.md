---
title: Return Rules
description: "The **Return Rules API** helps sellers automate eBay returns using predefined criteria such as return reason, item price, or listing groups so they can automatically accept requests, provide shipping labels, or refund low-cost items (to reduce manual work). Listing groups are reusable sets of listings that can be targeted by automation rules, and can be created, updated, or deleted. You can update rule conditions or names, reorder priorities, enable or disable rules, and delete rules to maintain consistent, prioritized workflows. **Note:** New response and return-to-address rules are appended and evaluated after existing enabled rules."
api_version: 1.0
api_name: return_rules
api_type: GraphQL
api_group: return/rules
source_url:
  html: https://developer.ebay.com/develop/api/return/rules
  md: https://developer.ebay.com/develop/api/return/rules.md
---
# Return Rules API

The **Return Rules API** helps sellers automate eBay returns using predefined criteria such as return reason, item price, or listing groups so they can automatically accept requests, provide shipping labels, or refund low-cost items (to reduce manual work). Listing groups are reusable sets of listings that can be targeted by automation rules, and can be created, updated, or deleted.

  

You can update rule conditions or names, reorder priorities, enable or disable rules, and delete rules to maintain consistent, prioritized workflows.

  

**Note:** New response and return-to-address rules are appended and evaluated after existing enabled rules.

## GraphQL Schema Information

**Queries:** 2
**Mutations:** 11
**Types:** 1394

## Queries

### sellerReturnPreference

The \*\*sellerReturnPreference\*\* query retrieves the return preferences set by a seller on a specified marketplace. Sellers can use this query to view the preferences that control or automate steps in the return process. If a marketplace is not provided in the query, preferences for \`EBAY\_US\` are returned.

**Returns:** `SellerReturnPreferenceOutput!`

**Arguments:**
- **input** (SellerReturnPreferenceInput!)

**OAuth scope**

This request requires an access token created with the **Authorization Code Grant** flow, using one or more scopes from the following list (please check your Application Keys page for a list of OAuth scopes available to your application):

**Required Scopes:**

**Authorization Code Grant:**

- `https://api.ebay.com/oauth/api_scope/sell.return.preference`

## Shared Types

Shared API-level schema and common type definitions live in [Return Rules API_shared.md](Return Rules API_shared.md).
