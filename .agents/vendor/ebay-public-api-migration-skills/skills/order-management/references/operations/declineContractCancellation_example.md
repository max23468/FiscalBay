# declineContractCancellation

**API:** Cancellation
**Type:** GraphQL Mutation
**Endpoint:** `https://graphqlapi.ebay.com/graphql`
**Method:** Mutation
**Operation Name:** `declineContractCancellation`

---

## Description

This sample **declineContractCancellation** mutation declines a contract cancellation using an existing cancellation record and provides fulfillment details.

---

## Request Payload

```graphql
mutation DeclineContractCancellation($input: DeclineContractCancellationInput!) {
  declineContractCancellation(input: $input) {
    __typename
    ... on DeclineContractCancellationSuccess {
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
    ... on DeclineCancellationInputValidationError {
      errorCode
      errorMessage
      violations {
        __typename
        code
        displayMessage
        ... on CancellationTrackingNumberViolation {
          constraint {
            characterLimit {
              minLength
              maxLength
            }
          }
          exceededLength
          containsInvalidCharacters
        }
        ... on CancellationShippingCarrierCodeViolation {
          constraint {
            characterLimit {
              minLength
              maxLength
            }
          }
          exceededLength
          containsInvalidCharacters
        }
        ... on CancellationShippedDateViolation {
          constraint {
            fromDate
            toDate
          }
        }
      }
    }
  }
}

# Variables
{
  "input": {
    "cancellationId": "50******50",
    "fulfillmentDetails": {
      "trackingNumber": "1Z**************84",
      "shippingCarrierCode": "UPS",
      "shippedDate": "2025-11-23T10:00:00.000Z"
    }
  }
}
```

---

## Response Sample

```json
{
    "data": {
        "declineContractCancellation": {
            "__typename": "DeclineContractCancellationSuccess",
            "contractCancellation": {
                "__typename": "OrderCancellation",
                "cancellationId": "50******50",
                "status": {
                    "__typename": "ContractCancellationDeclined",
                    "code": "DECLINED",
                    "displayText": "Declined"
                }
            }
        }
    }
}
```
