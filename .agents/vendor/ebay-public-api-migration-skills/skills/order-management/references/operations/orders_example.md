# orders

**API:** Order
**Type:** GraphQL Query
**Endpoint:** `https://graphqlapi.ebay.com/graphql`
**Method:** Query
**Operation Name:** `orders`

---

## Description

This sample **orders** query retrieves detailed information about one or more of a user's orders.

---

## Request Payload

```graphql
query sellerOrders($input: OrdersInput!) {
  ... on Query {
    orders {
      sellerOrders(input: $input) {
        orders {
          orderId
          buyer {
            legacyUserId
          }
        }
        pagination {
          previousCursor
          nextCursor
        }
      }
    }
  }
}

# Variables
{
    "input": {
        "ordersFirstPage": {
            "maxPageSize": 5,
            "filter": {
                "dateRange": {
                    "dateTimeRange": {
                        "startDateTime": "20**-11-17T06:51:26.864Z",
                        "endDateTime": "20**-01-17T06:51:26.864Z"
                    },
                    "dateType": "CONFIRMED"
                },
                "filter": {
                    "includeConfirmed": true,
                    "includeCancelled": true,
                    "includeAbandoned": true,
                    "includePlaced": true
                },
                "sort": {
                    "sortField": "CONFIRMED_AT",
                    "sortOrder": "ASC"
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
        "orders": {
            "sellerOrders": {
                "orders": [
                    {
                        "orderId": "01-0***8-3***1",
                        "buyer": {
                            "legacyUserId": "EXAMPLE_BUYER_ID"
                        }
                    },
                    {
                        "orderId": "01-0***8-3***2",
                        "buyer": {
                            "legacyUserId": "EXAMPLE_BUYER_ID"
                        }
                    },
                    {
                        "orderId": "01-0***8-3***3",
                        "buyer": {
                            "legacyUserId": "EXAMPLE_BUYER_ID"
                        }
                    },
                    {
                        "orderId": "01-0***8-3***4",
                        "buyer": {
                            "legacyUserId": "EXAMPLE_BUYER_ID"
                        }
                    },
                    {
                        "orderId": "01-0***8-3***5",
                        "buyer": {
                            "legacyUserId": "EXAMPLE_BUYER_ID"
                        }
                    }
                ],
                "pagination": {
                    "previousCursor": null,
                    "nextCursor": "eyJj******************* ... *******************X0="
                }
            }
        }
    }
}
```
