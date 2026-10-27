# GET : GetReturnFiles Samples

## Example

### Request

```http
GET https://api.ebay.com/post-order/v2/return/5********1/files
Authorization: Bearer <access-token>
```

### Response Excerpt

```json
{
	"files": [
		{
			"fileId": "5********2",
			"fileData": "/9j/4*******************D/7***Q ... G***********************P/2Q==",
			"filePurpose": "ITEM_RELATED",
			"fileStatus": "CREATED",
			"submitter": "BUYER",
			"fileFormat": "JPEG",
			"creationDate": {
				"value": "2015/08/13 15:49:28.000.-0700"
			}
		}
	]
}
```

## Notes

- Public sample values are masked and truncated by the source.
- The public sample uses a non-ISO style timestamp in `creationDate.value`; preserve source awareness when interpreting traditional samples.

## Related Operations

- `POST /post-order/v2/return/{returnId}/file/upload` to add files to the return
