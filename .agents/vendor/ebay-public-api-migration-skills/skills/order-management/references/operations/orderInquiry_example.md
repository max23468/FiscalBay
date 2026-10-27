# orderInquiry

**API:** Order Inquiry
**Type:** GraphQL Query
**Endpoint:** `https://graphqlapi.ebay.com/graphql`
**Method:** Query
**Operation Name:** `orderInquiry`

---

## Description

This sample **orderInquiry **query retrieves full details about a inquiry, such as its inquiry status, refund status, review/resolution flow, buyer/seller information, and shipment activity.

---

## Request Payload

```graphql
query GetItemNotReceivedInquiry {
  orderInquiry(input: { inquiryId: "5********6" }) {
    ... on OrderInquirySuccess {
      orderInquiry {
        ... on ItemNotReceivedInquiry {
          inquiryId
          status {
            ... on OrderInquiryOpen {
              code
              displayText
            }
            ... on OrderInquiryClosed {
              code
              displayText
            }
          }
          createdAt
          closedAt
          initiator
          responder
          inquirers
          lineItems {
            inquiryLineItemId
            quantity
          }
          sellerAvailableActions {
            respondByAction {
              respondAction {
                code
                displayText
              }
              responseDueAt
            }
            secondaryActions {
              code
              displayText
              ... on OrderInquiryRefundAction {
                code
                displayText
              }
              ... on OrderInquiryReferralAction {
                code
                displayText
                referralReasons {
                  ... on ConfirmedDelivery {
                    code
                    displayText
                  }
                  ... on BuyerConfirmedDelivery {
                    code
                    displayText
                  }
                  ... on RefundedBuyer {
                    code
                    displayText
                  }
                }
              }
            }
          }
          requestedInformation {
            ... on ShipmentTrackingInformationRequested {
              requester
              requestedAt
            }
            ... on SignatureConfirmationRequested {
              requester
              requestedAt
            }
          }
          providedInformation {
            submitter
            submittedAt
            submittedInformation {
              ... on OrderInquiryShipmentTracking {
                trackingNumber
                shippingCarrier {
                  carrierCode
                  unsupportedCarrierName
                }
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
          cases {
            caseId
            status {
              ... on PostPurchaseCaseOpen {
                code
                displayText
              }
              ... on PostPurchaseCaseClosed {
                code
                displayText
              }
            }
            initiator
            reason {
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
    ... on OrderInquiryNotFoundError {
      inquiryId
      errorCode
      errorMessage
    }
  }
}
```

---

## Response Sample

```json
{
    "data": {
        "orderInquiry": {
            "orderInquiry": {
                "inquiryId": "5********6",
                "status": {
                    "code": "OPEN",
                    "displayText": "Open"
                },
                "createdAt": "2025-11-12T17:14:21Z",
                "closedAt": null,
                "initiator": "BUYER",
                "responder": "SELLER",
                "inquirers": [
                    "BUYER"
                ],
                "lineItems": [
                    {
                        "inquiryLineItemId": "5********56-1",
                        "quantity": 1
                    }
                ],
                "sellerAvailableActions": {
                    "respondByAction": {
                        "respondAction": {
                            "code": "REFUND",
                            "displayText": "Issue Refund"
                        },
                        "responseDueAt": "2025-11-18T08:00:00Z"
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
                            "displayText": "Refer an inquiry to eBay",
                            "referralReasons": [
                                {},
                                {},
                                {}
                            ]
                        }
                    ]
                },
                "requestedInformation": [
                    {
                        "requester": "EBAY",
                        "requestedAt": "2025-11-12T17:14:21Z"
                    }
                ],
                "providedInformation": [],
                "cases": [],
                "refunds": []
            }
        }
    }
}
```
