# POST : EscalateInquiry Samples

## Example

### Request

```http
POST https://api.ebay.com/post-order/v2/inquiry/5********7/escalate
Authorization: Bearer <access-token>
Content-Type: application/json

{
	"escalationReason": "SELLER_NORESPONSE",
	"comments": {
		"content": "The seller has not addressed my inquiry."
	}
}
```

### Response

```http
HTTP/1.1 200 OK
```

### Example Notes

- Public sample IDs are masked by the source.
- The sample uses `escalationReason`, while the request model names the field `escalateInquiryReason`.

## Notes

- Migration mapping may point to a newer GraphQL referral flow, but this page documents the original traditional escalation endpoint.

## Related Operations

- `GET /post-order/v2/inquiry/{inquiryId}` to inspect the inquiry before escalating
- `GET /post-order/v2/casemanagement/{caseId}` to manage the resulting escalated case
