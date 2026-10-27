# approveReturn

**API:** Return
**Type:** GraphQL Mutation
**Endpoint:** `https://graphqlapi.ebay.com/graphql`
**Method:** Mutation
**Operation Name:** `approveReturn`

---

## Description

This sample **approveReturn** mutation allows a seller to approve a return request.

---

## Request Payload

```graphql
mutation ApproveReturn($input: ApproveReturnInput!) {
  approveReturn(input: $input) {
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
    ... on ApproveReturnInputValidationError {
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
  
"input": {
  "returnId": "50******30",
  "approvalNote": "Test approval note from graphql"
  }
}


```

---

## Response Sample

```json
{
  "data": {
    "approveReturn": {
      "__typename": "OrderReturn",
      "returnId": "50******30",
      "status": {
        "__typename": "ReturnOpen",
        "code": "OPEN",
        "displayText": "Return Open"
      }
    }
  }
}
  

```
