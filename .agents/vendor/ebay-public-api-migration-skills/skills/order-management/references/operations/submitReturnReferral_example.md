# submitReturnReferral

**API:** Return
**Type:** GraphQL Mutation
**Endpoint:** `https://graphqlapi.ebay.com/graphql`
**Method:** Mutation
**Operation Name:** `submitReturnReferral`

---

## Description

This sample **submitReturnReferral** mutation submits an order return to eBay as a referral request (review request).

---

## Request Payload

```graphql
mutation SubmitReturnReferral($input: SubmitReturnReferralInput!) {
  submitReturnReferral(input: $input) {
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
    ... on SubmitReturnReferralInputValidationError {
      errorCode
      errorMessage
      violations {
        __typename
        code
        displayMessage
        ... on ReturnReferralReasonViolation {
          code
          displayMessage
          invalidReferralReason
          constraint {
            validReferralReasons {
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
    }
  }
}

# Variables

{
  "input": {
    "returnId": "EXAMPLE-RETURN-0010",
    "referralReasonCode": "DamagedItemReturned"
  }
}



```

---

## Response Sample

```json
{
  "data": {
    "submitReturnReferral": {
      "__typename": "OrderReturn",
      "returnId": "50******17",
      "status": {
        "__typename": "ReturnOpen",
        "code": "OPEN",
        "displayText": "Return Open"
      }
    }
  }
}
  



```
