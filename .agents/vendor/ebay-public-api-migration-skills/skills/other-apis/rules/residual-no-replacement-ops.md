# Treat Residual Utility Rows As Removal Or Redesign

## Why this matters

Some Other APIs rows remain in the inventory only so migration plans do not silently lose removed capabilities.

## Applies To

- `GeteBayOfficialTime`

## Rule

- Keep the rows visible in migration analysis even though there is no validated modern replacement.
- Redesign the dependent feature locally or remove the dependency entirely.
- Do not invent a direct eBay API substitute when the canonical inventory says `No replacement`.

## Notes

- These rows are decommissioned in the canonical Other APIs inventory.
- The public documentation reviewed for this skill does not provide enough evidence to claim a fallback endpoint for this operation.