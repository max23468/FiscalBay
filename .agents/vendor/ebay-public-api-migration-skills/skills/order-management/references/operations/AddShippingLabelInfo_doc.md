# Add Shipping Label Info

- API Type: REST
- Operation: POST `/post-order/v2/return/{returnId}/add_shipping_label`
- Base URL: `https://api.ebay.com`
- Sandbox: Not supported in the source, though the public sample URL uses sandbox; treat the production endpoint as authoritative
- Source: [Post-Order API - Add Shipping Label Info](https://developer.ebay.com/Devzone/post-order/post-order_v2_return-returnid_add_shipping_label__post.html)

## Description

The primary function of this seller-facing method is to create a return shipping label for the buyer.

It can also be used to provide additional information about an existing seller-provided or eBay-provided label.

## When To Use

Use this method when the seller needs to make a return shipping label available to the buyer, or explicitly communicate shipping-label availability or non-availability.

Typical partner-facing use cases:

- Upload and publish a seller-provided return label
- Indicate that a label has already been sent
- Explain why no label will be provided

## Request

### Endpoint

```http
POST https://api.ebay.com/post-order/v2/return/{returnId}/add_shipping_label
```

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `returnId` | string | Yes | The return request for which a shipping label is being created or referenced. |

### HTTP Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | This call uses standard authorization tokens. |

### Authentication Notes

- All requests made to eBay REST operations require the authorization HTTP header for authentication.
- This call uses standard authorization tokens.

### Request Body

The request payload uses `ProvideLabelRequest`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `labelAction` | `string` | Yes | Action being taken for the label workflow. |
| `carrierEnum` | `string` | Conditional | Carrier enumeration value. Needed in label-creation or tracking-oriented scenarios. |
| `carrierName` | `string` | Conditional | Carrier name, used when carrier enum is not sufficient. |
| `fileId` | `string` | Conditional | File identifier for an uploaded shipping-label file. |
| `labelId` | `string` | Conditional | Shipping-label identifier used in some label publication flows, including the public sample. |
| `trackingNumber` | `string` | Conditional | Tracking number on the label. |
| `forwardShippingLabelProvided` | `boolean` | No | Indicates the seller already provided the buyer with a shipping label. |
| `labelSentDate` | `DateTime` | Conditional | When the shipping label was sent. |
| `noLabelReason` | `string` | Conditional | Reason no label is being provided. Required when `labelAction=NO_LABEL`. |
| `returnLabelCost` | `Amount` | No | Cost of the return shipping label. |
| `comments` | `Text` | No | Additional message about the shipping label. |

### Workflow Note

If the seller is using a seller-generated shipping label, the source says the label file can first be uploaded with `POST /post-order/v2/return/{returnId}/file/upload`, and the returned `fileId` can then be used here.

## Response

### Response Type

The response payload is `ProvideLabelResponse`.

### Key Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `labelData` | `string` | Label text or encoded label content returned by the service. |
| `labelId` | `string` | Unique identifier of the shipping label. |
| `labelURL` | `string` | URL where the shipping label can be downloaded or printed. |
| `trackingNumber` | `string` | Tracking number associated with the label. |

## Example

### Request

```http
POST https://api.ebay.com/post-order/v2/return/5********9/add_shipping_label
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "carrierEnum": "USPS",
  "comments": {
    "content": "The shipping label you can use has been added to your return request."
  },
  "labelId": "8******1",
  "trackingNumber": "9*******************9",
  "labelAction": "UPLOAD_LABEL"
}
```

### Response Excerpt

```json
{
  "labelData": "B** B****, 2****************e, *******, CA 9***5, United States",
  "labelId": "8******1",
  "labelURL": "https://return.ebay.com/ws/eBayISAPI.dll?ResolveReturn&eventName=returnLabel&returnId=5********8",
  "trackingNumber": "9*******************9"
}
```

## Notes

- Public sample values are masked by the source.
- The public sample text references `labelId` as required for the upload-label flow, while the field list above also makes it clear that requirements vary by `labelAction`.

## Related Operations

- `POST /post-order/v2/return/{returnId}/file/upload` to upload a seller-provided shipping label file
- `GET /post-order/v2/return/{returnId}` to inspect current replacement or shipping-label state
