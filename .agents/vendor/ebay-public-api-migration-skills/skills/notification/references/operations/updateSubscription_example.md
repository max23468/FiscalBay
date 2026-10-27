# PUT : updateSubscription Samples

- [Sample 1: Update subscription](#sample-1-update-subscription)

---

## Sample 1: Update subscription

This call creates a subscription for an application.

### Input

The required inputs are `topicId`, `status`, `payload`, `payload` (including `format`, `schemaVersion` and `deliveryProtocol`) and `destinationId`.

```http
PUT https://api.ebay.com/commerce/notification/v1/subscription/{subscription_id}
{
    "topicId": "MARKETPLACE_ACCOUNT_DELETION",
    "status":"ENABLED",
    "destinationId":"9******7-***2-***4-***f-***********b",
    "payload": {
        "format":"JSON",
        "schemaVersion":"1.0",
        "deliveryProtocol":"HTTPS"
    }

}
```

### Output

A successful call returns the HTTP status code `201 Created`. This method has no response payload.

---