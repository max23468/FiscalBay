# Traditional Authorization Migration Status

This document summarizes migration status guidance for the Authorization domain.

Status derived from the current migration inventory for the Authorization domain:

| Traditional API | Status | Guidance |
| --- | --- | --- |
| `ConfirmIdentity` | No replacement | Retire the old IDVerification confirmation step. |
| `FetchToken` | Replace with Oauth api/flow | None; to be decommissioned This functionality is not needed as a part of OAuth |
| `GetSessionID` | Replace with Oauth api/flow | None; to be decommissioned This functionality is not needed as a part of OAuth |
| `GetTokenStatus` | Replace with Oauth api/flow | The capability of this call will be migrated to OAuth tokens. More details to follow. |
| `RevokeToken` | Replace with Oauth api/flow | The capability of this call will be migrated to OAuth tokens. More details to follow. |
| `GetChallengeToken` | Decommissioned | No replacement. |
| `ValidateTestUserRegistration` | Decommissioned | No replacement. |

## Interpretation Rules

- If the mapping says `Replace with Oauth api/flow`, the safe partner-facing answer is a flow-level migration explanation, not an invented REST or GraphQL endpoint.
- If the mapping says `Decommission` or `No replacement`, say so plainly and avoid fabricating a successor API.