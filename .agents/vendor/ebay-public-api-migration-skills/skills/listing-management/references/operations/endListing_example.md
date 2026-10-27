# endListing

**API:** Listing
**Type:** GraphQL Mutation
**Endpoint:** `https://graphqlapi.ebay.com/graphql`
**Method:** Mutation
**Operation Name:** `endListing`

---

## Description

This sample **endListing** mutation ends an existing eBay listing prior to its scheduled end time.

---

## Request Payload

```graphql
mutation EndListing($input: EndListingInput!) {
  endListing(input: $input) {
    ... on EndListingSuccess {
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
          bestOfferTerms {
            acceptBestOffer
            autoAcceptThresholdAmount {
              original {
                value
                currency
              }
            }
            autoDeclineThresholdAmount {
              original {
                value
                currency
              }
            }
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
    ... on EndListingValidationError {
      errorMessage
      errorCode
      violations {
        inputPath
        violationCode
        violationDescription
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

# Variables

{
  "input": {
      "listingIdentifier": {
        "listingId": "1********7"
      },
      "endListingReason":"END_ITEM_ON_ZERO_QUANTITY"
  }
}
```

---

## Response Sample

```json
{
    "data": {
        "endListing": {
            "listing": {
                "listingId": "1********7",
                "sku": "A********W",
                "marketplace": "EBAY_US",
                "sellerProduct": {
                    "title": "Selected Homme Orange Sneakers Men\u2019s Size 10",
                    "description": "SELECTED HOMME Orange Men's Size 10 shoes: Brand new item in excellent condition. This pair of men's shoes is perfect for your needs. Listing includes: Original packaging, all accessories, and manufacturer 2-year warranty. Fast and free shipping available!",
                    "aspects": [
                        {
                            "name": "Brand",
                            "values": [
                                "SELECTED HOMME"
                            ]
                        },
                        {
                            "name": "US Shoe Size",
                            "values": [
                                "10"
                            ]
                        },
                        {
                            "name": "Color",
                            "values": [
                                "Orange"
                            ]
                        },
                        {
                            "name": "Department",
                            "values": [
                                "Men's"
                            ]
                        }
                    ],
                    "images": [
                        {
                            "ebayImageUrl": "https://i.ebayimg.com/images/g/placeholder/s-l1600.jpg?v=1"
                        },
                        {
                            "ebayImageUrl": "https://i.ebayimg.com/images/g/placeholder/s-l1600.jpg?v=2"
                        },
                        {
                            "ebayImageUrl": "https://i.ebayimg.com/images/g/placeholder/s-l1600.jpg?v=3"
                        }
                    ],
                    "categories": {
                        "primaryCategory": {
                            "id": "15709"
                        }
                    },
                    "itemCondition": {
                        "itemConditionId": "1000"
                    }
                },
                "items": [
                    {
                        "sku": "A********W",
                        "itemTerms": {
                            "availability": {
                                "quantityAvailable": 3
                            },
                            "pricingTerms": {
                                "fixedPrice": {
                                    "original": {
                                        "value": 1849.99,
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
                                "length": 12,
                                "width": 9,
                                "height": 3
                            },
                            "packageWeight": {
                                "majorUnit": 1,
                                "minorUnit": 5
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
                        "immediatePay": false
                    },
                    "listingFormat": "FIXED_PRICE",
                    "lifecycleTerms": {
                        "listingDurationInDays": "GTC",
                        "startAt": "2026-04-06T23:16:24.000Z"
                    },
                    "bestOfferTerms": {
                        "acceptBestOffer": true,
                        "autoAcceptThresholdAmount": {
                            "original": {
                                "value": 1575.0,
                                "currency": "USD"
                            }
                        },
                        "autoDeclineThresholdAmount": {
                            "original": {
                                "value": 1300.0,
                                "currency": "USD"
                            }
                        }
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
