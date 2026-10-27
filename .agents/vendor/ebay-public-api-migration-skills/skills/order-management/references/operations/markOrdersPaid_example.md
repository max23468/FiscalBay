# markOrdersPaid

**API:** Order
**Type:** GraphQL Mutation
**Endpoint:** `https://graphqlapi.ebay.com/graphql`
**Method:** Mutation
**Operation Name:** `markOrdersPaid`

---

## Description

This sample **markOrdersPaid** mutation marks specified orders as payment received.

---

## Request Payload

```graphql
mutation ($input:MarkOrdersPaidInput!){
  markOrdersPaid(input:$input) {
    ... on BusinessError {
      errorCode
      errorMessage
    }
    ... on MarkOrdersPaidSuccess {
      markPaidOrders {
        ... orderFields
      }
    }
    ... on MarkOrdersPaidPartialFailure {
      markPaidOrders {
        ... orderFields
      }
      failures {
        ... failureFields
      }
    }
    ... on MarkOrdersPaidCompleteFailure {
      failures {
        ... failureFields
      }
    }
  }
}
fragment failureFields on UpdateOrderError {
  inputOrderId
  errorCode
}
fragment orderFields on Order {
  orderId
  orderState {
    ... on Labeled {
      ... labelFields
    }
    ... on OrderConfirmed {
      fundingState {
        ... labelFields
      }
    }
  }
}
fragment labelFields on Labeled {
  __typename
  label
} 

# Variables
{
  "input": {
    "orderIds":[
      "19-0***8-2***5","1**4"
    ]
  }
} 
```

---

## Response Sample

```json
{
    "data": {
        "markOrdersPaid": {
            "errorCode": "MARK_ORDERS_PAID_PARTIAL_FAILURE",
            "errorMessage": "Some orders could not be marked paid. Succeed orders are displayed.",
            "markPaidOrders": [
                {
                    "orderId": "19-0***8-2***5",
                    "orderState": {
                        "__typename": "OrderConfirmed",
                        "label": "Confirmed",
                        "fundingState": {
                            "__typename": "PaymentsCompleted",
                            "label": "Completed"
                        }
                    }
                }
            ],
            "failures": [
                {
                    "inputOrderId": "1**4",
                    "errorCode": "NOT_AUTHORIZED"
                }
            ]
        }
    }
}
```
