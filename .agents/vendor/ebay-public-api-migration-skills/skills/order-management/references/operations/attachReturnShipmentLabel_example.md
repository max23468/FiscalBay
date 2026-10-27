# attachReturnShipmentLabel

**API:** Return
**Type:** GraphQL Mutation
**Endpoint:** `https://graphqlapi.ebay.com/graphql`
**Method:** Mutation
**Operation Name:** `attachReturnShipmentLabel`

---

## Description

This sample **attachReturnShipmentLabel** mutation attaches a return shipment label to the specified return and includes return shippment label information.

---

## Request Payload

```graphql
mutation AttachReturnShipmentLabel($input: AttachReturnShipmentLabelInput!) {
  attachReturnShipmentLabel(input: $input) {
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
    ... on ReturnShipmentLabelNotFoundError {
      errorCode
      errorMessage
      requestedDocumentId
    }
    ... on MultipleReturnLabelsNotSupportedError {
      errorCode
      errorMessage
    }
    ... on ReturnShippingLabelRequiredError {
      errorCode
      errorMessage
    }
    ... on AttachReturnShipmentLabelInputValidationError {
      errorCode
      errorMessage
      violations {
        __typename
        code
        displayMessage
        ... on ReturnTrackingNumberViolation {
          code
          displayMessage
          containsInvalidCharacters
          exceededLength
          duplicateTrackingNumber
          constraint {
            characterLimit {
              minLength
              maxLength
            }
          }
        }
        ... on ReturnShippingCarrierNameViolation {
          code
          displayMessage
          containsInvalidCharacters
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
    "returnId": "50******48",
    "returnShipmentLabels": [
      {
        "documentId": "50******78",
        "shippingCarrier": {
          "carrierCode": "FEDEX",
          "unsupportedCarrierName": null
        },
        "trackingNumber": "F***********9"
      }
    ]
  }
}



```

---

## Response Sample

```json
{
  "data": {
    "attachReturnShipmentLabel": {
      "__typename": "OrderReturn",
      "returnId": "50******48",
      "status": {
        "__typename": "ReturnOpen",
        "code": "OPEN",
        "displayText": "Return Open"
      }
    }
  }
}
  

```
