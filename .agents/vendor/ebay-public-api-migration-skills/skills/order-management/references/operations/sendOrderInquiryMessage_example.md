# sendOrderInquiryMessage

**API:** Order Inquiry
**Type:** GraphQL Mutation
**Endpoint:** `https://graphqlapi.ebay.com/graphql`
**Method:** Mutation
**Operation Name:** `sendOrderInquiryMessage`

---

## Description

This sample **sendOrderInquiryMessage** mutation sends a message within the context of a specific order inquiry.

---

## Request Payload

```graphql
mutation SendOrderInquiryMessage($input: SendOrderInquiryMessageInput!) {
  sendOrderInquiryMessage(input: $input) {
    __typename

    ... on SendOrderInquiryMessageSuccess {
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
          requestedInformation {
            ... on ShipmentTrackingInformationRequested { requester requestedAt }
            ... on SignatureConfirmationRequested { requester requestedAt }
          }
          providedInformation {
            submitter
            submittedAt
            submittedInformation {
              __typename
              ... on OrderInquiryShipmentTracking {
                trackingNumber
                shippingCarrier { carrierCode unsupportedCarrierName }
              }
              ... on OrderInquirySignatureConfirmation {
                trackingNumber
                signatureConfirmationProof {
                  documentId
                  filenameExtension
                  documentName
                  uploadedAt
                }
              }
            }
          }
          cases { caseId status { __typename ... on PostPurchaseCaseOpen { code displayText } ... on PostPurchaseCaseClosed { code displayText } } reason { code displayText } }
          refunds { refundId }
        }
      }
    }

    ... on OrderInquiryNotFoundError {
      errorCode
      errorMessage
      inquiryId
    }

    ... on OrderInquiryActionNotPermittedError {
      errorCode
      errorMessage
      availableActions { code displayText }
    }

    ... on SendOrderInquiryMessageInputValidationError {
      errorCode
      errorMessage
      violations { code displayMessage }
    }
  }
}

# Variables
  
{
  "input": {
    "inquiryId": "5********3",
    "message": "Hi — I've provided the tracking info. Please confirm receipt or let me know if you need anything else."
  }
}


```

---

## Response Sample

```json
{
    "data": {
        "sendOrderInquiryMessage": {
            "__typename": "SendOrderInquiryMessageSuccess",
            "orderInquiry": {
                "inquiryId": "5018879973",
                "status": {
                    "__typename": "OrderInquiryOpen",
                    "code": "OPEN",
                    "displayText": "Open"
                },
                "createdAt": "2025-12-05T07:29:20Z",
                "closedAt": null,
                "initiator": "BUYER",
                "responder": "SELLER",
                "inquirers": [
                    "BUYER"
                ],
                "lineItems": [
                    {
                        "inquiryLineItemId": "5******3-1",
                        "quantity": 1,
                        "orderLineItem": {
                            "orderLineItemId": "1**********2"
                        }
                    }
                ],
                "sellerAvailableActions": {
                    "respondByAction": {
                        "respondAction": {
                            "code": "REFUND",
                            "displayText": "Issue Refund"
                        },
                        "responseDueAt": "2025-12-10T08:00:00Z"
                    },
                    "secondaryActions": [
                        {
                            "code": "PROVIDE_INFO",
                            "displayText": "Provide Information"
                        },
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
                "requestedInformation": [],
                "providedInformation": [
                    {
                        "submitter": "SELLER",
                        "submittedAt": "2025-12-09T16:53:09Z",
                        "submittedInformation": [
                            {
                                "__typename": "OrderInquiryShipmentTracking",
                                "trackingNumber": "1**********4",
                                "shippingCarrier": {
                                    "carrierCode": "UPS",
                                    "unsupportedCarrierName": null
                                }
                            }
                        ]
                    }
                ],
                "cases": [],
                "refunds": []
            }
        }
    }
}
```
