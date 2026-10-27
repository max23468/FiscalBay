---
title: Stores API
description: "Thie **Stores API** provides stores-related resources for third-party developers. These resources let you retrieve basic store information such as store name, description, store url, return store category hierarchy, add/rename/move/delete a single user's eBay store category, and retrieve the processing status of these tasks. The Stores API resource methods require an access token created with the [authorization code grant](https://developer.ebay.com/api-docs/static/oauth-authorization-code-grant.html) flow. See each method for their respective OAuth scopes."
api_version: 1
api_name: stores_api
api_type: REST
api_group: stores/api
source_url:
  html: https://developer.ebay.com/develop/api/stores/api
  md: https://developer.ebay.com/develop/api/stores/api.md
---
# Stores API

## API Methods

### moveStoreCategory

#### POST /store/categories/move_category
**Description:** This method is used to move an existing user's eBay store custom category by using an asynchronous request. A successful call returns the **getStoreTask** URI in the Location response header. The user calls **getStoreTask** to retrieve the status of the move category operation.  
  

**Important!** If you initiate a category change, you cannot make additional category changes until the previous change request has completed. Use the **getStoreTask** (or **getStoreTasks**) method to get the latest status of your last request.
**Parameters:**
- **Content-Type** (string) *required*
  - This header indicates the format of the request body provided by the client. Its value should be set to **application/json**.
**OAuth scope**

This request requires an access token created with the **Client Credentials Grant** flow, using one or more scopes from the following list (please check your Application Keys page for a list of OAuth scopes available to your application):

**Required Scopes:**

**Client Credentials Grant:**

- `https://api.ebay.com/oauth/api_scope/sell.stores`

## Error Codes

The following error codes may be returned by this API:

## Shared Types

Shared API-level schema and common type definitions live in [Stores API_shared.md](Stores API_shared.md).
