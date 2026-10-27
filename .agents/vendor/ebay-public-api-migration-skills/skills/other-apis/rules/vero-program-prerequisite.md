# Require VeRO Program Access Before Migration

## Why this matters

All active modern mappings in this package point to VeRO API methods that are restricted to Verified Rights Owner program members.

## Applies To

- `GetVeROReasonCodeDetails -> getVeroReasonCode`
- `GetVeROReasonCodeDetails -> getVeroReasonCodes`
- `GetVeROReportStatus -> getVeroReport`
- `VeROReportItems -> getVeroReportItems`

## Rule

- Confirm that the integration has access to the VeRO program before treating any of these rows as executable modern API migrations.
- Use the `https://api.ebay.com/oauth/api_scope/commerce.vero` scope for the mapped REST calls.
- Keep this prerequisite visible in migration plans instead of assuming ordinary seller scopes are sufficient.

## Notes

- Public VeRO API documentation lists all covered VeRO methods with the VeRO OAuth scope.
- If the caller is not a VeRO participant, migration work may stop at planning or redesign rather than direct implementation.