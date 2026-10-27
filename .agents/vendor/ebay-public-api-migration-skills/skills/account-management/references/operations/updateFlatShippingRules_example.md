# POST : updateFlatShippingRules Samples
- [Sample 1: Update flat shipping rules](#sample-1-update-flat-shipping-rules)

---

## Sample 1: Update flat shipping rules

This method is used to update flat shipping rules, configured by the seller.

### Input

This method requires a request body containing the updated flat shipping rules. Additionally, the **X-EBAY-C-MARKETPLACE-ID** header is required.

```http
POST https://api.ebay.com/sell/account/v2/combined_shipping_rules/flat/************


{
	"combinedDuration": "DAYS_7",
	"flatShippingRule": {
		"combinedShippingRuleType": "EACH_ADDITIONAL_AMOUNT",
		"combinedShippingRules": [
			{
				"combinedShippingRuleId": "203169017",
				"combinedShippingRuleName": "0209test3",
				"eachAdditionalAmount": {
					"value": "25.5",
					"currency": "USD"
				}
			}
		]
	}
}
```

### Output

If the call is successful, a 204 success message is returned.

*Sample output file not available for this operation.*

---