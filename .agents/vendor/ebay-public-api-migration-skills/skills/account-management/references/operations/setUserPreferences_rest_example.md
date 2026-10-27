# PATCH : setUserPreferences_rest Samples
- [Sample 1: Set user preferences](#sample-1-set-user-preferences)

---

## Sample 1: Set user preferences

This method sets the seller's preferences for a specific eBay marketplace, specified through the **X-EBAY-C-MARKETPLACE-ID** HTTP header (see HTTP request header).

### Input

The input for this sample contains fields from the request payload and sets (or updates) these values for the seller for the eBay marketplace specified in the HTTP request header.

```http
PATCH https://api.ebay.com/sell/account/v2/user_preferences

{
	"requiredShipPhoneNumberPreference": false,
	"globalShippingProgramListingPreference": false,
	"outOfStockControlPreference": true,
	"purchaseReminderEmailPreferences": true,
	"emailShipmentTrackingNumberPreference": false,
	"shippingCarrierRatePreferences": {
		"upsRateOption": "UPS_ON_DEMAND_RATES",
		"fedexRateOption": "FEDEX_COUNTER"
	},
	"itemsAwaitingPaymentPreferences": {
		"optInStatus": true,
		"delayBeforeCancellingCommitment": 32,
		"autoRelist": true,
		"removeAllExcludedUsers": false,
		"excludedUsers": [
			"p************1"
		]
	},
	"combinedPaymentPreferences": {
		"combinedPaymentOption": "DISCOUNT_SPECIFIED"
	},
	"dispatchCutoffTimePreference": {
		"cutoffTime": "06:00:00.000Z"
	},
	"endOfAuctionEmailPreferences": {
		"templateText": "template Text ",
		"emailCustomized": true,
		"textCustomized": true,
		"logoCustomized": false,
		"logoType": "WINNING_BIDDER_NOTICE",
		"logoUrl": "http://end*********/e****/i***e.jpg"
	}
}
```

### Output

If the call succeeds, it returns HTTP status **204 No Content**, and the seller's preferences for the specified marketplace are updated.

*Sample output file not available for this operation.*

---