# sendReturnMessage

**API:** Return
**Type:** GraphQL Mutation
**Endpoint:** `https://graphqlapi.ebay.com/graphql`
**Method:** Mutation
**Operation Name:** `sendReturnMessage`

---

## Description

This sample **sendReturnMessage** mutation sends a message to a return conversation.

---

## Request Payload

```graphql
mutation SendReturnMessage($input: SendReturnMessageInput!) {
  sendReturnMessage(input: $input) {
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
    ... on SendReturnMessageInputValidationError {
      errorCode
      errorMessage
      violations {
        __typename
        code
        displayMessage
        ... on ReturnNoteViolation {
          code
          displayMessage
          exceededLength
          constraint {
            characterLimit {
              minLength
              maxLength
            }
          }
        }
      }
    }
  }
}


# Variables

{
  "input": {
    "returnId": "EXAMPLE-RETURN-0009",
    "message": "We are looking into your request."
  }
}



```

---

## Response Sample

```json
{
    "data": {
        "sendReturnMessage": {
            "__typename": "OrderReturn",
            "returnId": "EXAMPLE-RETURN-0009",
            "status": {
                "__typename": "ReturnRequested",
                "code": "REQUESTED",
                "displayText": "Return Requested"
            }
        }
    }
}
```
