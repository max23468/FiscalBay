# Search Inquiries

- API Type: REST
- Operation: GET `/post-order/v2/inquiry/search`
- Base URL: `https://api.ebay.com`
- Sandbox: Not supported in the source
- Source: [Post-Order API - Search Inquiries](https://developer.ebay.com/Devzone/post-order/post-order_v2_inquiry_search__get.html)

## Description

This method searches for INR inquiries using multiple filters.

The source explicitly notes that inquiries escalated to cases are excluded from search results.

## When To Use

Use this method to locate inquiries before calling `Get Inquiry` or taking a follow-up action.

Typical partner-facing use cases:

- Find inquiries waiting for seller response
- Search inquiries for an order, item, or date range
- Page through a seller's current inquiry backlog

## Request

### Endpoint

```http
GET https://api.ebay.com/post-order/v2/inquiry/search
```

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `fieldgroups` | string | No | Currently only `DEFAULT` is supported; the source says response scope is effectively unchanged for now. |
| `inquiry_creation_date_range_from` | string | No | Start of creation-date range in ISO 8601 format. Cannot be more than 18 months in the past. |
| `inquiry_creation_date_range_to` | string | No | End of creation-date range in ISO 8601 format. |
| `inquiry_status` | string | No | Filter by inquiry status. |
| `item_id` | string | No | Item ID filter. Required if `transaction_id` is used. |
| `transaction_id` | string | No | Transaction ID filter. Ignored if `item_id` is not also supplied. |
| `order_id` | string | No | Filter by order ID. |
| `limit` | integer | No | Page size. Default `25`, max `200`. |
| `offset` | integer | No | Result offset. Default `0`. |
| `sort` | string | No | `Descending` or `Ascending`. Default is `Descending`. |

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

The response payload is `InquirySearchResponse`.

### Key Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `members` | `array of InquirySummaryType` | Matching inquiry summaries. |
| `paginationOutput` | `PaginationOutput` | Pagination metadata for the current page. |
| `totalNumberOfInquiries` | `integer` | Total number of matching inquiries. |

### `members[]`

| Field | Type | Description |
|-------|------|-------------|
| `buyer` | `string` | Buyer identifier returned by the source. |
| `seller` | `string` | Seller identifier returned by the source. |
| `claimAmount` | `Amount` | Amount associated with the inquiry. |
| `creationDate` | `DateTime` | When the inquiry was created. |
| `inquiryId` | `integer` | Unique inquiry identifier. |
| `inquiryStatusEnum` | `string` | Current inquiry status. |
| `itemId` | `integer` | Item identifier for the line item. |
| `lastModifiedDate` | `DateTime` | When the inquiry was last modified. |
| `respondByDate` | `DateTime` | Response deadline, if one exists. |
| `transactionId` | `integer` | Transaction identifier for the line item. |

## Response Behavior

- Escalated inquiries are excluded from search results.
- `respondByDate` is especially important when the inquiry is waiting on seller or buyer response.
- Buyer and seller username fields may be replaced by immutable IDs for some U.S. users.

## Example

### Request

```http
GET https://api.ebay.com/post-order/v2/inquiry/search?inquiry_status=WAITING_SELLER_RESPONSE
Authorization: Bearer <access-token>
```

### Response Excerpt

```json
{
  "members": [
    {
      "buyer": "a********r",
      "claimAmount": {
        "currency": "USD",
        "value": "34.5"
      },
      "creationDate": {
        "value": "2015-09-04T20:18:17.000Z"
      },
      "inquiryId": "5********0",
      "inquiryStatusEnum": "WAITING_SELLER_RESPONSE",
      "itemId": "2**********1",
      "lastModifiedDate": {
        "value": "2015-09-04T20:18:17.000Z"
      },
      "respondByDate": {
        "value": "2015-09-07T20:18:17.000Z"
      },
      "seller": "t**********r",
      "transactionId": "8********0"
    }
  ],
  "paginationOutput": {
    "limit": 25,
    "offset": 0,
    "totalEntries": 1,
    "totalPages": 1
  },
  "totalNumberOfInquiries": 1
}
```

### Example Notes

- Public sample IDs and usernames are masked by the source.
- This example searches for inquiries waiting on seller response.

## Notes

- Use `Get Inquiry` to retrieve full detail once you have the `inquiryId`.

## Related Operations

- `GET /post-order/v2/inquiry/{inquiryId}` to retrieve full inquiry detail
- `POST /post-order/v2/inquiry/{inquiryId}/send_message` to communicate on an inquiry
