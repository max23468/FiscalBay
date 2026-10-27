# User Retrieval And Preferences

Use this rule when migrating `GetUser`, `GetUserPreferences`, or `SetUserPreferences`.

## Rules

- Prefer GraphQL `user` when the migration needs scope-driven selective profile retrieval, seller-profile shaping, or identity fields that benefit from a single GraphQL selection set.
- Prefer Identity REST `getUser` when the integration is already REST-oriented and only needs the authenticated account profile from `/commerce/identity/v1/user/`.
- Do not assume `GetUser` has a single modern replacement. The authoritative CSV validates both GraphQL and REST targets.
- Preserve the privacy difference between traditional `GetUser` and `GetUserContactDetails`. The traditional contact-details call retrieves another user's PII and does not have a validated modern replacement.
- For `GetUserPreferences`, request only the preference groups required by the workflow. The traditional SOAP request is flag-driven, and the mapped modern endpoint should be treated as account-preference retrieval rather than a full account dump.
- For `SetUserPreferences`, keep the PATCH body limited to the preference groups that are changing, keep `X-EBAY-C-MARKETPLACE-ID` explicit, and expect HTTP `204 No Content` on success.

## Workflow Notes

- Review [references/operation-mapping.md](../references/operation-mapping.md) before choosing between GraphQL and REST for `GetUser`.
- Use the bundled Account API v2 modern doc and example files when you need concrete preference request or response payloads.
- Keep OAuth scope language explicit when using GraphQL `user` or Identity REST `getUser`; both modern targets are scope-sensitive.