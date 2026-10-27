# userBiddingActivity

**API:** Auction
**Type:** GraphQL Query
**Endpoint:** `https://graphqlapi.ebay.com/graphql`
**Method:** Query
**Operation Name:** `userBiddingActivity`

---

## Description

This sample **userBiddingActivity **query retrieves a list of all items a user is currently bidding on or has previously won or purchased.

---

## Request Payload

```graphql
query UserBiddingActivity {
    userBiddingActivity (input: {filter: {paginationInput: { maxPageSize: 2 } }})
        {
        auctions {
            itemId
            auctionDataSummary {
                leadingBid {
                    bidAmount {
                        original {
                            currency
                            value
                        }
                        converted {
                            currency
                            value
                        }
                    }
                    bidder {
                        userId
                    }
                }
            }
        }
        paginationOutput {
            nextCursor
            previousCursor
        }
    }
}
```

---

## Response Sample

```json
{
    "data": {
        "userBiddingActivity": {
            "auctions": [
                {
                    "itemId": "1********4",
                    "auctionDataSummary": {
                        "leadingBid": {
                            "bidAmount": {
                                "original": {
                                    "currency": "CAD",
                                    "value": "5.02"
                                },
                                "converted": null
                            },
                            "bidder": {
                                "userId": "s********1"
                            }
                        }
                    }
                },
                {
                    "itemId": "5********8",
                    "auctionDataSummary": {
                        "leadingBid": {
                            "bidAmount": {
                                "original": {
                                    "currency": "USD",
                                    "value": "1.25"
                                },
                                "converted": {
                                    "currency": "CAD",
                                    "value": "1.736375"
                                }
                            },
                            "bidder": {
                                "userId": "s********2"
                            }
                        }
                    }
                }
            ],
            "paginationOutput": {
                "nextCursor": "eyJvZmZzZXQiOjN9",
                "previousCursor": null
            }
        }
    }
}
```
