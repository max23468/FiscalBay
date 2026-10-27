# GET : getSalesTax Samples
- [Sample 1: Get a sales tax table entry](#sample-1-get-a-sales-tax-table-entry)

---

## Sample 1: Get a sales tax table entry

This call gets the sales tax table entry specified by the path parameters **countryCode** and **jurisdictionId**.

### Input

This call does not use a request payload; supply the county and tax jurisdiction of the tax entry you want to get in the path of the operation URI.

```http
GET https://api.ebay.com/sell/account/v1/sales_tax/US/GU
```

### Output

If the call is successful, it returns an HTTP status code of "200 OK" and the tax table entry that was configured for the specified sales tax jurisdiction.

```json
{
  "salesTaxPercentage": "4.0",
  "shippingAndHandlingTaxed": true,
  "countryCode": "US",
  "salesTaxJurisdictionId": "GU"
}
```

---

