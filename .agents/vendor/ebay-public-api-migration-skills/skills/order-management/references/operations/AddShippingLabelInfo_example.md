# POST : AddShippingLabelInfo Samples

## Example

### Request

```http
POST https://api.ebay.com/post-order/v2/return/5********9/add_shipping_label
Authorization: Bearer <access-token>
Content-Type: application/json

{
	"carrierEnum": "USPS",
	"comments": {
		"content": "The shipping label you can use has been added to your return request."
	},
	"labelId": "8******1",
	"trackingNumber": "9*******************9",
	"labelAction": "UPLOAD_LABEL"
}
```

### Response Excerpt

```json
{
	"labelData": "B** B****, 2****************e, *******, CA 9***5, United States",
	"labelId": "8******1",
	"labelURL": "https://return.ebay.com/ws/eBayISAPI.dll?ResolveReturn&eventName=returnLabel&returnId=5********8",
	"trackingNumber": "9*******************9"
}
```

## Notes

- Public sample values are masked by the source.
- The public sample text references `labelId` as required for the upload-label flow, while the field list above also makes it clear that requirements vary by `labelAction`.

## Related Operations

- `POST /post-order/v2/return/{returnId}/file/upload` to upload a seller-provided shipping label file
- `GET /post-order/v2/return/{returnId}` to inspect current replacement or shipping-label state
