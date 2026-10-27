# GET : getClassifiedAdPolicies Samples
- [Sample 1: Get the eBay classified ad policy metadata for a specified marketplace](#sample-1-get-the-ebay-classified-ad-policy-metadata-for-a-specified-marketplace)

---

## Sample 1: Get the eBay classified ad policy metadata for a specified marketplace

This example retrieves the eBay classified ad policy metadata for the two specified leaf categories, `9355` and `260223`.

This method returns an array of leaf categories from the category tree of the specified marketplace. Each node in the response contains metadata for the classified ad policies in each of the returned categories.

### Input

This method does not use a request payload. This sample limits the response to only two category IDs using the **filter** query parameter: `filter=categoryIds:{9355|260223}`

```http
GET https://api.ebay.com/sell/metadata/v1/marketplace/EBAY_US/get_classified_ad_policies?filter=categoryIds:{9355|260223}
```

### Output

If the call is successful, the response body contains the classified ad policy metadata of the marketplace for the categories specified in the request.

```json
{
  "classifiedAdPolicies": [
    {
      "categoryTreeId": "0",
      "categoryId": "9355",
      "adFormatEnabled": "Disabled",
      "sellerContactDetailsEnabled": false,
      "classifiedAdPaymentMethodEnabled": "NotSupported",
      "classifiedAdShippingMethodEnabled": false,
      "classifiedAdBestOfferEnabled": "Disabled",
      "classifiedAdCounterOfferEnabled": false,
      "classifiedAdContactByPhoneEnabled": false,
      "classifiedAdContactByEmailEnabled": false,
      "classifiedAdAutoAcceptEnabled": false,
      "classifiedAdAutoDeclineEnabled": false,
      "classifiedAdContactByAddressEnabled": false,
      "classifiedAdCompanyNameEnabled": false
    },
    {
      "categoryTreeId": "0",
      "categoryId": "260223",
      "adFormatEnabled": "Disabled",
      "sellerContactDetailsEnabled": false,
      "classifiedAdPaymentMethodEnabled": "NotSupported",
      "classifiedAdShippingMethodEnabled": false,
      "classifiedAdBestOfferEnabled": "Disabled",
      "classifiedAdCounterOfferEnabled": false,
      "classifiedAdContactByPhoneEnabled": false,
      "classifiedAdContactByEmailEnabled": false,
      "classifiedAdAutoAcceptEnabled": false,
      "classifiedAdAutoDeclineEnabled": false,
      "classifiedAdContactByAddressEnabled": false,
      "classifiedAdCompanyNameEnabled": false
    }
  ]
}
```

---
