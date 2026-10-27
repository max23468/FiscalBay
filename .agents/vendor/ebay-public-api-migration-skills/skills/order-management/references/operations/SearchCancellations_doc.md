# Search Cancellations

- API Type: REST
- Operation: GET `/post-order/v2/cancellation/search`
- Base URL: `https://api.ebay.com`
- Sandbox: Not supported in the source
- Source: [Post-Order API - Search Cancellations](https://developer.ebay.com/devzone/post-order/post-order_v2_cancellation_search__get.html)

## Description

This method searches for and retrieves one or more order cancellation requests.

The search supports direct lookup by cancellation ID as well as filter-based lookup by creation date, item, order, requestor role, and pagination controls.

## When To Use

Use this method when you need a list of cancellation requests or need to locate a specific cancellation without already knowing its full detail resource.

Typical partner-facing use cases:

- Find cancellation requests created during a given time period
- Retrieve cancellations for a known order or listing
- Filter cancellations by buyer-initiated or seller-initiated role
- Page through a large result set of cancellation requests

## Request

### Endpoint

```http
GET https://api.ebay.com/post-order/v2/cancellation/search?cancel_id=string&creation_date_range_from=string&creation_date_range_to=string&item_id=string&legacy_order_id=string&limit=string&offset=string&role=UserRoleFilterEnum&sort=CancelSortField&transaction_id=string
```

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `cancel_id` | string | No | Specific cancellation request identifier. If supplied, other filters are ignored. |
| `creation_date_range_from` | string | No | Start of the cancellation creation time range, in ISO 8601 format. |
| `creation_date_range_to` | string | No | End of the cancellation creation time range, in ISO 8601 format. |
| `item_id` | string | No | Listing ID associated with the cancellation. Required with `transaction_id` for line-item lookup. |
| `legacy_order_id` | string | No | Order ID associated with the cancellation. |
| `limit` | string | No | Number of results per page. Default `10`, minimum `1`, maximum `500`. |
| `offset` | string | No | Number of entries to skip before returning the current page. Default `0`. |
| `role` | string | No | Filter by who initiated the cancellation, such as `BUYER` or `SELLER`. |
| `sort` | string | No | Sort by `CANCEL_ID` or `CANCEL_REQUEST_DATE`, prefixed with `+` or `-` for ascending or descending order. |
| `transaction_id` | string | No | Transaction ID of the line item. Must be used with `item_id`. |

### HTTP Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | This call uses standard authorization tokens. |

### Authentication Notes

- All requests made to eBay REST operations require the `Authorization` HTTP header.
- This call uses standard authorization tokens.

### Request Body

This call has no request payload.

## Response

### Response Type

The response payload is `FindCancelResponse`.

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `cancellations` | `array of CancelSummary` | Cancellation requests matching the supplied filters. |
| `cancellations.cancelId` | `string` | Unique eBay-assigned cancellation ID. |
| `cancellations.cancelReason` | `string` | Reason the cancellation was initiated. |
| `cancellations.cancelState` | `string` | Current lifecycle state of the cancellation. |
| `cancellations.cancelStatus` | `string` | Most recent action status for the cancellation. |
| `cancellations.cancelRequestDate` | `DateTime` | Timestamp when the cancellation request was created. |
| `cancellations.cancelCloseDate` | `DateTime` | Timestamp when the cancellation closed, if it is closed. |
| `cancellations.cancelCloseReason` | `string` | Reason the cancellation request was closed. |
| `cancellations.buyerLoginName` | `string` | Buyer identifier associated with the cancellation. |
| `cancellations.sellerLoginName` | `string` | Seller identifier associated with the cancellation. |
| `cancellations.legacyOrderId` | `string` | Order ID associated with the cancellation. |
| `cancellations.requestorType` | `string` | Indicates whether the request was initiated by the buyer or seller. |
| `cancellations.requestRefundAmount` | `Amount` | Refund amount requested for the cancellation. |
| `cancellations.paymentStatus` | `string` | Payment status of the order being cancelled. |
| `cancellations.shipmentDate` | `DateTime` | Shipment timestamp when shipping affects cancellation eligibility. |
| `paginationOutput` | `PaginationOutput` | Paging metadata for the current response page. |
| `total` | `integer` | Total number of cancellation requests matching the filters. |

## Response Behavior

- The result set is paginated.
- `cancellations` is returned as an empty array if no requests match the filters.
- Closure dates and closure reasons only appear for closed cancellations.

## Example

### Request

```http
GET https://api.ebay.com/post-order/v2/cancellation/search?creation_date_range_from=2015-05-15T00:00:01.000Z&creation_date_range_to=2015-06-15T23:59:59.000Z&sort=+CANCEL_REQUEST_DATE
Authorization: Bearer <access-token>
```

### Response Excerpt

```json
{
  "cancellations": [
    {
      "cancelId": "5********2",
      "marketplaceId": "EBAY_US",
      "legacyOrderId": "1**********1-9********7",
      "requestorType": "SELLER",
      "cancelReason": "OUT_OF_STOCK_OR_CANNOT_FULFILL",
      "cancelState": "CLOSED",
      "cancelStatus": "CANCEL_CLOSED_WITH_REFUND",
      "cancelCloseReason": "FULL_REFUNDED",
      "requestRefundAmount": {
        "value": 0,
        "currency": "USD"
      },
      "cancelRequestDate": {
        "value": "2015-05-18T22:42:11.000Z"
      },
      "cancelCloseDate": {
        "value": "2015-05-18T22:42:11.000Z"
      }
    }
  ],
  "total": 6,
  "paginationOutput": {
    "offset": 1,
    "limit": 6,
    "totalPages": 1,
    "totalEntries": 6
  }
}
```

