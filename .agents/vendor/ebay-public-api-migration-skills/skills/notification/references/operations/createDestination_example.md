# POST : createDestination Samples

- [Sample 1: Create a destination](#sample-1-create-a-destination)

---

## Sample 1: Create a destination

This call creates a destination.

### Input

The inputs are the optional `name`, and the required `deliveryConfig` including the endpoint` and the `verificationToken`.

```http
POST https://api.ebay.com/commerce/notification/v1/destination
{
    "name":"api_destination",
    "status":"DISABLED",
    "deliveryConfig": {
        "endpoint":"https://e***********4.s*************.com/notification-endpoint",
        "verificationToken": "7*******-d***-***c-b***-***********a"
    }
}
```

### Output

A successful call returns the HTTP status code `204 No Content`. This method has no response payload.

---