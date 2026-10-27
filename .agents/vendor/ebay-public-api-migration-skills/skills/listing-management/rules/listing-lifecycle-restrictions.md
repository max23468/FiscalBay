# Preserve Listing Lifecycle Restrictions

## Why this matters

Several non-transport rules still affect successful Listing API migrations.

## Rule

- Keep public listing revision restrictions visible.
- Warn that auction revisions become more restrictive in late-stage auction states.
- Preserve the note that a relisted item receives a new listing identifier.

## Notes

- Verify-style traditional calls can still map to validation mode, but they do not change modern execution constraints.
