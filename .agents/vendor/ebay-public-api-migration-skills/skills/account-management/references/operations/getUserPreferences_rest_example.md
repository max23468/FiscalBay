# GET : getUserPreferences_rest Samples
- [Sample 1: Get user preferences](#sample-1-get-user-preferences)

---

## Sample 1: Get user preferences

This method retrieves the seller's preferences for a specific eBay marketplace, specified through the **X-EBAY-C-MARKETPLACE-ID** HTTP header (see HTTP request header).

### Input

The input for this sample is the `fieldgroups` query parameter which is set to `ALL`.

```http
GET https://api.ebay.com/sell/account/v2/user_preferences?fieldgroups=ALL
```

### Output

If the call is successful, all of the supported seller preferences are returned in the output. These include available details as defined in the response payload.

```json
{
	"combinedPaymentPreferences": {
		"combinedPaymentOption": "DISCOUNT_SPECIFIED"
	},
	"shippingCarrierRatePreferences": {
		"upsRateOption": "UPS_ON_DEMAND_RATES"
	},
	"endOfAuctionEmailPreferences": {
		"templateText": "template Text test ",
		"logoUrl": "http://end*********/****/i***e.jpg",
		"emailCustomized": true,
		"textCustomized": true,
		"logoCustomized": false
	},
	"emailShipmentTrackingNumberPreference": false,
	"requiredShipPhoneNumberPreference": true,
	"itemsAwaitingPaymentPreferences": {
		"delayBeforeCancellingCommitment": 32,
		"optInStatus": true,
		"autoRelist": true,
		"excludedUsers": [
			"p************1"
		]
	},
	"sellerExcludeShipToLocationPreferences": {
		"excludeShipToLocations": [
			"Invalid"
		]
	},
	"purchaseReminderEmailPreferences": true,
	"sellerProfilePreferences": {
		"sellerProfileOptedIn": true
	},
	"offerGlobalShippingProgramPreference": false,
	"dispatchCutoffTimePreference": {
		"cutoffTime": "06:00:00.000Z"
	},
	"globalShippingProgramListingPreference": false,
	"overrideGspServiceWithIntlServicePreference": false,
	"pickupDropoffSellerPreference": false,
	"outOfStockControlPreference": true
}
```

---