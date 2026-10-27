# sellerListings

**API:** Listing
**Type:** GraphQL Query
**Endpoint:** `https://graphqlapi.ebay.com/graphql`
**Method:** Query
**Operation Name:** `sellerListings`

---

## Description

This sample **sellerListings** query retrieves the details of a listing.

---

## Request Payload

```graphql
query SellerListings {
  sellerListings(input: { listings: [{ listingId: "198260896237" }] }) {
    listings {
      ... on ListingSuccess {
        listingId
        listing {
          listingId
          marketplace
          sellerProduct {
            title
          }
          listingTerms {
            listingFormat
            lifecycleTerms {
              listingDurationInDays
              actualEndAt
              endListingReason
              createdAt
              listingStatus
              scheduledEndAt
              startAt
            }
            fulfillmentTerms {
              ... on FulfillmentTerms {
                inStorePickupSupported
                globalShippingSupported
                freeShippingAvailable
                packageSpecifications {
                  irregularPackage
                  listingPackageType
                  listingUnitOfMeasure
                  packageDimensions {
                    length
                    width
                    height
                  }
                  packageWeight {
                    majorUnit
                    minorUnit
                  }
                }
                shippingTerms {
                  buyerResponsibleForShipping
                  handlingTimeDuration
                  includedShipToLocations {
                    country
                  }
                }
              }
              ... on BusinessPolicy {
                businessPolicyId
              }
            }
            returnTerms {
              ... on ReturnTerms {
                domesticReturnTerms {
                  returnAccepted
                  listingRefundMethod
                  returnDuration
                  returnShipmentInvoicee
                }
              }
              ... on BusinessPolicy {
                businessPolicyId
              }
            }
            paymentTerms {
              ... on PaymentTerms {
                immediatePay
    
              }
              ... on BusinessPolicy {
                businessPolicyId
              }
            }
            hideParticipation
            visualEnhancements {
              boldTitle
              galleryPlus
            }
            bestOfferTerms {
              acceptBestOffer
              autoAcceptThresholdAmount {
                original {
                  currency
                  value
                }
              }
              autoDeclineThresholdAmount {
                original {
                  currency
                  value
                }
              }
            }
            taxTerms {
              salesTaxApplicableToShipping
              vatRecognizedBusinessSeller
              salesTaxTableUsed
            }
            itemLocation {
              location
              country
              postalCode
            }
            totalQuantityAvailable
          }
          ... on VariationListing {
            listingVariations {
              imagesVaryByTrait {
                traitName
                traitValueImages {
                  traitValue
                  traitImages {
                    ebayImageUrl
                    externalImageUrl
                    order
                  }
                }
              }
              variationTraits {
                name
                values
              }
            }
          }
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
        "sellerListings": {
            "listings": [
                {
                    "listingId": "1********7",
                    "listing": {
                        "listingId": "1********7",
                        "marketplace": "EBAY_US",
                        "sellerProduct": {
                            "title": "Selected Homme Orange Sneakers Men\u2019s Size 10"
                        },
                        "listingTerms": {
                            "listingFormat": "FIXED_PRICE",
                            "lifecycleTerms": {
                                "listingDurationInDays": "GTC",
                                "actualEndAt": "2026-04-07T01:00:53.000Z",
                                "endListingReason": "NOT_AVAILABLE",
                                "createdAt": "2026-04-06T23:16:23.000Z",
                                "listingStatus": "ENDED",
                                "scheduledEndAt": "2026-05-06T23:16:24.000Z",
                                "startAt": "2026-04-06T23:16:24.000Z"
                            },
                            "fulfillmentTerms": {
                                "inStorePickupSupported": false,
                                "globalShippingSupported": false,
                                "freeShippingAvailable": false,
                                "packageSpecifications": {
                                    "irregularPackage": false,
                                    "listingPackageType": "NONE",
                                    "listingUnitOfMeasure": "ENGLISH",
                                    "packageDimensions": {
                                        "length": 12,
                                        "width": 9,
                                        "height": 3
                                    },
                                    "packageWeight": {
                                        "majorUnit": 1,
                                        "minorUnit": 5
                                    }
                                },
                                "shippingTerms": {
                                    "buyerResponsibleForShipping": false,
                                    "handlingTimeDuration": "DAYS_1",
                                    "includedShipToLocations": [
                                        {
                                            "country": "US"
                                        }
                                    ]
                                }
                            },
                            "returnTerms": {
                                "domesticReturnTerms": {
                                    "returnAccepted": true,
                                    "listingRefundMethod": "MONEY_BACK",
                                    "returnDuration": "DAYS_30",
                                    "returnShipmentInvoicee": "Buyer"
                                }
                            },
                            "paymentTerms": {
                                "immediatePay": false
                            },
                            "hideParticipation": false,
                            "visualEnhancements": {
                                "boldTitle": false,
                                "galleryPlus": false
                            },
                            "bestOfferTerms": {
                                "acceptBestOffer": true,
                                "autoAcceptThresholdAmount": {
                                    "original": {
                                        "currency": "USD",
                                        "value": 1575.0
                                    }
                                },
                                "autoDeclineThresholdAmount": {
                                    "original": {
                                        "currency": "USD",
                                        "value": 1300.0
                                    }
                                }
                            },
                            "taxTerms": {
                                "salesTaxApplicableToShipping": false,
                                "vatRecognizedBusinessSeller": false,
                                "salesTaxTableUsed": false
                            },
                            "itemLocation": {
                                "location": "San Jose, California",
                                "country": "US",
                                "postalCode": "95113"
                            },
                            "totalQuantityAvailable": 3
                        }
                    }
                }
            ]
        }
    }
}
```
