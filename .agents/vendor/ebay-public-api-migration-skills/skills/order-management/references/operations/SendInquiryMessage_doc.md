# Send Inquiry Message

- API Type: REST
- Operation: POST `/post-order/v2/inquiry/{inquiryId}/send_message`
- Base URL: `https://api.ebay.com`
- Sandbox: Not supported in the source
- Source: [Post-Order API - Send Inquiry Message](https://developer.ebay.com/Devzone/post-order/post-order_v2_inquiry-inquiryid_send_message__post.html)

## Description

This method allows a buyer or seller to send a message to the order partner regarding an INR inquiry.

## When To Use

Use this method when one party wants to communicate with the other inside the inquiry workflow.

## Request

### Endpoint

```http
POST https://api.ebay.com/post-order/v2/inquiry/{inquiryId}/send_message
```

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `inquiryId` | string | Yes | The inquiry being discussed. |

### HTTP Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | This call uses standard authorization tokens. |

### Authentication Notes

- All requests made to eBay REST operations require the authorization HTTP header for authentication.
- This call uses standard authorization tokens.

### Request Body

The request payload uses `SendMessageRequest`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | `Text` | Yes | The message sent to the order partner. |

## Response

### Response Type

This call has no response payload.

### Success Behavior

- A successful request returns HTTP `200`
- No response body is returned

## Example

### Request

```http
POST https://api.ebay.com/post-order/v2/inquiry/5********9/send_message
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "message": {
    "content": "I still want this item, and if you will send it to me, I will close the INR inquiry once the item is received."
  }
}
```

### Response

```http
HTTP/1.1 200 OK
```

## Notes

- This operation can be used by either buyer or seller.

## Related Operations

- `GET /post-order/v2/inquiry/{inquiryId}` to inspect the inquiry
- `POST /post-order/v2/inquiry/{inquiryId}/provide_shipment_info` to provide tracking details
