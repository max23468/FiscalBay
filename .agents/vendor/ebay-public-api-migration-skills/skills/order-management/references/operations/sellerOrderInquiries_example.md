# sellerOrderInquiries

**API:** Order Inquiry
**Type:** GraphQL Query
**Endpoint:** `https://graphqlapi.ebay.com/graphql`
**Method:** Query
**Operation Name:** `sellerOrderInquiries`

---

## Description

This sample **sellerOrderInquiries** query searches and returns a list of order inquiries based on specific criteria.

---

## Request Payload

```graphql
query SellerOrderInquiries($input: SellerOrderInquiriesInput!) {
  sellerOrderInquiries(input: $input) {
    __typename

    ... on SellerOrderInquiries {
      orderInquiries {
        __typename
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
        }
      }
      pagination {
        nextCursor
        previousCursor
      }
    }

    ... on OrderInquiryInvalidDateRangeError {
      errorCode
      errorMessage
    }

    ... on OrderInquiryInvalidPageSizeError {
      errorCode
      errorMessage
      maxAllowedPageSize
      minAllowedPageSize
      requestedPageSize
    }

    ... on OrderInquiryInvalidSearchInputError {
      errorCode
      errorMessage
    }
  }
}

# Variables
  
  {
  "input": {
    "initialPage": {
      "filter": {
        "presets": "AWAITING_ACTION_FROM_SELLER"
      },
      "sort": {
        "sortField": "CREATED_AT",
        "sortOrder": "ASC"
      }
    }
  }
}

```

---

## Response Sample

