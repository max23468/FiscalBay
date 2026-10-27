# POST : createCalculatedShippingRules Samples
- [Sample 1: Create calculated shipping rules](#sample-1-create-calculated-shipping-rules)

---

## Sample 1: Create calculated shipping rules

This method is used to create a calculated shipping rule for combined shipping discounts for a seller's account.

### Input

This method requires a request body containing the calculated shipping rules to be created. Additionally, the **X-EBAY-C-MARKETPLACE-ID** header is required.

```http
POST https://api.ebay.com/sell/account/v2/combined_shipping_rules/calculated


{
	"discountProfileName": "BulkShippingCalc",
	"ruleType": "CALCULATED_SHIPPING_DISCOUNT_RULE",
	"additionalShippingCostPerUnit": {
		"value": "3.00",
		"currency": "USD"
	}
}
```

### Output

If the call is successful, a 204 success message is returned in the response body.

*Sample output file not available for this operation.*

---