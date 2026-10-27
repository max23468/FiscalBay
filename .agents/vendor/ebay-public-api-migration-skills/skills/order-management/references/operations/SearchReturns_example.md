# GET : SearchReturns Samples

## Example

### Request

```http
GET https://api.ebay.com/post-order/v2/return/search?return_state=RETURN_STARTED
Authorization: Bearer <access-token>
```

### Response Excerpt

```json
{
	"countSummary": [
		{
			"count": 3,
			"type": "RETURN_STARTED"
		}
	],
	"members": [
		{
			"returnId": "5********2",
			"currentType": "MONEY_BACK",
			"state": "RETURN_REQUESTED",
			"status": "RETURN_REQUESTED",
			"creationInfo": {
				"creationDate": {
					"value": "2015-08-05T20:18:17.000Z"
				},
				"item": {
					"itemId": "1**********6",
					"transactionId": "8********9",
					"returnQuantity": 1
				},
				"reason": "ARRIVED_DAMAGED",
				"type": "MONEY_BACK"
			},
			"buyerLoginName": "b*******1",
			"sellerLoginName": "s********4",
			"buyerTotalRefund": {
				"estimatedRefundAmount": {
					"value": 27.5,
					"currency": "USD"
				}
			},
			"sellerAvailableOptions": [
				{
					"actionType": "SELLER_APPROVE_REQUEST"
				},
				{
					"actionType": "SELLER_DECLINE_REQUEST"
				},
				{
					"actionType": "SELLER_SEND_MESSAGE"
				}
			],
			"sellerResponseDue": {
				"activityDue": "SELLER_APPROVE_REQUEST",
				"respondByDate": {
					"value": "2015-08-09T20:18:17.000Z"
				}
			}
		}
	],
	"paginationOutput": {
		"limit": 100,
		"offset": 1,
		"totalEntries": 3,
		"totalPages": 1
	}
}
```

## Notes

- Public sample IDs and usernames are masked by the source.
- If `return_id` is supplied, other query parameters are ignored.

## Related Operations

- `GET /post-order/v2/return/{returnId}` to inspect a specific return
