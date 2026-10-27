# Provide Inquiry Refund Info

- API Type: REST
- Operation: POST `/post-order/v2/inquiry/{inquiryId}/provide_refund_info`
- Base URL: `https://api.ebay.com`
- Status: Deprecated, scheduled for decommission on `2026-03-16` according to the public source
- Sandbox: Not supported in the source
- Source: [Post-Order API - Provide Inquiry Refund Info](https://developer.ebay.com/Devzone/post-order/post-order_v2_inquiry-inquiryid_provide_refund_info__post.html)

## Description

This method allows the seller to provide additional information to the buyer about a refund for an inquiry.

The source notes that this was required in certain countries and is now deprecated.

## When To Use

Use this method only for traditional integrations that still depend on it, and verify whether the decommission date affects your production plan.

## Request

### Endpoint

```http
POST https://api.ebay.com/post-order/v2/inquiry/{inquiryId}/provide_refund_info
```

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `inquiryId` | string | Yes | The inquiry for which refund information is being provided. |

### HTTP Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | This call uses standard authorization tokens. |

### Authentication Notes

- All requests made to eBay REST operations require the authorization HTTP header for authentication.
- This call uses standard authorization tokens.

### Request Body

The request payload uses `SellerProvideRefundInfoRequest`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | `Text` | Yes | Message providing information about the buyer's refund. |

## Response

### Response Type

This call has no response payload.

### Success Behavior

- A successful request returns HTTP `200`
- No response body is returned

## Example

### Request

```http
POST https://api.ebay.com/post-order/v2/inquiry/5********9/provide_refund_info
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "message": {
    "content": "This refund applies to the order line items for which you filed inquiry #5********9."
  }
}
```

### Response

```http
HTTP/1.1 200 OK
```

## Notes

- This operation is deprecated and scheduled for decommission on `2026-03-16` per the public source.
- The migration mapping notes there is no direct equivalent, but suggests newer inquiry messaging flows as an alternative.

## Related Operations

- `POST /post-order/v2/inquiry/{inquiryId}/issue_refund` to issue the refund
- `POST /post-order/v2/inquiry/{inquiryId}/send_message` as a newer communication-style alternative
