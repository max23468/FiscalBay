# Get Case

- API Type: REST
- Operation: GET `/post-order/v2/casemanagement/{caseId}`
- Base URL: `https://api.ebay.com`
- Sandbox: Not supported in the source
- Source: [Post-Order API - Get Case](https://developer.ebay.com/Devzone/post-order/post-order_v2_casemanagement-caseid__get.html)

## Description

This method can be used on behalf of buyers and sellers to retrieve detailed information on a case, including case history and, if applicable, refund information, appeal information, and shipment tracking information.

The case is identified by the `caseId` value passed in the call URI. The caller must be involved in the case in order to retrieve the case details.

## When To Use

Use this method when you already have a case identifier and need the full current state of a Post-Order case.

Typical partner-facing use cases:

- Retrieve the status of a specific INR or return case
- Determine whether buyer or seller action is still required
- Inspect case history and monetary events
- Check whether an appeal exists or is relevant to the case
- Retrieve return-address or shipment-tracking details when present

## Request

### Endpoint

```http
GET https://api.ebay.com/post-order/v2/casemanagement/{caseId}
```

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `caseId` | string | Yes | The unique identifier of a case. This URI parameter is required in order to identify the case to retrieve. The buyer or seller must be involved in the case in order to retrieve details on the specified case. |

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

The response payload is `CaseDetailsResponse`.

### Response Fields

The source lists the following top-level fields as possible members of the response:

| Field | Type | Notes |
|-------|------|-------|
| `actionDeadlines` | `ActionDeadlines` | Remaining days for required buyer or seller actions. |
| `appealDetails` | `AppealDetails` | Returned only if the case decision was appealed by the buyer or seller. |
| `buyerClosureReason` | `string` | Returned if the buyer closed the case, or if the case was closed on behalf of the buyer. |
| `buyerProtectedProgramLink` | `string` | Not further specified in the checked source excerpt. |
| `caseContentOnHold` | `boolean` | Not further specified in the checked source excerpt. |
| `caseDetails` | `CaseDetails` | Detailed case information such as resolutions, dates, and refund-related amounts. |
| `caseHistoryDetails` | `ClaimHistoryResponse` | Chronological history of events and actions associated with the case. |
| `caseId` | `string` | The unique identifier of the case. |
| `caseQuantity` | `integer` | Quantity associated with the case. |
| `caseType` | `CaseTypeEnum` | Indicates whether the case is an INR case or a return case. |
| `claimAmount` | `Amount` | The value of the line item or claim amount associated with the case. |
| `creationDate` | `DateTime` | Timestamp indicating when the case was created. |
| `escalatedBy` | `UserPartyEnum` | The party that escalated the underlying inquiry or return into a case. |
| `escalateReason` | `string` | The escalation reason, if available. |
| `eventTicketsLink` | `string` | Not further specified in the checked source excerpt. |
| `extTransactionId` | `string` | External transaction identifier, if available. |
| `fsnadDaysToAddTrackingAfterShippingItem` | `integer` | Not further specified in the checked source excerpt. |
| `fsnadShipToSellerByDate` | `DateTime` | Not further specified in the checked source excerpt. |
| `initiator` | `UserPartyEnum` | The party that initiated the case. |
| `itemId` | `string` | The unique identifier of the eBay listing where the line item was purchased. |
| `itemOnHold` | `boolean` | Not further specified in the checked source excerpt. |
| `lastModifiedDate` | `DateTime` | Timestamp indicating when the case was last modified. |
| `payForItemLink` | `string` | Not further specified in the checked source excerpt. |
| `priceSignatureConfirmationAmount` | `string` | Not further specified in the checked source excerpt. |
| `recalledItemLink` | `string` | Not further specified in the checked source excerpt. |
| `returnDetails` | `ReturnAddress` | Seller return address and RMA information, if applicable. |
| `returnId` | `string` | Return identifier, if the case is associated with a return. |
| `sellerClosureReason` | `string` | Seller-side closure reason, if applicable. |
| `shippingFee` | `Amount` | Shipping amount, if applicable. |
| `status` | `string` | Current case status. |
| `transactionId` | `string` | Transaction identifier for the line item associated with the case. |

## Key Response Containers

### `actionDeadlines`

This container provides the number of remaining days that a buyer or seller has before being required to take action on an INR or return case.

| Field | Type | Description |
|-------|------|-------------|
| `daysForBuyerToProvideProofOfShipment` | `integer` | Number of days the buyer has to provide proof of return shipment before the case expires. Returned only for return cases. |
| `daysToExpireWithoutResponse` | `integer` | Number of days a user has to make a required response before the case expires. |
| `daysToExpireWithResponse` | `integer` | Number of days remaining before the case expires. |
| `daysToReturnItem` | `integer` | Number of remaining days the buyer has to return an item and still expect a refund from the seller. Returned only for return cases. |
| `maxDaysToFileClaim` | `integer` | Number of remaining days the buyer has to file a claim. |

### `caseDetails`

This container provides detailed information about the case itself.

| Field | Type | Description |
|-------|------|-------------|
| `buyerFinalAcceptResolution` | `string` | What the buyer ultimately agreed to with the seller to resolve the case. |
| `buyerInitExpectResolution` | `string` | What the buyer initially expected to resolve the case. |
| `creationDate` | `DateTime` | Timestamp indicating when the case was created. |
| `escalationDate` | `DateTime` | Timestamp indicating when the associated INR inquiry or return request was escalated into a case. |
| `expirationDate` | `DateTime` | Timestamp indicating when a case will expire naturally if a required response is not made. |
| `lastBuyerRespDate` | `DateTime` | Timestamp indicating when the buyer last responded to or acted on the case. Returned only if the buyer has responded or acted. |
| `lastSellerRespDate` | `DateTime` | Timestamp indicating when the seller last responded to or acted on the case. Returned only if the seller has responded or acted. |
| `paypalPaid` | `boolean` | Whether the transaction was paid through PayPal. |
| `refundAmounts` | `RefundAmounts` | Expected and actual buyer refund amounts associated with the case. |
| `refundChargeAmount` | `Amount` | Refund charge amount, if applicable. |
| `refundDeadlineDate` | `DateTime` | Deadline for refund-related action, if applicable. |
| `refundType` | `RefundType` | Indicates the refund type associated with the case. |

### `refundAmounts`

This container provides refund-specific monetary details when refund activity is relevant to the case.

| Field | Type | Description |
|-------|------|-------------|
| `buyerFinalAcceptRefundAmt` | `Amount` | Refund amount finally accepted by the buyer. |
| `buyerInitExpectRefundAmt` | `Amount` | Refund amount initially expected by the buyer. |
| `donationAmount` | `Amount` | Refunded charitable donation amount, including currency-conversion detail when necessary. |
| `feeCreditAmount` | `Amount` | Total amount of fees credited toward the refund. |
| `internationalRefundAmount` | `Amount` | Refund amount issued for the international leg of a Global Shipping Program shipment. Returned only for applicable international orders. |
| `refundAmount` | `Amount` | Refund amount issued to the buyer. |

### `caseHistoryDetails`

This container provides the history of events associated with the case.

| Field | Type | Description |
|-------|------|-------------|
| `history` | `array of ClaimHistoryEventModel` | One or more events or actions associated with the case. |
| `shipmentTrackingDetails` | `ShipmentTrackingDetailType` | Detailed shipment tracking information if shipment tracking is currently relevant to the case. |

Each history entry can include:

| Field | Type | Description |
|-------|------|-------------|
| `action` | `string` | Action initiated by one of the parties involved with the case. |
| `actor` | `UserPartyEnum` | Party that took the action. |
| `date` | `DateTime` | Timestamp indicating when the event or action occurred. |
| `description` | `string` | Text-based description of the event or action, if available. |
| `moneyMovement` | `MoneyMovementEntries` | Monetary transactions involved with the event or action, if any. |

### `appealDetails`

This container is returned only if the case decision was appealed by the buyer or seller.

| Field | Type | Description |
|-------|------|-------------|
| `appealCloseReasonEnum` | `string` | Why the appeal was closed. Returned only if an appeal was made and has been closed. |
| `appealDate` | `DateTime` | Timestamp indicating when the appeal was initiated. |
| `appealReasonCode` | `string` | String representation of why the buyer or seller appealed the case decision. |
| `appealRefundAmount` | `Amount` | Amount refunded to the seller if the seller wins an appeal on a case decision that went against the seller. |
| `appealStatus` | `AppealGrantStatusEnum` | Indicates whether eBay accepted the buyer's or seller's appeal. |
| `appealStatusEnum` | `string` | Appeal status in string form. |
| `eligibleForAppeal` | `boolean` | Indicates whether the case is eligible for appeal. |

### `returnDetails`

This container provides the seller's return address and Return Merchandise Authorization information, if applicable.

| Field | Type | Description |
|-------|------|-------------|
| `address` | `Address` | Full return address of the seller. |
| `editable` | `boolean` | Indicates whether the return address can be modified. |
| `firstName` | `string` | First name associated with the return address, or business/store name if applicable. |
| `lastName` | `string` | Last name associated with the return address, if applicable. |
| `RMA` | `string` | Return Merchandise Authorization identifier, if one exists for the order line item. |

## Response Behavior

- `caseType` indicates whether the case is an Item Not Received case or a return case.
- `appealDetails` is conditional and appears only when an appeal exists.
- `returnDetails` is conditional and appears only when return-address information is relevant.
- `caseHistoryDetails.shipmentTrackingDetails` is conditional and appears only when shipment tracking is relevant.
- Several closure, refund, and lifecycle timestamps are conditional and only appear after the corresponding events occur.

## Example

### Request

```http
GET https://api.ebay.com/post-order/v2/casemanagement/5********2
Authorization: Bearer <access-token>
```

### Response Excerpt

This excerpt is based on the public sample shown on the Get Case reference page. It is an `ITEM_NOT_RECEIVED` case sample, so some return-specific fields are not populated.

```json
{
  "caseId": "5********2",
  "caseType": "ITEM_NOT_RECEIVED",
  "itemId": "2**********6",
  "transactionId": "1*********5",
  "returnId": "-1",
  "status": "OTHER",
  "claimAmount": {
    "value": 34.67,
    "currency": "USD"
  },
  "shippingFee": {
    "value": 0,
    "currency": "USD"
  },
  "caseQuantity": 1,
  "initiator": "BUYER",
  "creationDate": {
    "value": "2020-08-10T22:16:23.000Z"
  },
  "lastModifiedDate": {
    "value": "2020-08-12T18:01:40.000Z"
  },
  "sellerClosureReason": "UNDEFINED",
  "buyerClosureReason": "UNDEFINED",
  "buyerProtectedProgramLink": "http://L*************1/h**p/***/p****************s.html",
  "payForItemLink": "http://L*************1/help/policies/unpaid-item.html",
  "recalledItemLink": "http://L*************1/help/policies/recalled.html",
  "fsnadDaysToAddTrackingAfterShippingItem": 0,
  "appealDetails": {
    "eligibleForAppeal": false,
    "appealStatus": "OTHER",
    "appealDate": {
      "value": "2020-08-12T18:01:40.000Z"
    },
    "appealReasonCode": null,
    "appealCloseReasonEnum": "OTHER",
    "appealStatusEnum": "SELLER_APPEALED",
    "appealRefundAmount": null
  },
  "caseDetails": {
    "creationDate": {
      "value": "2020-08-10T22:16:23.000Z"
    },
    "expirationDate": {
      "value": "2020-08-14T07:00:00.000Z"
    },
    "escalationDate": {
      "value": "2020-08-10T22:30:40.000Z"
    },
    "refundAmounts": {
      "refundAmount": null,
      "feeCreditAmount": null,
      "buyerFinalAcceptRefundAmt": {
        "value": 0,
        "currency": "USD"
      },
      "buyerInitExpectRefundAmt": {
        "value": 0,
        "currency": "USD"
      },
      "internationalRefundAmount": null
    },
    "refundChargeAmount": {
      "value": 45.01,
      "convertedFromValue": 34.67,
      "convertedFromCurrency": "USD",
      "currency": "CAD",
      "exchangeRate": "1.29826"
    },
    "refundType": "OTHER",
    "refundDeadlineDate": {
      "value": "2020-08-15T18:01:40.000Z"
    },
    "buyerInitExpectResolution": "BOR1 - I want a full refund (without returning the item i.e. not received yet)",
    "buyerFinalAcceptResolution": "Unknown",
    "lastBuyerRespDate": null,
    "lastSellerRespDate": null
  },
  "actionDeadlines": {
    "maxDaysToFileClaim": 30,
    "daysToReturnItem": 3,
    "daysToExpireWithResponse": 21,
    "daysToExpireWithoutResponse": 21,
    "daysForBuyerToProvideProofOfShipment": -1
  },
  "caseHistoryDetails": {
    "history": [
      {
        "date": {
          "value": "2020-08-10T22:16:23.000Z"
        },
        "action": "A CPS case was created.",
        "actor": "BUYER",
        "description": "active CBT e2e testing",
        "moneyMovement": null
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

- This public sample is an INR case, not a return-case sample.
- `shipmentTrackingDetails` and `returnDetails` may be present in real responses when relevant, but they are not populated in this public sample.
- Public sample IDs and URLs are masked by the source.

## Notes

- This is a Post-Order REST API operation.
- The method is not supported in the Sandbox environment.
- Many response fields are conditional and appear only when relevant to the current case type or lifecycle state.
- The migration mapping in `api-mapping.csv` points `GetCase` to newer GraphQL inquiry/return flows, but the original `GetCase` operation itself is a REST endpoint.

## Related Operations

- `GET /post-order/v2/casemanagement/search` to locate cases before retrieving one by ID
- `POST /post-order/v2/casemanagement/{caseId}/appeal` to appeal a case decision
- `POST /post-order/v2/casemanagement/{caseId}/issue_refund` when a seller needs to issue a refund
- `POST /post-order/v2/casemanagement/{caseId}/provide_shipment_info` when shipment tracking information must be supplied
