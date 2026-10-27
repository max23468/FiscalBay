# updateSellerRMAPreference

**API:** Return
**Type:** GraphQL Mutation
**Endpoint:** `https://graphqlapi.ebay.com/graphql`
**Method:** Mutation
**Operation Name:** `updateSellerRMAPreference`

---

## Description

This sample **updateSellerRmaPreference** mutation enables the seller's Return Merchandise Authorization (RMA) preference for the EBAY_US listing marketplace.

---

## Request Payload

```graphql
mutation UpdateSellerRmaPreference($input: UpdateSellerRmaPreferenceInput!) {
  updateSellerRmaPreference(input: $input) {
    __typename
    ... on SellerReturnPreferences {
      listingMarketplace
      rmaPreference {
        preferenceStatus
      }
    }
    ... on ReturnPreferenceNotFoundError {
      errorCode
      errorMessage
    }
  }
}

# Variables

{
  "input": {
    "listingMarketplace": "EBAY_US",
    "rmaPreference": {
      "preferenceStatus": "ENABLED"
    }
  }
}

```

---

## Response Sample

```json
{
    "data": {
        "updateSellerRmaPreference": {
            "__typename": "SellerReturnPreferences",
            "listingMarketplace": "EBAY_US",
            "rmaPreference": {
                "preferenceStatus": "ENABLED"
            }
        }
    }
}
```
