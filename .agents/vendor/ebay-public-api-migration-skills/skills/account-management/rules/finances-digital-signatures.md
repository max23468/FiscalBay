# Finances Digital Signatures

Use this rule when migrating `GetAccount` or when a replacement flow uses the Finances API.

## Rules

- Treat `GetAccount` and all Finances API methods as signature-sensitive for EU- or UK-domiciled sellers.
- For signed requests with an HTTP payload, include `x-ebay-signature-key`, `Content-Digest`, `Signature`, and `Signature-Input`.
- For signed GET requests without a payload, omit `Content-Digest` and build `Signature-Input` without it.
- Do not collapse signature handling into a finance-only afterthought. The digital-signature requirement changes the transport contract for both the traditional `GetAccount` migration path and the mapped Finances API operations.
- Keep the primary mapping inventory authoritative. Digital-signature guidance adds an implementation rule; it does not change which modern operations replace `GetAccount`.

## Workflow Notes

- Use `getBillingActivities` when the migration is billing-activity oriented.
- Use `getTransactions` when the migration needs transaction-ledger detail, order-linked finance records, or refund and payout state visibility.
- Check [references/operation-mapping.md](../references/operation-mapping.md) for the split mapping and support-file links before choosing the endpoint.