```json
{
    "data": {
        "sellerOrderInquiries": {
            "__typename": "SellerOrderInquiries",
            "orderInquiries": [
                {
                    "__typename": "ItemNotReceivedInquiry",
                    "inquiryId": "5018807566",
                    "status": {
                        "__typename": "OrderInquiryClosed",
                        "code": "CLOSED",
                        "displayText": "CLOSED"
                    },
                    "createdAt": "2025-11-10T17:28:42Z",
                    "closedAt": null,
                    "initiator": "BUYER",
                    "responder": "SELLER",
                    "inquirers": [
                        "BUYER"
                    ],
                    "lineItems": [
                        {
                            "inquiryLineItemId": "1********8",
                            "quantity": 1,
                            "orderLineItem": {
                                "orderLineItemId": "1********8"
                            }
                        }
                    ],
                    "sellerAvailableActions": null
                },
                {
                    "__typename": "ItemNotReceivedInquiry",
                    "inquiryId": "5018807571",
                    "status": {
                        "__typename": "OrderInquiryClosed",
                        "code": "CLOSED",
                        "displayText": "CLOSED"
                    },
                    "createdAt": "2025-11-10T17:29:21Z",
                    "closedAt": null,
                    "initiator": "BUYER",
                    "responder": "SELLER",
                    "inquirers": [
                        "BUYER"
                    ],
                    "lineItems": [
                        {
                            "inquiryLineItemId": "1********2",
                            "quantity": 1,
                            "orderLineItem": {
                                "orderLineItemId": "1********2"
                            }
                        }
                    ],
                    "sellerAvailableActions": null
                },
                {
                    "__typename": "ItemNotReceivedInquiry",
                    "inquiryId": "5018807592",
                    "status": {
                        "__typename": "OrderInquiryClosed",
                        "code": "CLOSED",
                        "displayText": "CLOSED"
                    },
                    "createdAt": "2025-11-10T17:44:23Z",
                    "closedAt": null,
                    "initiator": "BUYER",
                    "responder": "SELLER",
                    "inquirers": [
                        "BUYER"
                    ],
                    "lineItems": [
                        {
                            "inquiryLineItemId": "1********1",
                            "quantity": 1,
                            "orderLineItem": {
                                "orderLineItemId": "1********1"
                            }
                        }
                    ],
                    "sellerAvailableActions": null
                },
                {
                    "__typename": "ItemNotReceivedInquiry",
                    "inquiryId": "5018807600",
                    "status": {
                        "__typename": "OrderInquiryClosed",
                        "code": "CLOSED",
                        "displayText": "CLOSED"
                    },
                    "createdAt": "2025-11-10T17:59:20Z",
                    "closedAt": null,
                    "initiator": "BUYER",
                    "responder": "SELLER",
                    "inquirers": [
                        "BUYER"
                    ],
                    "lineItems": [
                        {
                            "inquiryLineItemId": "1********0",
                            "quantity": 1,
                            "orderLineItem": {
                                "orderLineItemId": "1********0"
                            }
                        }
                    ],
                    "sellerAvailableActions": null
                },
                {
                    "__typename": "ItemNotReceivedInquiry",
                    "inquiryId": "5018807608",
                    "status": {
                        "__typename": "OrderInquiryClosed",
                        "code": "CLOSED",
                        "displayText": "CLOSED"
                    },
                    "createdAt": "2025-11-10T18:14:30Z",
                    "closedAt": null,
                    "initiator": "BUYER",
                    "responder": "SELLER",
                    "inquirers": [
                        "BUYER"
                    ],
                    "lineItems": [
                        {
                            "inquiryLineItemId": "1********1",
                            "quantity": 1,
                            "orderLineItem": {
                                "orderLineItemId": "1********1"
                            }
                        }
                    ],
                    "sellerAvailableActions": null
                },
                {
                    "__typename": "ItemNotReceivedInquiry",
                    "inquiryId": "5018807628",
                    "status": {
                        "__typename": "OrderInquiryClosed",
                        "code": "CLOSED",
                        "displayText": "CLOSED"
                    },
                    "createdAt": "2025-11-10T18:44:20Z",
                    "closedAt": null,
                    "initiator": "BUYER",
                    "responder": "SELLER",
                    "inquirers": [
                        "BUYER"
                    ],
                    "lineItems": [
                        {
                            "inquiryLineItemId": "1********2",
                            "quantity": 1,
                            "orderLineItem": {
                                "orderLineItemId": "1********2"
                            }
                        }
                    ],
                    "sellerAvailableActions": null
                },
                {
                    "__typename": "ItemNotReceivedInquiry",
                    "inquiryId": "5018807632",
                    "status": {
                        "__typename": "OrderInquiryClosed",
                        "code": "CLOSED",
                        "displayText": "CLOSED"
                    },
                    "createdAt": "2025-11-10T18:59:30Z",
                    "closedAt": null,
                    "initiator": "BUYER",
                    "responder": "SELLER",
                    "inquirers": [
                        "BUYER"
                    ],
                    "lineItems": [
                        {
                            "inquiryLineItemId": "1********5",
                            "quantity": 1,
                            "orderLineItem": {
                                "orderLineItemId": "1********5"
                            }
                        }
                    ],
                    "sellerAvailableActions": null
                },
                {
                    "__typename": "ItemNotReceivedInquiry",
                    "inquiryId": "5018807639",
                    "status": {
                        "__typename": "OrderInquiryClosed",
                        "code": "CLOSED",
                        "displayText": "CLOSED"
                    },
                    "createdAt": "2025-11-10T19:14:19Z",
                    "closedAt": null,
                    "initiator": "BUYER",
                    "responder": "SELLER",
                    "inquirers": [
                        "BUYER"
                    ],
                    "lineItems": [
                        {
                            "inquiryLineItemId": "1********6",
                            "quantity": 1,
                            "orderLineItem": {
                                "orderLineItemId": "1********6"
                            }
                        }
                    ],
                    "sellerAvailableActions": null
                },
                {
                    "__typename": "ItemNotReceivedInquiry",
                    "inquiryId": "5018807641",
                    "status": {
                        "__typename": "OrderInquiryClosed",
                        "code": "CLOSED",
                        "displayText": "CLOSED"
                    },
                    "createdAt": "2025-11-10T19:17:58Z",
                    "closedAt": null,
                    "initiator": "BUYER",
                    "responder": "SELLER",
                    "inquirers": [
                        "BUYER"
                    ],
                    "lineItems": [
                        {
                            "inquiryLineItemId": "1********3",
                            "quantity": 1,
                            "orderLineItem": {
                                "orderLineItemId": "1********3"
                            }
                        }
                    ],
                    "sellerAvailableActions": null
                },
                {
                    "__typename": "ItemNotReceivedInquiry",
                    "inquiryId": "5018807646",
                    "status": {
                        "__typename": "OrderInquiryClosed",
                        "code": "CLOSED",
                        "displayText": "CLOSED"
                    },
                    "createdAt": "2025-11-10T19:29:48Z",
                    "closedAt": null,
                    "initiator": "BUYER",
                    "responder": "SELLER",
                    "inquirers": [
                        "BUYER"
                    ],
                    "lineItems": [
                        {
                            "inquiryLineItemId": "1********9",
                            "quantity": 1,
                            "orderLineItem": {
                                "orderLineItemId": "1********9"
                            }
                        }
                    ],
                    "sellerAvailableActions": null
                },
                {
                    "__typename": "ItemNotReceivedInquiry",
                    "inquiryId": "5018807649",
                    "status": {
                        "__typename": "OrderInquiryClosed",
                        "code": "CLOSED",
                        "displayText": "CLOSED"
                    },
                    "createdAt": "2025-11-10T19:44:20Z",
                    "closedAt": null,
                    "initiator": "BUYER",
                    "responder": "SELLER",
                    "inquirers": [
                        "BUYER"
                    ],
                    "lineItems": [
                        {
                            "inquiryLineItemId": "1********0",
                            "quantity": 1,
                            "orderLineItem": {
                                "orderLineItemId": "1********0"
                            }
                        }
                    ],
                    "sellerAvailableActions": null
                },
                {
                    "__typename": "ItemNotReceivedInquiry",
                    "inquiryId": "5018807652",
                    "status": {
                        "__typename": "OrderInquiryClosed",
                        "code": "CLOSED",
                        "displayText": "CLOSED"
                    },
                    "createdAt": "2025-11-10T19:59:26Z",
                    "closedAt": null,
                    "initiator": "BUYER",
                    "responder": "SELLER",
                    "inquirers": [
                        "BUYER"
                    ],
                    "lineItems": [
                        {
                            "inquiryLineItemId": "1********6",
                            "quantity": 1,
                            "orderLineItem": {
                                "orderLineItemId": "1********6"
                            }
                        }
                    ],
                    "sellerAvailableActions": null
                },
                {
                    "__typename": "ItemNotReceivedInquiry",
                    "inquiryId": "5018807655",
                    "status": {
                        "__typename": "OrderInquiryClosed",
                        "code": "CLOSED",
                        "displayText": "CLOSED"
                    },
                    "createdAt": "2025-11-10T20:14:31Z",
                    "closedAt": null,
                    "initiator": "BUYER",
                    "responder": "SELLER",
                    "inquirers": [
                        "BUYER"
                    ],
                    "lineItems": [
                        {
                            "inquiryLineItemId": "1********3",
                            "quantity": 1,
                            "orderLineItem": {
                                "orderLineItemId": "1********3"
                            }
                        }
                    ],
                    "sellerAvailableActions": null
                },
                {
                    "__typename": "ItemNotReceivedInquiry",
                    "inquiryId": "5018807658",
                    "status": {
                        "__typename": "OrderInquiryClosed",
                        "code": "CLOSED",
                        "displayText": "CLOSED"
                    },
                    "createdAt": "2025-11-10T20:29:26Z",
                    "closedAt": null,
                    "initiator": "BUYER",
                    "responder": "SELLER",
                    "inquirers": [
                        "BUYER"
                    ],
                    "lineItems": [
                        {
                            "inquiryLineItemId": "1********9",
                            "quantity": 1,
                            "orderLineItem": {
                                "orderLineItemId": "1********9"
                            }
                        }
                    ],
                    "sellerAvailableActions": null
                },
                {
                    "__typename": "ItemNotReceivedInquiry",
                    "inquiryId": "5018807662",
                    "status": {
                        "__typename": "OrderInquiryClosed",
                        "code": "CLOSED",
                        "displayText": "CLOSED"
                    },
                    "createdAt": "2025-11-10T20:44:32Z",
                    "closedAt": null,
                    "initiator": "BUYER",
                    "responder": "SELLER",
                    "inquirers": [
                        "BUYER"
                    ],
                    "lineItems": [
                        {
                            "inquiryLineItemId": "1********4",
                            "quantity": 1,
                            "orderLineItem": {
                                "orderLineItemId": "1********4"
                            }
                        }
                    ],
                    "sellerAvailableActions": null
                },
                {
                    "__typename": "ItemNotReceivedInquiry",
                    "inquiryId": "5018807666",
                    "status": {
                        "__typename": "OrderInquiryClosed",
                        "code": "CLOSED",
                        "displayText": "CLOSED"
                    },
                    "createdAt": "2025-11-10T20:59:23Z",
                    "closedAt": null,
                    "initiator": "BUYER",
                    "responder": "SELLER",
                    "inquirers": [
                        "BUYER"
                    ],
                    "lineItems": [
                        {
                            "inquiryLineItemId": "1********0",
                            "quantity": 1,
                            "orderLineItem": {
                                "orderLineItemId": "1********0"
                            }
                        }
                    ],
                    "sellerAvailableActions": null
                },
                {
                    "__typename": "ItemNotReceivedInquiry",
                    "inquiryId": "5018807669",
                    "status": {
                        "__typename": "OrderInquiryClosed",
                        "code": "CLOSED",
                        "displayText": "CLOSED"
                    },
                    "createdAt": "2025-11-10T21:14:22Z",
                    "closedAt": null,
                    "initiator": "BUYER",
                    "responder": "SELLER",
                    "inquirers": [
                        "BUYER"
                    ],
                    "lineItems": [
                        {
                            "inquiryLineItemId": "1********5",
                            "quantity": 1,
                            "orderLineItem": {
                                "orderLineItemId": "1********5"
                            }
                        }
                    ],
                    "sellerAvailableActions": null
                },
                {
                    "__typename": "ItemNotReceivedInquiry",
                    "inquiryId": "5018807672",
                    "status": {
                        "__typename": "OrderInquiryClosed",
                        "code": "CLOSED",
                        "displayText": "CLOSED"
                    },
                    "createdAt": "2025-11-10T21:29:23Z",
                    "closedAt": null,
                    "initiator": "BUYER",
                    "responder": "SELLER",
                    "inquirers": [
                        "BUYER"
                    ],
                    "lineItems": [
                        {
                            "inquiryLineItemId": "1********1",
                            "quantity": 1,
                            "orderLineItem": {
                                "orderLineItemId": "1********1"
                            }
                        }
                    ],
                    "sellerAvailableActions": null
                },
                {
                    "__typename": "ItemNotReceivedInquiry",
                    "inquiryId": "5018807675",
                    "status": {
                        "__typename": "OrderInquiryClosed",
                        "code": "CLOSED",
                        "displayText": "CLOSED"
                    },
                    "createdAt": "2025-11-10T21:44:19Z",
                    "closedAt": null,
                    "initiator": "BUYER",
                    "responder": "SELLER",
                    "inquirers": [
                        "BUYER"
                    ],
                    "lineItems": [
                        {
                            "inquiryLineItemId": "1********8",
                            "quantity": 1,
                            "orderLineItem": {
                                "orderLineItemId": "1********8"
                            }
                        }
                    ],
                    "sellerAvailableActions": null
                },
                {
                    "__typename": "ItemNotReceivedInquiry",
                    "inquiryId": "5018807685",
                    "status": {
                        "__typename": "OrderInquiryClosed",
                        "code": "CLOSED",
                        "displayText": "CLOSED"
                    },
                    "createdAt": "2025-11-10T22:29:28Z",
                    "closedAt": null,
                    "initiator": "BUYER",
                    "responder": "SELLER",
                    "inquirers": [
                        "BUYER"
                    ],
                    "lineItems": [
                        {
                            "inquiryLineItemId": "1********3",
                            "quantity": 1,
                            "orderLineItem": {
                                "orderLineItemId": "1********3"
                            }
                        }
                    ],
                    "sellerAvailableActions": null
                }
            ],
            "pagination": {
                "nextCursor": "eyJwYWdlTnVtYmVyIjoyLCJtYXhQYWdlU2l6ZSI6MjAsImZpbHRlciI6eyJvcmRlcklkIjpudWxsLCJsaXN0aW5nSWQiOm51bGwsImNyZWF0ZWRCZXR3ZWVuIjp7InN0YXJ0RGF0ZVRpbWUiOjE3NjI3OTUwODEuMjg3Nzk4ODg0LCJlbmREYXRlVGltZSI6MTc2NTM4NzA4MS4yODc3OTg4ODR9LCJwcmVzZXRzIjoiQVdBSVRJTkdfQUNUSU9OX0ZST01fU0VMTEVSIn0sInNvcnQiOnsic29ydEZpZWxkIjoiQ1JFQVRFRF9BVCIsInNvcnRPcmRlciI6IkFTQyJ9fQ==",
                "previousCursor": null
            }
        }
    }
}
```
