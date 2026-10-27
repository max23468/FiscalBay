# POST : createImageFromUrl Samples
- [Sample 1: Create an image from a URL](#sample-1-create-an-image-from-a-url)

---

## Sample 1: Create an image from a URL

This sample uploads a picture to eBay Picture Services (EPS) from the specified URL.

### Input

The URL of the image (**imageUrl**) is required when calling this method.

```http
POST https://apim.ebay.com/commerce/media/v1_beta/image/create_image_from_url
{
	"imageUrl" : "https://www.*******.com/your-self-hosted-picture/*******.jpg"
}
```

### Output

If the call is successful, an HTTP status of **201 Created** will be returned alongside the following payload. If the call is successful, the image will be created and the image ID URI will be returned in the **Location** header.

```json
{
	"expirationDate": "2025-03-30T01:42:14Z",
	"imageUrl": "https://i.ebayimg.com/images/g/U**************2/s****.jpg"
}
```

---
