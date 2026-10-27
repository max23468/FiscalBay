# approveContractCancellation

**API:** Cancellation
**Type:** GraphQL Mutation
**Endpoint:** `https://graphqlapi.ebay.com/graphql`
**Method:** Mutation
**Operation Name:** `approveContractCancellation`

---

## Description

This sample **approveContractCancellation **mutation approves a contract cancellation using an existing cancellation record and does not automatically relist the item.

---

## Request Payload

```graphql
mutation ApproveContractCancellation($input: ApproveContractCancellationInput!) {
  approveContractCancellation(input: $input) {
    __typename
    ... on ApproveContractCancellationSuccess {
      contractCancellation {
        __typename
        cancellationId
        status {
          __typename
          code
          displayText
        }
      }
    }
    ... on ContractCancellationActionNotPermittedError {
      errorCode
      errorMessage
      availableActions {
        __typename
        code
        displayText
      }
    }
    ... on ContractCancellationNotFoundError {
      errorCode
      errorMessage
      requestedContractCancellationId
    }
    ... on RefundAuthorizationFailedError {
      errorCode
      errorMessage
    }
    ... on RefundBlockedByPaymentDisputeError {
      errorCode
      errorMessage
    }
    ... on RefundInstrumentDeclinedError {
      errorCode
      errorMessage
    }
    ... on RefundInstrumentInsufficientFundsError {
      errorCode
      errorMessage
    }
    ... on RefundInstrumentInvalidError {
      errorCode
      errorMessage
    }
    ... on RefundProcessingError {
      errorCode
      errorMessage
    }
  }
}

# Variables
{
  "input": {
    "cancellationId": "50******50",
    "relistAllItems": false
  }
}
```

---

## Response Sample

```json
{
    "data": {
        "approveContractCancellation": {
            "__typename": "ApproveContractCancellationSuccess",
            "contractCancellation": {
                "__typename": "OrderCancellation",
                "cancellationId": "50******50",
                "status": {
                    "__typename": "ContractCancellationCompleted",
                    "code": "COMPLETED",
                    "displayText": "Completed"
                }
            }
        }
    }
}
```
