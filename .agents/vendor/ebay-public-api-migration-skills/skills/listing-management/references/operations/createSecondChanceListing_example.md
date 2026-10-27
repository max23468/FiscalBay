# createSecondChanceListing

**API:** Listing
**Type:** GraphQL Mutation
**Endpoint:** `https://graphqlapi.ebay.com/graphql`
**Method:** Mutation
**Operation Name:** `createSecondChanceListing`

---

## Description

This sample **createSecondChanceListing** mutation creates a Second Chance Offer listing and makes the item available to a competitive bidder from a recently ended auction listing.

---

## Request Payload

```graphql
mutation CreateSecondChanceListing($input: CreateSecondChanceListingInput!) {
  createSecondChanceListing(input: $input) {
    ... on CreateSecondChanceListingSuccess {
      listing {
        listingId
        sku
        marketplace
        sellerProduct {
          title
          description
          aspects {
            name
            values
          }
          images {
            ebayImageUrl
          }
          categories {
            primaryCategory {
              id
            }
          }
          itemCondition {
            itemConditionId
          }
        }
        items {
          sku
          itemTerms {
            availability {
              quantityAvailable
            }
            pricingTerms {
              fixedPrice {
                original {
                  value
                  currency
                }
              }
              auctionPrice {
                startingBidPrice {
                  original {
                    value
                    currency
                  }
                }
                reservePrice {
                  original {
                    value
                    currency
                  }
                }
              }
            }
          }
        }
        listingTerms {
          fulfillmentTerms {
            ... on FulfillmentTerms {
              packageSpecifications {
                packageDimensions {
                  length
                  width
                  height
                }
                packageWeight {
                  majorUnit
                  minorUnit
                }
                listingUnitOfMeasure
              }
              shippingTerms {
                handlingTimeDuration
                shippingServices {
                  rank
                }
              }
            }
          }
          paymentTerms {
            ... on PaymentTerms {
              immediatePay
            }
          }
          listingFormat
          lifecycleTerms {
            listingDurationInDays
            startAt
          }
          itemLocation {
            country
            postalCode
            location
          }
        }
      }
      warnings {
        warningCode
        warningMessage
      }
    }
    ... on CreateSecondChanceListingValidationSuccess {
      listing {
        listingId
        sku
        marketplace
        sellerProduct {
          title
          description
          aspects {
            name
            values
          }
          images {
            ebayImageUrl
          }
          categories {
            primaryCategory {
              id
            }
          }
          itemCondition {
            itemConditionId
          }
        }
        items {
          sku
          itemTerms {
            availability {
              quantityAvailable
            }
            pricingTerms {
              fixedPrice {
                original {
                  value
                  currency
                }
              }
              auctionPrice {
                startingBidPrice {
                  original {
                    value
                    currency
                  }
                }
                reservePrice {
                  original {
                    value
                    currency
                  }
                }
              }
            }
          }
        }
        listingTerms {
          fulfillmentTerms {
            ... on FulfillmentTerms {
              packageSpecifications {
                packageDimensions {
                  length
                  width
                  height
                }
                packageWeight {
                  majorUnit
                  minorUnit
                }
                listingUnitOfMeasure
              }
              shippingTerms {
                handlingTimeDuration
                shippingServices {
                  rank
                }
              }
            }
          }
          paymentTerms {
            ... on PaymentTerms {
              immediatePay
            }
          }
          listingFormat
          lifecycleTerms {
            listingDurationInDays
            startAt
          }
          itemLocation {
            country
            postalCode
            location
          }
        }
      }
      ... on CreateSecondChanceListingValidationError {
        errorCode
        errorMessage
        violations {
          violationDescription
          violationCode
          inputPath
          additionalInformation {
            name
            value
          }
        }
        warnings {
          warningCode
          warningMessage
          additionalInformation {
            name
            value
          }
        }
      }
    }
  }
}

# Variables

{
  "input": {
    "listingIdentifier": {
      "listingId": "3********4"
    },
    "listingTerms": {
      "listingDuration": "DAYS_3"
    },
    "recipientUserId": "v********r",
    "sellerMessage": "Hello, would you like to buy this item?",
    "marketplace": "EBAY_US",
    "options": {
      "operationMode": "EXECUTE"
    }
  }
}
```

