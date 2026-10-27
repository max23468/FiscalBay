# Search Returns

- API Type: REST
- Operation: GET `/post-order/v2/return/search`
- Base URL: `https://api.ebay.com`
- Sandbox: Not supported in the source
- Source: [Post-Order API - Search Returns](https://developer.ebay.com/Devzone/post-order/post-order_v2_return_search__get.html)

## Description

This method retrieves one or more return requests, or a summary of return requests per user.

It supports multiple filters. The source says Boolean AND logic is applied across filter types, while Boolean OR logic is used within a filter.

## When To Use

Use this method to locate and summarize returns before drilling into a specific return with `Get Return`.

Typical partner-facing use cases:

- Find returns in a specific operational state
- Filter returns by order, item, return ID, role, or date range
- Page through a seller's or buyer's return workload

## Request

### Endpoint

```http
GET https://api.ebay.com/post-order/v2/return/search
```

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `creation_date_range_from` | string | No | Start of creation date range in ISO 8601 format. |
| `creation_date_range_to` | string | No | End of creation date range in ISO 8601 format. |
| `item_id` | string | No | Item filter. Required if `transaction_id` is used. |
| `transaction_id` | string | No | Transaction filter. Ignored if `item_id` is not also supplied. |
| `order_id` | string | No | Filter by order ID. |
| `return_id` | string | No | Filter by a specific return request. If used, other query parameters are ignored. |
| `return_state` | string | No | Filter by return state classification. |
| `states` | string | No | Filter by specific return state in the workflow. |
| `role` | string | No | Filter by `BUYER` or `SELLER`. |
| `sort` | string | No | Sort by a supported field, prefixed by `+` or `-`. |
| `limit` | integer | No | Page size. Default `25`, max `200`. |
| `offset` | integer | No | Result offset. Default `0`. |

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

The response payload is `GetSummaryResponse`.

### Key Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `countSummary` | `array` | Counts of returns by return-state grouping. |
| `members` | `array of ReturnSummaryType` | Matching return summaries. |
| `paginationOutput` | `PaginationOutput` | Pagination metadata. |
| `total` | `integer` | Total number of matching returns. |

### Representative `members[]` Fields

| Field | Type | Description |
|-------|------|-------------|
| `returnId` | `string` | Return identifier. |
| `currentType` | `string` | Current desired resolution type. |
| `state` | `string` | Current workflow state. |
| `status` | `string` | Current status. |
| `buyerLoginName` | `string` | Buyer identifier returned by the source. |
| `sellerLoginName` | `string` | Seller identifier returned by the source. |
| `creationInfo` | `ReturnCreationInfoType` | Creation date, item identifiers, reason, and type. |
| `buyerTotalRefund` | `TotalRefundAmountType` | Estimated or actual refund information for the buyer. |
| `sellerAvailableOptions` | `array` | Next actions available to the seller. |
| `sellerResponseDue` | `ReturnResponseDueType` | Next seller action and deadline, when applicable. |

## Response Behavior

- Username fields may be replaced by immutable IDs for some U.S. users.
- `countSummary` helps build dashboards or grouped summary views.
- `members` can be empty if no returns match the filters.

## Example

### Request

```http
GET https://api.ebay.com/post-order/v2/return/search?return_state=RETURN_STARTED
Authorization: Bearer <access-token>
```

### Response Excerpt

```json
{
  "countSummary": [
    {
      "count": 3,
      "type": "RETURN_STARTED"
    }
  ],
  "members": [
    {
      "returnId": "5********2",
      "currentType": "MONEY_BACK",
      "state": "RETURN_REQUESTED",
      "status": "RETURN_REQUESTED",
      "creationInfo": {
        "creationDate": {
          "value": "2015-08-05T20:18:17.000Z"
        },
        "item": {
          "itemId": "1**********6",
          "transactionId": "8********9",
          "returnQuantity": 1
        },
        "reason": "ARRIVED_DAMAGED",
        "type": "MONEY_BACK"
      },
      "buyerLoginName": "b*******1",
      "sellerLoginName": "s********4",
      "buyerTotalRefund": {
        "estimatedRefundAmount": {
          "value": 27.5,
          "currency": "USD"
        }
      },
      "sellerAvailableOptions": [
        {
          "actionType": "SELLER_APPROVE_REQUEST"
        },
        {
          "actionType": "SELLER_DECLINE_REQUEST"
        },
        {
          "actionType": "SELLER_SEND_MESSAGE"
        }
      ],
      "sellerResponseDue": {
        "activityDue": "SELLER_APPROVE_REQUEST",
        "respondByDate": {
          "value": "2015-08-09T20:18:17.000Z"
        }
      }
    }
  ],
  "paginationOutput": {
    "limit": 100,
    "offset": 1,
    "totalEntries": 3,
    "totalPages": 1
  }
}
```

## Notes

- Public sample IDs and usernames are masked by the source.
- If `return_id` is supplied, other query parameters are ignored.

## Related Operations

- `GET /post-order/v2/return/{returnId}` to inspect a specific return
