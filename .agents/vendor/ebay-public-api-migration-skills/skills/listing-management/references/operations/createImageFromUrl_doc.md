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

### createImageFromUrl

#### POST /image/create_image_from_url
**Description:** This method uploads a picture to eBay Picture Services (EPS) from the specified URL. Specify the location of the picture on an external web server through the **imageUrl** field.

All images must comply with eBay’s picture requirements, such as dimension and file size restrictions. For more information, see [Picture policy](https://www.ebay.com/help/policies/listing-policies/picture-policy?id=4370). The image formats supported are **JPG**, **GIF**, **PNG**, **BMP**, **TIFF**, **AVIF**, **HEIC**, and **WEBP**. In addition, the provided URL must be secured using HTTPS (HTTP is not permitted). For more information, see [Image requirements](/api-docs/sell/static/inventory/managing-image-media.html#image-requirements).

**Note:** Animated GIF, and multi-page PNG/TIFF files, are not supported. Any animation effect of supported formats will be lost upon upload.

When an EPS image is successfully created, the method returns the HTTP Status Code `201 Created`. The method also returns the getImage URI in the **Location** response header.

**Important!** Make sure to capture the image ID URI returned in the response [location header](/api-docs/commerce/media/resources/image/methods/createImageFromUrl#h2-output) provided in the following format:

`https://apim.ebay.com/commerce/media/v1_beta/image/_{image_id}_`

You can capture the entire URI, or just save the `{image_id}` only. Pass the `{image_id}` as a path parameter in the **[getImage](/api-docs/commerce/media/resources/image/methods/getImage)** method to return the value needed to associate an image to a listing using the Trading and Inventory APIs.

See [Managing images](/api-docs/sell/static/inventory/managing-image-media.html) for additional details.

  

**Important!**All POST methods in the Media API, including this method, are subject to short-duration rate limits at the user level: 50 requests per 5 seconds.
**Parameters:**
- **Content-Type** (string) *required*
  - This header indicates the format of the request body provided by the client. Its value should be set to **application/json**.  
  
For more information, refer to [HTTP request headers](/api-docs/static/rest-request-components.html#HTTP).
**OAuth scope**

This request requires an access token created with the **Client Credentials Grant** flow, using one or more scopes from the following list (please check your Application Keys page for a list of OAuth scopes available to your application):

**Required Scopes:**

**Client Credentials Grant:**

- `https://api.ebay.com/oauth/api_scope/sell.inventory`

## Shared Types

Shared API-level schema and common type definitions live in [Media API_shared.md](Media API_shared.md).
