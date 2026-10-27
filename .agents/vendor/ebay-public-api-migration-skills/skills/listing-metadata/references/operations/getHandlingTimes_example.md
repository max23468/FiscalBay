# GET : getHandlingTimes Samples
- [Sample 1: Retrieve the supported handling times for the specified marketplace](#sample-1-retrieve-the-supported-handling-times-for-the-specified-marketplace)

---

## Sample 1: Retrieve the supported handling times for the specified marketplace

This example retrieves a list of handling times supported on the `EBAY_US` marketplace.

This method returns an array with each node in the response containing available handling times returned.

### Input

This method does not use a request payload. The response returns a list for the marketplace specified through the path parameter.

```http
GET https://api.ebay.com/sell/metadata/v1/shipping/marketplace/EBAY_US/get_handling_times
```

### Output

If the call is successful, the response body contains the handling times supported for the marketplace specified in the request.

```json
{
    "handlingTimes": [
        {
            "maxHandlingTime": 0,
            "description": "Same business day"
        },
        {
            "maxHandlingTime": 1,
            "description": "1 business day"
        },
        {
            "maxHandlingTime": 2,
            "description": "2 business days"
        },
        {
            "maxHandlingTime": 3,
            "description": "3 business days"
        },
        {
            "maxHandlingTime": 4,
            "description": "4 business days"
        },
        {
            "maxHandlingTime": 5,
            "description": "5 business days"
        },
        {
            "maxHandlingTime": 6,
            "description": "6 business days"
        },
        {
            "maxHandlingTime": 7,
            "description": "7 business days"
        },
        {
            "maxHandlingTime": 10,
            "description": "10 business days"
        },
        {
            "maxHandlingTime": 15,
            "description": "15 business days"
        },
        {
            "maxHandlingTime": 20,
            "description": "20 business days"
        },
        {
            "maxHandlingTime": 30,
            "description": "30 business days"
        },
        {
            "maxHandlingTime": 40,
            "description": "40 business days"
        }
    ]
}
```

---
