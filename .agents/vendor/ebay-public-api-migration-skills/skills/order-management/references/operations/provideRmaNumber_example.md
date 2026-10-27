# provideRmaNumber

**API:** Return
**Type:** GraphQL Mutation
**Endpoint:** `https://graphqlapi.ebay.com/graphql`
**Method:** Mutation
**Operation Name:** `provideRmaNumber`

---

## Description

This sample **provideRmaNumber** mutation supplies the Return Merchandise Authorization (RMA) number for a return and waives the RMA requirement.

---

## Request Payload

```graphql
mutation ProvideRmaNumber($input: ProvideRmaNumberInput!) {
  provideRmaNumber(input: $input) {
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
    ... on ProvideRmaNumberInputValidationError {
      errorCode
      errorMessage
      violations {
        __typename
        code
        displayMessage
        ... on ReturnRmaNumberViolation {
          code
          displayMessage
          containsInvalidCharacters
          exceededLength
          constraint {
            rmaNumberRequired
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
    "returnId": "50******77",
    "rmaNumber": "56***********86",
    "rmaRequirementWaived": false
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
            "returnId": "50******77",
            "status": {
                "__typename": "ReturnOpen",
                "code": "OPEN",
                "displayText": "Return Open"
            }
        }
    }
}
```
