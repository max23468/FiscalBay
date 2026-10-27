# sellerNegotiationHistory

**API:** Offer
**Type:** GraphQL Query
**Endpoint:** `https://graphqlapi.ebay.com/graphql`
**Method:** Query
**Operation Name:** `sellerNegotiationHistory`

---

## Description

This sample **sellerNegotiationHistory** query retrieves the seller perspective of the user's negotiation history, including negotiations on items they have listed.

---

## Request Payload

```graphql
query SellerNegotiationHistory($input: SellerNegotiationHistoryInput!) {
  sellerNegotiationHistory(input: $input) {
    itemNegotiations {
      item {
        itemId
      }
      negotiations {
        negotiationId
        offers {
          offerId
          status
          offerCreatorRole
          offerPrice {
            original {
              value
              currency
            }
            converted {
              value
              currency
            }
          }
          quantity
          createdAt
          updatedAt
          expiresAt
          message
        }
        latestOffer {
          offerId
          status
          offerCreatorRole
          quantity
          offerPrice {
            original {
              value
              currency
            }
            converted {
              value
              currency
            }
          }
          createdAt
          updatedAt
          expiresAt
        }
        offerCapabilities {
          negotiable
        }
        target {
          ... on Item {
            itemId
          }
        }
      }
    }
    pagination {
      nextCursor
      previousCursor
    }
  }
}

# Variables
{
  "input": {
    "filters": {
      "negotiationCreatorRole": "BUYER",
      "statusFilter": "ACTIONABLE",
      "pagination": {
        "maxPageSize": 10
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
        "sellerNegotiationHistory": {
            "itemNegotiations": [
                {
                    "item": {
                        "itemId": "12********71"
                    },
                    "negotiations": [
                        {
                            "negotiationId": "14*****50",
                            "latestOffer": {
                                "offerId": "26*****63",
                                "status": "PENDING",
                                "offerCreatorRole": "SELLER",
                                "quantity": 1,
                                "createdAt": "2026-01-07T18:43:07.000Z",
                                "updatedAt": "2026-01-07T18:43:07.000Z",
                                "expiresAt": "2026-01-08T18:43:07.000Z",
                                "message": null
                            }
                        }
                    ]
                }
            ],
            "pagination": {
                "nextCursor": null,
                "previousCursor": null
            }
        }
    }
}
```
