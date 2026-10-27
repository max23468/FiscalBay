# Digital Signature Sensitive Ops

Use this rule whenever a migration answer includes refund or cancellation methods that are listed in the bundled digital-signatures guide.

## Rule

- For EU- or UK-domiciled sellers, add the required digital-signature headers when calling in-scope refund or cancellation methods.
- Keep the guidance scoped to the documented in-scope methods only.

## In-Scope Methods Relevant To This Domain

- Post-Order replacements for `IssueInquiryRefund`, `IssueCaseRefund`, `IssueReturnRefund`, `ProcessReturnRequest`, `CreateCancellationRequest`, and `ApproveCancellation`
- Fulfillment API `issueRefund` when that surface is used outside the GraphQL replacement set

## Required Headers

- `x-ebay-signature-key`
- `Signature`
- `Signature-Input`
- `Content-Digest` when a payload is present

