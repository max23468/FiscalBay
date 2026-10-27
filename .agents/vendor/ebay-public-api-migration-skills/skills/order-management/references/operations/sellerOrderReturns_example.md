# sellerOrderReturns

**API:** Return
**Type:** GraphQL Query
**Endpoint:** `https://graphqlapi.ebay.com/graphql`
**Method:** Query
**Operation Name:** `sellerOrderReturns`

---

## Description

This sample **sellerOrderReturns** query retrieves a list of closed order returns for the seller, with filtering and sorting options specified.

---

## Request Payload

```graphql
query SellerOrderReturns($input: SellerOrderReturnsInput!) {
  sellerOrderReturns(input: $input) {
    ... on SellerOrderReturns {
      orderReturns {
        returnId
        requester
        requestedAt
        closedAt
        status {
          __typename
          code
          displayText
          ... on ReturnRequested {
            code
            displayText
          }
          ... on ReturnOpen {
            code
            displayText
          }
          ... on ReturnDeclined {
            code
            displayText
          }
          ... on ReturnCancelled {
            code
            displayText
          }
          ... on ReturnClosed {
            code
            displayText
          }
        }
        returnLineItems {
          returnLineItemId
          requestedQuantity
          returnReason {
            code
            displayText
          }
          returnNote
          orderLineItem {
            orderLineItemId
          }
          listingRestockTasks {
            __typename
            ... on PostPurchaseListingRelistTask {
              relistStatus {
                code
                displayText
              }
              relistedListing {
                __typename
                ... on ListingReference {
                  listingId
                }
              }
            }
          }
        }
        returnNegotiation {
          latestReturnOffer {
            status {
              __typename
              code
              displayText
              ... on ReturnOfferPending {
                code
                displayText
              }
              ... on ReturnOfferAccepted {
                code
                displayText
              }
              ... on ReturnOfferDeclined {
                code
                displayText
              }
              ... on ReturnOfferExpired {
                code
                displayText
              }
            }
            proposedTerm {
              __typename
              ... on KeepItemPartialRefundTerm {
                refundAmount {
                  original {
                    value
                    currency
                  }
                  exchangeScenario(scenario: SELLER_CURRENCY) {
                    __typename
                    ... on ExchangeAmount {
                      amount {
                        value
                        currency
                      }
                      exchangeRate
                      exchangeAt
                    }
                    ... on InvalidExchangeScenarioInputError {
                      errorCode
                      errorMessage
                    }
                  }
                }
                itemPriceRefundPercentage
                itemShippingPriceWaived
                returnLineItem {
                  returnLineItemId
                  requestedQuantity
                  returnReason {
                    code
                    displayText
                  }
                  returnNote
                  orderLineItem {
                    orderLineItemId
                  }
                }
              }
            }
          }
        }
        sellerAvailableActions {
          respondByAction {
            respondAction {
              __typename
              code
              displayText
              ... on SendMessageReturnAction {
                code
                displayText
              }
              ... on ApproveReturnAction {
                code
                displayText
              }
              ... on DeclineReturnAction {
                code
                displayText
              }
              ... on ProcessReturnRefundAction {
                code
                displayText
              }
              ... on NegotiateOnReturnAction {
                code
                displayText
              }
              ... on ProvideShipmentInfoReturnAction {
                code
                displayText
              }
              ... on ProvideRmaNumberReturnAction {
                code
                displayText
              }
              ... on RecordReturnReceivedAction {
                code
                displayText
              }
              ... on ReturnReferralAction {
                code
                displayText
                referralReasons {
                  __typename
                  ... on UnresponsiveTradingPartner {
                    code
                    displayText
                  }
                  ... on UnableToReachAgreement {
                    code
                    displayText
                  }
                  ... on RefundNotReceived {
                    code
                    displayText
                  }
                  ... on NoRefundForReturnShipping {
                    code
                    displayText
                  }
                  ... on ReturnedWrongItem {
                    code
                    displayText
                  }
                  ... on ReturnNotReceived {
                    code
                    displayText
                  }
                  ... on ReceivedEmptyBox {
                    code
                    displayText
                  }
                  ... on DamagedItemReturned {
                    code
                    displayText
                  }
                  ... on OtherReferralReason {
                    code
                    displayText
                  }
                }
              }
            }
            responseDueAt
          }
          secondaryActions {
            __typename
            code
            displayText
            ... on SendMessageReturnAction {
              code
              displayText
            }
            ... on ApproveReturnAction {
              code
              displayText
            }
            ... on DeclineReturnAction {
              code
              displayText
            }
            ... on ProcessReturnRefundAction {
              code
              displayText
            }
            ... on NegotiateOnReturnAction {
              code
              displayText
            }
            ... on ProvideShipmentInfoReturnAction {
              code
              displayText
            }
            ... on ProvideRmaNumberReturnAction {
              code
              displayText
            }
            ... on RecordReturnReceivedAction {
              code
              displayText
            }
            ... on ReturnReferralAction {
              code
              displayText
              referralReasons {
                __typename
                ... on UnresponsiveTradingPartner {
                  code
                  displayText
                }
                ... on UnableToReachAgreement {
                  code
                  displayText
                }
                ... on RefundNotReceived {
                  code
                  displayText
                }
                ... on NoRefundForReturnShipping {
                  code
                  displayText
                }
                ... on ReturnedWrongItem {
                  code
                  displayText
                }
                ... on ReturnNotReceived {
                  code
                  displayText
                }
                ... on ReceivedEmptyBox {
                  code
                  displayText
                }
                ... on DamagedItemReturned {
                  code
                  displayText
                }
                ... on OtherReferralReason {
                  code
                  displayText
                }
              }
            }
          }
        }
        returnFulfillment {
          fulfillmentStatus {
            __typename
            code
            displayText
            ... on AwaitingReturnFulfillmentDetails {
              actionDueFrom
            }
            ... on AwaitingReturnFulfillmentInitiation {
              actionDueFrom
            }
            ... on ReturnFulfillmentInProgress {
              code
              displayText
            }
            ... on ReturnFulfillmentComplete {
              completedAt
            }
            ... on ReturnFulfillmentException {
              code
              displayText
            }
          }
          rmaDetails {
            rmaNumber
            rmaRequirementWaived
          }
          finalDestinationAddress {
            addressId
            addressLine1
            city
            stateOrProvince
            postalCode
            countryCode
            addressContact {
              name
            }
          }
          sellerFulfillmentInitiation {
            destinationAddress {
              addressId
              addressLine1
              city
              stateOrProvince
              postalCode
              countryCode
              addressContact {
                name
              }
            }
            originAddress {
              addressId
              addressLine1
              city
              stateOrProvince
              postalCode
              countryCode
              addressContact {
                name
              }
            }
            labelProvisionOptions
            provisionedLabels {
              provisionOption
              returnLabels {
                labelDocument {
                  documentId
                  documentName
                  uploadedAt
                }
                shippingCarrier {
                  carrierCode
                  unsupportedCarrierName
                }
                trackingNumber
                totalLabelCost {
                  original {
                    value
                    currency
                  }
                }
              }
            }
          }
          returnFulfillmentSummary {
            latestPackageEvents {
              __typename
              occurredAt
              ... on ReturnShipmentTrackingEvent {
                status {
                  __typename
                  code
                  displayText
                }
                tracking {
                  trackingNumber
                  shippingCarrier {
                    carrierCode
                    unsupportedCarrierName
                  }
                }
              }
            }
          }
        }
        refundEstimate {
          sellerRefundEstimateBreakdown {
            __typename
            refundPriceLines {
              name
              amount {
                original {
                  value
                  currency
                }
              }
              priceLines {
                __typename
                name
                amount {
                  original {
                    value
                    currency
                  }
                }
                ... on ItemPrice {
                  name
                  amount {
                    original {
                      value
                      currency
                    }
                  }
                }
                ... on ItemTax {
                  name
                  amount {
                    original {
                      value
                      currency
                    }
                  }
                }
                ... on ShippingPrice {
                  name
                  amount {
                    original {
                      value
                      currency
                    }
                  }
                }
                ... on ShippingTax {
                  name
                  amount {
                    original {
                      value
                      currency
                    }
                  }
                }
                ... on DomesticShippingPrice {
                  name
                  amount {
                    original {
                      value
                      currency
                    }
                  }
                }
                ... on DomesticShippingTax {
                  name
                  amount {
                    original {
                      value
                      currency
                    }
                  }
                }
                ... on InternationalShippingPrice {
                  name
                  amount {
                    original {
                      value
                      currency
                    }
                  }
                }
                ... on InternationalShippingTax {
                  name
                  amount {
                    original {
                      value
                      currency
                    }
                  }
                }
                ... on ShippingHandlingPrice {
                  name
                  amount {
                    original {
                      value
                      currency
                    }
                  }
                }
                ... on ShippingHandlingTax {
                  name
                  amount {
                    original {
                      value
                      currency
                    }
                  }
                }
                ... on ServiceFee {
                  name
                  amount {
                    original {
                      value
                      currency
                    }
                  }
                }
                ... on ServiceFeeTax {
                  name
                  amount {
                    original {
                      value
                      currency
                    }
                  }
                }
                ... on RegulatoryTaxFee {
                  name
                  amount {
                    original {
                      value
                      currency
                    }
                  }
                }
                ... on ImportTax {
                  name
                  amount {
                    original {
                      value
                      currency
                    }
                  }
                }
              }
            }
            totalEstimatedRefundAmount {
              original {
                value
                currency
              }
            }
            totalEstimatedWithholdingAmount {
              original {
                value
                currency
              }
            }
            totalEstimatedCreditAmount {
              original {
                value
                currency
              }
            }
            estimatedWithholdings {
              __typename
              name
              amount {
                original {
                  value
                  currency
                }
              }
              ... on LabelPurchaseWithholding {
                name
                amount {
                  original {
                    value
                    currency
                  }
                }
              }
              ... on SellerWithholding {
                name
                amount {
                  original {
                    value
                    currency
                  }
                }
              }
            }
            estimatedCredits {
              __typename
              name
              creditAmount {
                original {
                  value
                  currency
                }
              }
              ... on SellerFeeCredit {
                name
                creditAmount {
                  original {
                    value
                    currency
                  }
                }
              }
              ... on SellerDonationCredit {
                name
                creditAmount {
                  original {
                    value
                    currency
                  }
                }
              }
            }
            netEstimatedRefundAmount {
              original {
                value
                currency
              }
            }
          }
        }
        refunds {
          __typename
          ... on Refund {
            refundId
            refundStatus {
              __typename
              code
              displayText
              ... on RefundScheduled {
                code
                displayText
              }
              ... on RefundInProgress {
                code
                displayText
              }
              ... on RefundFailed {
                code
                displayText
              }
              ... on RefundCompleted {
                code
                displayText
              }
            }
            sellerRefundBreakdown {
              __typename
              totalRefundAmount {
                original {
                  value
                  currency
                }
              }
              totalWithholdingAmount {
                original {
                  value
                  currency
                }
              }
              totalCreditAmount {
                original {
                  value
                  currency
                }
              }
              refundPriceLines {
                name
                amount {
                  original {
                    value
                    currency
                  }
                }
                priceLines {
                  __typename
                  name
                  amount {
                    original {
                      value
                      currency
                    }
                  }
                  ... on ItemPrice {
                    name
                    amount {
                      original {
                        value
                        currency
                      }
                    }
                  }
                  ... on ItemTax {
                    name
                    amount {
                      original {
                        value
                        currency
                      }
                    }
                  }
                  ... on ShippingPrice {
                    name
                    amount {
                      original {
                        value
                        currency
                      }
                    }
                  }
                  ... on ShippingTax {
                    name
                    amount {
                      original {
                        value
                        currency
                      }
                    }
                  }
                  ... on DomesticShippingPrice {
                    name
                    amount {
                      original {
                        value
                        currency
                      }
                    }
                  }
                  ... on DomesticShippingTax {
                    name
                    amount {
                      original {
                        value
                        currency
                      }
                    }
                  }
                  ... on InternationalShippingPrice {
                    name
                    amount {
                      original {
                        value
                        currency
                      }
                    }
                  }
                  ... on InternationalShippingTax {
                    name
                    amount {
                      original {
                        value
                        currency
                      }
                    }
                  }
                  ... on ShippingHandlingPrice {
                    name
                    amount {
                      original {
                        value
                        currency
                      }
                    }
                  }
                  ... on ShippingHandlingTax {
                    name
                    amount {
                      original {
                        value
                        currency
                      }
                    }
                  }
                  ... on ServiceFee {
                    name
                    amount {
                      original {
                        value
                        currency
                      }
                    }
                  }
                  ... on ServiceFeeTax {
                    name
                    amount {
                      original {
                        value
                        currency
                      }
                    }
                  }
                  ... on RegulatoryTaxFee {
                    name
                    amount {
                      original {
                        value
                        currency
                      }
                    }
                  }
                  ... on ImportTax {
                    name
                    amount {
                      original {
                        value
                        currency
                      }
                    }
                  }
                }
              }
              withholdings {
                __typename
                name
                amount {
                  original {
                    value
                    currency
                  }
                }
                ... on LabelPurchaseWithholding {
                  name
                  amount {
                    original {
                      value
                      currency
                    }
                  }
                }
                ... on SellerWithholding {
                  name
                  amount {
                    original {
                      value
                      currency
                    }
                  }
                }
              }
              credits {
                __typename
                name
                creditAmount {
                  original {
                    value
                    currency
                  }
                }
                ... on SellerFeeCredit {
                  name
                  creditAmount {
                    original {
                      value
                      currency
                    }
                  }
                }
                ... on SellerDonationCredit {
                  name
                  creditAmount {
                    original {
                      value
                      currency
                    }
                  }
                }
              }
              netRefundAmount {
                original {
                  value
                  currency
                }
              }
            }
            fundings {
              __typename
              fundingState {
                __typename
                code
                displayText
                ... on RefundFundingInitiated {
                  code
                  displayText
                }
                ... on RefundFundingInProgress {
                  code
                  displayText
                }
                ... on RefundFundingCompleted {
                  code
                  displayText
                }
                ... on RefundFundingFailed {
                  code
                  displayText
                }
              }
              fundingExecutions {
                amount {
                  original {
                    value
                    currency
                  }
                }
                state
                attemptedAt
                completedAt
                paymentMethod {
                  paymentType {
                    __typename
                    code
                    descriptiveName
                    displayName
                    ... on ApplePay {
                      code
                      descriptiveName
                      displayName
                    }
                    ... on CreditCard {
                      code
                      descriptiveName
                      displayName
                    }
                    ... on EbayBalance {
                      code
                      descriptiveName
                      displayName
                    }
                    ... on GooglePay {
                      code
                      descriptiveName
                      displayName
                    }
                    ... on KlarnaInstallment {
                      code
                      descriptiveName
                      displayName
                    }
                    ... on KlarnaInvoice {
                      code
                      descriptiveName
                      displayName
                    }
                    ... on PayPal {
                      code
                      descriptiveName
                      displayName
                    }
                    ... on Sofort {
                      code
                      descriptiveName
                      displayName
                    }
                    ... on Venmo {
                      code
                      descriptiveName
                      displayName
                    }
                    ... on WireTransfer {
                      code
                      descriptiveName
                      displayName
                    }
                    ... on ZIP {
                      code
                      descriptiveName
                      displayName
                    }
                  }
                }
              }
              ... on SellerRefundFunding {
                fundingState {
                  code
                  displayText
                }
                fundingExecutions {
                  amount {
                    original {
                      value
                      currency
                    }
                  }
                  state
                  attemptedAt
                  completedAt
                }
              }
            }
          }
        }
        cases {
          caseId
          initiator
          reason {
            __typename
            code
            displayText
          }
          latestDecision {
            decidedAt
            decisionId
            inFavorOf
            note
            outcomes {
              __typename
              code
              displayText
              ... on RefundDecisionOutcome {
                decisionAmount {
                  original {
                    value
                    currency
                  }
                }
              }
              ... on CreditSellerForRefundChargeDecisionOutcome {
                decisionAmount {
                  original {
                    value
                    currency
                  }
                }
              }
              ... on UpholdPreviousDecisionOutcome {
                code
                displayText
              }
            }
            reviewRequest {
              reason {
                __typename
                code
                displayText
              }
              requestedAt
              requester
              requesterNote
            }
          }
          decisionHistory {
            decidedAt
            decisionId
            inFavorOf
            note
            outcomes {
              __typename
              code
              displayText
              ... on RefundDecisionOutcome {
                decisionAmount {
                  original {
                    value
                    currency
                  }
                }
              }
              ... on CreditSellerForRefundChargeDecisionOutcome {
                decisionAmount {
                  original {
                    value
                    currency
                  }
                }
              }
              ... on UpholdPreviousDecisionOutcome {
                code
                displayText
              }
            }
            reviewRequest {
              reason {
                __typename
                code
                displayText
              }
              requestedAt
              requester
              requesterNote
            }
          }
          status {
            __typename
            code
            displayText
          }
        }
      }
      pagination {
        nextCursor
        previousCursor
      }
    }
    ... on ReturnInvalidSearchInputError {
      __typename
      errorCode
      errorMessage
    }
    ... on ReturnInvalidDateRangeError {
      __typename
      errorCode
      errorMessage
    }
    ... on ReturnInvalidPageSizeError {
      __typename
      errorCode
      errorMessage
    }
    ... on ReturnActionNotPermittedError {
      __typename
      errorCode
      errorMessage
      availableActions {
        __typename
        code
        displayText
      }
    }
  }
}

# Variables
  
{
  "input": {
    "initialPage": {
      "filter": {
        "presets": "CLOSED",
        "dateRange": {
          "startDateTime": "2024-01-15T01:00:00Z",
          "endDateTime": "2024-01-19T09:00:00Z"
        }
      },
      "sort": {
        "sortField": "REQUESTED_AT",
        "sortOrder": "ASC"
      }
    },
    "pagination": {
      "maxPageSize": 1
    }
  }
}


```

