# POST : createImageFromFile Samples
- [Sample 1: Create an image from a file](#sample-1-create-an-image-from-a-file)

---

## Sample 1: Create an image from a file

This call uploads the file using a **Content-Type** header with its value set to "**multipart/form-data**". As shown in the **Request Body** below, the form data is sent as key-value pairs but not as a JSON request payload.

### Input

Although there is no JSON request payload, information about the form data is sent as key-value pairs. See Create an image from a file for more information.

```http
POST https://apim.ebay.com/commerce/media/v1_beta/image/create_image_from_file

Request Body
image: @"/path/to/example-image.jpg"
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
