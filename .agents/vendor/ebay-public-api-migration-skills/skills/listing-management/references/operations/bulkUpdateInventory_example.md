# bulkUpdateInventory

**API:** Listing
**Type:** GraphQL Mutation
**Endpoint:** `https://graphqlapi.ebay.com/graphql`
**Method:** Mutation
**Operation Name:** `bulkUpdateInventory`

---

## Description

This sample **bulkUpdateInventory** mutation performs a bulk update of price and quantity for multiple fixed price items for a single-SKU or multi-SKU listing.

---

## Request Payload

```graphql
mutation BulkUpdateInventoryPriceQuantity($input: BulkUpdateInventoryInput!) {
  bulkUpdateInventory(input: $input) {
    ... on BulkUpdateInventorySuccess {
      successes {
        listingItemIdentifier {
          listingId
          sku
        }
        warnings {
          warningCode
          warningMessage
        }
      }
    }
    ... on BulkUpdateInventoryPartialFailure {
      errorCode
      errorMessage
      successes {
        listingItemIdentifier {
          listingId
          sku
        }
        warnings {
          warningCode
          warningMessage
        }
      }
      failures {
        listingItemIdentifier {
          listingId
          sku
        }
        violations {
          violationCode
          violationDescription
          inputPath
          additionalInformation { name value }
        }
        warnings {
          warningCode
          warningMessage
        }
      }
    }
    ... on BulkUpdateInventoryFailure {
      errorCode
      errorMessage
      failures {
        listingItemIdentifier {
          listingId
          sku
        }
        violations {
          violationCode
          violationDescription
          inputPath
          additionalInformation { name value }
        }
        warnings {
          warningCode
          warningMessage
        }
      }
    }
  }
}

# Variables

{
  "input": {
    "inventory": [
      {
        "listingItemIdentifier": { "listingId": "1********7" },
        "fixedPrice": 1901.99,
        "availableQuantity": 6
      }
    ]
  }
}
```

---

## Response Sample

```json
{
    "data": {
        "bulkUpdateInventory": {
            "successes": [
                {
                    "listingItemIdentifier": {
                        "listingId": "1********7",
                        "sku": "S********7"
                    },
                    "warnings": null
                }
            ]
        }
    }
}
```