---

## Response Sample

```json
{
    "data": {
        "sellerOrderReturns": {
            "orderReturns": [
                {
                    "__typename": "OrderReturn",
                    "returnId": "50******01",
                    "requester": "BUYER",
                    "requestedAt": "2024-01-15T10:30:00Z",
                    "closedAt": "2024-01-19T09:00:00Z",
                    "status": {
                        "__typename": "ReturnClosed",
                        "code": "CLOSED",
                        "displayText": "Return has been closed"
                    },
                    "returnLineItems": [
                        {
                            "returnLineItemId": "5********1-1",
                            "requestedQuantity": 1,
                            "returnReason": {
                                "code": "NOT_AS_DESCRIBED",
                                "displayText": "Item not as described"
                            },
                            "returnNote": "The item color does not match the listing photos",
                            "orderLineItem": {
                                "orderLineItemId": "12******90"
                            },
                            "listingRestockTasks": [
                                {
                                    "__typename": "PostPurchaseListingRelistTask",
                                    "relistStatus": {
                                        "code": "COMPLETED",
                                        "displayText": "Relist task completed"
                                    },
                                    "relistedListing": {
                                        "__typename": "ListingReference",
                                        "listingId": "98******10"
                                    }
                                }
                            ]
                        }
                    ],
                    "returnNegotiation": {
                        "latestReturnOffer": {
                            "status": {
                                "__typename": "ReturnOfferDeclined",
                                "code": "DECLINED",
                                "displayText": "Offer has been declined"
                            },
                            "proposedTerm": [
                                {
                                    "__typename": "KeepItemPartialRefundTerm",
                                    "refundAmount": {
                                        "original": {
                                            "value": "25.00",
                                            "currency": "USD"
                                        },
                                        "exchangeScenario": {
                                            "__typename": "ExchangeAmount",
                                            "amount": {
                                                "value": "25.00",
                                                "currency": "USD"
                                            },
                                            "exchangeRate": "1.0",
                                            "exchangeAt": "2024-01-15T10:30:00Z"
                                        }
                                    },
                                    "itemPriceRefundPercentage": 50,
                                    "itemShippingPriceWaived": false,
                                    "returnLineItem": {
                                        "returnLineItemId": "50*******1-1",
                                        "requestedQuantity": 1,
                                        "returnReason": {
                                            "code": "NOT_AS_DESCRIBED",
                                            "displayText": "Item not as described"
                                        },
                                        "returnNote": "The item color does not match the listing photos",
                                        "orderLineItem": {
                                            "orderLineItemId": "12******90"
                                        }
                                    }
                                }
                            ]
                        }
                    },
                    "sellerAvailableActions": {
                        "secondaryActions": [
                            {
                                "__typename": "ReturnReferralAction",
                                "code": "REFER_RETURN_TO_EBAY",
                                "displayText": "Refer return to eBay",
                                "referralReasons": [
                                    {
                                        "__typename": "ReturnedWrongItem",
                                        "code": "RETURNED_WRONG_ITEM",
                                        "displayText": "Buyer returned wrong item"
                                    },
                                    {
                                        "__typename": "ReturnNotReceived",
                                        "code": "RETURN_NOT_RECEIVED",
                                        "displayText": "Return not received"
                                    },
                                    {
                                        "__typename": "ReceivedEmptyBox",
                                        "code": "RECEIVED_EMPTY_BOX",
                                        "displayText": "Received empty box"
                                    },
                                    {
                                        "__typename": "DamagedItemReturned",
                                        "code": "DAMAGED_ITEM_RETURNED",
                                        "displayText": "Damaged item returned"
                                    },
                                    {
                                        "__typename": "OtherReferralReason",
                                        "code": "OTHER",
                                        "displayText": "Other reason"
                                    }
                                ]
                            }
                        ]
                    },
                    "returnFulfillment": {
                        "fulfillmentStatus": {
                            "__typename": "ReturnFulfillmentComplete",
                            "code": "RETURN_FULFILLMENT_COMPLETE",
                            "displayText": "Return fulfillment has been completed",
                            "completedAt": "2024-01-17T10:00:00Z"
                        },
                        "rmaDetails": [
                            {
                                "rmaNumber": "RMA-2024-001234",
                                "rmaRequirementWaived": false
                            }
                        ],
                        "finalDestinationAddress": {
                          "addressLine1": "123 Example Street",
                          "city": "Example City",
                            "stateOrProvince": "CA",
                          "postalCode": "00000",
                            "countryCode": "US",
                            "addressContact": {
                            "name": "Example Recipient"
                            }
                        },
                        "returnFulfillmentSummary": {
                            "latestPackageEvents": [
                                {
                                    "__typename": "ReturnShipmentTrackingEvent",
                                    "occurredAt": "2024-01-17T09:00:00Z",
                                    "status": {
                                        "__typename": "ShippingDelivered",
                                        "code": "DELIVERED",
                                        "displayText": "Package has been delivered"
                                    },
                                    "tracking": {
                                        "trackingNumber": "9400111899562941234567",
                                        "shippingCarrier": {
                                            "carrierCode": "USPS"
                                        }
                                    }
                                }
                            ]
                        }
                    },
                    "refundEstimate": {
                        "sellerRefundEstimateBreakdown": {
                            "__typename": "SellerRefundEstimateBreakdown",
                            "refundPriceLines": [
                                {
                                    "name": "LISTING_SUBTOTAL",
                                    "amount": {
                                        "original": {
                                            "value": "50.00",
                                            "currency": "USD"
                                        }
                                    },
                                    "priceLines": [
                                        {
                                            "__typename": "ItemPrice",
                                            "name": "ITEM_PRICE",
                                            "amount": {
                                                "original": {
                                                    "value": "50.00",
                                                    "currency": "USD"
                                                }
                                            }
                                        }
                                    ]
                                },
                                {
                                    "name": "SHIPPING_SUBTOTAL",
                                    "amount": {
                                        "original": {
                                            "value": "5.00",
                                            "currency": "USD"
                                        }
                                    },
                                    "priceLines": [
                                        {
                                            "__typename": "ShippingPrice",
                                            "name": "SHIPPING_PRICE",
                                            "amount": {
                                                "original": {
                                                    "value": "5.00",
                                                    "currency": "USD"
                                                }
                                            }
                                        }
                                    ]
                                }
                            ],
                            "totalEstimatedRefundAmount": {
                                "original": {
                                    "value": "55.00",
                                    "currency": "USD"
                                }
                            },
                            "totalEstimatedWithholdingAmount": {
                                "original": {
                                    "value": "8.50",
                                    "currency": "USD"
                                }
                            },
                            "totalEstimatedCreditAmount": {
                                "original": {
                                    "value": "2.75",
                                    "currency": "USD"
                                }
                            },
                            "estimatedWithholdings": [
                                {
                                    "__typename": "LabelPurchaseWithholding",
                                    "name": "RETURN_LABEL_PURCHASE",
                                    "amount": {
                                        "original": {
                                            "value": "8.50",
                                            "currency": "USD"
                                        }
                                    }
                                }
                            ],
                            "estimatedCredits": [
                                {
                                    "__typename": "SellerFeeCredit",
                                    "name": "FEE_CREDIT",
                                    "creditAmount": {
                                        "original": {
                                            "value": "2.75",
                                            "currency": "USD"
                                        }
                                    }
                                }
                            ],
                            "netEstimatedRefundAmount": {
                                "original": {
                                    "value": "43.75",
                                    "currency": "USD"
                                }
                            }
                        }
                    },
                    "refunds": [
                        {
                            "__typename": "Refund",
                            "refundId": "RFND-5********1",
                            "refundStatus": {
                                "__typename": "RefundCompleted",
                                "code": "COMPLETED",
                                "displayText": "Refund has been completed"
                            },
                            "sellerRefundBreakdown": {
                                "__typename": "SellerRefundBreakdown",
                                "totalRefundAmount": {
                                    "original": {
                                        "value": "55.00",
                                        "currency": "USD"
                                    }
                                },
                                "totalWithholdingAmount": {
                                    "original": {
                                        "value": "8.50",
                                        "currency": "USD"
                                    }
                                },
                                "totalCreditAmount": {
                                    "original": {
                                        "value": "2.75",
                                        "currency": "USD"
                                    }
                                },
                                "refundPriceLines": [
                                    {
                                        "name": "LISTING_SUBTOTAL",
                                        "amount": {
                                            "original": {
                                                "value": "50.00",
                                                "currency": "USD"
                                            }
                                        },
                                        "priceLines": [
                                            {
                                                "__typename": "ItemPrice",
                                                "name": "ITEM_PRICE",
                                                "amount": {
                                                    "original": {
                                                        "value": "50.00",
                                                        "currency": "USD"
                                                    }
                                                }
                                            }
                                        ]
                                    },
                                    {
                                        "name": "SHIPPING_SUBTOTAL",
                                        "amount": {
                                            "original": {
                                                "value": "5.00",
                                                "currency": "USD"
                                            }
                                        },
                                        "priceLines": [
                                            {
                                                "__typename": "ShippingPrice",
                                                "name": "SHIPPING_PRICE",
                                                "amount": {
                                                    "original": {
                                                        "value": "5.00",
                                                        "currency": "USD"
                                                    }
                                                }
                                            }
                                        ]
                                    }
                                ],
                                "withholdings": [
                                    {
                                        "__typename": "LabelPurchaseWithholding",
                                        "name": "RETURN_LABEL_PURCHASE",
                                        "amount": {
                                            "original": {
                                                "value": "8.50",
                                                "currency": "USD"
                                            }
                                        }
                                    }
                                ],
                                "credits": [
                                    {
                                        "__typename": "SellerFeeCredit",
                                        "name": "FEE_CREDIT",
                                        "creditAmount": {
                                            "original": {
                                                "value": "2.75",
                                                "currency": "USD"
                                            }
                                        }
                                    }
                                ],
                                "netRefundAmount": {
                                    "original": {
                                        "value": "43.75",
                                        "currency": "USD"
                                    }
                                }
                            },
                            "fundings": [
                                {
                                    "__typename": "SellerRefundFunding",
                                    "fundingState": {
                                        "__typename": "RefundFundingCompleted",
                                        "code": "REFUND_FUNDING_COMPLETED",
                                        "displayText": "Refund funding completed"
                                    },
                                    "fundingExecutions": [
                                        {
                                            "amount": {
                                                "original": {
                                                    "value": "43.75",
                                                    "currency": "USD"
                                                }
                                            },
                                            "state": "COMPLETED",
                                            "attemptedAt": "2024-01-17T12:00:00Z",
                                            "completedAt": "2024-01-17T12:05:00Z",
                                            "paymentMethod": {
                                                "paymentType": {
                                                    "__typename": "PayPal",
                                                    "code": "PAYPAL",
                                                    "descriptiveName": "PayPal Account",
                                                    "displayName": "PayPal"
                                                }
                                            }
                                        }
                                    ]
                                }
                            ]
                        }
                    ],
                    "cases": [
                        {
                            "caseId": "CASE-****-0****4",
                            "initiator": "BUYER",
                            "reason": {
                                "__typename": "UnableToReachAgreement",
                                "code": "UNABLE_TO_REACH_AGREEMENT",
                                "displayText": "Unable to reach agreement with seller"
                            },
                            "latestDecision": {
                                "decidedAt": "2024-01-18T15:30:00Z",
                                "decisionId": "DEC-001",
                                "inFavorOf": "BUYER",
                                "note": "Based on the evidence provided, the item was not as described",
                                "outcomes": [
                                    {
                                        "__typename": "RefundDecisionOutcome",
                                        "code": "REFUND_GRANTED",
                                        "displayText": "Full refund granted to buyer",
                                        "decisionAmount": {
                                            "original": {
                                                "value": "55.00",
                                                "currency": "USD"
                                            }
                                        }
                                    },
                                    {
                                        "__typename": "CreditSellerForRefundChargeDecisionOutcome",
                                        "code": "SELLER_CREDIT",
                                        "displayText": "Seller credited for return label cost",
                                        "decisionAmount": {
                                            "original": {
                                                "value": "8.50",
                                                "currency": "USD"
                                            }
                                        }
                                    }
                                ]
                            },
                            "decisionHistory": [
                                {
                                    "decidedAt": "2024-01-18T15:30:00Z",
                                    "decisionId": "DEC-***",
                                    "inFavorOf": "BUYER",
                                    "note": "Based on the evidence provided, the item was not as described",
                                    "outcomes": [
                                        {
                                            "__typename": "RefundDecisionOutcome",
                                            "code": "REFUND_GRANTED",
                                            "displayText": "Full refund granted to buyer",
                                            "decisionAmount": {
                                                "original": {
                                                    "value": "55.00",
                                                    "currency": "USD"
                                                }
                                            }
                                        },
                                        {
                                            "__typename": "CreditSellerForRefundChargeDecisionOutcome",
                                            "code": "SELLER_CREDIT",
                                            "displayText": "Seller credited for return label cost",
                                            "decisionAmount": {
                                                "original": {
                                                    "value": "8.50",
                                                    "currency": "USD"
                                                }
                                            }
                                        }
                                    ]
                                }
                            ],
                            "status": {
                                "__typename": "PostPurchaseCaseClosed",
                                "code": "CLOSED",
                                "displayText": "Case is closed"
                            }
                        }
                    ]
                }
            ],
            "pagination": {
                "nextCursor": "MTA6MTA6Q0x***************************************oxNzY5MDM5OTk5MDAw",
                "previousCursor": null
            }
        }
    }
}
```
