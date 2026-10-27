# Convert Variations To Items And Listing Variations

## Why this matters

The Listing API handles multi-SKU inventory as explicit items plus shared variation metadata. Traditional nested variation structures do not carry over directly.

## Rule

- Convert each traditional variation into one modern item entry.
- Preserve the SKU at the item level.
- Move shared variation metadata into the modern listing-level variation structure.

## Example

**SOAP (before):**

```xml
<Variations>
  <Variation>
    <SKU>TSHIRT-RED-L</SKU>
    <StartPrice currencyID="USD">19.99</StartPrice>
    <Quantity>10</Quantity>
  </Variation>
  <Variation>
    <SKU>TSHIRT-BLUE-M</SKU>
    <StartPrice currencyID="USD">19.99</StartPrice>
    <Quantity>15</Quantity>
  </Variation>
</Variations>
```

**GraphQL (after):**

```json
{
  "input": {
    "listingItems": {
      "items": [
        {
          "sku": "TSHIRT-RED-L",
          "itemTerms": {
            "availability": {
              "quantityAvailable": 10
            },
            "pricingTerms": {
              "fixedPrice": 19.99
            }
          }
        },
        {
          "sku": "TSHIRT-BLUE-M",
          "itemTerms": {
            "availability": {
              "quantityAvailable": 15
            },
            "pricingTerms": {
              "fixedPrice": 19.99
            }
          }
        }
      ]
    }
  }
}
```

## Notes

- Keep the shared variation structure and per-item unique traits aligned when building multiple-SKU listing payloads.
