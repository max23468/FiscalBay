# POST : enableSubscription Samples

- [Sample 1: Enable a subscription](#sample-1-enable-a-subscription)

---

## Sample 1: Enable a subscription

This call enables a subscription.

### Input

The input is the `subscription_id` as a path parameter.

```http
POST https://api.ebay.com/commerce/notification/v1/subscription/{subscription_id}/enable
```

### Output

A successful call returns the HTTP status code `204 No Content`. This method has no response payload.

---