# POST : updatePromotionalShippingRule Samples
- [Sample 1: Update promotional shipping rule](#sample-1-update-promotional-shipping-rule)

---

## Sample 1: Update promotional shipping rule

This method is used to update a promotional shipping rule configured by the seller.

### Input

The request body must contain the updated details of the promotional shipping rule and the duration for which the promotional shipping rule is valid.

```http
POST https://api.ebay.com/sell/account/v1/promotional_shipping_discount_rule/{promotionalShippingDiscountRuleProfileId}


{
	"combinedDuration": "DAYS_3",
	"promotionalShippingRule": {
		"combinedShippingRuleType": "SHIPPING_COST_X_FOR_AMOUNT_Y",
		"shippingCost": {
			"value": "10.0",
			"currency": "USD"
		},
		"orderAmount": {
			"value": "50.0",
			"currency": "USD"
		}
	}
}
```

### Output

If the call is successful, a 204 success message is returned in the response body.

*Sample output file not available for this operation.*

---