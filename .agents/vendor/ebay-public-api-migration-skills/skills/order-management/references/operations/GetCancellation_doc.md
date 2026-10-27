# Get Cancellation

- API Type: REST
- Operation: GET `/post-order/v2/cancellation/{cancelId}`
- Base URL: `https://api.ebay.com`
- Sandbox: Not supported in the source
- Source: [Post-Order API - Get Cancellation](https://developer.ebay.com/Devzone/post-order/post-order_v2_cancellation-cancelid__get.html)

## Description

This method retrieves the details of a specific cancellation request.

The response depends on the `fieldgroups` query parameter:

- `SUMMARY` returns the same response shape used by cancellation search
- `FULL` returns richer details, including cancellation activity history and line-item detail

## When To Use

Use this method when you already know the cancellation ID and need the current state or full history of a cancellation request.

Typical partner-facing use cases:

- Check whether a cancellation is still open or already closed
- Inspect who initiated the cancellation and why
- Review refund and money-movement status for a paid order
- Retrieve activity history for support or workflow diagnostics

## Request

### Endpoint

```http
GET https://api.ebay.com/post-order/v2/cancellation/{cancelId}?fieldgroups=FULL
```

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `cancelId` | string | Yes | The unique identifier of the cancellation request to retrieve. |

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `fieldgroups` | string | No | Controls the amount of detail returned. Supported values come from `GetCancelFieldGroup`. Default is `FULL`. |

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

The response payload is `GetCancelDetailResponse`.

### Top-Level Shape

The response returns a `cancelDetail` container.

| Field | Type | Notes |
|-------|------|-------|
| `cancelDetail` | `CancelDetail` | Contains the details of the cancellation request. |

## Key Response Fields

The following fields are especially useful in partner-facing integrations:

| Field | Type | Description |
|-------|------|-------------|
| `cancelDetail.cancelId` | `string` | Unique eBay-assigned ID for the cancellation request. |
| `cancelDetail.cancelState` | `string` | Current state or condition of the cancellation process. |
| `cancelDetail.cancelStatus` | `string` | Last action taken on the cancellation request. |
| `cancelDetail.cancelReason` | `token` | Reason the cancellation was initiated. |
| `cancelDetail.cancelRequestDate` | `DateTime` | When the cancellation request was created. |
| `cancelDetail.cancelCloseDate` | `DateTime` | When the cancellation request was closed, if applicable. |
| `cancelDetail.cancelCloseReason` | `token` | Why the cancellation request was closed, if applicable. |
| `cancelDetail.legacyOrderId` | `string` | Order identifier associated with the cancellation. |
| `cancelDetail.marketplaceId` | `string` | Marketplace where the cancellation request was created. |
| `cancelDetail.requestorType` | `string` | Whether the buyer or seller initiated the cancellation request. |
| `cancelDetail.paymentStatus` | `string` | Whether the order was paid. |
| `cancelDetail.partialOrderType` | `string` | Currently expected to be `FULL_ORDER`, because line-item cancellations are not supported. |
| `cancelDetail.requestRefundAmount` | `Amount` | Refund amount requested for the cancellation. |
| `cancelDetail.shipmentDate` | `DateTime` | Shipment date, if relevant to the cancellation record. |
| `cancelDetail.buyerLoginName` | `string` | Buyer identifier returned by the source. |
| `cancelDetail.sellerLoginName` | `string` | Seller identifier returned by the source. |
| `cancelDetail.buyerResponseDueDate` | `DateTime` | Time by which the buyer must respond, if a buyer response is required. |
| `cancelDetail.sellerResponseDueDate` | `DateTime` | Time by which the seller must respond, if a seller response is required. |

## Key Response Containers

### `cancelDetail.activityHistories`

This array provides the activity history for the cancellation request.

| Field | Type | Description |
|-------|------|-------------|
| `actionDate` | `DateTime` | When the cancellation activity occurred. |
| `activityParty` | `string` | Party that performed the action, such as buyer or seller. |
| `activityType` | `string` | Type of cancellation event or action. |
| `stateFrom` | `string` | Cancellation state before the activity. |
| `stateTo` | `string` | Cancellation state after the activity. |

### `cancelDetail.moneyMovementInfo`

This array provides details on money movement transactions related to the cancellation.

| Field | Type | Description |
|-------|------|-------------|
| `moneyMovementType` | `string` | Type of transaction, such as seller refund or recoup. |
| `status` | `string` | Success or failure of the transaction. |
| `requestedAmount` | `Amount` | Expected amount of the transaction. |
| `actualAmount` | `Amount` | Actual amount of the transaction, returned when the transaction succeeds. |
| `creationDate` | `DateTime` | When the monetary transaction occurred. |

### `cancelDetail.refundInfo`

This container provides details about a refund issued, or scheduled to be issued, for the cancelled order.

Representative nested areas called out by the source:

- `actualRefundDetail`
- `actualRefundDetail.actualRefund`
- `actualRefundDetail.fundings`
- `actualRefundDetail.netChargeAmount`
- `actualRefundDetail.outstandingAmount`
- `actualRefundDetail.refundIssuedDate`
- `actualRefundDetail.refundStatus`

### `cancelDetail.payoutRecoupInfo`

This container shows payout recoup information for paid orders.

| Field | Type | Description |
|-------|------|-------------|
| `amountToRecoup` | `Amount` | Amount to be recouped from the seller. |
| `payoutId` | `integer` | Identifier of the associated seller payout. |

## Response Behavior

- `fieldgroups=SUMMARY` returns a slimmer response aligned with cancellation search.
- `fieldgroups=FULL` returns richer detail including activity history and order-line information.
- Refund, money movement, payout recoup, and due-date fields are conditional and appear only when relevant.
- The source notes that buyer username data may be replaced by immutable IDs for some U.S. users.

## Example

### Request

```http
GET https://api.ebay.com/post-order/v2/cancellation/5********5?fieldgroups=FULL
Authorization: Bearer <access-token>
```

### Response Excerpt

This excerpt is based on the public sample shown on the Get Cancellation reference page.

```json
{
  "cancelDetail": {
    "cancelId": "5********5",
    "cancelState": "CLOSED",
    "cancelStatus": "CANCEL_CLOSED_WITH_REFUND",
    "cancelReason": "BUYER_ASKED_CANCEL",
    "cancelRequestDate": {
      "value": "2020-08-11T22:32:10.000Z"
    },
    "cancelCloseDate": {
      "value": "2020-08-11T22:37:28.000Z"
    },
    "cancelCloseReason": "FULL_REFUNDED",
    "legacyOrderId": "0************9",
    "marketplaceId": "EBAY_US",
    "requestorType": "SELLER",
    "paymentStatus": "ONLINE_PAID",
    "partialOrderType": "FULL_ORDER",
    "buyerLoginName": "p**********3",
    "sellerLoginName": "c**********3",
    "requestRefundAmount": {
      "value": 34.67,
      "currency": "USD"
    },
    "activityHistories": [
      {
        "activityType": "SELLER_CREATE_CANCEL",
        "activityParty": "SELLER",
        "actionDate": {
          "value": "2020-08-11T22:32:10.000Z"
        },
        "stateFrom": "INITIAL",
        "stateTo": "REFUND_PENDING"
      }
    ],
    "moneyMovementInfo": [
      {
        "moneyMovementType": "SELLER_VOLUNTARY_REFUND",
        "status": "SUCCESS",
        "actualAmount": {
          "value": 34.67,
          "currency": "USD"
        }
      }
    ]
  }
}
```

### Example Notes

- Public sample IDs and usernames are masked by the source.
- The public sample shows a closed, refunded cancellation.
- Some conditional fields such as due dates or shipment date may be absent depending on the workflow state.

## Notes

- This is a Post-Order REST API operation.
- The method is not supported in the Sandbox environment.
- This page documents the traditional cancellation endpoint itself; migration mapping may point to newer GraphQL cancellation flows.

## Related Operations

- `GET /post-order/v2/cancellation/search` to locate cancellation requests
- `POST /post-order/v2/cancellation` to create a cancellation request
- `POST /post-order/v2/cancellation/{cancelId}/approve` to approve a buyer cancellation request
- `POST /post-order/v2/cancellation/{cancelId}/reject` to reject a buyer cancellation request
