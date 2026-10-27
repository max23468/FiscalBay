# counterOffer

**API:** Offer
**Type:** GraphQL Mutation
**Endpoint:** `https://graphqlapi.ebay.com/graphql`
**Method:** Mutation
**Operation Name:** `counterOffer`

---

## Description

This sample **counterOffer** mutation counters an active offer (or counteroffer) with a different price or quantity.

---

## Request Payload

```graphql
mutation CounterOffer($input: CounterOfferInput!) {
  counterOffer(input: $input) {
    __typename
    ... on CounterOfferSent {
      offer {
        offerId
        offerCreatorRole
        status
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
    }
    ...CounterOfferBusinessErrorFragment
  }
}

fragment CounterOfferBusinessErrorFragment on CounterOfferOutput {
  ... on BusinessError {
    errorCode
    errorMessage
  }
  ... on OfferBusinessRulesViolated {
    violations {
      __typename
      ruleDescription
    }
  }
  ... on ReferenceArgumentsNotFound {
    argumentNames
  }
}

# Variables
{
  "input": {
    "itemId": "12********12",
    "offerId": "60******00",
    "proposedPrice": {
      "value": "90.00",
      "currency": "USD"
    },
    "quantity": 1,
    "message": "I can do $90"
  }
}

```

---

## Response Sample

```json
{
    "data": {
        "counterOffer": {
            "__typename": "CounterOfferSent",
            "offer": {
                "offerId": "60******01",
                "offerCreatorRole": "SELLER",
                "status": "PENDING",
                "offerPrice": {
                    "original": {
                        "value": "90.00",
                        "currency": "USD"
                    },
                    "converted": {
                        "value": "90.00",
                        "currency": "USD"
                    }
                },
                "quantity": 1,
                "createdAt": "2026-03-30T15:30:12Z",
                "updatedAt": "2026-03-30T15:30:12Z",
                "expiresAt": "2026-04-06T15:30:12Z",
                "message": "I can do $90"
            }
        }
    }
}
```
