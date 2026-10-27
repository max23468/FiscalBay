# Other APIs Index

This table is the authoritative lookup for the canonical `Other APIs` inventory.

## Main Table

| Traditional operation | Status | Modern API family | Modern operation | Notes |
| --- | --- | --- | --- | --- |
| GetVeROReasonCodeDetails | Decommission | VeRO API | `getVeroReasonCode`, `getVeroReasonCodes` | Split retrieval: use the singular method for one known code and the collection method for marketplace-wide code lookup. |
| GetVeROReportStatus | Decommission | VeRO API | `getVeroReport` | Retrieves status for one submitted VeRO report by `vero_report_id`. Keep item-level retrieval separate through `getVeroReportItems` in this package. |
| VeROReportItems | Decommission | VeRO API | `getVeroReportItems` | Retrieves item-level status for VeRO reports by item ID or submitted-date filter. |
| GeteBayOfficialTime | Decommission | No replacement | No replacement | Keep the row visible; no validated modern replacement exists in the bundled inventory. |

## Coverage Notes

- The canonical Other APIs inventory contains 4 unique traditional operations across 5 CSV rows.
- The main table keeps `Decommission` rows visible even when the same row still references a usable modern VeRO REST method.
- Detailed modern VeRO support assets live under `references/operations/`.
- Exact request-path details for `getVeroReport` and `getVeroReportItems` follow the bundled schema and usage examples when CSV-derived summary pages conflict.
- Bundled traditional decommissioned doc stubs are retained alongside the modern VeRO support assets for these rows.