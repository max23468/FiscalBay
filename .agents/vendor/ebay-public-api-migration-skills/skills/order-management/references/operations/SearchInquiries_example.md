# GET : SearchInquiries Samples

## Example

### Request

```http
GET https://api.ebay.com/post-order/v2/inquiry/search?inquiry_status=WAITING_SELLER_RESPONSE
Authorization: Bearer <access-token>
```

### Response Excerpt

```json
{
	"members": [
		{
			"buyer": "a********r",
			"claimAmount": {
				"currency": "USD",
				"value": "34.5"
			},
			"creationDate": {
				"value": "2015-09-04T20:18:17.000Z"
			},
			"inquiryId": "5********0",
			"inquiryStatusEnum": "WAITING_SELLER_RESPONSE",
			"itemId": "2**********1",
			"lastModifiedDate": {
				"value": "2015-09-04T20:18:17.000Z"
			},
			"respondByDate": {
				"value": "2015-09-07T20:18:17.000Z"
			},
			"seller": "t**********r",
			"transactionId": "8********0"
		}
	],
	"paginationOutput": {
		"limit": 25,
		"offset": 0,
		"totalEntries": 1,
		"totalPages": 1
	},
	"totalNumberOfInquiries": 1
}
```

### Example Notes

- Public sample IDs and usernames are masked by the source.
- This example searches for inquiries waiting on seller response.

## Notes

- Use `Get Inquiry` to retrieve full detail once you have the `inquiryId`.

## Related Operations

- `GET /post-order/v2/inquiry/{inquiryId}` to retrieve full inquiry detail
- `POST /post-order/v2/inquiry/{inquiryId}/send_message` to communicate on an inquiry
