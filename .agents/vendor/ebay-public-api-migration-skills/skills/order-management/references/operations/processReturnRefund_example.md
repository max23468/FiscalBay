# processReturnRefund

**API:** Return
**Type:** GraphQL Mutation
**Endpoint:** `https://graphqlapi.ebay.com/graphql`
**Method:** Mutation
**Operation Name:** `processReturnRefund`

---

## Description

This sample **processReturnRefund** mutation allows sellers to process a refund for a return in accordance with the applicable refund policy.

---

## Request Payload

```graphql
mutation ProcessReturnRefund($input: ProcessReturnRefundInput!) {
  processReturnRefund(input: $input) {
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
    ... on MultipleRefundWithholdingsNotAllowedError {
      errorCode
      errorMessage
      maxAllowed
      providedCount
    }
    ... on ProcessReturnRefundInputValidationError {
      errorCode
      errorMessage
      violations {
        __typename
        code
        displayMessage
        ... on ItemPriceRefundWithholdViolation {
          code
          displayMessage
          constraint {
            allowedPercentageRange {
              minValue
              maxValue
            }
          }
        }
        ... on ShippingPriceRefundWithholdViolation {
          code
          displayMessage
        }
      }
    }
    ... on RefundProcessingError {
      errorCode
      errorMessage
    }
    ... on RefundInstrumentInvalidError {
      errorCode
      errorMessage
    }
    ... on RefundInstrumentInsufficientFundsError {
      errorCode
      errorMessage
    }
    ... on RefundInstrumentDeclinedError {
      errorCode
      errorMessage
    }
    ... on RefundBlockedByPaymentDisputeError {
      errorCode
      errorMessage
    }
    ... on RefundAuthorizationFailedError {
      errorCode
      errorMessage
    }
  }
}
# Variables

{
  "input": {
    "returnId": "5********1"
  }
}

```

---

## Response Sample

```json
{
  "data": {
    "processReturnRefund": {
      "__typename": "OrderReturn",
      "refunds": [
        {
          "__typename": "Refund",
          "refundId": "1********0"
        }
      ],
      "returnId": "5********1",
      "status": {
        "__typename": "ReturnOpen",
        "code": "OPEN",
        "displayText": "Return Open"
      }
    }
  }
}
  
```
