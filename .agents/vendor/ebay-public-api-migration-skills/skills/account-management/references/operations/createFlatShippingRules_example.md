# POST : createFlatShippingRules Samples
- [Sample 1: Create flat shipping rules](#sample-1-create-flat-shipping-rules)

---

## Sample 1: Create flat shipping rules

This method is used to create flat shipping rules for combined shipping discounts.

### Input

This method requires a request body containing the flat shipping rules to be created. Additionally, the **X-EBAY-C-MARKETPLACE-ID** header is required.

```http
POST https://api.ebay.com/sell/account/v2/combined_shipping_rules/calculated/***********

{
	"combinedDuration": "DAYS_7",
	"flatShippingRule": {
		"combinedShippingRuleType": "EACH_ADDITIONAL_AMOUNT",
		"combinedShippingRules": [
			{
				"combinedShippingRuleName": "New amount off rule 22",
				"eachAdditionalAmount": {
					"value": "5.5",
					"currency": "USD"
				}
			}
		]
	}
}
```

### Output

If the call is successful, a 204 success message is returned in the response body.

*Sample output file not available for this operation.*

---