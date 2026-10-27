# POST : RejectCancellation Samples

## Example

### Request

```http
POST https://api.ebay.com/post-order/v2/cancellation/5********8/reject
Authorization: Bearer <access-token>
Content-Type: application/json

{
	"shipmentDate": {
		"value": "2015-08-22T23:29:11.000Z"
	},
	"trackingNumber": "4******************************0"
}
```

### Response

```http
HTTP/1.1 200 OK
```

### Example Notes

- Public sample IDs and tracking values are masked by the source.
- If shipment data is not available, the request body should still be `{}` rather than omitted.

## Notes

- This is a seller-side action in the traditional cancellation flow.
- The source recommends providing shipment information when the order has already shipped.

## Related Operations

- `GET /post-order/v2/cancellation/{cancelId}` to inspect the cancellation request
- `POST /post-order/v2/cancellation/{cancelId}/approve` to approve a buyer cancellation request
- `POST /post-order/v2/cancellation` to create the original cancellation request
