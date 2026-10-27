# GET : GetReturn Samples

## Example

### Request

```http
GET https://api.ebay.com/post-order/v2/return/5********2?fieldgroups=FULL
Authorization: Bearer <access-token>
```

### Response Excerpt

This excerpt combines the most useful public sample fields from both the summary and detail examples shown on the reference page.

```json
{
	"summary": {
		"returnId": "5********2",
		"currentType": "MONEY_BACK",
		"state": "CLOSED",
		"buyerLoginName": "b********4",
		"sellerLoginName": "s*********5",
		"buyerTotalRefund": {
			"actualRefundAmount": {
				"value": 43.5,
				"currency": "USD"
			}
		},
		"creationInfo": {
			"creationDate": {
				"value": "2015-07-27T10:35:24.000Z"
			},
			"item": {
				"itemId": "1**********7",
				"transactionId": "8********9",
				"returnQuantity": 1
			},
			"reason": "ORDERED_ACCIDENTALLY",
			"type": "MONEY_BACK"
		}
	},
	"detail": {
		"buyerLoginName": "b********4",
		"sellerLoginName": "s*********5",
		"itemDetail": {
			"itemId": "1**********7",
			"transactionId": "8********9",
			"returnQuantity": 1
		},
		"marketplaceId": "EBAY_US",
		"moneyMovementInfo": [
			{
				"actualAmount": {
					"value": 43.5,
					"currency": "USD"
				},
				"moneyMovementType": "PAYPAL_REFUND",
				"paymentProvider": "PAYPAL",
				"status": "SUCCESS"
			}
		],
		"refundInfo": {
			"actualRefundDetail": {
				"actualRefund": {
					"itemizedRefundDetail": [
						{
							"refundAmount": {
								"value": 40.0,
								"currency": "USD"
							},
							"refundFeeType": "PURCHASE_PRICE"
						},
						{
							"refundAmount": {
								"value": 3.5,
								"currency": "USD"
							},
							"refundFeeType": "ORIGINAL_SHIPPING"
						},
						{
							"refundAmount": {
								"value": 3.5,
								"currency": "USD"
							},
							"refundFeeType": "RETURN_SHIPPING"
						}
					],
					"totalAmount": {
						"value": 43.5,
						"currency": "USD"
					}
				},
				"refundInitiationType": "SELLER_INITIATED",
				"refundIssuedDate": {
					"value": "2015-08-02T20:18:17.000Z"
				},
				"refundStatus": "SUCCESS"
			}
		}
	}
}
```

## Notes

- Public sample IDs and usernames are masked by the source.
- The public examples focus on a closed money-back return with refund history.
- Migration mapping may point to newer GraphQL return APIs, but this page documents the original traditional endpoint.

## Related Operations

- `GET /post-order/v2/return/search` to locate returns
- `POST /post-order/v2/return/{returnId}/issue_refund` to issue a refund
- `POST /post-order/v2/return/{returnId}/mark_as_received` to mark the item as received
- `POST /post-order/v2/return/{returnId}/send_message` to communicate with the buyer or seller
- `POST /post-order/v2/return/{returnId}/escalate` to escalate the return to a case
