# recordReturnLabelSentOffline

**API:** Return
**Type:** GraphQL Mutation
**Endpoint:** `https://graphqlapi.ebay.com/graphql`
**Method:** Mutation
**Operation Name:** `recordReturnLabelSentOffline`

---

## Description

This sample **recordReturnLabelSentOffline** mutation records that a return shipment label has been sent to the buyer for the specified return and includes tracing information.

---

## Request Payload

```graphql
mutation RecordReturnLabelSentOffline($input: RecordReturnLabelSentOfflineInput!) {
  recordReturnLabelSentOffline(input: $input) {
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
    ... on RecordReturnLabelSentOfflineInputValidationError {
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
    "returnId": "50******27",
    "offlineReturnLabelChannel": "COMMUNICATED_TO_BUYER",
    "trackings": [
      {
        "shippingCarrier": {
          "carrierCode": "USPS",
          "unsupportedCarrierName": null
        },
        "trackingNumber": "M*********90",
        "labelSentAt": "2025-11-10T12:34:56Z"
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
    "recordReturnLabelSentOffline": {
      "__typename": "OrderReturn",
      "returnId": "50******27",
      "status": {
        "__typename": "ReturnOpen",
        "code": "OPEN",
        "displayText": "Return Open"
      }
    }
  }
}
  

```
