---
title: User
description: "The **User API** retrieves account information on an eBay user. The amount and type of data that is returned varies based on the account type, and the retrieved data is controlled by OAuth scopes."
api_version: 1.0
api_name: sell_user
api_type: GraphQL
api_group: sell/user
source_url:
  html: https://developer.ebay.com/develop/api/sell/user
  md: https://developer.ebay.com/develop/api/sell/user.md
---
# User API

The **User API** retrieves account information on an eBay user. The amount and type of data that is returned varies based on the account type, and the retrieved data is controlled by OAuth scopes.

## GraphQL Schema Information

**Queries:** 1
**Types:** 1394

## Queries

### user

Retrieves the user information for the current authenticated user.

**Returns:** `User`

**OAuth scope**

This request requires an access token created with the **Authorization Code Grant** flow, using one or more scopes from the following list (please check your Application Keys page for a list of OAuth scopes available to your application):

**Required Scopes:**

**Authorization Code Grant:**

- `https://api.ebay.com/oauth/api_scope/commerce.identity.address.readonly`
- `https://api.ebay.com/oauth/api_scope/commerce.identity.email.readonly`
- `https://api.ebay.com/oauth/api_scope/commerce.identity.name.readonly`
- `https://api.ebay.com/oauth/api_scope/commerce.identity.phone.readonly`
- `https://api.ebay.com/oauth/api_scope/commerce.identity.readonly`

## Shared Types

Shared API-level schema and common type definitions live in [User API_shared.md](User API_shared.md).
