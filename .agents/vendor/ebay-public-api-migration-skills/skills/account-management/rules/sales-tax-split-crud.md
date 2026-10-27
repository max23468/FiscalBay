# Sales Tax Split CRUD

Use this rule when migrating `GetTaxTable` or `SetTaxTable`.

## Rules

- Map `GetTaxTable` to `getSalesTaxes` when the caller needs the full configured table for a country.
- Map `GetTaxTable` to `getSalesTax` when the caller needs one jurisdiction inside a country.
- Map `SetTaxTable` to `bulkCreateOrReplaceSalesTax` for bulk updates across multiple jurisdictions.
- Map `SetTaxTable` to `createOrReplaceSalesTax` for a single jurisdiction update.
- Keep deletion logic explicit. The Account Management guide documents `deleteSalesTax`, but the authoritative CSV does not list it as the primary mapped replacement for `SetTaxTable`; treat it as adjacent modern maintenance capability rather than the canonical migration target.

## Workflow Notes

- Use country and jurisdiction routing to select the modern operation instead of reusing the traditional SOAP request shape.
- Prefer the bundled REST examples for `getSalesTax`, `getSalesTaxes`, and tax-table writes when illustrating payload transformation.
- Use [references/operation-mapping.md](../references/operation-mapping.md) for the consolidated migration notes and support-file links.