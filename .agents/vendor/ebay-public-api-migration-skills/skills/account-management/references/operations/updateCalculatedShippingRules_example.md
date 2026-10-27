# POST : updateCalculatedShippingRules Samples
- [Sample 1: Update combined shipping rules](#sample-1-update-combined-shipping-rules)

---

## Sample 1: Update combined shipping rules

This method is used to update the combined rules for a seller's account.

### Input

This method requires a request body containing the updated combined shipping rules. Additionally, the **X-EBAY-C-MARKETPLACE-ID** header is required.

```http
POST https://api.ebay.com/sell/account/v2/combined_shipping_rules/calculated/{shippingCostRuleProfileId}


{
	"discountProfileName": "UpdatedCalcShippingRule",
	"ruleType": "CALCULATED_SHIPPING_DISCOUNT_RULE",
	"shippingCostRuleProfileId": "abc12345",
	"additionalShippingCostPerUnit": {
		"value": "2.50",
		"currency": "USD"
	}
}
```

### Output

If the call is successful, a 204 success message is returned

*Sample output file not available for this operation.*

---