# Keep VeRO Reporting As A Multi-Step Flow

## Why this matters

The Other APIs guide describes VeRO reporting as a sequence, not as one monolithic traditional-style call surface.

## Rule

- Retrieve supported reason codes first when the integration does not already know a valid `veroReasonCodeId`.
- Create reports through `createVeroReport` when the broader workflow includes submission.
- Use `getVeroReport` for one report's status and `getVeroReportItems` for item-level status or date-bounded retrieval.
- Do not collapse report-status and reported-item retrieval into one synthetic replacement call.

## Notes

- The canonical Other APIs inventory only maps the retrieval rows, but the guide still requires awareness of the surrounding VeRO reporting flow.
- `getVeroReport` and `getVeroReportItems` solve different post-submission questions and should stay separate in migration plans.