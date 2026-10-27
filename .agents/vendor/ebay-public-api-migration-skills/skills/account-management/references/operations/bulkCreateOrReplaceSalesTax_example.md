# POST : bulkCreateOrReplaceSalesTax Samples
- [Sample 1: Bulk create or update sales-tax table entries](#sample-1-bulk-create-or-update-sales-tax-table-entries)

---

## Sample 1: Bulk create or update sales-tax table entries

This call creates or updates sales-tax table entries for the specified countries and sales tax jurisdictions.

### Input

This example sets sales-tax table entries for British Columbia, a sales-tax jurisdiction in Canada, and Guam, a sales-tax jurisdiction in the United States.

```http
POST https://api.ebay.com/sell/account/v1/bulk_create_or_replace_sales_tax

{
  "salesTaxInputList": [
    {
      "countryCode": "CA",
      "salesTaxJurisdictionId": "BC",
      "salesTaxPercentage": "7.75",
      "shippingAndHandlingTaxed": "true"
    },
    {
      "countryCode": "US",
      "salesTaxJurisdictionId": "GU",
      "salesTaxPercentage": "8.125",
      "shippingAndHandlingTaxed": "false"
    }
  ]
}
```

### Output

A successful call returns an array of the `countryCode`, `jurisdictionId`, and HTTP `statusCode` for each sales-tax table entry.

**Note:** The system returns one HTTP status code regardless of the number of sales-tax table entries provided. Therefore, the same HTTP `statusCode` will be listed for all sales-tax table entries included in the payload.

```json
{
  "updatedSalesTaxEntries": [
    {
      "countryCode": "CA",
      "jurisdictionId": "BC",
      "statusCode": "200"
    },
    {
      "countryCode": "US",
      "jurisdictionId": "GU",
      "statusCode": "200"
    },
  ]
}
```

---

