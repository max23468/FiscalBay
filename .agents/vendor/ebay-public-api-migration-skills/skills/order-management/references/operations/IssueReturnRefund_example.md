# POST : IssueReturnRefund Samples

## Example

### Request

```http
POST https://api.ebay.com/post-order/v2/return/5********2/issue_refund
Authorization: Bearer <access-token>
Content-Type: application/json

{
	"comments": {
		"content": "Here is your refund for return request #5********2. I have refunded your purchase price, your original shipping costs, and your return shipping costs."
	},
	"refundDetail": {
		"itemizedRefundDetail": [
			{
				"refundAmount": {
					"value": 19.95,
					"currency": "USD"
				},
				"refundFeeType": "PURCHASE_PRICE"
			},
			{
				"refundAmount": {
					"value": 4.25,
					"currency": "USD"
				},
				"refundFeeType": "ORIGINAL_SHIPPING"
			},
			{
				"refundAmount": {
					"value": 4.25,
					"currency": "USD"
				},
				"refundFeeType": "RETURN_SHIPPING"
			}
		],
		"totalAmount": {
			"value": 28.45,
			"currency": "USD"
		}
	}
}
```

### Response Excerpt

```json
{
	"refundStatus": "SUCCESS"
}
```

## Notes

- Public sample IDs are masked by the source.
- `donationAmount` exists in the model, but the source explicitly notes it is not applicable for this method.

## Related Operations

- `GET /post-order/v2/return/{returnId}` to inspect refund and relist outcome
- `POST /post-order/v2/return/{returnId}/mark_as_received` before refund, when appropriate
