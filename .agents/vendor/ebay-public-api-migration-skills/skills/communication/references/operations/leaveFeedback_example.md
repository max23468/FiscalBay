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
    "listingId": "30********54",
    "transactionId": "10*************10",
    "images": [
        {
            "uri": "https://***1"
        },
        {
            "uri": "https://***2"
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

If the call is successful, HTTP status code **200 Success** is returned, along with the feedback ID.

```json
{
    "feedbackId": "85******20"
}
```

---

