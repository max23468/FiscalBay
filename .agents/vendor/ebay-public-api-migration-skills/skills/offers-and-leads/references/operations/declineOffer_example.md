# declineOffer

**API:** Offer
**Type:** GraphQL Mutation
**Endpoint:** `https://graphqlapi.ebay.com/graphql`
**Method:** Mutation
**Operation Name:** `declineOffer`

---

## Description

This sample **declineOffer** mutation declines an active offer (or counteroffer) and ends the negotiation process.

---

## Request Payload

```graphql
mutation DeclineOffer($input: DeclineOfferInput!) {
  declineOffer(input: $input) {
    ... on DeclineOfferSent {
      offer {
        offerId
        status
      }
    }
    ...OfferBusinessErrorFragment
  }
}

fragment OfferBusinessErrorFragment on DeclineOfferOutput {
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
    "message": "Sorry, I cannot accept this price at this time"
  }
}

```

---

## Response Sample

```json
{
    "data": {
        "declineOffer": {
            "__typename": "DeclineOfferSent",
            "offer": {
                "offerId": "60******00",
                "offerCreatorRole": "BUYER",
                "status": "DECLINED",
                "offerPrice": {
                    "original": {
                        "value": "85.00",
                        "currency": "USD"
                    },
                    "converted": {
                        "value": "85.00",
                        "currency": "USD"
                    }
                },
                "quantity": 1,
                "createdAt": "2026-03-29T10:15:30Z",
                "updatedAt": "2026-03-30T17:20:15Z",
                "message": "Sorry, I cannot accept this price at this time"
            }
        }
    }
}
```
