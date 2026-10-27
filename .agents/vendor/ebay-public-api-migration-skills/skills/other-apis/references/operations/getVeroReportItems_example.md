# GET : getVeroReportItems Samples
- [Sample 1: Retrieve VeRO reported items from a specified time period](#sample-1-retrieve-vero-reported-items-from-a-specified-time-period)

---

## Sample 1: Retrieve VeRO reported items from a specified time period

This method can be used to retrieve status information about the items you have submitted to eBay for VeRO report during a specified time period for copyright, trademark, or other intellectual property rights infringement.

Note: the bundled example preserves a singular `/vero_report_item` request URL, while the bundled schema defines `/vero_report_items` as the resource path. Use the companion `_doc.md` file for the normalized route reference.

### Input

The **filter** query parameter can be used to specify a certain time period for which to retrieve VeRO reported items. In this sample, all items reported on November 11th, 2024 (`2024-11-13T00:00:00.000Z`) will be returned.

```http
GET https://api.ebay.com/commerce/vero/v1/vero_report_item?filter=reportSubmittedDate:[2024-11-13T00:00:00.000Z]
```

### Output

If the call is successful, an array of each reported item and their statuses are returned in the **reportedItemDetails** array.

```json
{
    "offset": 0,
    "limit": 25,
    "next": "/vero_report_item?reportSubmittedDate:[2024-11-13T00:00:00.000Z]&limit=25&offset=25",
    "reportedItemDetails": [
        {
            "itemId": "2********2",
            "status": "SUBMITTED"
        },
        {
            "itemId": "2********8",
            "status": "SUBMITTED"
        },
        {
            "itemId": "1********1",
            "status": "SUBMITTED"
        },
        {
            "itemId": "2********2",
            "status": "SUBMITTED"
        },
        {
            "itemId": "2********3",
            "status": "SUBMITTED"
        },
        {
            "itemId": "1********1",
            "status": "SUBMITTED"
        },
        {
            "itemId": "2********5",
            "status": "SUBMITTED"
        },
        {
            "itemId": "1********7",
            "status": "SUBMITTED"
        },
        {
            "itemId": "2********5",
            "status": "SUBMITTED"
        },
        {
            "itemId": "2********5",
            "status": "SUBMITTED"
        },
        {
            "itemId": "2********2",
            "status": "SUBMITTED"
        },
        {
            "itemId": "2********7",
            "status": "SUBMITTED"
        },
        {
            "itemId": "2********2",
            "status": "SUBMITTED"
        },
        {
            "itemId": "1********1",
            "status": "SUBMITTED"
        },
        {
            "itemId": "2********2",
            "status": "SUBMITTED"
        },
        {
            "itemId": "2********5",
            "status": "SUBMITTED"
        },
        {
            "itemId": "2********5",
            "status": "SUBMITTED"
        },
        {
            "itemId": "2********7",
            "status": "SUBMITTED"
        },
        {
            "itemId": "2********6",
            "status": "SUBMITTED"
        },
        {
            "itemId": "2********2",
            "status": "SUBMITTED"
        },
        {
            "itemId": "2********0",
            "status": "SUBMITTED"
        },
        {
            "itemId": "1********1",
            "status": "SUBMITTED"
        },
        {
            "itemId": "2********2",
            "status": "SUBMITTED"
        },
        {
            "itemId": "2********6",
            "status": "SUBMITTED"
        },
        {
            "itemId": "1********1",
            "status": "SUBMITTED"
        }
    ],
    "href": "/vero_report_items?reportSubmittedDate:[2024-11-13T00:00:00.000Z]&limit=25&offset=0",
    "total": 685
}
```

---