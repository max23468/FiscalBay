# GET : getShippingPolicies Samples
- [Sample 1: Get the eBay shipping policy metadata for a specified marketplace](#sample-1-get-the-ebay-shipping-policy-metadata-for-a-specified-marketplace)

---

## Sample 1: Get the eBay shipping policy metadata for a specified marketplace

This example retrieves the eBay shipping policies for two specified categories, `2328` and `9355`.

This method returns an array of leaf categories from the category tree of the specified marketplace. Each node in the response contains metadata for the shipping policies in each returned category.

### Input

This method does not use a request payload.

This sample limits the response to only two category IDs using the **filter** query parameter.

This example uses the parameter: `filter=categoryIds:{2328|9355}`

```http
GET https://api.ebay.com/sell/metadata/v1/marketplace/EBAY_GB/get_shipping_policies?filter=categoryIds:{2328|9355}
```

### Output

If the call is successful, the response body contains the eBay shipping policy metadata of the marketplace for the categories specified in the request.

```json
{
  "shippingPolicies": [
    {
      "categoryTreeId": "3",
      "categoryId": "9355",
      "shippingTermsRequired": true,
      "handlingTimeEnabled": true,
      "maxFlatShippingCost": {
        "value": "30.0",
        "currency": "USD"
      },
      "globalShippingEnabled": true
    },
    {
      "categoryTreeId": "3",
      "categoryId": "2328",
      "shippingTermsRequired": true,
      "handlingTimeEnabled": true,
      "maxFlatShippingCost": {
        "value": "30.0",
        "currency": "USD"
      },
      "globalShippingEnabled": true
    }
  ]
}
```

---