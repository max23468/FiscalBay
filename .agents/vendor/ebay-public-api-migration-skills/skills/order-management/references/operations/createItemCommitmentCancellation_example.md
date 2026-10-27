# createItemCommitmentCancellation

**API:** Cancellation
**Type:** GraphQL Mutation
**Endpoint:** `https://graphqlapi.ebay.com/graphql`
**Method:** Mutation
**Operation Name:** `createItemCommitmentCancellation`

---

## Description

This sample **createItemCommitmentCancellation **mutation creates a cancellation on an item commitment for an out of stock item and does not automatically relist the item.

---

## Request Payload

```graphql
mutation CreateItemCommitmentCancellation($input: CreateItemCommitmentCancellationInput!) {
  createItemCommitmentCancellation(input: $input) {
    __typename
    ... on CreateItemCommitmentCancellationSuccess {
      itemCommitmentCancellation {
        __typename
        cancellationId
        status {
          __typename
          code
          displayText
        }
      }
    }
    ... on ItemCommitmentCancellationEligibilityError {
      errorCode
      errorMessage
      ineligibilityReasons {
        __typename
        code
        displayMessage
        itemCommitmentId
        ... on ItemCommitmentCancellationReasonNotAllowed {
          availableReasons {
            code
            displayText
          }
        }
      }
    }
    ... on ItemCommitmentNotFoundError {
      errorCode
      errorMessage
      itemCommitmentId
    }
  }
}

# Variables
{
  "input": {
    "itemCommitmentId": "05-***-02***23",
    "contractCancellationReason": "OUT_OF_STOCK",
    "relistItem": false
  }
}
```

---

## Response Sample

```json
{
    "data": {
        "createItemCommitmentCancellation": {
            "__typename": "CreateItemCommitmentCancellationSuccess",
            "itemCommitmentCancellation": {
                "__typename": "ItemCommitmentCancellation",
                "cancellationId": "50******51",
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
