# itemCommitmentsByIds

**API:** Item Commitment
**Type:** GraphQL Query
**Endpoint:** `https://graphqlapi.ebay.com/graphql`
**Method:** Query
**Operation Name:** `itemCommitmentsByIds`

---

## Description

This sample **itemCommitmentsByIds** query retrieves detailed information on an authenticated user's item commitments.

---

## Request Payload

```graphql
query ItemCommitmentsByIds($input: ItemCommitmentsByIdsInput!) {
  itemCommitmentsByIds(input: $input) {
    ... on ItemCommitmentsByIdsSuccess {
      itemCommitments {
        itemCommitmentId
        state {
          ... on ItemCommitmentActive {
            label
            fundingState {
              ... on PaymentsNotStarted { label }
              ... on PaymentsInProgress { label }
              ... on PaymentsCompleted { label }
              ... on PaymentsFailure { label }
            }
            fulfillmentState {
              ... on FulfillmentNotStarted { label }
              ... on FulfillmentPartiallyStarted {
                label
                lineItemsStarted {
                  ... on ItemCommitment { itemCommitmentId }
                }
                lineItemsNotStarted {
                  ... on ItemCommitment { itemCommitmentId }
                }
              }
              ... on FulfillmentInProgress { label startedAt }
              ... on FulfillmentCompleted { label completedAt }
            }
            cancelState {
              ... on ContractCancelRequested { label requestedAt }
              ... on ContractCancelRejected { label rejectedAt reason }
              ... on ContractCancelPending { label startedAt }
              ... on ContractCancelCompleted { label completedAt refundOutcome }
            }
            returnState {
              ... on ItemCommitmentReturnRequested { label }
              ... on ItemCommitmentReturnClosed { label }
            }
          }
          ... on ItemCommitmentCancelled {
            label
            cancelledAt
            cancel: cancelState {
              ... on ContractCancelRequested { label requestedAt }
              ... on ContractCancelRejected { label rejectedAt reason }
              ... on ContractCancelPending { label startedAt }
              ... on ContractCancelCompleted { label completedAt refundOutcome }
            }
            reason
            cancelState {
              ... on ContractCancelRequested { label requestedAt }
              ... on ContractCancelRejected { label rejectedAt reason }
              ... on ContractCancelPending { label startedAt }
              ... on ContractCancelCompleted { label completedAt refundOutcome }
            }
          }
          ... on ItemCommitmentLocked { label }
          ... on ItemCommitmentCompleted { label }
          ... on ItemCommitmentAbandoned { label }
        }
        createdAt
        updatedAt
        committedMarketplace
        seller { legacyUserId dataAccessLevel }
        buyer { legacyUserId dataAccessLevel }
        totals {
          committedTotal { original { value currency } }
          deposit { original { value currency } }
        }
        autoPaymentScheduleDetails {
          autoPaymentRequired
          delayReason
          processingScheduledAt
          autoPaymentState {
            ... on AutoPaymentScheduled { label }
            ... on AutoPaymentFailed { label }
            ... on AutoPaymentCompleted { label }
          }
        }
        purchaseQuote { purchaseQuoteId }
        order { orderId }
        refunds { refundId }
        returns { returnId }
        cancellation { cancellationId }
        tags { sellerAcknowledged tags }
        lineItem {
          quantity
          purchaseFlow {
            ... on PurchaseFlowBuyItNow { label }
            ... on PurchaseFlowAuction { label }
            ... on PurchaseFlowCommitToBuy { label }
            ... on PurchaseFlowSellerInitiatedOffer { label }
            ... on PurchaseFlowBestOffer { label }
            ... on PurchaseFlowRequestTotal { label }
          }
          item { itemIdVersioned versionId }
          itemSku { sellerSku storeSku }
        }
      }
    }
    ... on ItemCommitmentsByIdsPartialFailure {
      errorCode
      errorMessage
      itemCommitments { itemCommitmentId }
      failures {
        inputItemCommitmentId
        errorCode
        displayMessage
        retryable
      }
    }
    ... on ItemCommitmentsByIdsCompleteFailure {
      errorCode
      errorMessage
      failures {
        inputItemCommitmentId
        errorCode
        displayMessage
        retryable
      }
    }
  }
}

# Variables

{
  "input": {
    "itemCommitmentIds": ["22-0**-0****79"]
  }
}
```

---

## Response Sample

```json
{
    "data": {
        "itemCommitmentsByIds": {
            "itemCommitments": [
                {
                    "itemCommitmentId": "22-0**-0****79",
                    "state": {
                        "label": "Active",
                        "fundingState": {
                            "label": "Not started"
                        },
                        "fulfillmentState": {
                            "label": "Not started"
                        },
                        "cancelState": null,
                        "returnState": null
                    },
                    "createdAt": "20**-01-13T22:31:56.000Z",
                    "updatedAt": "20**-01-14T22:47:04.000Z",
                    "committedMarketplace": "EBAY_US",
                    "totals": {
                        "committedTotal": {
                            "original": {
                                "value": 121,
                                "currency": "USD"
                            }
                        },
                        "deposit": null
                    },
                    "autoPaymentScheduleDetails": [],
                    "purchaseQuote": null,
                    "order": null,
                    "refunds": [],
                    "returns": [],
                    "cancellation": null,
                    "monetaryDetails": null,
                    "logistics": {
                        "fulfillmentPlan": null,
                        "fulfillmentExecution": [
                            {
                                "planType": "SHIPPING",
                                "fulfillmentState": {
                                    "label": "Not started"
                                },
                                "logisticsExecutionSteps": [
                                    {
                                        "methodName": {
                                            "displayName": "Shipping",
                                            "id": "Shipping"
                                        },
                                        "handler": null,
                                        "shipFrom": null,
                                        "shipTo": {
                                          "name": "Example Buyer",
                                            "type": {
                                                "displayName": "BUYER_SHIPPING_ADDRESS",
                                                "id": "BUYER_SHIPPING_ADDRESS"
                                            },
                                            "address": null
                                        },
                                        "estimate": null
                                    }
                                ]
                            }
                        ]
                    },
                    "tags": {
                        "sellerAcknowledged": false,
                        "tags": []
                    },
                    "itemCommitmentAddOnService": {
                        "fulfillment": null,
                        "motorPurchase": null,
                        "eBayVault": null,
                        "exports": null,
                        "globalShipping": null
                    },
                    "lineItem": {
                        "quantity": 1,
                        "purchaseFlow": null,
                        "item": {
                            "itemIdVersioned": "33********01-0",
                            "versionId": "1.0"
                        },
                        "itemSku": {
                            "sellerSku": null,
                            "storeSku": null
                        }
                    }
                }
            ]
        }
    }
}
```
