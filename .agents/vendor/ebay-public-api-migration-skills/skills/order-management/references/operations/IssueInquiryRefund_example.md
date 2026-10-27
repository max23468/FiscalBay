# POST : IssueInquiryRefund Samples

## Example

### Request

```http
POST https://api.ebay.com/post-order/v2/inquiry/5********9/issue_refund
Authorization: Bearer <access-token>
Content-Type: application/json

{
	"comments": {
		"content": "Your refund is on its way."
	}
}
```

### Response Excerpt

```json
{
	"refundResult": {
		"refundSource": "INSTANT_REFUND",
		"refundStatus": "SUCCESS"
	}
}
```

### Example Notes

- Public sample IDs are masked by the source.
- The sample shows a successful instant refund.

## Notes

- This is a seller-side resolution action in the traditional inquiry flow.
- Migration mapping may point to newer GraphQL refund mutations, but this page documents the original traditional endpoint.

## Related Operations

- `GET /post-order/v2/inquiry/{inquiryId}` to inspect the inquiry
- `POST /post-order/v2/inquiry/{inquiryId}/provide_refund_info` to send refund information to the buyer
