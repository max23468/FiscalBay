# GET : getListingTypePolicies Samples
- [Sample 1: Get the eBay listing type policy metadata for a specified marketplace](#sample-1-get-the-ebay-listing-type-policy-metadata-for-a-specified-marketplace)

---

## Sample 1: Get the eBay listing type policy metadata for a specified marketplace

This example retrieves the eBay listing type policy metadata for the two specified leaf categories, `9355` and `261585`.

This method returns an array of leaf categories from the category tree of the specified marketplace. Each node in the response contains metadata for the listing type policies in each of the returned categories.

### Input

This method does not use a request payload. This sample limits the response to only two category IDs using the **filter** query parameter: `filter=categoryIds:{9355|261585}`

```http
GET https://api.ebay.com/sell/metadata/v1/marketplace/EBAY_US/get_listing_type_policies?filter=categoryIds:{9355|261585}
```

### Output

If the call is successful, the response body contains the eBay listing type policy metadata of the marketplace.

```json
{
  "listingTypePolicies": [
    {
      "categoryTreeId": "0",
      "categoryId": "9355",
      "listingDurations": [
        {
          "listingType": "AUCTION",
          "durationValues": [
            "DAYS_3",
            "DAYS_5",
            "DAYS_10"
          ]
        },
        {
          "listingType": "PERSONAL_OFFER",
          "durationValues": [
            "DAYS_3",
            "DAYS_5",
            "DAYS_10"
          ]
        },
        {
          "listingType": "FIXED_PRICE_ITEM",
          "durationValues": [
            "GTC"
          ]
        },
        {
          "listingType": "LEAD_GENERATION",
          "durationValues": [
            "DAYS_30",
            "DAYS_60",
            "DAYS_90"
          ]
        }
      ],
      "pickupDropOffEnabled": false,
      "digitalGoodDeliveryEnabled": false
    },
    {
      "categoryTreeId": "0",
      "categoryId": "261585",
      "listingDurations": [
        {
          "listingType": "AUCTION",
          "durationValues": [
            "DAYS_3",
            "DAYS_5",
            "DAYS_10"
          ]
        },
        {
          "listingType": "PERSONAL_OFFER",
          "durationValues": [
            "DAYS_3",
            "DAYS_5",
            "DAYS_10"
          ]
        },
        {
          "listingType": "FIXED_PRICE_ITEM",
          "durationValues": [
            "GTC"
          ]
        },
        {
          "listingType": "LEAD_GENERATION",
          "durationValues": [
            "DAYS_30",
            "DAYS_60",
            "DAYS_90"
          ]
        }
      ],
      "pickupDropOffEnabled": false,
      "digitalGoodDeliveryEnabled": false
    }
  ]
}
```

---
