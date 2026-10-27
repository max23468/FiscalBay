# createOrderCancellation

**API:** Cancellation
**Type:** GraphQL Mutation
**Endpoint:** `https://graphqlapi.ebay.com/graphql`
**Method:** Mutation
**Operation Name:** `createOrderCancellation`

---

## Description

This sample **createOrderCancellation** mutation creates a cancellation on an order for an out of stock item and does not automatically relist the item.

---

## Request Payload

```graphql
mutation CreateOrderCancellation($input: CreateOrderCancellationInput!) {
  createOrderCancellation(input: $input) {
    __typename
    ... on CreateOrderCancellationSuccess {
      orderCancellation {
        __typename
        cancellationId
        status {
          __typename
          code
          displayText
        }
      }
    }
    ... on OrderCancellationEligibilityError {
      errorCode
      errorMessage
      ineligibilityReasons {
        __typename
        code
        displayMessage
        orderId
        ... on OrderCancellationReasonNotAllowed {
          availableReasons {
            code
            displayText
          }
        }
      }
    }
    ... on OrderLineItemCancellationEligibilityError {
      errorCode
      errorMessage
      ineligibilityReasons {
        __typename
        code
        displayMessage
        orderLineItemIds
      }
    }
    ... on OrderNotFoundError {
      errorCode
      errorMessage
      orderId
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
    "orderId": "12*****89",
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
        "createOrderCancellation": {
            "__typename": "CreateOrderCancellationSuccess",
            "orderCancellation": {
                "__typename": "OrderCancellation",
                "cancellationId": "50******50",
                "status": {
                    "__typename": "ContractCancellationPending",
                    "code": "PENDING",
                    "displayText": "Pending"
                }
            }
        }
    }
}
```
