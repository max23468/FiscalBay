# itemBiddingActivity

**API:** Auction
**Type:** GraphQL Query
**Endpoint:** `https://graphqlapi.ebay.com/graphql`
**Method:** Query
**Operation Name:** `itemBiddingActivity`

---

## Description

This sample **itemBiddingActivity **query retrieves auction and bid information for a listing specified by its itemId value.

---

## Request Payload

```graphql
query itemBiddingActivity {
    itemBiddingActivity(input: {itemId: "1********4"}) {
    itemBiddingActivity {
      activeBidHistoryRecords(paginationInput: {maxPageSize:4}) {
        paginationOutput {
          previousCursor
          nextCursor
        }
        bidHistoryRecords {
          bidAmount {
            original {
            value
            }
          }
          bidder {
            username
            userId
          }
        }
      }
      cancelledBidHistoryRecords(paginationInput: {maxPageSize:2, pageCursor: "eyJ0cmFuc2FjdGlvbklkIjoyODE5ODM4MjI4MDAyLCJkb1BhZ2luYXRlRm9yd2FyZCI6ZmFsc2V9"}) {
          paginationOutput {
          previousCursor
          nextCursor
        }
        bidHistoryRecords {
          bidder {
            username
            userId
          }
          bidAmount {
            original {
            value
            }
          }
        }
      }
      retractedBidHistoryRecords {
          paginationOutput {
          previousCursor
          nextCursor
        }
        bidHistoryRecords {
          bidAmount {
            original {
            value
            }
          }
        }
      }
    
      leadingBid {
          buyerBiddingSummary {
            bidsWithSellerPercentage
            retractedBidCount
            totalBidCount
            uniqueListingCategoryBidCount
            uniqueSellerBidCount
            itemBids {
              bidCount
              mostRecentBidAt
            }
          }
          bidder {
            username
            userId
            shippingZone {
                countryCode
                stateOrProvince
            }
          }
        bidAmount {
          original {
            value
            currency
          }
          converted {
            value
            currency
          }
        }
        bidMetadata {
           ... on ActiveBidMetadata {
               placedAt
               isHighestBid
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
        "itemBiddingActivity": {
            "itemBiddingActivity": {
                "activeBidHistoryRecords": {
                    "paginationOutput": {
                        "previousCursor": null,
                        "nextCursor": "Mg=="
                    },
                    "bidHistoryRecords": [
                        {
                            "bidAmount": {
                                "original": {
                                    "value": "27.0"
                                }
                            },
                            "bidder": {
                                "username": "s***r",
                                "userId": "a********r",
                            }
                        },
                        {
                            "bidAmount": {
                                "original": {
                                    "value": "26.0"
                                }
                            },
                            "bidder": {
                                "username": "o***m",
                                "userId": "P********i",
                            }
                        },
                        {
                            "bidAmount": {
                                "original": {
                                    "value": "21.0"
                                }
                            },
                            "bidder": {
                                "username": "4***9",
                                "userId": "i********k",
                            }
                        },
                        {
                            "bidAmount": {
                                "original": {
                                    "value": "20.0"
                                }
                            },
                            "bidder": {
                                "username": "6***s",
                                "userId": "R*********e",
                            }
                        }
                    ]
                },
                "cancelledBidHistoryRecords": {
                    "paginationOutput": {
                        "previousCursor": null,
                        "nextCursor": null
                    },
                    "bidHistoryRecords": []
                },
                "retractedBidHistoryRecords": {
                    "paginationOutput": {
                        "previousCursor": null,
                        "nextCursor": null
                    },
                    "bidHistoryRecords": []
                },
                "leadingBid": {
                    "buyerBiddingSummary": {
                        "bidsWithSellerPercentage": 7,
                        "retractedBidCount": 0,
                        "totalBidCount": 40,
                        "uniqueListingCategoryBidCount": 4,
                        "uniqueSellerBidCount": 23,
                        "itemBids": [
                            {
                                "bidCount": 1,
                                "mostRecentBidAt": "2026-01-15T19:25:56.000Z"
                            },
                            {
                                "bidCount": 1,
                                "mostRecentBidAt": "2026-01-15T15:24:58.000Z"
                            },
                            {
                                "bidCount": 1,
                                "mostRecentBidAt": "2026-01-14T19:25:52.000Z"
                            },
                            {
                                "bidCount": 1,
                                "mostRecentBidAt": "2026-01-14T15:52:58.000Z"
                            },
                            {
                                "bidCount": 1,
                                "mostRecentBidAt": "2026-01-13T15:42:00.000Z"
                            },
                            {
                                "bidCount": 1,
                                "mostRecentBidAt": "2026-01-09T19:00:54.000Z"
                            },
                            {
                                "bidCount": 1,
                                "mostRecentBidAt": "2026-01-07T16:09:12.000Z"
                            },
                            {
                                "bidCount": 1,
                                "mostRecentBidAt": "2026-01-06T19:36:57.000Z"
                            },
                            {
                                "bidCount": 1,
                                "mostRecentBidAt": "2026-01-06T19:36:28.000Z"
                            },
                            {
                                "bidCount": 1,
                                "mostRecentBidAt": "2026-01-06T19:18:58.000Z"
                            },
                            {
                                "bidCount": 1,
                                "mostRecentBidAt": "2026-01-06T19:15:58.000Z"
                            },
                            {
                                "bidCount": 1,
                                "mostRecentBidAt": "2026-01-06T19:10:57.000Z"
                            },
                            {
                                "bidCount": 1,
                                "mostRecentBidAt": "2026-01-06T19:04:56.000Z"
                            },
                            {
                                "bidCount": 2,
                                "mostRecentBidAt": "2026-01-06T13:46:44.000Z"
                            },
                            {
                                "bidCount": 1,
                                "mostRecentBidAt": "2026-01-02T11:19:38.000Z"
                            },
                            {
                                "bidCount": 1,
                                "mostRecentBidAt": "2026-01-01T21:04:54.000Z"
                            },
                            {
                                "bidCount": 1,
                                "mostRecentBidAt": "2025-12-30T13:24:25.000Z"
                            },
                            {
                                "bidCount": 1,
                                "mostRecentBidAt": "2025-12-30T10:38:46.000Z"
                            },
                            {
                                "bidCount": 2,
                                "mostRecentBidAt": "2025-12-30T10:35:50.000Z"
                            },
                            {
                                "bidCount": 1,
                                "mostRecentBidAt": "2025-12-30T08:51:57.000Z"
                            },
                            {
                                "bidCount": 1,
                                "mostRecentBidAt": "2025-12-30T08:26:16.000Z"
                            },
                            {
                                "bidCount": 1,
                                "mostRecentBidAt": "2025-12-30T08:20:54.000Z"
                            },
                            {
                                "bidCount": 1,
                                "mostRecentBidAt": "2025-12-30T08:03:15.000Z"
                            },
                            {
                                "bidCount": 1,
                                "mostRecentBidAt": "2025-12-29T21:32:11.000Z"
                            },
                            {
                                "bidCount": 1,
                                "mostRecentBidAt": "2025-12-29T11:43:36.000Z"
                            },
                            {
                                "bidCount": 2,
                                "mostRecentBidAt": "2025-12-29T09:42:53.000Z"
                            },
                            {
                                "bidCount": 2,
                                "mostRecentBidAt": "2025-12-29T09:42:20.000Z"
                            },
                            {
                                "bidCount": 1,
                                "mostRecentBidAt": "2025-12-28T21:12:03.000Z"
                            },
                            {
                                "bidCount": 2,
                                "mostRecentBidAt": "2025-12-28T21:10:16.000Z"
                            },
                            {
                                "bidCount": 1,
                                "mostRecentBidAt": "2025-12-28T20:23:45.000Z"
                            },
                            {
                                "bidCount": 2,
                                "mostRecentBidAt": "2025-12-28T20:18:06.000Z"
                            },
                            {
                                "bidCount": 1,
                                "mostRecentBidAt": "2025-12-28T13:21:44.000Z"
                            },
                            {
                                "bidCount": 1,
                                "mostRecentBidAt": "2025-12-27T21:51:58.000Z"
                            },
                            {
                                "bidCount": 1,
                                "mostRecentBidAt": "2025-12-27T21:38:47.000Z"
                            }
                        ]
                    },
                    "bidder": {
                        "username": "s***r",
                        "userId": "a********r",
                    },
                    "bidAmount": {
                        "original": {
                            "value": "27.0",
                            "currency": "USD"
                        },
                        "converted": {
                            "value": "37.50570",
                            "currency": "CAD"
                        }
                    },
                    "bidMetadata": {
                        "placedAt": "2026-01-13T22:42:00.000Z",
			"isHighestBid": true
                    }
                }
            }
        }
    }
}
```
