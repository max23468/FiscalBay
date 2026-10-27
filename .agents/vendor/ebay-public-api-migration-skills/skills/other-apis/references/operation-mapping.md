# Other APIs Operation Mapping

This file is the authoritative operation-level mapping reference for the Other APIs domain.

## VeRO reason-code retrieval

### GetVeROReasonCodeDetails (Decommissioned) -> getVeroReasonCode + getVeroReasonCodes
Purpose:

- Retrieve VeRO reason-code information that rights owners use when preparing infringement reports.

Modern API:

- REST methods `getVeroReasonCode` and `getVeroReasonCodes` in the VeRO API.

Key Differences:

- The canonical inventory marks this row as `Decommission`, but the migration guidance still directs users to VeRO REST reason-code retrieval methods.
- The traditional lookup now splits into two REST choices: one method for a specific known code and one for listing supported codes, optionally filtered by marketplace.
- All mapped modern methods require VeRO program access and the `https://api.ebay.com/oauth/api_scope/commerce.vero` scope.

Request Payload Transformation:

- Traditional: [GetVeROReasonCodeDetails_doc.md](operations/GetVeROReasonCodeDetails_doc.md), [GetVeROReasonCodeDetails_example.md](operations/GetVeROReasonCodeDetails_example.md)
- Modern: [getVeroReasonCode_example.md](operations/getVeroReasonCode_example.md), [getVeroReasonCodes_example.md](operations/getVeroReasonCodes_example.md)

**REST (after, known code):**

```http
GET /commerce/vero/v1/vero_reason_code/{vero_reason_code_id}
Authorization: Bearer <accessToken>
```

**REST (after, marketplace-wide lookup):**

```http
GET /commerce/vero/v1/vero_reason_code
Authorization: Bearer <accessToken>
X-EBAY-C-MARKETPLACE-ID: EBAY_US
```

Response Payload Transformation:

- Traditional: [GetVeROReasonCodeDetails_doc.md](operations/GetVeROReasonCodeDetails_doc.md), [GetVeROReasonCodeDetails_example.md](operations/GetVeROReasonCodeDetails_example.md)
- Modern: [getVeroReasonCode_example.md](operations/getVeroReasonCode_example.md), [getVeroReasonCodes_example.md](operations/getVeroReasonCodes_example.md)

**REST (after, collection shape):**

```json
{
  "veroReasonCodes": [
    {
      "marketplaceId": "EBAY_US",
      "reasonCodeDetails": [
        {
          "briefText": "Other infringement",
          "detailedText": "Other - Provide details information in additional information box below.",
          "veroReasonCodeId": "9052"
        }
      ]
    }
  ]
}
```

Related Patterns:

- [operations/GetVeROReasonCodeDetails_doc.md](operations/GetVeROReasonCodeDetails_doc.md)
- [operations/GetVeROReasonCodeDetails_example.md](operations/GetVeROReasonCodeDetails_example.md)
- [operations/getVeroReasonCode_doc.md](operations/getVeroReasonCode_doc.md)
- [operations/getVeroReasonCode_example.md](operations/getVeroReasonCode_example.md)
- [operations/getVeroReasonCodes_doc.md](operations/getVeroReasonCodes_doc.md)
- [operations/getVeroReasonCodes_example.md](operations/getVeroReasonCodes_example.md)
- [../rules/vero-program-prerequisite.md](../rules/vero-program-prerequisite.md)

Migration Guide:

- VeRO API

## VeRO report tracking

### GetVeROReportStatus (Decommissioned) -> getVeroReport
Purpose:

- Retrieve status information for one submitted VeRO report.

Modern API:

- REST method `getVeroReport` in the VeRO API.

Key Differences:

- The modern method retrieves report status by `vero_report_id` in the path.
- Use `getVeroReportItems` for broader item-level retrieval by item ID or submission-date filtering across reported items.
- The canonical inventory marks the row as `Decommission`, so keep that status visible in migration planning.
- The broader VeRO reporting flow still includes `createVeroReport` before this retrieval step.
- A bundled local REST doc page exists for this method and documents the `/commerce/vero/v1/vero_report` surface; this package uses the bundled example for the operation-specific `/{vero_report_id}` route.

