# GET : getSubscriptions Samples

- [Sample 1: Get subscriptions](#sample-1-get-subscriptions)

---

## Sample 1: Get subscriptions

This method retrieves an array containing the details and status of all subscriptions limited by the authorization scope.

### Input

The input specifies the optional `limit` and `continuation_token` query parameters. Since no limit is specified in this request, the default value of 20 is used.

```http
GET https://api.ebay.com/commerce/notification/v1/subscription
```

### Output

The output is an array of subscriptions and their details such as the `subscriptionId`, `topicId`, `status`, `creationDate`, `payload`, and `destinationId`.

```json
{
    "total": 1,
    "href": "https://api.ebay.com/commerce/notification/v1/subscription?limit=20",
    "limit": 20,
    "subscriptions": [
        {
            "subscriptionId": "0******e-***f-***2-***4-***********9",
            "topicId": "MARKETPLACE_ACCOUNT_DELETION",
            "status": "DISABLED",
            "creationDate": "2021-06-25T09:02:50.707053",
            "payload": {
                "format": "JSON",
                "schemaVersion": "1.0",
                "deliveryProtocol": "HTTPS"
            },
            "destinationId": "0******9-***6-***8-***3-***********f"
        }
    ]
}
```

---