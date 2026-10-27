# provideShipmentInfoForItemNotReceivedInquiry

**API:** Order Inquiry
**Type:** GraphQL Mutation
**Endpoint:** `https://graphqlapi.ebay.com/graphql`
**Method:** Mutation
**Operation Name:** `provideShipmentInfoForItemNotReceivedInquiry`

---

## Description

This sample **provideShipmentInfoForItemNotReceivedInquiry** mutation provides shipment-related information in response to an Item Not Received inquiry.

---

## Request Payload

```graphql
mutation ProvideShipmentInfoForItemNotReceivedInquiry($input: ProvideShipmentInfoForItemNotReceivedInquiryInput!) {
  provideShipmentInfoForItemNotReceivedInquiry(input: $input) {
    __typename

    ... on ProvideShipmentInfoForItemNotReceivedInquirySuccess {
      orderInquiry {
        ... on ItemNotReceivedInquiry {
          inquiryId
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
        }
      }
    }

    ... on OrderInquiryActionNotPermittedError {
      errorCode
      errorMessage
      availableActions { code displayText }
    }

    ... on OrderInquiryNotFoundError {
      errorCode
      errorMessage
      inquiryId
    }

    ... on ProvideShipmentInfoForInquiryInputValidationError {
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
    "trackings": [
      {
        "trackingNumber": "1********4",
        "shippingCarrier": {
          "carrierCode": "UPS"
        }
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
        "provideShipmentInfoForItemNotReceivedInquiry": {
            "__typename": "ProvideShipmentInfoForItemNotReceivedInquirySuccess",
            "orderInquiry": {
                "inquiryId": "5********3",
                "providedInformation": [
                    {
                        "submitter": "SELLER",
                        "submittedAt": "2025-12-09T16:53:09Z",
                        "submittedInformation": [
                            {
                                "__typename": "OrderInquiryShipmentTracking",
                                "trackingNumber": "1********4",
                                "shippingCarrier": {
                                    "carrierCode": "UPS",
                                    "unsupportedCarrierName": null
                                }
                            }
                        ]
                    }
                ]
            }
        }
    }
}
```
