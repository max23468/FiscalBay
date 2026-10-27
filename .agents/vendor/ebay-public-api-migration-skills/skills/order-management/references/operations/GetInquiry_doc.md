# Get Inquiry

- API Type: REST
- Operation: GET `/post-order/v2/inquiry/{inquiryId}`
- Base URL: `https://api.ebay.com`
- Sandbox: Not supported in the source
- Source: [Post-Order API - Get Inquiry](https://developer.ebay.com/Devzone/post-order/post-order_v2_inquiry-inquiryid__get.html)

## Description

This method retrieves details about a specific Item Not Received (INR) inquiry and a summary of activity to date.

The returned history can include actions by the buyer, seller, the inquiry service, or customer support.

## When To Use

Use this method when you already know the inquiry ID and need the full current state and history of the inquiry.

Typical partner-facing use cases:

- Inspect inquiry status and lifecycle dates
- Review buyer-expected refund or resolution context
- Check whether refund activity has already occurred
- Review shipment-tracking and inquiry-history context

## Request

### Endpoint

```http
GET https://api.ebay.com/post-order/v2/inquiry/{inquiryId}
```

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `inquiryId` | string | Yes | The unique identifier of the inquiry to retrieve. |

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

The response payload is `InquiryDetailsResponse`.

### Key Top-Level Fields

| Field | Type | Description |
|-------|------|-------------|
| `inquiryId` | `string` | Unique identifier of the inquiry. |
| `status` | `string` | Current inquiry status. |
| `state` | `string` | Current inquiry state. |
| `creationReason` | `string` | Why the buyer created the inquiry. |
| `initiator` | `string` | The party that created the inquiry. |
| `claimAmount` | `Amount` | Value of the line item associated with the inquiry. |
| `inquiryClosureDate` | `DateTime` | Returned if the inquiry has been closed. |
| `inquiryQuantity` | `integer` | Quantity associated with the inquiry. |
| `itemId` | `string` | Listing identifier associated with the inquiry. |
| `transactionId` | `string` | Transaction identifier associated with the inquiry. |
| `sellerMakeItRightByDate` | `DateTime` | Seller deadline to resolve the inquiry, when applicable. |
| `shippingCost` | `Amount` | Shipping amount associated with the transaction, if applicable. |
| `extTransactionId` | `string` | External transaction ID when payment occurred outside eBay systems. |
| `inquiryContentOnHold` | `boolean` | Indicates whether inquiry-related content is hidden. |

## Key Response Containers

### `inquiryDetails`

This container provides the detailed inquiry-level business context.

| Field | Type | Description |
|-------|------|-------------|
| `creationDate` | `DateTime` | When the inquiry was created. |
| `expirationDate` | `DateTime` | When the inquiry will naturally expire if no action is taken. |
| `escalationDate` | `DateTime` | Returned if the inquiry was escalated to a case. |
| `lastBuyerRespDate` | `DateTime` | When the buyer last responded or acted. |
| `refundDeadlineDate` | `DateTime` | Deadline for refund-related action, if applicable. |
| `totalAmount` | `Amount` | Total amount associated with the inquiry. |
| `refundChargeAmount` | `Amount` | Refund charge amount, if applicable. |
| `refundAmounts` | `RefundAmounts` | Expected and actual refund amounts associated with the inquiry. |
| `appealDetails` | `AppealDetails` | Appeal information if the inquiry was escalated to a case and later appealed. |

### `refundAmounts`

Representative nested refund fields called out by the source:

- `buyerFinalAcceptRefundAmt`
- `buyerInitExpectRefundAmt`
- `donationAmount`
- `feeCreditAmount`
- `internationalRefundAmount`
- `refundAmount`

### `inquiryHistoryDetails`

This container provides inquiry activity history and shipment-tracking context.

| Field | Type | Description |
|-------|------|-------------|
| `history` | `array of ClaimHistoryEventModel` | Events or actions associated with the inquiry. |
| `shipmentTrackingDetails` | `ShipmentTrackingDetailType` | Shipment-tracking information when relevant. |

Each history entry can include:

| Field | Type | Description |
|-------|------|-------------|
| `action` | `string` | Action that occurred on the inquiry. |
| `actor` | `string` | Party or system that performed the action. |
| `date` | `DateTime` | When the action occurred. |
| `description` | `string` | Text description, if available. |
| `moneyMovement` | `MoneyMovementEntries` | Monetary movement detail when relevant. |

### `itemDetails`

This container provides listing and purchased-item context.

| Field | Type | Description |
|-------|------|-------------|
| `itemTitle` | `string` | Title of the purchased item. |
| `itemPrice` | `Amount` | Price of the purchased item. |
| `itemPictureUrl` | `string` | Image URL for the purchased item. |
| `viewPurchasedItemUrl` | `string` | URL to the purchased item. |
| `itemOnHold` | `boolean` | Indicates whether item content is hidden. |

### `returnDetails`

This container can provide seller return address and RMA information when relevant.

## Response Behavior

- Closed inquiries return `inquiryClosureDate`; open inquiries typically do not.
- Escalated inquiries may still be retrievable with `Get Inquiry`, even though escalated inquiries are excluded from search results.
- Appeal details are conditional and apply only in escalated-and-appealed scenarios.
- Shipment tracking details are conditional and appear only when relevant to the inquiry state.

## Example

### Request

```http
GET https://api.ebay.com/post-order/v2/inquiry/5********3
Authorization: Bearer <access-token>
```

### Response Excerpt

This excerpt is based on the public sample shown on the Get Inquiry reference page.

```json
{
  "inquiryId": "5********3",
  "status": "CLOSED",
  "state": "CLOSED",
  "creationReason": "INCOMPLETE_ORDER",
  "initiator": "BUYER",
  "claimAmount": {
    "value": 34.56,
    "currency": "USD"
  },
  "inquiryClosureDate": {
    "value": "2020-08-12T05:08:48.000Z"
  },
  "inquiryQuantity": 1,
  "itemId": "2**********7",
  "transactionId": "1********15",
  "sellerMakeItRightByDate": {
    "value": "2020-08-14T06:59:59.000Z"
  },
  "itemDetails": {
    "itemTitle": "test item Active CBT ",
    "itemPrice": {
      "value": 34.56,
      "currency": "USD"
    },
    "itemPictureUrl": "https://i.qa.ebayimg.com/00/s/M**********w/z/Q*************Pf/$_0.JPG?set_id=8********7",
    "viewPurchasedItemUrl": "http://L*************1/ws/eBayISAPI.dll?ViewItemVersion&item=2**********7&tid=1*********5&view=all"
  },
  "inquiryDetails": {
    "creationDate": {
      "value": "2020-08-11T01:21:57.000Z"
    },
    "expirationDate": {
      "value": "2020-08-14T07:00:00.000Z"
    },
    "refundDeadlineDate": {
      "value": "2020-08-15T05:08:48.000Z"
    },
    "totalAmount": {
      "value": 34.56,
      "currency": "USD"
    },
    "refundChargeAmount": {
      "value": 43.71,
      "convertedFromValue": 33.67,
      "convertedFromCurrency": "USD",
      "currency": "CAD",
      "exchangeRate": "1.29826"
    }
  },
  "inquiryHistoryDetails": {
    "history": [
      {
        "date": {
          "value": "2020-08-12T05:08:48.000Z"
        },
        "action": "Voluntary refund completed or failed",
        "actor": "SYSTEM"
      }
    ],
    "shipmentTrackingDetails": {
      "trackingURL": null,
      "trackingNumber": null,
      "carrier": null,
      "estimateFromDate": null,
      "estimateToDate": null,
      "currentStatus": null
    }
  }
}
```

### Example Notes

- Public sample IDs, URLs, and image data are masked by the source.
- The public sample contains testing-style item naming from the source.
- Some conditional nested fields are omitted here for readability even though the source supports them.

## Notes

- This is a traditional Post-Order REST inquiry operation.
- Migration mapping may point to newer GraphQL inquiry APIs, but this page documents the original traditional endpoint.

## Related Operations

- `GET /post-order/v2/inquiry/search` to locate inquiries
- `POST /post-order/v2/inquiry/{inquiryId}/send_message` to message the order partner
- `POST /post-order/v2/inquiry/{inquiryId}/provide_shipment_info` to provide shipping evidence
- `POST /post-order/v2/inquiry/{inquiryId}/issue_refund` to issue a refund
- `POST /post-order/v2/inquiry/{inquiryId}/escalate` to escalate the inquiry to a case
