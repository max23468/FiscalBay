# POST : ProvideInquiryShipmentInfo Samples

## Example

### Request

```http
POST https://api.ebay.com/post-order/v2/inquiry/5********8/provide_shipment_info
Authorization: Bearer <access-token>
Content-Type: application/json

{
	"shippingCarrierName": "FedEx",
	"shippingDate": {
		"value": "2015-09-05T20:18:17.000Z"
	},
	"shippedWithTracking": true,
	"trackingNumber": "1*********7",
	"proofOfShipmentUploaded": false,
	"sellerComments": {
		"content": "I have shipped this item. Here are the shipment tracking details."
	}
}
```

### Response

```http
HTTP/1.1 200 OK
```

### Example Notes

- Public sample IDs and tracking values are masked by the source.
- If `proofOfShipmentUploaded=true`, the source says the other tracking fields are no longer necessary.

## Notes

- This is a seller-side evidence submission operation in the traditional inquiry flow.

## Related Operations

- `GET /post-order/v2/inquiry/{inquiryId}` to inspect the inquiry
- `POST /post-order/v2/inquiry/{inquiryId}/send_message` to communicate with the buyer
- `POST /post-order/v2/inquiry/{inquiryId}/escalate` to escalate the inquiry
