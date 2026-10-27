# submitOrderInquiryReferral

**API:** Order Inquiry
**Type:** GraphQL Mutation
**Endpoint:** `https://graphqlapi.ebay.com/graphql`
**Method:** Mutation
**Operation Name:** `submitOrderInquiryReferral`

---

## Description

This sample **submitOrderInquiryReferral** mutation submits an order inquiry to eBay as a referral request.

---

## Request Payload

```graphql
mutation SubmitOrderInquiryReferral($input: SubmitOrderInquiryReferralInput!) {
  submitOrderInquiryReferral(input: $input) {
    __typename

    # ✅ Success case
    ... on SubmitOrderInquiryReferralSuccess {
      orderInquiry {
        ... on ItemNotReceivedInquiry {
          inquiryId
          status {
            __typename
            ... on OrderInquiryOpen { code displayText }
            ... on OrderInquiryClosed { code displayText }
          }
          createdAt
          closedAt
          initiator
          responder
          inquirers
          lineItems {
            inquiryLineItemId
            quantity
            orderLineItem { orderLineItemId }
          }
          sellerAvailableActions {
            respondByAction {
              respondAction { code displayText }
              responseDueAt
            }
            secondaryActions {
              code
              displayText
            }
          }
          cases {
            caseId
            status {
              __typename
              ... on PostPurchaseCaseOpen { code displayText }
              ... on PostPurchaseCaseClosed { code displayText }
            }
            initiator
            reason { code displayText }
          }
          refunds { refundId }
        }
      }
    }

    # ❌ Error cases
    ... on OrderInquiryActionNotPermittedError {
      errorCode
      errorMessage
      availableActions {
        code
        displayText
      }
    }

    ... on OrderInquiryNotFoundError {
      inquiryId
      errorCode
      errorMessage
    }

    ... on SubmitOrderInquiryReferralInputValidationError {
      errorCode
      errorMessage
      violations {
        code
        displayMessage
      }
    }
  }
}

# Variables
  
{
  "input": {
    "inquiryId": "EXAMPLE-INQUIRY-0004",
    "referralReasonCode": "SELLER_CONFIRMED_SHIPMENT"
  }
}
```

---

## Response Sample

```json
{
    "data": {
        "submitOrderInquiryReferral": {
            "__typename": "SubmitOrderInquiryReferralSuccess",
            "orderInquiry": {
                "inquiryId": "EXAMPLE-INQUIRY-0004",
                "status": {
                    "__typename": "OrderInquiryOpen",
                    "code": "OPEN",
                    "displayText": "Open"
                },
                "createdAt": "2025-11-13T17:59:30Z",
                "closedAt": null,
                "initiator": "BUYER",
                "responder": "EBAY",
                "inquirers": [
                    "BUYER"
                ],
                "lineItems": [
                    {
                        "inquiryLineItemId": "EXAMPLE-INQUIRY-LINE-0013",
                        "quantity": 1,
                        "orderLineItem": {
                            "orderLineItemId": "EXAMPLE-ORDER-LINE-0012"
                        }
                    }
                ],
                "sellerAvailableActions": null,
                "cases": [
                    {
                        "caseId": "EXAMPLE-CASE-0002",
                        "status": {
                            "__typename": "PostPurchaseCaseOpen",
                            "code": "OPEN",
                            "displayText": "Case is open"
                        },
                        "initiator": "BUYER",
                        "reason": {
                            "code": "SELLER_CONFIRMED_SHIPMENT",
                            "displayText": "Seller confirms the shipment"
                        }
                    }
                ],
                "refunds": []
            }
        }
    }
}
```
