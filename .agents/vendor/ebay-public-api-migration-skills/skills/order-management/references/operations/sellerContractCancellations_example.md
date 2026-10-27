# sellerContractCancellations

**API:** Cancellation
**Type:** GraphQL Query
**Endpoint:** `https://graphqlapi.ebay.com/graphql`
**Method:** Query
**Operation Name:** `sellerContractCancellations`

---

## Description

This sample **sellerContractCancellations** query retrieves a seller's completed contract cancellations sorted by request date.

---

## Request Payload

```graphql
query SellerContractCancellations($input: SellerContractCancellationsInput!) {
  sellerContractCancellations(input: $input) {
    __typename
    ... on SellerContractCancellationsSuccess {
      contractCancellations {
        __typename
        cancellationId
        lineItems {
          __typename
          cancellationLineItemId
          requestedQuantity
          cancelledQuantity
          listingRestockTasks {
            __typename
            ... on PostPurchaseListingRelistTask {
              relistStatus {
                __typename
                code
                displayText
              }
              relistedListing {
                listingId
              }
            }
          }
          ... on OrderCancellationLineItem {
            orderLineItem {
              orderLineItemId
            }
          }
          ... on PurchaseQuoteCancellationLineItem {
            purchaseQuoteLineItem {
              purchaseQuoteLineItemId
            }
          }
        }
        requestedAt
        reason {
          __typename
          code
          displayText
        }
        requesterNote
        requester
        status {
          __typename
          code
          displayText
        }
        closedAt
        refunds {
          refundId
        }
        sellerAvailableActions {
          primaryActions {
            __typename
            code
            displayText
          }
          responseDueAt
        }
        ... on ItemCommitmentCancellation {
          itemCommitment {
            itemCommitmentId
          }
        }
        ... on PurchaseQuoteCancellation {
          purchaseQuote {
            purchaseQuoteId
          }
        }
      }
      pagination {
        nextCursor
        previousCursor
      }
    }
    ... on ContractCancellationInvalidDateRangeError {
      errorCode
      errorMessage
    }
    ... on ContractCancellationInvalidPageSizeError {
      errorCode
      errorMessage
      maxAllowedPageSize
    }
    ... on ContractCancellationInvalidSearchInputError {
      errorCode
      errorMessage
    }
  }
}

# Variables
{
  "input": {
    "initialPage": {
      "filter": {
        "statuses": ["COMPLETED"],
        "createdBetween": {
          "startDateTime": "2024-11-10T00:00:00.000Z",
          "endDateTime": "2025-12-31T23:59:59.999Z"
        }
      },
      "sort": {
        "sortField": "REQUESTED_AT",
        "sortOrder": "ASC"
      }
    }
  }
}
```

---

## Response Sample

```json
{
    "data": {
        "sellerContractCancellations": {
            "__typename": "SellerContractCancellationsSuccess",
            "contractCancellations": [
                {
                    "__typename": "OrderCancellation",
                    "cancellationId": "50*****648",
                    "lineItems": [
                        {
                            "__typename": "OrderCancellationLineItem",
                            "cancellationLineItemId": "50******49",
                            "requestedQuantity": 1,
                            "cancelledQuantity": 1,
                            "orderLineItem": {
                                "orderLineItemId": "10*************08"
                            }
                        }
                    ],
                    "requestedAt": "2025-11-13T12:33:48.000Z",
                    "reason": {
                        "__typename": "OutOfStockCancellation",
                        "code": "OUT_OF_STOCK",
                        "displayText": "Out of stock"
                    },
                    "requester": "SELLER",
                    "status": {
                        "__typename": "ContractCancellationCompleted",
                        "code": "COMPLETED",
                        "displayText": "Completed"
                    },
                    "closedAt": "2025-11-13T13:06:15.000Z",
                    "refunds": [
                        {
                            "refundId": "03-******-**14"
                        }
                    ]
                },
                {
                    "__typename": "OrderCancellation",
                    "cancellationId": "50******50",
                    "lineItems": [
                        {
                            "__typename": "OrderCancellationLineItem",
                            "cancellationLineItemId": "50******82",
                            "requestedQuantity": 1,
                            "cancelledQuantity": 1,
                            "listingRestockTasks": [
                                {
                                    "__typename": "PostPurchaseListingRelistTask",
                                    "relistStatus": {
                                        "__typename": "PostPurchaseRelistTaskCompleted",
                                        "code": "COMPLETED",
                                        "displayText": "Relist Task Completed"
                                    },
                                    "relistedListing": {
                                        "listingId": "12********41"
                                    }
                                }
                            ],
                            "orderLineItem": {
                                "orderLineItemId": "10*************03"
                            }
                        }
                    ],
                    "requestedAt": "2025-11-23T11:38:21.000Z",
                    "reason": {
                        "__typename": "BuyerRequestedCancellation",
                        "code": "BUYER_REQUESTED",
                        "displayText": "Buyer requested cancellation"
                    },
                    "requester": "SELLER",
                    "status": {
                        "__typename": "ContractCancellationCompleted",
                        "code": "COMPLETED",
                        "displayText": "Completed"
                    },
                    "closedAt": "2025-11-23T11:49:17.000Z",
                    "refunds": [
                        {
                            "refundId": "21-******-**78"
                        }
                    ]
                }
            ],
            "pagination": {
                "nextCursor": "eyJvZmZTZXQiO*********LCJzb3J0T3JkZXIiOiJBU0MifX0="
            }
        }
    }
}
```
