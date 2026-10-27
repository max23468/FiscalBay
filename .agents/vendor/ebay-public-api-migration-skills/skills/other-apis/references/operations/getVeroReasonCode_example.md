# GET : getVeroReasonCode Samples
- [Sample 1: Retrieve the details of a specific VeRO reason code](#sample-1-retrieve-the-details-of-a-specific-vero-reason-code)

---

## Sample 1: Retrieve the details of a specific VeRO reason code

This method returns the details, including the description and associated marketplace, of a specified VeRO reason code.

### Input

The **vero_reason_code_id** for which to retrieve details is required in the path parameter of the call.

```http
GET https://api.ebay.com/commerce/vero/v1/vero_reason_code/9052
```

### Output

If the call is successful, details about the specified VeRO reason code are returned. This includes a brief description of the code (**briefText**), a detailed description of the code (**detailedText**), and the marketplace associated with the code (**marketplaceId**)

```json
{
    "veroReasonCode": [
        {
            "marketplaceId": "EBAY_US",
            "reasonCodeDetails": [
                {
                    "briefText": "Other infringement",
                    "detailedText": "Other - Provide details information in additional information box below.",
                    "veroReasonCodeId": "9052"
                }
            ]
        }
    ]
}
```

---