# declineReturn

**API:** Return
**Type:** GraphQL Mutation
**Endpoint:** `https://graphqlapi.ebay.com/graphql`
**Method:** Mutation
**Operation Name:** `declineReturn`

---

## Description

This sample **declineReturn** mutation declines a return request and includes a message.

---

## Request Payload

```graphql
mutation DeclineReturn($input: DeclineReturnInput!) {
  declineReturn(input: $input) {
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

        ... on SendMessageReturnAction {
          code
          displayText
        }
        ... on ApproveReturnAction {
          code
          displayText
        }
        ... on DeclineReturnAction {
          code
          displayText
        }
        ... on ProcessReturnRefundAction {
          code
          displayText
        }
        ... on NegotiateOnReturnAction {
          code
          displayText
        }
        ... on ProvideShipmentInfoReturnAction {
          code
          displayText
        }
        ... on ProvideRmaNumberReturnAction {
          code
          displayText
        }
        ... on RecordReturnReceivedAction {
          code
          displayText
        }
        ... on ReturnReferralAction {
          code
          displayText
          referralReasons {
            __typename

            ... on UnresponsiveTradingPartner {
              code
              displayText
            }
            ... on UnableToReachAgreement {
              code
              displayText
            }
            ... on RefundNotReceived {
              code
              displayText
            }
            ... on NoRefundForReturnShipping {
              code
              displayText
            }
            ... on ReturnedWrongItem {
              code
              displayText
            }
            ... on ReturnNotReceived {
              code
              displayText
            }
            ... on ReceivedEmptyBox {
              code
              displayText
            }
            ... on DamagedItemReturned {
              code
              displayText
            }
            ... on OtherReferralReason {
              code
              displayText
            }
          }
        }
      }
    }
    ... on DeclineReturnInputValidationError {
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
    "returnId": "50******66",
    "declinationNote": "Message for decline."
  }
}
```

---

## Response Sample

```json
{
  "data": {
    "declineReturn": {
      "__typename": "OrderReturn",
      "returnId": "50******66",
      "status": {
        "__typename": "ReturnDeclined",
        "code": "DECLINED",
        "displayText": "Return Declined"
      }
    }
  }
}
  

```
