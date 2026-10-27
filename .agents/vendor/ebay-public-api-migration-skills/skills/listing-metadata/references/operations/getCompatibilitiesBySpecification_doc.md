---
title: Metadata API
description: "The **Metadata API** lets you retrieve metadata on eBay category policies, information on sales tax jurisdictions, and available hazardous material related label information. _Category policies_ are the eBay policies and guidelines for how you must list certain items in specific categories across the different eBay marketplaces. For example, if you are listing items with variations, you'll want to know which categories support multiple-variation listings. Another example is that you may want to know which item conditions are supported for different eBay categories. See [Finding the correct category ID and item condition for your item](/api-docs/sell/static/metadata/getting-metadata.html#s0-1-31-4-7-5-content) [](/api-docs/sell/metadata/overview.html#policies)for more information. Several countries have _sales tax jurisdictions_ where the tax rates across the different jurisdictions may vary. You can use the Metadata API to retrieve the lists of tax jurisdictions which you can then use to set up sales tax tables. See [Getting a list of tax jurisdictions](/api-docs/sell/static/metadata/getting-metadata.html#jurisdictions) for more information. Sellers have the ability to add _hazardous material related label_ information to their listings. See [Specifying hazardous material related information](/api-docs/sell/static/metadata/feature-regulatorhazmatcontainer.html) for more information."
api_version: v1.13.0
api_name: metadata_api
api_type: REST
api_group: metadata/api
source_url:
  html: https://developer.ebay.com/develop/api/metadata/api
  md: https://developer.ebay.com/develop/api/metadata/api.md
---
# Metadata API

## API Methods

### getCompatibilitiesBySpecification

#### POST /compatibilities/get_compatibilities_by_specification
**Description:** This method is used to retrieve all compatible application name-value pairs for a part based on the provided specification(s).  
  
The part's relevant dimensions and/or characteristics can be provided through the **specifications** container. For example, when retrieving compatible application name-value pairs for a tire, the tire's dimensions (such as the section width or rim diameter) should be provided.  
  
By default, all compatible application name-value pairs for the specifications are returned. You can limit the size of the result set by using the **compatibilityPropertyFilters** array to specify the properties (such as make, model, year, or trim) you wish to be included in the response.  
  
**Note:** The [getCompatibilityPropertyNames](/develop/api/sell/metadata_api#sell-metadata_api-compatibilities%20-getcompatibilitypropertynames) and [getCompatibilityPropertyValues](/develop/api/sell/metadata_api#sell-metadata_api-compatibilities%20-getcompatibilitypropertyvalues) methods can be used to retrieve valid property names and values that can be used as the name-value pairs to define specifications.
**Parameters:**
- **X-EBAY-C-MARKETPLACE-ID** (string) *required*
  - This header identifies the seller's eBay marketplace.  
  
See [Marketplace ID values](/develop/api/sell/request_headers#marketplace-id-values) for a list of supported eBay marketplace ID values.
- **Content-Type** (string) *required*
  - This header indicates the format of the request body provided by the client.  
  
Its value should be set to `application/json`.  
  
For more information, refer to [Request Headers](/develop/api/sell/request_headers).
**OAuth scope**

This request requires an access token created with the **Client Credentials Grant** flow, using one or more scopes from the following list (please check your Application Keys page for a list of OAuth scopes available to your application):

**Required Scopes:**

**Client Credentials Grant:**

- `https://api.ebay.com/oauth/api_scope`

## Shared Types

Shared API-level schema and common type definitions live in [Metadata API_shared.md](Metadata API_shared.md).
