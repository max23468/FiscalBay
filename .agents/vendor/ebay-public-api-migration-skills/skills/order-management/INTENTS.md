# Order Management Intents

Use this file when the migration problem is easier to describe as a workflow than as a single traditional-operation lookup from `INDEX.md`.

Answer rule:

- When the selected `references/operation-mapping.md` entry includes guide-derived `Migration Guide:` bullets such as `Key changes`, `Key things to know`, prerequisites, sequencing, or caveats, include those points in the answer instead of returning only the replacement name.

## Intent: Migrate Combined Invoices Or Invoice Reminders

When to use it:

- You are converting `AddOrder` or `SendInvoice`.

Recommended workflow:

1. Check `INDEX.md` to confirm whether the traditional task creates a combined invoice, sends a payment reminder, or updates an unpaid quote.
2. Use `references/operation-mapping.md` under `Order creation and invoicing`.
3. Keep paid versus unpaid state explicit, because purchase quotes remain an unpaid-order surface for invoice reminders and cost adjustments before payment.
4. Open the Purchase Quote support files in `references/operations/` for exact GraphQL request and example material.

Navigate next:

- `references/operation-mapping.md`
- `references/operations/AddOrder_doc.md`
- `references/operations/SendInvoice_doc.md`
- `references/operations/createPurchaseQuote_doc.md`
- `references/operations/bulkUpdatePurchaseQuote_doc.md`

## Intent: Retrieve Paid Or Unpaid Orders Correctly

When to use it:

- You are converting `GetOrders`, `GetSellerTransactions`, `GetItemTransactions`, or the decommissioned `GetOrderTransactions` path.

Recommended workflow:

1. Decide whether the traditional request is about paid orders, unpaid commitments, or a mixed inventory reconciliation task.
2. Use `rules/paid-vs-unpaid-order-surfaces.md` before selecting a modern surface.
3. Replace traditional `TransactionID` handling with `orderLineItemId` when the old traditional integration depended on transaction-level identity.
4. Use GraphQL `orders`, `ordersByIds`, and `orderLineItemsByIds` for paid-order seller queries when GraphQL is acceptable.
5. Use GraphQL `itemCommitments` or `itemCommitmentsByIds` for unpaid commitments.
6. Use REST `getOrders` or `getOrder` when the workflow needs Fulfillment API order payloads or fulfillment-status-oriented REST behavior.

Navigate next:

- `references/operation-mapping.md`
- `rules/paid-vs-unpaid-order-surfaces.md`
- `references/operations/GetOrders_doc.md`
- `references/operations/orders_doc.md`
- `references/operations/itemCommitments_doc.md`
- `references/operations/getOrders_doc.md`

## Intent: Split CompleteSale By Outcome

When to use it:

- You are converting `CompleteSale`.

Recommended workflow:

1. Break the traditional task into payment, shipment, feedback, or INR-shipment update intent.
2. Use `rules/complete-sale-split.md` to choose the correct modern API.
3. Use `markOrdersPaid` for paid orders, `markItemCommitmentsPaid` for unpaid commitments, `createShippingFulfillment` for shipment creation, `leaveFeedback` for buyer feedback, and `provideShipmentInfoForItemNotReceivedInquiry` only when the task is actually an INR remediation step.
4. Do not present `CompleteSale` as a one-call parity migration.

Navigate next:

- `references/operation-mapping.md`
- `rules/complete-sale-split.md`
- `references/operations/CompleteSale_doc.md`
- `references/operations/markOrdersPaid_doc.md`
- `references/operations/markItemCommitmentsPaid_doc.md`
- `references/operations/createShippingFulfillment_doc.md`
- `references/operations/leaveFeedback_doc.md`

## Intent: Handle Seller Cancellations

When to use it:

- You are converting `SearchCancellations`, `ApproveCancellation`, `GetCancellation`, `CreateCancellationRequest`, `RejectCancellation`, or `CheckCancellationEligibility`.

Recommended workflow:

