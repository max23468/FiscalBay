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

### getStoreTasks

#### GET /store/tasks
**Description:** This method retrieves the status of all async store tasks for a store. Every task is set as `FAILED` or `COMPLETED` once its execution time reaches 24 hours.
**OAuth scope**

This request requires an access token created with the **Client Credentials Grant** flow, using one or more scopes from the following list (please check your Application Keys page for a list of OAuth scopes available to your application):

**Required Scopes:**

**Client Credentials Grant:**

- `https://api.ebay.com/oauth/api_scope/sell.stores`

## Shared Types

Shared API-level schema and common type definitions live in [Stores API_shared.md](Stores API_shared.md).
