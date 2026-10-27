# sellerReturnPreference

**API:** Return Rules
**Type:** GraphQL Query
**Endpoint:** `https://graphqlapi.ebay.com/graphql`
**Method:** Query
**Operation Name:** `sellerReturnPreference`

---

## Description

This sample **sellerReturnPreference** query retrieves the return preferences set by a seller on the specified marketplace.

---

## Request Payload

```graphql
query SellerReturnPreference($input: SellerReturnPreferenceInput!) {
  sellerReturnPreference(input: $input) {
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
    "listingMarketplace": "EBAY_US"
  }
}
```

---

## Response Sample

```json
{
    "data": {
        "sellerReturnPreference": {
            "__typename": "SellerReturnPreferences",
            "listingMarketplace": "EBAY_US",
            "rmaPreference": {
                "preferenceStatus": "DISABLED"
            }
        }
    }
}
```
