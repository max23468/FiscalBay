# createListing

**API:** Listing
**Type:** GraphQL Mutation
**Endpoint:** `https://graphqlapi.ebay.com/graphql`
**Method:** Mutation
**Operation Name:** `createListing`

---

## Description

This sample **createListing** mutation creates a new fixed price listing on the eBay US marketplace. The item is in new condition and shipping is free for buyers located in the US.

---

## Request Payload

```graphql
mutation CreateListing($input: CreateListingInput!) {
  createListing(input: $input) {
    ... on CreateListingSuccess {
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
    }
    ... on CreateListingValidationSuccess {
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
                  unit
                }
                packageWeight {
                  majorUnit
                  minorUnit
                  unit
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
    }
    ... on CreateListingValidationError {
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
    "sku": "S********3",
    "idempotencyKey": "3********8",
    "marketplace": "EBAY_US",
    "product": {
      "title": "Selected Homme Orange Sneakers Men’s Size 10",
      "description": "SELECTED HOMME Orange: Brand new item in excellent condition. This men's shoes is perfect for your needs. Item includes: Original packaging, All accessories, Manufacturer warranty, Fast and free shipping available!",
      "categories": {
        "primaryCategoryId": "15709"
      },
      "aspects": [
        { "name": "Brand", "values": ["SELECTED HOMME"] },
        { "name": "US Shoe Size", "values": ["10"] },
        { "name": "Color", "values": ["Orange"] },
        { "name": "Department", "values": ["Men's"] }
      ],
      "imageUrls": [
        "https://i.ebayimg.com/images/g/placeholder/s-l1600.jpg?v=1",
        "https://i.ebayimg.com/images/g/placeholder/s-l1600.jpg?v=2",
        "https://i.ebayimg.com/images/g/placeholder/s-l1600.jpg?v=3"
      ],
      "itemCondition": {
        "conditionId": "1000"
      }
    },
    "listingItems": {
      "items": [
        {
          "itemTerms": {
            "availability": { "quantityAvailable": 1 },
            "pricingTerms": { "fixedPrice": 1200.99 }
          }
        }
      ]
    },
    "listingTerms": {
      "listingFormat": "FIXED_PRICE",
      "lifecycleTerms": {
        "listingDurationInDays": "GTC"
      },
      "bestOfferTerms": {
        "bestOfferEnabled": true,
        "autoAcceptThreshold": 1175.0,
        "autoDeclineThreshold": 1100.0
      },
      "fulfillmentTerms": {
        "packageSpecifications": {
          "measurementSystem": "ENGLISH",
          "packageDimensions": { "length": 12, "width": 9, "height": 3 },
          "packageWeight": { "majorUnit": 1, "minorUnit": 5 }
        },
        "shippingTerms": {
          "handlingTimeDuration": "DAYS_1",
          "shippingServices": [{
             "shippingCost": 10.0,
             "rank": 1,
             "shippingServiceCode": "USPSPriority"
            }
          ],
          "marketplaceShippingOptions": {
            "costType": "FLAT"
            }
        }
      },
      "returnTerms": {
        "domesticReturnTerms": {
          "refundMethod": "MONEY_BACK",
          "returnAccepted": true,
          "returnDuration": "DAYS_30",
          "returnShipmentInvoicee": "BUYER"
        }
      },
      "itemLocation": {
        "location": "San Jose, CA",
        "postalCode": "95113",
        "country": "US"
      }
    },
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
        "createListing": {
            "listing": {
                "listingId": "1********7",
                "sku": "S********3",
                "marketplace": "EBAY_US",
                "sellerProduct": {
                    "title": "Selected Homme Orange Sneakers Men\u2019s Size 10",
                    "description": "SELECTED HOMME Orange: Brand new item in excellent condition. This men's shoes is perfect for your needs. Item includes: Original packaging, All accessories, Manufacturer warranty, Fast and free shipping available!",
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
                        "sku": "S********3",
                        "itemTerms": {
                            "availability": {
                                "quantityAvailable": 1
                            },
                            "pricingTerms": {
                                "fixedPrice": {
                                    "original": {
                                        "value": 1200.99,
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
                        "startAt": "2026-04-06T22:41:57.000Z"
                    },
                    "bestOfferTerms": {
                        "acceptBestOffer": true,
                        "autoAcceptThresholdAmount": {
                            "original": {
                                "value": 1175.0,
                                "currency": "USD"
                            }
                        },
                        "autoDeclineThresholdAmount": {
                            "original": {
                                "value": 1100.0,
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
