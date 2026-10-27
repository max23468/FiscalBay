# Authorization Index

This table is the primary lookup for the `Authorization` migration inventory.

## Main Table

| Traditional operation | Status | Modern API replacements and notes |
| --- | --- | --- |
| ConfirmIdentity | No replacement | None; to be decommissioned This functionality is not needed as a part of OAuth |
| FetchToken | Replace with Oauth api/flow | None; to be decommissioned This functionality is not needed as a part of OAuth |
| GetSessionID | Replace with Oauth api/flow | None; to be decommissioned This functionality is not needed as a part of OAuth |
| GetTokenStatus | The capability of this call will be migrated to OAuth tokens. More details to follow. |  |
| RevokeToken | The capability of this call will be migrated to OAuth tokens. More details to follow. |  |

## Decommissioned Rows

| Traditional operation | Status | Modern API replacements and notes |
| --- | --- | --- |
| GetChallengeToken | Decommission | No replacement |
| ValidateTestUserRegistration | Decommission | No replacement |

## Coverage Notes

- The Authorization migration inventory contains 7 unique traditional operations.
- All 7 rows are represented in this index.
- Rows marked `Replace with Oauth api/flow` must be answered with OAuth flow and token-lifecycle guidance; do not invent a one-to-one replacement endpoint.
