# PUT : createOrReplaceSalesTax Samples
- [Sample 1: Create or update a sales tax table entry](#sample-1-create-or-update-a-sales-tax-table-entry)

---

## Sample 1: Create or update a sales tax table entry

This call creates or updates a sales tax table entry for the specified country and sales tax jurisdiction.

### Input

This example sets the sales tax table entry for British Columbia, a sales tax jurisdiction in Canada.

```http
PUT https://api.ebay.com/sell/account/v1/sales_tax/CA/BC

{
    "salesTaxPercentage": 4.0,
    "shippingAndHandlingTaxed": true
}
```

### Output

A successful call returns the HTTP status code **204 No content**. This method returns an empty response body.

*Sample output file not available for this operation.*

---

