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

### getImage

#### GET /image/{image_id}
**Description:** This method retrieves an EPS image URL and its expiration details for the unique identifier specified in the path parameter **image\_id**. Use the retrieved EPS image URL to add the image to a listing through the **Inventory API** or the **Trading API**. See [Managing images](/api-docs/sell/static/inventory/managing-image-media.html) for additional details.  
  
**Note:** If a user inputs a valid **image\_id** as a path parameter but the EPS image associated with that ID has expired, the call will fail and a **404 Not Found** status code will be returned.
**Parameters:**
- **image_id** (string) *required*
  - This path parameter is the unique identifier of a created image. Use the value returned in the location header of the method used to create the image (**createImageFromFile** or **createImageFromUrl**, as applicable).
**OAuth scope**

This request requires an access token created with the **Client Credentials Grant** flow, using one or more scopes from the following list (please check your Application Keys page for a list of OAuth scopes available to your application):

**Required Scopes:**

**Client Credentials Grant:**

- `https://api.ebay.com/oauth/api_scope/sell.inventory`

## Shared Types

Shared API-level schema and common type definitions live in [Media API_shared.md](Media API_shared.md).
