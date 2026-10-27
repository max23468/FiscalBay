# POST : UploadReturnFile Samples

## Example

### Request

```http
POST https://api.ebay.com/post-order/v2/return/5********1/file/upload
Authorization: Bearer <access-token>
Content-Type: application/json

{
	"fileName": "j*******.jpeg",
	"data": "S******************************************************1",
	"filePurpose": "ITEM_RELATED"
}
```

### Response Excerpt

```json
{
	"fileId": "5********2",
	"compressedFileData": "/9j/4***S...q**P/9k="
}
```

## Notes

- Public sample values are masked and truncated by the source.
- For seller-provided return labels, this operation can be used before `Add Shipping Label Info`.

## Related Operations

- `POST /post-order/v2/return/{returnId}/add_shipping_label` to publish a seller-provided label
- `GET /post-order/v2/return/{returnId}/files` to retrieve attached files