---

## Response Sample

```json
{
    "data": {
        "createSecondChanceListing": {
            "listing": {
                "listingId": "3********8",
                "sku": "A********3",
                "marketplace": "EBAY_US",
                "sellerProduct": {
                    "title": "Apple iPhone 16 Pro 256GB Black Titanium",
                    "description": "Apple iPhone 16 Pro (2024) \u2014 256GB, Black Titanium, factory unlocked. Brand new, factory sealed. Includes original box and USB-C cable.",
                    "aspects": [
                        {
                            "name": "Brand",
                            "values": [
                                "Apple"
                            ]
                        },
                        {
                            "name": "Model",
                            "values": [
                                "Apple iPhone 16 Pro"
                            ]
                        },
                        {
                            "name": "Storage Capacity",
                            "values": [
                                "256 GB"
                            ]
                        },
                        {
                            "name": "Color",
                            "values": [
                                "Black"
                            ]
                        },
                        {
                            "name": "Manufacturer Color",
                            "values": [
                                "Black Titanium"
                            ]
                        },
                        {
                            "name": "Network",
                            "values": [
                                "Unlocked"
                            ]
                        },
                        {
                            "name": "Operating System",
                            "values": [
                                "iOS"
                            ]
                        },
                        {
                            "name": "Screen Size",
                            "values": [
                                "6.3 in"
                            ]
                        },
                        {
                            "name": "Connectivity",
                            "values": [
                                "USB Type-C",
                                "Wi-Fi",
                                "Bluetooth",
                                "NFC",
                                "GPS"
                            ]
                        }
                    ],
                    "images": [
                        {
                            "ebayImageUrl": "https://i.ebayimg.com/images/g/33gAAeSwfWJpJI-c/s-l300.webp"
                        },
                        {
                            "ebayImageUrl": "https://i.ebayimg.com/images/g/6e4AAeSwsI5pJI~G/s-l1600.webp"
                        },
                        {
                            "ebayImageUrl": "https://i.ebayimg.com/images/g/4DQAAeSw6qtpJI~G/s-l1600.webp"
                        }
                    ],
                    "categories": {
                        "primaryCategory": {
                            "id": "9355"
                        }
                    }
                },
                "items": [
                    {
                        "sku": "A********3",
                        "itemTerms": {
                            "availability": {
                                "quantityAvailable": 1
                            },
                            "pricingTerms": {
                                "fixedPrice": {
                                    "original": {
                                        "value": 11.0,
                                        "currency": "USD"
                                    }
                                }
                            }
                        }
                    }
                ],
                "listingTerms": {
                    "fulfillmentTerms": {
                        "packageSpecifications": {
                            "packageDimensions": {
                                "length": 8,
                                "width": 6,
                                "height": 2
                            },
                            "packageWeight": {
                                "majorUnit": 1,
                                "minorUnit": 4
                            },
                            "listingUnitOfMeasure": "ENGLISH"
                        },
                        "shippingTerms": {
                            "handlingTimeDuration": "DAYS_1",
                            "shippingServices": [
                                {
                                    "rank": 1
                                }
                            ]
                        }
                    },
                    "paymentTerms": {
                        "immediatePay": true
                    },
                    "listingFormat": "FIXED_PRICE",
                    "lifecycleTerms": {
                        "listingDurationInDays": "DAYS_3",
                        "startAt": "2026-04-06T23:42:21.000Z"
                    },
                    "itemLocation": {
                        "country": "US",
                        "postalCode": "95113",
                        "location": "San Jose, California"
                    }
                }
            }
        }
    }
}
```
