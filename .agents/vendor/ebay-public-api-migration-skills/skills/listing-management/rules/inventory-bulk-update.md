# Use Bulk Inventory Updates For Price And Quantity Changes

## Why this matters

The mapping inventory gives `ReviseInventoryStatus` a dedicated target: `bulkUpdateInventory`. This path is distinct from full listing revision.

## Rule

- Use `bulkUpdateInventory` when the traditional task is limited to price and quantity updates.
- Do not use this path for broader listing content changes such as title, description, category, or aspect updates.

## Example

**SOAP (before):**

```xml
<ReviseInventoryStatusRequest>
  <InventoryStatus>
    <ItemID>1234567890</ItemID>
    <SKU>SKU-RED-L</SKU>
    <StartPrice currencyID="USD">29.99</StartPrice>
    <Quantity>8</Quantity>
  </InventoryStatus>
</ReviseInventoryStatusRequest>
```

**GraphQL (after):**

```json
{
  "updates": [
    {
      "listingId": "1234567890",
      "sku": "SKU-RED-L",
      "price": {
        "value": "29.99",
        "currency": "USD"
      },
      "quantity": 8
    }
  ]
}
```

## Notes

- If the migration task also revises descriptive or structural listing fields, move back to `updateListing` guidance.
