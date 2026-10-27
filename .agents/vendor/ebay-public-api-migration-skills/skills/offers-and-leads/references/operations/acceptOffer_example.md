# acceptOffer

**API:** Offer
**Type:** GraphQL Mutation
**Endpoint:** `https://graphqlapi.ebay.com/graphql`
**Method:** Mutation
**Operation Name:** `acceptOffer`

---

## Description

This sample **acceptOffer** mutation accepts an active offer (or counteroffer) and completes a purchase.

---

## Request Payload

```graphql
mutation AcceptOffer($input: AcceptOfferInput!) {
  acceptOffer(input: $input) {
    __typename
    ... on AcceptOfferSent {
      offer {
        offerId
        offerCreatorRole
        status
        offerCreatorUser {
          shippingZone {
            postalCode
          }
        }
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
      purchaseReference {
        ... on ItemCommitment {
          __typename
          itemCommitmentId
        }
      }
    }
    ...OfferBusinessErrorFragment
  }
}

fragment OfferBusinessErrorFragment on AcceptOfferOutput {
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
    "offerId": "60******01",
    "message": "Thanks for the great deal!"
  }
}
```

---

## Response Sample

```json
{
    "data": {
        "acceptOffer": {
            "__typename": "AcceptOfferSent",
            "offer": {
                "offerId": "26*****89",
                "status": "ACCEPTED",
                "offerCreatorRole": "BUYER",
                "offerCreatorUser": {
                    "shippingZone": null
                },
                "offerPrice": {
                    "original": {
                        "value": "1.0",
                        "currency": "USD"
                    },
                    "converted": null
                },
                "quantity": 1,
                "createdAt": "2026-01-07T18:55:18.000Z",
                "updatedAt": "2026-01-07T18:59:49.126Z",
                "expiresAt": "2026-01-08T18:55:18.000Z",
                "message": "hi"
            },
            "purchaseReference": {
                "__typename": "ItemCommitment",
                "itemCommitmentId": "16-***-61***00"
            }
        }
    }
}
```
