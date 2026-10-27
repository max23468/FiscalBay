# itemCommitments

**API:** Item Commitment
**Type:** GraphQL Query
**Endpoint:** `https://graphqlapi.ebay.com/graphql`
**Method:** Query
**Operation Name:** `itemCommitments`

---

## Description

This sample **itemCommitments** query retrieves item commitments associated with a user.

---

## Request Payload

```graphql
query ItemCommitments($input: SellerItemCommitmentsInput!) {
  itemCommitments {
    sellerItemCommitments(input: $input) {
      itemCommitments {
        itemCommitmentId
        state {
          ... on ItemCommitmentActive {
            label
          }
          ... on ItemCommitmentCancelled {
            label
            cancelledAt
          }
          ... on ItemCommitmentLocked {
            label
          }
          ... on ItemCommitmentCompleted {
            label
          }
          ... on ItemCommitmentAbandoned {
            label
          }
        }
        createdAt
        updatedAt
        committedMarketplace
        lineItem {
          quantity
          purchaseFlow {
            ... on PurchaseFlowBuyItNow { label }
            ... on PurchaseFlowAuction { label }
            ... on PurchaseFlowCommitToBuy { label }
            ... on PurchaseFlowSellerInitiatedOffer { label }
            ... on PurchaseFlowBestOffer { label }
            ... on PurchaseFlowRequestTotal { label }
          }
          item {
            itemIdVersioned
            versionId
          }
          itemSku {
            sellerSku
            storeSku
          }
        }
      }
      pagination {
        nextCursor
        previousCursor
      }
    }
  }
}

# Variables: 

{
  "input": {
    "itemCommitmentsFirstPage": {
      "maxPageSize": 100,
      "filter": {
        "dateRange": {
          "dateTimeRange": {
            "startDateTime": "2026-03-01T18:04:40.360Z",
            "endDateTime": "2026-05-01T18:04:40.360Z"
          },
          "dateType": "CREATED"
        },
        "sort": {
          "sortField": "CREATED_AT",
          "sortOrder": "ASC"
        },
        "filter": {
          "includeActive": true,
          "includeCancelled": true,
          "includeLocked": true,
          "includeCompleted": true,
          "includeAbandoned": true
        }
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
        "itemCommitments": {
            "buyerItemCommitments": {
                "itemCommitments": [
                    {
                        "itemCommitmentId": "22-0**-0****79",
                        "createdAt": "20**-01-13T22:31:56.000Z",
                        "updatedAt": "20**-01-14T22:47:04.000Z",
                        "committedMarketplace": "EBAY_US",
                        "state": {
                            "label": "Active"
                        },
                        "cancellation": null,
                        "refunds": [],
                        "buyer": {
                          "legacyUserId": "EXAMPLE_BUYER_ID"
                        },
                        "seller": {
                          "legacyUserId": "EXAMPLE_SELLER_ID"
                        },
                        "totals": {
                            "committedTotal": {
                                "original": {
                                    "value": 121,
                                    "currency": "USD"
                                }
                            }
                        },
                        "lineItem": {
                            "quantity": 1,
                            "item": {
                                "itemIdVersioned": "33********01-0",
                                "versionId": "1.0"
                            },
                            "purchaseFlow": null
                        }
                    }
                ],
                "pagination": {
                    "nextCursor": null,
                    "previousCursor": null
                }
            }
        }
    }
}
```
