# createPurchaseQuoteCancellation

**API:** Cancellation
**Type:** GraphQL Mutation
**Endpoint:** `https://graphqlapi.ebay.com/graphql`
**Method:** Mutation
**Operation Name:** `createPurchaseQuoteCancellation`

---

## Description

This sample **createPurchaseQuoteCancellation** mutation cancels item commitments on a purchase quote for an out-of-stock item and does not automatically relist the item.

---

## Request Payload

```graphql
mutation CreatePurchaseQuoteCancellation($input: CreatePurchaseQuoteCancellationInput!) {
  createPurchaseQuoteCancellation(input: $input) {
    __typename
    ... on CreatePurchaseQuoteCancellationSuccess {
      purchaseQuoteCancellation {
        __typename
        cancellationId
        status {
          __typename
          code
          displayText
        }
      }
    }
    ... on PurchaseQuoteCancellationEligibilityError {
      errorCode
      errorMessage
      ineligibilityReasons {
        __typename
        code
        displayMessage
        purchaseQuoteId
        ... on PurchaseQuoteCancellationReasonNotAllowed {
          availableReasons {
            code
            displayText
          }
        }
      }
    }
    ... on PurchaseQuoteNotFoundError {
      errorCode
      errorMessage
      purchaseQuoteId
    }
  }
}

# Variables
{
  "input": {
    "purchaseQuoteId": "18-**-10****96",
    "contractCancellationReason": "OUT_OF_STOCK",
    "relistAllItems": false
  }
}
```

---

## Response Sample

```json
{
    "data": {
        "createPurchaseQuoteCancellation": {
            "__typename": "CreatePurchaseQuoteCancellationSuccess",
            "purchaseQuoteCancellation": {
                "__typename": "PurchaseQuoteCancellation",
                "cancellationId": "50******52",
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
