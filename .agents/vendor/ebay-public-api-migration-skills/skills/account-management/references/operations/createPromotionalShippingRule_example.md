# POST : createPromotionalShippingRule Samples
- [Sample 1: Creates a promotional shipping rule for the seller](#sample-1-creates-a-promotional-shipping-rule-for-the-seller)

---

## Sample 1: Creates a promotional shipping rule for the seller

This method defines promotional shipping rules such as discounts or free-shipping thresholds, configurable by marketplace and seller for authenticated user.

### Input

This method requires a request body with the promotional shipping rule details along with the **X-EBAY-C-MARKETPLACE-ID** header.

```http
POST https://api.ebay.com/sell/account/v2/combined_shipping_rules/create_promotional_shipping_rule


{
	"combinedDuration": "DAYS_3",
	"promotionalShippingRule": {
		"combinedShippingRuleType": "SHIPPING_COST_X_FOR_AMOUNT_Y",
		"shippingCost": {
			"value": "20.0",
			"currency": "USD"
		},
		"orderAmount": {
			"value": "100.0",
			"currency": "USD"
		}
	}
}
```

### Output

If the call is successful, a 204 success message is returned.

*Sample output file not available for this operation.*

---