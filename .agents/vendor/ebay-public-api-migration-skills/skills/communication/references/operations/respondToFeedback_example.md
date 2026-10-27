# POST : respondToFeedback Samples
- [Sample 1: Reply to feedback](#sample-1-reply-to-feedback)

---

## Sample 1: Reply to feedback

This call responds to the user's order partner feedback for a line item in the order.

### Input

The inputs are the feedback ID, the recipient user ID, the response text, and the type of response.

```http
POST https://api.ebay.com/commerce/feedback/v1/respond_to_feedback
{
  "feedbackId": "85******20",
  "recipientUserId": "x***r",
  "responseText": "Thank you for your feedback!",
  "responseType": "REPLY"
}
```

### Output

If the call is successful, HTTP status code **200 Success** is returned.

*Sample output file not available for this operation.*

---

