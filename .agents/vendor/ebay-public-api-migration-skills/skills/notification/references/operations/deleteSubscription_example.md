# DELETE : deleteSubscription Samples

- [Sample 1: Delete a subscription](#sample-1-delete-a-subscription)

---

## Sample 1: Delete a subscription

This call deletes the specified destination.

### Input

The only input is the `subscription_id` as a path parameter.

```http
DELETE https://api.ebay.com/commerce/notification/v1/subscription/{subscription_id}
```

### Output

A successful call returns the HTTP status code `204 No content`. This method has no response payload.

---