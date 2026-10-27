# GET : getItemsAwaitingFeedback Samples
- [Sample 1: Get Items Awaiting Feedback](#sample-1-get-items-awaiting-feedback)

---

## Sample 1: Get Items Awaiting Feedback

This sample call retrieves all line items awaiting feedback from the user as both buyer and seller.

### Input

The input specifies the **limit** and **offset** as query parameters.

```http
GET https://api.ebay.com/commerce/feedback/v1/awaiting_feedback?limit=2&offset=0
```

### Output

A successful call returns an array of line items matching the pagination parameters. This example returns results including two line items where feedback is due from the user, one with the user's role as a buyer and one with the user's role as seller.

```json
{
  "pagination": {
    "total": 3,
    "prev": null,
    "next": "/awaiting_feedback?offset=2&limit=2",
    "count": 2,
    "offset": 0,
    "limit": 2
  },
  "itemsAwaitingFeedbackCount": {
    "asBuyer": 1,
    "asSeller": 2
  },
  "lineItems": [
    {
      "listingId": "20********52",
      "listingTitle": "Wireless Headphones",
      "listingPrice": {
        "value": 59.99,
        "currency": "USD"
      },
      "transactionId": "8********0",
      "orderLineItemId": "20********52-8********0",
      "ratingTemplates": [
        {
          "ratingKey": "OVERALL_EXPERIENCE",
          "ratingLabel": "Rate this transaction",
          "required": true,
          "multiValueRating": false,
          "ratingValueType": "PREDEFINED",
          "enabled": true,
          "acceptableValues": [
            { "value": "POSITIVE", "valueLabel": "Positive", "enabled": true },
            { "value": "NEUTRAL",  "valueLabel": "Neutral",  "enabled": true },
            { "value": "NEGATIVE", "valueLabel": "Negative", "enabled": true }
          ]
        },
        {
          "ratingKey": "OVERALL_EXPERIENCE_COMMENT",
          "ratingLabel": "Tell us more",
          "maximumCharactersAllowed": 80,
          "required": true,
          "multiValueRating": false,
          "ratingValueType": "FREETEXT",
          "enabled": true
        },
        {
          "ratingKey": "DSR_ITEM_AS_DESCRIBED",
          "ratingLabel": "How accurate was the item description?",
          "required": false,
          "multiValueRating": false,
          "ratingValueType": "RANGE",
          "enabled": true,
          "acceptableValues": [
            { "value": "1", "valueLabel": "Very inaccurate", "enabled": true },
            { "value": "2", "valueLabel": "Inaccurate", "enabled": true },
            { "value": "3", "valueLabel": "Neither inaccurate nor accurate", "enabled": true },
            { "value": "4", "valueLabel": "Accurate", "enabled": true },
            { "value": "5", "valueLabel": "Very accurate", "enabled": true }
          ]
        },
        {
          "ratingKey": "DSR_ITEM_AS_DESCRIBED_ACCURACY",
          "ratingLabel": "Why weren't you satisfied with the item description?",
          "required": false,
          "multiValueRating": false,
          "ratingValueType": "PREDEFINED",
          "enabled": true,
          "acceptableValues": [
            { "value": "5", "valueLabel": "Item was not received", "enabled": true },
            { "value": "6", "valueLabel": "Quality did not match item description", "enabled": true },
            { "value": "2", "valueLabel": "Item was damaged", "enabled": true },
            { "value": "1", "valueLabel": "Item was a counterfeit, replica, or an unauthorized copy", "enabled": true },
            { "value": "3", "valueLabel": "Wrong item", "enabled": true },
            { "value": "4", "valueLabel": "Other", "enabled": true }
          ]
        }
      ]
    },
    {
      "listingId": "14********28",
      "listingTitle": "USB-C Cable",
      "listingPrice": {
        "value": 7.49,
        "currency": "USD"
      },
      "transactionId": "8********4",
      "orderLineItemId": "14********28-8********4",
      "ratingTemplates": [
        {
          "ratingKey": "OVERALL_EXPERIENCE",
          "ratingLabel": "Rate this transaction",
          "required": true,
          "multiValueRating": false,
          "ratingValueType": "PREDEFINED",
          "enabled": true,
          "acceptableValues": [
            { "value": "POSITIVE", "valueLabel": "Positive", "enabled": true },
            { "value": "NEUTRAL",  "valueLabel": "Neutral",  "enabled": true },
            { "value": "NEGATIVE", "valueLabel": "Negative", "enabled": true }
          ]
        },
        {
          "ratingKey": "OVERALL_EXPERIENCE_COMMENT",
          "ratingLabel": "Tell us more",
          "maximumCharactersAllowed": 80,
          "required": true,
          "multiValueRating": false,
          "ratingValueType": "FREETEXT",
          "enabled": true
        }
      ]
    }
  ]
}
```

---

