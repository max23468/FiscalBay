# POST : ProvideInquiryRefundInfo Samples

## Example

### Request

```http
POST https://api.ebay.com/post-order/v2/inquiry/5********9/provide_refund_info
Authorization: Bearer <access-token>
Content-Type: application/json

{
	"message": {
		"content": "This refund applies to the order line items for which you filed inquiry #5********9."
	}
}
```

### Response

```http
HTTP/1.1 200 OK
```

## Notes

- This operation is deprecated and scheduled for decommission on `2026-03-16` per the public source.
- The migration mapping notes there is no direct equivalent, but suggests newer inquiry messaging flows as an alternative.

## Related Operations

- `POST /post-order/v2/inquiry/{inquiryId}/issue_refund` to issue the refund
- `POST /post-order/v2/inquiry/{inquiryId}/send_message` as a newer communication-style alternative
