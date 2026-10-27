# POST : SetReturnPreferences Samples

## Example

### Request

```http
POST https://api.ebay.com/post-order/v2/return/preference
Authorization: Bearer <access-token>
Content-Type: application/json

{
	"rmaRequired": true
}
```

### Response

```http
HTTP/1.1 200 OK
```

## Related Operations

- `GET /post-order/v2/return/preference` to verify the current configuration
