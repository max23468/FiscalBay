---
title: Identity API
description: "The **Identity API** returns data for an authenticated user (user access token) based on the OAuth scopes provided. Non-confidential information, such as eBay `userID` is returned using the default scope. Confidential data for an individual, such as address, email, phone, etc. are returned based on the OAuth scope you use in the call. For business users, all the public business information is returned using the default OAuth scope. The Identity API can be used to let users log into your app or site using eBay, which frees you from needing to store and protect user's PII (Personal Identifiable Information) data."
api_version: v2.0.0
api_name: identity_api
api_type: REST
api_group: identity/api
source_url:
  html: https://developer.ebay.com/develop/api/identity/api
  md: https://developer.ebay.com/develop/api/identity/api.md
---
# Identity API

## API Methods

### getUser

#### GET /user/
**Description:** This method retrieves the account profile information for an authenticated user, which requires a **User access token**. What is returned is controlled by the **scopes**.

For a business account you use the default scope `commerce.identity.readonly`, which returns all the fields in the **businessAccount** container. These are returned because this is all public information.

For an individual account, the fields returned in the **individualAccount** container are based on the scope you use. Using the default scope, only public information, such as eBay user ID, are returned. For details about what each scope returns, see the **Identity API scopes**.
**OAuth scope**

This request requires an access token created with the **Client Credentials Grant** flow, using one or more scopes from the following list (please check your Application Keys page for a list of OAuth scopes available to your application):

**Required Scopes:**

**Client Credentials Grant:**

- `https://api.ebay.com/oauth/api_scope/commerce.identity.address.readonly`
- `https://api.ebay.com/oauth/api_scope/commerce.identity.email.readonly`
- `https://api.ebay.com/oauth/api_scope/commerce.identity.name.readonly`
- `https://api.ebay.com/oauth/api_scope/commerce.identity.phone.readonly`
- `https://api.ebay.com/oauth/api_scope/commerce.identity.readonly`
- `https://api.ebay.com/oauth/api_scope/commerce.identity.status.readonly`

## Error Codes

The following error codes may be returned by this API:

## Shared Types

Shared API-level schema and common type definitions live in [Identity API_shared.md](Identity API_shared.md).
