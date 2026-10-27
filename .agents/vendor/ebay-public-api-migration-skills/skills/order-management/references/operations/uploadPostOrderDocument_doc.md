---
title: Media API
description: "API documentation and reference"
api_version: v1_beta.5.0
api_name: media_api
api_type: REST
api_group: media/api
source_url:
  html: https://developer.ebay.com/develop/api/media/api
  md: https://developer.ebay.com/develop/api/media/api.md
---
# Media API

## API Methods

### uploadPostOrderDocument

#### POST /post_order/document
**Description:** This method uploads a document for post‑order processes (for example, a seller providing a return shipping label).

Supported file types include .PDF, .JPEG/.JPG, .BMP, .GIF and .PNG, with a maximum file size of 5 MB (5,242,880 bytes).

**Note:** This method is currently restricted and requires a special [OAuth scope](#h3-oauth-scope) not available to all users.

**Note:** Animated and multi-page PNG files are not currently supported. For multi-page content, use PDF. The maximum number of pages allowed varies by the **documentUsageType**.

Send a multipart/form‑data request with:

*   **file**: the document file (`key: file`)
*   **documentUsageType**: for example, `RETURN_SHIPPING_LABEL`
*   **entityType**: for example, `RETURNS`
*   **entityId**: the unique identifier for the post-order entity

A successful call returns the HTTP Status Code **201 Created** with the document ID in the **Location header** (no response body is returned). The document’s initial state is **SUBMITTED**. When its identifier is associated with a post-order entity through an eBay GraphQL mutation, the state changes to **PUBLISHED**.

**Note:** A post-order entity is part of eBay's order management for activities after purchase (such as returns).

**Important!**  

*   Capture and retain the **documentId** in the response’s [Location header](#h3-response-headers). It is required to use the other **post\_order** methods and to associate the document with a post-order entity.
*   All documents (published or submitted) expire and become inaccessible after their expiration date.
*   All **POST** methods in the **Media API**, including this method, are subject to short-duration, user-level rate limits: 50 requests per 5 seconds.
**Parameters:**
- **Content-Type** (string) *required*
  - This header indicates the format of the request body provided by the client. Its value should be set to **multipart/form-data**.  
  
For more information, refer to [HTTP request headers](/api-docs/static/rest-request-components.html#HTTP).
**OAuth scope**

This request requires an access token created with the **Client Credentials Grant** flow, using one or more scopes from the following list (please check your Application Keys page for a list of OAuth scopes available to your application):

**Required Scopes:**

**Client Credentials Grant:**

- `https://api.ebay.com/oauth/api_scope/commerce.post_order.document`

## Error Codes

The following error codes may be returned by this API:

## Shared Types

Shared API-level schema and common type definitions live in [Media API_shared.md](Media API_shared.md).
