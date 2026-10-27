# GET : getSalesTaxes Samples
- [Sample 1: Get the sales tax table for a country](#sample-1-get-the-sales-tax-table-for-a-country)

---

## Sample 1: Get the sales tax table for a country

This call gets all the sales tax table entries that the seller has configured for the specified country's tax jurisdictions.

### Input

Supply the two-letter country code in the **country_code** query parameter to indicate the country whose tax table you want to retrieve.

```http
GET https://api.ebay.com/sell/account/v1/sales_tax?country_code=US
```

### Output

This example call returns the sales tax entries that have been set up for the United States (US). The seller must have previously configured the sale-tax table, otherwise the response will contain an empty list.

```json
{
  "salesTaxes": [
    {
      "salesTaxPercentage": "3.75",
      "shippingAndHandlingTaxed": false,
      "countryCode": "US",
      "salesTaxJurisdictionId": "GU"
    },
    {
      "salesTaxPercentage": "4.0",
      "shippingAndHandlingTaxed": true,
      "countryCode": "US",
      "salesTaxJurisdictionId": "VI"
    }
  ]
}
```

---

