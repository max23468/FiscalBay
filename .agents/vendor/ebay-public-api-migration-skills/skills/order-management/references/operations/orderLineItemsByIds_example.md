# orderLineItemsByIds

**API:** Order
**Type:** GraphQL Query
**Endpoint:** `https://graphqlapi.ebay.com/graphql`
**Method:** Query
**Operation Name:** `orderLineItemsByIds`

---

## Description

This sample **orderLineItemsByIds** query retrieves one or more line items from orders using their unique IDs.

---

## Request Payload

```graphql
query mQ($input: OrderLineItemsByIdsInput!) {
  orderLineItemsByIds(input: $input) {
    __typename
    ... on OrderLineItemsByIdsSuccess {
      lineItems {
        ...LineFields
      }
    }
    ... on OrderLineItemsByIdsPartialFailure {
      errorCode
      lineItems {
        ...LineFields
      }
      failures {
        ...FailureFields
      }
    }
    ... on OrderLineItemsByIdsCompleteFailure {
      errorCode
      failures {
        ...FailureFields
      }
    }
  }
}
fragment FailureFields on LineItemsByIdsError {
  inputLineItemId
  errorCode
}
fragment LineFields on OrderLineItem {
  orderLineItemId
  purchaseMarketplace
  checkoutSource {
    __typename
  }
  lineItem {
    __typename
    ... on ContractListingItem {
      item {
        itemIdVersioned
        versionId
      }
      quantity
    }
  }
  orderReference {
    ...OrderFields
  }
}
fragment OrderFields on Order {
  orderId
  orderState {
    __typename
    ... on Labeled {
      label
    }
  }
}

# Variables
  
{
    "input": {
        "lineItemIds": [
            "10*************23"
        ]
    }
} 

```

---

## Response Sample

```json
{
    "data": {
        "orderLineItemsByIds": {
            "__typename": "OrderLineItemsByIdsSuccess",
            "lineItems": [
                {
                    "orderLineItemId": "10*************23",
                    "purchaseMarketplace": "EBAY_GB",
                    "checkoutSource": null,
                    "lineItem": {
                        "__typename": "ContractListingItem",
                        "item": {
                            "itemIdVersioned": "19********70",
                            "versionId": "19********09"
                        },
                        "quantity": 1
                    },
                    "orderReference": {
                        "orderId": "23-0***6-1***0",
                        "orderState": {
                            "__typename": "OrderConfirmed",
                            "label": "Confirmed"
                        }
                    }
                }
            ]
        }
    }
}
```
