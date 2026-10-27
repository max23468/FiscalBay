# GET : GetInquiry Samples

## Example

### Request

```http
GET https://api.ebay.com/post-order/v2/inquiry/5********3
Authorization: Bearer <access-token>
```

### Response Excerpt

This excerpt is based on the public sample shown on the Get Inquiry reference page.

```json
{
	"inquiryId": "5********3",
	"status": "CLOSED",
	"state": "CLOSED",
	"creationReason": "INCOMPLETE_ORDER",
	"initiator": "BUYER",
	"claimAmount": {
		"value": 34.56,
		"currency": "USD"
	},
	"inquiryClosureDate": {
		"value": "2020-08-12T05:08:48.000Z"
	},
	"inquiryQuantity": 1,
	"itemId": "2**********7",
	"transactionId": "1********15",
	"sellerMakeItRightByDate": {
		"value": "2020-08-14T06:59:59.000Z"
	},
	"itemDetails": {
		"itemTitle": "test item Active CBT ",
		"itemPrice": {
			"value": 34.56,
			"currency": "USD"
		},
		"itemPictureUrl": "https://i.ebayimg.com/00/s/M**********w/z/Q*************Pf/$_0.JPG?set_id=8********7",
		"viewPurchasedItemUrl": "http://L*************1/ws/eBayISAPI.dll?ViewItemVersion&item=2**********7&tid=1*********5&view=all"
	},
	"inquiryDetails": {
		"creationDate": {
			"value": "2020-08-11T01:21:57.000Z"
		},
		"expirationDate": {
			"value": "2020-08-14T07:00:00.000Z"
		},
		"refundDeadlineDate": {
			"value": "2020-08-15T05:08:48.000Z"
		},
		"totalAmount": {
			"value": 34.56,
			"currency": "USD"
		},
		"refundChargeAmount": {
			"value": 43.71,
			"convertedFromValue": 33.67,
			"convertedFromCurrency": "USD",
			"currency": "CAD",
			"exchangeRate": "1.29826"
		}
	},
	"inquiryHistoryDetails": {
		"history": [
			{
				"date": {
					"value": "2020-08-12T05:08:48.000Z"
				},
				"action": "Voluntary refund completed or failed",
				"actor": "SYSTEM"
			}
		],
		"shipmentTrackingDetails": {
			"trackingURL": null,
			"trackingNumber": null,
			"carrier": null,
			"estimateFromDate": null,
			"estimateToDate": null,
			"currentStatus": null
		}
	}
}
```

### Example Notes

- Public sample IDs, URLs, and image data are masked by the source.
- The public sample contains testing-style item naming from the source.
- Some conditional nested fields are omitted here for readability even though the source supports them.

## Notes

- This is a traditional Post-Order REST inquiry operation.
- Migration mapping may point to newer GraphQL inquiry APIs, but this page documents the original traditional endpoint.

## Related Operations

- `GET /post-order/v2/inquiry/search` to locate inquiries
- `POST /post-order/v2/inquiry/{inquiryId}/send_message` to message the order partner
- `POST /post-order/v2/inquiry/{inquiryId}/provide_shipment_info` to provide shipping evidence
- `POST /post-order/v2/inquiry/{inquiryId}/issue_refund` to issue a refund
- `POST /post-order/v2/inquiry/{inquiryId}/escalate` to escalate the inquiry to a case
