# POST : CreateCancellationRequest Samples

## Example

### Request

```http
POST https://api.ebay.com/post-order/v2/cancellation/
Authorization: Bearer <access-token>
Content-Type: application/json

{
	"legacyOrderId": "1**********6-8********7",
	"cancelReason": "ORDER_MISTAKE",
	"buyerPaid": false
}
```

### Response Excerpt

This excerpt is based on the public sample shown on the Create Cancellation Request reference page.

```json
{
	"cancelId": "5********2",
	"orderEligibilityResult": {
		"eligible": true,
		"itemEligibilityResult": [
			{
				"eligible": true,
				"itemId": "1**********76",
				"transactionId": "8********7"
			}
		],
		"legacyOrderId": "1**********6-8********7"
	}
}
```

### Example Notes

- Public sample IDs are masked by the source.
- The sample shows a successful buyer-side cancellation request.
- The public source recommends checking eligibility before creating the request.

## Notes

- Sellers may cancel directly in some seller-side scenarios, including inability to fulfill an order.
- Seller-initiated cancellations due to stock issues may have seller-account implications, per the source.
- This page documents the traditional cancellation endpoint itself; migration mapping may point to newer GraphQL cancellation flows.

## Related Operations

- `POST /post-order/v2/cancellation/check_eligibility` to pre-check the order
- `GET /post-order/v2/cancellation/{cancelId}` to inspect the created cancellation request
- `POST /post-order/v2/cancellation/{cancelId}/approve` to approve a buyer request
- `POST /post-order/v2/cancellation/{cancelId}/reject` to reject a buyer request
