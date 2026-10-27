# sellerListingSearch

**API:** Listing
**Type:** GraphQL Query
**Endpoint:** `https://graphqlapi.ebay.com/graphql`
**Method:** Query
**Operation Name:** `sellerListingSearch`

---

## Description

This sample **sellerListingSearch** query allows a seller to search and retrieve their listings across three categories: active, ended, and scheduled.

---

## Request Payload

```graphql
query sellerListingSearch {
  activeListings(
    searchInput: {
      filters: { primaryCategoryIds: ["6004"] }
      pagination: { maxPageSize: 50 }
    }
  ) {
    ... on SellerListings {
      listings {
        listingId
      }
      pagination {
        totalElements
      }
    }
  }

  # Scheduled listings
  scheduledListings(
    searchInput: {
      filters: {
        startAtRange: {
          startAt: "2026-03-27T00:00:00.000Z"
          endAt: "2026-03-27T23:59:59.999Z"
        }
      }
      pagination: { maxPageSize: 20 }
    }
  ) {
    ... on SellerListings {
      listings {
        listingId
      }
      pagination {
        totalElements
      }
    }
  }

  # Ended unsold listings
  endedListings(
    searchInput: {
      filters: {
        endAtRange: {
          startAt: "2026-03-20T00:00:00.000Z"
          endAt: "2026-03-26T23:59:59.999Z"
        }
      }
      pagination: { maxPageSize: 30 }
    }
  ) {
    ... on SellerListings {
      listings {
        listingId
      }
      pagination {
        totalElements
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
        "sellerListingSearch": {
            "activeListings": {
                "listings": [
                    {
                        "listingId": "3********4"
                    }
                ]
            },
            "endedListings": {
                "listings": [
                    {
                        "listingId": "3********5"
                    },
                    {
                        "listingId": "2********7"
                    },
                    {
                        "listingId": "3********5"
                    },
                    {
                        "listingId": "2********1"
                    },
                    {
                        "listingId": "2********5"
                    }
                ]
            },
            "scheduledListings": {
                "listings": []
            }
        }
    }
}
```
