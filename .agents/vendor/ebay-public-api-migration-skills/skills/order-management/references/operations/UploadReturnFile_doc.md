# Upload Return File

- API Type: REST
- Operation: POST `/post-order/v2/return/{returnId}/file/upload`
- Base URL: `https://api.ebay.com`
- Sandbox: Not supported in the source
- Source: [Post-Order API - Upload Return File](https://developer.ebay.com/Devzone/post-order/post-order_v2_return-returnid_file_upload__post.html)

## Description

This method uploads a file associated with a return request.

Files may include shipping labels, images showing item condition, or refund-related proof.

In the current migration mapping, this traditional file-upload step maps to the Media API `uploadPostOrderDocument` method that is used before the Return API `attachReturnShipmentLabel` mutation.

## When To Use

Use this method when a buyer or seller needs to attach supporting artifacts to a return.

Typical partner-facing use cases:

- Buyer uploads photos of a damaged or misdescribed item
- Seller uploads a refund-related proof file
- Seller uploads a shipping-label file before making that label available through `Add Shipping Label Info`

## Request

### Endpoint

```http
POST https://api.ebay.com/post-order/v2/return/{returnId}/file/upload
```

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `returnId` | string | Yes | The return request to which the file is being attached. |

### HTTP Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | This call uses standard authorization tokens. |

### Authentication Notes

- All requests made to eBay REST operations require the authorization HTTP header for authentication.
- This call uses standard authorization tokens.

### Request Body

The request payload uses `UploadFileRequest`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `data` | `string` | Yes | Base64-encoded binary representation of the file. |
| `fileName` | `string` | Yes | File name for the uploaded file. |
| `filePurpose` | `string` | Yes | Purpose of the file, such as item-related, label-related, or refund-related. |

### File Handling Notes

- Image uploads support BMP, GIF, JPEG, and PNG.
- Shipping labels can be image files or PDF files.
- The source says the API supports single base64 encoding and currently also supports double base64 encoding for backward compatibility.

## Response

### Response Type

The response payload is `UploadFileResponse`.

### Key Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `fileId` | `string` | Unique identifier of the uploaded file. |
| `compressedFileData` | `string` | Compressed version of the uploaded file content. |

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
- The latest `api-mapping.csv` maps traditional `UploadReturnFile` to the modern Media API `uploadPostOrderDocument` operation.
- The bundled modern-side example is available under `sources/api-usage-examples/rest/Media API_uploadPostOrderDocument.md`.

## Related Operations

- `POST /post-order/v2/return/{returnId}/add_shipping_label` to publish a seller-provided label
- `GET /post-order/v2/return/{returnId}/files` to retrieve attached files
- `uploadPostOrderDocument` in the modern Media API to support `attachReturnShipmentLabel`
