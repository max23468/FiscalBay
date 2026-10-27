# POST : leaveFeedback Samples
- [Sample 1: Leave feedback](#sample-1-leave-feedback)

---

## Sample 1: Leave feedback

This call creates and submits feedback on the user's order partner for a line item in the order.

### Input

The inputs are the feedback comment text, type, listing ID, transaction ID, as well as images and seller ratings.

```http
POST https://api.ebay.com/commerce/feedback/v1/feedback
{
    "commentText": "Great seller, fast shipping!",
    "commentType": "POSITIVE",
    "listingId": "EXAMPLE-LISTING-0002",
    "transactionId": "EXAMPLE-TRANSACTION-0001",
    "images": [
        {
            "uri": "https://example.test/resource-0001"
        },
        {
            "uri": "https://example.test/resource-0002"
        }
    ],
    "sellerRatings": [
        {
            "key": "COMMUNICATION",
            "value": "5"
        }
    ]
}
```

### Output

If the call is successful, HTTP status code 00200 Success00 is returned, along with the feedback ID.

```json
{
    "feedbackId": "EXAMPLE-FEEDBACK-0001"
}
```

---


