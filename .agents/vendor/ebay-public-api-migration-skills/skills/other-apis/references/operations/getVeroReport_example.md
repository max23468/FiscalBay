# GET : getVeroReport Samples
- [Sample 1: Retrieve a VeRO report](#sample-1-retrieve-a-vero-report)

---

## Sample 1: Retrieve a VeRO report

This method can be used to retrieve status information about a specific VeRO report you have submitted to eBay for copyright, trademark, or other intellectual property rights infringement.

### Input

The **vero_report_id** of the VeRO report for which to retrieve status information is required in the path parameter of the call.

```http
GET https://api.ebay.com/commerce/vero/v1/vero_report/5********
```

### Output

If the call is successful, the status of the VeRO report is returned. In this sample, the response shows only the report-status shape validated in this package.

```json
{
    "veroReportId": "5********2",
    "veroReportStatus": "PROCESSED"
}
```

---