# End Listings With An Explicit Reason

## Why this matters

Ending flows still require the listing identifier and an explicit end reason.

## Rule

- Use `endListing` for `EndItem`, `EndFixedPriceItem`, and repeated modern calls for `EndItems`.
- Supply the listing identifier in the modern identifier object.
- Preserve the business reason for ending the listing.

## Example

**SOAP (before):**

```xml
<EndItemRequest>
  <ItemID>1234567890</ItemID>
  <EndingReason>NotAvailable</EndingReason>
</EndItemRequest>
```

**GraphQL (after):**

```json
{
  "input": {
    "listingIdentifierInput": {
      "listingId": "1234567890"
    },
    "endListingReason": "NOT_AVAILABLE"
  }
}
```

## Notes

- `EndItems` is a traditional batch convenience, not a separate modern capability.
- `endListing` initially supports one listing per operation; for bulk-ending, orchestrate repeated calls or move the flow to the Sell Feed API.
