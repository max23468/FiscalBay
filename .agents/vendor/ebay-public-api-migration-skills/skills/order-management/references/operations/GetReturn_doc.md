# Get Return

- API Type: REST
- Operation: GET `/post-order/v2/return/{returnId}`
- Base URL: `https://api.ebay.com`
- Sandbox: Not supported in the source
- Source: [Post-Order API - Get Return](https://developer.ebay.com/Devzone/post-order/post-order_v2_return-returnid__get.html)

## Description

This method retrieves information for a specific return request.

The `fieldgroups` query parameter controls whether the response returns summary-level information or full return detail.

## When To Use

Use this method when you already know the return ID and need either the current summary or the full detailed state of the return.

Typical partner-facing use cases:

- Inspect the current return state and status
- Review refund history and money movement
- Check item details, return reason, and buyer/seller context
- Determine relist eligibility or replacement-shipment information

## Request

### Endpoint

```http
GET https://api.ebay.com/post-order/v2/return/{returnId}?fieldgroups=FULL
```

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `returnId` | string | Yes | Unique return request identifier. |

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `fieldgroups` | string | No | Controls whether the response returns full detail or a summarized view. Default is `FULL`. |

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

The response payload is `GetDetailResponse`.

### Response Shape

Depending on `fieldgroups`, the response can include summary- and/or detail-oriented return structures.

### High-Value Summary Fields

| Field | Type | Description |
|-------|------|-------------|
| `summary.returnId` | `string` | Unique return identifier. |
| `summary.currentType` | `string` | Current desired outcome such as `MONEY_BACK`. |
| `summary.state` | `string` | Current return state. |
| `summary.buyerLoginName` | `string` | Buyer identifier returned by the source. |
| `summary.sellerLoginName` | `string` | Seller identifier returned by the source. |
| `summary.buyerTotalRefund` | `TotalRefundAmountType` | Refund amount context for the buyer. |
| `summary.creationInfo` | `ReturnCreationInfoType` | Return creation date, item identifiers, reason, and type. |

### High-Value Detail Fields

| Field | Type | Description |
|-------|------|-------------|
| `detail.buyerLoginName` | `string` | Buyer identifier. |
| `detail.sellerLoginName` | `string` | Seller identifier. |
| `detail.itemDetail` | `ItemDetailType` | Core item and transaction context. |
| `detail.marketplaceId` | `string` | Marketplace where the return was filed. |
| `detail.moneyMovementInfo` | `array` | Monetary transactions associated with the return. |
| `detail.refundInfo` | `RefundInfoType` | Actual or estimated refund detail. |
| `detail.replacementShipmentInfo` | `ShipmentType` | Replacement shipment tracking details, if relevant. |
| `detail.closeInfo` | `ReturnCloseInfoType` | Return close reason and close date, when closed. |
| `detail.files` | `array` | Files attached to the return, if present. |

## Key Response Containers

### `creationInfo`

This container provides the creation context for the return.

| Field | Type | Description |
|-------|------|-------------|
| `creationDate` | `DateTime` | When the return request was created. |
| `item.itemId` | `string` | Item identifier. |
| `item.transactionId` | `string` | Transaction identifier. |
| `item.returnQuantity` | `integer` | Quantity being returned. |
| `reason` | `string` | Buyer's stated return reason. |
| `reasonType` | `string` | Broad reason category such as `REMORSE` or `SNAD`. |
| `type` | `string` | Return outcome type, currently typically `MONEY_BACK`. |

### `moneyMovementInfo`

This array provides monetary transaction detail associated with the return.

| Field | Type | Description |
|-------|------|-------------|
| `actualAmount` | `Amount` | Actual transaction amount, when successful. |
| `moneyMovementType` | `string` | Type of transaction. |
| `paymentProvider` | `string` | Payment provider used. |
| `status` | `string` | Transaction status. |

### `refundInfo.actualRefundDetail`

This container provides the actual refund detail once a refund has been issued.

Representative nested areas:

- `actualRefund.itemizedRefundDetail`
- `actualRefund.totalAmount`
- `refundInitiationType`
- `refundIssuedDate`
- `refundStatus`

## Response Behavior

- `fieldgroups` defaults to `FULL` if omitted.
- `FULL` returns the richer detail-oriented return view.
- Summary- and detail-level information emphasize different parts of the workflow, so partners may need both depending on use case.

## Example

### Request

```http
GET https://api.ebay.com/post-order/v2/return/5********2?fieldgroups=FULL
Authorization: Bearer <access-token>
```

### Response Excerpt

This excerpt combines the most useful public sample fields from both the summary and detail examples shown on the reference page.

```json
{
  "summary": {
    "returnId": "5********2",
    "currentType": "MONEY_BACK",
    "state": "CLOSED",
    "buyerLoginName": "b********4",
    "sellerLoginName": "s*********5",
    "buyerTotalRefund": {
      "actualRefundAmount": {
        "value": 43.5,
        "currency": "USD"
      }
    },
    "creationInfo": {
      "creationDate": {
        "value": "2015-07-27T10:35:24.000Z"
      },
      "item": {
        "itemId": "1**********7",
        "transactionId": "8********9",
        "returnQuantity": 1
      },
      "reason": "ORDERED_ACCIDENTALLY",
      "type": "MONEY_BACK"
    }
  },
  "detail": {
    "buyerLoginName": "b********4",
    "sellerLoginName": "s*********5",
    "itemDetail": {
      "itemId": "1**********7",
      "transactionId": "8********9",
      "returnQuantity": 1
    },
    "marketplaceId": "EBAY_US",
    "moneyMovementInfo": [
      {
        "actualAmount": {
          "value": 43.5,
          "currency": "USD"
        },
        "moneyMovementType": "PAYPAL_REFUND",
        "paymentProvider": "PAYPAL",
        "status": "SUCCESS"
      }
    ],
    "refundInfo": {
      "actualRefundDetail": {
        "actualRefund": {
          "itemizedRefundDetail": [
            {
              "refundAmount": {
                "value": 40.0,
                "currency": "USD"
              },
              "refundFeeType": "PURCHASE_PRICE"
            },
            {
              "refundAmount": {
                "value": 3.5,
                "currency": "USD"
              },
              "refundFeeType": "ORIGINAL_SHIPPING"
            }
          ],
          "totalAmount": {
            "value": 43.5,
            "currency": "USD"
          }
        },
        "refundInitiationType": "SELLER_INITIATED",
        "refundIssuedDate": {
          "value": "2015-08-02T20:18:17.000Z"
        },
        "refundStatus": "SUCCESS"
      }
    }
  }
}
```

## Notes

- Public sample IDs and usernames are masked by the source.
- The public examples focus on a closed money-back return with refund history.
- Migration mapping may point to newer GraphQL return APIs, but this page documents the original traditional endpoint.

## Related Operations

- `GET /post-order/v2/return/search` to locate returns
- `POST /post-order/v2/return/{returnId}/issue_refund` to issue a refund
- `POST /post-order/v2/return/{returnId}/mark_as_received` to mark the item as received
- `POST /post-order/v2/return/{returnId}/send_message` to communicate with the buyer or seller
- `POST /post-order/v2/return/{returnId}/escalate` to escalate the return to a case
