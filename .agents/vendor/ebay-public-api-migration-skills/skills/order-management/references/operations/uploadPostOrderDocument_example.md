# POST : uploadPostOrderDocument Samples
- [Sample 1: Upload a document](#sample-1-upload-a-document)

---

## Sample 1: Upload a document

This sample uploads a document file using a created document ID.

### Input

The input is the **document ID** `1*******-**********d5` as a URI parameter. Although there is no JSON request payload, information about the form data is sent as key-value pairs. Only **file** is required. See Upload the document file for more information.

```http
POST https://api.ebay.com/commerce/media/v1_beta/document/1*******-**********d5/upload
Request Body
file: @"/path/to/example-document.pdf"
```

### Output

A successful call will show an HTTP status of 200 and the following payload. The response payload includes the document ID, type, status, and document metadata. If the call is successful, the document will be uploaded.

```json
{
  "documentId": "1*******-**********d5",
  "documentType": "USER_GUIDE_OR_MANUAL",
  "languages": [
	"FRENCH",
	"ENGLISH"
  ],
  "documentStatus": "SUBMITTED",
  "documentMetadata": {
	"fileName": "drone_user_warranty.pdf",
	"fileType": "application/pdf",
	"fileSize": "7805593"
  }
}
```

---
