# Other APIs Intents

Use this file when the migration problem is easier to describe as a task than as a single traditional operation lookup.

Answer rule:

- When the selected `references/operation-mapping.md` entry includes guide-derived `Migration Guide:` bullets such as `Key changes`, `Key things to know`, prerequisites, sequencing, or caveats, include those points in the answer instead of returning only the replacement name.

## Intent: Find The Right VeRO Reason-Code Lookup

When to use it:

- You are converting `GetVeROReasonCodeDetails`.

Recommended workflow:

1. Start with `INDEX.md` and confirm that this traditional row is a split mapping.
2. Use `getVeroReasonCode` when the integration already knows the specific `vero_reason_code_id`.
3. Use `getVeroReasonCodes` when the integration needs all codes or marketplace-scoped codes first.
4. Apply `rules/vero-program-prerequisite.md` before implementation because both methods require VeRO program access and the VeRO OAuth scope.
5. Open the support files in `references/operations/` for the exact REST path, header usage, and example payloads.

Navigate next:

- `INDEX.md`
- `references/operation-mapping.md`
- `references/operations/getVeroReasonCode_doc.md`
- `references/operations/getVeroReasonCode_example.md`
- `references/operations/getVeroReasonCodes_doc.md`
- `references/operations/getVeroReasonCodes_example.md`
- `rules/vero-program-prerequisite.md`

## Intent: Check VeRO Report Status

When to use it:

- You are converting `GetVeROReportStatus`.

Recommended workflow:

1. Confirm in `INDEX.md` that the modern target is `getVeroReport`.
2. Preserve the submitted VeRO report identifier and decide whether item-level details are also needed.
3. Keep `getVeroReport` focused on report status, and route item-level retrieval to `getVeroReportItems` when that detail is required.
4. Use `rules/vero-report-tracking-flow.md` if the original workflow also created the VeRO report or retrieved reported-item status separately.
5. Open the support files for the exact REST path, parameters, and example response shape.

Navigate next:

- `INDEX.md`
- `references/operation-mapping.md`
- `references/operations/getVeroReport_doc.md`
- `references/operations/getVeroReport_example.md`
- `rules/vero-report-tracking-flow.md`

## Intent: Retrieve Item-Level VeRO Report Results

When to use it:

- You are converting `VeROReportItems`.

Recommended workflow:

1. Confirm that the row maps to `getVeroReportItems`.
2. Decide whether the migration should query by a single `itemId` or by a submitted-date range in `filter`.
3. Preserve pagination handling through `limit` and `offset` if the traditional workflow enumerated many reported items.
4. Use `rules/vero-report-tracking-flow.md` to keep the sequence between report creation, report retrieval, and item retrieval clear.
5. Open the modern doc and example support files for the bundled parameter and response-shape evidence, including the path discrepancy note recorded for this method.

Navigate next:

- `INDEX.md`
- `references/operation-mapping.md`
- `references/operations/getVeroReportItems_doc.md`
- `references/operations/getVeroReportItems_example.md`
- `rules/vero-report-tracking-flow.md`

## Intent: Handle A Decommissioned VeRO Row Safely

When to use it:

- You are migrating one of the VeRO rows and need to preserve both the decommission status and the usable REST guidance.

Recommended workflow:

1. Check `INDEX.md` first so the `Decommission` status stays visible.
2. Read the matching entry in `references/operation-mapping.md` and keep the exact note that the operation may already be migrated or decommissioned.
3. Use the bundled traditional decommissioned doc plus the modern VeRO support files to keep both status and usable REST guidance visible.
4. Use the modern REST methods only as the bundled evidence supports them.
5. Avoid claiming strict one-call SOAP parity when the workflow is now split across multiple REST methods or when the bundled support sources disagree on exact path detail.

Navigate next:

- `INDEX.md`
- `references/operation-mapping.md`
- `rules/vero-program-prerequisite.md`

## Intent: Handle No-Replacement Utility Rows

When to use it:

- You are evaluating `GeteBayOfficialTime`.

Recommended workflow:

1. Confirm the row status in `INDEX.md`.
2. Treat the task as removal, redesign, or local replacement logic rather than a direct eBay API migration.
3. Use `references/operation-mapping.md` and the traditional pending-evidence file to preserve the fact that no modern endpoint is validated in the bundled inventory.
4. Apply `rules/residual-no-replacement-ops.md` before deciding whether the capability can be dropped or replaced with local application behavior.

Navigate next:

- `INDEX.md`
- `references/operation-mapping.md`
- `references/operations/GeteBayOfficialTime_doc.md`
- `rules/residual-no-replacement-ops.md`

## Intent: Plan A Full Other APIs Migration

When to use it:

- You are building a migration plan for every row in the Other APIs domain.

Recommended workflow:

1. Enumerate all rows in `INDEX.md` and separate VeRO flows from no-replacement utility rows.
2. Keep `GetVeROReasonCodeDetails` in a split-mapping track, because it fans out to singular and collection VeRO lookups.
3. Keep `GetVeROReportStatus` and `VeROReportItems` in a report-tracking track.
4. Put `GeteBayOfficialTime` in a redesign or removal track instead of inventing a direct API replacement.

Navigate next:

- `INDEX.md`
- `references/operation-mapping.md`
- `rules/`

## Intent: Find Operation-Level Detail Or Payload Evidence

When to use it:

- You already know the traditional operation or modern VeRO method and need the exact bundled support artifact.

Recommended workflow:

1. Start in `references/operations/`.
2. Use the traditional `_doc.md` files for current evidence status and scope notes.
3. Use the modern `_doc.md` files for REST path, parameters, scope, and response details normalized from the bundled schema and usage examples.
4. Use the modern `_example.md` files when you need a concrete request or response example preserved from the bundled examples.

Navigate next:

- `references/operations/`