Request Payload Transformation:

- Traditional: [GetVeROReportStatus_doc.md](operations/GetVeROReportStatus_doc.md), [GetVeROReportStatus_example.md](operations/GetVeROReportStatus_example.md)
- Modern: [getVeroReportItems_example.md](operations/getVeroReportItems_example.md), [getVeroReport_example.md](operations/getVeroReport_example.md)


Response Payload Transformation:

- Traditional: [GetVeROReportStatus_doc.md](operations/GetVeROReportStatus_doc.md), [GetVeROReportStatus_example.md](operations/GetVeROReportStatus_example.md)
- Modern: [getVeroReportItems_example.md](operations/getVeroReportItems_example.md), [getVeroReport_example.md](operations/getVeroReport_example.md)


Related Patterns:

- [operations/GetVeROReportStatus_doc.md](operations/GetVeROReportStatus_doc.md)
- [operations/GetVeROReportStatus_example.md](operations/GetVeROReportStatus_example.md)
- [operations/getVeroReport_doc.md](operations/getVeroReport_doc.md)
- [operations/getVeroReport_example.md](operations/getVeroReport_example.md)
- [../rules/vero-report-tracking-flow.md](../rules/vero-report-tracking-flow.md)

Migration Guide:

- VeRO API

### VeROReportItems (Decommissioned) -> getVeroReportItems
Purpose:

- Retrieve item-level status for one or more items reported through the VeRO workflow.

Modern API:

- REST method `getVeroReportItems` in the VeRO API.

Key Differences:

- The modern method retrieves reported items through either an `itemId` query parameter or a `filter` on `reportSubmittedDate`.
- Pagination is explicit through `limit` and `offset`.
- The inventory marks the row as `Decommission`, but the migration guides still direct users to this VeRO REST method for reported-item status.
- A bundled local REST doc page exists for this method and preserves a singular `/vero_report_item` request URL, while the bundled response example uses plural `/vero_report_items` in `href`.

Request Payload Transformation:

- Traditional: [VeROReportItems_doc.md](operations/VeROReportItems_doc.md), [VeROReportItems_example.md](operations/VeROReportItems_example.md)
- Modern: [getVeroReportItems_example.md](operations/getVeroReportItems_example.md)


Response Payload Transformation:

- Traditional: [VeROReportItems_doc.md](operations/VeROReportItems_doc.md), [VeROReportItems_example.md](operations/VeROReportItems_example.md)
- Modern: [getVeroReportItems_example.md](operations/getVeroReportItems_example.md)


Related Patterns:

- [operations/VeROReportItems_doc.md](operations/VeROReportItems_doc.md)
- [operations/VeROReportItems_example.md](operations/VeROReportItems_example.md)
- [operations/getVeroReportItems_doc.md](operations/getVeroReportItems_doc.md)
- [operations/getVeroReportItems_example.md](operations/getVeroReportItems_example.md)
- [../rules/vero-report-tracking-flow.md](../rules/vero-report-tracking-flow.md)

Migration Guide:

- VeRO API

## Removed utility operations

### GeteBayOfficialTime (Decommissioned) -> No replacement
Purpose:

- Traditional utility operation kept in the canonical inventory for migration planning visibility.

Modern API:

- No replacement.

Key Differences:

- The canonical Other APIs inventory marks this row as `Decommission` with `No replacement`.
- The public documentation reviewed for this skill does not provide a validated modern endpoint or fallback API for this row, and this package does not include a local traditional doc-page extract.

Related Patterns:

- [operations/GeteBayOfficialTime_doc.md](operations/GeteBayOfficialTime_doc.md)
- [../rules/residual-no-replacement-ops.md](../rules/residual-no-replacement-ops.md)