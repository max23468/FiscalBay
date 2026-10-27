# GET : GetCase Samples

## Example

### Request

```http
GET https://api.ebay.com/post-order/v2/casemanagement/5********2
Authorization: Bearer <access-token>
```

### Response Excerpt

This excerpt is based on the public sample shown on the Get Case reference page. It is an `ITEM_NOT_RECEIVED` case sample, so some return-specific fields are not populated.

```json
{
	"caseId": "5********2",
	"caseType": "ITEM_NOT_RECEIVED",
	"itemId": "2**********6",
	"transactionId": "1*********5",
	"returnId": "-1",
	"status": "OTHER",
	"claimAmount": {
		"value": 34.67,
		"currency": "USD"
	},
	"shippingFee": {
		"value": 0,
		"currency": "USD"
	},
	"caseQuantity": 1,
	"initiator": "BUYER",
	"creationDate": {
		"value": "2020-08-10T22:16:23.000Z"
	},
	"lastModifiedDate": {
		"value": "2020-08-12T18:01:40.000Z"
	},
	"sellerClosureReason": "UNDEFINED",
	"buyerClosureReason": "UNDEFINED",
	"buyerProtectedProgramLink": "http://L*************1/h**p/***/p****************s.html",
	"payForItemLink": "http://L*************1/help/policies/unpaid-item.html",
	"recalledItemLink": "http://L*************1/help/policies/recalled.html",
	"fsnadDaysToAddTrackingAfterShippingItem": 0,
	"appealDetails": {
		"eligibleForAppeal": false,
		"appealStatus": "OTHER",
		"appealDate": {
			"value": "2020-08-12T18:01:40.000Z"
		},
		"appealReasonCode": null,
		"appealCloseReasonEnum": "OTHER",
		"appealStatusEnum": "SELLER_APPEALED",
		"appealRefundAmount": null
	},
	"caseDetails": {
		"creationDate": {
			"value": "2020-08-10T22:16:23.000Z"
		},
		"expirationDate": {
			"value": "2020-08-14T07:00:00.000Z"
		},
		"escalationDate": {
			"value": "2020-08-10T22:30:40.000Z"
		},
		"refundAmounts": {
			"refundAmount": null,
			"feeCreditAmount": null,
			"buyerFinalAcceptRefundAmt": {
				"value": 0,
				"currency": "USD"
			},
			"buyerInitExpectRefundAmt": {
				"value": 0,
				"currency": "USD"
			},
			"internationalRefundAmount": null
		},
		"refundChargeAmount": {
			"value": 45.01,
			"convertedFromValue": 34.67,
			"convertedFromCurrency": "USD",
			"currency": "CAD",
			"exchangeRate": "1.29826"
		},
		"refundType": "OTHER",
		"refundDeadlineDate": {
			"value": "2020-08-15T18:01:40.000Z"
		},
		"buyerInitExpectResolution": "BOR1 - I want a full refund (without returning the item i.e. not received yet)",
		"buyerFinalAcceptResolution": "Unknown",
		"lastBuyerRespDate": null,
		"lastSellerRespDate": null
	},
	"actionDeadlines": {
		"maxDaysToFileClaim": 30,
		"daysToReturnItem": 3,
		"daysToExpireWithResponse": 21,
		"daysToExpireWithoutResponse": 21,
		"daysForBuyerToProvideProofOfShipment": -1
	},
	"caseHistoryDetails": {
		"history": [
			{
				"date": {
					"value": "2020-08-10T22:16:23.000Z"
				},
				"action": "A CPS case was created.",
				"actor": "BUYER",
				"description": "active CBT e2e testing",
				"moneyMovement": null
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

- This public sample is an INR case, not a return-case sample.
- `shipmentTrackingDetails` and `returnDetails` may be present in real responses when relevant, but they are not populated in this public sample.
- Public sample IDs and URLs are masked by the source.

## Notes

- This is a Post-Order REST API operation.
- The method is not supported in the Sandbox environment.
- Many response fields are conditional and appear only when relevant to the current case type or lifecycle state.
- The migration mapping in `api-mapping.csv` points `GetCase` to newer GraphQL inquiry/return flows, but the original `GetCase` operation itself is a REST endpoint.

## Related Operations

- `GET /post-order/v2/casemanagement/search` to locate cases before retrieving one by ID
- `POST /post-order/v2/casemanagement/{caseId}/appeal` to appeal a case decision
- `POST /post-order/v2/casemanagement/{caseId}/issue_refund` when a seller needs to issue a refund
- `POST /post-order/v2/casemanagement/{caseId}/provide_shipment_info` when shipment tracking information must be supplied
