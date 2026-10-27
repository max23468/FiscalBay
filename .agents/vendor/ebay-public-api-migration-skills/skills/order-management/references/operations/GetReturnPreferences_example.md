# GET : GetReturnPreferences Samples

## Example

### Request

```http
GET https://api.ebay.com/post-order/v2/return/preference
Authorization: Bearer <access-token>
```

### Response Excerpt

```json
{
	"advanceRulesEnabled": true,
	"rmaRequired": true,
	"versionId": 4
}
```

## Notes

- `versionId` changes when the seller updates return rules in My eBay.

## Related Operations

- `POST /post-order/v2/return/preference` to update the RMA requirement
