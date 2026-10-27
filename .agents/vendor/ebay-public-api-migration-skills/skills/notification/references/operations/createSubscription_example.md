# POST : createSubscription Samples

- [Sample 1: Create subscription](#sample-1-create-subscription)

---

## Sample 1: Create subscription

This call creates a subscription for an application.

### Input

The required inputs are `topicId`, `status`, `payload`, `payload` (including `format`, `schemaVersion` and `deliveryProtocol`) and `destinationId`.

```http
POST https://api.ebay.com/commerce/notification/v1/subscription
{
    "topicId": "MARKETPLACE_ACCOUNT_DELETION",
    "status":"DISABLED",
    "destinationId":"0******9-***6-***8-****-***********f",
    "payload": {
                    "format" : "JSON",
                    "schemaVersion": "1.0",
                    "deliveryProtocol": "HTTPS"
                }

}
```

### Output

A successful call returns the HTTP status code `201 Created`. This method has no response payload.

---