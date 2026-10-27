# GET : getSiteVisibilityPolicies Samples
- [Sample 1: Get the eBay international site visibility policy metadata for a specified marketplace](#sample-1-get-the-ebay-international-site-visibility-policy-metadata-for-a-specified-marketplace)

---

## Sample 1: Get the eBay international site visibility policy metadata for a specified marketplace

This example retrieves the eBay international site visibility policy metadata for the three specified leaf categories, `9355` and `4959`, and `63855`.

This method returns an array of leaf categories from the category tree of the specified marketplace. Each node in the response contains metadata for the eBay international site visibility policies in each returned category.

### Input

This method does not use a request payload.

This sample limits the response to only two category IDs using the **filter** query parameter.

This example uses the parameter: `filter=categoryIds:{9355|4959|63855}`

```http
GET https://api.ebay.com/sell/metadata/v1/marketplace/EBAY_US/get_site_visibility_policies?filter=categoryIds:{9355|4959|63855}
```

### Output

If the call is successful, the response body contains the eBay international site visibility policy metadata of the marketplace for the categories specified in the request.

```json
{
  "siteVisibilityPolicies": [
    {
      "categoryTreeId": "0",
      "categoryId": "9355",
      "crossBorderTradeNorthAmericaEnabled": false,
      "crossBorderTradeGBEnabled": true,
      "crossBorderTradeAustraliaEnabled": false
    },
    {
      "categoryTreeId": "0",
      "categoryId": "4959",
      "crossBorderTradeNorthAmericaEnabled": false,
      "crossBorderTradeGBEnabled": true,
      "crossBorderTradeAustraliaEnabled": false
    },
    {
      "categoryTreeId": "0",
      "categoryId": "63855",
      "crossBorderTradeNorthAmericaEnabled": false,
      "crossBorderTradeGBEnabled": true,
      "crossBorderTradeAustraliaEnabled": false
    }
  ]
}
```

---
