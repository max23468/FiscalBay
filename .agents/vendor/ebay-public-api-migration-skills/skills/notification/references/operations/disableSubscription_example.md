# POST : disableSubscription Samples

- [Sample 1: Disable a subscription](#sample-1-disable-a-subscription)

---

## Sample 1: Disable a subscription

This call disables a subscription.

### Input

The input is the `subscription_id` as a path parameter.

```http
POST https://api.ebay.com/commerce/notification/v1/subscription/{subscription_id}/disable
```

### Output

A successful call returns the HTTP status code `204 No Content`. This method has no response payload.

---