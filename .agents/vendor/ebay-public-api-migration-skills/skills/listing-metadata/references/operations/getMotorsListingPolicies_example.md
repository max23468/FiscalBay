# GET : getMotorsListingPolicies Samples
- [Sample 1: Get the eBay Motors policy metadata for a specified marketplace](#sample-1-get-the-ebay-motors-policy-metadata-for-a-specified-marketplace)

---

## Sample 1: Get the eBay Motors policy metadata for a specified marketplace

This example retrieves the eBay Motors policies for the two specified leaf categories, `98063` and `84159`.

This method returns an array of leaf categories from the category tree of the specified marketplace. Each node in the response contains metadata for the motors listing policies in each returned category.

### Input

This method does not use a request payload. This sample uses the parameter: `filter=categoryIds:{98063|84159}`

```http
GET https://api.ebay.com/sell/metadata/v1/marketplace/EBAY_US/get_motors_listing_policies?filter=categoryIds:{98063|84159}
```

### Output

If the call is successful, the response body contains the eBay Motors policy metadata of the marketplace for the categories specified in the request.

```json
{
  "motorsListingPolicies": [
    {
      "categoryTreeId": "100",
      "categoryId": "98063",
      "ebayMotorsProAdFormatEnabled": "Disabled",
      "ebayMotorsProContactByEmailEnabled": false,
      "ebayMotorsProBestOfferEnabled": "Disabled",
      "ebayMotorsProAutoAcceptEnabled": false,
      "ebayMotorsProAutoDeclineEnabled": false,
      "ebayMotorsProPaymentMethodCheckOutEnabled": "NotSupported",
      "ebayMotorsProShippingMethodEnabled": false,
      "ebayMotorsProCounterOfferEnabled": false,
      "ebayMotorsProSellerContactDetailsEnabled": false,
      "localMarketAdFormatEnabled": "ClassifiedAdEnabled",
      "localMarketAutoAcceptEnabled": true,
      "localMarketAutoDeclineEnabled": true,
      "localMarketContactByEmailEnabled": true,
      "localMarketBestOfferEnabled": "Enabled",
      "localMarketPaymentMethodCheckOutEnabled": "EnabledWithCheckout",
      "localMarketShippingMethodEnabled": true,
      "localMarketCounterOfferEnabled": true,
      "localMarketSellerContactDetailsEnabled": true,
      "maxItemCompatibility": 0,
      "localMarketSpecialitySubscription": false,
      "specialitySubscription": "National",
      "localMarketRegularSubscription": true,
      "regularSubscription": "LocalOnly",
      "localMarketPremiumSubscription": false,
      "premiumSubscription": "National",
      "localMarketNonSubscription": true,
      "nonSubscription": "LocalOnly",
      "sellerProvidedTitleSupported": true,
      "ebayMotorsProContactByPhoneEnabled": false,
      "ebayMotorsProContactByAddressEnabled": false,
      "ebayMotorsProCompanyNameEnabled": false,
      "localMarketContactByPhoneEnabled": true,
      "localMarketContactByAddressEnabled": true,
      "localMarketCompanyNameEnabled": true,
      "kTypeSupported": false,
      "epidSupported": false,
      "localMarketStreetCount": 2,
      "localMarketPhoneCount": 1,
      "depositSupported": true,
      "maxGranularFitmentCount": -1,
      "vinSupported": false,
      "vrmSupported": false
    },
    {
      "categoryTreeId": "100",
      "categoryId": "84159",
      "ebayMotorsProAdFormatEnabled": "LocalMarketBestOfferOnly",
      "ebayMotorsProContactByEmailEnabled": false,
      "ebayMotorsProBestOfferEnabled": "Disabled",
      "ebayMotorsProAutoAcceptEnabled": false,
      "ebayMotorsProAutoDeclineEnabled": false,
      "ebayMotorsProPaymentMethodCheckOutEnabled": "NotSupported",
      "ebayMotorsProShippingMethodEnabled": false,
      "ebayMotorsProCounterOfferEnabled": false,
      "ebayMotorsProSellerContactDetailsEnabled": false,
      "localMarketAdFormatEnabled": "ClassifiedAdEnabled",
      "localMarketAutoAcceptEnabled": true,
      "localMarketAutoDeclineEnabled": true,
      "localMarketContactByEmailEnabled": true,
      "localMarketBestOfferEnabled": "Enabled",
      "localMarketPaymentMethodCheckOutEnabled": "EnabledWithCheckout",
      "localMarketShippingMethodEnabled": true,
      "localMarketCounterOfferEnabled": true,
      "localMarketSellerContactDetailsEnabled": true,
      "maxItemCompatibility": 0,
      "localMarketSpecialitySubscription": false,
      "specialitySubscription": "National",
      "localMarketRegularSubscription": true,
      "regularSubscription": "LocalOnly",
      "localMarketPremiumSubscription": false,
      "premiumSubscription": "National",
      "localMarketNonSubscription": true,
      "nonSubscription": "LocalOnly",
      "sellerProvidedTitleSupported": true,
      "ebayMotorsProContactByPhoneEnabled": false,
      "ebayMotorsProContactByAddressEnabled": false,
      "ebayMotorsProCompanyNameEnabled": false,
      "localMarketContactByPhoneEnabled": true,
      "localMarketContactByAddressEnabled": true,
      "localMarketCompanyNameEnabled": true,
      "kTypeSupported": false,
      "epidSupported": false,
      "localMarketStreetCount": 2,
      "localMarketPhoneCount": 1,
      "depositSupported": true,
      "maxGranularFitmentCount": -1,
      "vinSupported": true,
      "vrmSupported": false
    }
  ]
}
```

---
