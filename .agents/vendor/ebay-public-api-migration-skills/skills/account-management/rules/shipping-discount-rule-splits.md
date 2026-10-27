# Shipping Discount Rule Splits

Use this rule when migrating `GetShippingDiscountProfiles` or `SetShippingDiscountProfiles`.

## Rules

- Treat `GetShippingDiscountProfiles` as a read of combined-shipping configuration through `getCombinedShippingRules`.
- Split `SetShippingDiscountProfiles` by rule type and action. The authoritative CSV maps the traditional write flow to:
  - `createCalculatedShippingRules`
  - `createFlatShippingRules`
  - `createPromotionalShippingRule`
  - `updateCalculatedShippingRules`
  - `updateCombinedPayments`
  - `updateFlatShippingRules`
  - `updatePromotionalShippingRule`
- Do not invent a unified modern payload. Use the bundled modern doc and example files to choose the operation-specific request body and endpoint by rule type and action.
- Preserve the distinction between calculated, flat, promotional, and combined-payment behavior. They are separate modern operations, not just variants inside one generic update call.

## Workflow Notes

- Use the traditional doc extract to understand the original flat, calculated, promotional, and combined-payment inputs.
- Use [references/operation-mapping.md](../references/operation-mapping.md) for partner-facing endpoint selection.
- Use the bundled usage examples for request-body shape. For the create and update methods, preserve the documented HTTP `204 No Content` success behavior instead of inventing a JSON response body.