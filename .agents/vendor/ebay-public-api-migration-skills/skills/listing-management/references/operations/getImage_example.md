# GET : getImage Samples
- [Sample 1: Get Image Details](#sample-1-get-image-details)

---

## Sample 1: Get Image Details

This sample retrieves the details of an image, including the image url and expiration date.

### Input

The input is **image_id**. There is no payload with this request.

```http
GET https://apim.ebay.com/commerce/media/v1_beta/image/p***************a
```

### Output

If the call is successful, the details of the image will be retrieved.

```json
{
	"expirationDate": "2025-03-30T01:42:14Z",
	"imageUrl": "https://i.ebayimg.com/images/g/U**************2/s****0.jpg"
}
```

---
