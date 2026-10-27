# createPurchaseQuote

**API:** Purchase Quote
**Type:** GraphQL Mutation
**Endpoint:** `https://graphqlapi.ebay.com/graphql`
**Method:** Mutation
**Operation Name:** `createPurchaseQuote`

---

## Description

This sample **createPurchaseQuote** mutation allows a seller to create a new purchase quote containing multiple item commitments with price details and optional shipping estimates.

---

## Request Payload

```graphql
mutation CreatePurchaseQuote($input: CreatePurchaseQuoteInput!) {
    createPurchaseQuote(input: $input) {
        ... on CreatePurchaseQuoteBusinessError {
            errorCode
            errorMessage
            retryable
        }
        ... on CreatePurchaseQuoteSuccess {
            purchaseQuote {
                purchaseQuoteId
            }
        }
    }
}

 #variables  
 
{
        "input": {
            "messageToBuyer": "Thank you for your interest! Here's your custom quote with special pricing.",
            "lineItems": [
                {
                    "itemCommitmentId": "03-0*1-0******6"
                },
                {
                    "itemCommitmentId": "24-0*1-0******2"
                }
            ],
            "logisticsOptions": {
                "shipping": [
                    {
                        "cost": {
                            "value": 12.99,
                            "currency": "USD"
                        },
                        "shippingServiceCode": "USPSParcel"
                    },
                    {
                        "cost": {
                            "value": 13.99,
                            "currency": "USD"
                        },
                        "shippingServiceCode": "USPSPriorityMailInternational"
                    }
                ],
                "pickup": [
                    {
                        "cost": {
                            "value": 14.99,
                            "currency": "USD"
                        },
                        "displayName": "my local pickup"
                    }
                ]
            },
            "total": {
                "shippingDiscount": {
                    "value": 1,
                    "currency": "USD"
                },
                "additionalCharge": {
                    "value": 2.5,
                    "currency": "USD"
                }
            },
            "emailCopyToSeller": false
        }
    }
}
```

---

## Response Sample

```json
{
    "data": {
        "createPurchaseQuote": {
            "purchaseQuote": {
                "purchaseQuoteId": "14-00-1******4"
            }
        }
    }
}
```
