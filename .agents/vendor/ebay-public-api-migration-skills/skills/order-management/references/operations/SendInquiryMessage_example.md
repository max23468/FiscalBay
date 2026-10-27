# POST : SendInquiryMessage Samples

## Example

### Request

```http
POST https://api.ebay.com/post-order/v2/inquiry/5********9/send_message
Authorization: Bearer <access-token>
Content-Type: application/json

{
	"message": {
		"content": "I still want this item, and if you will send it to me, I will close the INR inquiry once the item is received."
	}
}
```

### Response

```http
HTTP/1.1 200 OK
```

## Notes

- This operation can be used by either buyer or seller.

## Related Operations

- `GET /post-order/v2/inquiry/{inquiryId}` to inspect the inquiry
- `POST /post-order/v2/inquiry/{inquiryId}/provide_shipment_info` to provide tracking details
