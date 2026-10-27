# proposeKeepItemWithPartialRefund

**API:** Return
**Type:** GraphQL Mutation
**Endpoint:** `https://graphqlapi.ebay.com/graphql`
**Method:** Mutation
**Operation Name:** `proposeKeepItemWithPartialRefund`

---

## Description

This sample **proposeKeepItemWithPartialRefund** mutation proposes a keep-item-with-partial-refund offer on one or more items in an existing return.

---

## Request Payload

```graphql
mutation ProposeKeepItemWithPartialRefund($input: ProposeKeepItemWithPartialRefundInput!) {
  proposeKeepItemWithPartialRefund(input: $input) {
    __typename
    ... on OrderReturn {
      returnId
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
    }
    ... on ReturnNotFoundError {
      errorCode
      errorMessage
      requestedReturnId
    }
    ... on ReturnActionNotPermittedError {
      errorCode
      errorMessage
      availableActions {
        __typename
        code
        displayText
      }
    }
    ... on ReturnLineItemNotFoundError {
      errorCode
      errorMessage
      requestedLineItemIds
    }
    ... on ReturnRefundTermsRequiredError {
      errorCode
      errorMessage
    }
    ... on MultipleRefundTermsNotAllowedError {
      errorCode
      errorMessage
      maxAllowed
      providedCount
    }
    ... on ProposeKeepItemWithPartialRefundInputValidationError {
      errorCode
      errorMessage
      violations {
        __typename
        code
        displayMessage
        ... on PartialRefundItemPriceViolation {
          code
          displayMessage
          constraint {
            allowedPercentageRange {
              minValue
              maxValue
            }
          }
        }
        ... on ShippingPriceWaiverViolation {
          code
          displayMessage
        }
      }
    }
  }
}

# Variables

{
    "input": {
        "returnId": "5********1",
        "keepItemPartialRefundTerms": [
            {
                "returnLineItemId": "5********6",
                "itemPriceRefundPercentage": 90,
                "itemShippingPriceWaived": false
            }
        ]
    }
}
```

---

## Response Sample

```json
{
    "data": {
        "proposeKeepItemWithPartialRefund": {
            "__typename": "OrderReturn",
            "returnId": "5********1",
            "status": {
                "__typename": "ReturnOpen",
                "code": "OPEN",
                "displayText": "Return Open"
            },
            "returnNegotiation": {
                "latestReturnOffer": {
                    "status": {
                        "__typename": "ReturnOfferPending",
                        "code": "PENDING",
                        "displayText": "Offer Pending"
                    },
                    "proposedTerm": [
                        {
                            "__typename": "KeepItemPartialRefundTerm",
                            "refundAmount": {
                                "original": {
                                    "value": 14.85,
                                    "currency": "USD"
                                },
                                "exchangeScenario": null
                            },
                            "itemPriceRefundPercentage": 99,
                            "itemShippingPriceWaived": false,
                            "returnLineItem": {
                                "returnLineItemId": "5********6",
                                "requestedQuantity": 1,
                                "returnReason": {
                                    "code": "DAMAGED_ITEM_RECEIVED",
                                    "displayText": "Damaged item received"
                                },
                                "returnNote": "test user snad return",
                                "orderLineItem": {
                                    "orderLineItemId": "1********3"
                                }
                            }
                        }
                    ]
                }
            }
        }
    }
}
```
