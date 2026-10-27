# GET : getCategoryPolicy Samples
- [Sample 1: Get the eBay category policy metadata for a specified marketplace](#sample-1-get-the-ebay-category-policy-metadata-for-a-specified-marketplace)

---

## Sample 1: Get the eBay category policy metadata for a specified marketplace

This example retrieves the eBay policies for the two specified leaf categories, `3767` and `171784`. 

This method returns an array of leaf categories from the category tree of the specified marketplace. Each node in the response contains metadata for the policies in each returned category.

### Input

This method does not use a request payload. This sample limits the response to only two category IDs using the **filter** query parameter: `filter=categoryIds:{3767|171784}`

```http
GET https://api.ebay.com/sell/metadata/v1/marketplace/EBAY_US/get_category_policies?filter=categoryIds:{3767|171784}
```

### Output

If the call is successful, the response body contains the eBay policy metadata of the marketplace for the categories specified in the request.

```json
{
	"categoryPolicies": [
		{
			"categoryTreeId": "0",
			"categoryId": "171784",
			"autoPayEnabled": true,
			"expired": true,
			"orra": true,
			"lsd": true,
		 "virtual": true,
		 "valueCategory": false,
			"minimumReservePrice": 0.0,
			"paymentMethods": [
				"CASH_ON_PICKUP"
			],
			"intangibleEnabled": false
		},
		{
			"categoryTreeId": "0",
			"categoryId": "3767",
			"autoPayEnabled": true,
			"b2bVatEnabled": true,
			"orra": true,
			"reservePriceAllowed": true,
			"valueCategory": false,
			"minimumReservePrice": 0.0,
			"paymentMethods": [
				"CASH_ON_PICKUP"
			],
			"intangibleEnabled": true
		}
	]
}
```

---