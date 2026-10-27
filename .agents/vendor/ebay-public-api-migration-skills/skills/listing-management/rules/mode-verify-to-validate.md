# Convert Verify Operations To VALIDATE Mode

## Why this matters

Within the Listing Management package, these Listing API flows collapse separate verify calls into the same GraphQL mutation used for execution. Modern validation is a mode on the mutation, not a separate operation family.

## Applies To

- `VerifyAddFixedPriceItem -> createListing`
- `VerifyAddItem -> createListing`
- `VerifyRelistItem -> relistListing`
- `VerifyAddSecondChanceItem -> createSecondChanceListing`

## Rule

- Use the modern GraphQL mutation named in `INDEX.md`.
- Set `options.operationMode` to `VALIDATE`.
- Keep the rest of the payload aligned with the execute form of the mutation.

## Example

**SOAP (before):**

```xml
<VerifyAddItemRequest>
  <Item>
    <Title>Test product</Title>
    <StartPrice currencyID="USD">25.99</StartPrice>
    <Quantity>5</Quantity>
  </Item>
</VerifyAddItemRequest>
```

**GraphQL (after):**

```json
{
  "input": {
    "idempotencyKey": "verify-example-001",
    "marketplace": "EBAY_US",
    "product": {
      "title": "Test product"
    },
    "listingItems": {
      "items": [
        {
          "itemTerms": {
            "availability": {
              "quantityAvailable": 5
            }
          }
        }
      ]
    },
    "listingTerms": {
      "listingFormat": "FIXED_PRICE",
      "lifecycleTerms": {
        "listingDurationInDays": "GTC"
      }
    },
    "options": {
      "operationMode": "VALIDATE"
    }
  }
}
```

## Notes

- A validation flow does not preserve the old separate-operation boundary, so migration plans should treat verify and execute variants as one modern integration point.