1. Confirm whether the order is already paid, still an item commitment, or still a purchase quote.
2. Use `sellerContractCancellations` and `contractCancellation` for search and lookup.
3. Choose the correct creation mutation based on the underlying paid or unpaid order surface.
4. Treat `CheckCancellationEligibility` as removed pre-check logic; ineligible requests now fail as business errors when a modern cancellation mutation is attempted.
5. Apply digital-signature guidance for in-scope sellers when cancellation actions require it.

Navigate next:

- `references/operation-mapping.md`
- `rules/cancellation-surface-selection.md`
- `rules/digital-signature-sensitive-ops.md`
- `references/operations/CreateCancellationRequest_doc.md`
- `references/operations/createOrderCancellation_doc.md`

## Intent: Work An INR Inquiry Or Case

When to use it:

- You are converting `GetInquiry`, `SearchInquiries`, `IssueInquiryRefund`, `ProvideInquiryShipmentInfo`, `SendInquiryMessage`, `EscalateInquiry`, `ProvideInquiryRefundInfo`, or case rows that land on inquiry flows.

Recommended workflow:

1. Confirm whether the traditional case or inquiry is about an item-not-received flow rather than a return.
2. Use `orderInquiry` for direct retrieval and `sellerOrderInquiries` for search.
3. Use dedicated mutations for refunds, shipment info, messages, and referrals instead of a generic case-management endpoint.
4. Treat `ProvideInquiryRefundInfo` as message-based fallback guidance, not direct parity.
5. Apply `rules/case-to-inquiry-or-return.md` when the traditional row is `GetCase`, `IssueCaseRefund`, or `AppealCaseDecision`.

Navigate next:

- `references/operation-mapping.md`
- `rules/case-to-inquiry-or-return.md`
- `references/operations/GetInquiry_doc.md`
- `references/operations/orderInquiry_doc.md`
- `references/operations/processOrderInquiryRefund_doc.md`

## Intent: Work A Return Or Return Preference Flow

When to use it:

- You are converting `GetReturn`, `SearchReturns`, `IssueReturnRefund`, `ProcessReturnRequest`, `SendReturnMessage`, `GetReturnPreferences`, `SetReturnPreferences`, `GetReturnFiles`, `GetShipmentTrackingInfo`, or related return-document/shipping-label rows.

Recommended workflow:

1. Use `orderReturn` for direct retrieval and `sellerOrderReturns` for search.
2. Break `ProcessReturnRequest` into the exact intended seller outcome: approve, decline, partial-refund keep-item, or RMA-number flow.
3. Use `sellerReturnPreference` and `updateSellerRMAPreference` for preference retrieval and update.
4. Keep `AddShippingLabelInfo`, `SendReturnShippingLabel`, `UploadReturnFile`, and `GetShipmentTrackingInfo` explicit about naming mismatches or the fact that the modern surface is a return lookup rather than a standalone tracking method.
5. Apply digital-signature guidance when refund-bearing return flows require it for EU or UK sellers.

Navigate next:

- `references/operation-mapping.md`
- `rules/return-decision-split.md`
- `rules/digital-signature-sensitive-ops.md`
- `references/operations/GetReturn_doc.md`
- `references/operations/orderReturn_doc.md`
- `references/operations/processReturnRefund_doc.md`

## Intent: Exclude Removed Traditional Rows

When to use it:

- You are evaluating decommissioned removed rows such as `CreateReturnRequest`, `CreateInquiry`, `CreateReturnDraft`, or old eligibility helpers.

Recommended workflow:

1. Confirm the row status in `INDEX.md`.
2. Keep the traditional operation visible in planning and documentation.
3. Do not invent seller-side parity for removed helper operations that have no validated replacement.
4. When a modern workflow exists only as surrounding context, document it as migration-note context rather than as a direct replacement call.

Navigate next:

- `INDEX.md`
- `references/operation-mapping.md`
- `rules/removed-legacy-rows.md`

## Intent: Find Operation-Level Detail Or Payload Evidence

When to use it:

- You need the most detailed bundled source evidence available for a specific order-management migration row.

Recommended workflow:

1. Start at the traditional `_doc.md` file for the operation.
2. Open the mapped modern `_doc.md` and `_example.md` files.
3. If the support file only contains validated inventory facts or a constrained modern-side extract, keep the migration answer limited to those confirmed facts and guide-derived workflow notes.

Navigate next:

- `references/operations/`

