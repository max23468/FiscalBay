# Get Return Files

- API Type: REST
- Operation: GET `/post-order/v2/return/{returnId}/files`
- Base URL: `https://api.ebay.com`
- Sandbox: Not supported in the source, though the public sample URL uses sandbox; treat the production endpoint as authoritative
- Source: [Post-Order API - Get Return Files](https://developer.ebay.com/Devzone/post-order/post-order_v2_return-returnid_files__get.html)

## Description

This method retrieves information about files associated with a return request.

## When To Use

Use this method when you need to inspect evidence or artifacts already attached to a return.

Typical partner-facing use cases:

- Retrieve buyer-uploaded item-condition photos
- Inspect seller-uploaded label or refund proof files
- Audit who submitted each file and when

## Request

### Endpoint

```http
GET https://api.ebay.com/post-order/v2/return/{returnId}/files
```

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `returnId` | string | Yes | The return request for which files are being retrieved. |

### HTTP Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | This call uses standard authorization tokens. |

### Authentication Notes

- All requests made to eBay REST operations require the authorization HTTP header for authentication.
- This call uses standard authorization tokens.

### Request Body

This call has no request payload.

## Response

### Response Type

The response payload is `GetFileResponse`.

### Key Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `files` | `array of ReturnFileType` | Files associated with the return request, if any exist. |

Each file can include:

| Field | Type | Description |
|-------|------|-------------|
| `fileId` | `string` | Unique file identifier. |
| `fileData` | `string` | Base64-encoded binary content of the file. |
| `resizedFileData` | `string` | Resized version of the file, when available. |
| `filePurpose` | `string` | Purpose of the file, such as item-, label-, or refund-related. |
| `fileStatus` | `string` | Current file lifecycle status. |
| `submitter` | `string` | Party that submitted the file. |
| `fileFormat` | `string` | File format such as JPEG. |
| `fileName` | `string` | Uploaded file name, when available. |
| `secureUrl` | `string` | URL where the uploaded file can be viewed. |
| `creationDate` | `DateTime` | When the file was attached. |

## Response Behavior

- If no files are associated with the return, the `files` container may be omitted.
- `fileData` is returned for attached files.

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
