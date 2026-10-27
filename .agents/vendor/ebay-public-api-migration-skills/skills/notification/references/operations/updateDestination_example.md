# PUT : updateDestination Samples

- [Sample 1: Update a destination](#sample-1-update-a-destination)

---

## Sample 1: Update a destination

This call updates a destination.

### Input

The inputs are the optional `name`, and the required `deliveryConfig` including the endpoint` and the `verificationToken`.

```http
PUT https://api.ebay.com/commerce/notification/v1/destination/{destination_id}
```

### Output

A successful call returns the HTTP status code `204 No Content`. This method has no response payload.

---