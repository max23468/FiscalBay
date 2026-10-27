# Provide Inquiry Shipment Info

- API Type: REST
- Operation: POST `/post-order/v2/inquiry/{inquiryId}/provide_shipment_info`
- Base URL: `https://api.ebay.com`
- Sandbox: Not supported in the source
- Source: [Post-Order API - Provide Inquiry Shipment Info](https://developer.ebay.com/Devzone/post-order/post-order_v2_inquiry-inquiryid_provide_shipment_info__post.html)

## Description

This method provides shipment tracking and related shipping information for an order line item associated with an INR inquiry.

## When To Use

Use this method when the seller has shipped the item and wants to provide shipment evidence or tracking details to the buyer.

## Request

### Endpoint

```http
POST https://api.ebay.com/post-order/v2/inquiry/{inquiryId}/provide_shipment_info
```

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `inquiryId` | string | Yes | The unique identifier of the inquiry for which shipment information is being provided. |

### HTTP Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | This call uses standard authorization tokens. |

### Authentication Notes

- All requests made to eBay REST operations require the authorization HTTP header for authentication.
- This call uses standard authorization tokens.

### Request Body

The request payload uses `ShipmentInfoRequest`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `proofOfShipmentUploaded` | `boolean` | Conditional | Set to `true` if shipment tracking is already available in eBay systems. |
| `sellerComments` | `Text` | No | Optional seller note about shipment tracking. |
| `shippedWithTracking` | `boolean` | No | Indicates whether the shipment used tracking. |
| `shippingCarrierName` | `string` | Conditional | Carrier name. Required unless `proofOfShipmentUploaded=true`. |
| `shippingDate` | `DateTime` | Conditional | Shipment date. Required unless `proofOfShipmentUploaded=true`. |
| `trackingNumber` | `string` | Conditional | Tracking number. Required unless `proofOfShipmentUploaded=true`. |

## Response

### Response Type

This call has no response payload.

### Success Behavior

- A successful request returns HTTP `200`
- No response body is returned

## Example

### Request

```http
POST https://api.ebay.com/post-order/v2/inquiry/5********8/provide_shipment_info
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "shippingCarrierName": "FedEx",
  "shippingDate": {
    "value": "2015-09-05T20:18:17.000Z"
  },
  "shippedWithTracking": true,
  "trackingNumber": "1*********7",
  "proofOfShipmentUploaded": false,
  "sellerComments": {
    "content": "I have shipped this item. Here are the shipment tracking details."
  }
}
```

### Response

```http
HTTP/1.1 200 OK
```

### Example Notes

- Public sample IDs and tracking values are masked by the source.
- If `proofOfShipmentUploaded=true`, the source says the other tracking fields are no longer necessary.

## Notes

- This is a seller-side evidence submission operation in the traditional inquiry flow.

## Related Operations

- `GET /post-order/v2/inquiry/{inquiryId}` to inspect the inquiry
- `POST /post-order/v2/inquiry/{inquiryId}/send_message` to communicate with the buyer
- `POST /post-order/v2/inquiry/{inquiryId}/escalate` to escalate the inquiry
