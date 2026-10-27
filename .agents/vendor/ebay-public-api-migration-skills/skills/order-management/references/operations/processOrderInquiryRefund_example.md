# processOrderInquiryRefund

**API:** Order Inquiry
**Type:** GraphQL Mutation
**Endpoint:** `https://graphqlapi.ebay.com/graphql`
**Method:** Mutation
**Operation Name:** `processOrderInquiryRefund`

---

## Description

This sample **processOrderInquiryRefund **mutation issues a full refund for an open inquiry, specified by its inquiryId.

---

## Request Payload

```graphql
mutation ProcessOrderInquiryRefund($input: ProcessOrderInquiryRefundInput!) {
  processOrderInquiryRefund(input: $input) {
    __typename

    ... on ProcessOrderInquiryRefundSuccess {
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
          refunds {
            refundId
          }
        }
      }
    }

    ... on OrderInquiryActionNotPermittedError {
      errorCode
      errorMessage
      availableActions {
        code
        displayText
      }
    }

    ... on OrderInquiryNotFoundError {
      errorCode
      errorMessage
      inquiryId
    }

    ... on RefundAuthorizationFailedError {
      errorCode
      errorMessage
    }

    ... on RefundBlockedByPaymentDisputeError {
      errorCode
      errorMessage
    }

    ... on RefundInstrumentDeclinedError {
      errorCode
      errorMessage
    }

    ... on RefundInstrumentInsufficientFundsError {
      errorCode
      errorMessage
    }

    ... on RefundInstrumentInvalidError {
      errorCode
      errorMessage
    }

    ... on RefundProcessingError {
      errorCode
      errorMessage
    }
  }
}

# Variables
  
{
  "input": {
    "inquiryId": "5********5"
  }
}

```

---

## Response Sample

```json
{
    "data": {
        "processOrderInquiryRefund": {
            "__typename": "ProcessOrderInquiryRefundSuccess",
            "orderInquiry": {
                "inquiryId": "5********5",
                "status": {
                    "__typename": "OrderInquiryOpen",
                    "code": "OPEN",
                    "displayText": "Open"
                },
                "createdAt": "2025-11-13T14:59:17Z",
                "closedAt": null,
                "initiator": "BUYER",
                "responder": "SELLER",
                "inquirers": [
                    "BUYER"
                ],
                "lineItems": [
                    {
                        "inquiryLineItemId": "5********5-1",
                        "quantity": 1,
                        "orderLineItem": {
                            "orderLineItemId": "1********3"
                        }
                    }
                ],
                "sellerAvailableActions": {
                    "respondByAction": null,
                    "secondaryActions": [
                        {
                            "code": "SEND_MESSAGE",
                            "displayText": "Send Message"
                        },
                        {
                            "code": "REFER_INQUIRY_TO_EBAY",
                            "displayText": "Refer an inquiry to eBay"
                        }
                    ]
                },
                "refunds": []
            }
        }
    }
}
```
