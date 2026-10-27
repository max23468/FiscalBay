# ordersByIds

**API:** Order
**Type:** GraphQL Query
**Endpoint:** `https://graphqlapi.ebay.com/graphql`
**Method:** Query
**Operation Name:** `ordersByIds`

---

## Description

This sample **ordersByIds** query retrieves one or more orders by their unique IDs.

---

## Request Payload

```graphql
query mQ($input: OrdersByIdsInput!) {
  ordersByIds(input: $input) {
    ... on OrdersByIdsSuccess {
      orders {
        ...OrderField
      }
    }
    ... on OrdersByIdsPartialFailure {
      errorCode
      orders {
        ...OrderField
      }
      failures {
        ...FailureField
      }
    }
    ... on OrdersByIdsCompleteFailure {
      errorCode
      failures {
        ...FailureField
      }
    }
  }
}

fragment OrderField on Order {
  orderId
  placedAt
  logistics {
    fulfillmentPlan {
      planType
      logisticsPlanSteps {
        methodName {
          id
          displayName
        }
      }
    }
  }

  # buyer {
  #   username
  # }

  monetaryDetails {
    ...MonetaryFields
  }

  refunds {
    adjustmentId
    createdAt
    refund {
      refundId
    }
  }
}

fragment FailureField on OrdersByIdsError {
  inputOrderId
  errorCode
  displayMessage
}

fragment TotalFields on AmountSet {
  original {
    value
    currency
  }
  buyerAmount: exchangeScenario(scenario: BUYER_CURRENCY) {
    ... on ExchangeAmount {
      amount {
        value
        currency
      }
    }
  }

  # sellerAmount: exchangeScenario(scenario: SELLER_CURRENCY) {
  #   ... on ExchangeAmount {
  #     amount {
  #       value
  #       currency
  #     }
  #   }
  # }
}

fragment StateField on Labeled {
  __typename
  label
}

fragment MonetaryFields on MonetaryDetails {
  payerPlans {
    ...MonetaryPlanFields
  }
  payerExecution {
    ... on PayerMonetaryExecution {
      payerExecutions {
        state {
          ...StateField
        }
        payments {
          state {
            ...StateField
          }
          attemptedAt
          completedAt
          total {
            ...TotalFields
          }
          paymentMethod {
            paymentType {
              code
              displayName
              descriptiveName
            }
          }
          ... on PayerPaymentExecution {
            state {
              ...StateField
            }
            attemptedAt
            completedAt
            sourceAccount {
              ...AccountFields
            }
            total {
              ...TotalFields
            }
          }
        }
      }
      payerBalance {
        value
        currency
      }
      paidAmount {
        value
        currency
      }
      paidState {
        ...StateField
      }
    }
    ... on PayerMarkedPaid {
      markedAt
    }
  }

  payeePlans {
    ...MonetaryPlanFields
  }
  payeeExecution {
    ... on PayeeMonetaryExecution {
      payeeExecutions {
        state {
          ...StateField
        }
        payments {
          total {
            ...TotalFields
          }
          state {
            ...StateField
          }
          attemptedAt
          completedAt
        }
      }
      payeeBalance {
        value
        currency
      }
      receivedAmount {
        value
        currency
      }
      receivedState {
        label
        id
      }
    }
    ... on PayeeMarkedPaid {
      markedAt
    }
  }
}

fragment MonetaryPlanFields on MonetaryPlan {
  state {
    ...StateField
  }
  payments {
    total {
      ...TotalFields
    }
    scheduledFor
    paymentDeadline
    ... on PayerPaymentPlan {
      sourceAccount {
        ...AccountFields
      }
    }
    ... on PayeePaymentPlan {
      destinationAccount {
        ...AccountFields
      }
    }
  }
}

fragment AccountFields on FundAccount {
  __typename
  identifier
  domain
  ... on OrderTaxAccount {
    taxJurisdiction {
      provinceOrStateCode
    }
  }
}

# Variables
  
{
  "input": {
    "orderIds": [
      "27-1***2-2***1"
    ]
  }
}
```

---

## Response Sample

```json
{
    "data": {
        "ordersByIds": {
            "orders": [
                {
                    "orderId": "27-1***2-2***1",
                    "placedAt": "20**-01-06T19:45:41.494Z",
                    "logistics": {
                        "fulfillmentPlan": [
                            {
                                "planType": "SHIPPING",
                                "logisticsPlanSteps": [
                                    {
                                        "methodName": {
                                            "id": "USPSParcel",
                                            "displayName": "USPS Ground Advantage"
                                        }
                                    }
                                ]
                            }
                        ]
                    },
                    "monetaryDetails": {
                        "payerPlans": [],
                        "payerExecution": {
                            "payerExecutions": [
                                {
                                    "state": {
                                        "__typename": "PaymentsCompleted",
                                        "label": "Completed"
                                    },
                                    "payments": [
                                        {
                                            "state": {
                                                "__typename": "PaymentsCompleted",
                                                "label": "Completed"
                                            },
                                            "attemptedAt": "20**-01-06T19:45:41.494Z",
                                            "completedAt": "20**-01-06T19:45:47.172Z",
                                            "total": {
                                                "original": {
                                                    "value": 1.08,
                                                    "currency": "USD"
                                                },
                                                "buyerAmount": null
                                            },
                                            "paymentMethod": {
                                                "paymentType": {
                                                    "code": "APPLE_PAY",
                                                    "displayName": "Apple Pay",
                                                    "descriptiveName": "Pay using Apple Pay"
                                                }
                                            },
                                            "sourceAccount": {
                                                "__typename": "BuyerPaymentAccount",
                                                "identifier": "accountId:TW_53********73",
                                                "domain": "EBAY"
                                            }
                                        }
                                    ]
                                }
                            ],
                            "payerBalance": {
                                "value": 0.0,
                                "currency": "USD"
                            },
                            "paidAmount": {
                                "value": 1.08,
                                "currency": "USD"
                            },
                            "paidState": {
                                "__typename": "MonetaryExecutionPaymentState",
                                "label": "FUNDED"
                            }
                        },
                        "payeePlans": [],
                        "payeeExecution": {
                            "payeeExecutions": [],
                            "payeeBalance": null,
                            "receivedAmount": null,
                            "receivedState": null
                        }
                    },
                    "refunds": [
                        {
                            "adjustmentId": "27-1***37-4***5",
                            "createdAt": "20**-01-07T03:05:03.809Z",
                            "refund": {
                                "refundId": "27-1***37-4***5"
                            }
                        }
                    ]
                }
            ]
        }
    }
}
```
