# recordReturnReceived

**API:** Return
**Type:** GraphQL Mutation
**Endpoint:** `https://graphqlapi.ebay.com/graphql`
**Method:** Mutation
**Operation Name:** `recordReturnReceived`

---

## Description

This sample **recordReturnReceived** mutation is an optional step to notify eBay that the returned item has been received.

---

## Request Payload

```graphql
mutation RecordReturnReceived($input: RecordReturnReceivedInput!) {
  recordReturnReceived(input: $input) {
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
  }
}

# Variables

{
"input": {
  "returnId": "53******26"
  }
}



```

---

## Response Sample

```json
{
    "data": {
        "recordReturnReceived": {
            "__typename": "OrderReturn",
            "returnId": "53******26",
            "status": {
                "__typename": "ReturnOpen",
                "code": "OPEN",
                "displayText": "Return Open"
            }
        }
    }
}
```
