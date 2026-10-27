# GET : getCombinedShippingRules Samples
- [Sample 1: Retrieve combined shipping rules](#sample-1-retrieve-combined-shipping-rules)

---

## Sample 1: Retrieve combined shipping rules

This method is used to retrieve combined shipping rules, configured by the seller.

### Input

This method does not have a request body. Only the **X-EBAY-C-MARKETPLACE-ID** header is required.

```http
GET https://api.ebay.com/sell/account/v2/combined_shipping_rules
```

### Output

If the call is successful, the combined shipping rules are returned in the response body. These include details such as **flat shipping discounts**, **calculated shipping discounts**, and **promotional shipping discounts**.

```json
{
	"combinedDuration": "DAYS_7",
	"flatShippingRule": {
		"combinedShippingRuleType": "EACH_ADDITIONAL_AMOUNT",
		"combinedShippingRules": [
			{
				"combinedShippingRuleId": "5********0",
				"combinedShippingRuleName": "New flat amount off rule 25",
				"eachAdditionalAmount": {
					"value": "5.5",
					"currency": "USD"
				}
			},
			{
				"combinedShippingRuleId": "5********0",
				"combinedShippingRuleName": "New flat amount off rule 50",
				"eachAdditionalAmount": {
					"value": "10.5",
					"currency": "USD"
				}
			}
		]
	}
}
```

---