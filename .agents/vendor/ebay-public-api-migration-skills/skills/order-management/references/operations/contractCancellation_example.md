# contractCancellation

**API:** Cancellation
**Type:** GraphQL 
**Endpoint:** `https://graphqlapi.ebay.com/graphql`
**Method:** 
**Operation Name:** `contractCancellation`

---

## Description

This sample **contractCancellation** query retrieves a contract cancellation for the specified cancellation ID.

---

## Request Payload

```graphql
query GetContractCancellation($cancellationId: ID!) {
  contractCancellation(input: { cancellationId: $cancellationId }) {
    __typename
    ... on ContractCancellationSuccess {
      contractCancellation {
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
        }
        requestedAt
        reason {
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
        ... on OrderCancellation {
          lineItems {
            __typename
          }
        }
      }
    }
    ... on ContractCancellationNotFoundError {
      errorCode
      errorMessage
      requestedContractCancellationId
    }
  }
}

# Variables
{
  "cancellationId": "5********0"
}
```

---

## Response Sample

```json
{
    "data": {
        "contractCancellation": {
            "__typename": "ContractCancellationSuccess",
            "contractCancellation": {
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
        }
    }
}
```
