# POST : EscalateReturn Samples

## Example

### Request

```http
POST https://api.ebay.com/post-order/v2/return/5********9/escalate
Authorization: Bearer <access-token>
Content-Type: application/json

{
	"reason": "SELLER_NO_RESPONSE",
	"comments": {
		"content": "The seller did not respond to my return request."
	}
}
```

### Response Excerpt

```json
{
	"caseId": "5********7"
}
```

## Notes

- Public sample IDs are masked by the source.
- Migration mapping may point to newer GraphQL return referral flows, but this page documents the original traditional return escalation endpoint.

## Related Operations

- `GET /post-order/v2/return/{returnId}` to inspect the return before escalating
- `GET /post-order/v2/casemanagement/{caseId}` to inspect the resulting case
