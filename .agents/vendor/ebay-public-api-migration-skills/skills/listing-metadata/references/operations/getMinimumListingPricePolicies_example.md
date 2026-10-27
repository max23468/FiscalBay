# GET : getMinimumListingPricePolicies Samples
- [Sample 1: Retrieve minimum listing price policies](#sample-1-retrieve-minimum-listing-price-policies)

---

## Sample 1: Retrieve minimum listing price policies

This method can be used to retrieve minimum listing price policies for the supported types of listing on a specific marketplace.

### Input

This method does not use a request payload. The marketplace for which to retrieve minimum listing price policies is specified through the **marketplace_id** path parameter. In this sample, policies are being retrieved for `EBAY_US`.

```http
GET https://api.ebay.com/sell/metadata/v1/marketplace/EBAY_US/get_minimum_listing_price_policies
```

### Output

If the method is successful, the response body contains the eBay minimum listing price policy metadata for the specified marketplace.

```json
{
    "minimumListingPricePolicies": [
        {
            "description": "Pricing for the auction-like listings",
            "listingType": "AUCTION",
            "minBuyItNowPricePercent": 30.0,
            "startPrice": {
                "value": 0.01,
                "currency": "USD"
            }
        },
        {
            "description": "Pricing for fixed price listings",
            "listingType": "FIXED_PRICE_ITEM",
            "startPrice": {
                "value": 0.99,
                "currency": "USD"
            }
        }
    ]
}
```

---
