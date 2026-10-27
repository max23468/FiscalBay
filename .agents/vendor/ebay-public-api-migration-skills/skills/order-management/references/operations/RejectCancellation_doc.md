# Reject Cancellation

- API Type: REST
- Operation: POST `/post-order/v2/cancellation/{cancelId}/reject`
- Base URL: `https://api.ebay.com`
- Sandbox: Not supported in the source
- Source: [Post-Order API - Reject Cancellation](https://developer.ebay.com/Devzone/post-order/post-order_v2_cancellation-cancelid_reject__post.html)

## Description

This method is used on behalf of a seller to reject a buyer's order cancellation request.

A common reason for rejection is that one or more items in the order have already been shipped.

## When To Use

Use this method when a buyer has requested cancellation but the seller cannot accept it.

Typical partner-facing use cases:

- The order has already shipped
- The seller wants to reject the cancellation and provide tracking context

## Request

### Endpoint

```http
POST https://api.ebay.com/post-order/v2/cancellation/{cancelId}/reject
```

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `cancelId` | string | Yes | The unique eBay-assigned identifier of the cancellation request to reject. |

### HTTP Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | This call uses standard authorization tokens. |

### Authentication Notes

- All requests made to eBay REST operations require the authorization HTTP header for authentication.
- This call uses standard authorization tokens.

### Request Body

The request payload uses `RejectCancelRequest`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `shipmentDate` | `DateTime` | No | Shipment timestamp. Recommended if the seller has shipped the order. |
| `trackingNumber` | `string` | No | Tracking number for the shipment. Recommended if available. |

Important request rule from the source:

- If you omit both `shipmentDate` and `trackingNumber`, you must still send an empty JSON object: `{}`

## Response

### Response Type

This call has no response payload.

### Success Behavior

- A successful request returns HTTP `200`
- No response body is returned

## Example

### Request

```http
POST https://api.ebay.com/post-order/v2/cancellation/5********8/reject
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "shipmentDate": {
    "value": "2015-08-22T23:29:11.000Z"
  },
  "trackingNumber": "4******************************0"
}
```

### Response

```http
HTTP/1.1 200 OK
```

### Example Notes

- Public sample IDs and tracking values are masked by the source.
- If shipment data is not available, the request body should still be `{}` rather than omitted.

## Notes

- This is a seller-side action in the traditional cancellation flow.
- The source recommends providing shipment information when the order has already shipped.

## Related Operations

- `GET /post-order/v2/cancellation/{cancelId}` to inspect the cancellation request
- `POST /post-order/v2/cancellation/{cancelId}/approve` to approve a buyer cancellation request
- `POST /post-order/v2/cancellation` to create the original cancellation request
