# Removed Traditional Rows

Use this rule when the canonical CSV marks an operation as decommissioned or no replacement.

## Rule

- Keep the traditional row visible in migration planning.
- Do not invent a seller-side API replacement for removed helper flows such as return drafts, inquiry creation, or shipping-label eligibility checks.
- If surrounding seller workflows remain, describe them only as context in `Migration Note`, not as a direct one-to-one replacement.

## Common Examples In This Domain

- `CreateReturnRequest`
- `CreateInquiry`
- `CreateReturnDraft`
- `CheckReturnEligibility`
- `CheckShippingLabelPrintEligibility`

