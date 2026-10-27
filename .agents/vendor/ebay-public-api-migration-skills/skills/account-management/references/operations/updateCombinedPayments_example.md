# POST : updateCombinedPayments Samples
- [Sample 1: Update combined payments](#sample-1-update-combined-payments)

---

## Sample 1: Update combined payments

This method is used to update combined payments settings for a seller's account.

### Input

This method requires a request body containing the updated combined payments settings along with the **X-EBAY-C-MARKETPLACE-ID** header.

```http
POST https://api.ebay.com/sell/account/v1/combined_payment_discount_rule/{combinedPaymentDiscountRuleProfileId}


{  
	"combinedDuration": "DAYS_7"  
}
```

### Output

If the call is successful, a 204 success message is returned.

*Sample output file not available for this operation.*

---