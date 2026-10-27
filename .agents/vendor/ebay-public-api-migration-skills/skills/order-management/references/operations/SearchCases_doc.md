# Search Cases

- API Type: REST
- Operation: GET `/post-order/v2/casemanagement/search`
- Base URL: `https://api.ebay.com`
- Sandbox: Not supported in the source
- Source: [Post-Order API - Search Cases](https://developer.ebay.com/devzone/post-order/post-order_v2_casemanagement_search__get.html)

## Description

This method searches for return requests and Item Not Received inquiries that have been escalated into eBay cases by the buyer.

The search supports filters such as case status, creation-date range, item ID, order ID, return ID, and pagination controls.

## When To Use

Use this method when you need a list of Post-Order cases instead of the details for one known case.

Typical partner-facing use cases:

- Find open cases that still need seller attention
- Search cases within a specific date range
- Look up cases tied to a known order, listing, or return
- Page through a large case result set

## Request

### Endpoint

```http
GET https://api.ebay.com/post-order/v2/casemanagement/search?case_creation_date_range_from=string&case_creation_date_range_to=string&case_status_filter=CaseStatusFilter&fieldgroups=CaseSearchFieldGroupEnum&item_id=string&limit=integer&offset=integer&order_id=string&return_id=string&sort=string&transaction_id=string
```

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `case_creation_date_range_from` | string | No | Start of the case creation time range, in ISO 8601 format. |
| `case_creation_date_range_to` | string | No | End of the case creation time range, in ISO 8601 format. |
| `case_status_filter` | string | No | Filter cases by a specific case status. |
| `fieldgroups` | string | No | Currently only `DEFAULT` is supported. |
| `item_id` | string | No | Listing ID associated with the case. Required with `transaction_id` when identifying a line item. |
| `limit` | integer | No | Number of cases per page. Default `25`, minimum `1`, maximum `200`. |
| `offset` | integer | No | Zero-based result offset for pagination. Default `0`. |
| `order_id` | string | No | Order ID associated with the case. |
| `return_id` | string | No | Return request ID associated with the case. |
| `sort` | string | No | Sort order for results. `Descending` is the default. |
| `transaction_id` | string | No | Transaction ID for the line item. Must be used with `item_id`. |

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

The response payload is `CaseSearchResponse`.

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `members` | `array of CaseSummaryType` | Cases matching the search criteria. |
| `members.buyer` | `string` | Buyer identifier associated with the case. |
| `members.caseId` | `integer` | Unique identifier of the case. |
| `members.caseStatusEnum` | `string` | Current status of the case. |
| `members.claimAmount` | `Amount` | Monetary amount associated with the case. |
| `members.creationDate` | `DateTime` | Timestamp when the case was created. |
| `members.itemId` | `integer` | Listing ID for the item involved in the case. |
| `members.lastModifiedDate` | `DateTime` | Timestamp of the latest case update. |
| `members.respondByDate` | `DateTime` | Deadline for the next required action, when one exists. |
| `members.seller` | `string` | Seller identifier associated with the case. |
| `members.transactionId` | `integer` | Transaction ID for the line item involved in the case. |
| `paginationOutput` | `PaginationOutput` | Paging metadata for the current result page. |
| `paginationOutput.limit` | `integer` | Number of entries returned per page. |
| `paginationOutput.offset` | `integer` | Offset applied to the result set. |
| `paginationOutput.totalEntries` | `integer` | Total number of matching cases. |
| `paginationOutput.totalPages` | `integer` | Total number of result pages. |
| `totalNumberOfCases` | `integer` | Total number of cases matching the input filters. |

## Response Behavior

- The result set is paginated.
- `members` may be empty when no cases match the supplied filters.
- `respondByDate` is only returned when the case currently requires a timed response.

## Example

### Request

```http
GET https://api.ebay.com/post-order/v2/casemanagement/search?case_status_filter=OPEN
Authorization: Bearer <access-token>
```

### Response Excerpt

```json
{
  "members": [
    {
      "buyer": "s*************4",
      "caseId": "5********3",
      "caseStatusEnum": "OPEN",
      "claimAmount": {
        "currency": "USD",
        "value": "81.0"
      },
      "creationDate": {
        "value": "2015-08-29T20:18:17.000Z"
      },
      "itemId": "2**********1",
      "lastModifiedDate": {
        "value": "2015-08-29T20:18:17.000Z"
      },
      "respondByDate": {
        "value": "2015-09-01T20:18:17.000Z"
      },
      "seller": "f***********6",
      "transactionId": "8********1"
    }
  ],
  "paginationOutput": {
    "limit": 25,
    "offset": 0,
    "totalEntries": 1,
    "totalPages": 1
  },
  "totalNumberOfCases": 1
}
```

