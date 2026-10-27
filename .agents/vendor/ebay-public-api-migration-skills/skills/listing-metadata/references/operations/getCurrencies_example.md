# GET : getCurrencies Samples
- [Sample 1: Get the eBay default currency for a specified marketplace](#sample-1-get-the-ebay-default-currency-for-a-specified-marketplace)
- [Sample 2: Target a specific locale of a marketplace that supports multiple locales](#sample-2-target-a-specific-locale-of-a-marketplace-that-supports-multiple-locales)

---

## Sample 1: Get the eBay default currency for a specified marketplace

This example retrieves the default currency for a specified eBay marketplace. It specifically targets the Great Britain (United Kingdom) marketplace and returns both the ISO 4217 three-letter currency code of the eBay default currency for that marketplace and the description associated with the code.

### Input

This method does not use a request payload; instead, it specifies the marketplace through the path parameter **marketplace_id** using `EBAY_GB` as the value.

```http
GET https://api.ebay.com/sell/metadata/v1/marketplace/EBAY_GB/get_currencies
```

### Output

If the call is successful, the response body contains the default currency for the specified marketplace.

```json
{
  "defaultCurrency" :
    {
      "code" : "GBP",
      "description" : "British Pound Sterling"
    },
    "marketplaceId" : "EBAY_GB"
}
```

---

## Sample 2: Target a specific locale of a marketplace that supports multiple locales

This example retrieves the eBay default currency for the Canadian marketplace targeting the French locale. Specifically, this sample returns the ISO 4217 three-letter currency code of the eBay default currency for the Canadian marketplace and the description of the returned code in French.

### Input

This method does not use a request payload; instead, it specifies the marketplace using the path parameter **marketplace_id** with the value `EBAY_CA`. Additionally, it targets the French locale of the Canadian marketplace by adding `fr-CA` as a **Accept-Language** request header. See HTTP request headers for details.

```http
GET https://api.ebay.com/sell/metadata/v1/marketplace/EBAY_CA/get_currencies
```

### Output

If the call is successful, the response body contains the default currency for the specified marketplace targeting the French locale.

```json
{
  "defaultCurrency" :
    {
      "code" : "CAD",
      "description" : "Dollar Canadien"
    },
    "marketplaceId" : "EBAY_CA"
}
```

---
