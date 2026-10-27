# GET : GetCancellation Samples

## Example

### Request

```http
GET https://api.ebay.com/post-order/v2/cancellation/5********5?fieldgroups=FULL
Authorization: Bearer <access-token>
```

### Response Excerpt

This excerpt is based on the public sample shown on the Get Cancellation reference page.

```json
{
	"cancelDetail": {
		"cancelId": "5********5",
		"cancelState": "CLOSED",
		"cancelStatus": "CANCEL_CLOSED_WITH_REFUND",
		"cancelReason": "BUYER_ASKED_CANCEL",
		"cancelRequestDate": {
			"value": "2020-08-11T22:32:10.000Z"
		},
		"cancelCloseDate": {
			"value": "2020-08-11T22:37:28.000Z"
		},
		"cancelCloseReason": "FULL_REFUNDED",
		"legacyOrderId": "0************9",
		"marketplaceId": "EBAY_US",
		"requestorType": "SELLER",
		"paymentStatus": "ONLINE_PAID",
		"partialOrderType": "FULL_ORDER",
		"buyerLoginName": "p**********3",
		"sellerLoginName": "c**********3",
		"requestRefundAmount": {
			"value": 34.67,
			"currency": "USD"
		},
		"activityHistories": [
			{
				"activityType": "SELLER_CREATE_CANCEL",
				"activityParty": "SELLER",
				"actionDate": {
					"value": "2020-08-11T22:32:10.000Z"
				},
				"stateFrom": "INITIAL",
				"stateTo": "REFUND_PENDING"
			}
		],
		"moneyMovementInfo": [
			{
				"moneyMovementType": "SELLER_VOLUNTARY_REFUND",
				"status": "SUCCESS",
				"actualAmount": {
					"value": 34.67,
					"currency": "USD"
				}
			}
		]
	}
}
```

### Example Notes

- Public sample IDs and usernames are masked by the source.
- The public sample shows a closed, refunded cancellation.
- Some conditional fields such as due dates or shipment date may be absent depending on the workflow state.

## Notes

- This is a Post-Order REST API operation.
- The method is not supported in the Sandbox environment.
- This page documents the traditional cancellation endpoint itself; migration mapping may point to newer GraphQL cancellation flows.

## Related Operations

- `GET /post-order/v2/cancellation/search` to locate cancellation requests
- `POST /post-order/v2/cancellation` to create a cancellation request
- `POST /post-order/v2/cancellation/{cancelId}/approve` to approve a buyer cancellation request
- `POST /post-order/v2/cancellation/{cancelId}/reject` to reject a buyer cancellation request
